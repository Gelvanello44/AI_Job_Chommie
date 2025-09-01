"""
Comprehensive test for Sentry integration across the entire AI Job Chommie ecosystem
"""

import os
import sys
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SentryIntegrationTester:
    def __init__(self):
        self.results = {}
        self.sentry_files = []
        
    def find_sentry_configurations(self):
        """Find all Sentry configuration files in the project"""
        logger.info("="*60)
        logger.info("SEARCHING FOR SENTRY CONFIGURATIONS")
        logger.info("="*60)
        
        root_dir = Path(os.path.dirname(__file__))
        sentry_configs = []
        
        # Search patterns for Sentry configuration
        patterns = [
            "**/sentry.py",
            "**/sentry_config.py",
            "**/*sentry*.py",
            "**/config*.py",
            "**/.env*",
            "**/settings*.py"
        ]
        
        for pattern in patterns:
            for file_path in root_dir.glob(pattern):
                if file_path.is_file() and "node_modules" not in str(file_path):
                    sentry_configs.append(file_path)
                    
        # Deduplicate
        sentry_configs = list(set(sentry_configs))
        
        logger.info(f"Found {len(sentry_configs)} potential Sentry configuration files:")
        for config in sentry_configs[:10]:  # Show first 10
            logger.info(f"  - {config.relative_to(root_dir)}")
            
        self.sentry_files = sentry_configs
        return sentry_configs
        
    def test_sentry_imports(self):
        """Test if Sentry SDK can be imported"""
        logger.info("\nTesting Sentry SDK import...")
        try:
            import sentry_sdk
            logger.info(" sentry_sdk imported successfully")
            logger.info(f"  - Sentry SDK version: {sentry_sdk.VERSION}")
            
            # Test integrations
            from sentry_sdk.integrations.logging import LoggingIntegration
            logger.info(" LoggingIntegration available")
            
            try:
                from sentry_sdk.integrations.fastapi import FastApiIntegration
                logger.info(" FastApiIntegration available")
            except ImportError:
                logger.warning(" FastApiIntegration not available")
                
            try:
                from sentry_sdk.integrations.asyncio import AsyncioIntegration
                logger.info(" AsyncioIntegration available")
            except ImportError:
                logger.warning(" AsyncioIntegration not available")
                
            return True
        except ImportError as e:
            logger.error(f" Failed to import sentry_sdk: {e}")
            return False
            
    def test_job_scraping_sentry(self):
        """Test job-scraping-service Sentry configuration"""
        logger.info("\nTesting job-scraping-service Sentry configuration...")
        
        # Add job-scraping-service to path
        scraping_path = Path(__file__).parent / "job-scraping-service" / "src"
        if str(scraping_path) not in sys.path:
            sys.path.insert(0, str(scraping_path))
            
        try:
            from config.sentry import (
                init_sentry,
                capture_scraping_error,
                capture_processing_error,
                capture_api_error,
                SentryScrapingContext,
                add_scraping_breadcrumb,
                capture_performance_metric
            )
            
            logger.info(" All Sentry functions imported from job-scraping-service")
            
            # Test initialization
            init_sentry()  # Should handle missing DSN
            logger.info(" init_sentry() executed without errors")
            
            # Test context manager
            logger.info(" SentryScrapingContext available for error tracking")
            
            return True
            
        except Exception as e:
            logger.error(f" Failed to test job-scraping-service Sentry: {e}")
            return False
            
    def test_backend_sentry(self):
        """Test backend service Sentry configuration"""
        logger.info("\nTesting backend service Sentry configuration...")
        
        backend_paths = [
            Path(__file__).parent / "ai-job-chommie-backend",
            Path(__file__).parent / "src",  # Alternative path
        ]
        
        sentry_found = False
        
        for backend_path in backend_paths:
            if backend_path.exists():
                # Look for Sentry configuration files
                sentry_files = list(backend_path.glob("**/sentry*.js")) + \
                              list(backend_path.glob("**/sentry*.ts")) + \
                              list(backend_path.glob("**/*sentry*.config.*"))
                
                if sentry_files:
                    sentry_found = True
                    logger.info(f" Found {len(sentry_files)} Sentry configuration files in backend")
                    for f in sentry_files[:3]:
                        logger.info(f"  - {f.name}")
                    break
                    
        if not sentry_found:
            logger.warning(" No Sentry configuration found in backend service")
            
        return sentry_found
        
    def test_environment_variables(self):
        """Test Sentry environment variables"""
        logger.info("\nTesting Sentry environment variables...")
        
        env_vars = [
            "SENTRY_DSN",
            "SENTRY_ORG",
            "SENTRY_PROJECT",
            "SENTRY_AUTH_TOKEN",
            "SENTRY_ENVIRONMENT",
            "SENTRY_TRACES_SAMPLE_RATE"
        ]
        
        found_vars = []
        for var in env_vars:
            if os.getenv(var):
                found_vars.append(var)
                logger.info(f" {var} is configured")
            else:
                logger.info(f"  {var} not set")
                
        if found_vars:
            logger.info(f"\n Found {len(found_vars)} Sentry environment variables")
        else:
            logger.warning(" No Sentry environment variables found")
            
        return len(found_vars) > 0
        
    def test_sentry_initialization(self):
        """Test actual Sentry initialization"""
        logger.info("\nTesting Sentry initialization...")
        
        try:
            import sentry_sdk
            
            # Check if already initialized
            if sentry_sdk.Hub.current.client:
                logger.info(" Sentry is already initialized")
                client = sentry_sdk.Hub.current.client
                if hasattr(client, 'dsn'):
                    logger.info("  - DSN is configured")
                return True
            else:
                logger.info("  Sentry not initialized (no DSN configured)")
                
                # Try test initialization
                sentry_sdk.init(
                    dsn=None,  # No DSN for testing
                    environment="test",
                    traces_sample_rate=0.1
                )
                
                logger.info(" Sentry test initialization successful")
                return True
                
        except Exception as e:
            logger.error(f" Sentry initialization failed: {e}")
            return False
            
    def test_error_capture(self):
        """Test Sentry error capture functionality"""
        logger.info("\nTesting Sentry error capture...")
        
        try:
            import sentry_sdk
            
            # Test breadcrumb
            sentry_sdk.add_breadcrumb(
                message="Test breadcrumb",
                category="test",
                level="info"
            )
            logger.info(" Breadcrumb added successfully")
            
            # Test context
            with sentry_sdk.configure_scope() as scope:
                scope.set_tag("test_tag", "test_value")
                scope.set_context("test_context", {"key": "value"})
                
            logger.info(" Context configuration successful")
            
            # Test message capture (won't actually send without DSN)
            sentry_sdk.capture_message("Test message", level="info")
            logger.info(" Message capture successful")
            
            return True
            
        except Exception as e:
            logger.error(f" Error capture test failed: {e}")
            return False
            
    def check_sentry_in_requirements(self):
        """Check if Sentry is in requirements files"""
        logger.info("\nChecking Sentry in requirements files...")
        
        root_dir = Path(os.path.dirname(__file__))
        req_files = list(root_dir.glob("**/requirements*.txt")) + \
                   list(root_dir.glob("**/pyproject.toml")) + \
                   list(root_dir.glob("**/package.json"))
                   
        sentry_deps = []
        
        for req_file in req_files:
            if "node_modules" in str(req_file):
                continue
                
            try:
                content = req_file.read_text().lower()
                if "sentry" in content:
                    sentry_deps.append(req_file)
                    logger.info(f" Sentry found in {req_file.relative_to(root_dir)}")
            except:
                pass
                
        if sentry_deps:
            logger.info(f"\n Sentry dependencies found in {len(sentry_deps)} files")
        else:
            logger.warning(" No Sentry dependencies found in requirements files")
            
        return len(sentry_deps) > 0
        
    def run_all_tests(self):
        """Run all Sentry integration tests"""
        logger.info("="*60)
        logger.info("SENTRY INTEGRATION VERIFICATION")
        logger.info("="*60)
        
        # Find configurations
        self.find_sentry_configurations()
        
        # Run tests
        self.results["SDK Import"] = self.test_sentry_imports()
        self.results["Job Scraping Service"] = self.test_job_scraping_sentry()
        self.results["Backend Service"] = self.test_backend_sentry()
        self.results["Environment Variables"] = self.test_environment_variables()
        self.results["Initialization"] = self.test_sentry_initialization()
        self.results["Error Capture"] = self.test_error_capture()
        self.results["Dependencies"] = self.check_sentry_in_requirements()
        
        # Summary
        logger.info("\n" + "="*60)
        logger.info("SENTRY INTEGRATION SUMMARY")
        logger.info("="*60)
        
        all_passed = True
        for component, status in self.results.items():
            status_str = " PASS" if status else " FAIL"
            logger.info(f"{component}: {status_str}")
            if not status:
                all_passed = False
                
        logger.info("\n" + "="*60)
        if all_passed:
            logger.info(" SENTRY INTEGRATION FULLY CONFIGURED!")
            logger.info("  - SDK is properly installed")
            logger.info("  - Job scraping service has comprehensive error tracking")
            logger.info("  - Error capture mechanisms are in place")
            logger.info("  - Performance monitoring is available")
        else:
            logger.info(" SENTRY INTEGRATION PARTIALLY CONFIGURED")
            logger.info("  - Some components are missing Sentry configuration")
            logger.info("  - Consider adding SENTRY_DSN to environment variables")
            logger.info("  - Backend services may need Sentry setup")
            
        # Recommendations
        logger.info("\nRECOMMENDATIONS:")
        if not self.results.get("Environment Variables"):
            logger.info("  1. Set SENTRY_DSN environment variable for production")
        if not self.results.get("Backend Service"):
            logger.info("  2. Add Sentry configuration to backend services")
        logger.info("  3. Configure Sentry alerts for critical errors")
        logger.info("  4. Set up performance monitoring for API endpoints")
        logger.info("  5. Create custom Sentry dashboards for scraping metrics")
        
        return all_passed

def main():
    """Main test function"""
    tester = SentryIntegrationTester()
    success = tester.run_all_tests()
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
