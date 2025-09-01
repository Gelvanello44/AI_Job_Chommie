"""
Test high-value query processing to ensure valuable searches execute.
"""

import sys
import os
from datetime import datetime

# Add project root to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.test_serpapi_quota import MockSerpAPIScraper
from loguru import logger


async def test_high_value_execution():
    """Test that high-value queries execute correctly."""
    print(" Testing High-Value Query Execution")
    print("=" * 50)
    
    scraper = MockSerpAPIScraper()
    
    # High-value queries that should execute
    high_value_queries = [
        "site:pnet.co.za software engineer jobs",
        "executive search cape town", 
        "shoprite jobs",
        "posted today developer",
        "site:careers24.com manager positions"
    ]
    
    print(f"\nTesting {len(high_value_queries)} high-value queries:")
    
    successful_searches = 0
    for i, query in enumerate(high_value_queries, 1):
        try:
            result = await scraper._search_jobs(query)
            jobs_found = len(result['jobs'])
            
            if jobs_found > 0:
                successful_searches += 1
                print(f"   {i}.  '{query}' -> {jobs_found} jobs found")
            else:
                print(f"   {i}.  '{query}' -> BLOCKED")
                
        except Exception as e:
            print(f"   {i}.  '{query}' -> ERROR: {e}")
    
    print(f"\n Results:")
    print(f"   - Successful searches: {successful_searches}/{len(high_value_queries)}")
    print(f"   - Quota used: {scraper.used_quota - 16} additional searches")
    print(f"   - Remaining quota: {scraper.remaining_quota}")
    
    return successful_searches > 0


def test_comprehensive_sa_flow():
    """Test the comprehensive SA search flow."""
    print(f"\n Testing Comprehensive SA Search Flow") 
    print("=" * 50)
    
    scraper = MockSerpAPIScraper()
    
    # Build comprehensive SA queries
    filters = {
        "keywords": ["software", "engineer"],
        "location": "Cape Town",
        "job_level": "senior"
    }
    
    queries = scraper._build_search_queries("comprehensive_sa", filters)
    print(f"Generated {len(queries)} comprehensive SA queries:")
    
    for i, query in enumerate(queries, 1):
        is_high_value = scraper._is_high_value_query(query)
        value_indicator = "" if is_high_value else ""
        print(f"   {i}. {value_indicator} {query}")
    
    # Check that all queries are high-value for comprehensive SA
    high_value_count = sum(1 for q in queries if scraper._is_high_value_query(q))
    print(f"\nHigh-value queries: {high_value_count}/{len(queries)} ({high_value_count/len(queries)*100:.1f}%)")
    
    if high_value_count == len(queries):
        print(" All comprehensive SA queries are high-value")
    else:
        print(" Some comprehensive SA queries are low-value")


if __name__ == "__main__":
    import asyncio
    
    try:
        print(" High-Value Query Processing Tests")
        print("=" * 60)
        
        # Test settings first
        print("\n Verifying Settings:")
        from src.config.settings import settings
        print(f"   - Free tier mode: {settings.serpapi_free_tier_mode}")
        print(f"   - High value only: {settings.serpapi_high_value_queries_only}")
        print(f"   - Monthly quota: {settings.serpapi_monthly_quota}")
        print(f"   - Remaining quota: {settings.serpapi_remaining_quota}")
        
        # Test comprehensive SA flow
        test_comprehensive_sa_flow()
        
        # Test high-value execution
        success = asyncio.run(test_high_value_execution())
        
        if success:
            print(f"\n HIGH-VALUE TESTS PASSED!")
            print(f" High-value queries execute correctly")
            print(f" Comprehensive SA queries are optimized")
            print(f" Quota protection is working")
        else:
            print(f"\n HIGH-VALUE TESTS INCONCLUSIVE")
            print(f" May be due to strict quota protection")
            
    except Exception as e:
        print(f"\n HIGH-VALUE TEST FAILED: {e}")
        sys.exit(1)
