"""
Comprehensive test for backend database and API connectivity
"""

import os
import sys
import json
import logging
import requests
import psutil
from pathlib import Path
import subprocess
import time

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class BackendConnectivityTester:
    def __init__(self):
        self.backend_dir = Path(__file__).parent / "ai-job-chommie-backend"
        self.results = {}
        self.backend_url = "http://localhost:5000"
        self.api_base = f"{self.backend_url}/api/v1"
        
    def check_environment_setup(self):
        """Check if backend environment is properly configured"""
        logger.info("="*60)
        logger.info("CHECKING BACKEND ENVIRONMENT SETUP")
        logger.info("="*60)
        
        # Check if .env file exists
        env_file = self.backend_dir / ".env"
        env_example = self.backend_dir / ".env.example"
        
        if env_file.exists():
            logger.info(" .env file found")
            # Check critical environment variables
            critical_vars = [
                "DATABASE_URL",
                "REDIS_HOST",
                "JWT_ACCESS_SECRET",
                "PORT"
            ]
            
            try:
                with open(env_file, 'r') as f:
                    env_content = f.read()
                    
                missing_vars = []
                for var in critical_vars:
                    if f"{var}=" not in env_content:
                        missing_vars.append(var)
                        
                if missing_vars:
                    logger.warning(f"  Missing critical variables: {', '.join(missing_vars)}")
                    return False
                else:
                    logger.info("   All critical environment variables present")
                    return True
                    
            except Exception as e:
                logger.error(f"   Error reading .env file: {e}")
                return False
        else:
            logger.warning(" .env file not found")
            if env_example.exists():
                logger.info("  - .env.example exists - copy it to .env and configure")
            return False
            
    def check_database_services(self):
        """Check if database services are running"""
        logger.info("\nChecking database services...")
        
        services_status = {
            "postgresql": False,
            "redis": False
        }
        
        # Check PostgreSQL
        try:
            # Check if PostgreSQL is running
            postgres_running = False
            for proc in psutil.process_iter(['pid', 'name']):
                if 'postgres' in proc.info['name'].lower():
                    postgres_running = True
                    break
                    
            if postgres_running:
                logger.info(" PostgreSQL service is running")
                services_status["postgresql"] = True
            else:
                logger.warning(" PostgreSQL service not detected")
                
        except Exception as e:
            logger.error(f" Error checking PostgreSQL: {e}")
            
        # Check Redis
        try:
            redis_running = False
            for proc in psutil.process_iter(['pid', 'name']):
                if 'redis' in proc.info['name'].lower():
                    redis_running = True
                    break
                    
            if redis_running:
                logger.info(" Redis service is running")
                services_status["redis"] = True
            else:
                logger.warning(" Redis service not detected")
                
        except Exception as e:
            logger.error(f" Error checking Redis: {e}")
            
        return all(services_status.values())
        
    def check_backend_server(self):
        """Check if backend server is running"""
        logger.info("\nChecking backend server...")
        
        try:
            # Check if server is running by making a health check request
            response = requests.get(f"{self.backend_url}/health", timeout=5)
            
            if response.status_code == 200:
                logger.info(f" Backend server is running on port 5000")
                health_data = response.json()
                logger.info(f"  - Status: {health_data.get('status', 'unknown')}")
                logger.info(f"  - Environment: {health_data.get('environment', 'unknown')}")
                if 'database' in health_data:
                    logger.info(f"  - Database: {health_data['database'].get('status', 'unknown')}")
                if 'redis' in health_data:
                    logger.info(f"  - Redis: {health_data['redis'].get('status', 'unknown')}")
                return True
            else:
                logger.warning(f" Backend server returned status {response.status_code}")
                return False
                
        except requests.exceptions.ConnectionError:
            logger.warning(" Backend server is not running or not accessible")
            logger.info("  - Make sure to start the server with: npm start")
            return False
        except Exception as e:
            logger.error(f" Error checking backend server: {e}")
            return False
            
    def test_api_endpoints(self):
        """Test various API endpoints"""
        logger.info("\nTesting API endpoints...")
        
        endpoints_to_test = [
            # Public endpoints
            {"method": "GET", "path": "/health", "name": "Health Check"},
            {"method": "GET", "path": "/api-docs", "name": "API Documentation"},
            {"method": "GET", "path": "/api/v1/jobs", "name": "Jobs Listing"},
            {"method": "GET", "path": "/api/v1/companies", "name": "Companies Listing"},
            
            # Auth endpoints (without credentials)
            {"method": "POST", "path": "/api/v1/auth/register", "name": "Registration", "data": {}},
            {"method": "POST", "path": "/api/v1/auth/login", "name": "Login", "data": {}},
        ]
        
        results = {}
        
        for endpoint in endpoints_to_test:
            try:
                url = f"{self.backend_url}{endpoint['path']}"
                
                if endpoint['method'] == 'GET':
                    response = requests.get(url, timeout=5)
                else:
                    response = requests.post(
                        url, 
                        json=endpoint.get('data', {}),
                        headers={'Content-Type': 'application/json'},
                        timeout=5
                    )
                    
                if response.status_code < 500:
                    logger.info(f"   {endpoint['name']}: {response.status_code}")
                    results[endpoint['name']] = True
                else:
                    logger.warning(f"   {endpoint['name']}: {response.status_code}")
                    results[endpoint['name']] = False
                    
            except Exception as e:
                logger.error(f"   {endpoint['name']}: {str(e)}")
                results[endpoint['name']] = False
                
        return results
        
    def check_database_connection(self):
        """Check database connection via API"""
        logger.info("\nChecking database connection...")
        
        try:
            # Try to fetch jobs which requires database
            response = requests.get(f"{self.api_base}/jobs?limit=1", timeout=5)
            
            if response.status_code == 200:
                logger.info(" Database connection successful")
                data = response.json()
                if 'data' in data:
                    logger.info(f"  - Response structure valid")
                return True
            elif response.status_code == 500:
                logger.error(" Database connection failed (500 error)")
                return False
            else:
                logger.warning(f"  Database query returned status {response.status_code}")
                return True  # Non-500 means database might be connected
                
        except Exception as e:
            logger.error(f" Error checking database connection: {e}")
            return False
            
    def check_authentication_flow(self):
        """Test basic authentication flow"""
        logger.info("\nTesting authentication flow...")
        
        # Test user registration
        test_user = {
            "email": f"test_{int(time.time())}@example.com",
            "password": "TestPassword123!",
            "firstName": "Test",
            "lastName": "User",
            "userType": "job_seeker"
        }
        
        try:
            # Register
            register_response = requests.post(
                f"{self.api_base}/auth/register",
                json=test_user,
                headers={'Content-Type': 'application/json'},
                timeout=5
            )
            
            if register_response.status_code in [201, 409]:  # 409 if user exists
                logger.info(" Registration endpoint functional")
                
                # Try login
                login_response = requests.post(
                    f"{self.api_base}/auth/login",
                    json={
                        "email": test_user["email"],
                        "password": test_user["password"]
                    },
                    headers={'Content-Type': 'application/json'},
                    timeout=5
                )
                
                if login_response.status_code == 200:
                    logger.info(" Login endpoint functional")
                    data = login_response.json()
                    if 'token' in data or 'accessToken' in data:
                        logger.info("  - JWT token received")
                    return True
                else:
                    logger.warning(f"  Login returned status {login_response.status_code}")
                    return False
            else:
                logger.warning(f"  Registration returned status {register_response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f" Error testing authentication: {e}")
            return False
            
    def check_package_dependencies(self):
        """Check if all npm packages are installed"""
        logger.info("\nChecking package dependencies...")
        
        package_json = self.backend_dir / "package.json"
        node_modules = self.backend_dir / "node_modules"
        
        if not package_json.exists():
            logger.error(" package.json not found")
            return False
            
        if not node_modules.exists():
            logger.warning(" node_modules directory not found")
            logger.info("  - Run 'npm install' in the backend directory")
            return False
            
        try:
            with open(package_json, 'r') as f:
                package_data = json.load(f)
                
            dependencies = list(package_data.get('dependencies', {}).keys())
            dev_dependencies = list(package_data.get('devDependencies', {}).keys())
            
            logger.info(f" Found {len(dependencies)} dependencies")
            logger.info(f" Found {len(dev_dependencies)} dev dependencies")
            
            # Check for critical packages
            critical_packages = [
                "express",
                "prisma",
                "@prisma/client",
                "jsonwebtoken",
                "bcryptjs",
                "cors",
                "dotenv"
            ]
            
            missing = []
            for pkg in critical_packages:
                pkg_dir = node_modules / pkg
                if not pkg_dir.exists():
                    missing.append(pkg)
                    
            if missing:
                logger.warning(f"  Missing critical packages: {', '.join(missing)}")
                return False
            else:
                logger.info("   All critical packages installed")
                return True
                
        except Exception as e:
            logger.error(f" Error checking dependencies: {e}")
            return False
            
    def check_prisma_setup(self):
        """Check if Prisma is properly set up"""
        logger.info("\nChecking Prisma setup...")
        
        prisma_dir = self.backend_dir / "prisma"
        schema_file = prisma_dir / "schema.prisma"
        
        if not schema_file.exists():
            logger.warning(" Prisma schema file not found")
            return False
            
        logger.info(" Prisma schema file found")
        
        # Check for migrations
        migrations_dir = prisma_dir / "migrations"
        if migrations_dir.exists():
            migrations = list(migrations_dir.iterdir())
            if migrations:
                logger.info(f" Found {len(migrations)} database migrations")
            else:
                logger.warning("  No migrations found - run 'npx prisma migrate dev'")
        else:
            logger.warning("  Migrations directory not found")
            
        return True
        
    def run_all_tests(self):
        """Run all backend connectivity tests"""
        logger.info("="*60)
        logger.info("BACKEND DATABASE AND API CONNECTIVITY VERIFICATION")
        logger.info("="*60)
        
        # Run tests
        self.results["Environment Setup"] = self.check_environment_setup()
        self.results["Database Services"] = self.check_database_services()
        self.results["Package Dependencies"] = self.check_package_dependencies()
        self.results["Prisma Setup"] = self.check_prisma_setup()
        self.results["Backend Server"] = self.check_backend_server()
        
        # Only test these if server is running
        if self.results["Backend Server"]:
            endpoint_results = self.test_api_endpoints()
            self.results["API Endpoints"] = all(endpoint_results.values())
            self.results["Database Connection"] = self.check_database_connection()
            self.results["Authentication"] = self.check_authentication_flow()
        else:
            self.results["API Endpoints"] = False
            self.results["Database Connection"] = False
            self.results["Authentication"] = False
            
        # Summary
        logger.info("\n" + "="*60)
        logger.info("BACKEND CONNECTIVITY SUMMARY")
        logger.info("="*60)
        
        all_passed = True
        for component, status in self.results.items():
            status_str = " PASS" if status else " FAIL"
            logger.info(f"{component}: {status_str}")
            if not status:
                all_passed = False
                
        logger.info("\n" + "="*60)
        if all_passed:
            logger.info(" BACKEND FULLY OPERATIONAL!")
            logger.info("  - Environment properly configured")
            logger.info("  - Database services running")
            logger.info("  - API endpoints responsive")
            logger.info("  - Authentication system functional")
        else:
            logger.info(" BACKEND PARTIALLY OPERATIONAL")
            
            # Provide specific recommendations
            logger.info("\nRECOMMENDATIONS:")
            
            if not self.results.get("Environment Setup"):
                logger.info("  1. Copy .env.example to .env and configure database credentials")
                
            if not self.results.get("Database Services"):
                logger.info("  2. Start PostgreSQL and Redis services:")
                logger.info("     - PostgreSQL: pg_ctl start or sudo service postgresql start")
                logger.info("     - Redis: redis-server or sudo service redis start")
                
            if not self.results.get("Package Dependencies"):
                logger.info("  3. Install npm dependencies:")
                logger.info(f"     cd {self.backend_dir}")
                logger.info("     npm install")
                
            if not self.results.get("Backend Server"):
                logger.info("  4. Start the backend server:")
                logger.info(f"     cd {self.backend_dir}")
                logger.info("     npm start")
                
            if not self.results.get("Database Connection"):
                logger.info("  5. Run database migrations:")
                logger.info("     npx prisma migrate dev")
                
        return all_passed

def main():
    """Main test function"""
    tester = BackendConnectivityTester()
    success = tester.run_all_tests()
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
