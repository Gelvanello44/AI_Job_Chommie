"""
Advanced Glassdoor scraper for job listings with anti-detection features.
"""

import asyncio
import re
import json
from typing import List, Dict, Any, Optional, Set
from datetime import datetime, timedelta
from urllib.parse import urlencode, urlparse, parse_qs
import random

import aiohttp
from bs4 import BeautifulSoup
from dataclasses import dataclass

from src.models.job_models import Job, JobSearchFilters
from src.config.sentry import capture_scraping_error, add_scraping_breadcrumb
from src.utils.text_processing import clean_text, extract_salary_range, extract_skills


@dataclass
class GlassdoorSearchParams:
    """Glassdoor search parameters."""
    what: str = ""
    where: str = ""
    radius: int = 25
    job_type: Optional[str] = None
    experience_level: Optional[str] = None
    company: Optional[str] = None
    salary_min: Optional[int] = None
    easy_apply: bool = False
    sort: str = "relevance"  # relevance, date, salary_high, salary_low
    page: int = 1
    
    def to_url_params(self) -> Dict[str, str]:
        """Convert to URL parameters for Glassdoor."""
        params = {
            "keyword": self.what,
            "locT": "C",
            "locId": "1147401",  # Default to US
            "radius": str(self.radius),
            "p": str(self.page)
        }
        
        if self.where:
            params["locKeyword"] = self.where
        
        if self.job_type:
            type_mapping = {
                "full-time": "1",
                "part-time": "2", 
                "contract": "3",
                "internship": "4"
            }
            if self.job_type in type_mapping:
                params["jobType"] = type_mapping[self.job_type]
        
        if self.experience_level:
            exp_mapping = {
                "entry-level": "1",
                "mid-level": "2",
                "senior-level": "3",
                "director": "4",
                "executive": "5"
            }
            if self.experience_level in exp_mapping:
                params["seniorityType"] = exp_mapping[self.experience_level]
        
        if self.salary_min:
            params["minSalary"] = str(self.salary_min)
        
        if self.easy_apply:
            params["ea"] = "1"
        
        if self.sort != "relevance":
            sort_mapping = {
                "date": "date_desc",
                "salary_high": "salary_desc",
                "salary_low": "salary_asc"
            }
            if self.sort in sort_mapping:
                params["sort"] = sort_mapping[self.sort]
        
        return params


