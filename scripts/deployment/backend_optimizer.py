"""
Backend Optimizer - Manages backend service initialization order and optimization
Implements connection pooling, lazy loading, and intelligent resource management
"""

import asyncio
import time
import logging
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import psutil
import os
from pathlib import Path
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class BackendService:
    """Configuration for a backend service"""
    name: str
    init_func: Callable
    cleanup_func: Optional[Callable] = None
    health_check_func: Optional[Callable] = None
    config: Dict[str, Any] = None
    is_critical: bool = True
    lazy_load: bool = False
    pool_size: Optional[int] = None


class ConnectionPool:
    """Generic connection pool for backend services"""
    
    def __init__(self, name: str, create_func: Callable, max_size: int = 10):
        self.name = name
        self.create_func = create_func
        self.max_size = max_size
        self.pool = asyncio.Queue(maxsize=max_size)
        self.active_connections = 0
        self.total_created = 0
        self.lock = asyncio.Lock()
        
    async def initialize(self, initial_size: int = None):
        """Initialize the connection pool"""
        initial_size = initial_size or min(5, self.max_size)
        logger.info(f"Initializing connection pool '{self.name}' with {initial_size} connections")
        
        for _ in range(initial_size):
            conn = await self._create_connection()
            await self.pool.put(conn)
            
    async def _create_connection(self):
        """Create a new connection"""
        async with self.lock:
            self.total_created += 1
            
        if asyncio.iscoroutinefunction(self.create_func):
            return await self.create_func()
        else:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, self.create_func)
            
    async def acquire(self, timeout: float = None):
        """Acquire a connection from the pool"""
        try:
            # Try to get existing connection
            conn = self.pool.get_nowait()
            self.active_connections += 1
            return conn
        except asyncio.QueueEmpty:
            # Create new connection if under limit
            async with self.lock:
                if self.total_created < self.max_size:
                    conn = await self._create_connection()
                    self.active_connections += 1
                    return conn
                    
            # Wait for available connection
            try:
                conn = await asyncio.wait_for(self.pool.get(), timeout=timeout)
                self.active_connections += 1
                return conn
            except asyncio.TimeoutError:
                raise TimeoutError(f"No available connections in pool '{self.name}'")
                
    async def release(self, conn):
        """Release a connection back to the pool"""
        self.active_connections -= 1
        await self.pool.put(conn)
        
    def get_stats(self) -> Dict[str, Any]:
        """Get pool statistics"""
        return {
            "name": self.name,
            "active": self.active_connections,
            "idle": self.pool.qsize(),
            "total_created": self.total_created,
            "max_size": self.max_size
        }


