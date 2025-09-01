"""
Scrapy-based distributed job scraper for large-scale crawling.
Handles job boards and career pages at scale.
"""

import json
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Optional
from urllib.parse import urljoin, urlparse

import scrapy
from scrapy import signals
from scrapy.http import Request, Response
from scrapy_redis.spiders import RedisSpider
from scrapy.downloadermiddlewares.retry import RetryMiddleware
from scrapy.utils.response import response_status_message
from w3lib.html import remove_tags
import dateparser

from src.models.job_models import JobLevel, JobType
from src.utils.text_processor import TextProcessor
from src.utils.salary_parser import SalaryParser
from src.config.settings import settings


class JobSpider(RedisSpider):
    """Distributed job spider using Redis for coordination - NOW SERPAPI INTEGRATED."""
    
    name = "job_spider"
    redis_key = "job_spider:start_urls"
    
    #  SERPAPI INTEGRATION - Enhanced settings for real data processing
    custom_settings = {
        'CONCURRENT_REQUESTS': settings.max_concurrent_scrapers,
        'DOWNLOAD_DELAY': 1,
        'RANDOMIZE_DOWNLOAD_DELAY': True,
        'COOKIES_ENABLED': True,
        'ROBOTSTXT_OBEY': False,
        'USER_AGENT': 'AI-JobChommie-Bot/2.0 (+https://aijobchommie.com)',
        'DEFAULT_REQUEST_HEADERS': {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        },
        #  PROXY MIDDLEWARE WITH REAL KEYS
        'DOWNLOADER_MIDDLEWARES': {
            'scrapy.downloadermiddlewares.useragent.UserAgentMiddleware': None,
            'scrapy_useragents.downloadermiddlewares.useragents.UserAgentsMiddleware': 500,
            'rotating_proxies.middlewares.RotatingProxyMiddleware': 610,
            'rotating_proxies.middlewares.BanDetectionMiddleware': 620,
            'src.scrapers.middlewares.SerpAPIMiddleware': 550,  # Custom SerpAPI integration
            'src.scrapers.middlewares.CompanyEnrichmentMiddleware': 560,  # Company data enrichment
        },
        #  ENHANCED PIPELINES FOR REAL DATA
        'ITEM_PIPELINES': {
            'src.scrapers.pipelines.SerpAPIValidationPipeline': 250,  # Validate SerpAPI data
            'src.scrapers.pipelines.ValidationPipeline': 300,
            'src.scrapers.pipelines.CompanyEnrichmentPipeline': 350,  # Add company enrichment
            'src.scrapers.pipelines.EnrichmentPipeline': 400,
            'src.scrapers.pipelines.DatabasePipeline': 500,
            'src.scrapers.pipelines.KafkaPipeline': 600,
            'src.scrapers.pipelines.MetricsPipeline': 650,  # Track real vs mock data
        },
        'RETRY_TIMES': 3,
        'RETRY_HTTP_CODES': [500, 502, 503, 504, 408, 429],
        'AUTOTHROTTLE_ENABLED': True,
        'AUTOTHROTTLE_START_DELAY': 2,  # Slower for real scraping
        'AUTOTHROTTLE_MAX_DELAY': 120,  # Increased for anti-detection
        'AUTOTHROTTLE_TARGET_CONCURRENCY': 5,  # Reduced for stability
        'HTTPCACHE_ENABLED': True,
        'HTTPCACHE_EXPIRATION_SECS': 1800,  # 30 minutes cache for real data
        #  REAL API KEYS INTEGRATION
        'SERPAPI_KEY': settings.serpapi_api_key,
        'BRIGHT_DATA_KEY': settings.proxy_api_key,
        'ENABLE_REAL_SCRAPING': settings.enable_real_scraping,
    }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.text_processor = TextProcessor()
        self.salary_parser = SalaryParser()
        self.crawled_jobs = set()
        
        # Site-specific parsers
        self.site_parsers = {
            'linkedin.com': self.parse_linkedin_job,
            'indeed.com': self.parse_indeed_job,
            'glassdoor.com': self.parse_glassdoor_job,
            'careers.google.com': self.parse_company_career_page,
            'greenhouse.io': self.parse_greenhouse_job,
            'lever.co': self.parse_lever_job,
            'workday.com': self.parse_workday_job,
        }
    
    @classmethod
    def from_crawler(cls, crawler, *args, **kwargs):
        """Set up spider with crawler."""
        spider = super().from_crawler(crawler, *args, **kwargs)
        crawler.signals.connect(spider.spider_opened, signal=signals.spider_opened)
        crawler.signals.connect(spider.spider_closed, signal=signals.spider_closed)
        return spider
    
    def spider_opened(self, spider):
        """Called when spider is opened."""
        spider.logger.info(f'Spider opened: {spider.name}')
    
    def spider_closed(self, spider):
        """Called when spider is closed."""
        spider.logger.info(f'Spider closed: {spider.name}. Stats: {spider.crawler.stats.get_stats()}')
    
    def make_request_from_data(self, data):
        """Create request from Redis data."""
        if isinstance(data, bytes):
            data = data.decode('utf-8')
        
        try:
            # Try to parse as JSON for structured data
            job_data = json.loads(data)
            url = job_data.get('url')
            meta = job_data.get('meta', {})
        except:
            # Fall back to simple URL
            url = data
            meta = {}
        
        return Request(url, dont_filter=True, meta=meta, callback=self.parse)
    
    def parse(self, response: Response):
        """Main parse method that routes to specific parsers."""
        domain = urlparse(response.url).netloc
        
        # Find appropriate parser
        parser = None
        for site_pattern, parser_func in self.site_parsers.items():
            if site_pattern in domain:
                parser = parser_func
                break
        
        if parser:
            yield from parser(response)
        else:
            # Generic job page parser
            yield from self.parse_generic_job(response)
        
        # Follow pagination links
        yield from self.follow_pagination(response)
        
        # Extract and follow job links
        yield from self.extract_job_links(response)
    
    def parse_linkedin_job(self, response: Response):
        """Parse LinkedIn job posting."""
        job_id = self.generate_job_id(response.url)
        
        # Skip if already crawled
        if job_id in self.crawled_jobs:
            return
        
        self.crawled_jobs.add(job_id)
        
        # Extract job data
        job_data = {
            'id': job_id,
            'source_url': response.url,
            'source': 'linkedin',
            'scraped_at': datetime.utcnow().isoformat(),
        }
        
        # Title
        job_data['title'] = response.css('h1.topcard__title::text').get('').strip()
        
        # Company
        company_name = response.css('a.topcard__org-name-link::text').get('').strip()
        company_url = response.css('a.topcard__org-name-link::attr(href)').get()
        job_data['company'] = {
            'name': company_name,
            'linkedin_url': urljoin(response.url, company_url) if company_url else None
        }
        
        # Location
        location = response.css('span.topcard__flavor--bullet::text').get('').strip()
        job_data['location'] = self.text_processor.normalize_location(location)
        
        # Job details
        job_data['remote_type'] = self.extract_remote_type(response)
        job_data['job_type'] = self.extract_job_type(response)
        job_data['job_level'] = self.extract_job_level(response)
        
        # Description
        description_html = response.css('div.description__text').get('')
        job_data['description'] = self.text_processor.clean_html(description_html)
        
        # Extract structured data
        job_data.update(self.extract_structured_data(job_data['description']))
        
        # Skills
        job_data['skills'] = self.extract_skills(response)
        
        # Salary
        salary_info = self.extract_salary(response)
        job_data.update(salary_info)
        
        # Posted date
        posted_text = response.css('span.posted-time-ago__text::text').get('')
        job_data['posted_date'] = self.parse_posted_date(posted_text)
        
        # Application info
        job_data['application_count'] = self.extract_application_count(response)
        
        # Check if executive/headhunter posting
        job_data['is_executive'] = self.is_executive_position(job_data)
        job_data['is_headhunter_posted'] = self.is_headhunter_posting(response)
        
        yield job_data
        
        # Extract company details for enrichment
        if company_url:
            yield Request(
                urljoin(response.url, company_url),
                callback=self.parse_linkedin_company,
                meta={'company_name': company_name}
            )
    
    def parse_indeed_job(self, response: Response):
        """Parse Indeed job posting."""
        job_id = self.generate_job_id(response.url)
        
        if job_id in self.crawled_jobs:
            return
        
        self.crawled_jobs.add(job_id)
        
        job_data = {
            'id': job_id,
            'source_url': response.url,
            'source': 'indeed',
            'scraped_at': datetime.utcnow().isoformat(),
        }
        
        # Extract using Indeed's structure
        job_data['title'] = response.css('h1.jobsearch-JobInfoHeader-title::text').get('').strip()
        
        # Company info
        job_data['company'] = {
            'name': response.css('div[data-company-name]::text').get('').strip()
        }
        
        # Location
        location = response.css('div[data-testid="job-location"]::text').get('').strip()
        job_data['location'] = self.text_processor.normalize_location(location)
        
        # Job details
        job_data['description'] = response.css('div#jobDescriptionText').get('')
        job_data['description'] = self.text_processor.clean_html(job_data['description'])
        
        # Extract structured data
        job_data.update(self.extract_structured_data(job_data['description']))
        
        # Salary
        salary_text = response.css('div[data-testid="job-salary"]::text').get('')
        if salary_text:
            salary_info = self.salary_parser.parse(salary_text)
            job_data.update(salary_info)
        
        yield job_data
    
    def parse_glassdoor_job(self, response: Response):
        """Parse Glassdoor job posting."""
        # Similar structure to LinkedIn parser
        # Includes company reviews and culture data
        pass
    
    def parse_company_career_page(self, response: Response):
        """Parse generic company career page."""
        # Extract job listings from career pages
        job_links = response.css('a[href*="job"], a[href*="career"], a[href*="position"]::attr(href)').getall()
        
        for link in job_links:
            absolute_url = urljoin(response.url, link)
            yield Request(absolute_url, callback=self.parse_generic_job)
    
    def parse_generic_job(self, response: Response):
        """Generic job parser using common patterns."""
        job_id = self.generate_job_id(response.url)
        
        if job_id in self.crawled_jobs:
            return
        
        self.crawled_jobs.add(job_id)
        
        job_data = {
            'id': job_id,
            'source_url': response.url,
            'source': urlparse(response.url).netloc,
            'scraped_at': datetime.utcnow().isoformat(),
        }
        
        # Try common title selectors
        title_selectors = [
            'h1::text',
            'h1.job-title::text',
            'h2.job-title::text',
            '[class*="title"]::text',
            '[itemprop="title"]::text'
        ]
        
        for selector in title_selectors:
            title = response.css(selector).get()
            if title:
                job_data['title'] = title.strip()
                break
        
        # Extract job description
        description_selectors = [
            '[class*="description"]',
            '[id*="description"]',
            '[itemprop="description"]',
            'div.job-description',
            'section.description'
        ]
        
        for selector in description_selectors:
            description = response.css(selector).get()
            if description:
                job_data['description'] = self.text_processor.clean_html(description)
                break
        
        # Extract structured data from description
        if job_data.get('description'):
            job_data.update(self.extract_structured_data(job_data['description']))
        
        # Try to extract company name
        company_selectors = [
            '[class*="company"]::text',
            '[itemprop="hiringOrganization"]::text',
            'a[href*="company"]::text'
        ]
        
        for selector in company_selectors:
            company = response.css(selector).get()
            if company:
                job_data['company'] = {'name': company.strip()}
                break
        
        # Location extraction
        location_selectors = [
            '[class*="location"]::text',
            '[itemprop="jobLocation"]::text',
            '[id*="location"]::text'
        ]
        
        for selector in location_selectors:
            location = response.css(selector).get()
            if location:
                job_data['location'] = self.text_processor.normalize_location(location.strip())
                break
        
        yield job_data
    
    def extract_structured_data(self, description: str) -> Dict[str, Any]:
        """Extract structured data from job description."""
        data = {}
        
        # Split into sections
        sections = self.text_processor.split_into_sections(description)
        
        # Requirements
        if 'requirements' in sections or 'qualifications' in sections:
            data['requirements'] = sections.get('requirements') or sections.get('qualifications')
        
        # Responsibilities
        if 'responsibilities' in sections or 'duties' in sections:
            data['responsibilities'] = sections.get('responsibilities') or sections.get('duties')
        
        # Benefits
        if 'benefits' in sections or 'perks' in sections:
            benefits_text = sections.get('benefits') or sections.get('perks', '')
            data['benefits'] = self.text_processor.extract_list_items(benefits_text)
        
        # Skills
        data['skills'] = self.text_processor.extract_skills(description)
        
        # Experience level
        data['job_level'] = self.text_processor.extract_experience_level(description)
        
        return data
    
    def extract_skills(self, response: Response) -> List[str]:
        """Extract skills from job posting."""
        skills = []
        
        # Look for skills sections
        skills_selectors = [
            '[class*="skill"]::text',
            'ul.skills li::text',
            '[data-skill]::text'
        ]
        
        for selector in skills_selectors:
            found_skills = response.css(selector).getall()
            skills.extend([s.strip() for s in found_skills])
        
        # Also extract from description
        description = response.css('body').get('')
        skills.extend(self.text_processor.extract_skills(description))
        
        # Deduplicate and clean
        return list(set(s for s in skills if s))
    
    def extract_salary(self, response: Response) -> Dict[str, Any]:
        """Extract salary information."""
        salary_selectors = [
            '[class*="salary"]::text',
            '[data-salary]::text',
            '[itemprop="baseSalary"]::text'
        ]
        
        for selector in salary_selectors:
            salary_text = response.css(selector).get()
            if salary_text:
                return self.salary_parser.parse(salary_text)
        
        # Try to find in description
        description = response.css('body').get('')
        salary_mentions = self.salary_parser.find_salary_mentions(description)
        if salary_mentions:
            return self.salary_parser.parse(salary_mentions[0])
        
        return {}
    
    def extract_remote_type(self, response: Response) -> str:
        """Determine remote work type."""
        text = response.css('body').get('').lower()
        
        if any(term in text for term in ['remote', 'work from home', 'wfh', 'distributed']):
            if any(term in text for term in ['hybrid', 'flexible']):
                return 'hybrid'
            return 'remote'
        
        return 'onsite'
    
    def extract_job_type(self, response: Response) -> str:
        """Extract job type (full-time, part-time, etc.)."""
        text = response.css('body').get('').lower()
        
        job_types = {
            'full-time': ['full-time', 'full time', 'permanent'],
            'part-time': ['part-time', 'part time'],
            'contract': ['contract', 'contractor', 'freelance'],
            'internship': ['intern', 'internship'],
            'temporary': ['temporary', 'temp']
        }
        
        for job_type, keywords in job_types.items():
            if any(keyword in text for keyword in keywords):
                return job_type
        
        return 'full-time'  # Default
    
    def extract_job_level(self, response: Response) -> str:
        """Extract job level from posting."""
        title = response.css('h1::text').get('').lower()
        description = response.css('body').get('').lower()
        
        # Check title first
        level_indicators = {
            'c_suite': ['ceo', 'cto', 'cfo', 'coo', 'cmo', 'chief'],
            'executive': ['executive', 'vp', 'vice president', 'director'],
            'manager': ['manager', 'head of', 'lead'],
            'senior': ['senior', 'sr.', 'principal'],
            'mid': ['mid-level', 'intermediate'],
            'entry': ['junior', 'jr.', 'entry', 'graduate']
        }
        
        for level, indicators in level_indicators.items():
            if any(ind in title for ind in indicators):
                return level
        
        # Check experience requirements in description
        return self.text_processor.extract_experience_level(description)
    
    def is_executive_position(self, job_data: Dict[str, Any]) -> bool:
        """Check if position is executive level."""
        executive_levels = ['executive', 'director', 'c_suite']
        return job_data.get('job_level') in executive_levels
    
    def is_headhunter_posting(self, response: Response) -> bool:
        """Check if posting is from headhunter/recruiter."""
        text = response.css('body').get('').lower()
        
        headhunter_indicators = [
            'executive search',
            'recruitment agency',
            'staffing',
            'talent acquisition',
            'confidential',
            'our client'
        ]
        
        return any(indicator in text for indicator in headhunter_indicators)
    
    def extract_application_count(self, response: Response) -> Optional[int]:
        """Extract number of applications if available."""
        # LinkedIn specific
        app_count = response.css('span.num-applicants__caption::text').get()
        if app_count:
            # Extract number from text like "200 applicants"
            import re
            numbers = re.findall(r'\d+', app_count)
            if numbers:
                return int(numbers[0])
        
        return None
    
    def parse_posted_date(self, posted_text: str) -> Optional[str]:
        """Parse posted date from relative text."""
        if posted_text:
            parsed_date = dateparser.parse(posted_text)
            if parsed_date:
                return parsed_date.isoformat()
        
        return None
    
    def generate_job_id(self, url: str) -> str:
        """Generate unique job ID from URL."""
        return hashlib.md5(url.encode()).hexdigest()
    
    def follow_pagination(self, response: Response):
        """Extract and follow pagination links."""
        # Common pagination selectors
        pagination_selectors = [
            'a.next::attr(href)',
            'a[aria-label="Next"]::attr(href)',
            'a[rel="next"]::attr(href)',
            '[class*="pagination"] a::attr(href)'
        ]
        
        for selector in pagination_selectors:
            next_page = response.css(selector).get()
            if next_page:
                yield Request(urljoin(response.url, next_page), callback=self.parse)
                break
    
    def extract_job_links(self, response: Response):
        """Extract job listing links from index pages."""
        # Common job link patterns
        job_link_selectors = [
            'a[href*="/job/"]::attr(href)',
            'a[href*="/jobs/"]::attr(href)',
            'a[href*="/career/"]::attr(href)',
            'a[href*="/position/"]::attr(href)',
            'a.job-link::attr(href)',
            '[class*="job-title"] a::attr(href)'
        ]
        
        job_urls = set()
        for selector in job_link_selectors:
            urls = response.css(selector).getall()
            job_urls.update(urls)
        
        for url in job_urls:
            absolute_url = urljoin(response.url, url)
            yield Request(absolute_url, callback=self.parse)
    
    #  NEW SERPAPI INTEGRATION METHODS
    
    def make_request_from_serpapi_data(self, serpapi_job_data: Dict[str, Any]):
        """Create Scrapy request from SerpAPI job data."""
        
        # Extract URL from SerpAPI result
        job_url = serpapi_job_data.get('link') or serpapi_job_data.get('url')
        
        if not job_url:
            # If no direct URL, create a synthetic item
            return self.create_item_from_serpapi_data(serpapi_job_data)
        
        # Create request with SerpAPI metadata
        meta = {
            'serpapi_data': serpapi_job_data,
            'source': 'serpapi',
            'enrichment_ready': True
        }
        
        return Request(
            url=job_url,
            callback=self.parse_serpapi_enhanced_job,
            meta=meta,
            dont_filter=True  # Allow processing of SerpAPI-sourced jobs
        )
    
    def create_item_from_serpapi_data(self, serpapi_data: Dict[str, Any]):
        """Create job item directly from SerpAPI data when no URL is available."""
        
        job_id = self.generate_job_id(serpapi_data.get('link', '') + str(serpapi_data.get('position', '')))
        
        # Build comprehensive job data from SerpAPI
        job_item = {
            'id': job_id,
            'source': 'serpapi',
            'source_url': serpapi_data.get('link'),
            'scraped_at': datetime.utcnow().isoformat(),
            'serpapi_enriched': True,
            
            # Core job information
            'title': serpapi_data.get('title', ''),
            'company': {
                'name': serpapi_data.get('company_name', ''),
                'rating': serpapi_data.get('rating'),
                'reviews_count': serpapi_data.get('reviews_count')
            },
            'location': serpapi_data.get('location', ''),
            'description': serpapi_data.get('description', ''),
            
            # SerpAPI specific fields
            'posted_at': serpapi_data.get('posted_at'),
            'schedule_type': serpapi_data.get('schedule_type'),
            'work_from_home': serpapi_data.get('work_from_home', False),
            
            # Salary information if available
            'salary_min': self._extract_salary_min(serpapi_data),
            'salary_max': self._extract_salary_max(serpapi_data),
            'salary_currency': serpapi_data.get('salary', {}).get('currency', 'ZAR'),
            
            # Job metadata
            'job_highlights': serpapi_data.get('job_highlights', {}),
            'related_links': serpapi_data.get('related_links', []),
            'thumbnail': serpapi_data.get('thumbnail'),
            
            # South African context
            'country_code': 'ZA',
            'currency': 'ZAR',
            'market': 'south_africa'
        }
        
        # Process highlights for structured data
        highlights = serpapi_data.get('job_highlights', {})
        if highlights:
            job_item['qualifications'] = highlights.get('Qualifications', [])
            job_item['responsibilities'] = highlights.get('Responsibilities', [])
            job_item['benefits'] = highlights.get('Benefits', [])
        
        # Determine job level and type from title and description
        job_text = f"{job_item['title']} {job_item['description']}".lower()
        job_item['job_level'] = self._determine_job_level_from_text(job_text)
        job_item['job_type'] = self._determine_job_type_from_serpapi(serpapi_data)
        job_item['remote_type'] = 'remote' if job_item['work_from_home'] else 'onsite'
        
        # Extract skills from description
        if job_item['description']:
            job_item['skills'] = self.text_processor.extract_skills(job_item['description'])
        
        return job_item
    
    def parse_serpapi_enhanced_job(self, response: Response):
        """Parse job page with SerpAPI data enhancement."""
        
        serpapi_data = response.meta.get('serpapi_data', {})
        
        # Start with SerpAPI data as base
        job_item = self.create_item_from_serpapi_data(serpapi_data)
        
        # Enhance with scraped data if available
        try:
            # Try to extract additional details from the actual job page
            scraped_title = response.css('h1::text').get()
            if scraped_title and not job_item['title']:
                job_item['title'] = scraped_title.strip()
            
            # Get full description if SerpAPI version was truncated
            full_description = self._extract_full_description(response)
            if full_description and len(full_description) > len(job_item.get('description', '')):
                job_item['description'] = full_description
                # Re-extract skills with full description
                job_item['skills'] = self.text_processor.extract_skills(full_description)
            
            # Extract additional structured data
            structured_data = self.extract_structured_data(job_item['description'])
            job_item.update(structured_data)
            
            # Get salary if not in SerpAPI data
            if not job_item.get('salary_min') and not job_item.get('salary_max'):
                salary_info = self.extract_salary(response)
                job_item.update(salary_info)
            
            # Mark as enhanced
            job_item['page_scraped'] = True
            job_item['enhancement_source'] = 'scrapy_page'
            
        except Exception as e:
            # Log error but don't fail the item
            self.logger.warning(f"Failed to enhance SerpAPI job {job_item['id']}: {e}")
            job_item['page_scraped'] = False
            job_item['enhancement_error'] = str(e)
        
        yield job_item
    
    def _extract_full_description(self, response: Response) -> str:
        """Extract full job description from page."""
        description_selectors = [
            'div.description__text',
            '[class*="job-description"]',
            '[class*="description"]',
            '[id*="description"]',
            'section.description',
            'div.job-details'
        ]
        
        for selector in description_selectors:
            desc_elem = response.css(selector).get()
            if desc_elem:
                return self.text_processor.clean_html(desc_elem)
        
        return ''
    
    def _extract_salary_min(self, serpapi_data: Dict[str, Any]) -> Optional[float]:
        """Extract minimum salary from SerpAPI data."""
        salary_info = serpapi_data.get('salary', {})
        
        if isinstance(salary_info, dict):
            return salary_info.get('min')
        elif isinstance(salary_info, str):
            # Parse salary string
            salary_parsed = self.salary_parser.parse(salary_info)
            return salary_parsed.get('salary_min')
        
        return None
    
    def _extract_salary_max(self, serpapi_data: Dict[str, Any]) -> Optional[float]:
        """Extract maximum salary from SerpAPI data."""
        salary_info = serpapi_data.get('salary', {})
        
        if isinstance(salary_info, dict):
            return salary_info.get('max')
        elif isinstance(salary_info, str):
            # Parse salary string
            salary_parsed = self.salary_parser.parse(salary_info)
            return salary_parsed.get('salary_max')
        
        return None
    
    def _determine_job_level_from_text(self, job_text: str) -> str:
        """Determine job level from combined title and description text."""
        
        level_patterns = {
            'c_suite': ['ceo', 'cto', 'cfo', 'coo', 'cmo', 'chief executive', 'chief technology', 'chief financial'],
            'executive': ['executive', 'vp', 'vice president', 'director', 'head of department'],
            'manager': ['manager', 'head of', 'team lead', 'supervisor', 'coordinator'],
            'senior': ['senior', 'sr.', 'principal', 'lead', '5+ years', '7+ years'],
            'mid': ['mid-level', 'intermediate', '2-5 years', '3+ years'],
            'entry': ['junior', 'jr.', 'entry level', 'graduate', 'trainee', '0-2 years', 'no experience']
        }
        
        for level, patterns in level_patterns.items():
            if any(pattern in job_text for pattern in patterns):
                return level
        
        # Default based on years of experience if mentioned
        import re
        years_match = re.search(r'(\d+)\s*(?:\+|-)\s*years?', job_text)
        if years_match:
            years = int(years_match.group(1))
            if years >= 7:
                return 'senior'
            elif years >= 3:
                return 'mid'
            elif years >= 1:
                return 'entry'
        
        return 'mid'  # Default assumption
    
    def _determine_job_type_from_serpapi(self, serpapi_data: Dict[str, Any]) -> str:
        """Determine job type from SerpAPI schedule_type and other fields."""
        
        schedule_type = serpapi_data.get('schedule_type', '').lower()
        
        if 'full' in schedule_type or 'permanent' in schedule_type:
            return 'full-time'
        elif 'part' in schedule_type:
            return 'part-time'
        elif 'contract' in schedule_type or 'temporary' in schedule_type:
            return 'contract'
        elif 'intern' in schedule_type:
            return 'internship'
        
        # Check title and description
        title = serpapi_data.get('title', '').lower()
        description = serpapi_data.get('description', '').lower()
        combined_text = f'{title} {description}'
        
        if 'intern' in combined_text:
            return 'internship'
        elif any(term in combined_text for term in ['contract', 'contractor', 'freelance']):
            return 'contract'
        elif any(term in combined_text for term in ['part-time', 'part time']):
            return 'part-time'
        
        return 'full-time'  # Default
    
    def process_serpapi_job_batch(self, serpapi_jobs: List[Dict[str, Any]]):
        """Process a batch of SerpAPI jobs for Scrapy processing."""
        
        self.logger.info(f"Processing batch of {len(serpapi_jobs)} SerpAPI jobs")
        
        for job_data in serpapi_jobs:
            try:
                # Create either a request for further scraping or a direct item
                if job_data.get('link'):
                    # Has URL - create request for enhanced scraping
                    request = self.make_request_from_serpapi_data(job_data)
                    if hasattr(request, 'callback'):  # It's a Request object
                        yield request
                    else:  # It's a direct item
                        yield request
                else:
                    # No URL - create item directly from SerpAPI data
                    job_item = self.create_item_from_serpapi_data(job_data)
                    yield job_item
                    
            except Exception as e:
                self.logger.error(f"Error processing SerpAPI job: {e}")
                continue
