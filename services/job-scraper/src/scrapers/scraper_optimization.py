"""
Scraper Optimization Module
Implements concurrent scraper initialization and pooling
"""

import asyncio
import logging
import time
from typing import Dict, List, Any, Optional, Type
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
import threading
from queue import Queue, Empty
import importlib
import inspect

logger = logging.getLogger(__name__)

@dataclass
class ScraperConfig:
    """Configuration for a scraper"""
    name: str
    module_path: str
    class_name: str
    max_instances: int = 5
    init_args: Dict[str, Any] = None
    init_kwargs: Dict[str, Any] = None
    priority: int = 3

class ScraperPool:
    """Pool for managing scraper instances"""
    
    def __init__(self, scraper_config: ScraperConfig, base_scraper_config: Dict[str, Any] = None):
        self.config = scraper_config
        self.base_config = base_scraper_config or {}
        self.pool = Queue(maxsize=scraper_config.max_instances)
        self.active_count = 0
        self.lock = threading.Lock()
        self._initialized = False
        self._scraper_class = None
        
    def _load_scraper_class(self) -> Type:
        """Dynamically load scraper class"""
        if self._scraper_class is None:
            module = importlib.import_module(self.config.module_path)
            self._scraper_class = getattr(module, self.config.class_name)
        return self._scraper_class
        
    def _create_scraper_instance(self):
        """Create a new scraper instance"""
        scraper_class = self._load_scraper_class()
        
        # Merge base config with scraper-specific config
        init_args = self.config.init_args or []
        init_kwargs = {**self.base_config, **(self.config.init_kwargs or {})}
        
        return scraper_class(*init_args, **init_kwargs)
        
    def initialize(self):
        """Initialize the pool with scraper instances"""
        if self._initialized:
            return
            
        logger.info(f"Initializing scraper pool for {self.config.name}")
        
        # Create initial instances
        for _ in range(min(2, self.config.max_instances)):
            instance = self._create_scraper_instance()
            self.pool.put(instance)
            
        self._initialized = True
        logger.info(f"Scraper pool {self.config.name} initialized with {self.pool.qsize()} instances")
        
    def acquire(self, timeout: float = None):
        """Acquire a scraper instance from the pool"""
        if not self._initialized:
            self.initialize()
            
        try:
            # Try to get from pool
            instance = self.pool.get(block=False)
            with self.lock:
                self.active_count += 1
            return instance
        except Empty:
            # Create new instance if below max
            with self.lock:
                if self.active_count < self.config.max_instances:
                    instance = self._create_scraper_instance()
                    self.active_count += 1
                    return instance
                    
            # Wait for available instance
            try:
                instance = self.pool.get(timeout=timeout)
                with self.lock:
                    self.active_count += 1
                return instance
            except Empty:
                raise TimeoutError(f"No available scraper instances for {self.config.name}")
                
    def release(self, instance):
        """Return a scraper instance to the pool"""
        if hasattr(instance, 'reset'):
            instance.reset()  # Reset scraper state if method exists
            
        self.pool.put(instance)
        with self.lock:
            self.active_count -= 1
            
    def get_stats(self) -> Dict[str, Any]:
        """Get pool statistics"""
        return {
            "name": self.config.name,
            "available": self.pool.qsize(),
            "active": self.active_count,
            "max_instances": self.config.max_instances,
            "initialized": self._initialized
        }

