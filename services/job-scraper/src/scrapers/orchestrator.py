"""
Advanced scraper orchestrator implementing hybrid scraping approach.
Manages Scrapy clusters, Playwright instances, and SerpAPI integration.
"""

import asyncio
import random
from typing import List, Dict, Any, Optional, Set
from datetime import datetime, timedelta
import aioredis
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from loguru import logger
import json
from tenacity import retry, stop_after_attempt, wait_exponential
from dataclasses import dataclass, field
from enum import Enum

from src.config.settings import settings
from src.scrapers.base_scraper import BaseScraper
# DISCONNECTED - Non-working/Risky scrapers removed
# from src.scrapers.linkedin_scraper import LinkedInScraper  # DISCONNECTED - No API, legal risk
# from src.scrapers.indeed_scraper import IndeedScraper      # DISCONNECTED - Waiting for approval
# from src.scrapers.glassdoor_scraper import GlassdoorScraper # DISCONNECTED - Blocks scrapers

# LEGAL SCRAPERS ONLY
from src.scrapers.company_scraper import CompanyScraper
from src.scrapers.serpapi_scraper import SerpAPIScraper
from src.scrapers.rss_parser import RSSFeedParser
from src.scrapers.government_scraper import GovernmentPortalScraper
from src.utils.circuit_breaker import CircuitBreaker
from src.utils.health_monitor import HealthMonitor
from src.utils.anomaly_detector import AnomalyDetector


class ScraperType(Enum):
    """Scraper type enumeration."""
    SCRAPY = "scrapy"
    PLAYWRIGHT = "playwright"
    SERPAPI = "serpapi"
    HYBRID = "hybrid"


@dataclass
class ScraperTask:
    """Scraper task definition."""
    id: str
    source: str
    scraper_type: ScraperType
    url: Optional[str] = None
    filters: Dict[str, Any] = field(default_factory=dict)
    priority: int = 5
    created_at: datetime = field(default_factory=datetime.utcnow)
    retry_count: int = 0
    max_retries: int = 3
    status: str = "pending"
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class ScraperPool:
    """Manages a pool of scraper instances."""
    
    def __init__(self, scraper_class: type, max_instances: int = 10):
        self.scraper_class = scraper_class
        self.max_instances = max_instances
        self.available: asyncio.Queue = asyncio.Queue()
        self.in_use: Set[BaseScraper] = set()
        self.lock = asyncio.Lock()
        
    async def initialize(self):
        """Initialize scraper pool."""
        for _ in range(self.max_instances):
            scraper = self.scraper_class()
            await scraper.initialize()
            await self.available.put(scraper)
    
    async def acquire(self) -> BaseScraper:
        """Acquire a scraper from pool."""
        scraper = await self.available.get()
        async with self.lock:
            self.in_use.add(scraper)
        return scraper
    
    async def release(self, scraper: BaseScraper):
        """Release scraper back to pool."""
        async with self.lock:
            self.in_use.discard(scraper)
        await self.available.put(scraper)
    
    async def cleanup(self):
        """Clean up all scrapers."""
        # Clean up in-use scrapers
        for scraper in self.in_use:
            await scraper.cleanup()
        
        # Clean up available scrapers
        while not self.available.empty():
            scraper = await self.available.get()
            await scraper.cleanup()


