"""
Proxy manager for rotating IP addresses and managing proxy pools.
"""

import asyncio
import random
import time
from typing import Dict, List, Any, Optional, Set
from datetime import datetime, timedelta
from dataclasses import dataclass
import aiohttp
from loguru import logger

from src.config.settings import settings


@dataclass
class ProxyInfo:
    """Proxy information structure."""
    ip: str
    port: int
    username: Optional[str] = None
    password: Optional[str] = None
    protocol: str = "http"
    country: Optional[str] = None
    is_working: bool = True
    last_used: Optional[datetime] = None
    failure_count: int = 0
    success_count: int = 0
    response_times: List[float] = None
    
    def __post_init__(self):
        if self.response_times is None:
            self.response_times = []
    
    @property
    def proxy_url(self) -> str:
        """Get proxy URL string."""
        if self.username and self.password:
            return f"{self.protocol}://{self.username}:{self.password}@{self.ip}:{self.port}"
        else:
            return f"{self.protocol}://{self.ip}:{self.port}"
    
    @property
    def success_rate(self) -> float:
        """Calculate proxy success rate."""
        total = self.success_count + self.failure_count
        if total == 0:
            return 1.0
        return self.success_count / total
    
    @property
    def average_response_time(self) -> float:
        """Get average response time."""
        if not self.response_times:
            return 0.0
        return sum(self.response_times) / len(self.response_times)


