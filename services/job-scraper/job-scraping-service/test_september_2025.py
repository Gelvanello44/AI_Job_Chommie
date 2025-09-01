"""
Test script to verify September 2025 quota behavior.
Simulates the September 1, 2025 transition to verify 8.33 searches/day limit.
"""

import sys
import os
from datetime import datetime
from unittest.mock import patch

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.scrapers.serpapi_scraper import SerpAPIScraper
from src.config.settings import settings


class TestSerpAPIScraper(SerpAPIScraper):
    """Test version with mocked datetime."""
    
    def __init__(self, mock_date=None):
        self.mock_date = mock_date
        super().__init__()


def test_september_2025_transition():
    """Test September 1, 2025 quota adjustment."""
    print(" Testing September 2025 Quota Transition")
    print("=" * 60)
    
    # Mock September 1, 2025
    september_1_2025 = datetime(2025, 9, 1, 0, 0, 0)
    
    with patch('src.scrapers.serpapi_scraper.datetime') as mock_datetime:
        mock_datetime.utcnow.return_value = september_1_2025
        mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)
        
        # Clear any existing tracking
        settings.serpapi_last_reset_month = 8  # August
        settings.serpapi_last_reset_year = 2025
        settings.serpapi_used_quota = 250  # Simulate end of August
        settings.serpapi_remaining_quota = 0
        
        print(f"\n Pre-September Status:")
        print(f"   - Date: {september_1_2025.strftime('%B %d, %Y')}")
        print(f"   - Last reset: August 2025")
        print(f"   - Used quota: {settings.serpapi_used_quota}")
        print(f"   - Remaining quota: {settings.serpapi_remaining_quota}")
        
        # Initialize scraper (should trigger September transition)
        print(f"\n Initializing scraper for September 2025...")
        scraper = TestSerpAPIScraper()
        
        print(f"\n Post-September Status:")
        print(f"   - Month: {scraper._get_month_name(september_1_2025.month)}")
        print(f"   - Fresh quota: {scraper.remaining_quota}")
        print(f"   - Daily limit: {scraper.daily_limit} searches/day")
        print(f"   - Hourly limit: {scraper.hourly_limit} searches/hour")
        print(f"   - Days in September: {scraper._get_days_in_current_month()}")
        
        # Verify September-specific calculations
        days_in_september = 30
        expected_daily_rate = 250 / days_in_september  # 8.33
        
        print(f"\n September 2025 Verification:")
        print(f"   - Expected daily rate: {expected_daily_rate:.2f} searches/day")
        print(f"   - Actual daily limit: {scraper.daily_limit} searches/day")
        print(f"   - Target met: {'' if scraper.daily_limit <= 9 else ''}")
        
        # Test quota status
        quota_status = scraper.get_quota_status()
        print(f"\n September Quota Status:")
        for key, value in quota_status.items():
            print(f"   - {key}: {value}")
        
        return scraper.daily_limit <= 9  # Should be 8 or less


def test_other_months():
    """Test quota behavior in other months."""
    print(f"\n Testing Other Month Behaviors")
    print("=" * 60)
    
    test_dates = [
        (datetime(2025, 10, 1, 0, 0, 0), "October", 31),  # 31-day month
        (datetime(2025, 2, 1, 0, 0, 0), "February", 28),  # 28-day month
        (datetime(2025, 12, 15, 0, 0, 0), "December Mid", 31), # Mid-month
    ]
    
    results = []
    
    for test_date, month_name, days_in_month in test_dates:
        with patch('src.scrapers.serpapi_scraper.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = test_date
            mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)
            
            # Simulate fresh month
            settings.serpapi_last_reset_month = test_date.month - 1 if test_date.month > 1 else 12
            settings.serpapi_last_reset_year = test_date.year if test_date.month > 1 else test_date.year - 1
            settings.serpapi_used_quota = 0
            settings.serpapi_remaining_quota = 250
            
            scraper = TestSerpAPIScraper()
            
            days_remaining = days_in_month - test_date.day + 1
            expected_daily = 250 / days_remaining * 0.9  # With safety buffer
            
            print(f"\n   {month_name} ({test_date.strftime('%Y-%m-%d')}):")
            print(f"     - Days in month: {days_in_month}")
            print(f"     - Days remaining: {days_remaining}")
            print(f"     - Expected daily: {expected_daily:.1f}")
            print(f"     - Actual daily: {scraper.daily_limit}")
            
            results.append((month_name, scraper.daily_limit, expected_daily))
    
    return results


