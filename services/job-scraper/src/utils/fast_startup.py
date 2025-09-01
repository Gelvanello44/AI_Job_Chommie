"""
Fast Startup Module for Application Optimization
Implements health checks and intelligent service loading
"""

import asyncio
import logging
import time
from typing import Dict, Any, List, Optional, Callable
from enum import Enum
import aiohttp
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import uvicorn

from .startup_optimizer import get_startup_optimizer
from .model_preloader import get_model_preloader
from .model_cache_manager import get_model_cache_manager

logger = logging.getLogger(__name__)

class HealthStatus(Enum):
    """Health check status levels"""
    STARTING = "starting"
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"

class FastStartup:
    """
    Manages fast application startup with health monitoring
    """
    
    def __init__(self, app: FastAPI = None):
        self.app = app or FastAPI()
        self.startup_optimizer = get_startup_optimizer()
        self.model_preloader = get_model_preloader()
        self.model_cache_manager = get_model_cache_manager()
        
        self.health_checks: Dict[str, Callable] = {}
        self.service_health: Dict[str, HealthStatus] = {}
        self.startup_time = None
        self.is_ready = False
        
        # Configure health endpoints
        self._setup_health_endpoints()
        
    def _setup_health_endpoints(self):
        """Setup health check endpoints"""
        
        @self.app.get("/health")
        async def health():
            """Basic health check - responds immediately"""
            return JSONResponse(
                status_code=200 if self.is_ready else 503,
                content={
                    "status": "healthy" if self.is_ready else "starting",
                    "timestamp": time.time(),
                    "uptime": time.time() - self.startup_time if self.startup_time else 0
                }
            )
            
        @self.app.get("/health/detailed")
        async def health_detailed():
            """Detailed health check with service status"""
            overall_health = self._calculate_overall_health()
            
            return JSONResponse(
                status_code=200 if overall_health == HealthStatus.HEALTHY else 503,
                content={
                    "status": overall_health.value,
                    "services": {
                        name: status.value 
                        for name, status in self.service_health.items()
                    },
                    "startup": self.startup_optimizer.get_startup_stats(),
                    "models": self.model_preloader.get_model_stats(),
                    "cache": self.model_cache_manager.get_cache_stats()
                }
            )
            
        @self.app.get("/ready")
        async def readiness():
            """Readiness check for load balancers"""
            if self.is_ready:
                return {"ready": True}
            else:
                raise HTTPException(status_code=503, detail="Service not ready")
                
        @self.app.get("/live")
        async def liveness():
            """Liveness check - always responds if app is running"""
            return {"alive": True}
            
    def register_health_check(self, name: str, check_func: Callable):
        """Register a custom health check"""
        self.health_checks[name] = check_func
        self.service_health[name] = HealthStatus.STARTING
        
    async def start_fast(self):
        """Start application with optimized boot sequence"""
        self.startup_time = time.time()
        logger.info("Starting fast application boot sequence...")
        
        # Start essential services immediately
        await self._start_essential_services()
        
        # Mark app as ready for basic requests
        self.is_ready = True
        logger.info("Application ready to accept requests")
        
        # Continue loading non-essential services in background
        asyncio.create_task(self._load_background_services())
        
        # Start health monitoring
        asyncio.create_task(self._monitor_health())
        
    async def _start_essential_services(self):
        """Start only essential services for basic operation"""
        # Register essential services
        self.startup_optimizer.register_service(
            "health_endpoints",
            self._initialize_health_system,
            priority=1,
            is_critical=True
        )
        
        self.startup_optimizer.register_service(
            "basic_auth",
            self._initialize_basic_auth,
            priority=1,
            is_critical=True
        )
        
        self.startup_optimizer.register_service(
            "request_handler",
            self._initialize_request_handler,
            priority=1,
            is_critical=True
        )
        
        # Start optimizer
        await self.startup_optimizer.start()
        
    async def _load_background_services(self):
        """Load non-essential services in background"""
        logger.info("Loading background services...")
        
        try:
            # Preload critical models
            self.model_preloader.preload_critical_models()
            
            # Start model preloading
            await self.model_preloader.start_preloading()
            
            # Initialize scrapers
            await self._initialize_scrapers()
            
            # Load additional services
            await self._load_additional_services()
            
            logger.info("Background services loaded successfully")
            
        except Exception as e:
            logger.error(f"Error loading background services: {str(e)}")
            
    async def _initialize_health_system(self):
        """Initialize health monitoring system"""
        self.service_health["health_system"] = HealthStatus.HEALTHY
        logger.info("Health system initialized")
        
    async def _initialize_basic_auth(self):
        """Initialize basic authentication"""
        # Simulate auth initialization
        await asyncio.sleep(0.1)
        self.service_health["auth"] = HealthStatus.HEALTHY
        logger.info("Basic authentication initialized")
        
    async def _initialize_request_handler(self):
        """Initialize request handling system"""
        # Simulate request handler initialization
        await asyncio.sleep(0.1)
        self.service_health["request_handler"] = HealthStatus.HEALTHY
        logger.info("Request handler initialized")
        
    async def _initialize_scrapers(self):
        """Initialize scraper services"""
        # Simulate scraper initialization
        await asyncio.sleep(0.5)
        self.service_health["scrapers"] = HealthStatus.HEALTHY
        logger.info("Scrapers initialized")
        
    async def _load_additional_services(self):
        """Load additional services"""
        # Simulate loading additional services
        await asyncio.sleep(0.3)
        logger.info("Additional services loaded")
        
    async def _monitor_health(self):
        """Continuously monitor service health"""
        while True:
            try:
                for name, check_func in self.health_checks.items():
                    try:
                        if asyncio.iscoroutinefunction(check_func):
                            is_healthy = await check_func()
                        else:
                            is_healthy = check_func()
                            
                        self.service_health[name] = (
                            HealthStatus.HEALTHY if is_healthy 
                            else HealthStatus.UNHEALTHY
                        )
                    except Exception as e:
                        logger.error(f"Health check {name} failed: {str(e)}")
                        self.service_health[name] = HealthStatus.UNHEALTHY
                        
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error(f"Health monitoring error: {str(e)}")
                await asyncio.sleep(60)
                
    def _calculate_overall_health(self) -> HealthStatus:
        """Calculate overall system health"""
        if not self.service_health:
            return HealthStatus.STARTING
            
        unhealthy_count = sum(
            1 for status in self.service_health.values() 
            if status == HealthStatus.UNHEALTHY
        )
        
        if unhealthy_count == 0:
            return HealthStatus.HEALTHY
        elif unhealthy_count < len(self.service_health) / 2:
            return HealthStatus.DEGRADED
        else:
            return HealthStatus.UNHEALTHY
            
    def add_startup_hook(self, hook: Callable):
        """Add a startup hook to be called after fast startup"""
        @self.app.on_event("startup")
        async def startup_wrapper():
            await self.start_fast()
            if asyncio.iscoroutinefunction(hook):
                await hook()
            else:
                hook()
                
    def add_shutdown_hook(self, hook: Callable):
        """Add a shutdown hook for cleanup"""
        @self.app.on_event("shutdown")
        async def shutdown_wrapper():
            logger.info("Shutting down application...")
            
            # Cleanup resources
            self.startup_optimizer.cleanup()
            self.model_preloader.cleanup()
            self.model_cache_manager.clear_cache()
            
            if asyncio.iscoroutinefunction(hook):
                await hook()
            else:
                hook()
                
            logger.info("Application shutdown complete")

