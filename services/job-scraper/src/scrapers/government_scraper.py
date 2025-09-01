"""
Government Portal Scraper for Public Domain Job Data
100% Legal - Government job postings are public information
"""

import asyncio
import aiohttp
from bs4 import BeautifulSoup
from typing import Dict, List, Any, Optional
from datetime import datetime
from loguru import logger
import hashlib
import re

from src.scrapers.base_scraper import BaseScraper
from src.utils.text_processor import TextProcessor
from src.utils.salary_parser import SalaryParser


class GovernmentPortalScraper(BaseScraper):
    """
    Legal scraper for South African government job portals.
    Government job listings are public domain information.
    """
    
    def __init__(self):
        super().__init__(
            name="government_scraper",
            use_browser=False,
            use_proxy=False,
            max_retries=2
        )
        
        self.text_processor = TextProcessor()
        self.salary_parser = SalaryParser()
        
        # Government job portals - all public domain
        self.government_sources = {
            "dpsa": {
                "name": "Department of Public Service & Administration",
                "base_url": "https://www.dpsa.gov.za",
                "vacancies_url": "https://www.dpsa.gov.za/vacancies.php",
                "selectors": {
                    "job_list": ".vacancy-item, .job-listing, table tr",
                    "title": ".job-title, td:nth-child(1), h3",
                    "department": ".department, td:nth-child(2)",
                    "location": ".location, td:nth-child(3)",
                    "closing_date": ".closing-date, td:nth-child(4)",
                    "link": "a[href*='vacancy'], a[href*='job']"
                }
            },
            "national_treasury": {
                "name": "National Treasury",
                "base_url": "https://www.treasury.gov.za",
                "vacancies_url": "https://www.treasury.gov.za/jobs/",
                "selectors": {
                    "job_list": ".job-item, .vacancy",
                    "title": ".title, h3",
                    "level": ".level, .grade",
                    "location": ".location",
                    "link": "a"
                }
            },
            "city_of_cape_town": {
                "name": "City of Cape Town",
                "base_url": "https://web1.capetown.gov.za",
                "vacancies_url": "https://web1.capetown.gov.za/web1/citycareer/",
                "selectors": {
                    "job_list": ".job-row, tr",
                    "title": ".job-title, td:first-child",
                    "department": ".department, td:nth-child(2)",
                    "closing_date": ".closing, td:last-child"
                }
            },
            "city_of_johannesburg": {
                "name": "City of Johannesburg",
                "base_url": "https://www.joburg.org.za",
                "vacancies_url": "https://www.joburg.org.za/careers",
                "selectors": {
                    "job_list": ".career-item, .job-post",
                    "title": ".title, h3",
                    "department": ".dept",
                    "link": "a"
                }
            },
            "wits_university": {
                "name": "University of the Witwatersrand",
                "base_url": "https://www.wits.ac.za",
                "vacancies_url": "https://www.wits.ac.za/vacancies/",
                "selectors": {
                    "job_list": ".vacancy-item, .job-listing",
                    "title": ".job-title, h3",
                    "faculty": ".faculty, .department",
                    "type": ".job-type",
                    "link": "a"
                }
            },
            "uct": {
                "name": "University of Cape Town",
                "base_url": "https://www.uct.ac.za",
                "vacancies_url": "https://www.uct.ac.za/main/explore-uct/vacancies",
                "selectors": {
                    "job_list": ".job-item, li",
                    "title": ".title, a",
                    "department": ".dept",
                    "link": "a"
                }
            }
        }
        
        # Track processed jobs
        self.processed_jobs = set()
        
        # Government salary scales (for reference)
        self.salary_scales = {
            "1-3": (100000, 200000),    # Lower levels
            "4-6": (200000, 400000),    # Administrative
            "7-9": (400000, 700000),    # Professional
            "10-12": (700000, 1200000), # Management
            "13-15": (1200000, 2000000), # Senior Management
            "16": (2000000, 3000000)    # Director General
        }
        
        logger.info(f"Government scraper initialized with {len(self.government_sources)} sources")
    
    async def scrape(self, source: str = None, filters: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Scrape government job portals.
        This is 100% legal as government job postings are public information.
        """
        results = {
            "jobs": [],
            "departments": set(),
            "timestamp": datetime.utcnow().isoformat(),
            "source": "government",
            "legal_status": "100% legal - public domain information"
        }
        
        try:
            # Select sources to scrape
            sources_to_scrape = {}
            if source and source in self.government_sources:
                sources_to_scrape = {source: self.government_sources[source]}
            else:
                sources_to_scrape = self.government_sources
            
            # Scrape each source
            for source_key, source_config in sources_to_scrape.items():
                logger.info(f"Scraping government portal: {source_config['name']}")
                
                try:
                    jobs = await self._scrape_portal(
                        source_key,
                        source_config,
                        filters
                    )
                    
                    results["jobs"].extend(jobs)
                    
                    # Extract departments
                    for job in jobs:
                        if job.get("department"):
                            results["departments"].add(job["department"])
                    
                    # Rate limiting - be respectful to government servers
                    await asyncio.sleep(2.0)
                    
                except Exception as e:
                    logger.error(f"Error scraping {source_config['name']}: {e}")
                    continue
            
            # Convert departments set to list
            results["departments"] = list(results["departments"])
            
            # Deduplicate jobs
            results["jobs"] = self._deduplicate_jobs(results["jobs"])
            
            # Add match scores if filters provided
            if filters:
                for job in results["jobs"]:
                    job["match_score"] = self._calculate_match_score(job, filters)
            
            # Sort by posted date
            results["jobs"].sort(
                key=lambda x: x.get("posted_date", ""),
                reverse=True
            )
            
            # Update metrics
            self.metrics.total_items_scraped += len(results["jobs"])
            
            logger.success(
                f"Government scraping complete: {len(results['jobs'])} jobs from "
                f"{len(results['departments'])} departments"
            )
            
            return results
            
        except Exception as e:
            logger.error(f"Government scraping error: {e}")
            raise
    
    async def _scrape_portal(
        self,
        source_key: str,
        source_config: Dict[str, Any],
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Scrape individual government portal."""
        jobs = []
        
        try:
            # Fetch the page
            async with aiohttp.ClientSession() as session:
                headers = {
                    "User-Agent": "Mozilla/5.0 (compatible; JobAggregator/1.0; Educational/Research)"
                }
                
                async with session.get(
                    source_config["vacancies_url"],
                    headers=headers,
                    timeout=30
                ) as response:
                    if response.status != 200:
                        logger.warning(f"Failed to fetch {source_config['name']}: {response.status}")
                        return jobs
                    
                    html = await response.text()
            
            # Parse HTML
            soup = BeautifulSoup(html, "html.parser")
            
            # Find job listings using selectors
            selectors = source_config["selectors"]
            job_elements = soup.select(selectors.get("job_list", ".job"))
            
            logger.info(f"Found {len(job_elements)} potential jobs on {source_config['name']}")
            
            # Parse each job
            for element in job_elements:
                job = self._parse_job_element(
                    element,
                    source_key,
                    source_config,
                    selectors
                )
                
                if job:
                    # Check if already processed
                    job_id = job.get("id")
                    if job_id not in self.processed_jobs:
                        # Apply filters
                        if self._passes_filters(job, filters):
                            jobs.append(job)
                            self.processed_jobs.add(job_id)
            
            logger.info(f"Extracted {len(jobs)} valid jobs from {source_config['name']}")
            
        except Exception as e:
            logger.error(f"Error scraping portal {source_config['name']}: {e}")
        
        return jobs
    
    def _parse_job_element(
        self,
        element,
        source_key: str,
        source_config: Dict[str, Any],
        selectors: Dict[str, str]
    ) -> Optional[Dict[str, Any]]:
        """Parse individual job element from government portal."""
        try:
            # Extract title
            title = None
            if selectors.get("title"):
                title_elem = element.select_one(selectors["title"])
                if title_elem:
                    title = title_elem.get_text(strip=True)
            
            if not title:
                return None
            
            # Generate unique ID
            unique_string = f"{source_key}_{title}"
            job_id = hashlib.md5(unique_string.encode()).hexdigest()
            
            # Build job object
            job = {
                "id": job_id,
                "source": "government",
                "source_name": source_config["name"],
                "title": title,
                "scraped_at": datetime.utcnow().isoformat(),
                "is_government": True,
                "employment_type": "permanent"  # Most government jobs are permanent
            }
            
            # Extract department
            if selectors.get("department"):
                dept_elem = element.select_one(selectors["department"])
                if dept_elem:
                    job["department"] = dept_elem.get_text(strip=True)
            
            # Extract location
            if selectors.get("location"):
                loc_elem = element.select_one(selectors["location"])
                if loc_elem:
                    job["location"] = loc_elem.get_text(strip=True)
            else:
                # Default locations based on source
                if "cape_town" in source_key:
                    job["location"] = "Cape Town, Western Cape"
                elif "johannesburg" in source_key:
                    job["location"] = "Johannesburg, Gauteng"
                elif "wits" in source_key:
                    job["location"] = "Johannesburg, Gauteng"
                elif "uct" in source_key:
                    job["location"] = "Cape Town, Western Cape"
                else:
                    job["location"] = "South Africa"
            
            # Extract closing date
            if selectors.get("closing_date"):
                closing_elem = element.select_one(selectors["closing_date"])
                if closing_elem:
                    closing_text = closing_elem.get_text(strip=True)
                    job["closing_date"] = self._parse_date(closing_text)
            
            # Extract job level/grade
            if selectors.get("level"):
                level_elem = element.select_one(selectors["level"])
                if level_elem:
                    level_text = level_elem.get_text(strip=True)
                    job["level"] = level_text
                    
                    # Estimate salary from level
                    salary_range = self._estimate_salary_from_level(level_text)
                    if salary_range:
                        job["salary_min"] = salary_range[0]
                        job["salary_max"] = salary_range[1]
                        job["salary_currency"] = "ZAR"
            
            # Extract link
            if selectors.get("link"):
                link_elem = element.select_one(selectors["link"])
                if link_elem and link_elem.get("href"):
                    job["source_url"] = self._build_full_url(
                        link_elem["href"],
                        source_config["base_url"]
                    )
            
            # Detect job level from title
            job["job_level"] = self._detect_job_level_from_title(title)
            
            # Add metadata
            job["company"] = {
                "name": source_config["name"],
                "type": "government"
            }
            
            # Government-specific benefits (standard across SA government)
            job["benefits"] = [
                "Medical Aid",
                "Pension Fund",
                "Housing Allowance",
                "13th Cheque",
                "Leave Benefits"
            ]
            
            # Extract faculty/school for universities
            if "university" in source_key.lower() or "wits" in source_key or "uct" in source_key:
                if selectors.get("faculty"):
                    faculty_elem = element.select_one(selectors["faculty"])
                    if faculty_elem:
                        job["faculty"] = faculty_elem.get_text(strip=True)
                job["is_academic"] = True
            
            return job
            
        except Exception as e:
            logger.error(f"Error parsing job element: {e}")
            return None
    
    def _estimate_salary_from_level(self, level_text: str) -> Optional[tuple]:
        """Estimate salary range from government job level."""
        if not level_text:
            return None
        
        # Extract numeric level
        import re
        level_match = re.search(r'(\d+)', level_text)
        if level_match:
            level_num = int(level_match.group(1))
            
            # Map to salary scales
            if 1 <= level_num <= 3:
                return self.salary_scales["1-3"]
            elif 4 <= level_num <= 6:
                return self.salary_scales["4-6"]
            elif 7 <= level_num <= 9:
                return self.salary_scales["7-9"]
            elif 10 <= level_num <= 12:
                return self.salary_scales["10-12"]
            elif 13 <= level_num <= 15:
                return self.salary_scales["13-15"]
            elif level_num >= 16:
                return self.salary_scales["16"]
        
        # Check for text indicators
        level_lower = level_text.lower()
        if "director" in level_lower or "chief" in level_lower:
            return self.salary_scales["13-15"]
        elif "manager" in level_lower or "senior" in level_lower:
            return self.salary_scales["10-12"]
        elif "professional" in level_lower or "specialist" in level_lower:
            return self.salary_scales["7-9"]
        elif "admin" in level_lower or "officer" in level_lower:
            return self.salary_scales["4-6"]
        elif "assistant" in level_lower or "clerk" in level_lower:
            return self.salary_scales["1-3"]
        
        return None
    
    def _detect_job_level_from_title(self, title: str) -> str:
        """Detect job level from government job title."""
        title_lower = title.lower()
        
        if any(term in title_lower for term in ["director general", "deputy director general", "chief"]):
            return "c_suite"
        elif any(term in title_lower for term in ["director", "head of"]):
            return "director"
        elif any(term in title_lower for term in ["manager", "supervisor"]):
            return "manager"
        elif any(term in title_lower for term in ["senior", "specialist", "principal"]):
            return "senior"
        elif any(term in title_lower for term in ["junior", "assistant", "intern", "graduate"]):
            return "entry"
        elif any(term in title_lower for term in ["officer", "administrator", "analyst"]):
            return "mid"
        
        return "mid"
    
    def _parse_date(self, date_text: str) -> Optional[str]:
        """Parse closing date from text."""
        if not date_text:
            return None
        
        # Try various date formats
        from dateutil import parser
        try:
            parsed_date = parser.parse(date_text, fuzzy=True)
            return parsed_date.isoformat()
        except:
            return date_text  # Return as-is if parsing fails
    
    def _build_full_url(self, href: str, base_url: str) -> str:
        """Build full URL from href."""
        if href.startswith("http"):
            return href
        elif href.startswith("/"):
            return base_url + href
        else:
            return base_url + "/" + href
    
    def _passes_filters(
        self,
        job: Dict[str, Any],
        filters: Optional[Dict[str, Any]]
    ) -> bool:
        """Check if job passes filters."""
        if not filters:
            return True
        
        # Keywords filter
        if filters.get("keywords"):
            keywords = [k.lower() for k in filters["keywords"]]
            job_text = f"{job.get('title', '')} {job.get('department', '')}".lower()
            
            if not any(keyword in job_text for keyword in keywords):
                return False
        
        # Location filter
        if filters.get("location"):
            job_location = job.get("location", "").lower()
            filter_location = filters["location"].lower()
            
            if filter_location not in job_location:
                return False
        
        # Government-specific filters
        if filters.get("government_only"):
            if not job.get("is_government"):
                return False
        
        # Academic filter
        if filters.get("academic_only"):
            if not job.get("is_academic"):
                return False
        
        return True
    
    def _deduplicate_jobs(self, jobs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate jobs."""
        seen = set()
        unique_jobs = []
        
        for job in jobs:
            key = job.get("id")
            if key not in seen:
                seen.add(key)
                unique_jobs.append(job)
        
        return unique_jobs
    
    def _calculate_match_score(
        self,
        job: Dict[str, Any],
        filters: Dict[str, Any]
    ) -> float:
        """Calculate match score for government job."""
        if not filters:
            return 75.0  # Government jobs get higher base score
        
        score = 50.0  # Base score for government jobs
        
        # Keywords match (30 points)
        if filters.get("keywords"):
            keywords = [k.lower() for k in filters["keywords"]]
            job_text = f"{job.get('title', '')} {job.get('department', '')}".lower()
            
            matches = sum(1 for k in keywords if k in job_text)
            if keywords:
                score += (matches / len(keywords)) * 30
        
        # Location match (20 points)
        if filters.get("location"):
            if filters["location"].lower() in job.get("location", "").lower():
                score += 20
        
        # Government preference bonus (20 points)
        if job.get("is_government"):
            score += 20
        
        # Academic bonus (10 points)
        if job.get("is_academic") and filters.get("include_academic"):
            score += 10
        
        return min(100.0, round(score, 2))
    
    async def get_departments_list(self) -> List[str]:
        """Get list of all government departments with vacancies."""
        departments = set()
        
        # Quick scan of all portals
        results = await self.scrape()
        
        for job in results["jobs"]:
            if job.get("department"):
                departments.add(job["department"])
        
        return sorted(list(departments))
    
    async def parse_item(self, data: Any) -> Dict[str, Any]:
        """Parse individual item (not used for government scraping)."""
        pass
