"""
Startup Optimizer - Manages application initialization sequence
Optimizes startup time by parallel initialization and intelligent service ordering
"""

import asyncio
import time
import logging
from typing import Dict, List, Callable, Optional, Any, Set
from concurrent.futures import ThreadPoolExecutor
from enum import Enum
from dataclasses import dataclass
import psutil
import os
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ServiceStatus(Enum):
    """Service initialization status"""
    PENDING = "pending"
    INITIALIZING = "initializing"
    READY = "ready"
    FAILED = "failed"
    DEGRADED = "degraded"


@dataclass
class ServiceConfig:
    """Configuration for a service"""
    name: str
    init_func: Callable
    priority: int = 5  # 1-10, 1 being highest priority
    dependencies: List[str] = None
    is_critical: bool = True
    allow_failure: bool = False
    timeout: float = 30.0
    retry_count: int = 3
    health_check_func: Optional[Callable] = None


class StartupOptimizer:
    """Manages optimized application startup sequence"""
    
    def __init__(self, max_workers: int = 8):
        self.services: Dict[str, ServiceConfig] = {}
        self.service_status: Dict[str, ServiceStatus] = {}
        self.service_instances: Dict[str, Any] = {}
        self.startup_times: Dict[str, float] = {}
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.startup_start_time: Optional[float] = None
        self.is_ready = False
        self.health_check_tasks: List[asyncio.Task] = []
        self._shutdown_event = asyncio.Event()
        
    def register_service(self, config: ServiceConfig):
        """Register a service for startup"""
        self.services[config.name] = config
        self.service_status[config.name] = ServiceStatus.PENDING
        if config.dependencies is None:
            config.dependencies = []
            
    def register_services(self, configs: List[ServiceConfig]):
        """Register multiple services"""
        for config in configs:
            self.register_service(config)
            
    async def start(self, timeout: float = 120.0) -> bool:
        """
        Start the optimized initialization sequence
        
        Returns:
            bool: True if all critical services started successfully
        """
        self.startup_start_time = time.time()
        logger.info("Starting optimized application initialization...")
        
        try:
            # Validate service dependencies
            self._validate_dependencies()
            
            # Create initialization plan
            init_plan = self._create_initialization_plan()
            
            # Execute initialization plan
            success = await asyncio.wait_for(
                self._execute_initialization_plan(init_plan),
                timeout=timeout
            )
            
            if success:
                self.is_ready = True
                total_time = time.time() - self.startup_start_time
                logger.info(f" Application initialization completed in {total_time:.2f} seconds")
                
                # Start health monitoring
                await self._start_health_monitoring()
            else:
                logger.error(" Application initialization failed")
                
            return success
            
        except asyncio.TimeoutError:
            logger.error(f" Application initialization timed out after {timeout} seconds")
            return False
        except Exception as e:
            logger.error(f" Application initialization failed: {e}")
            return False
            
    def _validate_dependencies(self):
        """Validate that all service dependencies exist"""
        for service_name, config in self.services.items():
            for dep in config.dependencies:
                if dep not in self.services:
                    raise ValueError(f"Service '{service_name}' depends on unknown service '{dep}'")
                    
    def _create_initialization_plan(self) -> List[List[str]]:
        """Create an ordered initialization plan based on dependencies"""
        # Topological sort to determine initialization order
        visited = set()
        temp_visited = set()
        init_order = []
        
        def visit(service_name: str):
            if service_name in temp_visited:
                raise ValueError(f"Circular dependency detected involving '{service_name}'")
            if service_name in visited:
                return
                
            temp_visited.add(service_name)
            
            config = self.services[service_name]
            for dep in config.dependencies:
                visit(dep)
                
            temp_visited.remove(service_name)
            visited.add(service_name)
            init_order.append(service_name)
            
        # Visit all services
        for service_name in self.services:
            if service_name not in visited:
                visit(service_name)
                
        # Group by priority and dependencies for parallel execution
        groups = []
        initialized = set()
        
        while init_order:
            current_group = []
            
            for service_name in init_order[:]:
                config = self.services[service_name]
                
                # Check if all dependencies are initialized
                if all(dep in initialized for dep in config.dependencies):
                    current_group.append(service_name)
                    init_order.remove(service_name)
                    
            if current_group:
                # Sort within group by priority
                current_group.sort(key=lambda x: self.services[x].priority)
                groups.append(current_group)
                initialized.update(current_group)
            else:
                # This shouldn't happen if dependency validation worked
                raise RuntimeError("Unable to create initialization plan")
                
        return groups
        
    async def _execute_initialization_plan(self, plan: List[List[str]]) -> bool:
        """Execute the initialization plan"""
        all_success = True
        
        for group_index, service_group in enumerate(plan):
            logger.info(f"Initializing service group {group_index + 1}/{len(plan)}: {service_group}")
            
            # Initialize services in the group concurrently
            tasks = []
            for service_name in service_group:
                task = asyncio.create_task(self._initialize_service(service_name))
                tasks.append((service_name, task))
                
            # Wait for all services in the group to complete
            for service_name, task in tasks:
                try:
                    success = await task
                    if not success:
                        config = self.services[service_name]
                        if config.is_critical and not config.allow_failure:
                            logger.error(f"Critical service '{service_name}' failed to initialize")
                            all_success = False
                            break
                except Exception as e:
                    logger.error(f"Exception initializing service '{service_name}': {e}")
                    config = self.services[service_name]
                    if config.is_critical and not config.allow_failure:
                        all_success = False
                        break
                        
            if not all_success:
                break
                
        return all_success
        
    async def _initialize_service(self, service_name: str) -> bool:
        """Initialize a single service with retry logic"""
        config = self.services[service_name]
        
        for attempt in range(config.retry_count):
            if attempt > 0:
                logger.info(f"Retrying service '{service_name}' (attempt {attempt + 1}/{config.retry_count})")
                
            self.service_status[service_name] = ServiceStatus.INITIALIZING
            start_time = time.time()
            
            try:
                # Run initialization with timeout
                if asyncio.iscoroutinefunction(config.init_func):
                    result = await asyncio.wait_for(
                        config.init_func(),
                        timeout=config.timeout
                    )
                else:
                    loop = asyncio.get_event_loop()
                    result = await asyncio.wait_for(
                        loop.run_in_executor(self.executor, config.init_func),
                        timeout=config.timeout
                    )
                    
                # Store service instance if returned
                if result is not None:
                    self.service_instances[service_name] = result
                    
                # Run health check if provided
                if config.health_check_func:
                    if asyncio.iscoroutinefunction(config.health_check_func):
                        health_ok = await config.health_check_func()
                    else:
                        loop = asyncio.get_event_loop()
                        health_ok = await loop.run_in_executor(
                            self.executor, 
                            config.health_check_func
                        )
                        
                    if not health_ok:
                        raise RuntimeError("Health check failed")
                        
                # Mark as ready
                self.service_status[service_name] = ServiceStatus.READY
                self.startup_times[service_name] = time.time() - start_time
                logger.info(
                    f" Service '{service_name}' initialized successfully "
                    f"in {self.startup_times[service_name]:.2f}s"
                )
                return True
                
            except asyncio.TimeoutError:
                logger.error(f" Service '{service_name}' initialization timed out")
                self.service_status[service_name] = ServiceStatus.FAILED
                
            except Exception as e:
                logger.error(f" Service '{service_name}' initialization failed: {e}")
                self.service_status[service_name] = ServiceStatus.FAILED
                
            # Wait before retry
            if attempt < config.retry_count - 1:
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
                
        return False
        
    async def _start_health_monitoring(self):
        """Start periodic health checks for services"""
        for service_name, config in self.services.items():
            if config.health_check_func and self.service_status[service_name] == ServiceStatus.READY:
                task = asyncio.create_task(
                    self._monitor_service_health(service_name, config)
                )
                self.health_check_tasks.append(task)
                
    async def _monitor_service_health(self, service_name: str, config: ServiceConfig):
        """Monitor health of a service"""
        check_interval = 30.0  # Check every 30 seconds
        
        while not self._shutdown_event.is_set():
            try:
                await asyncio.sleep(check_interval)
                
                if asyncio.iscoroutinefunction(config.health_check_func):
                    health_ok = await config.health_check_func()
                else:
                    loop = asyncio.get_event_loop()
                    health_ok = await loop.run_in_executor(
                        self.executor,
                        config.health_check_func
                    )
                    
                if health_ok:
                    if self.service_status[service_name] == ServiceStatus.DEGRADED:
                        self.service_status[service_name] = ServiceStatus.READY
                        logger.info(f"Service '{service_name}' recovered")
                else:
                    if self.service_status[service_name] == ServiceStatus.READY:
                        self.service_status[service_name] = ServiceStatus.DEGRADED
                        logger.warning(f"Service '{service_name}' health check failed")
                        
            except Exception as e:
                logger.error(f"Error in health check for service '{service_name}': {e}")
                
    def get_service_instance(self, service_name: str) -> Optional[Any]:
        """Get a service instance if available"""
        return self.service_instances.get(service_name)
        
    def is_service_ready(self, service_name: str) -> bool:
        """Check if a service is ready"""
        return self.service_status.get(service_name) == ServiceStatus.READY
        
    async def wait_for_service(self, service_name: str, timeout: float = 30.0) -> bool:
        """Wait for a service to be ready"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            if self.is_service_ready(service_name):
                return True
            await asyncio.sleep(0.1)
            
        return False
        
    def get_startup_stats(self) -> Dict[str, Any]:
        """Get detailed startup statistics"""
        total_time = 0.0
        if self.startup_start_time:
            total_time = time.time() - self.startup_start_time
            
        # Get system stats
        cpu_count = psutil.cpu_count()
        memory = psutil.virtual_memory()
        
        stats = {
            "total_startup_time": total_time,
            "is_ready": self.is_ready,
            "services": {},
            "system_info": {
                "cpu_count": cpu_count,
                "cpu_percent": psutil.cpu_percent(interval=0.1),
                "memory_total_mb": memory.total / (1024 * 1024),
                "memory_available_mb": memory.available / (1024 * 1024),
                "memory_percent": memory.percent
            },
            "summary": {
                "total_services": len(self.services),
                "ready_services": sum(1 for s in self.service_status.values() if s == ServiceStatus.READY),
                "failed_services": sum(1 for s in self.service_status.values() if s == ServiceStatus.FAILED),
                "degraded_services": sum(1 for s in self.service_status.values() if s == ServiceStatus.DEGRADED)
            }
        }
        
        # Add per-service stats
        for service_name, config in self.services.items():
            stats["services"][service_name] = {
                "status": self.service_status[service_name].value,
                "startup_time": self.startup_times.get(service_name, 0.0),
                "priority": config.priority,
                "is_critical": config.is_critical,
                "dependencies": config.dependencies
            }
            
        return stats
        
    async def shutdown(self):
        """Gracefully shutdown all services"""
        logger.info("Starting graceful shutdown...")
        
        # Signal health monitors to stop
        self._shutdown_event.set()
        
        # Cancel health check tasks
        for task in self.health_check_tasks:
            if not task.done():
                task.cancel()
                
        if self.health_check_tasks:
            await asyncio.gather(*self.health_check_tasks, return_exceptions=True)
            
        # Shutdown thread pool
        self.executor.shutdown(wait=True)
        
        logger.info("Shutdown complete")


# Global instance
_startup_optimizer: Optional[StartupOptimizer] = None


def get_startup_optimizer() -> StartupOptimizer:
    """Get or create the global StartupOptimizer instance"""
    global _startup_optimizer
    if _startup_optimizer is None:
        _startup_optimizer = StartupOptimizer()
    return _startup_optimizer


# Example usage
if __name__ == "__main__":
    async def example_service_1():
        """Example critical service"""
        await asyncio.sleep(1)
        return {"status": "ready", "port": 8080}
        
    def example_service_2():
        """Example synchronous service"""
        time.sleep(0.5)
        return {"status": "ready"}
        
    async def example_health_check():
        """Example health check"""
        return True
        
    async def main():
        optimizer = get_startup_optimizer()
        
        # Register services
        optimizer.register_services([
            ServiceConfig(
                name="database",
                init_func=example_service_1,
                priority=1,
                is_critical=True
            ),
            ServiceConfig(
                name="cache",
                init_func=example_service_2,
                priority=2,
                dependencies=["database"],
                health_check_func=example_health_check
            )
        ])
        
        # Start initialization
        success = await optimizer.start()
        print(f"Startup success: {success}")
        
        # Get statistics
        stats = optimizer.get_startup_stats()
        print(f"Startup stats: {stats}")
        
        # Shutdown
        await optimizer.shutdown()
        
    asyncio.run(main())
