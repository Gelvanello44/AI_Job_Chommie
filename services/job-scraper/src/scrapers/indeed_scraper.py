"""
Indeed scraper implementation with advanced anti-detection and data extraction.
"""

import asyncio
import re
from typing import Dict, List, Any, Optional, AsyncGenerator
from datetime import datetime, timedelta
import json
from urllib.parse import urljoin, urlparse, parse_qs
from bs4 import BeautifulSoup

from src.scrapers.base_scraper import BaseScraper
from src.config.sentry import capture_scraping_error, add_scraping_breadcrumb, SentryScrapingContext
from src.models.job_models import Job


class IndeedScraper(BaseScraper):
    """Advanced Indeed scraper with anti-detection and intelligent parsing."""
    
    def __init__(self):
        super().__init__()
        self.base_url = "https://www.indeed.com"
        self.search_url = "https://www.indeed.com/jobs"
        
        # Indeed-specific configuration
        self.results_per_page = 15  # Indeed's default
        self.max_pages_per_search = 20
        
        # Selectors for job data extraction
        self.selectors = {
            "job_cards": '[data-testid="job-tile"]',
            "job_title": '[data-testid="job-title"] a, h2.jobTitle a',
            "company": '[data-testid="company-name"] a, .companyName a',
            "location": '[data-testid="job-location"]',
            "salary": '.salary-snippet, [data-testid="job-salary"]',
            "summary": '[data-testid="job-snippet"], .job-snippet',
            "job_link": '[data-testid="job-title"] a, h2.jobTitle a',
            "posted_date": '[data-testid="job-posted-date"], .date',
            "job_type": '.jobMetadata .jobsearch-JobMetadataHeader-item'
        }
        
        # Keywords for filtering and categorization
        self.experience_keywords = {
            'entry': ['entry level', 'junior', 'graduate', 'intern', 'trainee'],
            'mid': ['mid level', 'experienced', '2-5 years', '3-7 years'],
            'senior': ['senior', 'lead', 'principal', '5+ years', '7+ years'],
            'executive': ['director', 'manager', 'head of', 'vp', 'chief']
        }
        
        self.job_type_keywords = {
            'full_time': ['full time', 'full-time', 'permanent'],
            'part_time': ['part time', 'part-time'],
            'contract': ['contract', 'contractor', 'freelance'],
            'temporary': ['temporary', 'temp'],
            'remote': ['remote', 'work from home', 'telecommute']
        }
    
    async def search_jobs(
        self,
        query: str = "",
        location: str = "",
        job_type: Optional[str] = None,
        experience_level: Optional[str] = None,
        max_results: int = 100,
        **kwargs
    ) -> AsyncGenerator[Job, None]:
        """
        Search for jobs on Indeed with advanced filtering.
        
        Args:
            query: Job search query/keywords
            location: Job location (city, state, etc.)
            job_type: Type of job (full_time, part_time, contract, etc.)
            experience_level: Experience level (entry, mid, senior, executive)
            max_results: Maximum number of jobs to return
            **kwargs: Additional search parameters
        
        Yields:
            Job objects with parsed data
        """
        
        with SentryScrapingContext(self.search_url, "indeed"):
            add_scraping_breadcrumb(
                "Starting Indeed job search",
                data={"query": query, "location": location, "max_results": max_results}
            )
            
            try:
                search_params = await self._build_search_params(
                    query, location, job_type, experience_level, **kwargs
                )
                
                page = 0
                jobs_found = 0
                max_pages = min(self.max_pages_per_search, (max_results // self.results_per_page) + 1)
                
                while page < max_pages and jobs_found < max_results:
                    search_params['start'] = page * self.results_per_page
                    
                    # Get search results page
                    soup = await self._get_search_page(search_params)
                    if not soup:
                        break
                    
                    # Extract jobs from page
                    jobs_on_page = 0
                    async for job in self._extract_jobs_from_page(soup, query, location):
                        if jobs_found >= max_results:
                            break
                        
                        yield job
                        jobs_found += 1
                        jobs_on_page += 1
                    
                    # Break if no jobs found on page
                    if jobs_on_page == 0:
                        break
                    
                    page += 1
                    
                    # Respect rate limiting
                    await self._random_delay(2, 5)
                
                add_scraping_breadcrumb(
                    f"Indeed search completed: {jobs_found} jobs found",
                    data={"pages_scraped": page, "total_jobs": jobs_found}
                )
                
            except Exception as e:
                capture_scraping_error(
                    e,
                    context={"query": query, "location": location},
                    url=self.search_url,
                    scraper_type="indeed"
                )
                raise
    
    async def _build_search_params(
        self,
        query: str,
        location: str,
        job_type: Optional[str] = None,
        experience_level: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Build search parameters for Indeed API."""
        params = {
            'q': query.strip(),
            'l': location.strip(),
            'sort': 'date',  # Sort by date for freshest results
            'limit': self.results_per_page,
            'fromage': kwargs.get('days_back', 30)  # Jobs posted in last N days
        }
        
        # Job type filtering
        if job_type:
            job_type_map = {
                'full_time': 'fulltime',
                'part_time': 'parttime',
                'contract': 'contract',
                'temporary': 'temporary',
                'remote': 'remote'
            }
            if job_type in job_type_map:
                params['jt'] = job_type_map[job_type]
        
        # Salary range
        if kwargs.get('salary_min'):
            params['salary'] = f"{kwargs['salary_min']}+"
        
        # Remove empty parameters
        return {k: v for k, v in params.items() if v}
    
    async def _get_search_page(self, params: Dict[str, Any]) -> Optional[BeautifulSoup]:
        """Get and parse search results page."""
        try:
            response = await self.make_request(
                url=self.search_url,
                params=params,
                headers=self._get_search_headers()
            )
            
            if response and response.status_code == 200:
                return BeautifulSoup(response.text, 'html.parser')
            
            return None
            
        except Exception as e:
            capture_scraping_error(
                e,
                context={"params": params},
                url=self.search_url,
                scraper_type="indeed"
            )
            return None
    
    def _get_search_headers(self) -> Dict[str, str]:
        """Get headers optimized for Indeed search."""
        headers = super().get_headers()
        headers.update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
        })
        return headers
    
    async def _extract_jobs_from_page(
        self,
        soup: BeautifulSoup,
        search_query: str,
        search_location: str
    ) -> AsyncGenerator[Job, None]:
        """Extract job data from search results page."""
        
        job_cards = soup.select(self.selectors["job_cards"])
        
        add_scraping_breadcrumb(
            f"Found {len(job_cards)} job cards on page",
            data={"job_count": len(job_cards)}
        )
        
        for card in job_cards:
            try:
                job_data = await self._extract_job_data(card, search_query, search_location)
                if job_data:
                    yield Job(**job_data)
                    
            except Exception as e:
                capture_scraping_error(
                    e,
                    context={"card_html": str(card)[:500]},
                    scraper_type="indeed"
                )
                continue
    
    async def _extract_job_data(
        self,
        job_card: BeautifulSoup,
        search_query: str,
        search_location: str
    ) -> Optional[Dict[str, Any]]:
        """Extract structured job data from job card."""
        
        try:
            # Extract basic job information
            title_elem = job_card.select_one(self.selectors["job_title"])
            company_elem = job_card.select_one(self.selectors["company"])
            location_elem = job_card.select_one(self.selectors["location"])
            summary_elem = job_card.select_one(self.selectors["summary"])
            
            if not title_elem or not company_elem:
                return None
            
            # Job title and URL
            job_title = self._clean_text(title_elem.get_text())
            job_url = self._extract_job_url(title_elem)
            
            # Company information
            company_name = self._clean_text(company_elem.get_text())
            
            # Location
            location = self._clean_text(location_elem.get_text()) if location_elem else search_location
            
            # Job description/summary
            description = self._clean_text(summary_elem.get_text()) if summary_elem else ""
            
            # Extract salary information
            salary_info = self._extract_salary(job_card)
            
            # Extract job metadata
            job_metadata = self._extract_job_metadata(job_card, description)
            
            # Extract posted date
            posted_date = self._extract_posted_date(job_card)
            
            # Build job data structure
            job_data = {
                "id": self._generate_job_id(job_url or f"{company_name}_{job_title}"),
                "title": job_title,
                "company": company_name,
                "location": location,
                "description": description,
                "url": job_url,
                "salary_min": salary_info.get("min"),
                "salary_max": salary_info.get("max"),
                "job_type": job_metadata.get("job_type", "full_time"),
                "experience_level": job_metadata.get("experience_level", "mid_level"),
                "skills_required": self._extract_skills_from_description(description),
                "remote_friendly": self._is_remote_job(description, location),
                "posted_date": posted_date,
                "source": "indeed",
                "raw_data": {
                    "search_query": search_query,
                    "search_location": search_location,
                    "card_html": str(job_card)[:1000],  # Truncate for storage
                    "extracted_at": datetime.utcnow().isoformat()
                }
            }
            
            return job_data
            
        except Exception as e:
            capture_scraping_error(
                e,
                context={"job_card": str(job_card)[:500]},
                scraper_type="indeed"
            )
            return None
    
    def _extract_job_url(self, title_elem) -> Optional[str]:
        """Extract job URL from title element."""
        if title_elem and title_elem.get('href'):
            relative_url = title_elem.get('href')
            return urljoin(self.base_url, relative_url)
        return None
    
    def _extract_salary(self, job_card: BeautifulSoup) -> Dict[str, Optional[float]]:
        """Extract salary information from job card."""
        salary_elem = job_card.select_one(self.selectors["salary"])
        
        if not salary_elem:
            return {"min": None, "max": None}
        
        salary_text = self._clean_text(salary_elem.get_text())
        
        # Parse salary ranges (e.g., "$50,000 - $70,000", "$25/hour", "Up to $80,000")
        salary_patterns = [
            r'\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*-\s*\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',  # Range
            r'Up to \$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',  # Up to X
            r'\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*/\s*(hour|yr|year)',  # Hourly/yearly
            r'\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)'  # Single amount
        ]
        
        for pattern in salary_patterns:
            match = re.search(pattern, salary_text, re.IGNORECASE)
            if match:
                try:
                    if '-' in pattern:  # Range pattern
                        min_sal = float(match.group(1).replace(',', ''))
                        max_sal = float(match.group(2).replace(',', ''))
                        return {"min": min_sal, "max": max_sal}
                    elif 'Up to' in salary_text:  # Up to pattern
                        max_sal = float(match.group(1).replace(',', ''))
                        return {"min": None, "max": max_sal}
                    elif '/hour' in salary_text.lower():  # Hourly rate
                        hourly = float(match.group(1).replace(',', ''))
                        annual = hourly * 40 * 52  # Convert to annual
                        return {"min": annual * 0.9, "max": annual * 1.1}
                    else:  # Single amount
                        amount = float(match.group(1).replace(',', ''))
                        return {"min": amount * 0.9, "max": amount * 1.1}
                except (ValueError, AttributeError):
                    continue
        
        return {"min": None, "max": None}
    
    def _extract_job_metadata(self, job_card: BeautifulSoup, description: str) -> Dict[str, str]:
        """Extract job type and experience level."""
        metadata = {
            "job_type": "full_time",
            "experience_level": "mid_level"
        }
        
        # Look for job type indicators
        text_content = (description + " " + job_card.get_text()).lower()
        
        for job_type, keywords in self.job_type_keywords.items():
            if any(keyword in text_content for keyword in keywords):
                metadata["job_type"] = job_type
                break
        
        # Determine experience level
        for level, keywords in self.experience_keywords.items():
            if any(keyword in text_content for keyword in keywords):
                if level == 'entry':
                    metadata["experience_level"] = "entry_level"
                elif level == 'mid':
                    metadata["experience_level"] = "mid_level"
                elif level == 'senior':
                    metadata["experience_level"] = "senior_level"
                elif level == 'executive':
                    metadata["experience_level"] = "executive"
                break
        
        return metadata
    
    def _extract_posted_date(self, job_card: BeautifulSoup) -> datetime:
        """Extract posted date from job card."""
        date_elem = job_card.select_one(self.selectors["posted_date"])
        
        if date_elem:
            date_text = self._clean_text(date_elem.get_text()).lower()
            
            # Parse relative dates
            if 'today' in date_text:
                return datetime.utcnow()
            elif 'yesterday' in date_text:
                return datetime.utcnow() - timedelta(days=1)
            elif 'day' in date_text:
                # Extract number of days
                match = re.search(r'(\d+)\s*day', date_text)
                if match:
                    days = int(match.group(1))
                    return datetime.utcnow() - timedelta(days=days)
            elif 'week' in date_text:
                match = re.search(r'(\d+)\s*week', date_text)
                if match:
                    weeks = int(match.group(1))
                    return datetime.utcnow() - timedelta(weeks=weeks)
            elif 'month' in date_text:
                match = re.search(r'(\d+)\s*month', date_text)
                if match:
                    months = int(match.group(1))
                    return datetime.utcnow() - timedelta(days=months * 30)
        
        # Default to current time if can't parse
        return datetime.utcnow()
    
    def _extract_skills_from_description(self, description: str) -> List[str]:
        """Extract skills and technologies from job description."""
        if not description:
            return []
        
        # Common programming languages and technologies
        tech_skills = [
            'python', 'java', 'javascript', 'typescript', 'react', 'angular', 'vue',
            'node.js', 'django', 'flask', 'spring', 'sql', 'postgresql', 'mysql',
            'mongodb', 'redis', 'docker', 'kubernetes', 'aws', 'azure', 'gcp',
            'git', 'jenkins', 'ci/cd', 'agile', 'scrum', 'tensorflow', 'pytorch',
            'machine learning', 'data science', 'analytics', 'tableau', 'power bi',
            'excel', 'r', 'scala', 'go', 'rust', 'php', 'ruby', 'c++', 'c#'
        ]
        
        description_lower = description.lower()
        found_skills = []
        
        for skill in tech_skills:
            if skill in description_lower:
                found_skills.append(skill)
        
        return found_skills
    
    def _is_remote_job(self, description: str, location: str) -> bool:
        """Determine if job is remote-friendly."""
        remote_indicators = [
            'remote', 'work from home', 'telecommute', 'distributed',
            'anywhere', 'home office', 'remote-friendly'
        ]
        
        text_to_check = (description + " " + location).lower()
        return any(indicator in text_to_check for indicator in remote_indicators)
    
    async def get_job_details(self, job_url: str) -> Optional[Dict[str, Any]]:
        """Get detailed job information from job posting page."""
        
        with SentryScrapingContext(job_url, "indeed_details"):
            try:
                response = await self.make_request(job_url)
                if not response or response.status_code != 200:
                    return None
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Extract detailed job information
                details = {
                    "full_description": self._extract_full_description(soup),
                    "company_info": self._extract_company_info(soup),
                    "benefits": self._extract_benefits(soup),
                    "requirements": self._extract_requirements(soup),
                    "job_highlights": self._extract_job_highlights(soup)
                }
                
                return details
                
            except Exception as e:
                capture_scraping_error(
                    e,
                    url=job_url,
                    scraper_type="indeed_details"
                )
                return None
    
    def _extract_full_description(self, soup: BeautifulSoup) -> str:
        """Extract full job description from job page."""
        description_selectors = [
            '#jobDescriptionText',
            '.jobsearch-jobDescriptionText',
            '[data-testid="job-description"]',
            '.job-description'
        ]
        
        for selector in description_selectors:
            desc_elem = soup.select_one(selector)
            if desc_elem:
                return self._clean_text(desc_elem.get_text())
        
        return ""
    
    def _extract_company_info(self, soup: BeautifulSoup) -> Dict[str, Any]:
        """Extract company information from job page."""
        company_info = {}
        
        # Company size
        size_elem = soup.select_one('[data-testid="company-size"]')
        if size_elem:
            company_info["size"] = self._clean_text(size_elem.get_text())
        
        # Company industry
        industry_elem = soup.select_one('[data-testid="company-industry"]')
        if industry_elem:
            company_info["industry"] = self._clean_text(industry_elem.get_text())
        
        return company_info
    
    def _extract_benefits(self, soup: BeautifulSoup) -> List[str]:
        """Extract job benefits from posting."""
        benefits = []
        
        benefits_section = soup.find('div', string=re.compile(r'Benefits?', re.I))
        if benefits_section:
            benefits_list = benefits_section.find_next('ul')
            if benefits_list:
                for benefit in benefits_list.find_all('li'):
                    benefits.append(self._clean_text(benefit.get_text()))
        
        return benefits
    
    def _extract_requirements(self, soup: BeautifulSoup) -> List[str]:
        """Extract job requirements from posting."""
        requirements = []
        
        req_section = soup.find('div', string=re.compile(r'Requirements?|Qualifications?', re.I))
        if req_section:
            req_list = req_section.find_next('ul')
            if req_list:
                for req in req_list.find_all('li'):
                    requirements.append(self._clean_text(req.get_text()))
        
        return requirements
    
    def _extract_job_highlights(self, soup: BeautifulSoup) -> Dict[str, List[str]]:
        """Extract job highlights (qualifications, responsibilities, etc.)."""
        highlights = {
            "qualifications": [],
            "responsibilities": [],
            "benefits": []
        }
        
        # Look for highlighted sections
        highlight_sections = soup.select('[data-testid="job-highlights"] div')
        
        for section in highlight_sections:
            section_text = section.get_text().lower()
            
            if 'qualification' in section_text:
                highlights["qualifications"].extend(
                    [self._clean_text(li.get_text()) for li in section.select('li')]
                )
            elif 'responsibilit' in section_text:
                highlights["responsibilities"].extend(
                    [self._clean_text(li.get_text()) for li in section.select('li')]
                )
            elif 'benefit' in section_text:
                highlights["benefits"].extend(
                    [self._clean_text(li.get_text()) for li in section.select('li')]
                )
        
        return highlights
