"""
Enhanced RSS Feed Scraper with Robust Error Handling and RESTful API Integration.
Features:
- Detailed error logging and diagnostics
- Retry mechanisms with exponential backoff
- RESTful API integration for job submission
- Fallback HTML scraping when RSS fails
- Connection issue resolution
- Rate limiting and quota management
"""

import asyncio
import aiohttp
import feedparser
import json
import hashlib
from typing import List, Dict, Optional, Any, Set
from datetime import datetime, timedelta
from urllib.parse import urlparse, urljoin
import re
import random
from bs4 import BeautifulSoup
from loguru import logger
import backoff
from dataclasses import dataclass, asdict
from enum import Enum
import ssl
import certifi

from src.config.settings import settings


class FeedStatus(Enum):
    """RSS Feed status codes."""
    SUCCESS = "success"
    EMPTY = "empty"
    ERROR = "error"
    TIMEOUT = "timeout"
    UNAUTHORIZED = "unauthorized"
    NOT_FOUND = "not_found"
    RATE_LIMITED = "rate_limited"
    INVALID_FORMAT = "invalid_format"
    CONNECTION_ERROR = "connection_error"
    SSL_ERROR = "ssl_error"


@dataclass
class JobListing:
    """Standardized job listing data structure."""
    title: str
    company: str
    location: str
    description: str
    url: str
    source: str
    source_type: str = "rss_feed"
    posted_date: Optional[datetime] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    job_type: Optional[str] = None
    experience_level: Optional[str] = None
    skills: List[str] = None
    remote_friendly: bool = False
    application_deadline: Optional[datetime] = None
    external_id: Optional[str] = None
    
    def __post_init__(self):
        """Post-initialization processing."""
        if self.skills is None:
            self.skills = []
        # Generate external_id if not provided
        if not self.external_id:
            self.external_id = self._generate_id()
    
    def _generate_id(self) -> str:
        """Generate unique ID for job listing."""
        content = f"{self.title}_{self.company}_{self.location}_{self.url}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def to_api_payload(self) -> Dict[str, Any]:
        """Convert to API-compatible payload."""
        payload = {
            "title": self.title,
            "company": self.company,
            "location": self.location,
            "description": self.description,
            "url": self.url,
            "source": self.source,
            "source_type": self.source_type,
            "external_id": self.external_id,
            "skills_required": self.skills,
            "remote_friendly": self.remote_friendly
        }
        
        # Add optional fields if present
        if self.posted_date:
            payload["posted_date"] = self.posted_date.isoformat()
        if self.salary_min:
            payload["salary_min"] = self.salary_min
        if self.salary_max:
            payload["salary_max"] = self.salary_max
        if self.job_type:
            payload["job_type"] = self.job_type
        if self.experience_level:
            payload["experience_level"] = self.experience_level
        if self.application_deadline:
            payload["application_deadline"] = self.application_deadline.isoformat()
            
        return payload


