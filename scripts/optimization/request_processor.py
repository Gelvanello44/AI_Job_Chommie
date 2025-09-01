"""
Request Processor - Implements intelligent request handling and batch processing
Optimizes resource usage by queuing, caching, and batching similar requests
"""

import asyncio
import time
import logging
from typing import Dict, List, Optional, Any, Callable, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta
import hashlib
import json
from collections import defaultdict
import heapq
from concurrent.futures import ThreadPoolExecutor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RequestPriority(Enum):
    """Request priority levels"""
    CRITICAL = 1
    HIGH = 2
    NORMAL = 3
    LOW = 4
    BACKGROUND = 5


class RequestStatus(Enum):
    """Request processing status"""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CACHED = "cached"
    BATCHED = "batched"


@dataclass
class Request:
    """Request data structure"""
    id: str
    endpoint: str
    method: str
    data: Dict[str, Any]
    priority: RequestPriority = RequestPriority.NORMAL
    timestamp: datetime = field(default_factory=datetime.now)
    cache_key: Optional[str] = None
    batch_key: Optional[str] = None
    callback: Optional[Callable] = None
    timeout: float = 30.0
    retry_count: int = 0
    max_retries: int = 3
    
    def __lt__(self, other):
        """Compare requests by priority and timestamp"""
        if self.priority.value != other.priority.value:
            return self.priority.value < other.priority.value
        return self.timestamp < other.timestamp


@dataclass
class RequestResult:
    """Result of request processing"""
    request_id: str
    status: RequestStatus
    data: Optional[Any] = None
    error: Optional[str] = None
    processing_time: float = 0.0
    from_cache: bool = False
    batch_id: Optional[str] = None


class RequestCache:
    """Simple in-memory cache for request results"""
    
    def __init__(self, ttl_seconds: int = 300, max_size: int = 1000):
        self.cache: Dict[str, Tuple[Any, datetime]] = {}
        self.ttl = timedelta(seconds=ttl_seconds)
        self.max_size = max_size
        self.hits = 0
        self.misses = 0
        self.lock = asyncio.Lock()
        
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        async with self.lock:
            if key in self.cache:
                value, timestamp = self.cache[key]
                if datetime.now() - timestamp < self.ttl:
                    self.hits += 1
                    return value
                else:
                    del self.cache[key]
                    
            self.misses += 1
            return None
            
    async def set(self, key: str, value: Any):
        """Set value in cache"""
        async with self.lock:
            # Evict oldest entries if cache is full
            if len(self.cache) >= self.max_size:
                oldest_key = min(self.cache.keys(), 
                               key=lambda k: self.cache[k][1])
                del self.cache[oldest_key]
                
            self.cache[key] = (value, datetime.now())
            
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        hit_rate = self.hits / (self.hits + self.misses) if (self.hits + self.misses) > 0 else 0
        return {
            "size": len(self.cache),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": hit_rate
        }


class RequestBatcher:
    """Batches similar requests for efficient processing"""
    
    def __init__(self, batch_size: int = 10, batch_timeout: float = 0.1):
        self.batch_size = batch_size
        self.batch_timeout = batch_timeout
        self.batches: Dict[str, List[Request]] = defaultdict(list)
        self.batch_timers: Dict[str, asyncio.Task] = {}
        self.lock = asyncio.Lock()
        
    async def add_request(self, request: Request) -> bool:
        """Add request to batch, returns True if batch is ready"""
        if not request.batch_key:
            return False
            
        async with self.lock:
            batch = self.batches[request.batch_key]
            batch.append(request)
            
            # Start timer for this batch if not already started
            if request.batch_key not in self.batch_timers:
                timer = asyncio.create_task(self._batch_timer(request.batch_key))
                self.batch_timers[request.batch_key] = timer
                
            # Check if batch is full
            if len(batch) >= self.batch_size:
                # Cancel timer and return batch
                if request.batch_key in self.batch_timers:
                    self.batch_timers[request.batch_key].cancel()
                    del self.batch_timers[request.batch_key]
                return True
                
        return False
        
    async def _batch_timer(self, batch_key: str):
        """Timer to force batch processing after timeout"""
        await asyncio.sleep(self.batch_timeout)
        async with self.lock:
            if batch_key in self.batch_timers:
                del self.batch_timers[batch_key]
                
    async def get_batch(self, batch_key: str) -> List[Request]:
        """Get and remove a batch of requests"""
        async with self.lock:
            batch = self.batches.pop(batch_key, [])
            if batch_key in self.batch_timers:
                self.batch_timers[batch_key].cancel()
                del self.batch_timers[batch_key]
            return batch
            
    def get_pending_batches(self) -> List[str]:
        """Get list of batch keys with pending requests"""
        return list(self.batches.keys())


