"""
Startup Optimizer for Application Initialization
Manages application startup sequence for optimal performance
"""

import asyncio
import logging
import time
from typing import List, Dict, Any, Callable, Optional
from concurrent.futures import ThreadPoolExecutor
from enum import Enum
import psutil

from .model_preloader import get_model_preloader

logger = logging.getLogger(__name__)

class ServiceStatus(Enum):
    """Service initialization status"""
    PENDING = "pending"
    INITIALIZING = "initializing"
    READY = "ready"
    FAILED = "failed"
    
class StartupOptimizer:
    """
    Manages optimized application startup sequence
    """
    
    def __init__(self):
        self.services: Dict[str, Dict[str, Any]] = {}
        self.service_status: Dict[str, ServiceStatus] = {}
        self.startup_times: Dict[str, float] = {}
        self.executor = ThreadPoolExecutor(max_workers=6)
        self.startup_start_time = None
        self.is_ready = False
        
    def register_service(self, 
                        name: str, 
                        init_func: Callable,
                        priority: int = 3,
                        dependencies: List[str] = None,
                        is_critical: bool = False):
        """
        Register a service for startup
        
        Args:
            name: Service name
            init_func: Initialization function
            priority: Startup priority (1=highest, 3=lowest)
            dependencies: List of service names this depends on
            is_critical: Whether service failure should stop startup
        """
        self.services[name] = {
            "init_func": init_func,
            "priority": priority,
            "dependencies": dependencies or [],
            "is_critical": is_critical
        }
        self.service_status[name] = ServiceStatus.PENDING
        
    async def start(self):
        """Start the optimized initialization sequence"""
        self.startup_start_time = time.time()
        logger.info("Starting optimized application initialization...")
        
        # Group services by priority
        priority_groups = self._group_services_by_priority()
        
        # Initialize services by priority
        for priority in sorted(priority_groups.keys()):
            services = priority_groups[priority]
            
            # Critical services are initialized synchronously
            critical_services = [s for s in services if s["is_critical"]]
            non_critical_services = [s for s in services if not s["is_critical"]]
            
            # Initialize critical services first
            if critical_services:
                await self._initialize_services(critical_services, parallel=False)
                
            # Initialize non-critical services in parallel
            if non_critical_services:
                asyncio.create_task(self._initialize_services(non_critical_services, parallel=True))
                
        # Start model preloading in background
        asyncio.create_task(self._preload_models())
        
        # Wait for critical services
        await self._wait_for_critical_services()
        
        self.is_ready = True
        total_time = time.time() - self.startup_start_time
        logger.info(f"Application initialization completed in {total_time:.2f} seconds")
        
    def _group_services_by_priority(self) -> Dict[int, List[Dict[str, Any]]]:
        """Group services by priority level"""
        priority_groups = {}
        
        for name, service in self.services.items():
            priority = service["priority"]
            if priority not in priority_groups:
                priority_groups[priority] = []
                
            service_info = service.copy()
            service_info["name"] = name
            priority_groups[priority].append(service_info)
            
        return priority_groups
        
    async def _initialize_services(self, services: List[Dict[str, Any]], parallel: bool = True):
        """Initialize a group of services"""
        if parallel:
            tasks = []
            for service in services:
                task = asyncio.create_task(self._initialize_service(service))
                tasks.append(task)
            await asyncio.gather(*tasks, return_exceptions=True)
        else:
            for service in services:
                await self._initialize_service(service)
                
    async def _initialize_service(self, service: Dict[str, Any]):
        """Initialize a single service"""
        name = service["name"]
        
        # Wait for dependencies
        await self._wait_for_dependencies(service["dependencies"])
        
        # Update status
        self.service_status[name] = ServiceStatus.INITIALIZING
        logger.info(f"Initializing service: {name}")
        
        start_time = time.time()
        
        try:
            # Run initialization
            init_func = service["init_func"]
            if asyncio.iscoroutinefunction(init_func):
                await init_func()
            else:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(self.executor, init_func)
                
            # Update status
            self.service_status[name] = ServiceStatus.READY
            self.startup_times[name] = time.time() - start_time
            logger.info(f"Service {name} initialized in {self.startup_times[name]:.2f} seconds")
            
        except Exception as e:
            # Handle initialization failure
            self.service_status[name] = ServiceStatus.FAILED
            logger.error(f"Failed to initialize service {name}: {str(e)}")
            
            if service["is_critical"]:
                raise Exception(f"Critical service {name} failed to initialize: {str(e)}")
                
    async def _wait_for_dependencies(self, dependencies: List[str]):
        """Wait for service dependencies to be ready"""
        while True:
            all_ready = True
            for dep in dependencies:
                if self.service_status.get(dep) != ServiceStatus.READY:
                    all_ready = False
                    break
                    
            if all_ready:
                break
                
            await asyncio.sleep(0.1)
            
    async def _wait_for_critical_services(self):
        """Wait for all critical services to be ready"""
        critical_services = [
            name for name, service in self.services.items()
            if service["is_critical"]
        ]
        
        while True:
            all_ready = True
            for name in critical_services:
                status = self.service_status.get(name)
                if status == ServiceStatus.FAILED:
                    raise Exception(f"Critical service {name} failed")
                elif status != ServiceStatus.READY:
                    all_ready = False
                    
            if all_ready:
                break
                
            await asyncio.sleep(0.1)
            
    async def _preload_models(self):
        """Preload AI models in background"""
        try:
            model_preloader = get_model_preloader()
            await model_preloader.start_preloading()
        except Exception as e:
            logger.error(f"Model preloading failed: {str(e)}")
            
    def get_startup_stats(self) -> Dict[str, Any]:
        """Get startup statistics"""
        total_time = time.time() - self.startup_start_time if self.startup_start_time else 0
        
        stats = {
            "total_startup_time": total_time,
            "is_ready": self.is_ready,
            "services": {},
            "system_info": {
                "cpu_percent": psutil.cpu_percent(interval=0.1),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_usage": psutil.disk_usage('/').percent
            }
        }
        
        for name in self.services:
            stats["services"][name] = {
                "status": self.service_status.get(name, ServiceStatus.PENDING).value,
                "startup_time": self.startup_times.get(name, 0),
                "is_critical": self.services[name]["is_critical"]
            }
            
        return stats
        
    def is_service_ready(self, service_name: str) -> bool:
        """Check if a service is ready"""
        return self.service_status.get(service_name) == ServiceStatus.READY
        
    async def wait_for_service(self, service_name: str, timeout: float = 30):
        """Wait for a service to be ready"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            if self.is_service_ready(service_name):
                return True
            await asyncio.sleep(0.1)
            
        return False
        
    def cleanup(self):
        """Cleanup resources"""
        self.executor.shutdown(wait=True)

# Example service initialization functions
async def initialize_database():
    """Initialize database connections"""
    # Simulate database initialization
    await asyncio.sleep(0.5)
    logger.info("Database initialized")
    
def initialize_cache():
    """Initialize caching system"""
    # Simulate cache initialization
    time.sleep(0.3)
    logger.info("Cache initialized")
    
async def initialize_api_server():
    """Initialize API server"""
    # Simulate API server initialization
    await asyncio.sleep(0.2)
    logger.info("API server initialized")
    
def initialize_scrapers():
    """Initialize scraper pool"""
    # Simulate scraper initialization
    time.sleep(0.4)
    logger.info("Scrapers initialized")

# Singleton instance
_startup_optimizer = None

def get_startup_optimizer() -> StartupOptimizer:
    """Get the singleton startup optimizer instance"""
    global _startup_optimizer
    if _startup_optimizer is None:
        _startup_optimizer = StartupOptimizer()
        
        # Register default services
        _startup_optimizer.register_service(
            "database",
            initialize_database,
            priority=1,
            is_critical=True
        )
        
        _startup_optimizer.register_service(
            "cache",
            initialize_cache,
            priority=1,
            is_critical=True
        )
        
        _startup_optimizer.register_service(
            "api_server",
            initialize_api_server,
            priority=2,
            dependencies=["database", "cache"],
            is_critical=True
        )
        
        _startup_optimizer.register_service(
            "scrapers",
            initialize_scrapers,
            priority=3,
            dependencies=["database"],
            is_critical=False
        )
        
    return _startup_optimizer