class ScraperOrchestrator:
    """
    Advanced scraper orchestrator with self-healing capabilities.
    Manages distributed scraping across multiple sources and technologies.
    """
    
    def __init__(self):
        self.redis_client: Optional[aioredis.Redis] = None
        self.kafka_producer: Optional[AIOKafkaProducer] = None
        self.kafka_consumer: Optional[AIOKafkaConsumer] = None
        
        # Scraper pools
        self.scraper_pools: Dict[str, ScraperPool] = {}
        
        # Circuit breakers for each domain
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        
        # Health monitoring
        self.health_monitor = HealthMonitor()
        self.anomaly_detector = AnomalyDetector()
        
        # Task management
        self.active_tasks: Dict[str, ScraperTask] = {}
        self.task_queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self.completed_tasks: Set[str] = set()
        
        # Performance metrics
        self.metrics = {
            "tasks_completed": 0,
            "tasks_failed": 0,
            "jobs_scraped": 0,
            "average_task_time": 0,
            "domain_success_rates": {}
        }
        
        # Control flags
        self.is_running = False
        self.workers: List[asyncio.Task] = []
        
    async def initialize(self):
        """Initialize orchestrator components."""
        logger.info("Initializing scraper orchestrator...")
        
        # Initialize Redis
        self.redis_client = await aioredis.create_redis_pool(
            settings.redis_url,
            password=settings.redis_password,
            minsize=5,
            maxsize=20
        )
        
        # Initialize Kafka
        self.kafka_producer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode()
        )
        await self.kafka_producer.start()
        
        self.kafka_consumer = AIOKafkaConsumer(
            'scraping-tasks',
            bootstrap_servers=settings.kafka_bootstrap_servers,
            group_id='scraper-orchestrator',
            value_deserializer=lambda v: json.loads(v.decode())
        )
        await self.kafka_consumer.start()
        
        # Initialize LEGAL SCRAPERS ONLY - 100% Compliant
        self.scraper_pools = {
            #  OPERATIONAL LEGAL SCRAPERS
            "serpapi": ScraperPool(SerpAPIScraper, max_instances=30),  # PRIMARY - Paid API (Legal)
            "rss_feeds": ScraperPool(RSSFeedParser, max_instances=20),  # RSS Syndication (Legal)
            "government": ScraperPool(GovernmentPortalScraper, max_instances=10),  # Public Domain (Legal)
            "company": ScraperPool(CompanyScraper, max_instances=15),  # Direct Career Pages (Legal)
            
            #  DISCONNECTED SCRAPERS - Permanently removed for legal/technical reasons
            # "linkedin": DISCONNECTED - No API key, high legal risk
            # "indeed": DISCONNECTED - Waiting for Publisher Program approval
            # "glassdoor": DISCONNECTED - No API access, blocks scrapers
            # "jobspy": DISCONNECTED - Legal risk if run server-side
        }
        
        logger.critical(" LEGAL SCRAPER POOLS INITIALIZED")
        logger.critical(f" Active: SerpAPI, RSS, Government, Company")
        logger.critical(f" Disconnected: LinkedIn, Indeed, Glassdoor, JobSpy")
        
        for pool in self.scraper_pools.values():
            await pool.initialize()
        
        # Initialize circuit breakers
        self._initialize_circuit_breakers()
        
        # Start health monitoring
        await self.health_monitor.start()
        
        # Start quota monitoring for automatic month transitions
        try:
            from src.utils.quota_scheduler import start_quota_monitoring
            asyncio.create_task(start_quota_monitoring())
            logger.critical("SerpAPI quota scheduler started - monitoring for September 2025 transition")
        except Exception as e:
            logger.error(f"Failed to start quota scheduler: {e}")
        
        logger.info("Scraper orchestrator initialized successfully")
    
    def _initialize_circuit_breakers(self):
        """Initialize circuit breakers for known domains."""
        domains = [
            "linkedin.com", "indeed.com", "glassdoor.com",
            "careers.google.com", "greenhouse.io", "lever.co"
        ]
        
        for domain in domains:
            self.circuit_breakers[domain] = CircuitBreaker(
                failure_threshold=5,
                recovery_timeout=300,
                expected_exception=Exception
            )
    
    async def start(self, num_workers: int = None):
        """Start the orchestrator with specified number of workers."""
        if self.is_running:
            logger.warning("Orchestrator is already running")
            return
        
        self.is_running = True
        num_workers = num_workers or settings.max_concurrent_scrapers
        
        # Start task consumer
        asyncio.create_task(self._consume_tasks())
        
        # Start worker tasks
        for i in range(num_workers):
            worker = asyncio.create_task(self._worker(f"worker-{i}"))
            self.workers.append(worker)
        
        # Start monitoring tasks
        asyncio.create_task(self._monitor_health())
        asyncio.create_task(self._detect_anomalies())
        asyncio.create_task(self._auto_scale())
        
        logger.info(f"Started orchestrator with {num_workers} workers")
    
    async def stop(self):
        """Stop the orchestrator gracefully."""
        logger.info("Stopping scraper orchestrator...")
        self.is_running = False
        
        # Cancel all workers
        for worker in self.workers:
            worker.cancel()
        
        # Wait for workers to finish
        await asyncio.gather(*self.workers, return_exceptions=True)
        
        # Clean up resources
        await self._cleanup()
        
        logger.info("Scraper orchestrator stopped")
    
    async def _cleanup(self):
        """Clean up all resources."""
        # Clean up scraper pools
        for pool in self.scraper_pools.values():
            await pool.cleanup()
        
        # Close connections
        if self.kafka_producer:
            await self.kafka_producer.stop()
        if self.kafka_consumer:
            await self.kafka_consumer.stop()
        if self.redis_client:
            self.redis_client.close()
            await self.redis_client.wait_closed()
        
        # Stop monitoring
        await self.health_monitor.stop()
    
    async def _consume_tasks(self):
        """Consume tasks from Kafka."""
        async for msg in self.kafka_consumer:
            if not self.is_running:
                break
            
            try:
                task_data = msg.value
                
                if task_data.get("action") == "start":
                    await self._create_scraping_tasks(
                        sources=task_data.get("sources", []),
                        filters=task_data.get("filters", {})
                    )
                elif task_data.get("action") == "stop":
                    task_id = task_data.get("task_id")
                    if task_id:
                        await self._cancel_task(task_id)
                
            except Exception as e:
                logger.error(f"Error consuming task: {e}")
    
    async def _create_scraping_tasks(self, sources: List[str], filters: Dict[str, Any]):
        """Create scraping tasks based on sources and filters."""
        for source in sources:
            # Determine scraper type based on source and current health
            scraper_type = await self._determine_scraper_type(source)
            
            # Create base task
            task = ScraperTask(
                id=f"{source}-{datetime.utcnow().timestamp()}",
                source=source,
                scraper_type=scraper_type,
                filters=filters,
                priority=self._calculate_priority(source, filters)
            )
            
            if source in ["linkedin", "indeed", "glassdoor"]:
                # Create search URL based on filters
                search_url = self._build_search_url(source, filters)
                task.url = search_url
                
                # Add to Scrapy Redis queue for distributed crawling
                if scraper_type == ScraperType.SCRAPY:
                    await self._add_to_scrapy_queue(source, search_url, filters)
            
            # Add to task queue
            await self.task_queue.put((task.priority, task))
            self.active_tasks[task.id] = task
            
            logger.info(f"Created task {task.id} for {source} with {scraper_type.value}")
    
    async def _determine_scraper_type(self, source: str) -> ScraperType:
        """Determine optimal scraper type based on source and health."""
        #  PRIORITY: Use SerpAPI for operational sources with real API key
        if source in ["serpapi", "comprehensive_sa"] or settings.serpapi_enabled:
            logger.info(f"Using SerpAPI for {source} - REAL DATA MODE")
            return ScraperType.SERPAPI
            
        # Check circuit breaker status
        domain = self._get_domain(source)
        if domain in self.circuit_breakers:
            if self.circuit_breakers[domain].is_open:
                # Use SerpAPI as fallback
                logger.info(f"Circuit breaker open for {domain}, using SerpAPI fallback")
                return ScraperType.SERPAPI
        
        # Check if real scraping is enabled - prioritize SerpAPI
        if settings.enable_real_scraping and not settings.use_mock_data:
            logger.info(f"Real scraping enabled, prioritizing SerpAPI for {source}")
            return ScraperType.SERPAPI
        
        # Check source-specific requirements for demo mode
        if source == "linkedin":
            # LinkedIn requires browser automation (demo mode only)
            logger.warning(f"LinkedIn scraper in demo mode - no real API key")
            return ScraperType.PLAYWRIGHT
        elif source in ["indeed", "glassdoor"]:
            # These can use Scrapy for scale (demo mode only)
            logger.warning(f"{source} scraper in demo mode - no real API key")
            success_rate = self.metrics["domain_success_rates"].get(domain, 1.0)
            if success_rate > 0.8:
                return ScraperType.SCRAPY
            else:
                return ScraperType.PLAYWRIGHT
        elif source == "company":
            # Company pages often need JavaScript - now uses SerpAPI data
            return ScraperType.PLAYWRIGHT
        else:
            # Default to SerpAPI for comprehensive coverage
            return ScraperType.SERPAPI
    
    def _calculate_priority(self, source: str, filters: Dict[str, Any]) -> int:
        """Calculate task priority (lower number = higher priority)."""
        priority = 5
        
        # Executive positions get higher priority
        if filters.get("job_level") in ["executive", "director", "c_suite"]:
            priority -= 2
        
        # Fresh sources get higher priority
        last_scraped = self.metrics.get(f"last_scraped_{source}")
        if last_scraped:
            hours_since = (datetime.utcnow() - last_scraped).total_seconds() / 3600
            if hours_since > 24:
                priority -= 1
        
        # Sources with higher success rates get higher priority
        success_rate = self.metrics["domain_success_rates"].get(source, 0.5)
        if success_rate > 0.9:
            priority -= 1
        
        return max(1, priority)
    
    def _build_search_url(self, source: str, filters: Dict[str, Any]) -> str:
        """Build search URL based on source and filters."""
        base_urls = {
            "linkedin": "https://www.linkedin.com/jobs/search",
            "indeed": "https://www.indeed.com/jobs",
            "glassdoor": "https://www.glassdoor.com/Job/jobs.htm"
        }
        
        # Build query parameters
        params = []
        
        if filters.get("keywords"):
            params.append(f"q={'+'.join(filters['keywords'])}")
        
        if filters.get("location"):
            params.append(f"l={filters['location'].replace(' ', '+')}")
        
        if filters.get("job_level"):
            # Map to source-specific parameters
            level_mapping = {
                "linkedin": {"entry": "1", "mid": "2,3", "senior": "4", "executive": "5,6"},
                "indeed": {"entry": "entry_level", "mid": "mid_level", "senior": "senior_level"},
                "glassdoor": {"entry": "ENTRYLEVEL", "mid": "MIDSENIOR", "senior": "SENIOR"}
            }
            if source in level_mapping:
                level_param = level_mapping[source].get(filters["job_level"])
                if level_param:
                    if source == "linkedin":
                        params.append(f"f_E={level_param}")
                    else:
                        params.append(f"explvl={level_param}")
        
        url = base_urls.get(source, "")
        if params:
            url += "?" + "&".join(params)
        
        return url
    
    async def _add_to_scrapy_queue(self, source: str, url: str, filters: Dict[str, Any]):
        """Add URL to Scrapy Redis queue for distributed crawling."""
        spider_key = f"{source}_spider:start_urls"
        
        data = {
            "url": url,
            "meta": {
                "filters": filters,
                "source": source,
                "added_at": datetime.utcnow().isoformat()
            }
        }
        
        await self.redis_client.lpush(spider_key, json.dumps(data))
        logger.debug(f"Added {url} to Scrapy queue {spider_key}")
    
    async def _worker(self, worker_id: str):
        """Worker task that processes scraping tasks."""
        logger.info(f"Worker {worker_id} started")
        
        while self.is_running:
            try:
                # Get task from queue (with timeout to allow checking is_running)
                try:
                    priority, task = await asyncio.wait_for(
                        self.task_queue.get(),
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue
                
                # Process task
                logger.info(f"Worker {worker_id} processing task {task.id}")
                
                start_time = datetime.utcnow()
                
                try:
                    result = await self._execute_task(task)
                    task.status = "completed"
                    task.result = result
                    
                    # Update metrics
                    self.metrics["tasks_completed"] += 1
                    self.metrics["jobs_scraped"] += len(result.get("jobs", []))
                    
                    # Send results to Kafka
                    await self._publish_results(task, result)
                    
                except Exception as e:
                    logger.error(f"Task {task.id} failed: {e}")
                    task.status = "failed"
                    task.error = str(e)
                    task.retry_count += 1
                    
                    self.metrics["tasks_failed"] += 1
                    
                    # Retry if under limit
                    if task.retry_count < task.max_retries:
                        task.priority += 1  # Lower priority for retry
                        await self.task_queue.put((task.priority, task))
                        logger.info(f"Retrying task {task.id} ({task.retry_count}/{task.max_retries})")
                    else:
                        logger.error(f"Task {task.id} failed after {task.max_retries} retries")
                
                # Update task timing
                duration = (datetime.utcnow() - start_time).total_seconds()
                self._update_timing_metrics(duration)
                
                # Mark task as completed
                self.completed_tasks.add(task.id)
                del self.active_tasks[task.id]
                
            except Exception as e:
                logger.error(f"Worker {worker_id} error: {e}")
                await asyncio.sleep(1)
        
        logger.info(f"Worker {worker_id} stopped")
    
    async def _execute_task(self, task: ScraperTask) -> Dict[str, Any]:
        """Execute a scraping task."""
        if task.scraper_type == ScraperType.SCRAPY:
            # Scrapy tasks are handled by distributed crawlers
            # Wait for results from Redis
            return await self._wait_for_scrapy_results(task)
        
        elif task.scraper_type == ScraperType.PLAYWRIGHT:
            # Use Playwright scraper
            return await self._execute_playwright_task(task)
        
        elif task.scraper_type == ScraperType.SERPAPI:
            # Use SerpAPI
            return await self._execute_serpapi_task(task)
        
        elif task.scraper_type == ScraperType.HYBRID:
            # Try multiple approaches
            return await self._execute_hybrid_task(task)
        
        else:
            raise ValueError(f"Unknown scraper type: {task.scraper_type}")
    
    async def _execute_playwright_task(self, task: ScraperTask) -> Dict[str, Any]:
        """Execute task using Playwright scraper."""
        pool = self.scraper_pools.get(task.source)
        if not pool:
            pool = self.scraper_pools["company"]  # Fallback
        
        scraper = await pool.acquire()
        
        try:
            # Apply circuit breaker
            domain = self._get_domain(task.source)
            cb = self.circuit_breakers.get(domain)
            
            if cb:
                async with cb:
                    result = await scraper.scrape(
                        url=task.url,
                        filters=task.filters
                    )
            else:
                result = await scraper.scrape(
                    url=task.url,
                    filters=task.filters
                )
            
            # Update success metrics
            self._update_domain_metrics(domain, success=True)
            
            return result
            
        except Exception as e:
            # Update failure metrics
            domain = self._get_domain(task.source)
            self._update_domain_metrics(domain, success=False)
            raise
            
        finally:
            await pool.release(scraper)
    
    async def _execute_serpapi_task(self, task: ScraperTask) -> Dict[str, Any]:
        """Execute task using SerpAPI."""
        pool = self.scraper_pools["serpapi"]
        scraper = await pool.acquire()
        
        try:
            result = await scraper.scrape(
                source=task.source,
                filters=task.filters
            )
            return result
            
        finally:
            await pool.release(scraper)
    
    async def _execute_hybrid_task(self, task: ScraperTask) -> Dict[str, Any]:
        """Execute task using hybrid approach."""
        results = {"jobs": [], "companies": []}
        
        # Try SerpAPI first for search results
        try:
            serpapi_results = await self._execute_serpapi_task(task)
            results["jobs"].extend(serpapi_results.get("jobs", []))
        except Exception as e:
            logger.warning(f"SerpAPI failed for {task.id}: {e}")
        
        # Then use Playwright for detailed extraction
        if task.url:
            try:
                playwright_results = await self._execute_playwright_task(task)
                results["jobs"].extend(playwright_results.get("jobs", []))
                results["companies"].extend(playwright_results.get("companies", []))
            except Exception as e:
                logger.warning(f"Playwright failed for {task.id}: {e}")
        
        # Deduplicate results
        seen_job_ids = set()
        unique_jobs = []
        for job in results["jobs"]:
            if job["id"] not in seen_job_ids:
                seen_job_ids.add(job["id"])
                unique_jobs.append(job)
        
        results["jobs"] = unique_jobs
        return results
    
    async def _wait_for_scrapy_results(self, task: ScraperTask, timeout: int = 300) -> Dict[str, Any]:
        """Wait for Scrapy results from Redis."""
        result_key = f"scrapy_results:{task.id}"
        
        # Poll for results
        start_time = datetime.utcnow()
        while (datetime.utcnow() - start_time).total_seconds() < timeout:
            # Check for results
            results_data = await self.redis_client.get(result_key)
            if results_data:
                results = json.loads(results_data)
                await self.redis_client.delete(result_key)
                return results
            
            # Check for error
            error_data = await self.redis_client.get(f"scrapy_errors:{task.id}")
            if error_data:
                error = json.loads(error_data)
                await self.redis_client.delete(f"scrapy_errors:{task.id}")
                raise Exception(f"Scrapy error: {error}")
            
            await asyncio.sleep(5)
        
        raise TimeoutError(f"Scrapy results timeout for task {task.id}")
    
    async def _publish_results(self, task: ScraperTask, results: Dict[str, Any]):
        """Publish scraping results to Kafka."""
        for job in results.get("jobs", []):
            message = {
                "type": "job_scraped",
                "job": job,
                "task_id": task.id,
                "source": task.source,
                "scraped_at": datetime.utcnow().isoformat()
            }
            
            await self.kafka_producer.send(
                settings.kafka_topic_jobs,
                value=message
            )
        
        # Publish analytics event
        analytics_message = {
            "type": "scraping_completed",
            "task_id": task.id,
            "source": task.source,
            "jobs_count": len(results.get("jobs", [])),
            "duration": task.result.get("duration") if task.result else None,
            "success": task.status == "completed"
        }
        
        await self.kafka_producer.send(
            settings.kafka_topic_analytics,
            value=analytics_message
        )
    
    async def _monitor_health(self):
        """Monitor system health and perform self-healing."""
        while self.is_running:
            try:
                # Check worker health
                active_workers = sum(1 for w in self.workers if not w.done())
                if active_workers < len(self.workers) * 0.8:
                    logger.warning(f"Low worker count: {active_workers}/{len(self.workers)}")
                    # Restart failed workers
                    await self._restart_failed_workers()
                
                # Check task processing rate
                if self.task_queue.qsize() > 100:
                    logger.warning(f"High task queue size: {self.task_queue.qsize()}")
                    # Scale up workers if needed
                    await self._scale_workers(increase=True)
                
                # Check domain health
                for domain, cb in self.circuit_breakers.items():
                    if cb.is_open:
                        logger.warning(f"Circuit breaker open for {domain}")
                
                # Update health status
                health_status = {
                    "active_workers": active_workers,
                    "queue_size": self.task_queue.qsize(),
                    "active_tasks": len(self.active_tasks),
                    "completed_tasks": len(self.completed_tasks),
                    "metrics": self.metrics
                }
                
                await self.health_monitor.update_status("orchestrator", health_status)
                
            except Exception as e:
                logger.error(f"Health monitoring error: {e}")
            
            await asyncio.sleep(30)
    
    async def _detect_anomalies(self):
        """Detect anomalies in scraping patterns."""
        while self.is_running:
            try:
                # Collect recent metrics
                metrics = {
                    "success_rate": self._calculate_success_rate(),
                    "avg_response_time": self.metrics.get("average_task_time", 0),
                    "jobs_per_task": self._calculate_jobs_per_task(),
                    "error_rate": self._calculate_error_rate()
                }
                
                # Check for anomalies
                anomalies = await self.anomaly_detector.detect(metrics)
                
                if anomalies:
                    logger.warning(f"Anomalies detected: {anomalies}")
                    
                    # Take corrective action
                    for anomaly in anomalies:
                        await self._handle_anomaly(anomaly)
                
            except Exception as e:
                logger.error(f"Anomaly detection error: {e}")
            
            await asyncio.sleep(60)
    
    async def _auto_scale(self):
        """Auto-scale workers based on load."""
        while self.is_running:
            try:
                queue_size = self.task_queue.qsize()
                active_workers = sum(1 for w in self.workers if not w.done())
                
                # Scale up if queue is growing
                if queue_size > active_workers * 10:
                    await self._scale_workers(increase=True)
                
                # Scale down if queue is empty and we have too many workers
                elif queue_size == 0 and active_workers > 5:
                    await self._scale_workers(increase=False)
                
            except Exception as e:
                logger.error(f"Auto-scaling error: {e}")
            
            await asyncio.sleep(60)
    
    async def _restart_failed_workers(self):
        """Restart failed worker tasks."""
        new_workers = []
        
        for i, worker in enumerate(self.workers):
            if worker.done():
                # Get exception if any
                try:
                    worker.result()
                except Exception as e:
                    logger.error(f"Worker {i} failed: {e}")
                
                # Start new worker
                new_worker = asyncio.create_task(self._worker(f"worker-{i}-restarted"))
                new_workers.append(new_worker)
            else:
                new_workers.append(worker)
        
        self.workers = new_workers
    
    async def _scale_workers(self, increase: bool):
        """Scale worker count up or down."""
        current_count = len(self.workers)
        
        if increase and current_count < settings.max_concurrent_scrapers:
            # Add workers
            new_count = min(current_count + 5, settings.max_concurrent_scrapers)
            for i in range(current_count, new_count):
                worker = asyncio.create_task(self._worker(f"worker-{i}"))
                self.workers.append(worker)
            logger.info(f"Scaled up to {new_count} workers")
            
        elif not increase and current_count > 5:
            # Remove workers
            new_count = max(current_count - 5, 5)
            # Cancel excess workers
            for worker in self.workers[new_count:]:
                worker.cancel()
            self.workers = self.workers[:new_count]
            logger.info(f"Scaled down to {new_count} workers")
    
    async def _handle_anomaly(self, anomaly: Dict[str, Any]):
        """Handle detected anomaly."""
        anomaly_type = anomaly.get("type")
        
        if anomaly_type == "low_success_rate":
            # Increase delays and rotate proxies
            logger.info("Handling low success rate anomaly")
            for scraper_pool in self.scraper_pools.values():
                # This would update scraper configurations
                pass
        
        elif anomaly_type == "high_response_time":
            # Reduce concurrent requests
            logger.info("Handling high response time anomaly")
            await self._scale_workers(increase=False)
        
        elif anomaly_type == "low_job_yield":
            # Update search parameters
            logger.info("Handling low job yield anomaly")
            # This would adjust search strategies
    
    def _get_domain(self, source: str) -> str:
        """Get domain from source."""
        domain_mapping = {
            "linkedin": "linkedin.com",
            "indeed": "indeed.com",
            "glassdoor": "glassdoor.com",
            "company": "various",
            "serpapi": "serpapi.com"
        }
        return domain_mapping.get(source, source)
    
    def _update_domain_metrics(self, domain: str, success: bool):
        """Update domain success metrics."""
        if domain not in self.metrics["domain_success_rates"]:
            self.metrics["domain_success_rates"][domain] = []
        
        # Keep last 100 results
        results = self.metrics["domain_success_rates"][domain]
        results.append(1 if success else 0)
        if len(results) > 100:
            results.pop(0)
        
        # Calculate success rate
        success_rate = sum(results) / len(results) if results else 0
        self.metrics["domain_success_rates"][domain] = success_rate
    
    def _update_timing_metrics(self, duration: float):
        """Update timing metrics."""
        # Simple moving average
        current_avg = self.metrics["average_task_time"]
        count = self.metrics["tasks_completed"] + self.metrics["tasks_failed"]
        
        if count > 0:
            self.metrics["average_task_time"] = (current_avg * (count - 1) + duration) / count
    
    def _calculate_success_rate(self) -> float:
        """Calculate overall success rate."""
        total = self.metrics["tasks_completed"] + self.metrics["tasks_failed"]
        if total == 0:
            return 1.0
        return self.metrics["tasks_completed"] / total
    
    def _calculate_jobs_per_task(self) -> float:
        """Calculate average jobs per task."""
        if self.metrics["tasks_completed"] == 0:
            return 0
        return self.metrics["jobs_scraped"] / self.metrics["tasks_completed"]
    
    def _calculate_error_rate(self) -> float:
        """Calculate error rate."""
        total = self.metrics["tasks_completed"] + self.metrics["tasks_failed"]
        if total == 0:
            return 0
        return self.metrics["tasks_failed"] / total
    
    async def _cancel_task(self, task_id: str):
        """Cancel a specific task."""
        if task_id in self.active_tasks:
            task = self.active_tasks[task_id]
            task.status = "cancelled"
            del self.active_tasks[task_id]
            logger.info(f"Cancelled task {task_id}")
    
    async def get_status(self) -> Dict[str, Any]:
        """Get orchestrator status."""
        return {
            "is_running": self.is_running,
            "workers": len(self.workers),
            "active_workers": sum(1 for w in self.workers if not w.done()),
            "queue_size": self.task_queue.qsize(),
            "active_tasks": len(self.active_tasks),
            "completed_tasks": len(self.completed_tasks),
            "metrics": self.metrics,
            "circuit_breakers": {
                domain: {"is_open": cb.is_open, "failure_count": cb.failure_count}
                for domain, cb in self.circuit_breakers.items()
            }
        }


# Global orchestrator instance
orchestrator = ScraperOrchestrator()
