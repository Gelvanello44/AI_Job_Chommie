"""
Base scraper class with anti-detection and self-healing capabilities.
Provides foundation for all specialized scrapers.
"""

import asyncio
import random
import time
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime, timedelta
import hashlib
import json
import os

import aiohttp
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from fake_useragent import UserAgent
from loguru import logger
import curl_cffi.requests as curl_requests
from playwright.async_api import async_playwright, Browser, Page

from src.config.settings import settings
from src.utils.proxy_manager import ProxyManager
from src.utils.fingerprint_generator import FingerprintGenerator
from src.utils.captcha_solver import CaptchaSolver
from src.utils.rate_limiter import AdaptiveRateLimiter


class WebshareProxyLoader:
    """Load and manage Webshare proxies from proxies.txt file."""
    
    def __init__(self, proxies_file: str = "proxies.txt"):
        self.proxies_file = proxies_file
        self.proxies = []
        self.load_proxies()
        
    def load_proxies(self):
        """Load proxies from the proxies.txt file."""
        # Try to find proxies.txt in multiple locations
        possible_paths = [
            self.proxies_file,  # Current directory
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), self.proxies_file),  # Project root
            os.path.join(os.getcwd(), self.proxies_file),  # Working directory
        ]
        
        proxies_path = None
        for path in possible_paths:
            if os.path.exists(path):
                proxies_path = path
                break
                
        if not proxies_path:
            logger.warning(f"Proxies file {self.proxies_file} not found in any expected location")
            return
            
        try:
            with open(proxies_path, 'r') as f:
                lines = f.read().strip().split('\n')
                
            for line in lines:
                line = line.strip()
                if line and ':' in line:
                    # Parse proxy format: IP:PORT:USERNAME:PASSWORD
                    parts = line.split(':')
                    if len(parts) == 4:
                        ip, port, username, password = parts
                        proxy_url = f"http://{username}:{password}@{ip}:{port}"
                        self.proxies.append(proxy_url)
                        
            logger.info(f"Loaded {len(self.proxies)} proxies from {proxies_path}")
            
        except Exception as e:
            logger.error(f"Error loading proxies from {proxies_path}: {e}")
            
    def get_random_proxy(self) -> Optional[str]:
        """Get a random proxy from the loaded list."""
        if not self.proxies:
            return None
        return random.choice(self.proxies)


class ScraperMetrics:
    """Track scraper performance metrics."""
    
    def __init__(self):
        self.total_requests = 0
        self.successful_requests = 0
        self.failed_requests = 0
        self.blocked_requests = 0
        self.total_items_scraped = 0
        self.start_time = time.time()
        self.errors = []
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate."""
        if self.total_requests == 0:
            return 0.0
        return self.successful_requests / self.total_requests
    
    @property
    def runtime(self) -> float:
        """Get runtime in seconds."""
        return time.time() - self.start_time
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert metrics to dictionary."""
        return {
            "total_requests": self.total_requests,
            "successful_requests": self.successful_requests,
            "failed_requests": self.failed_requests,
            "blocked_requests": self.blocked_requests,
            "total_items_scraped": self.total_items_scraped,
            "success_rate": self.success_rate,
            "runtime": self.runtime,
            "errors": self.errors[-10:]  # Last 10 errors
        }