class RequestProcessor:
    """
    Intelligent request processor with caching, batching, and prioritization
    """
    
    def __init__(self, 
                 max_concurrent: int = 50,
                 cache_ttl: int = 300,
                 batch_size: int = 10,
                 batch_timeout: float = 0.1):
        self.max_concurrent = max_concurrent
        self.request_queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self.processing_requests: Dict[str, Request] = {}
        self.completed_requests: Dict[str, RequestResult] = {}
        self.cache = RequestCache(ttl_seconds=cache_ttl)
        self.batcher = RequestBatcher(batch_size=batch_size, batch_timeout=batch_timeout)
        self.executor = ThreadPoolExecutor(max_workers=max_concurrent // 2)
        
        # Request handlers
        self.handlers: Dict[str, Callable] = {}
        self.batch_handlers: Dict[str, Callable] = {}
        
        # Statistics
        self.stats = {
            "total_requests": 0,
            "completed_requests": 0,
            "failed_requests": 0,
            "cached_requests": 0,
            "batched_requests": 0,
            "average_processing_time": 0.0,
            "requests_by_endpoint": defaultdict(int),
            "requests_by_priority": defaultdict(int)
        }
        
        # Control flags
        self.is_running = False
        self.workers: List[asyncio.Task] = []
        
    def register_handler(self, endpoint: str, handler: Callable):
        """Register a handler for an endpoint"""
        self.handlers[endpoint] = handler
        logger.info(f"Registered handler for endpoint: {endpoint}")
        
    def register_batch_handler(self, endpoint: str, handler: Callable):
        """Register a batch handler for an endpoint"""
        self.batch_handlers[endpoint] = handler
        logger.info(f"Registered batch handler for endpoint: {endpoint}")
        
    async def process_request(self, request: Request) -> RequestResult:
        """Process a single request"""
        self.stats["total_requests"] += 1
        self.stats["requests_by_endpoint"][request.endpoint] += 1
        self.stats["requests_by_priority"][request.priority.name] += 1
        
        # Check cache first
        if request.cache_key:
            cached_result = await self.cache.get(request.cache_key)
            if cached_result is not None:
                self.stats["cached_requests"] += 1
                return RequestResult(
                    request_id=request.id,
                    status=RequestStatus.CACHED,
                    data=cached_result,
                    from_cache=True
                )
                
        # Check if request should be batched
        if request.batch_key and request.endpoint in self.batch_handlers:
            batch_ready = await self.batcher.add_request(request)
            if batch_ready:
                # Process the batch immediately
                batch = await self.batcher.get_batch(request.batch_key)
                return await self._process_batch(batch)
            else:
                # Request added to batch, will be processed later
                return RequestResult(
                    request_id=request.id,
                    status=RequestStatus.BATCHED
                )
                
        # Add to processing queue
        await self.request_queue.put((request.priority.value, request))
        
        # Return placeholder result
        return RequestResult(
            request_id=request.id,
            status=RequestStatus.QUEUED
        )
        
    async def _process_batch(self, batch: List[Request]) -> RequestResult:
        """Process a batch of requests"""
        if not batch:
            return None
            
        endpoint = batch[0].endpoint
        if endpoint not in self.batch_handlers:
            # Fall back to individual processing
            results = []
            for request in batch:
                result = await self._process_single_request(request)
                results.append(result)
            return results[0] if results else None
            
        start_time = time.time()
        
        try:
            # Call batch handler
            handler = self.batch_handlers[endpoint]
            if asyncio.iscoroutinefunction(handler):
                batch_results = await handler(batch)
            else:
                loop = asyncio.get_event_loop()
                batch_results = await loop.run_in_executor(
                    self.executor,
                    handler,
                    batch
                )
                
            processing_time = time.time() - start_time
            self.stats["batched_requests"] += len(batch)
            
            # Create individual results
            results = []
            for i, request in enumerate(batch):
                if i < len(batch_results):
                    result = RequestResult(
                        request_id=request.id,
                        status=RequestStatus.COMPLETED,
                        data=batch_results[i],
                        processing_time=processing_time / len(batch),
                        batch_id=f"batch_{endpoint}_{int(time.time())}"
                    )
                    
                    # Cache result
                    if request.cache_key:
                        await self.cache.set(request.cache_key, result.data)
                        
                    results.append(result)
                    self.completed_requests[request.id] = result
                    
                    # Call callback if provided
                    if request.callback:
                        asyncio.create_task(request.callback(result))
                        
            return results[0] if results else None
            
        except Exception as e:
            logger.error(f"Batch processing failed for {endpoint}: {e}")
            # Create error results for all requests in batch
            for request in batch:
                result = RequestResult(
                    request_id=request.id,
                    status=RequestStatus.FAILED,
                    error=str(e)
                )
                self.completed_requests[request.id] = result
                self.stats["failed_requests"] += 1
                
            return None
            
    async def _process_single_request(self, request: Request) -> RequestResult:
        """Process a single request"""
        start_time = time.time()
        
        try:
            # Get handler for endpoint
            if request.endpoint not in self.handlers:
                raise ValueError(f"No handler registered for endpoint: {request.endpoint}")
                
            handler = self.handlers[request.endpoint]
            
            # Add to processing
            self.processing_requests[request.id] = request
            
            # Call handler
            if asyncio.iscoroutinefunction(handler):
                result_data = await asyncio.wait_for(
                    handler(request),
                    timeout=request.timeout
                )
            else:
                loop = asyncio.get_event_loop()
                result_data = await asyncio.wait_for(
                    loop.run_in_executor(self.executor, handler, request),
                    timeout=request.timeout
                )
                
            processing_time = time.time() - start_time
            
            # Create result
            result = RequestResult(
                request_id=request.id,
                status=RequestStatus.COMPLETED,
                data=result_data,
                processing_time=processing_time
            )
            
            # Cache result if cache key provided
            if request.cache_key:
                await self.cache.set(request.cache_key, result_data)
                
            # Update stats
            self.stats["completed_requests"] += 1
            self._update_average_processing_time(processing_time)
            
        except asyncio.TimeoutError:
            result = RequestResult(
                request_id=request.id,
                status=RequestStatus.FAILED,
                error=f"Request timeout after {request.timeout} seconds",
                processing_time=time.time() - start_time
            )
            self.stats["failed_requests"] += 1
            
        except Exception as e:
            logger.error(f"Request processing failed: {e}")
            result = RequestResult(
                request_id=request.id,
                status=RequestStatus.FAILED,
                error=str(e),
                processing_time=time.time() - start_time
            )
            self.stats["failed_requests"] += 1
            
        finally:
            # Remove from processing
            self.processing_requests.pop(request.id, None)
            
        # Store result
        self.completed_requests[request.id] = result
        
        # Call callback if provided
        if request.callback:
            asyncio.create_task(request.callback(result))
            
        return result
        
    def _update_average_processing_time(self, new_time: float):
        """Update average processing time"""
        completed = self.stats["completed_requests"]
        if completed == 1:
            self.stats["average_processing_time"] = new_time
        else:
            current_avg = self.stats["average_processing_time"]
            self.stats["average_processing_time"] = (
                (current_avg * (completed - 1) + new_time) / completed
            )
            
    async def start(self, num_workers: int = None):
        """Start the request processor"""
        if self.is_running:
            logger.warning("Request processor already running")
            return
            
        self.is_running = True
        num_workers = num_workers or self.max_concurrent
        
        logger.info(f"Starting request processor with {num_workers} workers")
        
        # Start worker tasks
        for i in range(num_workers):
            worker = asyncio.create_task(self._worker(i))
            self.workers.append(worker)
            
        # Start batch processor
        batch_processor = asyncio.create_task(self._batch_processor())
        self.workers.append(batch_processor)
        
    async def _worker(self, worker_id: int):
        """Worker task to process requests"""
        logger.info(f"Worker {worker_id} started")
        
        while self.is_running:
            try:
                # Get request from queue
                priority, request = await asyncio.wait_for(
                    self.request_queue.get(),
                    timeout=1.0
                )
                
                # Process request
                await self._process_single_request(request)
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Worker {worker_id} error: {e}")
                
    async def _batch_processor(self):
        """Process pending batches periodically"""
        logger.info("Batch processor started")
        
        while self.is_running:
            try:
                # Check for ready batches
                for batch_key in self.batcher.get_pending_batches():
                    batch = await self.batcher.get_batch(batch_key)
                    if batch:
                        await self._process_batch(batch)
                        
                await asyncio.sleep(0.1)
                
            except Exception as e:
                logger.error(f"Batch processor error: {e}")
                
    async def stop(self):
        """Stop the request processor"""
        logger.info("Stopping request processor...")
        self.is_running = False
        
        # Cancel all workers
        for worker in self.workers:
            if not worker.done():
                worker.cancel()
                
        # Wait for workers to finish
        await asyncio.gather(*self.workers, return_exceptions=True)
        
        # Shutdown executor
        self.executor.shutdown(wait=True)
        
        logger.info("Request processor stopped")
        
    def get_stats(self) -> Dict[str, Any]:
        """Get processor statistics"""
        cache_stats = self.cache.get_stats()
        
        return {
            **self.stats,
            "queue_size": self.request_queue.qsize(),
            "processing_count": len(self.processing_requests),
            "completed_count": len(self.completed_requests),
            "cache_stats": cache_stats,
            "pending_batches": len(self.batcher.get_pending_batches())
        }
        
    def generate_cache_key(self, endpoint: str, method: str, data: Dict[str, Any]) -> str:
        """Generate a cache key for a request"""
        key_data = {
            "endpoint": endpoint,
            "method": method,
            "data": json.dumps(data, sort_keys=True)
        }
        
        key_str = json.dumps(key_data, sort_keys=True)
        return hashlib.md5(key_str.encode()).hexdigest()


# Global instance
_request_processor: Optional[RequestProcessor] = None


def get_request_processor() -> RequestProcessor:
    """Get or create the global RequestProcessor instance"""
    global _request_processor
    if _request_processor is None:
        _request_processor = RequestProcessor()
    return _request_processor


# Example usage
if __name__ == "__main__":
    import uuid
    
    async def example_handler(request: Request) -> Dict[str, Any]:
        """Example request handler"""
        await asyncio.sleep(0.1)  # Simulate processing
        return {
            "result": f"Processed {request.data.get('value', 'unknown')}",
            "timestamp": datetime.now().isoformat()
        }
        
    async def example_batch_handler(requests: List[Request]) -> List[Dict[str, Any]]:
        """Example batch handler"""
        await asyncio.sleep(0.2)  # Simulate batch processing
        return [
            {"result": f"Batch processed {r.data.get('value', 'unknown')}"}
            for r in requests
        ]
        
    async def main():
        processor = get_request_processor()
        
        # Register handlers
        processor.register_handler("/api/process", example_handler)
        processor.register_batch_handler("/api/batch", example_batch_handler)
        
        # Start processor
        await processor.start(num_workers=5)
        
        # Submit some requests
        requests = []
        for i in range(20):
            req = Request(
                id=str(uuid.uuid4()),
                endpoint="/api/process" if i % 3 else "/api/batch",
                method="POST",
                data={"value": i},
                priority=RequestPriority.NORMAL if i % 2 else RequestPriority.HIGH,
                cache_key=processor.generate_cache_key(
                    "/api/process" if i % 3 else "/api/batch",
                    "POST",
                    {"value": i}
                ),
                batch_key="batch_1" if i % 3 == 0 else None
            )
            
            result = await processor.process_request(req)
            requests.append((req, result))
            
        # Wait a bit for processing
        await asyncio.sleep(1)
        
        # Get stats
        stats = processor.get_stats()
        print(f"Processor stats: {json.dumps(stats, indent=2)}")
        
        # Stop processor
        await processor.stop()
        
    asyncio.run(main())