class GlassdoorScraper:
    """Advanced Glassdoor job scraper with anti-detection."""
    
    def __init__(self):
        self.base_url = "https://www.glassdoor.com"
        self.search_url = f"{self.base_url}/Job/jobs.htm"
        self.api_url = f"{self.base_url}/findJobsApi/getJobs.json"
        
        # Anti-detection setup
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        ]
        
        # Request tracking
        self.request_count = 0
        self.last_request_time = 0
        self.rate_limit_delay = 2.0  # Base delay between requests
        
        # Session management
        self.session: Optional[aiohttp.ClientSession] = None
        self.session_cookies = {}
        
        # Job deduplication
        self.seen_job_urls: Set[str] = set()
        
        add_scraping_breadcrumb("GlassdoorScraper initialized")
    
    async def _get_session(self) -> aiohttp.ClientSession:
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
                "Sec-Fetch-Site": "none",
                "Cache-Control": "max-age=0"
            }
            
            timeout = aiohttp.ClientTimeout(total=30, connect=10)
            connector = aiohttp.TCPConnector(limit=10, limit_per_host=3)
            
            self.session = aiohttp.ClientSession(
                headers=headers,
                timeout=timeout,
                connector=connector,
                cookies=self.session_cookies
            )
        
        return self.session
    
    async def _make_request(
        self,
        url: str,
        params: Optional[Dict[str, str]] = None,
        max_retries: int = 3
    ) -> Optional[str]:
        """Make HTTP request with rate limiting and error handling."""
        
        # Rate limiting
        current_time = datetime.now().timestamp()
        if current_time - self.last_request_time < self.rate_limit_delay:
            await asyncio.sleep(self.rate_limit_delay - (current_time - self.last_request_time))
        
        session = await self._get_session()
        
        for attempt in range(max_retries):
            try:
                # Random delay to appear more human
                if attempt > 0:
                    delay = random.uniform(2.0, 5.0) * (attempt + 1)
                    await asyncio.sleep(delay)
                
                # Update headers for each request
                session.headers.update({
                    "User-Agent": random.choice(self.user_agents),
                    "X-Requested-With": "XMLHttpRequest" if "/api/" in url else None
                })
                
                async with session.get(url, params=params) as response:
                    self.request_count += 1
                    self.last_request_time = current_time
                    
                    if response.status == 200:
                        content = await response.text()
                        
                        # Update session cookies
                        for cookie in response.cookies:
                            self.session_cookies[cookie.key] = cookie.value
                        
                        add_scraping_breadcrumb(
                            f"Glassdoor request successful: {url}",
                            data={"status": response.status, "attempt": attempt + 1}
                        )
                        
                        return content
                    
                    elif response.status == 403:
                        add_scraping_breadcrumb(
                            f"Glassdoor blocked request: {url}",
                            data={"status": response.status, "attempt": attempt + 1}
                        )
                        # Longer delay for rate limiting
                        await asyncio.sleep(random.uniform(10.0, 20.0))
                        continue
                    
                    elif response.status == 429:
                        # Rate limited
                        retry_after = int(response.headers.get("Retry-After", 60))
                        add_scraping_breadcrumb(
                            f"Glassdoor rate limited, waiting {retry_after}s",
                            data={"status": response.status, "retry_after": retry_after}
                        )
                        await asyncio.sleep(retry_after)
                        continue
                    
                    else:
                        add_scraping_breadcrumb(
                            f"Glassdoor request failed: {url}",
                            data={"status": response.status, "attempt": attempt + 1}
                        )
                        continue
            
            except Exception as e:
                capture_scraping_error(
                    e,
                    source="glassdoor",
                    url=url,
                    context={"attempt": attempt + 1, "params": params}
                )
                
                if attempt == max_retries - 1:
                    return None
                
                await asyncio.sleep(random.uniform(5.0, 10.0))
        
        return None
    
    def _parse_job_listings(self, html_content: str) -> List[Dict[str, Any]]:
        """Parse job listings from Glassdoor HTML."""
        jobs = []
        
        try:
            soup = BeautifulSoup(html_content, "html.parser")
            
            # Find job cards - Glassdoor uses multiple possible selectors
            job_cards = soup.find_all([
                {"class": re.compile(r"jobContainer|job-search-card|jobResult")},
                {"data-test": "job-result"}
            ])
            
            if not job_cards:
                # Try alternative selector patterns
                job_cards = soup.find_all("li", {"class": re.compile(r"react-job-listing")})
            
            if not job_cards:
                # Try finding job data in script tags (JSON)
                script_tags = soup.find_all("script", type="application/ld+json")
                for script in script_tags:
                    try:
                        data = json.loads(script.text)
                        if isinstance(data, dict) and "jobLocation" in str(data):
                            jobs.extend(self._parse_json_job_data(data))
                    except:
                        continue
            
            for card in job_cards:
                job_data = self._extract_job_from_card(card)
                if job_data:
                    jobs.append(job_data)
            
            add_scraping_breadcrumb(
                f"Parsed {len(jobs)} jobs from Glassdoor HTML",
                data={"total_cards": len(job_cards)}
            )
        
        except Exception as e:
            capture_scraping_error(
                e,
                source="glassdoor",
                context={"function": "_parse_job_listings"}
            )
        
        return jobs
    
    def _extract_job_from_card(self, card) -> Optional[Dict[str, Any]]:
        """Extract job information from a job card element."""
        try:
            job_data = {}
            
            # Job title
            title_elem = card.find([
                {"data-test": "job-title"},
                {"class": re.compile(r"jobTitle|job-title")},
                "a"
            ])
            
            if title_elem:
                job_data["title"] = clean_text(title_elem.get_text())
                # Get job URL
                if title_elem.get("href"):
                    job_data["url"] = self._build_absolute_url(title_elem["href"])
            
            # Company name
            company_elem = card.find([
                {"data-test": "employer-name"},
                {"class": re.compile(r"employerName|employer-name|company")},
                "span"
            ])
            
            if company_elem:
                job_data["company"] = clean_text(company_elem.get_text())
            
            # Location
            location_elem = card.find([
                {"data-test": "job-location"},
                {"class": re.compile(r"location|jobLocation")},
                "div"
            ])
            
            if location_elem:
                job_data["location"] = clean_text(location_elem.get_text())
            
            # Salary
            salary_elem = card.find([
                {"data-test": "salary-estimate"},
                {"class": re.compile(r"salary|salaryText|estimated-salary")},
                "span"
            ])
            
            if salary_elem:
                salary_text = clean_text(salary_elem.get_text())
                salary_min, salary_max = extract_salary_range(salary_text)
                if salary_min or salary_max:
                    job_data["salary_min"] = salary_min
                    job_data["salary_max"] = salary_max
                    job_data["salary_text"] = salary_text
            
            # Job description/summary
            desc_elem = card.find([
                {"data-test": "job-desc"},
                {"class": re.compile(r"jobDesc|job-summary|description")},
                "div"
            ])
            
            if desc_elem:
                job_data["description"] = clean_text(desc_elem.get_text())
            
            # Posted date
            date_elem = card.find([
                {"data-test": "job-age"},
                {"class": re.compile(r"posted|jobAge|date")},
                "span"
            ])
            
            if date_elem:
                date_text = clean_text(date_elem.get_text())
                job_data["posted_date"] = self._parse_posted_date(date_text)
            
            # Job type and experience level from description or attributes
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
            
            # Experience level detection
            if any(term in job_text for term in ["entry level", "junior", "associate", "0-2 years"]):
                job_data["experience_level"] = "entry-level"
            elif any(term in job_text for term in ["senior", "lead", "principal", "5+ years", "3-5 years"]):
                job_data["experience_level"] = "senior-level"
            elif any(term in job_text for term in ["manager", "director", "head of"]):
                job_data["experience_level"] = "management"
            else:
                job_data["experience_level"] = "mid-level"
            
            # Remote work detection
            job_data["remote_friendly"] = any(
                term in job_text for term in [
                    "remote", "work from home", "telecommute", "distributed",
                    "anywhere", "home office", "virtual"
                ]
            )
            
            # Extract skills
            if job_data.get("description"):
                job_data["skills"] = extract_skills(job_data["description"])
            
            # Glassdoor-specific fields
            rating_elem = card.find({"class": re.compile(r"rating|companyRating")})
            if rating_elem:
                try:
                    job_data["company_rating"] = float(rating_elem.get_text().strip())
                except:
                    pass
            
            # Easy apply detection
            easy_apply_elem = card.find([
                {"data-test": "easy-apply"},
                {"class": re.compile(r"easyApply|easy-apply")}
            ])
            job_data["easy_apply"] = easy_apply_elem is not None
            
            # Return job data if we have minimum required fields
            if job_data.get("title") and job_data.get("company"):
                return job_data
            
            return None
        
        except Exception as e:
            capture_scraping_error(
                e,
                source="glassdoor",
                context={"function": "_extract_job_from_card"}
            )
            return None
    
    def _parse_json_job_data(self, json_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse job data from JSON-LD structured data."""
        jobs = []
        
        try:
            # Handle different JSON-LD structures
            if isinstance(json_data, list):
                job_postings = json_data
            elif json_data.get("@type") == "JobPosting":
                job_postings = [json_data]
            elif "jobPosting" in json_data:
                job_postings = json_data["jobPosting"]
                if not isinstance(job_postings, list):
                    job_postings = [job_postings]
            else:
                return jobs
            
            for posting in job_postings:
                if not isinstance(posting, dict):
                    continue
                
                job_data = {}
                
                # Basic job information
                job_data["title"] = posting.get("title", "")
                job_data["description"] = clean_text(posting.get("description", ""))
                
                # Company information
                org = posting.get("hiringOrganization", {})
                if isinstance(org, dict):
                    job_data["company"] = org.get("name", "")
                
                # Location
                location = posting.get("jobLocation", {})
                if isinstance(location, dict):
                    address = location.get("address", {})
                    if isinstance(address, dict):
                        city = address.get("addressLocality", "")
                        state = address.get("addressRegion", "")
                        job_data["location"] = f"{city}, {state}".strip(", ")
                
                # Salary
                salary = posting.get("baseSalary", {})
                if isinstance(salary, dict):
                    salary_value = salary.get("value", {})
                    if isinstance(salary_value, dict):
                        job_data["salary_min"] = salary_value.get("minValue")
                        job_data["salary_max"] = salary_value.get("maxValue")
                
                # Employment type
                emp_type = posting.get("employmentType", "")
                if emp_type:
                    type_mapping = {
                        "FULL_TIME": "full-time",
                        "PART_TIME": "part-time",
                        "CONTRACT": "contract",
                        "INTERN": "internship"
                    }
                    job_data["job_type"] = type_mapping.get(emp_type, emp_type.lower())
                
                # Posted date
                posted_date = posting.get("datePosted")
                if posted_date:
                    try:
                        job_data["posted_date"] = datetime.fromisoformat(posted_date.replace("Z", "+00:00"))
                    except:
                        pass
                
                # Job URL
                url = posting.get("url")
                if url:
                    job_data["url"] = self._build_absolute_url(url)
                
                if job_data.get("title") and job_data.get("company"):
                    jobs.append(job_data)
        
        except Exception as e:
            capture_scraping_error(
                e,
                source="glassdoor",
                context={"function": "_parse_json_job_data"}
            )
        
        return jobs
    
    def _build_absolute_url(self, relative_url: str) -> str:
        """Build absolute URL for job posting."""
        if relative_url.startswith("http"):
            return relative_url
        
        if relative_url.startswith("/"):
            return f"{self.base_url}{relative_url}"
        
        return f"{self.base_url}/{relative_url}"
    
    def _parse_posted_date(self, date_text: str) -> Optional[datetime]:
        """Parse posted date from text."""
        try:
            date_text = date_text.lower().strip()
            now = datetime.now()
            
            if "today" in date_text or "just posted" in date_text:
                return now
            elif "yesterday" in date_text:
                return now - timedelta(days=1)
            elif "hour" in date_text:
                hours = re.search(r"(\d+)\s*hour", date_text)
                if hours:
                    return now - timedelta(hours=int(hours.group(1)))
            elif "day" in date_text:
                days = re.search(r"(\d+)\s*day", date_text)
                if days:
                    return now - timedelta(days=int(days.group(1)))
            elif "week" in date_text:
                weeks = re.search(r"(\d+)\s*week", date_text)
                if weeks:
                    return now - timedelta(weeks=int(weeks.group(1)))
            elif "month" in date_text:
                months = re.search(r"(\d+)\s*month", date_text)
                if months:
                    return now - timedelta(days=int(months.group(1)) * 30)
            
            return None
        
        except Exception:
            return None
    
    async def search_jobs(
        self,
        filters: JobSearchFilters,
        max_pages: int = 3,
        jobs_per_page: int = 50
    ) -> List[Job]:
        """Search for jobs on Glassdoor."""
        
        all_jobs = []
        
        try:
            # Convert filters to Glassdoor search parameters
            search_params = GlassdoorSearchParams(
                what=filters.keywords or "",
                where=filters.location or "",
                job_type=filters.job_type,
                experience_level=filters.experience_level,
                company=filters.company,
                salary_min=filters.min_salary,
                sort="date" if filters.sort_by == "date" else "relevance"
            )
            
            add_scraping_breadcrumb(
                "Starting Glassdoor job search",
                data={
                    "keywords": filters.keywords,
                    "location": filters.location,
                    "max_pages": max_pages
                }
            )
            
            for page in range(1, max_pages + 1):
                search_params.page = page
                
                # Build search URL
                url_params = search_params.to_url_params()
                search_url = f"{self.search_url}?{urlencode(url_params)}"
                
                # Make request
                html_content = await self._make_request(search_url)
                
                if not html_content:
                    add_scraping_breadcrumb(
                        f"Failed to get Glassdoor page {page}",
                        data={"url": search_url}
                    )
                    break
                
                # Parse jobs from page
                page_jobs = self._parse_job_listings(html_content)
                
                if not page_jobs:
                    add_scraping_breadcrumb(
                        f"No jobs found on Glassdoor page {page}",
                        data={"url": search_url}
                    )
                    break
                
                # Convert to Job objects and deduplicate
                for job_data in page_jobs:
                    try:
                        job_url = job_data.get("url", "")
                        if job_url in self.seen_job_urls:
                            continue
                        
                        job = Job(
                            title=job_data.get("title", ""),
                            company=job_data.get("company", ""),
                            location=job_data.get("location", ""),
                            description=job_data.get("description", ""),
                            url=job_url,
                            source="glassdoor",
                            job_type=job_data.get("job_type"),
                            experience_level=job_data.get("experience_level"),
                            salary_min=job_data.get("salary_min"),
                            salary_max=job_data.get("salary_max"),
                            remote_friendly=job_data.get("remote_friendly", False),
                            posted_date=job_data.get("posted_date"),
                            skills=job_data.get("skills", []),
                            metadata={
                                "company_rating": job_data.get("company_rating"),
                                "easy_apply": job_data.get("easy_apply", False),
                                "salary_text": job_data.get("salary_text"),
                                "scraped_at": datetime.utcnow().isoformat()
                            }
                        )
                        
                        if job.title and job.company:  # Basic validation
                            all_jobs.append(job)
                            self.seen_job_urls.add(job_url)
                    
                    except Exception as e:
                        capture_scraping_error(
                            e,
                            source="glassdoor",
                            context={"job_data": job_data}
                        )
                        continue
                
                add_scraping_breadcrumb(
                    f"Glassdoor page {page} completed",
                    data={
                        "page_jobs": len(page_jobs),
                        "total_jobs": len(all_jobs),
                        "url": search_url
                    }
                )
                
                # Rate limiting between pages
                await asyncio.sleep(random.uniform(3.0, 6.0))
        
        except Exception as e:
            capture_scraping_error(
                e,
                source="glassdoor",
                context={"filters": filters.__dict__}
            )
        
        finally:
            # Clean up session
            if self.session and not self.session.closed:
                await self.session.close()
        
        add_scraping_breadcrumb(
            f"Glassdoor search completed: {len(all_jobs)} jobs found",
            data={
                "total_requests": self.request_count,
                "unique_jobs": len(all_jobs)
            }
        )
        
        return all_jobs
    
    async def get_job_details(self, job_url: str) -> Optional[Dict[str, Any]]:
        """Get detailed job information from job URL."""
        
        try:
            html_content = await self._make_request(job_url)
            
            if not html_content:
                return None
            
            soup = BeautifulSoup(html_content, "html.parser")
            
            job_details = {}
            
            # Full job description
            desc_elem = soup.find([
                {"class": re.compile(r"jobDescriptionContent|job-description")},
                {"data-test": "jobDescription"}
            ])
            
            if desc_elem:
                job_details["full_description"] = clean_text(desc_elem.get_text())
            
            # Company details
            company_info = soup.find({"class": re.compile(r"employerInfo|company-info")})
            if company_info:
                # Company size
                size_elem = company_info.find(text=re.compile(r"\d+\s*-\s*\d+\s*employees"))
                if size_elem:
                    job_details["company_size"] = size_elem.strip()
                
                # Industry
                industry_elem = company_info.find({"class": re.compile(r"industry")})
                if industry_elem:
                    job_details["industry"] = clean_text(industry_elem.get_text())
            
            # Additional job metadata
            metadata_section = soup.find({"class": re.compile(r"jobMetadata|job-meta")})
            if metadata_section:
                # Job ID
                job_id_elem = metadata_section.find(text=re.compile(r"Job ID"))
                if job_id_elem:
                    job_details["external_id"] = job_id_elem.split(":")[-1].strip()
            
            # Benefits
            benefits_section = soup.find([
                {"class": re.compile(r"benefits")},
                {"data-test": "benefits"}
            ])
            
            if benefits_section:
                benefits = []
                benefit_items = benefits_section.find_all(["li", "div", "span"])
                for item in benefit_items:
                    benefit_text = clean_text(item.get_text())
                    if benefit_text and len(benefit_text) < 100:
                        benefits.append(benefit_text)
                job_details["benefits"] = benefits
            
            # Requirements/qualifications
            requirements_section = soup.find([
                {"class": re.compile(r"requirements|qualifications")},
                {"data-test": "requirements"}
            ])
            
            if requirements_section:
                requirements = []
                req_items = requirements_section.find_all(["li", "p"])
                for item in req_items:
                    req_text = clean_text(item.get_text())
                    if req_text:
                        requirements.append(req_text)
                job_details["requirements"] = requirements
            
            add_scraping_breadcrumb(
                f"Retrieved Glassdoor job details: {job_url}",
                data={"fields_extracted": len(job_details)}
            )
            
            return job_details
        
        except Exception as e:
            capture_scraping_error(
                e,
                source="glassdoor",
                url=job_url,
                context={"function": "get_job_details"}
            )
            return None
    
    async def close(self):
        """Clean up resources."""
        if self.session and not self.session.closed:
            await self.session.close()
        
        add_scraping_breadcrumb("GlassdoorScraper session closed")