# Factory function for creating FastStartup instance
def create_fast_startup(app: FastAPI = None) -> FastStartup:
    """Create a FastStartup instance"""
    return FastStartup(app)

# Example usage with custom health checks
def setup_custom_health_checks(fast_startup: FastStartup):
    """Setup custom health checks for your application"""
    
    async def check_database():
        """Check database connectivity"""
        # Implement your database check
        return True
        
    async def check_redis():
        """Check Redis connectivity"""
        # Implement your Redis check
        return True
        
    async def check_external_api():
        """Check external API availability"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://api.example.com/health",
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    return response.status == 200
        except:
            return False
            
    fast_startup.register_health_check("database", check_database)
    fast_startup.register_health_check("redis", check_redis)
    fast_startup.register_health_check("external_api", check_external_api)

# Main entry point for fast startup
async def run_with_fast_startup(
    app: FastAPI,
    host: str = "0.0.0.0",
    port: int = 8000,
    workers: int = 1
):
    """Run application with fast startup"""
    fast_startup = create_fast_startup(app)
    
    # Setup custom health checks
    setup_custom_health_checks(fast_startup)
    
    # Add startup hook
    fast_startup.add_startup_hook(lambda: logger.info("Application fully started"))
    
    # Add shutdown hook
    fast_startup.add_shutdown_hook(lambda: logger.info("Cleaning up resources"))
    
    # Run the application
    config = uvicorn.Config(
        app=app,
        host=host,
        port=port,
        workers=workers,
        access_log=False,  # Disable access logs for performance
        loop="uvloop"  # Use uvloop for better performance
    )
    
    server = uvicorn.Server(config)
    await server.serve()
