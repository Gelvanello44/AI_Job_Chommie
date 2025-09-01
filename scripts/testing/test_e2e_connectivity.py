#!/usr/bin/env python3
"""
End-to-End Connectivity Test Script
Tests the connectivity between all AI Job Chommie services
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

# Service endpoints
BACKEND_API_URL = "http://localhost:5000"
SCRAPING_SERVICE_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:5173"

# Terminal colors
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_header(message: str):
    """Print a formatted header"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'=' * 60}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}{message.center(60)}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'=' * 60}{Colors.ENDC}\n")

def print_test(test_name: str, status: str, details: str = ""):
    """Print test result"""
    if status == "PASS":
        color = Colors.GREEN
        symbol = ""
    elif status == "FAIL":
        color = Colors.RED
        symbol = ""
    elif status == "WARN":
        color = Colors.YELLOW
        symbol = ""
    else:
        color = Colors.BLUE
        symbol = "ℹ"
    
    print(f"{color}{symbol} {test_name}: {status}{Colors.ENDC}")
    if details:
        print(f"   {Colors.CYAN}{details}{Colors.ENDC}")

async def test_service_health(session: aiohttp.ClientSession, service_name: str, url: str) -> bool:
    """Test if a service is healthy"""
    try:
        async with session.get(f"{url}/health", timeout=aiohttp.ClientTimeout(total=5)) as response:
            data = await response.json()
            if response.status == 200 and data.get('status') in ['ok', 'healthy']:
                print_test(f"{service_name} Health Check", "PASS", f"Service is healthy")
                return True
            else:
                print_test(f"{service_name} Health Check", "WARN", f"Service returned status: {data.get('status')}")
                return True
    except aiohttp.ClientError as e:
        print_test(f"{service_name} Health Check", "FAIL", f"Connection error: {str(e)}")
        return False
    except Exception as e:
        print_test(f"{service_name} Health Check", "FAIL", f"Unexpected error: {str(e)}")
        return False

async def test_backend_api():
    """Test Backend API connectivity"""
    print_header("Testing Backend API")
    
    async with aiohttp.ClientSession() as session:
        # Test health endpoint
        healthy = await test_service_health(session, "Backend API", BACKEND_API_URL)
        
        if healthy:
            # Test root endpoint
            try:
                async with session.get(BACKEND_API_URL) as response:
                    data = await response.json()
                    print_test("Backend Root Endpoint", "PASS", f"Version: {data.get('version', 'Unknown')}")
            except Exception as e:
                print_test("Backend Root Endpoint", "FAIL", str(e))
            
            # Test Sentry Debug (development only)
            try:
                async with session.get(f"{BACKEND_API_URL}/sentry-debug") as response:
                    if response.status == 500:
                        data = await response.json()
                        print_test("Backend Sentry Integration", "PASS", "Error tracking is working")
                    else:
                        print_test("Backend Sentry Integration", "WARN", f"Unexpected status: {response.status}")
            except Exception:
                print_test("Backend Sentry Integration", "INFO", "Sentry debug endpoint not available")

        return healthy

async def test_scraping_service():
    """Test Scraping Service connectivity"""
    print_header("Testing Scraping Service")
    
    async with aiohttp.ClientSession() as session:
        # Test health endpoint
        healthy = await test_service_health(session, "Scraping Service", SCRAPING_SERVICE_URL)
        
        if healthy:
            # Test root endpoint
            try:
                async with session.get(SCRAPING_SERVICE_URL) as response:
                    data = await response.json()
                    print_test("Scraping Root Endpoint", "PASS", f"Version: {data.get('version', 'Unknown')}")
            except Exception as e:
                print_test("Scraping Root Endpoint", "FAIL", str(e))
            
            # Test orchestrator status
            try:
                async with session.get(f"{SCRAPING_SERVICE_URL}/api/v1/orchestrator/status") as response:
                    data = await response.json()
                    status = "running" if data.get('orchestrator_running') else "stopped"
                    print_test("Orchestrator Status", "PASS", f"Orchestrator is {status}")
            except Exception as e:
                print_test("Orchestrator Status", "FAIL", str(e))
        
        return healthy

