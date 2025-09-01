"""
Simple verification script for SerpAPI quota management.
"""

import asyncio
from datetime import datetime
from src.scrapers.serpapi_scraper import SerpAPIScraper
from src.config.settings import settings
from loguru import logger


class MockSerpAPIScraper(SerpAPIScraper):
    """Mock version that doesn't make actual API calls."""
    
    async def _search_jobs(self, query: str):
        """Mock search that tests quota logic without API calls."""
        results = {"jobs": [], "companies": []}
        
        # Check quota limits (same logic as parent)
        current_time = datetime.utcnow()
        
        if current_time.hour != self.last_hour_reset:
            self.hourly_calls = 0
            self.last_hour_reset = current_time.hour
        
        if current_time.date() != self.last_day_reset:
            self.daily_calls = 0
            self.last_day_reset = current_time.date()
        
        # Quota enforcement
        if self.remaining_quota <= 0:
            logger.critical(" QUOTA EXHAUSTED")
            return results
        elif self.daily_calls >= self.daily_limit:
            logger.critical(f" DAILY LIMIT REACHED")
            return results
        elif self.hourly_calls >= self.hourly_limit:
            logger.critical(f" HOURLY LIMIT REACHED")
            return results
        
        # High-value check
        if self.free_tier_mode and self.high_value_only:
            if not self._is_high_value_query(query):
                logger.warning(f"Low-value query skipped: {query}")
                return results
        
        # Simulate successful search
        self.daily_calls += 1
        self.hourly_calls += 1
        self.remaining_quota -= 1
        self.used_quota += 1
        
        logger.info(f" SEARCH EXECUTED: {query}")
        logger.critical(f"QUOTA: {self.remaining_quota} remaining")
        
        return {
            "jobs": [{"id": "mock", "title": "Mock job", "company": {"name": "Test"}}],
            "companies": []
        }


async def main():
    print(" SerpAPI Quota Management Verification")
    print("=" * 50)
    
    scraper = MockSerpAPIScraper()
    
    # Check initial status
    print(f"\n Initial Status:")
    print(f"   Remaining quota: {scraper.remaining_quota}")
    print(f"   Daily limit: {scraper.daily_limit}")
    print(f"   Hourly limit: {scraper.hourly_limit}")
    
    # Test high-value queries
    high_value_queries = [
        "site:pnet.co.za developer jobs",
        "executive search cape town"
    ]
    
    print(f"\n Testing High-Value Queries:")
    for query in high_value_queries:
        result = await scraper._search_jobs(query)
        jobs_count = len(result["jobs"])
        print(f"   '{query}' -> {jobs_count} jobs")
    
    # Test low-value queries (should be skipped)
    print(f"\n Testing Low-Value Queries:")
    low_value_queries = ["random test", "generic search"]
    
    for query in low_value_queries:
        result = await scraper._search_jobs(query)
        jobs_count = len(result["jobs"])
        print(f"   '{query}' -> {jobs_count} jobs")
    
    # Final status
    print(f"\n Final Status:")
    print(f"   Used quota: {scraper.used_quota}")
    print(f"   Remaining quota: {scraper.remaining_quota}")
    print(f"   Daily calls: {scraper.daily_calls}")
    print(f"   Hourly calls: {scraper.hourly_calls}")
    
    print(f"\n Verification Complete!")


if __name__ == "__main__":
    asyncio.run(main())
