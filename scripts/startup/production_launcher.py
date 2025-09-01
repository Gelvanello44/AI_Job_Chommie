#!/usr/bin/env python3
"""
Production Launcher - Main entry point for AI Job Chommie production deployment
Orchestrates all components, performs validation, and manages the complete system lifecycle
"""

import argparse
import asyncio
import json
import logging
import os
import signal
import sys
import time
import yaml
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import all production components
from logging_config import setup_logging, log_request, log_model_inference
from security_validator import SecurityValidator
from production_deployment import get_deployment_manager
from service_manager import ServiceManager
from monitoring_system import start_monitoring, get_performance_monitor


class ProductionLauncher:
    """
    Main production launcher that coordinates all components
    """
    
    def __init__(self, config_file: str = "deployment_config.yaml"):
        self.config_file = config_file
        self.config = self._load_configuration()
        self.start_time = datetime.now()
        self.is_running = False
        
        # Setup logging first
        self.loggers = setup_logging(
            service_name=self.config['application']['name'],
            log_level=self.config['logging']['level'],
            log_dir=self.config['logging']['handlers'][0]['filename'].split('/')[0],
            format_type=self.config['logging']['format']
        )
        self.logger = self.loggers['root']
        
        # Components
        self.deployment_manager = None
        self.service_manager = None
        self.security_validator = None
        self.performance_monitor = None
        
        self.logger.info(
            "Production Launcher initialized",
            extra={
                'config_file': config_file,
                'environment': self.config['application']['environment']
            }
        )
    
    def _load_configuration(self) -> Dict[str, Any]:
        """Load deployment configuration"""
        if Path(self.config_file).exists():
            with open(self.config_file, 'r') as f:
                return yaml.safe_load(f)
        else:
            raise FileNotFoundError(f"Configuration file not found: {self.config_file}")
    
    async def pre_flight_checks(self) -> bool:
        """Run pre-flight checks before starting services"""
        self.logger.info("Running pre-flight checks...")
        
        checks_passed = True
        
        # 1. Check environment variables
        required_env_vars = [
            'DATABASE_URL',
            'REDIS_URL',
            'JWT_ACCESS_SECRET',
            'ADMIN_API_KEY'
        ]
        
        missing_vars = []
        for var in required_env_vars:
            if not os.environ.get(var):
                missing_vars.append(var)
        
        if missing_vars:
            self.logger.error(f"Missing required environment variables: {missing_vars}")
            checks_passed = False
        else:
            self.logger.info(" Environment variables check passed")
        
        # 2. Check disk space
        import psutil
        disk = psutil.disk_usage('.')
        disk_free_gb = disk.free / (1024**3)
        
        if disk_free_gb < 5:
            self.logger.error(f"Insufficient disk space: {disk_free_gb:.1f}GB (minimum: 5GB)")
            checks_passed = False
        else:
            self.logger.info(f" Disk space check passed ({disk_free_gb:.1f}GB free)")
        
        # 3. Check memory
        memory = psutil.virtual_memory()
        memory_available_gb = memory.available / (1024**3)
        
        if memory_available_gb < 4:
            self.logger.warning(f"Low available memory: {memory_available_gb:.1f}GB (recommended: 4GB+)")
        else:
            self.logger.info(f" Memory check passed ({memory_available_gb:.1f}GB available)")
        
        # 4. Check required directories
        required_dirs = ['logs', 'cache', 'models']
        for dir_name in required_dirs:
            Path(dir_name).mkdir(parents=True, exist_ok=True)
        self.logger.info(" Required directories created")
        
        return checks_passed
    
    async def run_security_validation(self) -> bool:
        """Run security validation"""
        self.logger.info("Running security validation...")
        
        self.security_validator = SecurityValidator()
        report = await self.security_validator.run_full_validation()
        
        validation_result = report['validation_report']
        overall_status = validation_result['overall_status']
        
        self.logger.info(
            f"Security validation completed: {overall_status}",
            extra={
                'security_summary': validation_result['security_summary'],
                'performance_summary': validation_result['performance_summary']
            }
        )
        
        # Log recommendations
        for rec in validation_result['recommendations'][:5]:
            self.logger.warning(f"Security recommendation: {rec}")
        
        # Decide based on status
        if overall_status == "FAILED":
            self.logger.error("Security validation FAILED - deployment blocked")
            return False
        elif overall_status == "WARNING":
            self.logger.warning("Security validation has warnings - proceeding with caution")
        
        return True
    
    async def initialize_components(self):
        """Initialize all production components"""
        self.logger.info("Initializing production components...")
        
        # 1. Initialize deployment manager
        self.logger.info("Initializing deployment manager...")
        self.deployment_manager = get_deployment_manager()
        await self.deployment_manager.initialize()
        
        # 2. Initialize service manager
        self.logger.info("Initializing service manager...")
        self.service_manager = ServiceManager()
        
        # 3. Start monitoring
        self.logger.info("Starting monitoring system...")
        self.performance_monitor = start_monitoring()
        
        self.logger.info("All components initialized successfully")
    
    async def start_services(self):
        """Start all services"""
        self.logger.info("Starting production services...")
        
        # Start service manager which will handle all services
        await self.service_manager.start()
        
        # Wait for services to stabilize
        await asyncio.sleep(5)
        
        # Check service status
        statuses = self.service_manager.get_status()
        running_services = sum(1 for s in statuses.values() if s.state.value == "running")
        
        self.logger.info(f"Services started: {running_services}/{len(statuses)}")
        
        # Log individual service status
        for service_name, status in statuses.items():
            self.logger.info(
                f"Service {service_name}: {status.state.value}",
                extra={
                    'service': service_name,
                    'pid': status.pid,
                    'health': status.health_status
                }
            )
    
    async def post_startup_tasks(self):
        """Run post-startup tasks"""
        self.logger.info("Running post-startup tasks...")
        
        # 1. Verify deployment health
        deployment_status = self.deployment_manager.get_deployment_status()
        healthy_models = deployment_status['health_summary']['healthy']
        total_models = sum(deployment_status['health_summary'].values())
        
        self.logger.info(
            f"Model deployment status: {healthy_models}/{total_models} healthy",
            extra=deployment_status['health_summary']
        )
        
        # 2. Run initial performance benchmark
        self.logger.info("Running initial performance benchmark...")
        await self._run_performance_test()
        
        # 3. Create monitoring dashboards
        self._setup_monitoring_dashboards()
        
        self.logger.info("Post-startup tasks completed")
    
    async def _run_performance_test(self):
        """Run a quick performance test"""
        try:
            from local_inference_service import get_inference_service
            inference_service = get_inference_service()
            
            test_samples = [
                "Senior Python Developer with 5 years experience",
                "Machine Learning Engineer with TensorFlow expertise"
            ]
            
            start_time = time.time()
            result = inference_service.analyze_job_similarity(test_samples[0], test_samples[1])
            duration_ms = (time.time() - start_time) * 1000
            
            log_model_inference(self.loggers['performance'], {
                'model_name': 'embeddings',
                'input_size': len(test_samples[0]) + len(test_samples[1]),
                'output_size': 1,
                'duration_ms': duration_ms,
                'batch_size': 1,
                'cache_hit': False
            })
            
            self.logger.info(f"Performance test completed: {duration_ms:.1f}ms")
            
        except Exception as e:
            self.logger.error(f"Performance test failed: {str(e)}")
    
    def _setup_monitoring_dashboards(self):
        """Setup monitoring dashboards"""
        self.logger.info("Setting up monitoring dashboards...")
        
        # Create dashboard configuration
        from logging_config import create_monitoring_dashboard_config
        dashboard_config = create_monitoring_dashboard_config()
        
        # Save dashboard config
        dashboard_file = Path("monitoring/dashboards.json")
        dashboard_file.parent.mkdir(exist_ok=True)
        
        with open(dashboard_file, 'w') as f:
            json.dump(dashboard_config, f, indent=2)
        
        self.logger.info(f"Dashboard configuration saved to {dashboard_file}")
    
    def print_startup_summary(self):
        """Print startup summary"""
        startup_duration = (datetime.now() - self.start_time).total_seconds()
        
        print("\n" + "="*100)
        print(" AI JOB CHOMMIE PRODUCTION DEPLOYMENT COMPLETE")
        print("="*100)
        
        print(f"\n DEPLOYMENT SUMMARY:")
        print(f"   Environment: {self.config['application']['environment']}")
        print(f"   Version: {self.config['application']['version']}")
        print(f"   Startup Time: {startup_duration:.2f} seconds")
        
        # Service status
        if self.service_manager:
            statuses = self.service_manager.get_status()
            print(f"\n SERVICES ({len(statuses)} total):")
            for service_name, status in statuses.items():
                health_icon = "" if status.health_status == "healthy" else ""
                print(f"   {health_icon} {service_name}: {status.state.value} (PID: {status.pid or 'N/A'})")
        
        # Model status
        if self.deployment_manager:
            deployment_status = self.deployment_manager.get_deployment_status()
            print(f"\n MODELS:")
            for model_name, model_info in deployment_status['models'].items():
                status_icon = "" if model_info['health_status'] == "healthy" else ""
                print(f"   {status_icon} {model_name}: {model_info['version']} ({model_info['health_status']})")
        
        # Resource usage
        import psutil
        print(f"\n RESOURCES:")
        print(f"   CPU Usage: {psutil.cpu_percent()}%")
        print(f"   Memory Usage: {psutil.virtual_memory().percent}%")
        print(f"   Disk Free: {psutil.disk_usage('.').free / (1024**3):.1f}GB")
        
        print(f"\n ENDPOINTS:")
        print(f"   Model API: http://localhost:{self.config['server']['port']}")
        print(f"   Backend API: http://localhost:3001")
        print(f"   Monitoring: http://localhost:3002")
        
        print(f"\n FEATURES ENABLED:")
        features = self.config['features']
        for feature, enabled in features.items():
            if enabled:
                print(f"    {feature.replace('_', ' ').title()}")
        
        print("\n" + "="*100)
        print(" SYSTEM READY FOR PRODUCTION TRAFFIC!")
        print("="*100 + "\n")
    
    async def run(self) -> int:
        """Main run method"""
        try:
            self.logger.info("="*80)
            self.logger.info("STARTING AI JOB CHOMMIE PRODUCTION DEPLOYMENT")
            self.logger.info("="*80)
            
            # Pre-flight checks
            if not await self.pre_flight_checks():
                self.logger.error("Pre-flight checks failed")
                return 1
            
            # Security validation (can be skipped in dev)
            if self.config['application']['environment'] == 'production':
                if not await self.run_security_validation():
                    self.logger.error("Security validation failed")
                    return 1
            
            # Initialize components
            await self.initialize_components()
            
            # Start services
            await self.start_services()
            
            # Post-startup tasks
            await self.post_startup_tasks()
            
            # Mark as running
            self.is_running = True
            
            # Print summary
            self.print_startup_summary()
            
            # Keep running
            self.logger.info("System running. Press Ctrl+C to shutdown.")
            
            while self.is_running:
                await asyncio.sleep(60)
                
                # Periodic health check
                deployment_status = self.deployment_manager.get_deployment_status()
                healthy = deployment_status['health_summary']['healthy']
                total = sum(deployment_status['health_summary'].values())
                
                if healthy < total:
                    self.logger.warning(f"Health check: {healthy}/{total} models healthy")
            
            return 0
            
        except KeyboardInterrupt:
            self.logger.info("Shutdown requested by user")
            return 0
        except Exception as e:
            self.logger.exception(f"Fatal error: {str(e)}")
            return 1
        finally:
            await self.shutdown()
    
    async def shutdown(self):
        """Graceful shutdown"""
        self.logger.info("Initiating graceful shutdown...")
        
        self.is_running = False
        
        # Stop services
        if self.service_manager:
            self.logger.info("Stopping services...")
            self.service_manager.stop()
        
        # Shutdown deployment manager
        if self.deployment_manager:
            self.logger.info("Shutting down deployment manager...")
            await self.deployment_manager.shutdown()
        
        # Final log
        uptime = datetime.now() - self.start_time
        self.logger.info(
            f"Shutdown complete. Total uptime: {uptime}",
            extra={'uptime_seconds': uptime.total_seconds()}
        )
    
    def handle_signal(self, signum, frame):
        """Handle shutdown signals"""
        self.logger.info(f"Received signal {signum}")
        self.is_running = False


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="AI Job Chommie Production Launcher"
    )
    parser.add_argument(
        '--config',
        default='deployment_config.yaml',
        help='Deployment configuration file'
    )
    parser.add_argument(
        '--skip-security',
        action='store_true',
        help='Skip security validation (dev only)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Run pre-flight checks only'
    )
    
    args = parser.parse_args()
    
    # Create launcher
    launcher = ProductionLauncher(args.config)
    
    # Setup signal handlers
    signal.signal(signal.SIGTERM, launcher.handle_signal)
    signal.signal(signal.SIGINT, launcher.handle_signal)
    
    # Run
    exit_code = asyncio.run(launcher.run())
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
