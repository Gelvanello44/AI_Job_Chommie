"""
Company career page scraper for extracting jobs directly from company websites.
"""

import asyncio
import re
import json
from typing import List, Dict, Any, Optional, Set, Union
from datetime import datetime, timedelta
from urllib.parse import urljoin, urlparse, urlencode
import random

import aiohttp
from bs4 import BeautifulSoup, Tag
from dataclasses import dataclass

from src.models.job_models import Job, JobSearchFilters
from src.config.sentry import capture_scraping_error, add_scraping_breadcrumb
from src.utils.text_processing import clean_text, extract_salary_range, extract_skills


@dataclass
class CompanyScrapingTarget:
    """Company scraping configuration."""
    name: str
    base_url: str
    careers_path: str
    job_selectors: Dict[str, List[str]]  # CSS selectors for different job elements
    api_endpoint: Optional[str] = None
    pagination_pattern: Optional[str] = None
    custom_headers: Optional[Dict[str, str]] = None
    rate_limit: float = 2.0
    requires_js: bool = False


class CompanyScraper:
    """Advanced company career page scraper - NOW POWERED BY SERPAPI DATA."""
    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.request_count = 0
        self.last_request_time = 0
        
        #  SERPAPI INTEGRATION - Real data pipeline
        self.serpapi_scraper = None  # Will be injected by orchestrator
        self.enrichment_mode = True  # Uses SerpAPI job data for company enrichment
        
        # Common user agents
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        ]
        
        # Job deduplication
        self.seen_job_urls: Set[str] = set()
        self.processed_companies: Set[str] = set()
        
        # Predefined company configurations
        self.company_configs = self._get_default_company_configs()
        
        add_scraping_breadcrumb("CompanyScraper initialized - SERPAPI DATA MODE ENABLED")
    
    def _get_default_company_configs(self) -> Dict[str, CompanyScrapingTarget]:
        """Get predefined scraping configurations for major companies."""
        
        return {
            "google": CompanyScrapingTarget(
                name="Google",
                base_url="https://careers.google.com",
                careers_path="/jobs/results",
                job_selectors={
                    "container": [".VfPpkd-dgl2Hf-ppHlrf-sM5MNb", "[data-automation-id='jobPostingItem']"],
                    "title": ["h3", ".VfPpkd-dgl2Hf-ppHlrf-sM5MNb h3"],
                    "location": [".pwO9Dc", "[data-automation-id='location']"],
                    "department": [".wVSTAb", "[data-automation-id='department']"],
                    "link": ["a", "h3 a"]
                },
                rate_limit=3.0
            ),
            
            "microsoft": CompanyScrapingTarget(
                name="Microsoft",
                base_url="https://careers.microsoft.com",
                careers_path="/us/en/search-results",
                job_selectors={
                    "container": [".jobs-list-item", "[data-ph-at-id='job-search-result-item']"],
                    "title": [".job-title", "h3", "[data-ph-at-id='job-search-result-title']"],
                    "location": [".job-location", "[data-ph-at-id='job-search-result-location']"],
                    "department": [".job-category", "[data-ph-at-id='job-search-result-category']"],
                    "link": ["a", ".job-title a"]
                },
                rate_limit=2.5
            ),
            
            "amazon": CompanyScrapingTarget(
                name="Amazon",
                base_url="https://amazon.jobs",
                careers_path="/en/search",
                job_selectors={
                    "container": [".job-tile", "[data-test='job-tile']"],
                    "title": [".job-tile-title", "h3"],
                    "location": [".job-tile-location", "[data-test='job-tile-location']"],
                    "team": [".job-tile-team", "[data-test='job-tile-team']"],
                    "link": ["a", ".job-tile-title a"]
                },
                api_endpoint="/api/jobs",
                rate_limit=4.0
            ),
            
            "meta": CompanyScrapingTarget(
                name="Meta",
                base_url="https://www.metacareers.com",
                careers_path="/jobs",
                job_selectors={
                    "container": ["[data-testid='job-posting-item']", ".job-posting"],
                    "title": ["[data-testid='job-posting-title']", "h2", "h3"],
                    "location": ["[data-testid='job-posting-location']", ".location"],
                    "team": ["[data-testid='job-posting-team']", ".team"],
                    "link": ["a", "h2 a", "h3 a"]
                },
                rate_limit=3.5
            ),
            
            "apple": CompanyScrapingTarget(
                name="Apple",
                base_url="https://jobs.apple.com",
                careers_path="/en-us/search",
                job_selectors={
                    "container": [".table--advanced-search tbody tr", ".job-tile"],
                    "title": [".table-col-1 a", ".job-title"],
                    "location": [".table-col-3", ".job-location"],
                    "team": [".table-col-2", ".job-team"],
                    "link": [".table-col-1 a", "a"]
                },
                rate_limit=2.0
            ),
            
            "netflix": CompanyScrapingTarget(
                name="Netflix",
                base_url="https://jobs.netflix.com",
                careers_path="/search",
                job_selectors={
                    "container": [".job-card", "[data-testid='job-card']"],
                    "title": [".job-card-title", "h3"],
                    "location": [".job-card-location", ".location"],
                    "team": [".job-card-team", ".team"],
                    "link": ["a", ".job-card-title a"]
                },
                rate_limit=3.0
            )
        }
    
    async def _get_session(self, custom_headers: Optional[Dict[str, str]] = None) -> aiohttp.ClientSession:
        """Get or create HTTP session with appropriate headers."""
        if not self.session or self.session.closed:
            headers = {
                "User-Agent": random.choice(self.user_agents),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none"
            }
            
            if custom_headers:
                headers.update(custom_headers)
            
            timeout = aiohttp.ClientTimeout(total=30, connect=10)
            connector = aiohttp.TCPConnector(limit=10, limit_per_host=3)
            
            self.session = aiohttp.ClientSession(
                headers=headers,
                timeout=timeout,
                connector=connector
            )
        
        return self.session
    
    async def _make_request(
        self,
        url: str,
        rate_limit: float = 2.0,
        params: Optional[Dict[str, str]] = None,
        headers: Optional[Dict[str, str]] = None,
        max_retries: int = 3
    ) -> Optional[str]:
        """Make HTTP request with rate limiting and error handling."""
        
        # Rate limiting
        current_time = datetime.now().timestamp()
        if current_time - self.last_request_time < rate_limit:
            await asyncio.sleep(rate_limit - (current_time - self.last_request_time))
        
        session = await self._get_session(headers)
        
        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    delay = random.uniform(2.0, 5.0) * (attempt + 1)
                    await asyncio.sleep(delay)
                
                async with session.get(url, params=params) as response:
                    self.request_count += 1
                    self.last_request_time = current_time
                    
                    if response.status == 200:
                        content = await response.text()
                        add_scraping_breadcrumb(
                            f"Company request successful: {url}",
                            data={"status": response.status, "attempt": attempt + 1}
                        )
                        return content
                    
                    elif response.status in [403, 429]:
                        await asyncio.sleep(random.uniform(10.0, 20.0))
                        continue
                    
                    else:
                        add_scraping_breadcrumb(
                            f"Company request failed: {url}",
                            data={"status": response.status, "attempt": attempt + 1}
                        )
                        continue
            
            except Exception as e:
                capture_scraping_error(
                    e,
                    source="company",
                    url=url,
                    context={"attempt": attempt + 1}
                )
                
                if attempt == max_retries - 1:
                    return None
                
                await asyncio.sleep(random.uniform(5.0, 10.0))
        
        return None
    
    def _extract_jobs_from_html(
        self,
        html_content: str,
        company_config: CompanyScrapingTarget
    ) -> List[Dict[str, Any]]:
        """Extract job listings from HTML content."""
        jobs = []
        
        try:
            soup = BeautifulSoup(html_content, "html.parser")
            
            # Find job containers
            job_containers = []
            for selector in company_config.job_selectors.get("container", []):
                elements = soup.select(selector)
                if elements:
                    job_containers = elements
                    break
            
            for container in job_containers:
                job_data = self._extract_job_from_container(container, company_config)
                if job_data:
                    jobs.append(job_data)
            
            add_scraping_breadcrumb(
                f"Extracted {len(jobs)} jobs from {company_config.name}",
                data={"containers_found": len(job_containers)}
            )
        
        except Exception as e:
            capture_scraping_error(
                e,
                source="company",
                context={"company": company_config.name}
            )
        
        return jobs
    
    def _extract_job_from_container(
        self,
        container: Tag,
        company_config: CompanyScrapingTarget
    ) -> Optional[Dict[str, Any]]:
        """Extract job information from container element."""
        
        try:
            job_data = {"company": company_config.name}
            
            # Extract title
            for selector in company_config.job_selectors.get("title", []):
                title_elem = container.select_one(selector)
                if title_elem:
                    job_data["title"] = clean_text(title_elem.get_text())
                    break
            
            # Extract location
            for selector in company_config.job_selectors.get("location", []):
                location_elem = container.select_one(selector)
                if location_elem:
                    job_data["location"] = clean_text(location_elem.get_text())
                    break
            
            # Extract department/team
            for selector in company_config.job_selectors.get("department", ["team"]):
                dept_elem = container.select_one(selector)
                if dept_elem:
                    job_data["department"] = clean_text(dept_elem.get_text())
                    break
            
            # Extract job URL
            for selector in company_config.job_selectors.get("link", []):
                link_elem = container.select_one(selector)
                if link_elem and link_elem.get("href"):
                    job_data["url"] = urljoin(company_config.base_url, link_elem["href"])
                    break
            
            # Extract description if available
            desc_selectors = [".job-description", ".job-summary", ".description", "p"]
            for selector in desc_selectors:
                desc_elem = container.select_one(selector)
                if desc_elem:
                    job_data["description"] = clean_text(desc_elem.get_text())
                    break
            
            # Extract salary if available
            salary_selectors = [".salary", ".compensation", ".pay"]
            for selector in salary_selectors:
                salary_elem = container.select_one(selector)
                if salary_elem:
                    salary_text = clean_text(salary_elem.get_text())
                    salary_min, salary_max = extract_salary_range(salary_text)
                    if salary_min or salary_max:
                        job_data["salary_min"] = salary_min
                        job_data["salary_max"] = salary_max
                        job_data["salary_text"] = salary_text
                    break
            
            # Detect job characteristics from text
            job_text = f"{job_data.get('title', '')} {job_data.get('description', '')}".lower()
            
            # Job type detection
            if any(term in job_text for term in ["full time", "full-time", "permanent"]):
                job_data["job_type"] = "full-time"
            elif any(term in job_text for term in ["part time", "part-time"]):
                job_data["job_type"] = "part-time"
            elif any(term in job_text for term in ["contract", "contractor", "temp"]):
                job_data["job_type"] = "contract"
            elif any(term in job_text for term in ["intern", "internship"]):
                job_data["job_type"] = "internship"
            else:
                job_data["job_type"] = "full-time"  # Default assumption
            
            # Experience level detection
            if any(term in job_text for term in ["entry level", "junior", "associate", "0-2 years", "new grad"]):
                job_data["experience_level"] = "entry-level"
            elif any(term in job_text for term in ["senior", "lead", "principal", "5+ years", "3-5 years"]):
                job_data["experience_level"] = "senior-level"
            elif any(term in job_text for term in ["manager", "director", "head of", "vp", "vice president"]):
                job_data["experience_level"] = "management"
            else:
                job_data["experience_level"] = "mid-level"
            
            # Remote work detection
            job_data["remote_friendly"] = any(
                term in job_text for term in [
                    "remote", "work from home", "telecommute", "distributed",
                    "anywhere", "home office", "virtual", "hybrid"
                ]
            )
            
            # Extract skills if description is available
            if job_data.get("description"):
                job_data["skills"] = extract_skills(job_data["description"])
            
            # Posted date (usually current for company pages)
            job_data["posted_date"] = datetime.utcnow()
            
            return job_data if job_data.get("title") else None
        
        except Exception as e:
            capture_scraping_error(
                e,
                source="company",
                context={"company": company_config.name}
            )
            return None
    
    async def _extract_from_api(
        self,
        company_config: CompanyScrapingTarget,
        filters: Optional[JobSearchFilters] = None
    ) -> List[Dict[str, Any]]:
        """Extract jobs from company API endpoint."""
        
        if not company_config.api_endpoint:
            return []
        
        try:
            api_url = urljoin(company_config.base_url, company_config.api_endpoint)
            
            # Build API parameters
            params = {}
            if filters:
                if filters.keywords:
                    params["q"] = filters.keywords
                if filters.location:
                    params["location"] = filters.location
                if filters.job_type:
                    params["employment_type"] = filters.job_type
            
            response_text = await self._make_request(
                api_url,
                rate_limit=company_config.rate_limit,
                params=params,
                headers=company_config.custom_headers
            )
            
            if not response_text:
                return []
            
            # Parse JSON response
            try:
                data = json.loads(response_text)
                return self._parse_api_response(data, company_config)
            except json.JSONDecodeError:
                # Response might be HTML
                return self._extract_jobs_from_html(response_text, company_config)
        
        except Exception as e:
            capture_scraping_error(
                e,
                source="company",
                context={"company": company_config.name, "api_endpoint": company_config.api_endpoint}
            )
            return []
    
    def _parse_api_response(
        self,
        data: Dict[str, Any],
        company_config: CompanyScrapingTarget
    ) -> List[Dict[str, Any]]:
        """Parse jobs from API JSON response."""
        
        jobs = []
        
        try:
            # Handle different API response structures
            job_list = []
            
            if isinstance(data, list):
                job_list = data
            elif "jobs" in data:
                job_list = data["jobs"]
            elif "results" in data:
                job_list = data["results"]
            elif "data" in data:
                if isinstance(data["data"], list):
                    job_list = data["data"]
                elif "jobs" in data["data"]:
                    job_list = data["data"]["jobs"]
            
            for job_item in job_list:
                if not isinstance(job_item, dict):
                    continue
                
                job_data = {
                    "company": company_config.name,
                    "source": "company_page"
                }
                
                # Extract common fields with multiple possible keys
                title_keys = ["title", "job_title", "position", "role", "name"]
                for key in title_keys:
                    if key in job_item:
                        job_data["title"] = str(job_item[key])
                        break
                
                location_keys = ["location", "job_location", "city", "office"]
                for key in location_keys:
                    if key in job_item:
                        job_data["location"] = str(job_item[key])
                        break
                
                desc_keys = ["description", "job_description", "summary", "details"]
                for key in desc_keys:
                    if key in job_item:
                        job_data["description"] = clean_text(str(job_item[key]))
                        break
                
                url_keys = ["url", "job_url", "link", "apply_url"]
                for key in url_keys:
                    if key in job_item:
                        job_data["url"] = urljoin(company_config.base_url, str(job_item[key]))
                        break
                
                # Job type
                type_keys = ["employment_type", "job_type", "type"]
                for key in type_keys:
                    if key in job_item:
                        job_data["job_type"] = str(job_item[key]).lower()
                        break
                
                # Department/team
                dept_keys = ["department", "team", "division", "category"]
                for key in dept_keys:
                    if key in job_item:
                        job_data["department"] = str(job_item[key])
                        break
                
                # Salary
                salary_keys = ["salary", "compensation", "pay"]
                for key in salary_keys:
                    if key in job_item:
                        salary_data = job_item[key]
                        if isinstance(salary_data, dict):
                            job_data["salary_min"] = salary_data.get("min")
                            job_data["salary_max"] = salary_data.get("max")
                        elif isinstance(salary_data, str):
                            salary_min, salary_max = extract_salary_range(salary_data)
                            job_data["salary_min"] = salary_min
                            job_data["salary_max"] = salary_max
                        break
                
                # Posted date
                date_keys = ["posted_date", "created_at", "date_posted", "published"]
                for key in date_keys:
                    if key in job_item:
                        try:
                            job_data["posted_date"] = datetime.fromisoformat(
                                str(job_item[key]).replace("Z", "+00:00")
                            )
                        except:
                            job_data["posted_date"] = datetime.utcnow()
                        break
                
                if job_data.get("title"):
                    jobs.append(job_data)
        
        except Exception as e:
            capture_scraping_error(
                e,
                source="company",
                context={"company": company_config.name, "function": "_parse_api_response"}
            )
        
        return jobs
    
    async def scrape_company_jobs(
        self,
        company_name: str,
        filters: Optional[JobSearchFilters] = None,
        max_pages: int = 5
    ) -> List[Job]:
        """Scrape jobs from a specific company's career page."""
        
        all_jobs = []
        
        try:
            # Get company configuration
            company_config = self.company_configs.get(company_name.lower())
            
            if not company_config:
                # Try to create dynamic configuration
                company_config = await self._create_dynamic_config(company_name)
                if not company_config:
                    add_scraping_breadcrumb(
                        f"No configuration found for company: {company_name}"
                    )
                    return []
            
            add_scraping_breadcrumb(
                f"Starting company scraping: {company_config.name}",
                data={"max_pages": max_pages, "has_api": bool(company_config.api_endpoint)}
            )
            
            # Try API first if available
            if company_config.api_endpoint:
                api_jobs = await self._extract_from_api(company_config, filters)
                all_jobs.extend(api_jobs)
            
            # Scrape HTML pages
            for page in range(1, max_pages + 1):
                careers_url = urljoin(company_config.base_url, company_config.careers_path)
                
                # Add pagination parameters
                params = {}
                if filters:
                    if filters.keywords:
                        params["q"] = filters.keywords
                    if filters.location:
                        params["location"] = filters.location
                
                if page > 1:
                    params["page"] = str(page)
                
                html_content = await self._make_request(
                    careers_url,
                    rate_limit=company_config.rate_limit,
                    params=params,
                    headers=company_config.custom_headers
                )
                
                if not html_content:
                    break
                
                page_jobs = self._extract_jobs_from_html(html_content, company_config)
                
                if not page_jobs:
                    break
                
                # Convert to Job objects
                for job_data in page_jobs:
                    try:
                        job_url = job_data.get("url", "")
                        if job_url in self.seen_job_urls:
                            continue
                        
                        job = Job(
                            title=job_data.get("title", ""),
                            company=company_config.name,
                            location=job_data.get("location", ""),
                            description=job_data.get("description", ""),
                            url=job_url,
                            source="company_page",
                            job_type=job_data.get("job_type"),
                            experience_level=job_data.get("experience_level"),
                            salary_min=job_data.get("salary_min"),
                            salary_max=job_data.get("salary_max"),
                            remote_friendly=job_data.get("remote_friendly", False),
                            posted_date=job_data.get("posted_date"),
                            skills=job_data.get("skills", []),
                            metadata={
                                "department": job_data.get("department"),
                                "salary_text": job_data.get("salary_text"),
                                "scraped_at": datetime.utcnow().isoformat(),
                                "scraping_source": "company_direct"
                            }
                        )
                        
                        if job.title:
                            all_jobs.append(job)
                            self.seen_job_urls.add(job_url)
                    
                    except Exception as e:
                        capture_scraping_error(
                            e,
                            source="company",
                            context={"job_data": job_data, "company": company_config.name}
                        )
                        continue
                
                # Rate limiting between pages
                await asyncio.sleep(random.uniform(3.0, 6.0))
        
        except Exception as e:
            capture_scraping_error(
                e,
                source="company",
                context={"company": company_name, "filters": filters.__dict__ if filters else None}
            )
        
        finally:
            if self.session and not self.session.closed:
                await self.session.close()
        
        add_scraping_breadcrumb(
            f"Company scraping completed: {company_name}",
            data={
                "total_jobs": len(all_jobs),
                "total_requests": self.request_count
            }
        )
        
        return all_jobs
    
    async def _create_dynamic_config(self, company_name: str) -> Optional[CompanyScrapingTarget]:
        """Attempt to create dynamic configuration for unknown company."""
        
        try:
            # Common career page patterns
            career_patterns = [
                "/careers",
                "/jobs",
                "/career",
                "/opportunities",
                "/join-us",
                "/work-with-us"
            ]
            
            # Try to find company website
            company_domain = await self._find_company_domain(company_name)
            if not company_domain:
                return None
            
            # Test career page endpoints
            for pattern in career_patterns:
                test_url = f"https://{company_domain}{pattern}"
                
                html_content = await self._make_request(test_url, rate_limit=2.0)
                if html_content and self._looks_like_career_page(html_content):
                    # Create basic configuration
                    return CompanyScrapingTarget(
                        name=company_name,
                        base_url=f"https://{company_domain}",
                        careers_path=pattern,
                        job_selectors={
                            "container": [".job", ".position", ".opening", ".career-item"],
                            "title": ["h1", "h2", "h3", ".title", ".job-title"],
                            "location": [".location", ".job-location", ".city"],
                            "department": [".department", ".team", ".category"],
                            "link": ["a"]
                        },
                        rate_limit=2.0
                    )
            
            return None
        
        except Exception as e:
            capture_scraping_error(
                e,
                source="company",
                context={"company": company_name, "function": "_create_dynamic_config"}
            )
            return None
    
    async def _find_company_domain(self, company_name: str) -> Optional[str]:
        """Attempt to find company domain from name."""
        
        # Simple heuristic - try common patterns
        domain_candidates = [
            f"{company_name.lower().replace(' ', '')}.com",
            f"{company_name.lower().replace(' ', '-')}.com",
            f"{company_name.lower().split()[0]}.com"
        ]
        
        for domain in domain_candidates:
            try:
                test_url = f"https://{domain}"
                html_content = await self._make_request(test_url, rate_limit=1.0)
                
                if html_content and company_name.lower() in html_content.lower():
                    return domain
            except:
                continue
        
        return None
    
    def _looks_like_career_page(self, html_content: str) -> bool:
        """Check if HTML content looks like a career/jobs page."""
        
        content_lower = html_content.lower()
        
        career_indicators = [
            "job", "career", "position", "opening", "opportunity",
            "hiring", "employment", "work with us", "join our team"
        ]
        
        job_indicators = [
            "software engineer", "developer", "manager", "analyst",
            "apply now", "view job", "job details"
        ]
        
        career_score = sum(1 for indicator in career_indicators if indicator in content_lower)
        job_score = sum(1 for indicator in job_indicators if indicator in content_lower)
        
        return career_score >= 2 and job_score >= 1
    
    async def get_job_details(
        self,
        job_url: str,
        company_config: Optional[CompanyScrapingTarget] = None
    ) -> Optional[Dict[str, Any]]:
        """Get detailed job information from job URL."""
        
        try:
            html_content = await self._make_request(job_url)
            
            if not html_content:
                return None
            
            soup = BeautifulSoup(html_content, "html.parser")
            job_details = {}
            
            # Full description
            desc_selectors = [
                ".job-description", ".job-details", ".position-description",
                ".role-description", "[data-testid='job-description']",
                "#job-description", ".description"
            ]
            
            for selector in desc_selectors:
                desc_elem = soup.select_one(selector)
                if desc_elem:
                    job_details["full_description"] = clean_text(desc_elem.get_text())
                    break
            
            # Requirements
            req_selectors = [
                ".requirements", ".qualifications", ".job-requirements",
                ".position-requirements", "[data-testid='requirements']"
            ]
            
            for selector in req_selectors:
                req_elem = soup.select_one(selector)
                if req_elem:
                    requirements = []
                    req_items = req_elem.find_all(["li", "p", "div"])
                    for item in req_items:
                        req_text = clean_text(item.get_text())
                        if req_text and len(req_text.split()) > 2:
                            requirements.append(req_text)
                    job_details["requirements"] = requirements
                    break
            
            # Benefits
            benefits_selectors = [
                ".benefits", ".perks", ".job-benefits",
                "[data-testid='benefits']", ".compensation-benefits"
            ]
            
            for selector in benefits_selectors:
                benefits_elem = soup.select_one(selector)
                if benefits_elem:
                    benefits = []
                    benefit_items = benefits_elem.find_all(["li", "p", "div"])
                    for item in benefit_items:
                        benefit_text = clean_text(item.get_text())
                        if benefit_text and len(benefit_text.split()) > 1:
                            benefits.append(benefit_text)
                    job_details["benefits"] = benefits
                    break
            
            # Company information
            company_selectors = [
                ".company-info", ".about-company", ".employer-info"
            ]
            
            for selector in company_selectors:
                company_elem = soup.select_one(selector)
                if company_elem:
                    job_details["company_description"] = clean_text(company_elem.get_text())
                    break
            
            add_scraping_breadcrumb(
                f"Retrieved company job details: {job_url}",
                data={"fields_extracted": len(job_details)}
            )
            
            return job_details
        
        except Exception as e:
            capture_scraping_error(
                e,
                source="company",
                url=job_url,
                context={"function": "get_job_details"}
            )
            return None
    
    def add_company_config(self, config: CompanyScrapingTarget):
        """Add new company scraping configuration."""
        self.company_configs[config.name.lower()] = config
        add_scraping_breadcrumb(
            f"Added company configuration: {config.name}",
            data={"base_url": config.base_url}
        )
    
    def get_supported_companies(self) -> List[str]:
        """Get list of supported companies."""
        return [config.name for config in self.company_configs.values()]
    
    #  NEW SERPAPI INTEGRATION METHODS
    
    def set_serpapi_scraper(self, serpapi_scraper):
        """Inject SerpAPI scraper for data pipeline integration."""
        self.serpapi_scraper = serpapi_scraper
        add_scraping_breadcrumb("SerpAPI scraper injected into CompanyScraper")
    
    async def enrich_with_serpapi_data(self, filters: Optional[JobSearchFilters] = None) -> Dict[str, Any]:
        """Use SerpAPI data to identify and enrich company information."""
        
        if not self.serpapi_scraper:
            add_scraping_breadcrumb("Warning: No SerpAPI scraper available for enrichment")
            return {"jobs": [], "companies": []}
        
        try:
            # Get job data from SerpAPI that contains company names
            serpapi_results = await self.serpapi_scraper.scrape(
                source="comprehensive_sa",
                filters=filters or {}
            )
            
            jobs = serpapi_results.get("jobs", [])
            companies_to_enrich = set()
            enriched_jobs = []
            
            # Extract unique company names from SerpAPI results
            for job in jobs:
                company_name = job.get("company", {}).get("name", "")
                if company_name:
                    companies_to_enrich.add(company_name.strip())
                    enriched_jobs.append(job)
            
            add_scraping_breadcrumb(
                f"Extracted {len(companies_to_enrich)} unique companies from SerpAPI data",
                data={"total_jobs": len(jobs), "unique_companies": len(companies_to_enrich)}
            )
            
            # Enrich each company with additional data
            enriched_companies = []
            for company_name in list(companies_to_enrich)[:20]:  # Limit to prevent rate limiting
                if company_name.lower() not in self.processed_companies:
                    company_data = await self._enrich_company_data(company_name, enriched_jobs)
                    if company_data:
                        enriched_companies.append(company_data)
                        self.processed_companies.add(company_name.lower())
            
            # Enhance job data with company enrichment
            for job in enriched_jobs:
                company_name = job.get("company", {}).get("name", "")
                for company_data in enriched_companies:
                    if company_data.get("name", "").lower() == company_name.lower():
                        job["company"]["enriched"] = True
                        job["company"]["website"] = company_data.get("website")
                        job["company"]["size"] = company_data.get("size")
                        job["company"]["industry"] = company_data.get("industry")
                        job["company"]["description"] = company_data.get("description")
                        break
            
            return {
                "jobs": enriched_jobs,
                "companies": enriched_companies,
                "metadata": {
                    "enrichment_source": "serpapi",
                    "companies_processed": len(enriched_companies),
                    "jobs_enriched": len(enriched_jobs),
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
            
        except Exception as e:
            capture_scraping_error(
                e,
                source="company",
                context={"function": "enrich_with_serpapi_data", "filters": filters}
            )
            return {"jobs": [], "companies": []}
    
    async def _enrich_company_data(self, company_name: str, jobs: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Enrich company data using job information and web scraping."""
        
        try:
            company_data = {
                "name": company_name,
                "jobs_found": 0,
                "locations": set(),
                "departments": set(),
                "job_types": set(),
                "salary_ranges": [],
                "remote_friendly": False
            }
            
            # Analyze jobs from this company
            company_jobs = [job for job in jobs if job.get("company", {}).get("name", "").lower() == company_name.lower()]
            company_data["jobs_found"] = len(company_jobs)
            
            for job in company_jobs:
                # Location analysis
                location = job.get("location", "")
                if location:
                    company_data["locations"].add(location)
                
                # Department analysis
                title = job.get("title", "").lower()
                if "engineer" in title or "developer" in title:
                    company_data["departments"].add("Engineering")
                elif "sales" in title or "business development" in title:
                    company_data["departments"].add("Sales")
                elif "marketing" in title:
                    company_data["departments"].add("Marketing")
                elif "finance" in title or "accounting" in title:
                    company_data["departments"].add("Finance")
                elif "hr" in title or "human resources" in title:
                    company_data["departments"].add("Human Resources")
                
                # Job type analysis
                job_type = job.get("job_type", "")
                if job_type:
                    company_data["job_types"].add(job_type)
                
                # Remote work analysis
                if job.get("remote_friendly") or "remote" in job.get("location", "").lower():
                    company_data["remote_friendly"] = True
                
                # Salary analysis
                salary_min = job.get("salary_min")
                salary_max = job.get("salary_max")
                if salary_min or salary_max:
                    company_data["salary_ranges"].append({
                        "min": salary_min,
                        "max": salary_max,
                        "currency": "ZAR"  # South African market
                    })
            
            # Convert sets to lists for JSON serialization
            company_data["locations"] = list(company_data["locations"])
            company_data["departments"] = list(company_data["departments"])
            company_data["job_types"] = list(company_data["job_types"])
            
            # Try to get additional company information
            company_website = await self._find_company_domain(company_name)
            if company_website:
                company_data["website"] = f"https://{company_website}"
                
                # Try to scrape company size/industry from about page
                about_data = await self._scrape_company_about_page(company_website)
                if about_data:
                    company_data.update(about_data)
            
            # Determine company size based on job count and locations
            job_count = company_data["jobs_found"]
            location_count = len(company_data["locations"])
            
            if job_count > 50 or location_count > 5:
                company_data["size"] = "Large (1000+)"
            elif job_count > 20 or location_count > 2:
                company_data["size"] = "Medium (100-1000)"
            elif job_count > 5:
                company_data["size"] = "Small (10-100)"
            else:
                company_data["size"] = "Startup (1-10)"
            
            add_scraping_breadcrumb(
                f"Enriched company data: {company_name}",
                data={
                    "jobs_found": job_count,
                    "locations": len(company_data["locations"]),
                    "departments": len(company_data["departments"])
                }
            )
            
            return company_data
            
        except Exception as e:
            capture_scraping_error(
                e,
                source="company",
                context={"company": company_name, "function": "_enrich_company_data"}
            )
            return None
    
    async def _scrape_company_about_page(self, company_domain: str) -> Optional[Dict[str, Any]]:
        """Scrape basic company information from about page."""
        
        about_paths = ["/about", "/about-us", "/company", "/our-company"]
        
        for path in about_paths:
            try:
                about_url = f"https://{company_domain}{path}"
                html_content = await self._make_request(about_url, rate_limit=2.0)
                
                if html_content:
                    soup = BeautifulSoup(html_content, "html.parser")
                    about_data = {}
                    
                    # Extract description
                    desc_selectors = [
                        "meta[name='description']", ".company-description", 
                        ".about-text", "p", ".intro-text"
                    ]
                    
                    for selector in desc_selectors:
                        desc_elem = soup.select_one(selector)
                        if desc_elem:
                            if desc_elem.name == "meta":
                                description = desc_elem.get("content", "")
                            else:
                                description = clean_text(desc_elem.get_text())
                            
                            if description and len(description.split()) > 10:
                                about_data["description"] = description[:500]  # Truncate
                                break
                    
                    # Try to extract industry from text
                    content_text = soup.get_text().lower()
                    industries = {
                        "technology": ["software", "tech", "digital", "saas", "platform"],
                        "finance": ["bank", "financial", "fintech", "insurance"],
                        "retail": ["retail", "ecommerce", "shopping", "consumer"],
                        "healthcare": ["health", "medical", "pharmaceutical", "biotech"],
                        "consulting": ["consulting", "advisory", "professional services"],
                        "manufacturing": ["manufacturing", "industrial", "production"]
                    }
                    
                    for industry, keywords in industries.items():
                        if any(keyword in content_text for keyword in keywords):
                            about_data["industry"] = industry.title()
                            break
                    
                    if about_data:
                        return about_data
            
            except Exception as e:
                continue
        
        return None
    
    async def scrape(self, url: str = None, filters: Dict[str, Any] = None) -> Dict[str, Any]:
        """Main scraping method - now integrates SerpAPI data pipeline."""
        
        try:
            #  PRIMARY MODE: Use SerpAPI data for company enrichment
            if self.enrichment_mode and self.serpapi_scraper:
                add_scraping_breadcrumb("Using SerpAPI data pipeline for company enrichment")
                return await self.enrich_with_serpapi_data(filters)
            
            # Legacy mode: Direct company scraping (fallback)
            add_scraping_breadcrumb("Using legacy direct company scraping mode")
            
            if url:
                # Extract company name from URL
                parsed_url = urlparse(url)
                company_name = parsed_url.netloc.split('.')[0] if parsed_url.netloc else "unknown"
                
                jobs = await self.scrape_company_jobs(company_name, filters)
                return {
                    "jobs": [job.__dict__ for job in jobs],
                    "companies": [{"name": company_name, "jobs_found": len(jobs)}],
                    "metadata": {
                        "source": "direct_scraping",
                        "timestamp": datetime.utcnow().isoformat()
                    }
                }
            
            else:
                # No URL provided - return empty results
                return {"jobs": [], "companies": []}
                
        except Exception as e:
            capture_scraping_error(
                e,
                source="company",
                context={"url": url, "filters": filters}
            )
            return {"jobs": [], "companies": []}
    
    async def close(self):
        """Clean up resources."""
        if self.session and not self.session.closed:
            await self.session.close()
        
        add_scraping_breadcrumb("CompanyScraper session closed")