class BackendOptimizer:
    """
    Manages backend service initialization and optimization
    """
    
    def __init__(self, max_workers: int = 4):
        self.services: Dict[str, BackendService] = {}
        self.service_instances: Dict[str, Any] = {}
        self.connection_pools: Dict[str, ConnectionPool] = {}
        self.initialization_times: Dict[str, float] = {}
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.is_initialized = False
        self.lazy_services: List[str] = []
        
    def register_service(self, service: BackendService):
        """Register a backend service"""
        self.services[service.name] = service
        
        if service.lazy_load:
            self.lazy_services.append(service.name)
            
        logger.info(f"Registered backend service: {service.name} (lazy_load={service.lazy_load})")
        
    def register_connection_pool(self, name: str, create_func: Callable, max_size: int = 10):
        """Register a connection pool"""
        pool = ConnectionPool(name, create_func, max_size)
        self.connection_pools[name] = pool
        logger.info(f"Registered connection pool: {name} (max_size={max_size})")
        
    async def initialize_database_pool(self):
        """Initialize database connection pool"""
        logger.info("Initializing database connection pool...")
        
        # Example PostgreSQL pool initialization
        def create_db_connection():
            # Simulate database connection
            import time
            time.sleep(0.1)
            return {"id": id({}), "connected": True}
            
        self.register_connection_pool("database", create_db_connection, max_size=20)
        pool = self.connection_pools["database"]
        await pool.initialize(initial_size=10)
        
        return pool
        
    async def initialize_cache_pool(self):
        """Initialize cache connection pool"""
        logger.info("Initializing cache connection pool...")
        
        # Example Redis pool initialization
        def create_cache_connection():
            # Simulate cache connection
            import time
            time.sleep(0.05)
            return {"id": id({}), "type": "redis", "connected": True}
            
        self.register_connection_pool("cache", create_cache_connection, max_size=15)
        pool = self.connection_pools["cache"]
        await pool.initialize(initial_size=5)
        
        return pool
        
    async def initialize_services(self, parallel: bool = True):
        """Initialize all registered services"""
        logger.info(f"Initializing {len(self.services)} backend services...")
        start_time = time.time()
        
        # Separate critical and non-critical services
        critical_services = {
            name: svc for name, svc in self.services.items() 
            if svc.is_critical and not svc.lazy_load
        }
        
        non_critical_services = {
            name: svc for name, svc in self.services.items() 
            if not svc.is_critical and not svc.lazy_load
        }
        
        # Initialize critical services first
        if critical_services:
            logger.info(f"Initializing {len(critical_services)} critical services...")
            if parallel:
                await self._initialize_services_parallel(critical_services)
            else:
                await self._initialize_services_sequential(critical_services)
                
        # Initialize non-critical services
        if non_critical_services:
            logger.info(f"Initializing {len(non_critical_services)} non-critical services...")
            # Always parallelize non-critical services
            asyncio.create_task(self._initialize_services_parallel(non_critical_services))
            
        self.is_initialized = True
        total_time = time.time() - start_time
        logger.info(f"Backend initialization completed in {total_time:.2f} seconds")
        
    async def _initialize_services_parallel(self, services: Dict[str, BackendService]):
        """Initialize services in parallel"""
        tasks = []
        
        for name, service in services.items():
            task = asyncio.create_task(self._initialize_service(name, service))
            tasks.append(task)
            
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, (name, service) in enumerate(services.items()):
            if isinstance(results[i], Exception):
                logger.error(f"Failed to initialize service {name}: {results[i]}")
                if service.is_critical:
                    raise results[i]
                    
    async def _initialize_services_sequential(self, services: Dict[str, BackendService]):
        """Initialize services sequentially"""
        for name, service in services.items():
            try:
                await self._initialize_service(name, service)
            except Exception as e:
                logger.error(f"Failed to initialize service {name}: {e}")
                if service.is_critical:
                    raise
                    
    async def _initialize_service(self, name: str, service: BackendService):
        """Initialize a single service"""
        start_time = time.time()
        logger.info(f"Initializing service: {name}")
        
        try:
            if asyncio.iscoroutinefunction(service.init_func):
                result = await service.init_func(service.config or {})
            else:
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    self.executor, 
                    service.init_func, 
                    service.config or {}
                )
                
            self.service_instances[name] = result
            self.initialization_times[name] = time.time() - start_time
            
            logger.info(f"Service {name} initialized in {self.initialization_times[name]:.2f} seconds")
            
            # Run health check if available
            if service.health_check_func:
                await self._check_service_health(name, service)
                
        except Exception as e:
            self.initialization_times[name] = time.time() - start_time
            logger.error(f"Service {name} initialization failed: {e}")
            raise
            
    async def _check_service_health(self, name: str, service: BackendService):
        """Check service health"""
        try:
            if asyncio.iscoroutinefunction(service.health_check_func):
                healthy = await service.health_check_func()
            else:
                loop = asyncio.get_event_loop()
                healthy = await loop.run_in_executor(
                    self.executor,
                    service.health_check_func
                )
                
            if not healthy:
                raise RuntimeError(f"Service {name} health check failed")
                
            logger.info(f"Service {name} health check passed")
            
        except Exception as e:
            logger.error(f"Service {name} health check failed: {e}")
            raise
            
    async def get_service(self, name: str) -> Any:
        """Get a service instance, initializing if lazy-loaded"""
        if name in self.service_instances:
            return self.service_instances[name]
            
        if name in self.lazy_services:
            logger.info(f"Lazy loading service: {name}")
            service = self.services[name]
            await self._initialize_service(name, service)
            return self.service_instances[name]
            
        raise KeyError(f"Service '{name}' not found")
        
    async def get_connection(self, pool_name: str, timeout: float = None):
        """Get a connection from a pool"""
        if pool_name not in self.connection_pools:
            raise KeyError(f"Connection pool '{pool_name}' not found")
            
        return await self.connection_pools[pool_name].acquire(timeout)
        
    async def release_connection(self, pool_name: str, conn):
        """Release a connection back to pool"""
        if pool_name in self.connection_pools:
            await self.connection_pools[pool_name].release(conn)
            
    def get_stats(self) -> Dict[str, Any]:
        """Get backend statistics"""
        stats = {
            "is_initialized": self.is_initialized,
            "services": {
                name: {
                    "initialized": name in self.service_instances,
                    "initialization_time": self.initialization_times.get(name, 0),
                    "is_critical": service.is_critical,
                    "lazy_load": service.lazy_load
                }
                for name, service in self.services.items()
            },
            "connection_pools": {
                name: pool.get_stats()
                for name, pool in self.connection_pools.items()
            },
            "system": {
                "cpu_percent": psutil.cpu_percent(interval=0.1),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_usage": psutil.disk_usage('/').percent
            }
        }
        
        return stats
        
    async def cleanup(self):
        """Cleanup all services and resources"""
        logger.info("Starting backend cleanup...")
        
        # Cleanup services
        for name, service in self.services.items():
            if service.cleanup_func and name in self.service_instances:
                try:
                    if asyncio.iscoroutinefunction(service.cleanup_func):
                        await service.cleanup_func()
                    else:
                        loop = asyncio.get_event_loop()
                        await loop.run_in_executor(
                            self.executor,
                            service.cleanup_func
                        )
                    logger.info(f"Service {name} cleaned up")
                except Exception as e:
                    logger.error(f"Error cleaning up service {name}: {e}")
                    
        # Clear instances
        self.service_instances.clear()
        
        # Shutdown executor
        self.executor.shutdown(wait=True)
        
        logger.info("Backend cleanup completed")