class APIClient:
    """RESTful API client for job submission."""
    
    def __init__(self, base_url: str = None, api_key: str = None):
        """Initialize API client."""
        self.base_url = base_url or f"http://{settings.api_host}:{settings.api_port}{settings.api_prefix}"
        self.api_key = api_key or settings.jwt_secret_key
        self.session: Optional[aiohttp.ClientSession] = None
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        
    async def __aenter__(self):
        """Async context manager entry."""
        self.session = aiohttp.ClientSession(headers=self.headers)
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
    
    @backoff.on_exception(
        backoff.expo,
        (aiohttp.ClientError, asyncio.TimeoutError),
        max_tries=3,
        max_time=30
    )
    async def submit_job(self, job: JobListing) -> Dict[str, Any]:
        """Submit job to RESTful API with retry logic."""
        if not self.session:
            self.session = aiohttp.ClientSession(headers=self.headers)
            
        url = f"{self.base_url}/jobs"
        payload = job.to_api_payload()
        
        try:
            async with self.session.post(
                url,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                response_data = await response.json()
                
                if response.status == 201:
                    logger.success(f"Job submitted successfully: {job.title} at {job.company}")
                    return {"status": "success", "data": response_data}
                elif response.status == 409:
                    logger.info(f"Job already exists: {job.external_id}")
                    return {"status": "duplicate", "data": response_data}
                else:
                    logger.warning(f"API returned status {response.status}: {response_data}")
                    return {"status": "error", "code": response.status, "data": response_data}
                    
        except asyncio.TimeoutError:
            logger.error(f"API timeout submitting job: {job.title}")
            return {"status": "timeout", "error": "Request timed out"}
        except Exception as e:
            logger.error(f"API error submitting job: {e}")
            return {"status": "error", "error": str(e)}
    
    async def submit_batch(self, jobs: List[JobListing], batch_size: int = 50) -> Dict[str, Any]:
        """Submit multiple jobs in batches."""
        results = {
            "total": len(jobs),
            "success": 0,
            "duplicates": 0,
            "errors": 0,
            "details": []
        }
        
        for i in range(0, len(jobs), batch_size):
            batch = jobs[i:i + batch_size]
            tasks = [self.submit_job(job) for job in batch]
            batch_results = await asyncio.gather(*tasks)
            
            for result in batch_results:
                if result["status"] == "success":
                    results["success"] += 1
                elif result["status"] == "duplicate":
                    results["duplicates"] += 1
                else:
                    results["errors"] += 1
                results["details"].append(result)
                
            # Rate limiting between batches
            await asyncio.sleep(1)
            
        logger.info(
            f"Batch submission complete: {results['success']} success, "
            f"{results['duplicates']} duplicates, {results['errors']} errors"
        )
        return results


class EnhancedRSSFeedScraper:
    """Enhanced RSS feed scraper with robust error handling and API integration."""
    
    # User agents to rotate for avoiding blocks
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
    ]
    
    def __init__(self, api_client: Optional[APIClient] = None):
        """Initialize enhanced RSS scraper."""
        self.api_client = api_client or APIClient()
        self.session: Optional[aiohttp.ClientSession] = None
        self.processed_jobs: Set[str] = set()  # Track processed job IDs
        self.feed_diagnostics: Dict[str, Any] = {}
        
    async def __aenter__(self):
        """Async context manager entry."""
        # Create SSL context with certificate verification
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_REQUIRED
        
        # Create connector with SSL context
        connector = aiohttp.TCPConnector(ssl=ssl_context)
        
        # Create session with rotating user agent
        headers = {
            "User-Agent": random.choice(self.USER_AGENTS),
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
        }
        
        self.session = aiohttp.ClientSession(
            connector=connector,
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=30)
        )
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
            
    async def diagnose_feed(self, feed_url: str) -> Dict[str, Any]:
        """Diagnose RSS feed connectivity and issues."""
        diagnostics = {
            "url": feed_url,
            "timestamp": datetime.utcnow().isoformat(),
            "status": None,
            "http_status": None,
            "content_type": None,
            "content_length": None,
            "error": None,
            "recommendations": []
        }
        
        try:
            logger.info(f"Diagnosing feed: {feed_url}")
            
            async with self.session.get(feed_url, allow_redirects=True) as response:
                diagnostics["http_status"] = response.status
                diagnostics["content_type"] = response.headers.get("Content-Type", "")
                diagnostics["content_length"] = response.headers.get("Content-Length", 0)
                
                if response.status == 200:
                    content = await response.text()
                    
                    # Check if content is actually RSS/XML
                    if any(marker in content[:500].lower() for marker in ["<rss", "<feed", "<?xml"]):
                        diagnostics["status"] = FeedStatus.SUCCESS
                        diagnostics["feed_format"] = self._detect_feed_format(content)
                        
                        # Parse feed to check for entries
                        feed = feedparser.parse(content)
                        diagnostics["entries_count"] = len(feed.entries)
                        
                        if len(feed.entries) == 0:
                            diagnostics["status"] = FeedStatus.EMPTY
                            diagnostics["recommendations"].append("Feed is valid but contains no entries")
                    else:
                        diagnostics["status"] = FeedStatus.INVALID_FORMAT
                        diagnostics["recommendations"].append("Content is not RSS/XML format")
                        diagnostics["recommendations"].append("Consider HTML scraping as fallback")
                        
                elif response.status == 404:
                    diagnostics["status"] = FeedStatus.NOT_FOUND
                    diagnostics["recommendations"].append("Feed URL not found - verify URL")
                    
                elif response.status == 403 or response.status == 401:
                    diagnostics["status"] = FeedStatus.UNAUTHORIZED
                    diagnostics["recommendations"].append("Access denied - may need authentication")
                    
                elif response.status == 429:
                    diagnostics["status"] = FeedStatus.RATE_LIMITED
                    diagnostics["recommendations"].append("Rate limited - implement backoff strategy")
                    
                else:
                    diagnostics["status"] = FeedStatus.ERROR
                    diagnostics["error"] = f"HTTP {response.status}"
                    
        except aiohttp.ClientConnectorError as e:
            diagnostics["status"] = FeedStatus.CONNECTION_ERROR
            diagnostics["error"] = str(e)
            diagnostics["recommendations"].append("Connection failed - check network/firewall")
            
        except asyncio.TimeoutError:
            diagnostics["status"] = FeedStatus.TIMEOUT
            diagnostics["error"] = "Request timed out"
            diagnostics["recommendations"].append("Feed response too slow - increase timeout")
            
        except ssl.SSLError as e:
            diagnostics["status"] = FeedStatus.SSL_ERROR
            diagnostics["error"] = str(e)
            diagnostics["recommendations"].append("SSL certificate issue - verify certificate")
            
        except Exception as e:
            diagnostics["status"] = FeedStatus.ERROR
            diagnostics["error"] = str(e)
            
        self.feed_diagnostics[feed_url] = diagnostics
        logger.info(f"Feed diagnosis complete: {diagnostics['status']}")
        
        return diagnostics
    
    def _detect_feed_format(self, content: str) -> str:
        """Detect RSS/Atom feed format."""
        if "<rss" in content[:500].lower():
            return "RSS"
        elif "<feed" in content[:500].lower():
            return "Atom"
        elif "<?xml" in content[:500].lower():
            return "XML"
        return "Unknown"
    
    @backoff.on_exception(
        backoff.expo,
        (aiohttp.ClientError, asyncio.TimeoutError),
        max_tries=3,
        max_time=60
    )
    async def fetch_feed(self, feed_url: str) -> Optional[feedparser.FeedParserDict]:
        """Fetch and parse RSS feed with retry logic."""
        try:
            logger.info(f"Fetching RSS feed: {feed_url}")
            
            async with self.session.get(feed_url, allow_redirects=True) as response:
                if response.status == 200:
                    content = await response.text()
                    feed = feedparser.parse(content)
                    
                    if feed.bozo:
                        logger.warning(f"Feed parsing warning for {feed_url}: {feed.bozo_exception}")
                    
                    logger.success(f"Successfully fetched {len(feed.entries)} entries from {feed_url}")
                    return feed
                else:
                    logger.error(f"HTTP {response.status} for {feed_url}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error fetching feed {feed_url}: {e}")
            raise
    
    def parse_job_from_entry(self, entry: Dict, feed_source: str) -> Optional[JobListing]:
        """Parse job listing from RSS feed entry."""
        try:
            # Extract basic fields
            title = entry.get("title", "").strip()
            url = entry.get("link", "").strip()
            description = entry.get("summary", entry.get("description", "")).strip()
            
            if not all([title, url]):
                return None
            
            # Extract company and location (often in title or custom fields)
            company, location = self._extract_company_location(entry, title)
            
            # Extract date
            posted_date = self._parse_date(entry)
            
            # Extract salary if present
            salary_min, salary_max = self._extract_salary(description)
            
            # Extract job type and experience level
            job_type = self._extract_job_type(title, description)
            experience_level = self._extract_experience_level(title, description)
            
            # Extract skills
            skills = self._extract_skills(description)
            
            # Check if remote
            remote_friendly = self._is_remote_friendly(title, description)
            
            job = JobListing(
                title=title,
                company=company or "Unknown Company",
                location=location or "South Africa",
                description=description,
                url=url,
                source=feed_source,
                posted_date=posted_date,
                salary_min=salary_min,
                salary_max=salary_max,
                job_type=job_type,
                experience_level=experience_level,
                skills=skills,
                remote_friendly=remote_friendly
            )
            
            return job
            
        except Exception as e:
            logger.error(f"Error parsing RSS entry: {e}")
            return None
    
    def _extract_company_location(self, entry: Dict, title: str) -> tuple:
        """Extract company and location from entry."""
        company = None
        location = None
        
        # Check custom fields first
        company = entry.get("company", entry.get("author", None))
        location = entry.get("location", entry.get("geo", None))
        
        # Try to extract from title (common pattern: "Job Title at Company - Location")
        if not company or not location:
            if " at " in title and " - " in title:
                parts = title.split(" at ")
                if len(parts) > 1:
                    company_location = parts[1]
                    if " - " in company_location:
                        company_parts = company_location.split(" - ")
                        company = company or company_parts[0].strip()
                        location = location or company_parts[1].strip()
        
        return company, location
    
    def _parse_date(self, entry: Dict) -> Optional[datetime]:
        """Parse date from RSS entry."""
        date_str = entry.get("published", entry.get("updated", entry.get("created", None)))
        
        if date_str:
            try:
                # feedparser returns a time struct
                if hasattr(date_str, "tm_year"):
                    return datetime.fromtimestamp(entry.published_parsed)
                else:
                    # Try parsing string date
                    from dateutil import parser
                    return parser.parse(date_str)
            except:
                pass
        
        return None
    
    def _extract_salary(self, text: str) -> tuple:
        """Extract salary range from text."""
        salary_min = None
        salary_max = None
        
        # South African Rand patterns
        patterns = [
            r"R\s?(\d+[\d,]*)\s?-\s?R\s?(\d+[\d,]*)",  # R50,000 - R70,000
            r"ZAR\s?(\d+[\d,]*)\s?-\s?ZAR\s?(\d+[\d,]*)",  # ZAR 50000 - ZAR 70000
            r"(\d+[\d,]*)\s?-\s?(\d+[\d,]*)\s?(?:per month|pm|p/m)",  # 50000 - 70000 per month
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    salary_min = float(match.group(1).replace(",", ""))
                    salary_max = float(match.group(2).replace(",", ""))
                    break
                except:
                    continue
        
        return salary_min, salary_max
    
    def _extract_job_type(self, title: str, description: str) -> Optional[str]:
        """Extract job type from text."""
        text = f"{title} {description}".lower()
        
        if any(term in text for term in ["full-time", "full time", "permanent"]):
            return "full_time"
        elif any(term in text for term in ["part-time", "part time"]):
            return "part_time"
        elif any(term in text for term in ["contract", "temporary", "fixed-term"]):
            return "contract"
        elif any(term in text for term in ["internship", "intern"]):
            return "internship"
        elif any(term in text for term in ["freelance", "consultant"]):
            return "freelance"
        
        return None
    
    def _extract_experience_level(self, title: str, description: str) -> Optional[str]:
        """Extract experience level from text."""
        text = f"{title} {description}".lower()
        
        if any(term in text for term in ["entry level", "entry-level", "junior", "graduate"]):
            return "entry_level"
        elif any(term in text for term in ["senior", "lead", "principal"]):
            return "senior"
        elif any(term in text for term in ["executive", "director", "vp", "ceo", "cto", "cfo"]):
            return "executive"
        elif any(term in text for term in ["manager", "head of"]):
            return "manager"
        
        return "mid_level"  # Default
    
    def _extract_skills(self, description: str) -> List[str]:
        """Extract skills from job description."""
        skills = []
        
        # Common tech skills to look for
        tech_skills = [
            "python", "java", "javascript", "react", "angular", "vue",
            "node.js", "django", "flask", "spring", "docker", "kubernetes",
            "aws", "azure", "gcp", "sql", "nosql", "mongodb", "postgresql",
            "machine learning", "data science", "ai", "devops", "ci/cd"
        ]
        
        text_lower = description.lower()
        for skill in tech_skills:
            if skill in text_lower:
                skills.append(skill)
        
        return skills[:10]  # Limit to 10 skills
    
    def _is_remote_friendly(self, title: str, description: str) -> bool:
        """Check if job is remote-friendly."""
        text = f"{title} {description}".lower()
        remote_terms = ["remote", "work from home", "wfh", "distributed", "anywhere"]
        return any(term in text for term in remote_terms)
    
    async def scrape_feed(
        self,
        feed_url: str,
        feed_name: str,
        submit_to_api: bool = True,
        fallback_to_html: bool = True
    ) -> Dict[str, Any]:
        """Scrape RSS feed and optionally submit to API."""
        results = {
            "feed_url": feed_url,
            "feed_name": feed_name,
            "status": None,
            "jobs_found": 0,
            "jobs_submitted": 0,
            "errors": [],
            "diagnostics": None
        }
        
        try:
            # First, diagnose the feed
            diagnostics = await self.diagnose_feed(feed_url)
            results["diagnostics"] = diagnostics
            
            if diagnostics["status"] != FeedStatus.SUCCESS:
                logger.warning(f"Feed diagnosis failed: {diagnostics['status']}")
                
                # Try fallback to HTML scraping if enabled
                if fallback_to_html and diagnostics["status"] in [
                    FeedStatus.INVALID_FORMAT,
                    FeedStatus.NOT_FOUND
                ]:
                    logger.info("Attempting HTML scraping fallback...")
                    html_jobs = await self.scrape_html_fallback(feed_url)
                    results["jobs_found"] = len(html_jobs)
                    results["fallback_method"] = "html_scraping"
                    
                    if submit_to_api and html_jobs:
                        api_results = await self.api_client.submit_batch(html_jobs)
                        results["jobs_submitted"] = api_results["success"]
                        results["api_results"] = api_results
                
                results["status"] = diagnostics["status"]
                return results
            
            # Fetch and parse feed
            feed = await self.fetch_feed(feed_url)
            
            if not feed or not feed.entries:
                results["status"] = FeedStatus.EMPTY
                return results
            
            # Parse jobs from entries
            jobs = []
            for entry in feed.entries:
                job = self.parse_job_from_entry(entry, feed_name)
                if job and job.external_id not in self.processed_jobs:
                    jobs.append(job)
                    self.processed_jobs.add(job.external_id)
            
            results["jobs_found"] = len(jobs)
            logger.info(f"Parsed {len(jobs)} unique jobs from {feed_name}")
            
            # Submit to API if enabled
            if submit_to_api and jobs:
                async with self.api_client as client:
                    api_results = await client.submit_batch(jobs)
                    results["jobs_submitted"] = api_results["success"]
                    results["api_results"] = api_results
            
            results["status"] = FeedStatus.SUCCESS
            
        except Exception as e:
            logger.error(f"Error scraping feed {feed_url}: {e}")
            results["status"] = FeedStatus.ERROR
            results["errors"].append(str(e))
        
        return results
    
    async def scrape_html_fallback(self, url: str) -> List[JobListing]:
        """Fallback to HTML scraping when RSS fails."""
        jobs = []
        
        try:
            logger.info(f"Attempting HTML scraping for {url}")
            
            async with self.session.get(url) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, "html.parser")
                    
                    # Look for common job listing patterns
                    # This is a simplified example - customize based on actual site structure
                    job_cards = soup.find_all(
                        ["div", "article", "li"],
                        class_=re.compile("job|listing|card|posting", re.I)
                    )
                    
                    for card in job_cards[:50]:  # Limit to 50 jobs
                        job = self._parse_html_job_card(card, url)
                        if job:
                            jobs.append(job)
                    
                    logger.success(f"Extracted {len(jobs)} jobs via HTML scraping")
                    
        except Exception as e:
            logger.error(f"HTML scraping failed: {e}")
        
        return jobs
    
    def _parse_html_job_card(self, card, base_url: str) -> Optional[JobListing]:
        """Parse job from HTML card element."""
        try:
            # Look for title
            title_elem = card.find(["h1", "h2", "h3", "h4", "a"], class_=re.compile("title|heading", re.I))
            if not title_elem:
                title_elem = card.find("a")
            
            title = title_elem.get_text(strip=True) if title_elem else None
            
            # Look for URL
            url_elem = card.find("a", href=True)
            url = urljoin(base_url, url_elem["href"]) if url_elem else None
            
            # Look for company
            company_elem = card.find(["span", "div"], class_=re.compile("company|employer", re.I))
            company = company_elem.get_text(strip=True) if company_elem else "Unknown Company"
            
            # Look for location
            location_elem = card.find(["span", "div"], class_=re.compile("location|place", re.I))
            location = location_elem.get_text(strip=True) if location_elem else "South Africa"
            
            # Look for description
            desc_elem = card.find(["p", "div"], class_=re.compile("description|summary", re.I))
            description = desc_elem.get_text(strip=True) if desc_elem else title or ""
            
            if title and url:
                return JobListing(
                    title=title,
                    company=company,
                    location=location,
                    description=description,
                    url=url,
                    source=base_url,
                    source_type="html_scraping"
                )
                
        except Exception as e:
            logger.debug(f"Failed to parse HTML job card: {e}")
        
        return None
    
    async def scrape_multiple_feeds(
        self,
        feeds: List[Dict[str, str]],
        submit_to_api: bool = True,
        max_concurrent: int = 5
    ) -> Dict[str, Any]:
        """Scrape multiple RSS feeds concurrently."""
        logger.info(f"Starting to scrape {len(feeds)} RSS feeds")
        
        overall_results = {
            "total_feeds": len(feeds),
            "successful_feeds": 0,
            "failed_feeds": 0,
            "total_jobs_found": 0,
            "total_jobs_submitted": 0,
            "feed_results": [],
            "summary_by_status": {}
        }
        
        # Process feeds in batches
        for i in range(0, len(feeds), max_concurrent):
            batch = feeds[i:i + max_concurrent]
            tasks = [
                self.scrape_feed(
                    feed["url"],
                    feed.get("name", feed["url"]),
                    submit_to_api=submit_to_api
                )
                for feed in batch
            ]
            
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for feed, result in zip(batch, batch_results):
                if isinstance(result, Exception):
                    logger.error(f"Feed scraping exception for {feed['url']}: {result}")
                    overall_results["failed_feeds"] += 1
                    overall_results["feed_results"].append({
                        "feed": feed["name"],
                        "status": "exception",
                        "error": str(result)
                    })
                else:
                    overall_results["feed_results"].append(result)
                    
                    if result["status"] == FeedStatus.SUCCESS:
                        overall_results["successful_feeds"] += 1
                    else:
                        overall_results["failed_feeds"] += 1
                    
                    overall_results["total_jobs_found"] += result.get("jobs_found", 0)
                    overall_results["total_jobs_submitted"] += result.get("jobs_submitted", 0)
                    
                    # Track by status
                    status_key = str(result["status"])
                    if status_key not in overall_results["summary_by_status"]:
                        overall_results["summary_by_status"][status_key] = 0
                    overall_results["summary_by_status"][status_key] += 1
        
        logger.info(
            f"RSS scraping complete: {overall_results['successful_feeds']}/{len(feeds)} successful, "
            f"{overall_results['total_jobs_found']} jobs found, "
            f"{overall_results['total_jobs_submitted']} submitted to API"
        )
        
        return overall_results