class ScraperOptimizer:
    """
    Optimizes scraper initialization and management
    """
    
    def __init__(self, max_workers: int = 4):
        self.scraper_pools: Dict[str, ScraperPool] = {}
        self.base_scraper_config: Dict[str, Any] = {}
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.initialization_times: Dict[str, float] = {}
        self._lock = threading.Lock()
        
    def load_base_scraper_config(self, config_path: str = None):
        """Load base scraper configuration"""
        # In a real implementation, this would load from a config file
        self.base_scraper_config = {
            "timeout": 30,
            "max_retries": 3,
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "rate_limit": 1.0  # seconds between requests
        }
        logger.info("Base scraper configuration loaded")
        
    def register_scraper(self, config: ScraperConfig):
        """Register a scraper for pooling"""
        with self._lock:
            if config.name not in self.scraper_pools:
                pool = ScraperPool(config, self.base_scraper_config)
                self.scraper_pools[config.name] = pool
                logger.info(f"Registered scraper: {config.name}")
                
    async def initialize_scrapers(self, concurrent: bool = True):
        """Initialize all registered scrapers"""
        logger.info(f"Initializing {len(self.scraper_pools)} scrapers...")
        
        if concurrent:
            # Initialize scrapers concurrently
            tasks = []
            for name, pool in self.scraper_pools.items():
                task = asyncio.create_task(self._initialize_scraper_async(name, pool))
                tasks.append(task)
                
            await asyncio.gather(*tasks, return_exceptions=True)
        else:
            # Initialize scrapers sequentially (by priority)
            sorted_pools = sorted(
                self.scraper_pools.items(),
                key=lambda x: x[1].config.priority
            )
            
            for name, pool in sorted_pools:
                await self._initialize_scraper_async(name, pool)
                
        total_time = sum(self.initialization_times.values())
        logger.info(f"All scrapers initialized in {total_time:.2f} seconds total")
        
    async def _initialize_scraper_async(self, name: str, pool: ScraperPool):
        """Initialize a scraper asynchronously"""
        start_time = time.time()
        
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(self.executor, pool.initialize)
            
            self.initialization_times[name] = time.time() - start_time
            logger.info(f"Scraper {name} initialized in {self.initialization_times[name]:.2f} seconds")
            
        except Exception as e:
            logger.error(f"Failed to initialize scraper {name}: {str(e)}")
            self.initialization_times[name] = time.time() - start_time
            
    def get_scraper(self, name: str, timeout: float = None):
        """Get a scraper instance from the pool"""
        if name not in self.scraper_pools:
            raise ValueError(f"Scraper {name} not registered")
            
        pool = self.scraper_pools[name]
        return pool.acquire(timeout)
        
    def release_scraper(self, name: str, instance):
        """Release a scraper instance back to the pool"""
        if name not in self.scraper_pools:
            raise ValueError(f"Scraper {name} not registered")
            
        pool = self.scraper_pools[name]
        pool.release(instance)
        
    def get_all_stats(self) -> Dict[str, Any]:
        """Get statistics for all scraper pools"""
        stats = {
            "total_scrapers": len(self.scraper_pools),
            "initialization_times": self.initialization_times,
            "pools": {}
        }
        
        for name, pool in self.scraper_pools.items():
            stats["pools"][name] = pool.get_stats()
            
        return stats
        
    def cleanup(self):
        """Cleanup resources"""
        self.executor.shutdown(wait=True)
        logger.info("Scraper optimizer cleaned up")

# Context manager for scraper usage
class ScraperContext:
    """Context manager for safe scraper usage"""
    
    def __init__(self, optimizer: ScraperOptimizer, scraper_name: str, timeout: float = None):
        self.optimizer = optimizer
        self.scraper_name = scraper_name
        self.timeout = timeout
        self.instance = None
        
    def __enter__(self):
        self.instance = self.optimizer.get_scraper(self.scraper_name, self.timeout)
        return self.instance
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.instance:
            self.optimizer.release_scraper(self.scraper_name, self.instance)

# Default scraper configurations
DEFAULT_SCRAPERS = [
    ScraperConfig(
        name="linkedin",
        module_path="scrapers.linkedin_scraper",
        class_name="LinkedInScraper",
        max_instances=3,
        priority=1
    ),
    ScraperConfig(
        name="indeed",
        module_path="scrapers.indeed_scraper", 
        class_name="IndeedScraper",
        max_instances=5,
        priority=2
    ),
    ScraperConfig(
        name="glassdoor",
        module_path="scrapers.glassdoor_scraper",
        class_name="GlassdoorScraper",
        max_instances=3,
        priority=2
    ),
    ScraperConfig(
        name="pnet",
        module_path="scrapers.pnet_scraper",
        class_name="PnetScraper",
        max_instances=4,
        priority=1
    ),
    ScraperConfig(
        name="careers24",
        module_path="scrapers.careers24_scraper",
        class_name="Careers24Scraper",
        max_instances=4,
        priority=2
    )
]

# Singleton instance
_scraper_optimizer = None

def get_scraper_optimizer() -> ScraperOptimizer:
    """Get the singleton scraper optimizer instance"""
    global _scraper_optimizer
    if _scraper_optimizer is None:
        _scraper_optimizer = ScraperOptimizer()
        
        # Load base configuration
        _scraper_optimizer.load_base_scraper_config()
        
        # Register default scrapers
        for scraper_config in DEFAULT_SCRAPERS:
            _scraper_optimizer.register_scraper(scraper_config)
            
    return _scraper_optimizer

# Example usage
async def example_usage():
    """Example of how to use the scraper optimizer"""
    optimizer = get_scraper_optimizer()
    
    # Initialize all scrapers
    await optimizer.initialize_scrapers(concurrent=True)
    
    # Use a scraper with context manager
    with ScraperContext(optimizer, "linkedin") as scraper:
        # Use the scraper instance
        results = scraper.scrape_jobs("python developer", "cape town")
        
    # Get statistics
    stats = optimizer.get_all_stats()
    logger.info(f"Scraper stats: {stats}")