# Global instance
_backend_optimizer: Optional[BackendOptimizer] = None


def get_backend_optimizer() -> BackendOptimizer:
    """Get or create the global BackendOptimizer instance"""
    global _backend_optimizer
    if _backend_optimizer is None:
        _backend_optimizer = BackendOptimizer()
    return _backend_optimizer


# Example usage
if __name__ == "__main__":
    async def example_api_service(config: Dict[str, Any]):
        """Example API service initialization"""
        await asyncio.sleep(0.5)
        return {"status": "ready", "port": config.get("port", 3000)}
        
    async def example_auth_service(config: Dict[str, Any]):
        """Example auth service initialization"""
        await asyncio.sleep(0.3)
        return {"status": "ready", "type": "jwt"}
        
    async def example_health_check():
        """Example health check"""
        return True
        
    async def main():
        optimizer = get_backend_optimizer()
        
        # Register services
        optimizer.register_service(BackendService(
            name="api",
            init_func=example_api_service,
            health_check_func=example_health_check,
            config={"port": 3000},
            is_critical=True
        ))
        
        optimizer.register_service(BackendService(
            name="auth",
            init_func=example_auth_service,
            is_critical=True
        ))
        
        optimizer.register_service(BackendService(
            name="analytics",
            init_func=lambda config: {"status": "ready"},
            is_critical=False,
            lazy_load=True
        ))
        
        # Initialize connection pools
        await optimizer.initialize_database_pool()
        await optimizer.initialize_cache_pool()
        
        # Initialize services
        await optimizer.initialize_services()
        
        # Get statistics
        stats = optimizer.get_stats()
        print(f"Backend stats: {json.dumps(stats, indent=2)}")
        
        # Cleanup
        await optimizer.cleanup()
        
    asyncio.run(main())
