"""
SerpAPI scraper for search result augmentation and fallback scraping.
Provides robust search capabilities when direct scraping is blocked.
"""

import asyncio
import hashlib
import os
from typing import Dict, List, Any, Optional
from datetime import datetime
import aiohttp
from loguru import logger

from src.scrapers.base_scraper import BaseScraper
from src.config.settings import settings
from src.utils.text_processor import TextProcessor
from src.utils.salary_parser import SalaryParser


class SerpAPIScraper(BaseScraper):
    """SerpAPI scraper with critical quota management for free tier."""
    
    def __init__(self):
        super().__init__(
            name="serpapi",
            use_browser=False,
            use_proxy=False,
            max_retries=1  # Reduced retries to preserve quota
        )
        
        self.api_key = os.getenv('SERPAPI_API_KEY', '')
        self.base_url = "https://serpapi.com/search"
        
        self.text_processor = TextProcessor()
        self.salary_parser = SalaryParser()
        
        #  CRITICAL QUOTA MANAGEMENT
        self.monthly_quota = settings.serpapi_monthly_quota  # 250
        self.used_quota = settings.serpapi_used_quota  # 16
        self.remaining_quota = settings.serpapi_remaining_quota  # 234
        
        #  DYNAMIC MONTHLY QUOTA MANAGEMENT
        self._check_and_handle_month_transition()
        
        self.daily_limit = self._calculate_dynamic_daily_limit()
        self.hourly_limit = max(1, int(self.daily_limit / 24))  # Dynamic hourly based on daily
        
        # Tracking with quota protection
        self.api_calls = 0
        self.daily_calls = 0
        self.hourly_calls = 0
        self.last_call_time = None
        self.last_hour_reset = datetime.utcnow().hour
        self.last_day_reset = datetime.utcnow().date()
        self.scraped_jobs = set()
        
        # High-value search mode for free tier
        self.free_tier_mode = settings.serpapi_free_tier_mode
        self.high_value_only = settings.serpapi_high_value_queries_only
        
        logger.critical(f"SerpAPI QUOTA STATUS: {self.remaining_quota}/{self.monthly_quota} searches remaining")
        logger.critical(f"DAILY LIMIT: {self.daily_limit} searches/day, HOURLY LIMIT: {self.hourly_limit} searches/hour")
    
    async def scrape(self, source: str = None, filters: Dict[str, Any] = None) -> Dict[str, Any]:
        """Scrape job listings using SerpAPI."""
        if not self.api_key:
            raise ValueError("SerpAPI key not configured")
        
        results = {
            "jobs": [],
            "companies": [],
            "timestamp": datetime.utcnow().isoformat(),
            "api_calls": 0
        }
        
        try:
            # Build search queries based on source and filters
            queries = self._build_search_queries(source, filters)
            
            # Execute searches
            for query in queries:
                try:
                    search_results = await self._search_jobs(query)
                    results["jobs"].extend(search_results["jobs"])
                    results["companies"].extend(search_results.get("companies", []))
                    results["api_calls"] += 1
                    
                except Exception as e:
                    logger.error(f"SerpAPI search error for query '{query}': {e}")
            
            # Deduplicate results
            results["jobs"] = self._deduplicate_jobs(results["jobs"])
            
            # Enrich results with additional data
            for job in results["jobs"]:
                job["source_augmented"] = "serpapi"
                job["match_score"] = self._calculate_basic_match_score(job, filters)
            
            # Update metrics
            self.metrics.total_items_scraped += len(results["jobs"])
            self.api_calls += results["api_calls"]
            
            # Sync quota to settings after scraping session
            self.sync_quota_to_settings()
            
            # Log final quota status
            quota_status = self.get_quota_status()
            logger.critical(f"SerpAPI SESSION COMPLETE: {quota_status['remaining_quota']} searches remaining")
            
            if quota_status['remaining_quota'] <= 10:
                logger.critical(" SerpAPI quota running low - consider reducing search frequency")
            
            return results
            
        except Exception as e:
            logger.error(f"SerpAPI scraping error: {e}")
            raise
    
    def _build_search_queries(self, source: str, filters: Dict[str, Any]) -> List[str]:
        """Build search queries for comprehensive SA job market coverage."""
        queries = []
        
        # Base query from keywords
        base_query = ""
        if filters and filters.get("keywords"):
            base_query = " ".join(filters["keywords"])
        
        # Location with SA context
        location = filters.get("location", "South Africa")
        
        # COMPREHENSIVE SA JOB MARKET QUERIES
        if source == "comprehensive_sa":
            # Major SA job boards
            major_sa_sites = [
                "site:pnet.co.za", "site:careers24.com", "site:jobmail.co.za",
                "site:bizcommunity.com/careers", "site:itcareers.co.za"
            ]
            for site in major_sa_sites:
                queries.append(f"{site} {base_query} {location}")
            
            # Government jobs
            gov_sites = [
                "site:dpsa.gov.za", "site:gov.za", "site:treasury.gov.za"
            ]
            for site in gov_sites:
                queries.append(f"{site} vacancies {base_query}")
            
            # Entry-level focus queries
            entry_level_terms = [
                "entry level", "no experience", "trainee", "cashier", "general worker",
                "packer", "cleaner", "security guard", "shop assistant"
            ]
            for term in entry_level_terms[:3]:  # Limit to top 3
                queries.append(f'"{term}" jobs {location} {base_query}')
            
            # Major employers (retail/food service)
            major_employers = [
                "Shoprite", "Pick n Pay", "Checkers", "KFC", "McDonald's",
                "Game", "Makro", "Woolworths", "Steers", "Nandos"
            ]
            for employer in major_employers[:5]:  # Top 5 employers
                queries.append(f'{employer} jobs {location} {base_query}')
            
            # Industry-specific searches
            if base_query:
                industries = [
                    "retail", "hospitality", "security", "manufacturing", "mining",
                    "healthcare", "education", "finance", "IT", "logistics"
                ]
                for industry in industries[:3]:  # Top 3 relevant industries
                    queries.append(f'{industry} {base_query} jobs {location}')
        
        # Enhanced source-specific queries
        elif source == "linkedin":
            queries.extend([
                f"site:linkedin.com/jobs {base_query} {location}",
                f"site:linkedin.com/in {base_query} hiring {location}",
                f"site:linkedin.com {base_query} South Africa jobs"
            ])
        elif source == "indeed":
            queries.extend([
                f"site:indeed.com {base_query} {location}",
                f"site:za.indeed.com {base_query} {location}",
                f"site:indeed.co.za {base_query} {location}"
            ])
        elif source == "glassdoor":
            queries.extend([
                f"site:glassdoor.com {base_query} {location}",
                f"site:glassdoor.co.za {base_query} {location}"
            ])
        else:
            # Enhanced general job search with SA focus
            sa_job_terms = ["jobs", "careers", "vacancies", "positions", "opportunities"]
            for term in sa_job_terms[:3]:
                queries.append(f"{base_query} {term} {location}")
        
        # Add date filtering for fresh jobs
        date_queries = []
        for query in queries[:5]:  # Apply to first 5 queries
            date_queries.append(f"{query} (yesterday OR today OR 'posted today')")
        queries.extend(date_queries)
        
        # Executive-level enhancements
        if filters and filters.get("job_level") in ["executive", "director", "c_suite"]:
            exec_queries = [
                f"executive search {base_query} {location} confidential",
                f"C-level {base_query} {location} South Africa",
                f"director {base_query} {location} headhunter",
                f"senior management {base_query} {location}"
            ]
            queries.extend(exec_queries)
        
        # Entry-level specific enhancements
        if filters and filters.get("job_level") == "entry":
            entry_queries = [
                f"no experience required {base_query} {location}",
                f"entry level {base_query} {location} will train",
                f"graduate programme {base_query} {location}",
                f"trainee {base_query} {location}"
            ]
            queries.extend(entry_queries)
        
        # Hidden job market
        if filters and filters.get("include_hidden_market"):
            hidden_queries = [
                f"executive search {base_query} {location}",
                f"retained search {location} {base_query}",
                f"confidential {base_query} {location} opportunity",
                f"headhunter {base_query} {location}"
            ]
            queries.extend(hidden_queries)
        
        # Smart query limitation based on API budget
        if source == "comprehensive_sa":
            # For SA comprehensive search, use carefully selected high-impact queries
            return queries[:3]  # Top 3 most effective queries per search
        else:
            # For other sources, use moderate query count
            return queries[:5]  # Standard query count
    
    async def _search_jobs(self, query: str) -> Dict[str, Any]:
        """Execute a single search query with strict quota management."""
        results = {"jobs": [], "companies": []}
        
        #  CRITICAL QUOTA MANAGEMENT
        # Check if we've hit our limits
        current_time = datetime.utcnow()
        
        # Reset hourly tracking if needed
        if current_time.hour != self.last_hour_reset:
            self.hourly_calls = 0
            self.last_hour_reset = current_time.hour
            logger.info(f"Reset hourly SerpAPI quota tracking: {self.hourly_calls}/{self.hourly_limit}")
        
        # Reset daily tracking if needed
        if current_time.date() != self.last_day_reset:
            self.daily_calls = 0
            self.last_day_reset = current_time.date()
            logger.info(f"Reset daily SerpAPI quota tracking: {self.daily_calls}/{self.daily_limit}")
        
        # STRICT QUOTA ENFORCEMENT
        if self.remaining_quota <= 0:
            logger.critical(" SerpAPI MONTHLY QUOTA EXHAUSTED - search refused")
            return results
        elif self.daily_calls >= self.daily_limit:
            logger.critical(f" SerpAPI DAILY LIMIT REACHED ({self.daily_limit}) - search refused")
            return results
        elif self.hourly_calls >= self.hourly_limit:
            logger.critical(f" SerpAPI HOURLY LIMIT REACHED ({self.hourly_limit}) - search refused")
            return results
        
        # Check if query is high-value in free tier mode
        if self.free_tier_mode and self.high_value_only:
            if not self._is_high_value_query(query):
                logger.warning(f"Low-value query skipped to preserve quota: {query}")
                return results
        
        # Google Jobs search
        params = {
            "api_key": self.api_key,
            "engine": "google_jobs",
            "q": query,
            "location": "South Africa",
            "hl": "en",
            "gl": "za",
            "num": 100  # Max results per query
        }
        
        # Perform the API call
        async with aiohttp.ClientSession() as session:
            async with session.get(self.base_url, params=params) as response:
                if response.status != 200:
                    raise Exception(f"SerpAPI error: {response.status}")
                
                data = await response.json()
                
                #  INCREMENT QUOTA COUNTERS (critical tracking)
                self.api_calls += 1
                self.daily_calls += 1
                self.hourly_calls += 1
                self.remaining_quota -= 1
                self.used_quota += 1
                self.last_call_time = current_time
                
                logger.critical(f"SerpAPI QUOTA UPDATE: {self.remaining_quota} searches remaining (used {self.used_quota}/{self.monthly_quota})")
                logger.critical(f"DAILY: {self.daily_calls}/{self.daily_limit}, HOURLY: {self.hourly_calls}/{self.hourly_limit}")
                
                # Extract job listings
                if "jobs_results" in data:
                    for job_data in data["jobs_results"]:
                        job = self._parse_job_result(job_data)
                        if job and job["id"] not in self.scraped_jobs:
                            self.scraped_jobs.add(job["id"])
                            results["jobs"].append(job)
                
                # Also try regular Google search for additional results
                # (Only if we're not at risk of quota exhaustion)
                if self.remaining_quota > 5:  # Keep 5-search buffer
                    await self._search_regular_results(session, query, results)
                else:
                    logger.warning(f"Skipping regular search to preserve quota: {self.remaining_quota} remaining")
        
        return results
    
    async def _search_regular_results(self, session: aiohttp.ClientSession, query: str, results: Dict[str, Any]):
        """Search regular Google results for job postings."""
        
        # Check quota again before regular search
        if self.remaining_quota <= 0:
            logger.warning("Skipping regular search - no quota remaining")
            return
        
        params = {
            "api_key": self.api_key,
            "engine": "google",
            "q": query,
            "location": "South Africa",
            "hl": "en",
            "gl": "za",
            "num": 50
        }
        
        try:
            async with session.get(self.base_url, params=params) as response:
                if response.status != 200:
                    return
                
                data = await response.json()
                
                #  INCREMENT QUOTA COUNTERS for regular search too
                self.api_calls += 1
                self.daily_calls += 1
                self.hourly_calls += 1
                self.remaining_quota -= 1
                self.used_quota += 1
                
                logger.critical(f"SerpAPI REGULAR SEARCH: {self.remaining_quota} searches remaining")
                
                # Extract job-related links
                if "organic_results" in data:
                    for result in data["organic_results"]:
                        if self._is_job_listing(result):
                            job = self._parse_organic_result(result)
                            if job and job["id"] not in self.scraped_jobs:
                                self.scraped_jobs.add(job["id"])
                                results["jobs"].append(job)
                        
                        # Extract company information
                        if self._is_company_page(result):
                            company = self._parse_company_result(result)
                            if company:
                                results["companies"].append(company)
        
        except Exception as e:
            logger.debug(f"Regular search failed: {e}")
    
    def _parse_job_result(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse job result from Google Jobs API."""
        try:
            # Generate ID from title and company
            job_id = hashlib.md5(
                f"{data.get('title', '')}{data.get('company_name', '')}".encode()
            ).hexdigest()
            
            job = {
                "id": job_id,
                "source": "serpapi",
                "source_url": data.get("job_link", data.get("link")),
                "title": data.get("title"),
                "company": {
                    "name": data.get("company_name")
                },
                "location": self._normalize_location(data.get("location")),
                "description": data.get("description", ""),
                "scraped_at": datetime.utcnow().isoformat()
            }
            
            # Extract additional details
            if data.get("detected_extensions"):
                extensions = data["detected_extensions"]
                
                # Job type
                if "schedule_type" in extensions:
                    job["job_type"] = self._normalize_job_type(extensions["schedule_type"])
                
                # Posted date
                if "posted_at" in extensions:
                    job["posted_date"] = self._parse_posted_date(extensions["posted_at"])
                
                # Salary
                if "salary" in extensions:
                    salary_info = self.salary_parser.parse(extensions["salary"])
                    job.update(salary_info)
            
            # Job level detection
            job["job_level"] = self._detect_job_level(job["title"], job["description"])
            
            # Remote detection
            job["remote_type"] = self._detect_remote_type(job["title"], job["description"])
            
            # Executive detection
            job["is_executive"] = job["job_level"] in ["executive", "director", "c_suite"]
            
            # Extract requirements and skills
            if job["description"]:
                structured = self.text_processor.extract_structured_from_snippet(job["description"])
                job.update(structured)
            
            return job
            
        except Exception as e:
            logger.error(f"Error parsing job result: {e}")
            return None
    
    def _parse_organic_result(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse job from organic search result."""
        try:
            # Generate ID from URL
            job_id = hashlib.md5(data.get("link", "").encode()).hexdigest()
            
            job = {
                "id": job_id,
                "source": "serpapi_organic",
                "source_url": data.get("link"),
                "title": self._extract_job_title(data.get("title", "")),
                "description": data.get("snippet", ""),
                "scraped_at": datetime.utcnow().isoformat()
            }
            
            # Extract company from domain or title
            domain = data.get("displayed_link", "")
            if "linkedin.com" in domain:
                job["platform"] = "linkedin"
            elif "indeed.com" in domain:
                job["platform"] = "indeed"
            elif "glassdoor" in domain:
                job["platform"] = "glassdoor"
            
            # Try to extract company name
            company_name = self._extract_company_from_snippet(data.get("snippet", ""))
            if company_name:
                job["company"] = {"name": company_name}
            
            # Detect job level
            job["job_level"] = self._detect_job_level(job["title"], job["description"])
            
            return job
            
        except Exception as e:
            logger.error(f"Error parsing organic result: {e}")
            return None
    
    def _parse_company_result(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse company information from search result."""
        try:
            company = {
                "name": self._extract_company_name(data.get("title", "")),
                "website": data.get("link"),
                "description": data.get("snippet", ""),
                "extracted_at": datetime.utcnow().isoformat()
            }
            
            # Extract industry from snippet
            if "snippet" in data:
                industry = self._extract_industry(data["snippet"])
                if industry:
                    company["industry"] = industry
            
            return company
            
        except Exception:
            return None
    
    def _is_job_listing(self, result: Dict[str, Any]) -> bool:
        """Check if search result is a job listing."""
        indicators = [
            "job", "career", "vacancy", "position", "hiring",
            "opportunity", "opening", "recruitment"
        ]
        
        title = result.get("title", "").lower()
        snippet = result.get("snippet", "").lower()
        link = result.get("link", "").lower()
        
        # Check title and snippet
        if any(indicator in title or indicator in snippet for indicator in indicators):
            return True
        
        # Check if from job platform
        job_domains = ["linkedin.com/jobs", "indeed.com", "glassdoor", "careers", "jobs"]
        if any(domain in link for domain in job_domains):
            return True
        
        return False
    
    def _is_company_page(self, result: Dict[str, Any]) -> bool:
        """Check if search result is a company page."""
        link = result.get("link", "").lower()
        
        company_indicators = [
            "linkedin.com/company",
            "about", "about-us",
            "company", "corporate"
        ]
        
        return any(indicator in link for indicator in company_indicators)
    
    def _normalize_location(self, location: str) -> str:
        """Normalize location string."""
        if not location:
            return "South Africa"
        
        # Clean up location
        location = location.strip()
        
        # Add South Africa if not present
        if "south africa" not in location.lower() and "za" not in location.lower():
            location = f"{location}, South Africa"
        
        return location
    
    def _normalize_job_type(self, job_type: str) -> str:
        """Normalize job type string."""
        job_type_lower = job_type.lower()
        
        if "full" in job_type_lower:
            return "full-time"
        elif "part" in job_type_lower:
            return "part-time"
        elif "contract" in job_type_lower:
            return "contract"
        elif "intern" in job_type_lower:
            return "internship"
        elif "temp" in job_type_lower:
            return "temporary"
        
        return job_type
    
    def _detect_job_level(self, title: str, description: str) -> str:
        """Detect job level from title and description."""
        text = f"{title} {description}".lower()
        
        # C-Suite
        if any(term in text for term in ["ceo", "cto", "cfo", "coo", "cmo", "chief"]):
            return "c_suite"
        
        # Executive
        elif any(term in text for term in ["executive", "president", "vp"]):
            return "executive"
        
        # Director
        elif "director" in text:
            return "director"
        
        # Manager
        elif any(term in text for term in ["manager", "head of", "lead"]):
            return "manager"
        
        # Senior
        elif any(term in text for term in ["senior", "sr.", "principal"]):
            return "senior"
        
        # Entry
        elif any(term in text for term in ["junior", "jr.", "entry", "graduate"]):
            return "entry"
        
        # Default to mid
        return "mid"
    
    def _detect_remote_type(self, title: str, description: str) -> str:
        """Detect remote work type."""
        text = f"{title} {description}".lower()
        
        if any(term in text for term in ["remote", "work from home", "wfh", "anywhere"]):
            if "hybrid" in text:
                return "hybrid"
            return "remote"
        
        return "onsite"
    
    def _extract_job_title(self, title: str) -> str:
        """Extract clean job title from search result title."""
        # Remove common suffixes
        suffixes = [
            " - LinkedIn", " - Indeed", " - Glassdoor",
            " | LinkedIn", " | Indeed", " | Glassdoor",
            " hiring now", " apply now"
        ]
        
        for suffix in suffixes:
            if suffix in title:
                title = title.replace(suffix, "")
        
        return title.strip()
    
    def _extract_company_from_snippet(self, snippet: str) -> Optional[str]:
        """Try to extract company name from snippet."""
        # Common patterns
        patterns = [
            r"at ([A-Z][A-Za-z\s&]+)",
            r"by ([A-Z][A-Za-z\s&]+)",
            r"([A-Z][A-Za-z\s&]+) is hiring",
            r"([A-Z][A-Za-z\s&]+) seeks"
        ]
        
        import re
        for pattern in patterns:
            match = re.search(pattern, snippet)
            if match:
                company = match.group(1).strip()
                # Clean up
                if len(company) > 3 and len(company) < 50:
                    return company
        
        return None
    
    def _extract_company_name(self, title: str) -> str:
        """Extract company name from title."""
        # Remove common suffixes
        suffixes = [
            " - Company Profile", " | LinkedIn",
            " - About Us", " - Careers"
        ]
        
        for suffix in suffixes:
            if suffix in title:
                title = title.replace(suffix, "")
        
        return title.strip()
    
    def _extract_industry(self, text: str) -> Optional[str]:
        """Extract industry from text."""
        industries = [
            "Technology", "Finance", "Healthcare", "Retail",
            "Manufacturing", "Education", "Consulting",
            "Real Estate", "Marketing", "Legal"
        ]
        
        text_lower = text.lower()
        for industry in industries:
            if industry.lower() in text_lower:
                return industry
        
        return None
    
    def _parse_posted_date(self, posted_text: str) -> str:
        """Parse posted date from text."""
        # SerpAPI usually provides relative dates
        return self.text_processor.parse_relative_date(posted_text)
    
    def _deduplicate_jobs(self, jobs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate jobs based on title and company."""
        seen = set()
        unique_jobs = []
        
        for job in jobs:
            # Create unique key
            key = f"{job.get('title', '').lower()}_{job.get('company', {}).get('name', '').lower()}"
            
            if key not in seen:
                seen.add(key)
                unique_jobs.append(job)
        
        return unique_jobs
    
    def _calculate_basic_match_score(self, job: Dict[str, Any], filters: Dict[str, Any]) -> float:
        """Calculate basic match score for job."""
        if not filters:
            return 50.0
        
        score = 0.0
        
        # Keyword match (40%)
        if filters.get("keywords") and job.get("title"):
            keywords = [k.lower() for k in filters["keywords"]]
            title_lower = job["title"].lower()
            desc_lower = job.get("description", "").lower()
            
            matches = sum(1 for k in keywords if k in title_lower or k in desc_lower)
            if keywords:
                score += (matches / len(keywords)) * 40
        
        # Location match (30%)
        if filters.get("location") and job.get("location"):
            if filters["location"].lower() in job["location"].lower():
                score += 30
            elif job.get("remote_type") == "remote":
                score += 20
        
        # Job level match (30%)
        if filters.get("job_level") and job.get("job_level"):
            if filters["job_level"] == job["job_level"]:
                score += 30
            elif self._is_adjacent_level(filters["job_level"], job["job_level"]):
                score += 15
        
        return round(score, 2)
    
    def _is_adjacent_level(self, level1: str, level2: str) -> bool:
        """Check if job levels are adjacent."""
        levels = ["entry", "mid", "senior", "manager", "director", "executive", "c_suite"]
        
        try:
            idx1 = levels.index(level1)
            idx2 = levels.index(level2)
            return abs(idx1 - idx2) == 1
        except ValueError:
            return False
    
    def _is_high_value_query(self, query: str) -> bool:
        """Determine if a query is high-value for free tier conservation."""
        query_lower = query.lower()
        
        # High-value indicators
        high_value_signals = [
            # Major job boards
            "site:pnet.co.za", "site:careers24.com", "site:jobmail.co.za",
            "site:linkedin.com/jobs", "site:indeed.co.za",
            
            # Fresh job indicators
            "posted today", "yesterday", "new",
            
            # Executive/high-paying roles
            "executive", "director", "manager", "c-level", "senior",
            
            # Major employers
            "shoprite", "pick n pay", "checkers", "woolworths", "standard bank", 
            "fnb", "absa", "nedbank", "sanlam", "discovery", "mtv", "dstv",
            
            # High-demand sectors
            "software engineer", "data scientist", "developer", "nurse", "doctor",
            "accountant", "engineer", "teacher", "pilot", "lawyer"
        ]
        
        # Check for high-value signals
        value_score = sum(1 for signal in high_value_signals if signal in query_lower)
        
        # Minimum threshold for high-value
        return value_score >= 1
    
    def get_quota_status(self) -> Dict[str, Any]:
        """Get current quota status for monitoring."""
        return {
            "monthly_quota": self.monthly_quota,
            "used_quota": self.used_quota,
            "remaining_quota": self.remaining_quota,
            "daily_limit": self.daily_limit,
            "daily_calls": self.daily_calls,
            "hourly_limit": self.hourly_limit,
            "hourly_calls": self.hourly_calls,
            "last_call_time": self.last_call_time,
            "free_tier_mode": self.free_tier_mode,
            "high_value_only": self.high_value_only
        }
    
    def sync_quota_to_settings(self):
        """Sync current quota usage back to settings for persistence."""
        try:
            # Update settings with current usage
            settings.serpapi_used_quota = self.used_quota
            settings.serpapi_remaining_quota = self.remaining_quota
            
            logger.info(f"Synced SerpAPI quota to settings: {self.used_quota} used, {self.remaining_quota} remaining")
            
        except Exception as e:
            logger.error(f"Failed to sync quota to settings: {e}")
    
    def _check_and_handle_month_transition(self):
        """Check for month transition and reset quota if new month detected."""
        current_date = datetime.utcnow()
        current_month = current_date.month
        current_year = current_date.year
        
        # Check if settings has last reset tracking
        last_reset_month = getattr(settings, 'serpapi_last_reset_month', None)
        last_reset_year = getattr(settings, 'serpapi_last_reset_year', None)
        
        # Initialize if first run
        if last_reset_month is None:
            settings.serpapi_last_reset_month = current_month
            settings.serpapi_last_reset_year = current_year
            logger.info(f"Initialized SerpAPI quota tracking for {current_month}/{current_year}")
            return
        
        # Check if we've moved to a new month
        month_changed = (current_month != last_reset_month) or (current_year != last_reset_year)
        
        if month_changed:
            logger.critical(f" MONTH TRANSITION DETECTED: {last_reset_month}/{last_reset_year} → {current_month}/{current_year}")
            
            # Reset quota for new month
            self.used_quota = 0
            self.remaining_quota = self.monthly_quota  # Fresh 250 searches
            self.daily_calls = 0
            self.hourly_calls = 0
            
            # Update settings with new month
            settings.serpapi_used_quota = 0
            settings.serpapi_remaining_quota = self.monthly_quota
            settings.serpapi_last_reset_month = current_month
            settings.serpapi_last_reset_year = current_year
            
            # Recalculate daily limit for new month
            new_daily_limit = self._calculate_dynamic_daily_limit()
            settings.serpapi_daily_limit = new_daily_limit
            
            logger.critical(f" SerpAPI QUOTA RESET FOR NEW MONTH:")
            logger.critical(f"   - Fresh quota: {self.remaining_quota} searches")
            logger.critical(f"   - New daily limit: {new_daily_limit} searches/day")
            logger.critical(f"   - Month: {self._get_month_name(current_month)} ({self._get_days_in_current_month()} days)")
    
    def _calculate_dynamic_daily_limit(self) -> int:
        """Calculate dynamic daily limit based on days remaining in current month."""
        current_date = datetime.utcnow()
        
        # Get days remaining in current month (including today)
        days_in_month = self._get_days_in_current_month()
        current_day = current_date.day
        days_remaining = days_in_month - current_day + 1
        
        # Calculate optimal daily limit
        daily_budget = self.remaining_quota / max(1, days_remaining)
        
        # Apply safety buffer (use only 90% of calculated budget)
        safe_daily_limit = int(daily_budget * 0.9)
        
        # Ensure minimum of 1 search per day
        safe_daily_limit = max(1, safe_daily_limit)
        
        # Special handling for September 2025 (your specific requirement)
        if current_date.year == 2025 and current_date.month == 9:
            # September has 30 days, 250 searches = 8.33/day
            september_limit = max(8, safe_daily_limit)
            logger.critical(f" SEPTEMBER 2025 SPECIAL LIMIT: {september_limit} searches/day (30 days, 250 quota)")
            return september_limit
        
        logger.info(f" Dynamic daily limit calculated: {safe_daily_limit} searches/day ({days_remaining} days remaining)")
        return safe_daily_limit
    
    def _get_days_in_current_month(self) -> int:
        """Get number of days in current month."""
        import calendar
        current_date = datetime.utcnow()
        return calendar.monthrange(current_date.year, current_date.month)[1]
    
    def _get_month_name(self, month_num: int) -> str:
        """Get month name from month number."""
        months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]
        return months[month_num - 1] if 1 <= month_num <= 12 else "Unknown"
    
    def reset_quota_if_new_month(self):
        """Legacy method - now handled by _check_and_handle_month_transition."""
        logger.info("Using new dynamic month transition handling")
        self._check_and_handle_month_transition()
    
    async def parse_item(self, data: Any) -> Dict[str, Any]:
        """Parse individual item (not used for API-based scraping)."""
        pass