def test_mid_month_adjustment():
    \"\"\"Test mid-month quota adjustment.\"\"\"\n    print(f\"\\n Testing Mid-Month Adjustment Logic\")\n    print(\"=\" * 60)\n    \n    # Simulate September 15, 2025 with some quota used\n    september_15_2025 = datetime(2025, 9, 15, 0, 0, 0)\n    \n    with patch('src.scrapers.serpapi_scraper.datetime') as mock_datetime:\n        mock_datetime.utcnow.return_value = september_15_2025\n        mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)\n        \n        # Simulate mid-month scenario: used 120 searches by September 15\n        settings.serpapi_last_reset_month = 9  # Already in September\n        settings.serpapi_last_reset_year = 2025\n        settings.serpapi_used_quota = 120\n        settings.serpapi_remaining_quota = 130  # 250 - 120\n        \n        scraper = TestSerpAPIScraper()\n        \n        days_remaining = 30 - 15 + 1  # 16 days left in September\n        expected_daily = 130 / 16 * 0.9  # ~7.3 searches/day\n        \n        print(f\"\\n Mid-September Scenario:\")\n        print(f\"   - Date: September 15, 2025\")\n        print(f\"   - Used quota: 120/250\")\n        print(f\"   - Remaining quota: 130\")\n        print(f\"   - Days remaining: 16\")\n        print(f\"   - Expected daily: {expected_daily:.1f} searches/day\")\n        print(f\"   - Actual daily: {scraper.daily_limit} searches/day\")\n        print(f\"   - Adjustment working: {'' if abs(scraper.daily_limit - expected_daily) <= 1 else ''}\")\n        \n        return abs(scraper.daily_limit - expected_daily) <= 1


if __name__ == \"__main__\":\n    print(\" September 2025 Quota Management Testing\")\n    print(\"=\" * 70)\n    \n    try:\n        # Test September 1, 2025 transition\n        september_success = test_september_2025_transition()\n        \n        # Test other months\n        other_months_results = test_other_months()\n        \n        # Test mid-month adjustment\n        mid_month_success = test_mid_month_adjustment()\n        \n        print(f\"\\n TEST RESULTS SUMMARY:\")\n        print(f\"=\" * 40)\n        print(f\" September 2025 transition: {'PASS' if september_success else 'FAIL'}\")\n        print(f\" Mid-month adjustment: {'PASS' if mid_month_success else 'FAIL'}\")\n        \n        print(f\"\\n Monthly Behavior Summary:\")\n        for month_name, actual, expected in other_months_results:\n            status = \"\" if abs(actual - expected) <= 2 else \"\"\n            print(f\"   {status} {month_name}: {actual} daily (expected ~{expected:.1f})\")\n        \n        print(f\"\\n September 2025 Ready: {' YES' if september_success else ' NO'}\")\n        print(f\" System will automatically adjust to ~8 searches/day on Sep 1, 2025\")\n        \n        if september_success and mid_month_success:\n            print(f\"\\n ALL TESTS PASSED - September 2025 quota management ready!\")\n        else:\n            print(f\"\\n Some tests failed - review implementation\")\n            \n    except Exception as e:\n        print(f\"\\n TEST ERROR: {e}\")\n        import traceback\n        traceback.print_exc()"
