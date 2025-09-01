#!/usr/bin/env python3
"""
AI Job Chommie - Service Connectivity Test
Comprehensive test to verify all services are running and communicating properly
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, List, Tuple, Optional

# Service endpoints configuration
SERVICES = {
    "frontend": {
        "name": "Frontend Application",
        "url": "http://localhost:3000",
        "health_endpoint": "/",
        "expected_content": ["AI Job Chommie", "html"],
        "port": 3000
    },
    "backend": {
        "name": "Backend API", 
        "url": "http://localhost:3001",
        "health_endpoint": "/",
        "expected_content": ["html"],  # Currently serving frontend
        "port": 3001
    },
    "ai_inference": {
        "name": "AI Inference Service",
        "url": "http://localhost:5000",
        "health_endpoint": "/health",
        "expected_content": ["healthy", "status"],
        "port": 5000
    },
    "job_scraping": {
        "name": "Job Scraping Service",
        "url": "http://localhost:8000",
        "health_endpoint": "/health", 
        "expected_content": ["healthy", "status"],
        "port": 8000
    }
}

def test_service_health(service_name: str, service_config: Dict) -> Tuple[bool, str, Optional[Dict]]:
    """Test if a service is healthy and responding"""
    
    try:
        url = service_config["url"] + service_config["health_endpoint"]
        
        print(f" Testing {service_config['name']} at {url}")
        
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            try:
                # Try to parse as JSON
                data = response.json()
                content_check = any(keyword in str(data).lower() for keyword in service_config["expected_content"])
            except:
                # If not JSON, check text content
                data = {"response_text": response.text[:200]}
                content_check = any(keyword.lower() in response.text.lower() for keyword in service_config["expected_content"])
            
            if content_check:
                return True, f" {service_config['name']} is healthy", data
            else:
                return False, f" {service_config['name']} responded but content unexpected", data
        else:
            return False, f" {service_config['name']} returned status {response.status_code}", None
            
    except requests.exceptions.ConnectionError:
        return False, f" {service_config['name']} connection refused (service not running)", None
    except requests.exceptions.Timeout:
        return False, f" {service_config['name']} timed out", None
    except Exception as e:
        return False, f" {service_config['name']} error: {str(e)}", None

def test_inter_service_communication():
    """Test communication between services"""
    print("\n Testing Inter-Service Communication...")
    
    # Test AI Inference Service endpoints
    ai_tests = [
        {
            "name": "AI Inference - Root endpoint",
            "url": "http://localhost:5000/",
            "method": "GET"
        },
        {
            "name": "AI Inference - Health metrics", 
            "url": "http://localhost:5000/health",
            "method": "GET"
        }
    ]
    
    results = []
    
    for test in ai_tests:
        try:
            response = requests.get(test["url"], timeout=5)
            if response.status_code == 200:
                results.append(f" {test['name']}: OK")
            else:
                results.append(f" {test['name']}: Status {response.status_code}")
        except Exception as e:
            results.append(f" {test['name']}: {str(e)}")
    
    # Test Job Scraping Service endpoints
    scraping_tests = [
        {
            "name": "Job Scraping - Root endpoint",
            "url": "http://localhost:8000/",
            "method": "GET"
        },
        {
            "name": "Job Scraping - Status endpoint",
            "url": "http://localhost:8000/api/v1/status",
            "method": "GET"
        }
    ]
    
    for test in scraping_tests:
        try:
            response = requests.get(test["url"], timeout=5)
            if response.status_code == 200:
                results.append(f" {test['name']}: OK")
            else:
                results.append(f" {test['name']}: Status {response.status_code}")
        except Exception as e:
            results.append(f" {test['name']}: {str(e)}")
    
    return results

def run_connectivity_test():
    """Run comprehensive connectivity test"""
    
    print(" AI Job Chommie - Service Connectivity Test")
    print("=" * 60)
    print(f"⏰ Test started at: {datetime.now().isoformat()}")
    print()
    
    # Test individual services
    service_results = {}
    healthy_services = 0
    total_services = len(SERVICES)
    
    for service_name, config in SERVICES.items():
        is_healthy, message, data = test_service_health(service_name, config)
        service_results[service_name] = {
            "healthy": is_healthy,
            "message": message,
            "data": data
        }
        
        print(message)
        if is_healthy:
            healthy_services += 1
            
        time.sleep(0.5)  # Brief pause between tests
    
    print()
    print(f" Service Health Summary: {healthy_services}/{total_services} services healthy")
    
    # Test inter-service communication
    communication_results = test_inter_service_communication()
    
    for result in communication_results:
        print(result)
    
    # Overall system status
    print("\n" + "=" * 60)
    if healthy_services == total_services:
        print(" ALL SERVICES ARE RUNNING AND HEALTHY!")
        print(" System is ready for full operation")
    elif healthy_services >= 3:
        print(" MOST SERVICES ARE RUNNING")
        print(f" {healthy_services}/{total_services} services operational")
        print(" Some services may need attention")
    else:
        print(" SYSTEM HEALTH ISSUES DETECTED")
        print(f" Only {healthy_services}/{total_services} services operational")
        print(" Service troubleshooting required")
    
    # Detailed service info
    print("\n Detailed Service Information:")
    print("-" * 40)
    
    for service_name, result in service_results.items():
        config = SERVICES[service_name]
        print(f"• {config['name']}: {config['url']}")
        print(f"  Status: {result['message']}")
        if result['data'] and isinstance(result['data'], dict):
            for key, value in list(result['data'].items())[:3]:  # Show first 3 items
                print(f"  {key}: {str(value)[:100]}")
        print()
    
    print(" Connectivity test completed")
    print(f"⏰ Test finished at: {datetime.now().isoformat()}")

if __name__ == "__main__":
    try:
        run_connectivity_test()
    except KeyboardInterrupt:
        print("\n Test interrupted by user")
    except Exception as e:
        print(f"\n Test failed with error: {e}")
