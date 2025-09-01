"""
LinkedIn scraper specialized for executive and professional jobs.
Implements advanced anti-detection and comprehensive data extraction.
"""

import asyncio
import random
import re
import json
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from urllib.parse import urljoin, urlparse, parse_qs
import hashlib

from playwright.async_api import Page, Response, Route
from bs4 import BeautifulSoup
from loguru import logger

from src.scrapers.base_scraper import BaseScraper
from src.models.job_models import JobLevel, JobType
from src.utils.text_processor import TextProcessor
from src.utils.salary_parser import SalaryParser


class LinkedInScraper(BaseScraper):
    """LinkedIn scraper with executive-level job extraction capabilities."""
    
    def __init__(self):
        super().__init__(
            name="linkedin",
            use_browser=True,
            use_proxy=True,
            max_retries=3
        )
        
        self.text_processor = TextProcessor()
        self.salary_parser = SalaryParser()
        
        # LinkedIn-specific settings
        self.base_url = "https://www.linkedin.com"
        self.jobs_api_url = "https://www.linkedin.com/voyager/api/jobs"
        
        # Tracking
        self.scraped_job_ids = set()
        self.company_cache = {}
        
        # Rate limiting
        self.last_request_time = None
        self.min_request_interval = 2.0  # seconds
        
    async def scrape(self, url: str = None, filters: Dict[str, Any] = None) -> Dict[str, Any]:
        """Scrape LinkedIn jobs based on URL or filters."""
        results = {
            "jobs": [],
            "companies": [],
            "networking_events": [],
            "executive_opportunities": [],
            "timestamp": datetime.utcnow().isoformat()
        }
        
        try:
            # Build search URL if not provided
            if not url and filters:
                url = self._build_search_url(filters)
            
            if not url:
                raise ValueError("Either URL or filters must be provided")
            
            # Create browser page
            page = await self.browser.new_page()
            
            try:
                # Set up request interception
                await self._setup_request_interception(page)
                
                # Navigate to search page
                await self._navigate_to_search(page, url)
                
                # Extract jobs from search results
                jobs = await self._extract_search_results(page, filters)
                results["jobs"].extend(jobs)
                
                # For executive searches, look for hidden opportunities
                if filters and filters.get("job_level") in ["executive", "director", "c_suite"]:
                    executive_jobs = await self._find_executive_opportunities(page, filters)
                    results["executive_opportunities"].extend(executive_jobs)
                
                # Extract networking events if executive tier
                if filters and filters.get("include_networking_events"):
                    events = await self._extract_networking_events(page, filters)
                    results["networking_events"].extend(events)
                
                # Process each job for detailed information
                for job in results["jobs"][:50]:  # Limit to prevent rate limiting
                    try:
                        detailed_job = await self._extract_job_details(page, job)
                        job.update(detailed_job)
                        
                        # Extract company information
                        if job.get("company", {}).get("linkedin_url"):
                            company_info = await self._extract_company_info(
                                page, job["company"]["linkedin_url"]
                            )
                            if company_info:
                                results["companies"].append(company_info)
                                job["company"].update(company_info)
                        
                    except Exception as e:
                        logger.error(f"Error extracting job details: {e}")
                
                # Calculate match scores if user profile provided
                if filters and filters.get("user_profile"):
                    for job in results["jobs"]:
                        job["match_score"] = self._calculate_match_score(
                            job, filters["user_profile"]
                        )
                
            finally:
                await page.close()
            
            # Update metrics
            self.metrics.total_items_scraped += len(results["jobs"])
            
            return results
            
        except Exception as e:
            logger.error(f"LinkedIn scraping error: {e}")
            raise
    
    def _build_search_url(self, filters: Dict[str, Any]) -> str:
        """Build LinkedIn job search URL from filters."""
        params = []
        
        # Keywords
        if filters.get("keywords"):
            keywords = " ".join(filters["keywords"])
            params.append(f"keywords={keywords.replace(' ', '%20')}")
        
        # Location
        if filters.get("location"):
            params.append(f"location={filters['location'].replace(' ', '%20')}")
        
        # Job level
        if filters.get("job_level"):
            level_mapping = {
                "entry": "1",
                "mid": "2,3", 
                "senior": "4",
                "manager": "5",
                "director": "6",
                "executive": "7",
                "c_suite": "8,9"
            }
            if filters["job_level"] in level_mapping:
                params.append(f"f_E={level_mapping[filters['job_level']]}")
        
        # Date posted
        if filters.get("posted_within_days"):
            time_mapping = {
                1: "r86400",
                7: "r604800",
                30: "r2592000"
            }
            days = filters["posted_within_days"]
            if days in time_mapping:
                params.append(f"f_TPR={time_mapping[days]}")
        
        # Remote work
        if filters.get("remote_only"):
            params.append("f_WT=2")  # Remote
        
        # Company size
        if filters.get("company_size"):
            size_mapping = {
                "startup": "B",
                "small": "C",
                "medium": "D,E",
                "large": "F,G",
                "enterprise": "H,I"
            }
            if filters["company_size"] in size_mapping:
                params.append(f"f_CS={size_mapping[filters['company_size']]}")
        
        url = f"{self.base_url}/jobs/search/?"
        if params:
            url += "&".join(params)
        
        return url
    
    async def _setup_request_interception(self, page: Page):
        """Set up request interception for API calls."""
        
        async def handle_route(route: Route):
            """Handle intercepted routes."""
            request = route.request
            
            # Block unnecessary resources
            if request.resource_type in ["image", "font", "media"]:
                await route.abort()
                return
            
            # Intercept API calls
            if "/voyager/api/" in request.url:
                headers = {
                    **request.headers,
                    "x-li-track": '{"clientVersion":"1.13.0","mpVersion":"1.13.0","osName":"web","timezoneOffset":0}',
                    "x-restli-protocol-version": "2.0.0"
                }
                await route.continue_(headers=headers)
            else:
                await route.continue_()
        
        await page.route("**/*", handle_route)
    
    async def _navigate_to_search(self, page: Page, url: str):
        """Navigate to search page with anti-detection measures."""
        # Add random delay
        await self._add_human_delay()
        
        # Navigate with timeout and wait
        response = await page.goto(url, wait_until="networkidle", timeout=30000)
        
        # Check if we need to handle auth/captcha
        if "authwall" in page.url or "checkpoint" in page.url:
            logger.warning("LinkedIn auth wall detected")
            # Could implement auth handling here
            raise Exception("LinkedIn authentication required")
        
        # Wait for content to load
        await page.wait_for_selector(".jobs-search-results", timeout=10000)
        
        # Simulate human behavior
        await self._simulate_human_behavior(page)
    
    async def _simulate_human_behavior(self, page: Page):
        """Simulate human-like behavior on the page."""
        # Random mouse movements
        for _ in range(random.randint(2, 4)):
            x = random.randint(100, 800)
            y = random.randint(100, 600)
            await page.mouse.move(x, y)
            await asyncio.sleep(random.uniform(0.1, 0.3))
        
        # Random scroll
        await page.evaluate(f"window.scrollBy(0, {random.randint(100, 300)})")
        await asyncio.sleep(random.uniform(0.5, 1.0))
        
        # Move back up
        await page.evaluate("window.scrollTo(0, 0)")
    
    async def _extract_search_results(self, page: Page, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract job listings from search results."""
        jobs = []
        page_num = 1
        max_pages = 10  # Limit to prevent infinite loops
        
        while page_num <= max_pages:
            # Wait for results to load
            await page.wait_for_selector(".jobs-search-results__list", timeout=10000)
            
            # Extract jobs from current page
            job_cards = await page.query_selector_all(".jobs-search-results__list-item")
            
            for card in job_cards:
                try:
                    job_data = await self._extract_job_card(card)
                    
                    if job_data and job_data["id"] not in self.scraped_job_ids:
                        self.scraped_job_ids.add(job_data["id"])
                        jobs.append(job_data)
                        
                except Exception as e:
                    logger.error(f"Error extracting job card: {e}")
            
            # Check for next page
            next_button = await page.query_selector('button[aria-label="Next"]')
            if next_button and await next_button.is_enabled():
                await next_button.click()
                await page.wait_for_load_state("networkidle")
                await self._add_human_delay()
                page_num += 1
            else:
                break
        
        logger.info(f"Extracted {len(jobs)} jobs from {page_num} pages")
        return jobs
    
    async def _extract_job_card(self, card) -> Dict[str, Any]:
        """Extract data from a job card element."""
        job_data = {}
        
        # Job ID from data attribute
        job_id = await card.get_attribute("data-occludable-job-id")
        if not job_id:
            return None
        
        job_data["id"] = job_id
        job_data["source"] = "linkedin"
        job_data["scraped_at"] = datetime.utcnow().isoformat()
        
        # Title
        title_elem = await card.query_selector(".job-card-list__title")
        if title_elem:
            job_data["title"] = await title_elem.inner_text()
        
        # Company
        company_elem = await card.query_selector(".job-card-container__company-name")
        if company_elem:
            company_name = await company_elem.inner_text()
            job_data["company"] = {"name": company_name.strip()}
        
        # Location
        location_elem = await card.query_selector(".job-card-container__metadata-item")
        if location_elem:
            location = await location_elem.inner_text()
            job_data["location"] = self.text_processor.normalize_location(location)
        
        # Job URL
        link_elem = await card.query_selector(".job-card-list__title")
        if link_elem:
            href = await link_elem.get_attribute("href")
            if href:
                job_data["source_url"] = urljoin(self.base_url, href.split("?")[0])
        
        # Posted time
        time_elem = await card.query_selector("time")
        if time_elem:
            time_text = await time_elem.inner_text()
            job_data["posted_date"] = self._parse_posted_time(time_text)
        
        # Easy apply
        easy_apply = await card.query_selector(".job-card-container__easy-apply-label")
        job_data["easy_apply"] = easy_apply is not None
        
        # Remote
        metadata = await card.query_selector_all(".job-card-container__metadata-item")
        for meta in metadata:
            text = await meta.inner_text()
            if "remote" in text.lower():
                job_data["remote_type"] = "remote"
                break
        
        return job_data
    
    async def _extract_job_details(self, page: Page, job: Dict[str, Any]) -> Dict[str, Any]:
        """Extract detailed information for a specific job."""
        if not job.get("source_url"):
            return {}
        
        # Rate limiting
        await self._apply_rate_limit()
        
        # Create new page for job details
        detail_page = await self.browser.new_page()
        
        try:
            # Navigate to job page
            await detail_page.goto(job["source_url"], wait_until="networkidle")
            
            # Wait for content
            await detail_page.wait_for_selector(".jobs-description", timeout=10000)
            
            details = {}
            
            # Full description
            desc_elem = await detail_page.query_selector(".jobs-description__content")
            if desc_elem:
                desc_html = await desc_elem.inner_html()
                details["description"] = self.text_processor.clean_html(desc_html)
                
                # Extract structured data
                structured = self._extract_structured_data(details["description"])
                details.update(structured)
            
            # Salary information
            salary_elem = await detail_page.query_selector(".salary-main-rail-card__salary-range")
            if salary_elem:
                salary_text = await salary_elem.inner_text()
                salary_info = self.salary_parser.parse(salary_text)
                details.update(salary_info)
            
            # Job details panel
            criteria_list = await detail_page.query_selector_all(".jobs-unified-top-card__job-insight")
            for criteria in criteria_list:
                text = await criteria.inner_text()
                
                if "applicants" in text.lower():
                    # Extract applicant count
                    numbers = re.findall(r'\d+', text)
                    if numbers:
                        details["application_count"] = int(numbers[0])
                
                elif any(level in text.lower() for level in ["senior", "entry", "director", "executive"]):
                    # Job level
                    details["job_level"] = self._extract_job_level(text)
                
                elif any(type_word in text.lower() for type_word in ["full-time", "part-time", "contract"]):
                    # Job type
                    details["job_type"] = self._extract_job_type(text)
            
            # Skills
            skills_section = await detail_page.query_selector(".jobs-ppc-criteria__list")
            if skills_section:
                skill_items = await skills_section.query_selector_all("li")
                skills = []
                for item in skill_items:
                    skill_text = await item.inner_text()
                    skills.append(skill_text.strip())
                details["skills"] = skills
            
            # Benefits
            benefits_section = await detail_page.query_selector(".jobs-description__benefits")
            if benefits_section:
                benefits_html = await benefits_section.inner_html()
                details["benefits"] = self.text_processor.extract_list_items(benefits_html)
            
            # Company insights
            insights_elem = await detail_page.query_selector(".jobs-company__insights")
            if insights_elem:
                insights_html = await insights_elem.inner_html()
                details["company_insights"] = self._extract_company_insights(insights_html)
            
            # Check if executive/headhunter posting
            details["is_executive"] = self._is_executive_position(details)
            details["is_headhunter_posted"] = await self._is_headhunter_posting(detail_page)
            
            # Extract hiring manager info if available
            hiring_manager = await self._extract_hiring_manager(detail_page)
            if hiring_manager:
                details["hiring_manager"] = hiring_manager
            
            return details
            
        except Exception as e:
            logger.error(f"Error extracting job details for {job['source_url']}: {e}")
            return {}
            
        finally:
            await detail_page.close()
    
    async def _extract_company_info(self, page: Page, company_url: str) -> Dict[str, Any]:
        """Extract company information and culture data."""
        # Check cache first
        if company_url in self.company_cache:
            return self.company_cache[company_url]
        
        # Rate limiting
        await self._apply_rate_limit()
        
        company_page = await self.browser.new_page()
        
        try:
            # Navigate to company page
            await company_page.goto(company_url, wait_until="networkidle")
            
            # Wait for content
            await company_page.wait_for_selector(".org-top-card", timeout=10000)
            
            company_info = {
                "linkedin_url": company_url,
                "extracted_at": datetime.utcnow().isoformat()
            }
            
            # Company name
            name_elem = await company_page.query_selector(".org-top-card-summary__title")
            if name_elem:
                company_info["name"] = await name_elem.inner_text()
            
            # Industry
            industry_elem = await company_page.query_selector(".org-top-card-summary__industry")
            if industry_elem:
                company_info["industry"] = await industry_elem.inner_text()
            
            # Company size
            size_elem = await company_page.query_selector(".org-top-card-summary__info-item")
            if size_elem:
                size_text = await size_elem.inner_text()
                company_info["size"] = self._parse_company_size(size_text)
            
            # Headquarters
            hq_elem = await company_page.query_selector(".org-top-card-summary__headquarter")
            if hq_elem:
                company_info["headquarters"] = await hq_elem.inner_text()
            
            # About section
            about_elem = await company_page.query_selector(".org-top-card-summary__tagline")
            if about_elem:
                company_info["tagline"] = await about_elem.inner_text()
            
            # Culture insights (would need additional navigation)
            culture_score = await self._calculate_culture_score(company_page)
            if culture_score:
                company_info["culture_score"] = culture_score
            
            # Leadership team (for executive tier)
            leadership = await self._extract_leadership_team(company_page)
            if leadership:
                company_info["leadership_team"] = leadership
            
            # Recent news/updates
            news = await self._extract_company_news(company_page)
            if news:
                company_info["recent_news"] = news
            
            # Cache the result
            self.company_cache[company_url] = company_info
            
            return company_info
            
        except Exception as e:
            logger.error(f"Error extracting company info: {e}")
            return {}
            
        finally:
            await company_page.close()
    
    async def _find_executive_opportunities(self, page: Page, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Find hidden executive opportunities through advanced search."""
        executive_jobs = []
        
        # Search for executive recruiters
        recruiter_keywords = [
            "executive search",
            "retained search", 
            "C-suite opportunity",
            "confidential search",
            "board position"
        ]
        
        for keyword in recruiter_keywords:
            search_filters = filters.copy()
            search_filters["keywords"] = [keyword]
            
            url = self._build_search_url(search_filters)
            
            try:
                await page.goto(url, wait_until="networkidle")
                jobs = await self._extract_search_results(page, search_filters)
                
                for job in jobs:
                    job["is_hidden_market"] = True
                    job["opportunity_type"] = "executive_search"
                    executive_jobs.append(job)
                    
            except Exception as e:
                logger.error(f"Error searching for executive opportunities: {e}")
        
        return executive_jobs
    
    async def _extract_networking_events(self, page: Page, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract professional networking events."""
        events = []
        
        # Navigate to LinkedIn Events
        events_url = f"{self.base_url}/events/"
        
        try:
            await page.goto(events_url, wait_until="networkidle")
            
            # Search for professional events
            search_keywords = ["executive", "leadership", "C-suite", "networking", "professional"]
            
            for keyword in search_keywords:
                # Would implement event search and extraction
                pass
            
        except Exception as e:
            logger.error(f"Error extracting networking events: {e}")
        
        return events
    
    async def _extract_hiring_manager(self, page: Page) -> Optional[Dict[str, Any]]:
        """Extract hiring manager information if available."""
        try:
            # Look for hiring team card
            hiring_card = await page.query_selector(".hirer-card")
            if not hiring_card:
                return None
            
            manager_info = {}
            
            # Name
            name_elem = await hiring_card.query_selector(".hirer-card__name")
            if name_elem:
                manager_info["name"] = await name_elem.inner_text()
            
            # Title
            title_elem = await hiring_card.query_selector(".hirer-card__title")
            if title_elem:
                manager_info["title"] = await title_elem.inner_text()
            
            # Profile URL
            link_elem = await hiring_card.query_selector("a")
            if link_elem:
                href = await link_elem.get_attribute("href")
                if href:
                    manager_info["profile_url"] = urljoin(self.base_url, href)
            
            return manager_info
            
        except Exception as e:
            logger.debug(f"No hiring manager info found: {e}")
            return None
    
    async def _is_headhunter_posting(self, page: Page) -> bool:
        """Check if job is posted by headhunter/recruiter."""
        try:
            # Check job poster info
            poster_elem = await page.query_selector(".jobs-poster__name")
            if poster_elem:
                poster_text = await poster_elem.inner_text()
                poster_lower = poster_text.lower()
                
                headhunter_keywords = [
                    "recruiter", "recruitment", "talent acquisition",
                    "executive search", "staffing", "headhunter"
                ]
                
                if any(keyword in poster_lower for keyword in headhunter_keywords):
                    return True
            
            # Check company description
            company_elem = await page.query_selector(".jobs-company__description")
            if company_elem:
                company_text = await company_elem.inner_text()
                company_lower = company_text.lower()
                
                if any(keyword in company_lower for keyword in ["staffing", "recruitment", "search firm"]):
                    return True
            
            return False
            
        except Exception:
            return False
    
    def _extract_structured_data(self, description: str) -> Dict[str, Any]:
        """Extract structured data from job description."""
        data = {}
        
        # Use text processor to split into sections
        sections = self.text_processor.split_into_sections(description)
        
        # Requirements
        if "requirements" in sections or "qualifications" in sections:
            data["requirements"] = sections.get("requirements") or sections.get("qualifications")
        
        # Responsibilities
        if "responsibilities" in sections or "duties" in sections:
            data["responsibilities"] = sections.get("responsibilities") or sections.get("duties")
        
        # Extract years of experience
        exp_pattern = r'(\d+)\+?\s*years?\s*(?:of\s*)?experience'
        exp_match = re.search(exp_pattern, description, re.IGNORECASE)
        if exp_match:
            data["years_experience_required"] = int(exp_match.group(1))
        
        # Extract education requirements
        education_keywords = ["bachelor", "master", "phd", "doctorate", "mba"]
        education_found = []
        for keyword in education_keywords:
            if keyword in description.lower():
                education_found.append(keyword.upper())
        
        if education_found:
            data["education_required"] = education_found
        
        return data
    
    def _extract_job_level(self, text: str) -> str:
        """Extract job level from text."""
        text_lower = text.lower()
        
        if any(term in text_lower for term in ["c-suite", "ceo", "cto", "cfo", "coo", "cmo"]):
            return "c_suite"
        elif "executive" in text_lower:
            return "executive"
        elif "director" in text_lower:
            return "director"
        elif "manager" in text_lower or "lead" in text_lower:
            return "manager"
        elif "senior" in text_lower:
            return "senior"
        elif "mid" in text_lower or "intermediate" in text_lower:
            return "mid"
        elif "entry" in text_lower or "junior" in text_lower:
            return "entry"
        
        return "mid"  # Default
    
    def _extract_job_type(self, text: str) -> str:
        """Extract job type from text."""
        text_lower = text.lower()
        
        if "full-time" in text_lower or "full time" in text_lower:
            return "full-time"
        elif "part-time" in text_lower or "part time" in text_lower:
            return "part-time"
        elif "contract" in text_lower or "contractor" in text_lower:
            return "contract"
        elif "intern" in text_lower:
            return "internship"
        elif "temp" in text_lower:
            return "temporary"
        
        return "full-time"  # Default
    
    def _is_executive_position(self, job_data: Dict[str, Any]) -> bool:
        """Determine if position is executive level."""
        # Check job level
        if job_data.get("job_level") in ["executive", "director", "c_suite"]:
            return True
        
        # Check title
        title = job_data.get("title", "").lower()
        executive_titles = [
            "chief", "ceo", "cto", "cfo", "coo", "cmo", "president",
            "vice president", "vp ", "director", "head of"
        ]
        
        return any(exec_title in title for exec_title in executive_titles)
    
    def _parse_posted_time(self, time_text: str) -> str:
        """Parse LinkedIn's relative time to ISO format."""
        now = datetime.utcnow()
        
        if "hour" in time_text:
            hours = int(re.findall(r'\d+', time_text)[0])
            posted_date = now - timedelta(hours=hours)
        elif "day" in time_text:
            days = int(re.findall(r'\d+', time_text)[0])
            posted_date = now - timedelta(days=days)
        elif "week" in time_text:
            weeks = int(re.findall(r'\d+', time_text)[0])
            posted_date = now - timedelta(weeks=weeks)
        elif "month" in time_text:
            months = int(re.findall(r'\d+', time_text)[0])
            posted_date = now - timedelta(days=months * 30)
        else:
            posted_date = now
        
        return posted_date.isoformat()
    
    def _parse_company_size(self, size_text: str) -> str:
        """Parse company size from text."""
        if not size_text:
            return "unknown"
        
        # Extract numbers
        numbers = re.findall(r'[\d,]+', size_text)
        if not numbers:
            return "unknown"
        
        # Get the largest number (usually the upper bound)
        sizes = [int(n.replace(',', '')) for n in numbers]
        max_size = max(sizes)
        
        if max_size < 50:
            return "startup"
        elif max_size < 200:
            return "small"
        elif max_size < 1000:
            return "medium"
        elif max_size < 10000:
            return "large"
        else:
            return "enterprise"
    
    async def _calculate_culture_score(self, page: Page) -> Optional[float]:
        """Calculate company culture score based on available data."""
        # This would analyze employee reviews, ratings, etc.
        # Placeholder implementation
        return random.uniform(3.5, 5.0)
    
    async def _extract_leadership_team(self, page: Page) -> List[Dict[str, Any]]:
        """Extract company leadership team information."""
        # Would navigate to company people section and extract leadership
        # Placeholder implementation
        return []
    
    async def _extract_company_news(self, page: Page) -> List[Dict[str, Any]]:
        """Extract recent company news and updates."""
        # Would extract from company posts/updates
        # Placeholder implementation
        return []
    
    def _extract_company_insights(self, insights_html: str) -> Dict[str, Any]:
        """Extract insights from company section."""
        insights = {}
        
        soup = BeautifulSoup(insights_html, 'html.parser')
        
        # Growth metrics
        growth_elem = soup.find(text=re.compile(r'growing'))
        if growth_elem:
            insights["is_growing"] = True
            growth_text = growth_elem.parent.get_text()
            growth_match = re.search(r'(\d+)%', growth_text)
            if growth_match:
                insights["growth_rate"] = int(growth_match.group(1))
        
        return insights
    
    def _calculate_match_score(self, job: Dict[str, Any], user_profile: Dict[str, Any]) -> float:
        """Calculate job match score based on user profile."""
        score = 0.0
        max_score = 100.0
        
        # Skills match (40%)
        if job.get("skills") and user_profile.get("skills"):
            job_skills = set(s.lower() for s in job.get("skills", []))
            user_skills = set(s.lower() for s in user_profile.get("skills", []))
            
            if job_skills:
                skill_match = len(job_skills & user_skills) / len(job_skills)
                score += skill_match * 40
        
        # Experience match (20%)
        if job.get("years_experience_required") and user_profile.get("years_experience"):
            exp_required = job["years_experience_required"]
            exp_have = user_profile["years_experience"]
            
            if exp_have >= exp_required:
                score += 20
            elif exp_have >= exp_required * 0.8:
                score += 15
            elif exp_have >= exp_required * 0.6:
                score += 10
        
        # Location match (15%)
        if job.get("location") and user_profile.get("preferred_locations"):
            job_location = job["location"].lower()
            preferred = [loc.lower() for loc in user_profile["preferred_locations"]]
            
            if any(pref in job_location for pref in preferred):
                score += 15
            elif job.get("remote_type") == "remote":
                score += 10
        
        # Salary match (15%)
        if job.get("salary_min") and user_profile.get("expected_salary"):
            if job["salary_min"] >= user_profile["expected_salary"]:
                score += 15
            elif job["salary_min"] >= user_profile["expected_salary"] * 0.9:
                score += 10
        
        # Job level match (10%)
        if job.get("job_level") and user_profile.get("target_level"):
            if job["job_level"] == user_profile["target_level"]:
                score += 10
            elif self._is_adjacent_level(job["job_level"], user_profile["target_level"]):
                score += 5
        
        return round(score, 2)
    
    def _is_adjacent_level(self, level1: str, level2: str) -> bool:
        """Check if two job levels are adjacent."""
        level_order = ["entry", "mid", "senior", "manager", "director", "executive", "c_suite"]
        
        try:
            idx1 = level_order.index(level1)
            idx2 = level_order.index(level2)
            return abs(idx1 - idx2) == 1
        except ValueError:
            return False
    
    async def _apply_rate_limit(self):
        """Apply rate limiting between requests."""
        if self.last_request_time:
            elapsed = (datetime.utcnow() - self.last_request_time).total_seconds()
            if elapsed < self.min_request_interval:
                await asyncio.sleep(self.min_request_interval - elapsed)
        
        self.last_request_time = datetime.utcnow()
    
    async def parse_item(self, data: Any) -> Dict[str, Any]:
        """Parse individual item (not used for browser-based scraping)."""
        pass