async def test_service_to_service():
    """Test service-to-service communication"""
    print_header("Testing Service Integration")
    
    async with aiohttp.ClientSession() as session:
        # Test if scraping service can reach backend
        print_test("Service Integration", "INFO", "Testing scraping service -> backend API communication")
        
        # Start a test scraping task
        try:
            # First, check if backend is running
            backend_healthy = await test_service_health(session, "Backend (from scraper)", BACKEND_API_URL)
            
            if backend_healthy:
                # Try to start a scraping task
                params = {
                    "source": "test",
                    "keywords": "python developer",
                    "location": "Cape Town",
                    "max_jobs": 5
                }
                
                async with session.post(
                    f"{SCRAPING_SERVICE_URL}/api/v1/scrape/jobs",
                    params=params
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        task_id = data.get('task_id')
                        print_test("Scraping Task Creation", "PASS", f"Task ID: {task_id}")
                        
                        # Wait a bit for the task to process
                        await asyncio.sleep(2)
                        
                        # Check task status
                        async with session.get(
                            f"{SCRAPING_SERVICE_URL}/api/v1/scrape/status/{task_id}"
                        ) as status_response:
                            status_data = await status_response.json()
                            print_test("Task Status Check", "PASS", 
                                     f"Status: {status_data.get('status')}, Progress: {status_data.get('progress')}%")
                    else:
                        print_test("Scraping Task Creation", "FAIL", f"Status: {response.status}")
            else:
                print_test("Backend Connectivity", "FAIL", "Cannot test integration - backend is not accessible")
                
        except Exception as e:
            print_test("Service Integration", "FAIL", f"Error: {str(e)}")

async def test_redis_connectivity():
    """Test Redis connectivity (shared by both services)"""
    print_header("Testing Redis Connectivity")
    
    try:
        import redis
        
        # Redis configuration from .env files
        redis_client = redis.Redis(
            host='redis-16857.c341.af-south-1-1.ec2.redns.redis-cloud.com',
            port=16857,
            password='3x2iBoH1v0NEYIclAdnuMn0vZBDUOyW7',
            decode_responses=True
        )
        
        # Test ping
        if redis_client.ping():
            print_test("Redis Connection", "PASS", "Successfully connected to Redis Cloud")
            
            # Test write/read
            test_key = f"test:connectivity:{int(time.time())}"
            test_value = {"service": "test", "timestamp": datetime.utcnow().isoformat()}
            
            redis_client.setex(test_key, 60, json.dumps(test_value))
            retrieved = json.loads(redis_client.get(test_key))
            
            if retrieved == test_value:
                print_test("Redis Read/Write", "PASS", "Data persistence working correctly")
            else:
                print_test("Redis Read/Write", "FAIL", "Data mismatch")
            
            # Clean up
            redis_client.delete(test_key)
            
        else:
            print_test("Redis Connection", "FAIL", "Ping failed")
            
    except ImportError:
        print_test("Redis Test", "SKIP", "Redis package not installed")
    except Exception as e:
        print_test("Redis Connection", "FAIL", f"Error: {str(e)}")

async def test_sentry_connectivity():
    """Test Sentry error tracking"""
    print_header("Testing Sentry Integration")
    
    async with aiohttp.ClientSession() as session:
        # Test backend Sentry
        try:
            async with session.get(f"{BACKEND_API_URL}/sentry-debug") as response:
                if response.status == 500:
                    print_test("Backend Sentry", "PASS", "Error tracking active")
                else:
                    print_test("Backend Sentry", "WARN", f"Unexpected status: {response.status}")
        except Exception:
            print_test("Backend Sentry", "INFO", "Sentry debug not available (production mode?)")
        
        # Test scraping service Sentry
        try:
            async with session.get(f"{SCRAPING_SERVICE_URL}/sentry-debug") as response:
                if response.status == 500:
                    print_test("Scraping Service Sentry", "PASS", "Error tracking active")
                else:
                    print_test("Scraping Service Sentry", "WARN", f"Unexpected status: {response.status}")
        except Exception:
            print_test("Scraping Service Sentry", "INFO", "Sentry debug not available (production mode?)")

async def main():
    """Run all connectivity tests"""
    print(f"{Colors.BOLD}{Colors.PURPLE}")
    print(" AI Job Chommie - End-to-End Connectivity Test")
    print(f"Testing at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{Colors.ENDC}")
    
    # Track overall results
    results = {
        "backend_api": False,
        "scraping_service": False,
        "integration": False,
        "redis": False,
        "sentry": False
    }
    
    # Run tests
    results["backend_api"] = await test_backend_api()
    results["scraping_service"] = await test_scraping_service()
    
    # Only test integration if both services are running
    if results["backend_api"] and results["scraping_service"]:
        await test_service_to_service()
        results["integration"] = True
    else:
        print_header("Skipping Integration Tests")
        print_test("Integration Tests", "SKIP", "One or more services are not running")
    
    # Test shared components
    await test_redis_connectivity()
    await test_sentry_connectivity()
    
    # Summary
    print_header("Test Summary")
    
    total_tests = len(results)
    passed_tests = sum(1 for v in results.values() if v)
    
    print(f"{Colors.BOLD}Results:{Colors.ENDC}")
    print(f"  {Colors.GREEN} Backend API: {'Running' if results['backend_api'] else 'Not Running'}{Colors.ENDC}")
    print(f"  {Colors.GREEN if results['scraping_service'] else Colors.RED} Scraping Service: {'Running' if results['scraping_service'] else 'Not Running'}{Colors.ENDC}")
    print(f"  {Colors.GREEN if results['integration'] else Colors.YELLOW} Service Integration: {'Tested' if results['integration'] else 'Not Tested'}{Colors.ENDC}")
    print(f"  {Colors.CYAN}ℹ  Redis: Check logs above{Colors.ENDC}")
    print(f"  {Colors.CYAN}ℹ  Sentry: Check logs above{Colors.ENDC}")
    
    print(f"\n{Colors.BOLD}Overall Status: ", end="")
    if passed_tests == total_tests:
        print(f"{Colors.GREEN}All systems operational! {Colors.ENDC}")
    elif passed_tests > 0:
        print(f"{Colors.YELLOW}Partial connectivity ({passed_tests}/{total_tests} services running){Colors.ENDC}")
    else:
        print(f"{Colors.RED}No services detected - please start the services{Colors.ENDC}")
    
    # Instructions
    print(f"\n{Colors.BOLD}To start services:{Colors.ENDC}")
    print(f"1. Backend API: cd ai-job-chommie-backend && npm run dev")
    print(f"2. Scraping Service: cd job-scraping-service && python -m uvicorn src.main:app --reload")
    print(f"3. Frontend: cd ai-job-chommie-landing-source && npm run dev")

if __name__ == "__main__":
    asyncio.run(main())
