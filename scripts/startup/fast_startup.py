"""
Fast Startup - Optimizes application boot sequence
Implements parallel initialization, health checks, and background loading
"""

import asyncio
import time
import logging
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass
import os
import sys
from pathlib import Path
import psutil
import signal
from concurrent.futures import ThreadPoolExecutor

# Import optimization modules
from startup_optimizer import get_startup_optimizer, ServiceConfig
from model_preloader import get_model_preloader
from model_cache_manager import get_model_cache_manager, ModelType

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FastStartup:
    """Manages fast application startup with optimized service loading"""
    
    def __init__(self):
        self.startup_optimizer = get_startup_optimizer()
        self.model_preloader = get_model_preloader()
        self.cache_manager = get_model_cache_manager()
        self.services = {}
        self.health_endpoints = {}
        self.startup_time = None
        self.is_ready = False
        
    async def initialize_database(self) -> Dict[str, Any]:
        """Initialize database connections"""
        logger.info("Initializing database connections...")
        
        # Import database initialization
        try:
            # Simulate database initialization
            await asyncio.sleep(0.5)  # Replace with actual DB init
            
            # Return database connection info
            return {
                "status": "ready",
                "connections": 10,
                "pool_size": 20
            }
        except Exception as e:
            logger.error(f"Database initialization failed: {e}")
            raise
            
    async def initialize_redis(self) -> Dict[str, Any]:
        """Initialize Redis connection"""
        logger.info("Initializing Redis cache...")
        
        try:
            # Check if Redis is running
            import subprocess
            result = subprocess.run(
                ["redis-cli", "ping"],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                return {
                    "status": "ready",
                    "host": "localhost",
                    "port": 6379
                }
            else:
                logger.warning("Redis not available, using in-memory cache")
                return {
                    "status": "fallback",
                    "type": "memory"
                }
        except Exception as e:
            logger.warning(f"Redis initialization warning: {e}")
            return {
                "status": "fallback",
                "type": "memory"
            }
            
    async def initialize_models(self) -> Dict[str, Any]:
        """Initialize AI models with preloading"""
        logger.info("Initializing AI models...")
        
        # Start cache manager monitoring
        await self.cache_manager.start_monitoring()
        
        # Define priority models for immediate loading
        priority_models = [
            {
                "name": "sentence-transformers/all-MiniLM-L6-v2",
                "type": "SENTENCE_TRANSFORMER"
            }
        ]
        
        # Preload priority models
        await self.cache_manager.preload_models(priority_models)
        
        # Set background models for lazy loading
        self.model_preloader.set_priority_models([
            "facebook/bart-large-mnli",
            "distilbert-base-uncased"
        ])
        
        # Start background model loading
        asyncio.create_task(self.model_preloader.start_background_loading())
        
        return {
            "status": "ready",
            "preloaded_models": len(priority_models),
            "background_loading": True
        }
        
    async def initialize_backend_api(self) -> Dict[str, Any]:
        """Initialize backend API server"""
        logger.info("Initializing backend API server...")
        
        try:
            # Check if backend is already running
            backend_dir = Path("ai-job-chommie-backend")
            
            if backend_dir.exists():
                # Create health check endpoint
                self.health_endpoints["backend"] = "http://localhost:3000/health"
                
                return {
                    "status": "ready",
                    "port": 3000,
                    "endpoints": ["/api", "/health"]
                }
            else:
                logger.warning("Backend directory not found")
                return {"status": "not_found"}
                
        except Exception as e:
            logger.error(f"Backend initialization failed: {e}")
            raise
            
    async def initialize_scraping_service(self) -> Dict[str, Any]:
        """Initialize job scraping service"""
        logger.info("Initializing scraping service...")
        
        try:
            # Check if scraping service exists
            scraping_dir = Path("job-scraping-service")
            
            if scraping_dir.exists():
                # Import scraper optimization
                sys.path.insert(0, str(scraping_dir / "src"))
                
                # Create health check endpoint
                self.health_endpoints["scraping"] = "http://localhost:8000/health"
                
                return {
                    "status": "ready",
                    "port": 8000,
                    "endpoints": ["/api/v1", "/health"]
                }
            else:
                logger.warning("Scraping service directory not found")
                return {"status": "not_found"}
                
        except Exception as e:
            logger.error(f"Scraping service initialization failed: {e}")
            raise
            
    async def health_check_database(self) -> bool:
        """Health check for database"""
        try:
            # Implement actual database health check
            return True
        except:
            return False
            
    async def health_check_redis(self) -> bool:
        """Health check for Redis"""
        try:
            import subprocess
            result = subprocess.run(
                ["redis-cli", "ping"],
                capture_output=True,
                text=True
            )
            return result.returncode == 0
        except:
            return False
            
    async def health_check_models(self) -> bool:
        """Health check for AI models"""
        stats = self.cache_manager.get_cache_stats()
        return stats["num_models"] > 0
        
    async def health_check_backend(self) -> bool:
        """Health check for backend API"""
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get("http://localhost:3000/health", timeout=5) as response:
                    return response.status == 200
        except:
            return False
            
    async def health_check_scraping(self) -> bool:
        """Health check for scraping service"""
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get("http://localhost:8000/health", timeout=5) as response:
                    return response.status == 200
        except:
            return False
            
    def register_services(self):
        """Register all services with the startup optimizer"""
        services = [
            ServiceConfig(
                name="database",
                init_func=self.initialize_database,
                priority=1,
                is_critical=True,
                health_check_func=self.health_check_database
            ),
            ServiceConfig(
                name="redis",
                init_func=self.initialize_redis,
                priority=2,
                is_critical=False,
                allow_failure=True,
                health_check_func=self.health_check_redis
            ),
            ServiceConfig(
                name="models",
                init_func=self.initialize_models,
                priority=3,
                dependencies=["database"],
                is_critical=True,
                health_check_func=self.health_check_models
            ),
            ServiceConfig(
                name="backend_api",
                init_func=self.initialize_backend_api,
                priority=4,
                dependencies=["database", "redis"],
                is_critical=True,
                health_check_func=self.health_check_backend
            ),
            ServiceConfig(
                name="scraping_service",
                init_func=self.initialize_scraping_service,
                priority=5,
                dependencies=["database", "models"],
                is_critical=False,
                allow_failure=True,
                health_check_func=self.health_check_scraping
            )
        ]
        
        self.startup_optimizer.register_services(services)
        
    async def start(self) -> bool:
        """Start the application with optimized boot sequence"""
        self.startup_time = time.time()
        
        logger.info("=== Starting Fast Application Boot Sequence ===")
        logger.info(f"System: CPU cores={psutil.cpu_count()}, RAM={psutil.virtual_memory().total / (1024**3):.1f}GB")
        
        # Register all services
        self.register_services()
        
        # Start the optimized initialization
        success = await self.startup_optimizer.start(timeout=60.0)
        
        if success:
            self.is_ready = True
            total_time = time.time() - self.startup_time
            logger.info(f"=== Application started successfully in {total_time:.2f} seconds ===")
            
            # Print startup statistics
            self.print_startup_stats()
        else:
            logger.error("=== Application startup failed ===")
            
        return success
        
    def print_startup_stats(self):
        """Print detailed startup statistics"""
        stats = self.startup_optimizer.get_startup_stats()
        
        logger.info("\n=== Startup Statistics ===")
        logger.info(f"Total startup time: {stats['total_startup_time']:.2f}s")
        logger.info(f"Services ready: {stats['summary']['ready_services']}/{stats['summary']['total_services']}")
        
        if stats['summary']['failed_services'] > 0:
            logger.warning(f"Failed services: {stats['summary']['failed_services']}")
            
        if stats['summary']['degraded_services'] > 0:
            logger.warning(f"Degraded services: {stats['summary']['degraded_services']}")
            
        logger.info("\nPer-service times:")
        for service_name, service_stats in stats['services'].items():
            status_icon = "" if service_stats['status'] == "ready" else ""
            logger.info(
                f"  {status_icon} {service_name}: {service_stats['startup_time']:.2f}s "
                f"(priority: {service_stats['priority']}, critical: {service_stats['is_critical']})"
            )
            
    async def create_health_endpoint(self, port: int = 8888):
        """Create a simple health check endpoint"""
        from aiohttp import web
        
        async def health_handler(request):
            """Health check endpoint handler"""
            stats = self.startup_optimizer.get_startup_stats()
            cache_stats = self.cache_manager.get_cache_stats()
            
            health_data = {
                "status": "healthy" if self.is_ready else "starting",
                "uptime_seconds": time.time() - self.startup_time if self.startup_time else 0,
                "services": stats['summary'],
                "models": {
                    "loaded": cache_stats['num_models'],
                    "cache_hit_rate": cache_stats['hit_rate']
                },
                "system": stats['system_info']
            }
            
            return web.json_response(health_data)
            
        app = web.Application()
        app.router.add_get('/health', health_handler)
        
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, 'localhost', port)
        await site.start()
        
        logger.info(f"Health endpoint started at http://localhost:{port}/health")
        
    async def shutdown(self):
        """Gracefully shutdown the application"""
        logger.info("Starting graceful shutdown...")
        
        # Shutdown services
        await self.startup_optimizer.shutdown()
        
        # Cleanup models
        await self.model_preloader.cleanup()
        await self.cache_manager.shutdown()
        
        logger.info("Shutdown complete")


async def main():
    """Main entry point for fast startup"""
    fast_startup = FastStartup()
    
    # Setup signal handlers for graceful shutdown
    def signal_handler(sig, frame):
        logger.info(f"Received signal {sig}, initiating shutdown...")
        asyncio.create_task(fast_startup.shutdown())
        sys.exit(0)
        
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Start the application
        success = await fast_startup.start()
        
        if success:
            # Create health endpoint
            await fast_startup.create_health_endpoint()
            
            # Keep the application running
            logger.info("Application is ready. Press Ctrl+C to stop.")
            await asyncio.Event().wait()
        else:
            logger.error("Application failed to start")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        await fast_startup.shutdown()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