# South African RSS Feeds Configuration
SA_RSS_FEEDS = [
    # Major job boards
    {"name": "CareerJunction Tech", "url": "https://www.careerjunction.co.za/jobs/rss/technology"},
    {"name": "CareerJunction Finance", "url": "https://www.careerjunction.co.za/jobs/rss/finance"},
    {"name": "CareerJunction Sales", "url": "https://www.careerjunction.co.za/jobs/rss/sales"},
    {"name": "Careers24 Latest", "url": "https://www.careers24.com/jobs/rss/latest"},
    {"name": "Indeed SA", "url": "https://za.indeed.com/rss?q=&l=South+Africa"},
    {"name": "PNet Latest", "url": "https://www.pnet.co.za/jobs/rss"},
    
    # Sector specific
    {"name": "Bizcommunity Jobs", "url": "https://www.bizcommunity.com/Jobs.aspx?RSS=1"},
    {"name": "MyJobMag SA", "url": "https://www.myjobmag.co.za/feed"},
    
    # Government and NGO
    {"name": "SA Government Jobs", "url": "https://www.gov.za/about-government/jobs/feed"},
    
    # Tech focused
    {"name": "OfferZen", "url": "https://www.offerzen.com/jobs/rss"},
    {"name": "TechCentral Jobs", "url": "https://techcentral.co.za/jobs/feed"},
    
    # Regional
    {"name": "Gumtree Johannesburg", "url": "https://www.gumtree.co.za/rss/jobs/johannesburg"},
    {"name": "Gumtree Cape Town", "url": "https://www.gumtree.co.za/rss/jobs/cape-town"},
    {"name": "Gumtree Durban", "url": "https://www.gumtree.co.za/rss/jobs/durban"},
]


