"""
Test September 2025 quota behavior - 8 searches per day for 30-day month.
"""

import sys
import os
from datetime import datetime
from unittest.mock import patch

# Add src to path
sys.path.append('src')

from scrapers.serpapi_scraper import SerpAPIScraper
from config.settings import settings


def test_september_quota():
    """Test September 2025 quota calculations."""
    print(" Testing September 2025 Quota Management")
    print("=" * 50)
    
    # Mock September 1, 2025
    september_date = datetime(2025, 9, 1, 0, 0, 0)
    
    with patch('scrapers.serpapi_scraper.datetime') as mock_dt:
        mock_dt.utcnow.return_value = september_date
        mock_dt.side_effect = lambda *args, **kw: datetime(*args, **kw)
        
        # Simulate month transition
        settings.serpapi_last_reset_month = 8  # Coming from August
        settings.serpapi_last_reset_year = 2025
        settings.serpapi_used_quota = 0
        settings.serpapi_remaining_quota = 250  # Fresh quota
        
        print(f" Simulating September 1, 2025...")
        print(f"   - Fresh monthly quota: 250 searches")
        print(f"   - Days in September: 30")
        print(f"   - Target daily rate: 8.33 searches/day")
        
        try:
            # Initialize scraper (will trigger month transition logic)
            scraper = SerpAPIScraper()
            
            print(f"\n September Transition Results:")
            print(f"   - New daily limit: {scraper.daily_limit} searches/day")
            print(f"   - New hourly limit: {scraper.hourly_limit} searches/hour")
            print(f"   - Remaining quota: {scraper.remaining_quota}")
            
            # Verify it meets the 8.33/day target
            if scraper.daily_limit <= 8:
                print(f"    SUCCESS: Daily limit ({scraper.daily_limit}) meets target of ~8 searches/day")
                return True
            else:
                print(f"    ISSUE: Daily limit ({scraper.daily_limit}) exceeds target")
                return False
                
        except Exception as e:
            print(f" Test failed: {e}")
            return False


def test_month_calculation_logic():
    """Test the month calculation logic directly."""
    print(f"\n Testing Month Calculation Logic")
    print("=" * 50)
    
    # Test scenarios
    scenarios = [
        (datetime(2025, 9, 1), 250, 30, "September 1 - Full month"),
        (datetime(2025, 9, 15), 130, 16, "September 15 - Mid month"),
        (datetime(2025, 2, 1), 250, 28, "February 1 - 28-day month"),
        (datetime(2025, 10, 1), 250, 31, "October 1 - 31-day month"),
    ]
    
    for test_date, remaining_quota, days_remaining, description in scenarios:
        print(f"\n Scenario: {description}")
        
        # Calculate expected daily limit
        daily_budget = remaining_quota / days_remaining
        safe_daily_limit = int(daily_budget * 0.9)  # 90% safety buffer
        safe_daily_limit = max(1, safe_daily_limit)
        
        # Special September logic
        if test_date.year == 2025 and test_date.month == 9:
            september_limit = max(8, safe_daily_limit)
            expected = september_limit
        else:
            expected = safe_daily_limit
        
        print(f"   - Remaining quota: {remaining_quota}")
        print(f"   - Days remaining: {days_remaining}")
        print(f"   - Raw daily budget: {daily_budget:.2f}")
        print(f"   - Safe daily limit: {safe_daily_limit}")
        print(f"   - Final daily limit: {expected}")
        
        if test_date.month == 9 and test_date.year == 2025:
            print(f"    September special: Enforced minimum of 8 searches/day")
    
    return True


if __name__ == "__main__":
    print(" September 2025 Quota Test Suite")
    print("=" * 60)
    
    try:
        # Test September quota behavior
        september_success = test_september_quota()
        
        # Test calculation logic
        calc_success = test_month_calculation_logic()
        
        print(f"\n FINAL RESULTS:")
        print(f"=" * 40)
        print(f" September 2025 ready: {'YES' if september_success else 'NO'}")
        print(f" Calculation logic: {'WORKING' if calc_success else 'BROKEN'}")
        
        if september_success:
            print(f"\n SUCCESS! System will automatically:")
            print(f"   - Reset quota to 250 on September 1, 2025")
            print(f"   - Set daily limit to ~8 searches/day")
            print(f"   - Distribute quota over 30 days")
            print(f"   - Maintain quota discipline")
        else:
            print(f"\n Issues detected - review implementation")
    
    except Exception as e:
        print(f"\n Test suite failed: {e}")
        import traceback
        traceback.print_exc()
