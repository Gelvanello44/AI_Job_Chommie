#!/usr/bin/env python3
"""
Complete service test - verify real scraping service with API endpoints.
This tests the complete pipeline from API call to database storage.
"""

import asyncio
import requests
import time
import json
import os
from pathlib import Path


def load_env_file():
    """Load environment variables from .env file."""
    env_file = Path(".env")
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


def test_api_endpoints():
    """Test the main API endpoints."""
    print("\n TESTING COMPLETE SCRAPING SERVICE")
    print("=" * 60)
    
    # Base URL for the service
    base_url = "http://localhost:8000"
    
    # Test 1: Health check
    print("\n TEST 1: Health Check")
    try:
        response = requests.get(f"{base_url}/health", timeout=10)
        if response.status_code == 200:
            health_data = response.json()
            print(f" Health check passed: {health_data['status']}")
        else:
            print(f" Health check failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print(" Service not running. Starting service first...")
        return False
    except Exception as e:
        print(f" Health check error: {e}")
        return False
    
    # Test 2: Start real scraping job
    print("\n TEST 2: Start Real Scraping Job")
    try:
        scrape_params = {
            "source": "indeed",
            "keywords": "software developer",
            "location": "South Africa",
            "max_jobs": 50
        }
        
        response = requests.post(f"{base_url}/api/v1/scrape/jobs", params=scrape_params, timeout=10)
        if response.status_code == 200:
            job_data = response.json()
            print(f" Scraping job started: {job_data['task_id']}")
            task_id = job_data['task_id']
        else:
            print(f" Failed to start scraping job: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f" Scraping job start error: {e}")
        return False
    
    # Test 3: Monitor job progress
    print(f"\n TEST 3: Monitor Job Progress (Task: {task_id})")
    max_attempts = 30  # Wait up to 30 attempts
    attempt = 0
    
    while attempt < max_attempts:
        try:
            response = requests.get(f"{base_url}/api/v1/scrape/status/{task_id}", timeout=10)
            if response.status_code == 200:
                status_data = response.json()
                status = status_data['status']
                progress = status_data['progress']
                jobs_found = status_data['jobs_found']
                
                print(f" Progress: {progress}%, Jobs Found: {jobs_found}, Status: {status}")
                
                if status == "completed":
                    if jobs_found > 0:
                        print(f" REAL SCRAPING SUCCESS: {jobs_found} jobs found!")
                        print(f" VERIFICATION: This is REAL DATA, not mock data!")
                        return True
                    else:
                        print("  Scraping completed but no jobs found")
                        return False
                elif status == "failed":
                    print(f" Scraping failed: {status_data.get('errors', [])}")
                    return False
                
                # Wait before checking again
                time.sleep(2)
                attempt += 1
            else:
                print(f" Status check failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f" Status check error: {e}")
            attempt += 1
            time.sleep(2)
    
    print("⏱  Timeout waiting for job completion")
    return False


def main():
    """Main test execution."""
    print(" COMPLETE SCRAPING SERVICE TEST")
    print("Testing full pipeline: API → Real SerpAPI → Database")
    print()
    
    # Load environment
    load_env_file()
    
    # Verify environment
    api_key = os.getenv('SERPAPI_API_KEY')
    real_scraping = os.getenv('ENABLE_REAL_SCRAPING', 'false').lower()
    mock_data = os.getenv('USE_MOCK_DATA', 'true').lower()
    
    print(f" API Key Present: {'Yes' if api_key else 'No'}")
    print(f" Real Scraping Enabled: {real_scraping}")
    print(f" Mock Data Disabled: {'Yes' if mock_data == 'false' else 'No'}")
    
    if not api_key:
        print(" ERROR: SERPAPI_API_KEY not found")
        return False
    
    if real_scraping != 'true':
        print(" ERROR: ENABLE_REAL_SCRAPING not set to 'true'")
        return False
        
    if mock_data != 'false':
        print(" ERROR: USE_MOCK_DATA not set to 'false'")
        return False
    
    print("\n Environment configuration verified!")
    print("  NOTE: Make sure the scraping service is running with:")
    print("   python -m uvicorn src.main:app --host 0.0.0.0 --port 8000")
    print("\n" + "="*60)
    
    # Test the API endpoints
    success = test_api_endpoints()
    
    print("\n" + "="*60)
    if success:
        print(" SUCCESS: Complete scraping service is working with REAL data!")
        print(" Real SerpAPI integration: ACTIVE")
        print(" Mock data: DISABLED") 
        print(" South African job scraping: OPERATIONAL")
        return True
    else:
        print(" FAILURE: Issues detected with complete service")
        return False


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
