"""
Optimized Job Scheduler
Achieves 1000+ jobs daily with minimal SerpAPI usage
"""

import asyncio
from datetime import datetime, timedelta
import schedule
import time
from typing import Dict, List, Any
from loguru import logger
import json
import os
from pathlib import Path

# Add parent directory to path
import sys
sys.path.append(str(Path(__file__).parent.parent))

from scrapers.rss_parser import RSSFeedParser
from scrapers.government_scraper import GovernmentPortalScraper
from scrapers.serpapi_scraper import SerpAPIScraper
from scrapers.company_scraper import CompanyScraper
from scrapers.rss_feeds_expanded import RSS_FEEDS_EXPANDED, get_feeds_by_priority


class OptimizedJobScheduler:
    """
    Smart scheduler that prioritizes FREE sources
    Only uses SerpAPI for high-value searches
    """
    
    def __init__(self):
        # Initialize scrapers
        self.rss_parser = RSSFeedParser()
        self.government_scraper = GovernmentPortalScraper()
        self.serpapi_scraper = SerpAPIScraper()
        self.company_scraper = CompanyScraper()
        
        # Daily quotas
        self.daily_targets = {
            "rss": 500,
            "government": 250,
            "companies": 200,
            "serpapi": 50
        }
        
        # Daily tracking
        self.daily_stats = {
            "jobs_collected": 0,
            "serpapi_searches": 0,
            "rss_feeds_checked": 0,
            "government_portals_checked": 0,
            "companies_checked": 0,
            "duplicates_avoided": 0
        }
        
        # Job deduplication
        self.seen_jobs = set()  # Store hashes of (title, company, location)
        
        # Cache settings
        self.cache = {
            "rss": {},  # Cache RSS results for 3 hours
            "government": {},  # Cache government for 6 hours
            "companies": {}  # Cache company pages for 12 hours
        }
        
        logger.info("Optimized Job Scheduler initialized")
        logger.info(f"Target: {sum(self.daily_targets.values())} jobs/day")
        logger.info(f"SerpAPI budget: 8 searches/day max")
    
    async def run_rss_batch(self, priority: str = "all") -> List[Dict[str, Any]]:
        """Run RSS feed batch based on priority."""
        jobs = []
        feeds_to_check = []
        
        if priority == "all":
            from scrapers.rss_feeds_expanded import get_all_rss_feeds
            feeds_to_check = get_all_rss_feeds()
        else:
            priority_feeds = get_feeds_by_priority()
            if priority in priority_feeds:
                feeds_to_check = priority_feeds[priority]
        
        logger.info(f"Checking {len(feeds_to_check)} RSS feeds (priority: {priority})")
        
        # Update RSS parser with expanded feeds
        self.rss_parser.rss_feeds = RSS_FEEDS_EXPANDED
        
        # Check cache first
        for feed_url in feeds_to_check:
            cache_key = f"rss_{feed_url}"
            if cache_key in self.cache["rss"]:
                cached_time, cached_jobs = self.cache["rss"][cache_key]
                if (datetime.now() - cached_time).seconds < 10800:  # 3 hours
                    jobs.extend(cached_jobs)
                    logger.debug(f"Using cached results for {feed_url}")
                    continue
            
            # Fetch fresh data
            try:
                result = await self.rss_parser._parse_feed(feed_url, "RSS", None)
                jobs.extend(result)
                
                # Cache results
                self.cache["rss"][cache_key] = (datetime.now(), result)
                self.daily_stats["rss_feeds_checked"] += 1
                
                # Small delay to be respectful
                await asyncio.sleep(0.5)
                
            except Exception as e:
                logger.error(f"Error parsing RSS feed {feed_url}: {e}")
        
        # Deduplicate
        unique_jobs = self._deduplicate_jobs(jobs)
        logger.success(f"Collected {len(unique_jobs)} unique jobs from RSS feeds")
        
        return unique_jobs
    
    async def run_government_batch(self) -> List[Dict[str, Any]]:
        """Run government portal scraping."""
        logger.info("Checking government portals...")
        
        # Check cache
        cache_key = "government_all"
        if cache_key in self.cache["government"]:
            cached_time, cached_jobs = self.cache["government"][cache_key]
            if (datetime.now() - cached_time).seconds < 21600:  # 6 hours
                logger.debug("Using cached government results")
                return cached_jobs
        
        # Fetch fresh data
        result = await self.government_scraper.scrape()
        jobs = result.get("jobs", [])
        
        # Cache results
        self.cache["government"][cache_key] = (datetime.now(), jobs)
        self.daily_stats["government_portals_checked"] += len(result.get("departments", []))
        
        unique_jobs = self._deduplicate_jobs(jobs)
        logger.success(f"Collected {len(unique_jobs)} unique jobs from government portals")
        
        return unique_jobs
    
    async def run_company_batch(self, companies: List[str] = None) -> List[Dict[str, Any]]:
        """Run company career page scraping."""
        if not companies:
            # Default top SA companies
            companies = [
                "shoprite", "pick_n_pay", "woolworths", "checkers",
                "standard_bank", "fnb", "absa", "capitec",
                "vodacom", "mtn", "telkom", "sasol"
            ]
        
        logger.info(f"Checking {len(companies)} company career pages...")
        all_jobs = []
        
        for company in companies:
            # Check cache
            cache_key = f"company_{company}"
            if cache_key in self.cache["companies"]:
                cached_time, cached_jobs = self.cache["companies"][cache_key]
                if (datetime.now() - cached_time).seconds < 43200:  # 12 hours
                    all_jobs.extend(cached_jobs)
                    continue
            
            try:
                jobs = await self.company_scraper.scrape_company_jobs(company, max_pages=2)
                all_jobs.extend([self._job_to_dict(job) for job in jobs])
                
                # Cache results
                self.cache["companies"][cache_key] = (datetime.now(), jobs)
                self.daily_stats["companies_checked"] += 1
                
                await asyncio.sleep(2)  # Rate limiting
                
            except Exception as e:
                logger.error(f"Error scraping {company}: {e}")
        
        unique_jobs = self._deduplicate_jobs(all_jobs)
        logger.success(f"Collected {len(unique_jobs)} unique jobs from company pages")
        
        return unique_jobs
    
    async def run_serpapi_strategic(self, search_type: str = "fresh") -> List[Dict[str, Any]]:
        """
        Strategic SerpAPI usage - only for high-value searches
        Types: fresh, executive, specific, gap_fill
        """
        
        # Check daily limit
        if self.daily_stats["serpapi_searches"] >= 8:
            logger.warning("Daily SerpAPI limit reached (8 searches)")
            return []
        
        jobs = []
        filters = {}
        
        if search_type == "fresh":
            # Get jobs posted today
            filters = {
                "keywords": ["posted today", "new"],
                "location": "South Africa"
            }
            logger.info("SerpAPI: Searching for fresh jobs posted today")
            
        elif search_type == "executive":
            # High-value executive positions
            filters = {
                "keywords": ["CEO", "CFO", "CTO", "director", "executive"],
                "job_level": "executive",
                "location": "South Africa"
            }
            logger.info("SerpAPI: Searching for executive positions")
            
        elif search_type == "gap_fill":
            # Fill gaps if we're below target
            current_total = self.daily_stats["jobs_collected"]
            if current_total < 800:  # Only if we really need more
                filters = {
                    "keywords": ["hiring", "vacancy"],
                    "location": "Cape Town"
                }
                logger.info("SerpAPI: Gap filling to reach daily target")
            else:
                logger.info("No gap filling needed - target already met")
                return []
        
        try:
            result = await self.serpapi_scraper.scrape(filters=filters)
            jobs = result.get("jobs", [])
            self.daily_stats["serpapi_searches"] += result.get("api_calls", 1)
            
            # Log quota status
            quota_status = self.serpapi_scraper.get_quota_status()
            logger.critical(
                f"SerpAPI used: {self.daily_stats['serpapi_searches']}/8 daily | "
                f"Monthly: {quota_status['used_quota']}/{quota_status['monthly_quota']}"
            )
            
        except Exception as e:
            logger.error(f"SerpAPI error: {e}")
        
        unique_jobs = self._deduplicate_jobs(jobs)
        logger.success(f"Collected {len(unique_jobs)} unique jobs from SerpAPI")
        
        return unique_jobs
    
    def _deduplicate_jobs(self, jobs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate jobs based on title, company, location."""
        unique_jobs = []
        
        for job in jobs:
            # Create unique hash
            job_hash = self._get_job_hash(job)
            
            if job_hash not in self.seen_jobs:
                self.seen_jobs.add(job_hash)
                unique_jobs.append(job)
            else:
                self.daily_stats["duplicates_avoided"] += 1
        
        return unique_jobs
    
    def _get_job_hash(self, job: Dict[str, Any]) -> str:
        """Create unique hash for job."""
        title = job.get("title", "").lower().strip()
        company = job.get("company", {})
        if isinstance(company, dict):
            company = company.get("name", "")
        company = str(company).lower().strip()
        location = job.get("location", "").lower().strip()
        
        return f"{title}_{company}_{location}"
    
    def _job_to_dict(self, job) -> Dict[str, Any]:
        """Convert Job object to dictionary."""
        if hasattr(job, '__dict__'):
            return job.__dict__
        return job
    
    async def run_scheduled_batch(self, hour: int) -> Dict[str, Any]:
        """Run scheduled batch based on hour of day."""
        logger.info(f"Running scheduled batch for {hour:02d}:00")
        
        all_jobs = []
        batch_stats = {
            "hour": hour,
            "sources_checked": [],
            "jobs_collected": 0
        }
        
        # Schedule based on hour
        if hour == 0:  # Midnight
            jobs = await self.run_rss_batch("high_priority")
            all_jobs.extend(jobs)
            batch_stats["sources_checked"].append("rss_high")
            
        elif hour == 6:  # Morning
            jobs = await self.run_rss_batch("high_priority")
            all_jobs.extend(jobs)
            jobs = await self.run_rss_batch("medium_priority")
            all_jobs.extend(jobs)
            jobs = await self.run_serpapi_strategic("fresh")
            all_jobs.extend(jobs)
            batch_stats["sources_checked"].extend(["rss_high", "rss_medium", "serpapi_fresh"])
            
        elif hour == 9:  # Business hours
            jobs = await self.run_government_batch()
            all_jobs.extend(jobs)
            jobs = await self.run_company_batch()
            all_jobs.extend(jobs)
            batch_stats["sources_checked"].extend(["government", "companies"])
            
        elif hour == 12:  # Lunch - full scan
            jobs = await self.run_rss_batch("all")
            all_jobs.extend(jobs)
            jobs = await self.run_government_batch()
            all_jobs.extend(jobs)
            batch_stats["sources_checked"].extend(["rss_all", "government"])
            
        elif hour == 15:  # Afternoon
            jobs = await self.run_rss_batch("high_priority")
            all_jobs.extend(jobs)
            jobs = await self.run_serpapi_strategic("executive")
            all_jobs.extend(jobs)
            batch_stats["sources_checked"].extend(["rss_high", "serpapi_executive"])
            
        elif hour == 18:  # End of day
            jobs = await self.run_rss_batch("high_priority")
            all_jobs.extend(jobs)
            jobs = await self.run_rss_batch("medium_priority")
            all_jobs.extend(jobs)
            jobs = await self.run_company_batch()
            all_jobs.extend(jobs)
            batch_stats["sources_checked"].extend(["rss_high", "rss_medium", "companies"])
            
        elif hour == 21:  # Evening
            jobs = await self.run_rss_batch("low_priority")
            all_jobs.extend(jobs)
            # Check if we need gap filling
            if self.daily_stats["jobs_collected"] < 900:
                jobs = await self.run_serpapi_strategic("gap_fill")
                all_jobs.extend(jobs)
                batch_stats["sources_checked"].append("serpapi_gap")
            batch_stats["sources_checked"].append("rss_low")
        
        # Update stats
        batch_stats["jobs_collected"] = len(all_jobs)
        self.daily_stats["jobs_collected"] += len(all_jobs)
        
        # Save jobs to file
        await self._save_jobs(all_jobs, hour)
        
        # Log progress
        logger.success(
            f"Batch complete: {len(all_jobs)} new jobs | "
            f"Daily total: {self.daily_stats['jobs_collected']} | "
            f"Duplicates avoided: {self.daily_stats['duplicates_avoided']}"
        )
        
        return batch_stats
    
    async def _save_jobs(self, jobs: List[Dict[str, Any]], hour: int):
        """Save jobs to file."""
        if not jobs:
            return
        
        date_str = datetime.now().strftime("%Y%m%d")
        filename = f"jobs_{date_str}_{hour:02d}00.json"
        filepath = Path(f"data/jobs/{date_str}/{filename}")
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        with open(filepath, "w") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "hour": hour,
                "count": len(jobs),
                "jobs": jobs
            }, f, indent=2, default=str)
        
        logger.info(f"Saved {len(jobs)} jobs to {filename}")
    
    async def run_daily_schedule(self):
        """Run the complete daily schedule."""
        logger.info("Starting daily schedule to collect 1000+ jobs")
        
        # Reset daily stats
        self.daily_stats = {
            "jobs_collected": 0,
            "serpapi_searches": 0,
            "rss_feeds_checked": 0,
            "government_portals_checked": 0,
            "companies_checked": 0,
            "duplicates_avoided": 0
        }
        
        # Clear old job hashes (keep last 24 hours)
        self.seen_jobs.clear()
        
        # Run scheduled batches
        schedule_hours = [0, 6, 9, 12, 15, 18, 21]
        
        for hour in schedule_hours:
            await self.run_scheduled_batch(hour)
            
            # Show progress
            progress = (self.daily_stats["jobs_collected"] / 1000) * 100
            logger.info(
                f"Progress: {self.daily_stats['jobs_collected']}/1000 jobs "
                f"({progress:.1f}%) | SerpAPI: {self.daily_stats['serpapi_searches']}/8"
            )
            
            # Sleep until next scheduled time (in production)
            # await asyncio.sleep(3600)  # 1 hour
        
        # Final summary
        logger.success("="*60)
        logger.success("DAILY SCHEDULE COMPLETE")
        logger.success(f"Total jobs collected: {self.daily_stats['jobs_collected']}")
        logger.success(f"SerpAPI searches used: {self.daily_stats['serpapi_searches']}/8")
        logger.success(f"RSS feeds checked: {self.daily_stats['rss_feeds_checked']}")
        logger.success(f"Government portals: {self.daily_stats['government_portals_checked']}")
        logger.success(f"Companies checked: {self.daily_stats['companies_checked']}")
        logger.success(f"Duplicates avoided: {self.daily_stats['duplicates_avoided']}")
        logger.success("="*60)
        
        return self.daily_stats
    
    def get_daily_summary(self) -> Dict[str, Any]:
        """Get summary of daily performance."""
        return {
            "stats": self.daily_stats,
            "target_achieved": self.daily_stats["jobs_collected"] >= 1000,
            "serpapi_budget_ok": self.daily_stats["serpapi_searches"] <= 8,
            "efficiency": {
                "jobs_per_serpapi": (
                    self.daily_stats["jobs_collected"] / max(1, self.daily_stats["serpapi_searches"])
                ),
                "duplicate_rate": (
                    self.daily_stats["duplicates_avoided"] / 
                    max(1, self.daily_stats["jobs_collected"] + self.daily_stats["duplicates_avoided"])
                )
            }
        }


async def main():
    """Run the optimized scheduler."""
    scheduler = OptimizedJobScheduler()
    
    # Run full daily schedule
    await scheduler.run_daily_schedule()
    
    # Show summary
    summary = scheduler.get_daily_summary()
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
