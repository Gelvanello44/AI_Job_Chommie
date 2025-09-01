"""
Automated quota scheduler for SerpAPI month transitions.
Ensures quota resets happen automatically when moving to new months.
"""

import asyncio
import schedule
import time
from datetime import datetime, timedelta
from typing import Optional
from loguru import logger

from src.scrapers.serpapi_scraper import SerpAPIScraper
from src.config.settings import settings


class QuotaScheduler:
    """Automated scheduler for SerpAPI quota management."""
    
    def __init__(self):
        self.scraper_instance: Optional[SerpAPIScraper] = None
        self.is_running = False
        
    def initialize_scraper(self):
        """Initialize SerpAPI scraper instance."""
        try:
            self.scraper_instance = SerpAPIScraper()
            logger.info("Quota scheduler initialized with SerpAPI scraper")
        except Exception as e:
            logger.error(f"Failed to initialize scraper for quota scheduler: {e}")
    
    def check_monthly_transition(self):
        """Check for monthly transition and handle quota reset."""
        if not self.scraper_instance:
            self.initialize_scraper()
            
        if self.scraper_instance:
            try:
                # This will automatically detect and handle month transitions
                self.scraper_instance._check_and_handle_month_transition()
                
                # Log current status
                current_date = datetime.utcnow()
                month_name = self.scraper_instance._get_month_name(current_date.month)
                
                logger.info(f" Monthly quota check complete for {month_name} {current_date.year}")
                logger.info(f" Current quota: {self.scraper_instance.remaining_quota}/{self.scraper_instance.monthly_quota}")
                logger.info(f" Daily limit: {self.scraper_instance.daily_limit} searches/day")
                
            except Exception as e:
                logger.error(f"Monthly transition check failed: {e}")
    
    def check_september_2025_special(self):
        """Special handler for September 1, 2025 transition."""
        current_date = datetime.utcnow()
        
        # Check if it's September 1, 2025
        if current_date.year == 2025 and current_date.month == 9 and current_date.day == 1:
            logger.critical(" SEPTEMBER 1, 2025 - SPECIAL QUOTA ADJUSTMENT ACTIVATED!")
            
            if self.scraper_instance:
                # Force recalculation of daily limit for September
                new_daily_limit = self.scraper_instance._calculate_dynamic_daily_limit()
                
                # Update settings
                settings.serpapi_daily_limit = new_daily_limit
                
                logger.critical(f" SEPTEMBER 2025 LIMITS:")
                logger.critical(f"   - Daily limit: {new_daily_limit} searches/day")
                logger.critical(f"   - Monthly budget: 250 searches")
                logger.critical(f"   - Days in September: 30")
                logger.critical(f"   - Target rate: ~8.33 searches/day")
    
    def setup_scheduled_tasks(self):
        """Setup scheduled tasks for quota management."""
        
        # Check for month transitions every hour
        schedule.every().hour.do(self.check_monthly_transition)
        
        # Special check for September 1, 2025 at midnight
        schedule.every().day.at("00:01").do(self.check_september_2025_special)
        
        # Daily quota status log
        schedule.every().day.at("09:00").do(self.log_daily_quota_status)
        
        # Weekly quota summary
        schedule.every().monday.at("09:00").do(self.log_weekly_quota_summary)
        
        logger.info(" Quota scheduler tasks configured:")
        logger.info("   - Hourly: Month transition checks")
        logger.info("   - Daily 00:01: September 2025 special check")
        logger.info("   - Daily 09:00: Quota status logging")
        logger.info("   - Monday 09:00: Weekly summary")
    
    def log_daily_quota_status(self):
        """Log daily quota status for monitoring."""
        if self.scraper_instance:
            current_date = datetime.utcnow()
            month_name = self.scraper_instance._get_month_name(current_date.month)
            
            quota_status = self.scraper_instance.get_quota_status()
            
            logger.critical(f" DAILY QUOTA REPORT - {month_name} {current_date.day}, {current_date.year}:")
            logger.critical(f"   - Remaining: {quota_status['remaining_quota']}/{quota_status['monthly_quota']} searches")
            logger.critical(f"   - Daily limit: {quota_status['daily_limit']} searches/day")
            logger.critical(f"   - Used today: {quota_status['daily_calls']}/{quota_status['daily_limit']}")
            logger.critical(f"   - Free tier mode: {quota_status['free_tier_mode']}")
            
            # Warning if approaching limits
            if quota_status['remaining_quota'] <= 20:
                logger.warning(f" LOW QUOTA WARNING: Only {quota_status['remaining_quota']} searches remaining!")
            
            if quota_status['daily_calls'] >= quota_status['daily_limit'] * 0.8:
                logger.warning(f" DAILY LIMIT WARNING: {quota_status['daily_calls']}/{quota_status['daily_limit']} used today")
    
    def log_weekly_quota_summary(self):
        """Log weekly quota summary.""" 
        if self.scraper_instance:
            current_date = datetime.utcnow()
            month_name = self.scraper_instance._get_month_name(current_date.month)
            
            quota_status = self.scraper_instance.get_quota_status()
            days_in_month = self.scraper_instance._get_days_in_current_month()
            days_remaining = days_in_month - current_date.day + 1
            
            logger.critical(f" WEEKLY QUOTA SUMMARY - {month_name} {current_date.year}:")
            logger.critical(f"   - Month progress: {current_date.day}/{days_in_month} days ({current_date.day/days_in_month*100:.1f}%)")
            logger.critical(f"   - Quota used: {quota_status['used_quota']}/{quota_status['monthly_quota']} ({quota_status['used_quota']/quota_status['monthly_quota']*100:.1f}%)")
            logger.critical(f"   - Days remaining: {days_remaining}")
            logger.critical(f"   - Budget/day remaining: {quota_status['remaining_quota']/max(1, days_remaining):.1f} searches/day")
            
            # Efficiency tracking
            if current_date.day > 1:
                usage_rate = quota_status['used_quota'] / current_date.day
                logger.critical(f"   - Average daily usage: {usage_rate:.1f} searches/day")
                
                # Projected end-of-month usage
                projected_usage = usage_rate * days_in_month
                logger.critical(f"   - Projected month-end usage: {projected_usage:.0f} searches")
                
                if projected_usage > quota_status['monthly_quota']:
                    logger.warning(f" PROJECTION WARNING: On track to exceed monthly quota!")
    
    async def start_scheduler(self):
        """Start the automated quota scheduler."""
        if self.is_running:
            logger.warning("Quota scheduler is already running")
            return
        
        self.is_running = True
        self.initialize_scraper()
        self.setup_scheduled_tasks()
        
        logger.critical(" QUOTA SCHEDULER STARTED")
        logger.critical("   - Monitoring for month transitions")
        logger.critical("   - September 2025 special handling enabled")
        logger.critical("   - Daily and weekly quota reporting active")
        
        # Run initial checks
        self.check_monthly_transition()
        self.check_september_2025_special()
        
        # Main scheduler loop
        while self.is_running:
            try:
                schedule.run_pending()
                await asyncio.sleep(60)  # Check every minute
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                await asyncio.sleep(300)  # Wait 5 minutes before retrying
    
    def stop_scheduler(self):
        """Stop the quota scheduler."""
        self.is_running = False
        logger.info(" Quota scheduler stopped")


# Global scheduler instance
quota_scheduler = QuotaScheduler()


async def start_quota_monitoring():
    """Start quota monitoring as background task."""
    await quota_scheduler.start_scheduler()


def stop_quota_monitoring():
    """Stop quota monitoring."""
    quota_scheduler.stop_scheduler()


# Manual trigger functions for testing
def trigger_month_check():
    """Manually trigger month transition check."""
    quota_scheduler.check_monthly_transition()


def trigger_september_check():
    """Manually trigger September 2025 check."""
    quota_scheduler.check_september_2025_special()


if __name__ == "__main__":
    # Test the scheduler
    print(" Testing Quota Scheduler")
    
    scheduler = QuotaScheduler()
    scheduler.initialize_scraper()
    
    # Test month transition detection
    print("Testing month transition...")
    scheduler.check_monthly_transition()
    
    # Test September 2025 special handling
    print("Testing September 2025 special handling...")
    scheduler.check_september_2025_special()
    
    print(" Scheduler tests complete!")