class BaseScraper(ABC):
    """Base scraper class with anti-detection and self-healing capabilities."""
    
    def __init__(
        self,
        name: str,
        use_browser: bool = False,
        use_proxy: bool = True,
        max_retries: int = 3
    ):
        self.name = name
        self.use_browser = use_browser
        self.use_proxy = use_proxy
        self.max_retries = max_retries
        
        # Initialize components
        self.metrics = ScraperMetrics()
        self.ua = UserAgent()
        self.proxy_manager = ProxyManager() if use_proxy else None
        # Initialize Webshare proxy loader for rotating proxies
        self.webshare_proxy_loader = WebshareProxyLoader() if use_proxy else None
        self.fingerprint_generator = FingerprintGenerator()
        self.captcha_solver = CaptchaSolver()
        self.rate_limiter = AdaptiveRateLimiter()
        
        # Browser instance for JavaScript-heavy sites
        self.browser: Optional[Browser] = None
        self.playwright = None
        
        # Session management
        self.sessions: Dict[str, aiohttp.ClientSession] = {}
        self.session_rotation_count = 0
        self.max_session_uses = 50
        
        # Anti-detection settings
        self.min_delay = 0.5
        self.max_delay = 3.0
        self.behavioral_patterns = self._generate_behavioral_patterns()
        
        # Log proxy availability
        if self.webshare_proxy_loader and self.webshare_proxy_loader.proxies:
            logger.info(f"Initialized {name} scraper with {len(self.webshare_proxy_loader.proxies)} Webshare proxies for rotation")
        else:
            logger.info(f"Initialized {name} scraper")
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.cleanup()
    
    async def initialize(self):
        """Initialize scraper resources."""
        if self.use_browser:
            self.playwright = await async_playwright().start()
            self.browser = await self._create_browser()
        
        logger.info(f"{self.name} scraper initialized")
    
    async def cleanup(self):
        """Clean up scraper resources."""
        # Close all sessions
        for session in self.sessions.values():
            await session.close()
        
        # Close browser
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        
        logger.info(f"{self.name} scraper cleaned up. Metrics: {self.metrics.to_dict()}")
    
    async def _create_browser(self) -> Browser:
        """Create browser instance with anti-detection settings."""
        fingerprint = self.fingerprint_generator.generate()
        
        args = [
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--no-sandbox',
            f'--user-agent={fingerprint["user_agent"]}',
            f'--window-size={fingerprint["screen_width"]},{fingerprint["screen_height"]}'
        ]
        
        # Add proxy to browser if available
        proxy_config = None
        if self.webshare_proxy_loader and self.webshare_proxy_loader.proxies:
            proxy_url = self.webshare_proxy_loader.get_random_proxy()
            if proxy_url:
                # Parse proxy URL for Playwright format
                from urllib.parse import urlparse
                parsed = urlparse(proxy_url)
                proxy_config = {
                    "server": f"http://{parsed.hostname}:{parsed.port}",
                    "username": parsed.username,
                    "password": parsed.password
                }
        
        browser = await self.playwright.chromium.launch(
            headless=True,
            args=args,
            proxy=proxy_config
        )
        
        return browser
    
    def _generate_behavioral_patterns(self) -> Dict[str, Any]:
        """Generate realistic behavioral patterns."""
        return {
            "mouse_speed": random.uniform(0.5, 1.5),
            "scroll_speed": random.uniform(50, 150),
            "typing_speed": random.uniform(50, 150),
            "reading_time_per_word": random.uniform(0.2, 0.4),
            "idle_time_range": (1, 5),
            "action_delay_range": (0.1, 0.5)
        }
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((aiohttp.ClientError, asyncio.TimeoutError))
    )
    async def fetch(
        self,
        url: str,
        method: str = "GET",
        headers: Optional[Dict[str, str]] = None,
        data: Optional[Any] = None,
        use_curl: bool = False
    ) -> Dict[str, Any]:
        """Fetch URL with anti-detection measures."""
        self.metrics.total_requests += 1
        
        # Rate limiting
        domain = self._extract_domain(url)
        await self.rate_limiter.wait(domain)
        
        # Add steganographic delay
        await self._add_human_delay()
        
        try:
            if use_curl:
                # Use curl-cffi for better TLS fingerprinting
                response = await self._fetch_with_curl(url, method, headers, data)
            elif self.use_browser:
                response = await self._fetch_with_browser(url)
            else:
                response = await self._fetch_with_session(url, method, headers, data)
            
            self.metrics.successful_requests += 1
            self.rate_limiter.record_success(domain)
            
            return response
            
        except Exception as e:
            self.metrics.failed_requests += 1
            self.metrics.errors.append({
                "url": url,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
            self.rate_limiter.record_failure(domain)
            logger.error(f"Error fetching {url}: {e}")
            raise
    
    async def _fetch_with_session(
        self,
        url: str,
        method: str,
        headers: Optional[Dict[str, str]],
        data: Optional[Any]
    ) -> Dict[str, Any]:
        """Fetch using aiohttp session."""
        session = await self._get_session()
        
        # Prepare headers
        if headers is None:
            headers = {}
        headers.update(self._get_random_headers())
        
        # Get proxy - prioritize Webshare proxies if available
        proxy = None
        if self.webshare_proxy_loader and self.webshare_proxy_loader.proxies:
            proxy = self.webshare_proxy_loader.get_random_proxy()
        elif self.proxy_manager:
            proxy = await self.proxy_manager.get_proxy()
        
        async with session.request(
            method,
            url,
            headers=headers,
            data=data,
            proxy=proxy,
            timeout=aiohttp.ClientTimeout(total=settings.scraper_timeout)
        ) as response:
            content = await response.text()
            
            # Check for blocking
            if self._is_blocked(response.status, content):
                self.metrics.blocked_requests += 1
                await self._handle_blocking(url)
                raise Exception("Request blocked")
            
            return {
                "url": url,
                "status": response.status,
                "headers": dict(response.headers),
                "content": content,
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def _fetch_with_browser(self, url: str) -> Dict[str, Any]:
        """Fetch using Playwright browser."""
        page = await self.browser.new_page()
        
        try:
            # Apply fingerprint
            fingerprint = self.fingerprint_generator.generate()
            await self._apply_fingerprint(page, fingerprint)
            
            # Navigate with behavioral mimicking
            await self._navigate_with_behavior(page, url)
            
            # Wait for content
            await page.wait_for_load_state("networkidle")
            
            # Extract content
            content = await page.content()
            
            # Check for CAPTCHA
            if await self._has_captcha(page):
                await self._solve_captcha(page)
                content = await page.content()
            
            return {
                "url": url,
                "status": 200,
                "headers": {},
                "content": content,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        finally:
            await page.close()
    
    async def _fetch_with_curl(
        self,
        url: str,
        method: str,
        headers: Optional[Dict[str, str]],
        data: Optional[Any]
    ) -> Dict[str, Any]:
        """Fetch using curl-cffi for better TLS fingerprinting."""
        if headers is None:
            headers = {}
        headers.update(self._get_random_headers())
        
        # Get proxy - prioritize Webshare proxies if available
        proxies = None
        if self.webshare_proxy_loader and self.webshare_proxy_loader.proxies:
            proxy_url = self.webshare_proxy_loader.get_random_proxy()
            if proxy_url:
                proxies = {"http": proxy_url, "https": proxy_url}
        
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: curl_requests.request(
                method,
                url,
                headers=headers,
                data=data,
                proxies=proxies,
                impersonate="chrome110",
                timeout=settings.scraper_timeout
            )
        )
        
        return {
            "url": url,
            "status": response.status_code,
            "headers": dict(response.headers),
            "content": response.text,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create session with rotation."""
        session_key = f"session_{self.session_rotation_count // self.max_session_uses}"
        
        if session_key not in self.sessions:
            connector = aiohttp.TCPConnector(
                limit=100,
                ttl_dns_cache=300,
                enable_cleanup_closed=True
            )
            self.sessions[session_key] = aiohttp.ClientSession(
                connector=connector,
                trust_env=True
            )
        
        self.session_rotation_count += 1
        return self.sessions[session_key]
    
    def _get_random_headers(self) -> Dict[str, str]:
        """Generate random realistic headers."""
        return {
            "User-Agent": self.ua.random,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": random.choice([
                "en-US,en;q=0.9",
                "en-GB,en;q=0.9",
                "en-US,en;q=0.8,en-GB;q=0.6"
            ]),
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Cache-Control": "max-age=0"
        }
    
    async def _apply_fingerprint(self, page: Page, fingerprint: Dict[str, Any]):
        """Apply browser fingerprint."""
        # Override navigator properties
        await page.add_init_script(f"""
            Object.defineProperty(navigator, 'webdriver', {{
                get: () => false
            }});
            Object.defineProperty(navigator, 'plugins', {{
                get: () => {json.dumps(fingerprint['plugins'])}
            }});
            Object.defineProperty(navigator, 'languages', {{
                get: () => {json.dumps(fingerprint['languages'])}
            }});
            Object.defineProperty(screen, 'width', {{
                get: () => {fingerprint['screen_width']}
            }});
            Object.defineProperty(screen, 'height', {{
                get: () => {fingerprint['screen_height']}
            }});
        """)
    
    async def _navigate_with_behavior(self, page: Page, url: str):
        """Navigate to URL with human-like behavior."""
        await page.goto(url)
        
        # Random mouse movements
        for _ in range(random.randint(2, 5)):
            x = random.randint(100, 800)
            y = random.randint(100, 600)
            await page.mouse.move(x, y)
            await asyncio.sleep(random.uniform(0.1, 0.3))
        
        # Random scrolling
        for _ in range(random.randint(1, 3)):
            await page.evaluate(f"window.scrollBy(0, {random.randint(100, 300)})")
            await asyncio.sleep(random.uniform(0.5, 1.5))
    
    async def _add_human_delay(self):
        """Add human-like delay between requests."""
        delay = random.uniform(self.min_delay, self.max_delay)
        # Add jitter
        delay *= random.uniform(0.8, 1.2)
        await asyncio.sleep(delay)
    
    def _is_blocked(self, status_code: int, content: str) -> bool:
        """Check if request was blocked."""
        # Status code checks
        if status_code in [403, 429, 503]:
            return True
        
        # Content checks
        block_indicators = [
            "access denied",
            "bot detected",
            "cloudflare",
            "please enable cookies",
            "unusual traffic",
            "captcha"
        ]
        
        content_lower = content.lower()
        return any(indicator in content_lower for indicator in block_indicators)
    
    async def _handle_blocking(self, url: str):
        """Handle blocking with self-healing mechanisms."""
        logger.warning(f"Blocked on {url}. Implementing self-healing...")
        
        # Rotate proxy
        if self.proxy_manager:
            await self.proxy_manager.mark_proxy_failed()
        
        # Increase delays
        self.min_delay *= 1.5
        self.max_delay *= 1.5
        
        # Clear sessions
        for session in self.sessions.values():
            await session.close()
        self.sessions.clear()
        
        # Wait before retry
        await asyncio.sleep(random.uniform(30, 60))
    
    async def _has_captcha(self, page: Page) -> bool:
        """Check if page has CAPTCHA."""
        captcha_selectors = [
            'iframe[src*="recaptcha"]',
            'div[class*="captcha"]',
            'div[id*="captcha"]',
            'img[src*="captcha"]'
        ]
        
        for selector in captcha_selectors:
            if await page.query_selector(selector):
                return True
        return False
    
    async def _solve_captcha(self, page: Page):
        """Solve CAPTCHA if present."""
        logger.info("CAPTCHA detected, attempting to solve...")
        # This would integrate with your CAPTCHA solving service
        await self.captcha_solver.solve(page)
    
    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL."""
        from urllib.parse import urlparse
        return urlparse(url).netloc
    
    @abstractmethod
    async def scrape(self, **kwargs) -> List[Dict[str, Any]]:
        """Main scraping method to be implemented by subclasses."""
        pass
    
    @abstractmethod
    async def parse_item(self, data: Any) -> Dict[str, Any]:
        """Parse individual item from scraped data."""
        pass