class ProxyManager:
    """Advanced proxy manager with rotation and health monitoring."""
    
    def __init__(self):
        self.proxies: List[ProxyInfo] = []
        self.current_proxy_index = 0
        self.failed_proxies: Set[str] = set()
        self.proxy_rotation_interval = settings.proxy_rotation_interval
        self.last_rotation = datetime.utcnow()
        
        # Health monitoring
        self.health_check_interval = 300  # 5 minutes
        self.max_failures_before_removal = 5
        self.response_time_threshold = 10000  # 10 seconds
        
        # Performance tracking
        self.total_requests = 0
        self.total_failures = 0
        
    async def initialize(self):
        """Initialize proxy manager with proxy list."""
        logger.info("Initializing proxy manager...")
        
        # Load proxies from configuration or external source
        await self._load_proxies()
        
        # Start health monitoring
        asyncio.create_task(self._health_monitor_loop())
        
        logger.info(f"Proxy manager initialized with {len(self.proxies)} proxies")
    
    async def _load_proxies(self):
        """Load proxy list from configuration or external API."""
        # For now, create a basic proxy list
        # In production, this would load from your proxy provider API
        
        if settings.proxy_api_key:
            # Load from external proxy service
            await self._load_from_proxy_service()
        else:
            # Use basic proxy list for development
            self._load_default_proxies()
    
    async def _load_from_proxy_service(self):
        """Load proxies from external proxy service API."""
        try:
            # This would integrate with your actual proxy provider
            # For example: Bright Data, Oxylabs, ProxyMesh, etc.
            
            logger.info("Loading proxies from external service...")
            
            # Simulate loading proxies
            await asyncio.sleep(0.1)
            
            # Example proxy structure (replace with actual API call)
            proxy_list = [
                {"ip": "proxy1.example.com", "port": 8080, "country": "US"},
                {"ip": "proxy2.example.com", "port": 8080, "country": "CA"},
                {"ip": "proxy3.example.com", "port": 8080, "country": "UK"},
            ]
            
            for proxy_data in proxy_list:
                proxy = ProxyInfo(
                    ip=proxy_data["ip"],
                    port=proxy_data["port"],
                    country=proxy_data.get("country"),
                    username=settings.proxy_api_key,  # Some services use API key as username
                    password=""
                )
                self.proxies.append(proxy)
            
            logger.info(f"Loaded {len(self.proxies)} proxies from service")
            
        except Exception as e:
            logger.error(f"Failed to load proxies from service: {e}")
            self._load_default_proxies()
    
    def _load_default_proxies(self):
        """Load default proxy list for development."""
        # Basic proxy list for development/testing
        default_proxies = [
            {"ip": "127.0.0.1", "port": 8888},  # Local proxy for testing
        ]
        
        for proxy_data in default_proxies:
            proxy = ProxyInfo(
                ip=proxy_data["ip"],
                port=proxy_data["port"]
            )
            self.proxies.append(proxy)
        
        logger.info(f"Loaded {len(self.proxies)} default proxies")
    
    async def get_proxy(self) -> Optional[str]:
        """Get next available proxy."""
        if not self.proxies:
            return None
        
        # Check if rotation is needed
        if self._should_rotate():
            self._rotate_proxy()
        
        # Get current proxy
        current_proxy = self._get_current_proxy()
        if not current_proxy:
            return None
        
        # Update usage tracking
        current_proxy.last_used = datetime.utcnow()
        self.total_requests += 1
        
        return current_proxy.proxy_url
    
    def _should_rotate(self) -> bool:
        """Determine if proxy should be rotated."""
        time_since_rotation = (datetime.utcnow() - self.last_rotation).total_seconds()
        return time_since_rotation >= self.proxy_rotation_interval
    
    def _rotate_proxy(self):
        """Rotate to next proxy."""
        if len(self.proxies) <= 1:
            return
        
        self.current_proxy_index = (self.current_proxy_index + 1) % len(self.proxies)
        self.last_rotation = datetime.utcnow()
        
        current_proxy = self.proxies[self.current_proxy_index]
        logger.debug(f"Rotated to proxy: {current_proxy.ip}:{current_proxy.port}")
    
    def _get_current_proxy(self) -> Optional[ProxyInfo]:
        """Get current proxy, skipping failed ones."""
        if not self.proxies:
            return None
        
        # Try up to len(proxies) times to find a working proxy
        attempts = 0
        while attempts < len(self.proxies):
            proxy = self.proxies[self.current_proxy_index]
            
            # Skip failed proxies
            if proxy.proxy_url not in self.failed_proxies and proxy.is_working:
                return proxy
            
            # Move to next proxy
            self.current_proxy_index = (self.current_proxy_index + 1) % len(self.proxies)
            attempts += 1
        
        # No working proxies found
        logger.warning("No working proxies available")
        return None
    
    async def mark_proxy_failed(self, proxy_url: Optional[str] = None):
        """Mark proxy as failed."""
        if not proxy_url:
            # Mark current proxy as failed
            proxy = self._get_current_proxy()
            if proxy:
                proxy_url = proxy.proxy_url
        
        if proxy_url:
            self.failed_proxies.add(proxy_url)
            self.total_failures += 1
            
            # Update proxy failure count
            for proxy in self.proxies:
                if proxy.proxy_url == proxy_url:
                    proxy.failure_count += 1
                    
                    # Mark as not working if too many failures
                    if proxy.failure_count >= self.max_failures_before_removal:
                        proxy.is_working = False
                        logger.warning(f"Proxy {proxy.ip}:{proxy.port} marked as not working")
                    break
            
            logger.debug(f"Marked proxy as failed: {proxy_url}")
    
    async def mark_proxy_success(self, proxy_url: str, response_time: float):
        """Mark proxy as successful."""
        # Remove from failed set
        self.failed_proxies.discard(proxy_url)
        
        # Update proxy success metrics
        for proxy in self.proxies:
            if proxy.proxy_url == proxy_url:
                proxy.success_count += 1
                proxy.response_times.append(response_time)
                
                # Keep only recent response times (last 20)
                if len(proxy.response_times) > 20:
                    proxy.response_times.pop(0)
                
                # Re-enable proxy if it was disabled
                if not proxy.is_working and proxy.success_count > proxy.failure_count:
                    proxy.is_working = True
                    logger.info(f"Proxy {proxy.ip}:{proxy.port} re-enabled")
                break
    
    async def _health_monitor_loop(self):
        """Background task to monitor proxy health."""
        while True:
            try:
                await self._check_proxy_health()
                await asyncio.sleep(self.health_check_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Proxy health monitor error: {e}")
                await asyncio.sleep(60)
    
    async def _check_proxy_health(self):
        """Check health of all proxies."""
        logger.debug("Checking proxy health...")
        
        tasks = []
        for proxy in self.proxies:
            if proxy.is_working:
                task = asyncio.create_task(self._test_proxy(proxy))
                tasks.append(task)
        
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            working_proxies = sum(1 for r in results if r is True)
            total_tested = len(tasks)
            
            logger.info(f"Proxy health check: {working_proxies}/{total_tested} proxies working")
    
    async def _test_proxy(self, proxy: ProxyInfo) -> bool:
        """Test individual proxy connectivity."""
        try:
            start_time = time.time()
            
            # Test proxy with a simple HTTP request
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://httpbin.org/ip",
                    proxy=proxy.proxy_url,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        response_time = (time.time() - start_time) * 1000
                        await self.mark_proxy_success(proxy.proxy_url, response_time)
                        return True
                    else:
                        await self.mark_proxy_failed(proxy.proxy_url)
                        return False
        
        except Exception as e:
            logger.debug(f"Proxy test failed for {proxy.ip}:{proxy.port}: {e}")
            await self.mark_proxy_failed(proxy.proxy_url)
            return False
    
    def get_proxy_stats(self) -> Dict[str, Any]:
        """Get proxy manager statistics."""
        working_proxies = sum(1 for p in self.proxies if p.is_working)
        total_proxies = len(self.proxies)
        
        return {
            "total_proxies": total_proxies,
            "working_proxies": working_proxies,
            "failed_proxies": len(self.failed_proxies),
            "current_proxy": self.current_proxy_index,
            "total_requests": self.total_requests,
            "total_failures": self.total_failures,
            "success_rate": (self.total_requests - self.total_failures) / max(self.total_requests, 1),
            "proxy_details": [
                {
                    "ip": p.ip,
                    "port": p.port,
                    "country": p.country,
                    "is_working": p.is_working,
                    "success_rate": p.success_rate,
                    "avg_response_time": p.average_response_time,
                    "last_used": p.last_used.isoformat() if p.last_used else None
                }
                for p in self.proxies
            ]
        }
    
    async def refresh_proxy_list(self):
        """Refresh proxy list from external source."""
        logger.info("Refreshing proxy list...")
        
        # Clear current failed proxies
        self.failed_proxies.clear()
        
        # Reload proxies
        await self._load_proxies()
        
        logger.info("Proxy list refreshed")