async def test_enhanced_scraper():
    """Test the enhanced RSS scraper with diagnostics."""
    logger.info("Starting enhanced RSS scraper test with API integration")
    
    # Initialize API client (using local settings)
    api_client = APIClient(
        base_url=f"http://localhost:8000/api/v1",
        api_key="test-api-key"  # Replace with actual API key
    )
    
    async with EnhancedRSSFeedScraper(api_client) as scraper:
        # Test with South African feeds
        results = await scraper.scrape_multiple_feeds(
            SA_RSS_FEEDS[:5],  # Test with first 5 feeds
            submit_to_api=True,  # Enable API submission
            max_concurrent=3
        )
        
        # Print detailed results
        print("\n" + "="*80)
        print("ENHANCED RSS SCRAPER TEST RESULTS")
        print("="*80)
        
        print(f"\nOverall Statistics:")
        print(f"  Total Feeds: {results['total_feeds']}")
        print(f"  Successful: {results['successful_feeds']}")
        print(f"  Failed: {results['failed_feeds']}")
        print(f"  Jobs Found: {results['total_jobs_found']}")
        print(f"  Jobs Submitted to API: {results['total_jobs_submitted']}")
        
        print(f"\nStatus Summary:")
        for status, count in results['summary_by_status'].items():
            print(f"  {status}: {count}")
        
        print(f"\nDetailed Feed Results:")
        for feed_result in results['feed_results']:
            print(f"\n  Feed: {feed_result['feed_name']}")
            print(f"    Status: {feed_result['status']}")
            print(f"    Jobs Found: {feed_result['jobs_found']}")
            print(f"    Jobs Submitted: {feed_result['jobs_submitted']}")
            
            if feed_result.get('diagnostics'):
                diag = feed_result['diagnostics']
                print(f"    HTTP Status: {diag.get('http_status')}")
                print(f"    Content Type: {diag.get('content_type')}")
                
                if diag.get('recommendations'):
                    print(f"    Recommendations:")
                    for rec in diag['recommendations']:
                        print(f"      - {rec}")
        
        print("\n" + "="*80)
        
        return results


if __name__ == "__main__":
    # Run test
    asyncio.run(test_enhanced_scraper())
