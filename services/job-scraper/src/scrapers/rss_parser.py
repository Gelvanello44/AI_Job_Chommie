"""
RSS Feed Parser for Legal Job Data Collection
100% Legal - RSS feeds are explicitly provided for syndication
"""

import asyncio
import aiohttp
import feedparser
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from loguru import logger
import hashlib
from urllib.parse import urlparse

from src.scrapers.base_scraper import BaseScraper
from src.utils.text_processor import TextProcessor
from src.utils.salary_parser import SalaryParser


class RSSFeedParser(BaseScraper):
    """
    Legal RSS feed parser for South African job boards.
    RSS feeds are provided explicitly for content syndication.
    """
    
    def __init__(self):
        super().__init__(
            name="rss_parser",
            use_browser=False,
            use_proxy=False,
            max_retries=3
        )
        
        self.text_processor = TextProcessor()
        self.salary_parser = SalaryParser()
        
        # Legal RSS feeds from SA job boards
        self.rss_feeds = {
            "careers24": {
                "feeds": [
                    "https://www.careers24.com/rss/jobs",
                    "https://www.careers24.com/rss/jobs/gauteng",
                    "https://www.careers24.com/rss/jobs/western-cape",
                    "https://www.careers24.com/rss/jobs/kwazulu-natal",
                    "https://www.careers24.com/rss/jobs/eastern-cape",
                    "https://www.careers24.com/rss/jobs/free-state",
                    "https://www.careers24.com/rss/jobs/mpumalanga",
                    "https://www.careers24.com/rss/jobs/northern-cape",
                    "https://www.careers24.com/rss/jobs/north-west",
                    "https://www.careers24.com/rss/jobs/limpopo"
                ],
                "source_name": "Careers24"
            },
            "jobmail": {
                "feeds": [
                    "https://www.jobmail.co.za/rss/jobs.xml",
                    "https://www.jobmail.co.za/rss/jobs/gauteng.xml",
                    "https://www.jobmail.co.za/rss/jobs/western-cape.xml",
                    "https://www.jobmail.co.za/rss/jobs/kzn.xml"
                ],
                "source_name": "JobMail"
            },
            "pnet": {
                "feeds": [
                    "https://www.pnet.co.za/feeds/jobs.xml",
                    "https://www.pnet.co.za/feeds/jobs/information-technology.xml",
                    "https://www.pnet.co.za/feeds/jobs/finance.xml",
                    "https://www.pnet.co.za/feeds/jobs/engineering.xml"
                ],
                "source_name": "PNet"
            },
            "indeed": {
                "feeds": [
                    "https://za.indeed.com/rss?q=&l=South+Africa",
                    "https://za.indeed.com/rss?q=developer&l=Cape+Town",
                    "https://za.indeed.com/rss?q=engineer&l=Johannesburg",
                    "https://za.indeed.com/rss?q=manager&l=Durban"
                ],
                "source_name": "Indeed SA"
            },
            "government": {
                "feeds": [
                    "https://www.dpsa.gov.za/feeds/vacancies.xml",  # If available
                    "https://www.gov.za/feeds/jobs.xml"  # If available
                ],
                "source_name": "Government"
            }
        }
        
        # Track processed items to avoid duplicates
        self.processed_items = set()
        
        logger.info(f"RSS Parser initialized with {len(self.rss_feeds)} sources")
    
    async def scrape(self, source: str = None, filters: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Parse RSS feeds for job listings.
        This is 100% legal as RSS feeds are meant for syndication.
        """
        results = {
            "jobs": [],
            "companies": set(),
            "timestamp": datetime.utcnow().isoformat(),
            "source": "rss_feeds",
            "legal_status": "100% legal - RSS syndication"
        }
        
        try:
            # Select which feeds to parse
            feeds_to_parse = {}
            if source and source in self.rss_feeds:
                feeds_to_parse = {source: self.rss_feeds[source]}
            else:
                feeds_to_parse = self.rss_feeds
            
            # Parse each feed source
            for feed_source, feed_config in feeds_to_parse.items():
                logger.info(f"Parsing RSS feeds from {feed_config['source_name']}")
                
                for feed_url in feed_config["feeds"]:
                    try:
                        jobs = await self._parse_feed(
                            feed_url, 
                            feed_config["source_name"],
                            filters
                        )
                        results["jobs"].extend(jobs)
                        
                        # Extract unique companies
                        for job in jobs:
                            if job.get("company", {}).get("name"):
                                results["companies"].add(job["company"]["name"])
                        
                        # Small delay between feeds to be respectful
                        await asyncio.sleep(0.5)
                        
                    except Exception as e:
                        logger.error(f"Error parsing feed {feed_url}: {e}")
                        continue
            
            # Convert companies set to list
            results["companies"] = list(results["companies"])
            
            # Deduplicate jobs
            results["jobs"] = self._deduplicate_jobs(results["jobs"])
            
            # Add match scores if filters provided
            if filters:
                for job in results["jobs"]:
                    job["match_score"] = self._calculate_match_score(job, filters)
            
            # Sort by posted date (newest first)
            results["jobs"].sort(
                key=lambda x: x.get("posted_date", ""), 
                reverse=True
            )
            
            # Update metrics
            self.metrics.total_items_scraped += len(results["jobs"])
            
            logger.success(
                f"RSS parsing complete: {len(results['jobs'])} jobs from "
                f"{len(results['companies'])} companies"
            )
            
            return results
            
        except Exception as e:
            logger.error(f"RSS parsing error: {e}")
            raise
    
    async def _parse_feed(
        self, 
        feed_url: str, 
        source_name: str,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Parse individual RSS feed."""
        jobs = []
        
        try:
            # Fetch RSS feed
            async with aiohttp.ClientSession() as session:
                async with session.get(feed_url, timeout=30) as response:
                    if response.status != 200:
                        logger.warning(f"Failed to fetch RSS feed: {feed_url}")
                        return jobs
                    
                    content = await response.text()
            
            # Parse with feedparser
            feed = feedparser.parse(content)
            
            if not feed.entries:
                logger.warning(f"No entries found in feed: {feed_url}")
                return jobs
            
            logger.info(f"Found {len(feed.entries)} entries in {source_name} feed")
            
            # Process each entry
            for entry in feed.entries:
                job = self._parse_feed_entry(entry, source_name, feed_url)
                
                if job:
                    # Check if already processed
                    job_id = job.get("id")
                    if job_id not in self.processed_items:
                        # Apply filters if provided
                        if self._passes_filters(job, filters):
                            jobs.append(job)
                            self.processed_items.add(job_id)
            
            logger.info(f"Extracted {len(jobs)} jobs from {source_name}")
            
        except Exception as e:
            logger.error(f"Error parsing feed {feed_url}: {e}")
        
        return jobs
    
    def _parse_feed_entry(
        self, 
        entry: Any, 
        source_name: str,
        feed_url: str
    ) -> Optional[Dict[str, Any]]:
        """Parse individual RSS feed entry into job format."""
        try:
            # Generate unique ID
            unique_string = f"{entry.get('link', '')}{entry.get('title', '')}"
            job_id = hashlib.md5(unique_string.encode()).hexdigest()
            
            # Extract basic fields
            job = {
                "id": job_id,
                "source": "rss",
                "source_name": source_name,
                "source_url": entry.get("link", ""),
                "title": entry.get("title", ""),
                "description": self._clean_description(
                    entry.get("description", entry.get("summary", ""))
                ),
                "scraped_at": datetime.utcnow().isoformat(),
                "feed_url": feed_url
            }
            
            # Parse published date
            if hasattr(entry, "published_parsed"):
                job["posted_date"] = datetime(*entry.published_parsed[:6]).isoformat()
            elif hasattr(entry, "updated_parsed"):
                job["posted_date"] = datetime(*entry.updated_parsed[:6]).isoformat()
            else:
                job["posted_date"] = datetime.utcnow().isoformat()
            
            # Extract company name (various RSS formats)
            company_name = None
            if hasattr(entry, "author"):
                company_name = entry.author
            elif hasattr(entry, "dc_creator"):
                company_name = entry.dc_creator
            elif "company" in entry:
                company_name = entry.company
            
            # Try to extract from title or description
            if not company_name:
                company_name = self._extract_company_from_text(
                    job["title"], 
                    job["description"]
                )
            
            if company_name:
                job["company"] = {"name": company_name}
            
            # Extract location
            location = None
            if hasattr(entry, "location"):
                location = entry.location
            elif "georss_point" in entry:
                location = "South Africa"  # Has coordinates
            else:
                location = self._extract_location_from_text(
                    job["title"], 
                    job["description"]
                )
            
            if location:
                job["location"] = location
            
            # Extract categories/tags
            categories = []
            if hasattr(entry, "tags"):
                categories = [tag.term for tag in entry.tags]
            elif hasattr(entry, "categories"):
                categories = entry.categories
            
            if categories:
                job["categories"] = categories
                job["job_type"] = self._determine_job_type(categories)
            
            # Extract salary if present
            salary_text = self._extract_salary_text(
                job["title"], 
                job["description"]
            )
            if salary_text:
                salary_info = self.salary_parser.parse(salary_text)
                job.update(salary_info)
            
            # Detect job level
            job["job_level"] = self._detect_job_level(
                job["title"], 
                job["description"]
            )
            
            # Detect remote work
            job["remote_type"] = self._detect_remote_type(
                job["title"], 
                job["description"]
            )
            
            # Extract skills/requirements
            if job["description"]:
                structured = self.text_processor.extract_structured_from_snippet(
                    job["description"]
                )
                job.update(structured)
            
            return job if job["title"] else None
            
        except Exception as e:
            logger.error(f"Error parsing RSS entry: {e}")
            return None
    
    def _clean_description(self, text: str) -> str:
        """Clean HTML and format description text."""
        if not text:
            return ""
        
        # Remove HTML tags
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(text, "html.parser")
        clean_text = soup.get_text()
        
        # Clean up whitespace
        lines = [line.strip() for line in clean_text.split('\n')]
        clean_text = '\n'.join(line for line in lines if line)
        
        return clean_text[:2000]  # Limit length
    
    def _extract_company_from_text(self, title: str, description: str) -> Optional[str]:
        """Extract company name from job text."""
        import re
        
        # Common patterns
        patterns = [
            r"(?:at|@)\s+([A-Z][A-Za-z\s&]+?)(?:\s+is|\s+are|\s+seeks|$)",
            r"([A-Z][A-Za-z\s&]+?)\s+(?:is\s+)?(?:hiring|looking|seeking)",
            r"^([A-Z][A-Za-z\s&]+?)\s*[-–]\s*",
        ]
        
        text = f"{title} {description}"
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                company = match.group(1).strip()
                if 3 < len(company) < 50:
                    return company
        
        return None
    
    def _extract_location_from_text(self, title: str, description: str) -> Optional[str]:
        """Extract location from job text."""
        text = f"{title} {description}".lower()
        
        # South African cities
        sa_locations = [
            "johannesburg", "cape town", "durban", "pretoria", 
            "port elizabeth", "gqeberha", "bloemfontein", "nelspruit",
            "polokwane", "kimberley", "east london", "rustenburg",
            "gauteng", "western cape", "kwazulu-natal", "eastern cape",
            "free state", "limpopo", "mpumalanga", "north west", 
            "northern cape", "south africa", "remote"
        ]
        
        found_locations = []
        for location in sa_locations:
            if location in text:
                found_locations.append(location.title())
        
        if found_locations:
            return ", ".join(found_locations[:2])  # Max 2 locations
        
        return "South Africa"  # Default
    
    def _extract_salary_text(self, title: str, description: str) -> Optional[str]:
        """Extract salary information from text."""
        import re
        
        text = f"{title} {description}"
        
        # Salary patterns
        salary_patterns = [
            r"R\s*\d+[,\d]*(?:\s*k)?(?:\s*-\s*R?\s*\d+[,\d]*(?:\s*k)?)?",
            r"ZAR\s*\d+[,\d]*(?:\s*-\s*\d+[,\d]*)?",
            r"\d+[,\d]*\s*(?:per\s+(?:month|annum|year))",
        ]
        
        for pattern in salary_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(0)
        
        return None
    
    def _determine_job_type(self, categories: List[str]) -> str:
        """Determine job type from categories."""
        categories_lower = [cat.lower() for cat in categories]
        
        if any("full" in cat or "permanent" in cat for cat in categories_lower):
            return "full-time"
        elif any("part" in cat for cat in categories_lower):
            return "part-time"
        elif any("contract" in cat or "temp" in cat for cat in categories_lower):
            return "contract"
        elif any("intern" in cat for cat in categories_lower):
            return "internship"
        
        return "full-time"  # Default
    
    def _detect_job_level(self, title: str, description: str) -> str:
        """Detect job level from text."""
        text = f"{title} {description}".lower()
        
        if any(term in text for term in ["ceo", "cto", "cfo", "chief"]):
            return "c_suite"
        elif any(term in text for term in ["director", "vp", "vice president"]):
            return "director"
        elif any(term in text for term in ["manager", "head of", "lead"]):
            return "manager"
        elif any(term in text for term in ["senior", "sr.", "principal"]):
            return "senior"
        elif any(term in text for term in ["junior", "jr.", "entry", "graduate"]):
            return "entry"
        
        return "mid"
    
    def _detect_remote_type(self, title: str, description: str) -> str:
        """Detect remote work type."""
        text = f"{title} {description}".lower()
        
        if any(term in text for term in ["remote", "work from home", "wfh"]):
            if "hybrid" in text:
                return "hybrid"
            return "remote"
        
        return "onsite"
    
    def _passes_filters(
        self, 
        job: Dict[str, Any], 
        filters: Optional[Dict[str, Any]]
    ) -> bool:
        """Check if job passes the provided filters."""
        if not filters:
            return True
        
        # Keywords filter
        if filters.get("keywords"):
            keywords = [k.lower() for k in filters["keywords"]]
            job_text = f"{job.get('title', '')} {job.get('description', '')}".lower()
            
            if not any(keyword in job_text for keyword in keywords):
                return False
        
        # Location filter
        if filters.get("location"):
            job_location = job.get("location", "").lower()
            filter_location = filters["location"].lower()
            
            if filter_location not in job_location and job.get("remote_type") != "remote":
                return False
        
        # Job level filter
        if filters.get("job_level"):
            if job.get("job_level") != filters["job_level"]:
                return False
        
        # Salary filter
        if filters.get("min_salary"):
            job_min_salary = job.get("salary_min", 0)
            if job_min_salary and job_min_salary < filters["min_salary"]:
                return False
        
        return True
    
    def _deduplicate_jobs(self, jobs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate jobs based on URL and title."""
        seen = set()
        unique_jobs = []
        
        for job in jobs:
            # Create unique key
            key = f"{job.get('source_url', '')}_{job.get('title', '').lower()}"
            
            if key not in seen:
                seen.add(key)
                unique_jobs.append(job)
        
        return unique_jobs
    
    def _calculate_match_score(
        self, 
        job: Dict[str, Any], 
        filters: Dict[str, Any]
    ) -> float:
        """Calculate match score for job against filters."""
        if not filters:
            return 50.0
        
        score = 0.0
        max_score = 0.0
        
        # Keywords (40 points)
        if filters.get("keywords"):
            max_score += 40
            keywords = [k.lower() for k in filters["keywords"]]
            job_text = f"{job.get('title', '')} {job.get('description', '')}".lower()
            
            matches = sum(1 for k in keywords if k in job_text)
            if keywords:
                score += (matches / len(keywords)) * 40
        
        # Location (30 points)
        if filters.get("location"):
            max_score += 30
            if filters["location"].lower() in job.get("location", "").lower():
                score += 30
            elif job.get("remote_type") == "remote":
                score += 20
        
        # Job level (30 points)
        if filters.get("job_level"):
            max_score += 30
            if filters["job_level"] == job.get("job_level"):
                score += 30
        
        # Normalize to 100
        if max_score > 0:
            return round((score / max_score) * 100, 2)
        
        return 50.0
    
    async def get_feed_status(self) -> Dict[str, Any]:
        """Get status of all RSS feeds."""
        status = {
            "total_feeds": sum(len(config["feeds"]) for config in self.rss_feeds.values()),
            "sources": {},
            "last_check": datetime.utcnow().isoformat()
        }
        
        for source, config in self.rss_feeds.items():
            status["sources"][source] = {
                "name": config["source_name"],
                "feed_count": len(config["feeds"]),
                "feeds": config["feeds"]
            }
        
        return status
    
    async def parse_item(self, data: Any) -> Dict[str, Any]:
        """Parse individual item (not used for RSS)."""
        pass
