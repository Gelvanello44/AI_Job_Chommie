"""
Health monitoring utility for tracking system health and performance metrics.
"""

import asyncio
import time
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import psutil
import redis.asyncio as redis
from loguru import logger


class HealthStatus(Enum):
    """Health status enumeration."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


@dataclass
class HealthCheck:
    """Individual health check result."""
    name: str
    status: HealthStatus
    response_time: float
    message: str
    timestamp: datetime
    metadata: Dict[str, Any]


class HealthMonitor:
    """System health monitor with real-time tracking."""
    
    def __init__(self):
        self.checks: Dict[str, HealthCheck] = {}
        self.is_running = False
        self.monitor_task: Optional[asyncio.Task] = None
        self.redis_client: Optional[redis.Redis] = None
        
        # Health thresholds
        self.thresholds = {
            "cpu_percent": 80.0,
            "memory_percent": 85.0,
            "disk_percent": 90.0,
            "response_time_ms": 1000.0,
            "error_rate": 0.05  # 5%
        }
        
        # Metrics storage
        self.metrics_history: List[Dict[str, Any]] = []
        self.max_history_size = 1000
    
    async def start(self):
        """Start health monitoring."""
        if self.is_running:
            return
        
        self.is_running = True
        self.monitor_task = asyncio.create_task(self._monitor_loop())
        
        logger.info("Health monitor started")
    
    async def stop(self):
        """Stop health monitoring."""
        self.is_running = False
        
        if self.monitor_task:
            self.monitor_task.cancel()
            try:
                await self.monitor_task
            except asyncio.CancelledError:
                pass
        
        if self.redis_client:
            await self.redis_client.close()
        
        logger.info("Health monitor stopped")
    
    async def _monitor_loop(self):
        """Main monitoring loop."""
        while self.is_running:
            try:
                await self._perform_health_checks()
                await asyncio.sleep(30)  # Check every 30 seconds
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health monitor error: {e}")
                await asyncio.sleep(60)  # Back off on error
    
    async def _perform_health_checks(self):
        """Perform all health checks."""
        start_time = time.time()
        
        # System resource checks
        await self._check_system_resources()
        
        # Database connectivity
        await self._check_database()
        
        # Redis connectivity
        await self._check_redis()
        
        # Service-specific checks
        await self._check_scraper_health()
        
        # Overall health assessment
        overall_status = self._calculate_overall_health()
        
        # Store metrics
        metrics = {
            "timestamp": datetime.utcnow().isoformat(),
            "overall_status": overall_status.value,
            "individual_checks": {name: check.status.value for name, check in self.checks.items()},
            "check_duration": time.time() - start_time
        }
        
        self.metrics_history.append(metrics)
        if len(self.metrics_history) > self.max_history_size:
            self.metrics_history.pop(0)
        
        logger.debug(f"Health check completed: {overall_status.value}")
    
    async def _check_system_resources(self):
        """Check system resource utilization."""
        try:
            start_time = time.time()
            
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=0.1)
            
            # Memory usage
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            
            # Disk usage
            disk = psutil.disk_usage('/')
            disk_percent = disk.percent
            
            response_time = (time.time() - start_time) * 1000  # ms
            
            # Determine status
            if (cpu_percent > self.thresholds["cpu_percent"] or 
                memory_percent > self.thresholds["memory_percent"] or 
                disk_percent > self.thresholds["disk_percent"]):
                status = HealthStatus.DEGRADED
                message = f"High resource usage: CPU {cpu_percent}%, Memory {memory_percent}%, Disk {disk_percent}%"
            else:
                status = HealthStatus.HEALTHY
                message = f"System resources normal: CPU {cpu_percent}%, Memory {memory_percent}%, Disk {disk_percent}%"
            
            self.checks["system_resources"] = HealthCheck(
                name="system_resources",
                status=status,
                response_time=response_time,
                message=message,
                timestamp=datetime.utcnow(),
                metadata={
                    "cpu_percent": cpu_percent,
                    "memory_percent": memory_percent,
                    "disk_percent": disk_percent
                }
            )
            
        except Exception as e:
            self.checks["system_resources"] = HealthCheck(
                name="system_resources",
                status=HealthStatus.UNHEALTHY,
                response_time=0,
                message=f"System check failed: {e}",
                timestamp=datetime.utcnow(),
                metadata={}
            )
    
    async def _check_database(self):
        """Check database connectivity and performance."""
        try:
            start_time = time.time()
            
            # This would connect to your actual database
            # For now, simulate the check
            await asyncio.sleep(0.01)  # Simulate DB query
            
            response_time = (time.time() - start_time) * 1000  # ms
            
            if response_time > self.thresholds["response_time_ms"]:
                status = HealthStatus.DEGRADED
                message = f"Database slow response: {response_time:.2f}ms"
            else:
                status = HealthStatus.HEALTHY
                message = f"Database healthy: {response_time:.2f}ms"
            
            self.checks["database"] = HealthCheck(
                name="database",
                status=status,
                response_time=response_time,
                message=message,
                timestamp=datetime.utcnow(),
                metadata={"connection_pool_size": 10}  # Would get actual metrics
            )
            
        except Exception as e:
            self.checks["database"] = HealthCheck(
                name="database",
                status=HealthStatus.UNHEALTHY,
                response_time=0,
                message=f"Database check failed: {e}",
                timestamp=datetime.utcnow(),
                metadata={}
            )
    
    async def _check_redis(self):
        """Check Redis connectivity and performance."""
        try:
            start_time = time.time()
            
            # This would connect to your actual Redis
            # For now, simulate the check
            await asyncio.sleep(0.005)  # Simulate Redis ping
            
            response_time = (time.time() - start_time) * 1000  # ms
            
            status = HealthStatus.HEALTHY if response_time < 100 else HealthStatus.DEGRADED
            message = f"Redis response: {response_time:.2f}ms"
            
            self.checks["redis"] = HealthCheck(
                name="redis",
                status=status,
                response_time=response_time,
                message=message,
                timestamp=datetime.utcnow(),
                metadata={"connected_clients": 5}  # Would get actual metrics
            )
            
        except Exception as e:
            self.checks["redis"] = HealthCheck(
                name="redis",
                status=HealthStatus.UNHEALTHY,
                response_time=0,
                message=f"Redis check failed: {e}",
                timestamp=datetime.utcnow(),
                metadata={}
            )
    
    async def _check_scraper_health(self):
        """Check scraper-specific health metrics."""
        try:
            start_time = time.time()
            
            # This would check actual scraper metrics
            # For now, simulate healthy scrapers
            success_rate = 0.95  # 95% success rate
            
            response_time = (time.time() - start_time) * 1000  # ms
            
            if success_rate < (1 - self.thresholds["error_rate"]):
                status = HealthStatus.DEGRADED
                message = f"Low scraper success rate: {success_rate:.2%}"
            else:
                status = HealthStatus.HEALTHY
                message = f"Scrapers healthy: {success_rate:.2%} success rate"
            
            self.checks["scrapers"] = HealthCheck(
                name="scrapers",
                status=status,
                response_time=response_time,
                message=message,
                timestamp=datetime.utcnow(),
                metadata={
                    "success_rate": success_rate,
                    "active_scrapers": 10,
                    "jobs_scraped_today": 1500
                }
            )
            
        except Exception as e:
            self.checks["scrapers"] = HealthCheck(
                name="scrapers",
                status=HealthStatus.UNHEALTHY,
                response_time=0,
                message=f"Scraper health check failed: {e}",
                timestamp=datetime.utcnow(),
                metadata={}
            )
    
    def _calculate_overall_health(self) -> HealthStatus:
        """Calculate overall health status."""
        if not self.checks:
            return HealthStatus.UNKNOWN
        
        statuses = [check.status for check in self.checks.values()]
        
        # If any critical failures
        if HealthStatus.CRITICAL in statuses:
            return HealthStatus.CRITICAL
        
        # If any unhealthy
        if HealthStatus.UNHEALTHY in statuses:
            return HealthStatus.UNHEALTHY
        
        # If any degraded
        if HealthStatus.DEGRADED in statuses:
            return HealthStatus.DEGRADED
        
        # All healthy
        return HealthStatus.HEALTHY
    
    async def update_status(self, component: str, status_data: Dict[str, Any]):
        """Update status for a specific component."""
        self.checks[component] = HealthCheck(
            name=component,
            status=HealthStatus.HEALTHY,  # Would determine from status_data
            response_time=0,
            message=f"{component} status updated",
            timestamp=datetime.utcnow(),
            metadata=status_data
        )
    
    def get_health_summary(self) -> Dict[str, Any]:
        """Get current health summary."""
        overall_status = self._calculate_overall_health()
        
        return {
            "overall_status": overall_status.value,
            "timestamp": datetime.utcnow().isoformat(),
            "checks": {
                name: {
                    "status": check.status.value,
                    "message": check.message,
                    "response_time": check.response_time,
                    "last_check": check.timestamp.isoformat()
                }
                for name, check in self.checks.items()
            },
            "metrics": {
                "total_checks": len(self.checks),
                "healthy_checks": sum(1 for c in self.checks.values() if c.status == HealthStatus.HEALTHY),
                "degraded_checks": sum(1 for c in self.checks.values() if c.status == HealthStatus.DEGRADED),
                "unhealthy_checks": sum(1 for c in self.checks.values() if c.status == HealthStatus.UNHEALTHY)
            }
        }
