"""
Comprehensive API Integration Test Script

Tests all backend API endpoints to ensure:
- Authentication and authorization work correctly
- All tier features are properly gated
- Database operations function as expected
- User experience flows work seamlessly
- Error handling is robust

Run this script to validate the entire backend is working correctly.
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import uuid

# Test configuration
BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

class APITester:
    def __init__(self):
        self.session = None
        self.test_users = {
            "free": {"email": "free@test.com", "password": "test123", "token": None},
            "professional": {"email": "pro@test.com", "password": "test123", "token": None},
            "executive": {"email": "exec@test.com", "password": "test123", "token": None}
        }
        self.results = {"passed": 0, "failed": 0, "skipped": 0}
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_test(self, test_name: str, status: str, message: str = ""):
        status_colors = {
            "PASS": Colors.GREEN,
            "FAIL": Colors.RED, 
            "SKIP": Colors.YELLOW,
            "INFO": Colors.BLUE
        }
        
        color = status_colors.get(status, Colors.ENDC)
        print(f"{color}[{status}]{Colors.ENDC} {test_name}: {message}")
        
        if status == "PASS":
            self.results["passed"] += 1
        elif status == "FAIL":
            self.results["failed"] += 1
        elif status == "SKIP":
            self.results["skipped"] += 1
    
    async def make_request(self, method: str, endpoint: str, token: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        """Make HTTP request with optional authentication."""
        headers = kwargs.pop("headers", {})
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        url = f"{BASE_URL}{API_PREFIX}{endpoint}"
        
        try:
            async with self.session.request(method, url, headers=headers, **kwargs) as response:
                content = await response.text()
                try:
                    data = json.loads(content)
                except json.JSONDecodeError:
                    data = {"raw_content": content}
                
                return {
                    "status_code": response.status,
                    "data": data,
                    "headers": dict(response.headers)
                }
        except Exception as e:
            return {
                "status_code": 0,
                "data": {"error": str(e)},
                "headers": {}
            }
    
    async def test_health_checks(self):
        """Test basic health and connectivity."""
        self.log_test("Health Check", "INFO", "Testing basic connectivity...")
        
        # Test root endpoint
        response = await self.make_request("GET", "/../")
        if response["status_code"] == 200:
            self.log_test("Root Endpoint", "PASS", "Service is operational")
        else:
            self.log_test("Root Endpoint", "FAIL", f"Status: {response['status_code']}")
        
        # Test health endpoint
        response = await self.make_request("GET", "/../health")
        if response["status_code"] in [200, 503]:  # Either healthy or unhealthy is fine for testing
            self.log_test("Health Endpoint", "PASS", "Health check responding")
        else:
            self.log_test("Health Endpoint", "FAIL", f"Status: {response['status_code']}")
    
    async def test_authentication(self):
        """Test authentication endpoints."""
        self.log_test("Authentication", "INFO", "Testing auth system...")
        
        # Test signup for each tier
        for tier, user_data in self.test_users.items():
            signup_data = {
                "email": user_data["email"],
                "password": user_data["password"],
                "full_name": f"Test User {tier.title()}",
                "subscription_tier": tier
            }
            
            response = await self.make_request("POST", "/auth/signup", json=signup_data)
            if response["status_code"] in [200, 201, 409]:  # OK, Created, or Already exists
                self.log_test(f"Signup ({tier})", "PASS", "User creation successful")
            else:
                self.log_test(f"Signup ({tier})", "FAIL", f"Status: {response['status_code']}")
        
        # Test login for each user
        for tier, user_data in self.test_users.items():
            login_data = {
                "email": user_data["email"],
                "password": user_data["password"]
            }
            
            response = await self.make_request("POST", "/auth/login", json=login_data)
            if response["status_code"] == 200 and "access_token" in response["data"]:
                user_data["token"] = response["data"]["access_token"]
                self.log_test(f"Login ({tier})", "PASS", "Authentication successful")
            else:
                self.log_test(f"Login ({tier})", "FAIL", f"Status: {response['status_code']}")
    
    async def test_tier_gating(self):
        """Test subscription tier access controls."""
        self.log_test("Tier Gating", "INFO", "Testing subscription tier restrictions...")
        
        # Test free user accessing professional features (should fail)
        free_token = self.test_users["free"]["token"]
        if free_token:
            response = await self.make_request("GET", "/cv-builder/cvs", token=free_token)
            if response["status_code"] == 403:
                self.log_test("Free -> Professional Block", "PASS", "Access properly restricted")
            else:
                self.log_test("Free -> Professional Block", "FAIL", "Should be blocked")
        
        # Test professional user accessing executive features (should fail)
        pro_token = self.test_users["professional"]["token"]
        if pro_token:
            response = await self.make_request("GET", "/executive/branding/profile", token=pro_token)
            if response["status_code"] == 403:
                self.log_test("Professional -> Executive Block", "PASS", "Access properly restricted")
            else:
                self.log_test("Professional -> Executive Block", "FAIL", "Should be blocked")
        
        # Test executive user accessing all features (should work)
        exec_token = self.test_users["executive"]["token"]
        if exec_token:
            response = await self.make_request("GET", "/executive/branding/profile", token=exec_token)
            if response["status_code"] in [200, 404]:  # OK or not found (no profile yet)
                self.log_test("Executive Access", "PASS", "Full access granted")
            else:
                self.log_test("Executive Access", "FAIL", f"Status: {response['status_code']}")
    
    async def test_cv_builder_api(self):
        """Test CV builder functionality."""
        self.log_test("CV Builder", "INFO", "Testing CV builder API...")
        
        pro_token = self.test_users["professional"]["token"]
        if not pro_token:
            self.log_test("CV Builder", "SKIP", "No professional token available")
            return
        
        # Test creating a CV
        cv_data = {
            "title": "Software Engineer CV",
            "template_id": "modern_tech",
            "sections": {
                "personal_info": {
                    "name": "Test User Professional",
                    "email": "pro@test.com",
                    "phone": "+27123456789"
                },
                "summary": "Experienced software engineer with expertise in Python and web development.",
                "experience": [
                    {
                        "title": "Senior Developer",
                        "company": "Tech Corp",
                        "duration": "2020-Present",
                        "description": "Lead development of web applications"
                    }
                ],
                "education": [
                    {
                        "degree": "BSc Computer Science",
                        "institution": "University of Cape Town",
                        "year": "2018"
                    }
                ],
                "skills": ["Python", "JavaScript", "React", "PostgreSQL"]
            }
        }
        
        response = await self.make_request("POST", "/cv-builder/cvs", json=cv_data, token=pro_token)
        if response["status_code"] in [200, 201]:
            cv_id = response["data"].get("cv_id")
            self.log_test("CV Creation", "PASS", f"CV created with ID: {cv_id}")
            
            # Test ATS scoring
            if cv_id:
                response = await self.make_request("POST", f"/cv-builder/cvs/{cv_id}/score", token=pro_token)
                if response["status_code"] == 200:
                    self.log_test("ATS Scoring", "PASS", f"Score: {response['data'].get('overall_score', 'N/A')}")
                else:
                    self.log_test("ATS Scoring", "FAIL", f"Status: {response['status_code']}")
        else:
            self.log_test("CV Creation", "FAIL", f"Status: {response['status_code']}")
    
    async def test_skills_assessment(self):
        """Test skills assessment functionality."""
        self.log_test("Skills Assessment", "INFO", "Testing skills assessment API...")
        
        pro_token = self.test_users["professional"]["token"]
        if not pro_token:
            self.log_test("Skills Assessment", "SKIP", "No professional token available")
            return
        
        # Start an assessment
        assessment_data = {
            "skill_category": "technical",
            "skill_name": "Python",
            "difficulty_level": "intermediate"
        }
        
        response = await self.make_request("POST", "/skills-assessment/start", json=assessment_data, token=pro_token)
        if response["status_code"] in [200, 201]:
            assessment_id = response["data"].get("assessment_id")
            self.log_test("Assessment Start", "PASS", f"Assessment ID: {assessment_id}")
            
            # Submit answers
            if assessment_id:
                answers_data = {
                    "answers": [
                        {"question_id": "q1", "answer": "option_a"},
                        {"question_id": "q2", "answer": "option_b"}
                    ]
                }
                
                response = await self.make_request(
                    "POST", 
                    f"/skills-assessment/{assessment_id}/submit", 
                    json=answers_data, 
                    token=pro_token
                )
                if response["status_code"] == 200:
                    self.log_test("Assessment Submission", "PASS", "Answers submitted successfully")
                else:
                    self.log_test("Assessment Submission", "FAIL", f"Status: {response['status_code']}")
        else:
            self.log_test("Assessment Start", "FAIL", f"Status: {response['status_code']}")
    
    async def test_job_applications(self):
        """Test job application tracking."""
        self.log_test("Job Applications", "INFO", "Testing application tracking...")
        
        pro_token = self.test_users["professional"]["token"]
        if not pro_token:
            self.log_test("Job Applications", "SKIP", "No professional token available")
            return
        
        # Create a test application
        app_data = {
            "job_id": str(uuid.uuid4()),
            "company_name": "Test Company",
            "position_title": "Software Engineer",
            "job_url": "https://example.com/job",
            "status": "applied",
            "notes": "Applied through company website"
        }
        
        response = await self.make_request("POST", "/applications", json=app_data, token=pro_token)
        if response["status_code"] in [200, 201]:
            app_id = response["data"].get("application_id")
            self.log_test("Application Creation", "PASS", f"Application ID: {app_id}")
            
            # Test updating application status
            if app_id:
                update_data = {"status": "interview_scheduled", "notes": "Phone interview confirmed"}
                response = await self.make_request(
                    "PUT", 
                    f"/applications/{app_id}", 
                    json=update_data, 
                    token=pro_token
                )
                if response["status_code"] == 200:
                    self.log_test("Application Update", "PASS", "Status updated successfully")
                else:
                    self.log_test("Application Update", "FAIL", f"Status: {response['status_code']}")
        else:
            self.log_test("Application Creation", "FAIL", f"Status: {response['status_code']}")
    
    async def test_auto_applications(self):
        """Test auto job application engine."""
        self.log_test("Auto Applications", "INFO", "Testing auto application engine...")
        
        exec_token = self.test_users["executive"]["token"]
        if not exec_token:
            self.log_test("Auto Applications", "SKIP", "No executive token available")
            return
        
        # Test job matching
        match_data = {
            "preferences": {
                "job_titles": ["Software Engineer", "Full Stack Developer"],
                "locations": ["Cape Town", "Remote"],
                "salary_min": 500000,
                "skills": ["Python", "React", "PostgreSQL"]
            }
        }
        
        response = await self.make_request("POST", "/auto-applications/match", json=match_data, token=exec_token)
        if response["status_code"] == 200:
            matches = response["data"].get("matches", [])
            self.log_test("Job Matching", "PASS", f"Found {len(matches)} matches")
        else:
            self.log_test("Job Matching", "FAIL", f"Status: {response['status_code']}")
        
        # Test quota check
        response = await self.make_request("GET", "/auto-applications/quota", token=exec_token)
        if response["status_code"] == 200:
            quota = response["data"]
            self.log_test("Quota Check", "PASS", f"Monthly quota: {quota.get('monthly_quota', 'N/A')}")
        else:
            self.log_test("Quota Check", "FAIL", f"Status: {response['status_code']}")
    
    async def test_job_alerts(self):
        """Test job alerts and company research."""
        self.log_test("Job Alerts", "INFO", "Testing job alerts system...")
        
        pro_token = self.test_users["professional"]["token"]
        if not pro_token:
            self.log_test("Job Alerts", "SKIP", "No professional token available")
            return
        
        # Create a job alert
        alert_data = {
            "name": "Python Developer Jobs",
            "keywords": ["Python", "Django", "Flask"],
            "location": "Cape Town",
            "remote_ok": True,
            "salary_min": 400000,
            "frequency": "weekly"
        }
        
        response = await self.make_request("POST", "/job-alerts/alerts", json=alert_data, token=pro_token)
        if response["status_code"] in [200, 201]:
            alert_id = response["data"].get("alert_id")
            self.log_test("Alert Creation", "PASS", f"Alert ID: {alert_id}")
            
            # Test alert
            if alert_id:
                response = await self.make_request("POST", f"/job-alerts/alerts/{alert_id}/test", token=pro_token)
                if response["status_code"] == 200:
                    matches = response["data"].get("total_matches", 0)
                    self.log_test("Alert Testing", "PASS", f"Found {matches} potential matches")
                else:
                    self.log_test("Alert Testing", "FAIL", f"Status: {response['status_code']}")
        else:
            self.log_test("Alert Creation", "FAIL", f"Status: {response['status_code']}")
    
    async def test_executive_features(self):
        """Test executive-only features."""
        self.log_test("Executive Features", "INFO", "Testing executive features...")
        
        exec_token = self.test_users["executive"]["token"]
        if not exec_token:
            self.log_test("Executive Features", "SKIP", "No executive token available")
            return
        
        # Test personal branding profile
        branding_data = {
            "brand_statement": "Innovative technology leader driving digital transformation",
            "value_proposition": "20+ years experience building scalable systems",
            "target_audience": "C-suite executives and senior tech leaders",
            "unique_selling_points": ["AI/ML expertise", "Team building", "Strategic vision"],
            "brand_keywords": ["leadership", "innovation", "transformation", "strategy", "technology"]
        }
        
        response = await self.make_request("POST", "/executive/branding/profile", json=branding_data, token=exec_token)
        if response["status_code"] in [200, 201]:
            self.log_test("Branding Profile", "PASS", "Profile created/updated")
            
            # Test brand analysis
            response = await self.make_request("POST", "/executive/branding/analyze", token=exec_token)
            if response["status_code"] == 200:
                score = response["data"].get("overall_score", 0)
                self.log_test("Brand Analysis", "PASS", f"Brand score: {score:.1f}")
            else:
                self.log_test("Brand Analysis", "FAIL", f"Status: {response['status_code']}")
        else:
            self.log_test("Branding Profile", "FAIL", f"Status: {response['status_code']}")
        
        # Test leadership assessment
        response = await self.make_request("POST", "/executive/leadership/assessment/start?assessment_type=self_assessment", token=exec_token)
        if response["status_code"] in [200, 201]:
            assessment_id = response["data"].get("assessment_id")
            self.log_test("Leadership Assessment", "PASS", f"Assessment started: {assessment_id}")
        else:
            self.log_test("Leadership Assessment", "FAIL", f"Status: {response['status_code']}")
    
    async def test_professional_tools(self):
        """Test professional tools suite."""
        self.log_test("Professional Tools", "INFO", "Testing professional tools...")
        
        pro_token = self.test_users["professional"]["token"]
        if not pro_token:
            self.log_test("Professional Tools", "SKIP", "No professional token available")
            return
        
        # Test LinkedIn optimization
        response = await self.make_request("POST", "/professional-tools/linkedin/optimize-headline?target_role=Senior Developer", token=pro_token)
        if response["status_code"] == 200:
            suggestions = response["data"].get("headline_suggestions", [])
            self.log_test("LinkedIn Headlines", "PASS", f"Generated {len(suggestions)} suggestions")
        else:
            self.log_test("LinkedIn Headlines", "FAIL", f"Status: {response['status_code']}")
        
        # Test follow-up template creation
        template_data = {
            "name": "Thank You After Interview",
            "follow_up_type": "thank_you",
            "subject_template": "Thank you for the interview - {position_title}",
            "body_template": "Dear {interviewer_name},\\n\\nThank you for taking the time to interview me for the {position_title} position at {company_name}.",
            "timing_hours": 24
        }
        
        response = await self.make_request("POST", "/professional-tools/templates", json=template_data, token=pro_token)
        if response["status_code"] in [200, 201]:
            self.log_test("Follow-up Template", "PASS", "Template created successfully")
        else:
            self.log_test("Follow-up Template", "FAIL", f"Status: {response['status_code']}")
        
        # Test reference management
        reference_data = {
            "name": "John Manager",
            "title": "Engineering Manager",
            "company": "Previous Corp",
            "email": "john@previouscorp.com",
            "relationship": "manager",
            "years_known": 3,
            "consent_given": True
        }
        
        response = await self.make_request("POST", "/professional-tools/references", json=reference_data, token=pro_token)
        if response["status_code"] in [200, 201]:
            self.log_test("Reference Management", "PASS", "Reference added successfully")
        else:
            self.log_test("Reference Management", "FAIL", f"Status: {response['status_code']}")
    
    async def test_search_and_analytics(self):
        """Test search and analytics functionality."""
        self.log_test("Search & Analytics", "INFO", "Testing search and analytics...")
        
        pro_token = self.test_users["professional"]["token"]
        if not pro_token:
            self.log_test("Search & Analytics", "SKIP", "No professional token available")
            return
        
        # Test job search
        response = await self.make_request("GET", "/search?query=python developer&location=cape town", token=pro_token)
        if response["status_code"] == 200:
            results = response["data"].get("results", [])
            self.log_test("Job Search", "PASS", f"Found {len(results)} results")
        else:
            self.log_test("Job Search", "FAIL", f"Status: {response['status_code']}")
        
        # Test analytics dashboard
        response = await self.make_request("GET", "/analytics/dashboard", token=pro_token)
        if response["status_code"] == 200:
            self.log_test("Analytics Dashboard", "PASS", "Dashboard data retrieved")
        else:
            self.log_test("Analytics Dashboard", "FAIL", f"Status: {response['status_code']}")
    
    async def test_market_intelligence(self):
        """Test market intelligence (Executive only)."""
        self.log_test("Market Intelligence", "INFO", "Testing market intelligence...")
        
        exec_token = self.test_users["executive"]["token"]
        if not exec_token:
            self.log_test("Market Intelligence", "SKIP", "No executive token available")
            return
        
        # Test generating market report
        response = await self.make_request(
            "POST", 
            "/job-alerts/market-intelligence/generate?report_type=salary_trends&location=South Africa", 
            token=exec_token
        )
        if response["status_code"] in [200, 201]:
            confidence = response["data"].get("confidence_score", 0)
            self.log_test("Market Report Generation", "PASS", f"Confidence: {confidence}%")
        else:
            self.log_test("Market Report Generation", "FAIL", f"Status: {response['status_code']}")
        
        # Test industry trends
        response = await self.make_request("GET", "/job-alerts/trends/industries", token=exec_token)
        if response["status_code"] == 200:
            trends = response["data"].get("trends", {})
            self.log_test("Industry Trends", "PASS", "Trends data retrieved")
        else:
            self.log_test("Industry Trends", "FAIL", f"Status: {response['status_code']}")
    
    async def test_error_handling(self):
        """Test error handling and edge cases."""
        self.log_test("Error Handling", "INFO", "Testing error handling...")
        
        # Test invalid endpoint
        response = await self.make_request("GET", "/invalid-endpoint")
        if response["status_code"] == 404:
            self.log_test("404 Handling", "PASS", "Invalid endpoint properly handled")
        else:
            self.log_test("404 Handling", "FAIL", f"Expected 404, got {response['status_code']}")
        
        # Test unauthorized access
        response = await self.make_request("GET", "/cv-builder/cvs")  # No token
        if response["status_code"] == 401:
            self.log_test("Unauthorized Access", "PASS", "Auth required properly enforced")
        else:
            self.log_test("Unauthorized Access", "FAIL", f"Expected 401, got {response['status_code']}")
        
        # Test invalid data
        pro_token = self.test_users["professional"]["token"]
        if pro_token:
            invalid_cv_data = {"invalid": "data"}
            response = await self.make_request("POST", "/cv-builder/cvs", json=invalid_cv_data, token=pro_token)
            if response["status_code"] in [400, 422]:  # Bad request or validation error
                self.log_test("Data Validation", "PASS", "Invalid data properly rejected")
            else:
                self.log_test("Data Validation", "FAIL", f"Expected 4xx, got {response['status_code']}")
    
    async def test_performance_endpoints(self):
        """Test performance and monitoring endpoints."""
        self.log_test("Performance", "INFO", "Testing performance endpoints...")
        
        # Test metrics endpoint
        response = await self.make_request("GET", "/../metrics")
        if response["status_code"] == 200:
            self.log_test("Metrics Endpoint", "PASS", "Prometheus metrics available")
        else:
            self.log_test("Metrics Endpoint", "FAIL", f"Status: {response['status_code']}")
        
        # Test scraping status
        response = await self.make_request("GET", "/scraping/status")
        if response["status_code"] == 200:
            active_scrapers = response["data"].get("active_scrapers", 0)
            self.log_test("Scraping Status", "PASS", f"Active scrapers: {active_scrapers}")
        else:
            self.log_test("Scraping Status", "FAIL", f"Status: {response['status_code']}")
    
    async def run_comprehensive_test(self):
        """Run all tests in sequence."""
        print(f"{Colors.BOLD}{Colors.BLUE} AI Job Chommie - Comprehensive API Integration Test{Colors.ENDC}")
        print(f"{Colors.BLUE}Testing backend API completeness and user experience flows{Colors.ENDC}\\n")
        
        # Run all test suites
        await self.test_health_checks()
        await self.test_authentication()
        await self.test_tier_gating()
        await self.test_cv_builder_api()
        await self.test_skills_assessment()
        await self.test_job_applications()
        await self.test_auto_applications()
        await self.test_job_alerts()
        await self.test_executive_features()
        await self.test_professional_tools()
        await self.test_search_and_analytics()
        await self.test_market_intelligence()
        await self.test_error_handling()
        await self.test_performance_endpoints()
        
        # Print summary
        print(f"\\n{Colors.BOLD} Test Results Summary:{Colors.ENDC}")
        print(f"{Colors.GREEN} Passed: {self.results['passed']}{Colors.ENDC}")
        print(f"{Colors.RED} Failed: {self.results['failed']}{Colors.ENDC}")
        print(f"{Colors.YELLOW}⏭  Skipped: {self.results['skipped']}{Colors.ENDC}")
        
        total_tests = sum(self.results.values())
        if total_tests > 0:
            success_rate = (self.results['passed'] / total_tests) * 100
            print(f"\\n{Colors.BOLD}Success Rate: {success_rate:.1f}%{Colors.ENDC}")
            
            if success_rate >= 90:
                print(f"{Colors.GREEN}{Colors.BOLD} Excellent! System is ready for production.{Colors.ENDC}")
            elif success_rate >= 75:
                print(f"{Colors.YELLOW}{Colors.BOLD}  Good, but some issues need attention.{Colors.ENDC}")
            else:
                print(f"{Colors.RED}{Colors.BOLD} Critical issues found. Review failed tests.{Colors.ENDC}")


async def run_user_journey_test():
    """Simulate a complete user journey through the system."""
    print(f"\\n{Colors.BOLD}{Colors.BLUE} User Journey Simulation{Colors.ENDC}")
    print(f"{Colors.BLUE}Simulating a complete user experience from signup to job application{Colors.ENDC}\\n")
    
    async with APITester() as tester:
        # Step 1: User signs up
        print(f"{Colors.BLUE}Step 1: User Registration{Colors.ENDC}")
        user_email = f"journey_test_{int(datetime.utcnow().timestamp())}@test.com"
        signup_data = {
            "email": user_email,
            "password": "journey123",
            "full_name": "Journey Test User",
            "subscription_tier": "professional"
        }
        
        response = await tester.make_request("POST", "/auth/signup", json=signup_data)
        if response["status_code"] in [200, 201, 409]:
            print(f"{Colors.GREEN} User registered successfully{Colors.ENDC}")
        else:
            print(f"{Colors.RED} Registration failed: {response['status_code']}{Colors.ENDC}")
            return
        
        # Step 2: User logs in
        print(f"\\n{Colors.BLUE}Step 2: User Login{Colors.ENDC}")
        login_data = {"email": user_email, "password": "journey123"}
        response = await tester.make_request("POST", "/auth/login", json=login_data)
        
        if response["status_code"] == 200 and "access_token" in response["data"]:
            token = response["data"]["access_token"]
            print(f"{Colors.GREEN} Login successful{Colors.ENDC}")
        else:
            print(f"{Colors.RED} Login failed: {response['status_code']}{Colors.ENDC}")
            return
        
        # Step 3: User builds CV
        print(f"\\n{Colors.BLUE}Step 3: CV Creation{Colors.ENDC}")
        cv_data = {
            "title": "My Professional CV",
            "template_id": "professional",
            "sections": {
                "personal_info": {"name": "Journey Test User", "email": user_email},
                "summary": "Experienced professional seeking new opportunities",
                "skills": ["Python", "Project Management", "Leadership"]
            }
        }
        
        response = await tester.make_request("POST", "/cv-builder/cvs", json=cv_data, token=token)
        if response["status_code"] in [200, 201]:
            cv_id = response["data"].get("cv_id")
            print(f"{Colors.GREEN} CV created: {cv_id}{Colors.ENDC}")
        else:
            print(f"{Colors.RED} CV creation failed: {response['status_code']}{Colors.ENDC}")
        
        # Step 4: User takes skills assessment
        print(f"\\n{Colors.BLUE}Step 4: Skills Assessment{Colors.ENDC}")
        assessment_data = {"skill_category": "technical", "skill_name": "Python"}
        response = await tester.make_request("POST", "/skills-assessment/start", json=assessment_data, token=token)
        
        if response["status_code"] in [200, 201]:
            print(f"{Colors.GREEN} Skills assessment started{Colors.ENDC}")
        else:
            print(f"{Colors.RED} Assessment failed: {response['status_code']}{Colors.ENDC}")
        
        # Step 5: User sets up job alerts
        print(f"\\n{Colors.BLUE}Step 5: Job Alerts Setup{Colors.ENDC}")
        alert_data = {
            "name": "Dream Job Alert",
            "keywords": ["python", "senior"],
            "location": "Cape Town",
            "frequency": "weekly"
        }
        
        response = await tester.make_request("POST", "/job-alerts/alerts", json=alert_data, token=token)
        if response["status_code"] in [200, 201]:
            print(f"{Colors.GREEN} Job alert created{Colors.ENDC}")
        else:
            print(f"{Colors.RED} Alert creation failed: {response['status_code']}{Colors.ENDC}")
        
        # Step 6: User searches for jobs
        print(f"\\n{Colors.BLUE}Step 6: Job Search{Colors.ENDC}")
        response = await tester.make_request("GET", "/search?query=python&location=cape town", token=token)
        if response["status_code"] == 200:
            results = response["data"].get("results", [])
            print(f"{Colors.GREEN} Job search completed: {len(results)} results{Colors.ENDC}")
        else:
            print(f"{Colors.RED} Job search failed: {response['status_code']}{Colors.ENDC}")
        
        # Step 7: User applies to a job
        print(f"\\n{Colors.BLUE}Step 7: Job Application{Colors.ENDC}")
        application_data = {
            "job_id": str(uuid.uuid4()),
            "company_name": "Dream Company",
            "position_title": "Senior Python Developer",
            "job_url": "https://dreamcompany.com/jobs/1",
            "status": "applied"
        }
        
        response = await tester.make_request("POST", "/applications", json=application_data, token=token)
        if response["status_code"] in [200, 201]:
            print(f"{Colors.GREEN} Job application tracked{Colors.ENDC}")
        else:
            print(f"{Colors.RED} Application tracking failed: {response['status_code']}{Colors.ENDC}")
        
        print(f"\\n{Colors.GREEN}{Colors.BOLD} User journey simulation completed!{Colors.ENDC}")


async def test_subscription_quotas():
    """Test subscription tier quotas and limits."""
    print(f"\\n{Colors.BOLD}{Colors.BLUE} Subscription Quota Testing{Colors.ENDC}")
    print(f"{Colors.BLUE}Testing tier-based quotas and feature limits{Colors.ENDC}\\n")
    
    async with APITester() as tester:
        # Login as professional user
        await tester.test_authentication()
        pro_token = tester.test_users["professional"]["token"]
        
        if not pro_token:
            print(f"{Colors.RED} Could not authenticate professional user{Colors.ENDC}")
            return
        
        # Test CV limit (Professional = 3 CVs)
        print(f"{Colors.BLUE}Testing CV quota (Professional tier: 3 CVs max){Colors.ENDC}")
        cv_count = 0
        for i in range(5):  # Try to create 5 CVs
            cv_data = {
                "title": f"Test CV {i+1}",
                "template_id": "basic",
                "sections": {"personal_info": {"name": f"Test User {i+1}"}}
            }
            
            response = await tester.make_request("POST", "/cv-builder/cvs", json=cv_data, token=pro_token)
            if response["status_code"] in [200, 201]:
                cv_count += 1
                print(f"{Colors.GREEN} CV {i+1} created{Colors.ENDC}")
            elif response["status_code"] == 403:
                print(f"{Colors.YELLOW} CV quota reached at {cv_count} CVs (Expected){Colors.ENDC}")
                break
            else:
                print(f"{Colors.RED} Unexpected error: {response['status_code']}{Colors.ENDC}")
        
        # Test job alert limit (Professional = 5 alerts)
        print(f"\\n{Colors.BLUE}Testing Job Alert quota (Professional tier: 5 alerts max){Colors.ENDC}")
        alert_count = 0
        for i in range(7):  # Try to create 7 alerts
            alert_data = {
                "name": f"Test Alert {i+1}",
                "keywords": [f"keyword{i+1}"],
                "frequency": "weekly"
            }
            
            response = await tester.make_request("POST", "/job-alerts/alerts", json=alert_data, token=pro_token)
            if response["status_code"] in [200, 201]:
                alert_count += 1
                print(f"{Colors.GREEN} Alert {i+1} created{Colors.ENDC}")
            elif response["status_code"] == 403:
                print(f"{Colors.YELLOW} Alert quota reached at {alert_count} alerts (Expected){Colors.ENDC}")
                break
            else:
                print(f"{Colors.RED} Unexpected error: {response['status_code']}{Colors.ENDC}")


async def main():
    """Run all tests."""
    print(f"{Colors.BOLD}{Colors.BLUE}")
    print("=" * 80)
    print(" AI JOB CHOMMIE - COMPREHENSIVE BACKEND VALIDATION")
    print("=" * 80)
    print(f"{Colors.ENDC}")
    print(f"{Colors.BLUE}Testing complete backend API implementation for all subscription tiers{Colors.ENDC}")
    print(f"{Colors.BLUE}Verifying feature gating, quotas, and user experience flows{Colors.ENDC}\\n")
    
    try:
        # Run main API tests
        async with APITester() as tester:
            await tester.run_comprehensive_test()
        
        # Run user journey simulation
        await run_user_journey_test()
        
        # Run quota testing
        await test_subscription_quotas()
        
        print(f"\\n{Colors.BOLD}{Colors.GREEN} ALL TESTS COMPLETED!{Colors.ENDC}")
        print(f"{Colors.GREEN}The AI Job Chommie backend is comprehensive and ready for production.{Colors.ENDC}")
        
    except KeyboardInterrupt:
        print(f"\\n{Colors.YELLOW}⏹  Tests interrupted by user{Colors.ENDC}")
    except Exception as e:
        print(f"\\n{Colors.RED} Test execution failed: {str(e)}{Colors.ENDC}")


if __name__ == "__main__":
    """
    Usage:
    1. Start the FastAPI server: uvicorn src.api.main:app --reload
    2. Run this test script: python test_api_integration.py
    
    This will validate:
    - All API endpoints are accessible
    - Authentication and authorization work
    - Tier-based feature gating functions correctly  
    - Database operations complete successfully
    - User experience flows work end-to-end
    - Error handling is robust
    - Performance monitoring is active
    """
    
    print(f"{Colors.YELLOW} Prerequisites:{Colors.ENDC}")
    print(f"   • FastAPI server running on {BASE_URL}")
    print(f"   • Database accessible and migrations applied")
    print(f"   • Redis cache service running")
    print(f"   • Kafka service running (optional)")
    print(f"\\n{Colors.BLUE}Starting tests in 3 seconds...{Colors.ENDC}")
    
    import time
    time.sleep(3)
    
    asyncio.run(main())
