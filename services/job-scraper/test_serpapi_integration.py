#!/usr/bin/env python3
"""
Test script to verify SerpAPI integration and real scraping functionality.
This script tests that:
1. SerpAPI API key works
2. Real job data is being returned
3. No mock data is being used
4. South African jobs are being found
"""

import asyncio
import os
import sys
from pathlib import Path

# Add src directory to path
src_path = Path(__file__).parent / "src"
sys.path.insert(0, str(src_path))

from src.scrapers.serpapi_scraper import SerpAPIScraper
import json


async def test_serpapi_integration():
    """Test SerpAPI integration with real API calls."""
    
    print(" TESTING REAL SERPAPI INTEGRATION - NO MOCK DATA!")
    print("=" * 60)
    
    # Verify environment variables
    api_key = os.getenv('SERPAPI_API_KEY')
    real_scraping = os.getenv('ENABLE_REAL_SCRAPING', 'false').lower()
    mock_data = os.getenv('USE_MOCK_DATA', 'true').lower()
    
    print(f" API Key Present: {'Yes' if api_key else 'No'}")
    print(f" Real Scraping Enabled: {real_scraping}")
    print(f" Mock Data Disabled: {'Yes' if mock_data == 'false' else 'No'}")
    print()
    
    if not api_key:
        print(" ERROR: SERPAPI_API_KEY not found in environment")
        return False
    
    if real_scraping != 'true':
        print(" ERROR: ENABLE_REAL_SCRAPING is not set to 'true'")
        return False
        
    if mock_data != 'false':
        print(" ERROR: USE_MOCK_DATA is not set to 'false'")
        return False
    
    try:
        # Initialize scraper
        print(" Initializing SerpAPI scraper...")
        scraper = SerpAPIScraper()
        await scraper.initialize()
        
        # Test 1: Basic job search
        print("\n TEST 1: Basic Job Search (South African jobs)")
        filters = {
            "keywords": ["software", "developer"],
            "location": "South Africa",
            "max_results": 10
        }
        
        results = await scraper.scrape(
            source="indeed",
            filters=filters
        )
        
        jobs = results.get("jobs", [])
        print(f" Found {len(jobs)} real jobs")
        
        if jobs:
            print("\n SAMPLE REAL JOB DATA:")
            sample_job = jobs[0]
            print(json.dumps({
                "title": sample_job.get("title"),
                "company": sample_job.get("company", {}).get("name"),
                "location": sample_job.get("location"),
                "source": sample_job.get("source"),
                "is_real": not sample_job.get("title", "").startswith("Software Engineer Mock"),
                "has_url": bool(sample_job.get("source_url"))
            }, indent=2))
        
        # Test 2: Comprehensive SA search
        print("\n TEST 2: Comprehensive South African Market Search")
        comprehensive_results = await scraper.scrape(
            source="comprehensive_sa",
            filters={"location": "South Africa"}
        )
        
        comprehensive_jobs = comprehensive_results.get("jobs", [])
        print(f" Found {len(comprehensive_jobs)} jobs in comprehensive SA search")
        
        # Test 3: Verify no mock data patterns
        print("\n TEST 3: Verifying NO Mock Data Patterns")
        all_jobs = jobs + comprehensive_jobs
        
        mock_indicators = [
            "Software Engineer Mock",
            "Company Mock",
            "example.com",
            "Test Job",
            "Test Company"
        ]
        
        mock_count = 0
        for job in all_jobs:
            title = job.get("title", "").lower()
            company = job.get("company", {}).get("name", "").lower()
            url = job.get("source_url", "").lower()
            
            for indicator in mock_indicators:
                if indicator.lower() in title or indicator.lower() in company or indicator.lower() in url:
                    mock_count += 1
                    print(f"  MOCK DATA DETECTED: {job.get('title')}")
        
        if mock_count == 0:
            print(" NO MOCK DATA FOUND - All jobs are real!")
        else:
            print(f" FOUND {mock_count} MOCK JOBS - Still using mock data!")
        
        # Test 4: API quota check
        print(f"\n API Usage: {scraper.api_calls} calls made")
        print(f" Unique Jobs Scraped: {len(scraper.scraped_jobs)}")
        
        # Cleanup
        await scraper.cleanup()
        
        # Results summary
        print("\n" + "=" * 60)
        print(" REAL SCRAPING TEST RESULTS:")
        print(f"   • Total Real Jobs Found: {len(all_jobs)}")
        print(f"   • Mock Data Detected: {mock_count} jobs")
        print(f"   • API Calls Made: {scraper.api_calls}")
        print(f"   • South African Focus: {'Yes' if any('south africa' in job.get('location', '').lower() for job in all_jobs) else 'No'}")
        
        success = len(all_jobs) > 0 and mock_count == 0
        print(f"   • TEST STATUS: {' PASSED' if success else ' FAILED'}")
        
        return success
        
    except Exception as e:
        print(f"\n ERROR during testing: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print(" SERPAPI REAL SCRAPING INTEGRATION TEST")
    print("Testing that all mock data has been removed and real scraping works")
    print()
    
    # Load environment from .env file
    env_file = Path(__file__).parent / ".env"
    if env_file.exists():
        print(f" Loading environment from {env_file}")
        with open(env_file) as f:
            for line in f:
                if line.strip() and not line.startswith('#'):
                    if '=' in line:
                        key, value = line.strip().split('=', 1)
                        os.environ[key] = value
    else:
        print("  No .env file found")
    
    # Run the test
    success = asyncio.run(test_serpapi_integration())
    
    if success:
        print("\n SUCCESS: Real SerpAPI scraping is working!")
        sys.exit(0)
    else:
        print("\n FAILURE: Issues detected with real scraping setup")
        sys.exit(1)
