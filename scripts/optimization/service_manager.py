"""
Service Manager - Automatic service management with supervision and orchestration
Implements process supervision, auto-restart, health monitoring, and service coordination
"""

import asyncio
import json
import logging
import os
import psutil
import signal
import subprocess
import sys
import time
import yaml
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path
from threading import Thread, Event
import multiprocessing
from enum import Enum

logger = logging.getLogger(__name__)


class ServiceState(Enum):
    """Service state enumeration"""
    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"
    FAILED = "failed"
    RESTARTING = "restarting"


@dataclass
class ServiceConfig:
    """Service configuration"""
    name: str
    command: str
    args: List[str]
    working_dir: str
    environment: Dict[str, str]
    dependencies: List[str]
    restart_policy: str  # always, on-failure, never
    restart_delay: int = 5
    max_restarts: int = 3
    health_check_interval: int = 30
    health_check_command: Optional[str] = None
    startup_timeout: int = 60
    shutdown_timeout: int = 30
    log_file: Optional[str] = None
    priority: int = 0  # Lower number = higher priority


@dataclass
class ServiceStatus:
    """Service status information"""
    name: str
    state: ServiceState
    pid: Optional[int]
    start_time: Optional[datetime]
    restart_count: int
    last_health_check: Optional[datetime]
    health_status: str  # healthy, unhealthy, unknown
    cpu_percent: float
    memory_mb: float
    error_message: Optional[str] = None


class ServiceManager:
    """
    Manages multiple services with supervision and orchestration capabilities
    """
    
    def __init__(self, config_file: Optional[str] = None):
        self.config_file = config_file or "services_config.yaml"
        self.services: Dict[str, ServiceConfig] = {}
        self.processes: Dict[str, subprocess.Popen] = {}
        self.service_states: Dict[str, ServiceState] = {}
        self.restart_counts: Dict[str, int] = {}
        self.start_times: Dict[str, datetime] = {}
        self.health_statuses: Dict[str, str] = {}
        
        # Control flags
        self.running = False
        self.supervisor_thread: Optional[Thread] = None
        self.stop_event = Event()
        
        # Load configuration
        self._load_configuration()
        
        # Setup signal handlers
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)
        
        logger.info("ServiceManager initialized")
    
    def _load_configuration(self):
        """Load service configuration from file or use defaults"""
        if Path(self.config_file).exists():
            with open(self.config_file, 'r') as f:
                config = yaml.safe_load(f)
                for service_name, service_config in config.get('services', {}).items():
                    self.services[service_name] = ServiceConfig(
                        name=service_name,
                        **service_config
                    )
        else:
            # Default service configuration
            self._setup_default_services()
        
        # Initialize service states
        for service_name in self.services:
            self.service_states[service_name] = ServiceState.STOPPED
            self.restart_counts[service_name] = 0
            self.health_statuses[service_name] = "unknown"
    
    def _setup_default_services(self):
        """Setup default service configurations"""
        # Model inference service
        self.services['model_inference'] = ServiceConfig(
            name='model_inference',
            command=sys.executable,
            args=['start_production.py'],
            working_dir='.',
            environment={'ENVIRONMENT': 'production'},
            dependencies=[],
            restart_policy='always',
            restart_delay=10,
            max_restarts=5,
            health_check_interval=30,
            health_check_command='curl -f http://localhost:5000/health || exit 1',
            startup_timeout=120,
            log_file='logs/model_inference.log',
            priority=0
        )
        
        # Backend API service
        self.services['backend_api'] = ServiceConfig(
            name='backend_api',
            command='npm',
            args=['run', 'start:prod'],
            working_dir='./ai-job-chommie-backend',
            environment={'NODE_ENV': 'production', 'PORT': '3001'},
            dependencies=['redis', 'database'],
            restart_policy='always',
            restart_delay=5,
            max_restarts=3,
            health_check_interval=20,
            health_check_command='curl -f http://localhost:3001/api/v1/health || exit 1',
            startup_timeout=60,
            log_file='logs/backend_api.log',
            priority=1
        )
        
        # Redis service (if not using system Redis)
        self.services['redis'] = ServiceConfig(
            name='redis',
            command='redis-server',
            args=['--port', '6379', '--appendonly', 'yes'],
            working_dir='./redis',
            environment={},
            dependencies=[],
            restart_policy='always',
            restart_delay=5,
            max_restarts=3,
            health_check_interval=10,
            health_check_command='redis-cli ping',
            startup_timeout=30,
            log_file='logs/redis.log',
            priority=10
        )
        
        # Monitoring service
        self.services['monitoring'] = ServiceConfig(
            name='monitoring',
            command=sys.executable,
            args=['monitoring_dashboard.py'],
            working_dir='.',
            environment={'MONITORING_PORT': '3002'},
            dependencies=['model_inference'],
            restart_policy='on-failure',
            restart_delay=10,
            max_restarts=3,
            health_check_interval=30,
            startup_timeout=30,
            log_file='logs/monitoring.log',
            priority=5
        )
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}, initiating shutdown...")
        self.stop()
    
    async def start(self):
        """Start the service manager and all configured services"""
        logger.info("Starting ServiceManager...")
        
        self.running = True
        self.stop_event.clear()
        
        # Start services in dependency order
        await self._start_services_ordered()
        
        # Start supervisor thread
        self.supervisor_thread = Thread(target=self._supervisor_loop, daemon=True)
        self.supervisor_thread.start()
        
        logger.info("ServiceManager started successfully")
    
    async def _start_services_ordered(self):
        """Start services respecting dependencies and priorities"""
        # Sort services by priority
        sorted_services = sorted(
            self.services.items(),
            key=lambda x: x[1].priority
        )
        
        # Start services
        for service_name, service_config in sorted_services:
            # Check dependencies
            deps_satisfied = all(
                self.service_states.get(dep) == ServiceState.RUNNING
                for dep in service_config.dependencies
            )
            
            if not deps_satisfied:
                logger.warning(f"Dependencies not satisfied for {service_name}, skipping...")
                continue
            
            await self._start_service(service_name)
    
    async def _start_service(self, service_name: str) -> bool:
        """Start a single service"""
        if service_name not in self.services:
            logger.error(f"Service {service_name} not found")
            return False
        
        if self.service_states[service_name] in [ServiceState.RUNNING, ServiceState.STARTING]:
            logger.warning(f"Service {service_name} is already running or starting")
            return True
        
        service_config = self.services[service_name]
        logger.info(f"Starting service: {service_name}")
        
        self.service_states[service_name] = ServiceState.STARTING
        
        try:
            # Prepare environment
            env = os.environ.copy()
            env.update(service_config.environment)
            
            # Prepare command
            cmd = [service_config.command] + service_config.args
            
            # Open log file if specified
            log_handle = None
            if service_config.log_file:
                log_dir = Path(service_config.log_file).parent
                log_dir.mkdir(parents=True, exist_ok=True)
                log_handle = open(service_config.log_file, 'a')
            
            # Start process
            process = subprocess.Popen(
                cmd,
                cwd=service_config.working_dir,
                env=env,
                stdout=log_handle or subprocess.PIPE,
                stderr=log_handle or subprocess.PIPE,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
            )
            
            self.processes[service_name] = process
            self.start_times[service_name] = datetime.now()
            
            # Wait for startup
            startup_deadline = time.time() + service_config.startup_timeout
            while time.time() < startup_deadline:
                if process.poll() is not None:
                    # Process died during startup
                    raise Exception(f"Process exited with code {process.returncode}")
                
                # Check if service is ready (basic check)
                await asyncio.sleep(1)
                
                # Run health check if available
                if service_config.health_check_command:
                    if await self._run_health_check(service_name):
                        break
                elif time.time() - self.start_times[service_name].timestamp() > 5:
                    # Assume ready after 5 seconds if no health check
                    break
            
            self.service_states[service_name] = ServiceState.RUNNING
            logger.info(f"Service {service_name} started successfully (PID: {process.pid})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start service {service_name}: {str(e)}")
            self.service_states[service_name] = ServiceState.FAILED
            self.health_statuses[service_name] = f"Startup failed: {str(e)}"
            return False
    
    async def _run_health_check(self, service_name: str) -> bool:
        """Run health check for a service"""
        service_config = self.services[service_name]
        
        if not service_config.health_check_command:
            return True
        
        try:
            # Run health check command
            result = subprocess.run(
                service_config.health_check_command,
                shell=True,
                capture_output=True,
                timeout=10
            )
            
            health_ok = result.returncode == 0
            self.health_statuses[service_name] = "healthy" if health_ok else "unhealthy"
            
            return health_ok
            
        except subprocess.TimeoutExpired:
            self.health_statuses[service_name] = "timeout"
            return False
        except Exception as e:
            self.health_statuses[service_name] = f"error: {str(e)}"
            return False
    
    def _supervisor_loop(self):
        """Main supervisor loop running in separate thread"""
        logger.info("Supervisor loop started")
        
        while self.running and not self.stop_event.is_set():
            try:
                # Check all services
                for service_name in list(self.services.keys()):
                    if self.service_states[service_name] == ServiceState.RUNNING:
                        process = self.processes.get(service_name)
                        
                        if process and process.poll() is not None:
                            # Process has died
                            logger.warning(f"Service {service_name} died (exit code: {process.returncode})")
                            self._handle_service_failure(service_name)
                        else:
                            # Run health check
                            asyncio.run(self._check_service_health(service_name))
                
                # Sleep before next check
                self.stop_event.wait(5)
                
            except Exception as e:
                logger.error(f"Error in supervisor loop: {str(e)}")
                time.sleep(5)
        
        logger.info("Supervisor loop stopped")
    
    async def _check_service_health(self, service_name: str):
        """Check health of a running service"""
        service_config = self.services[service_name]
        
        # Check if it's time for health check
        last_check = getattr(self, f"_last_health_check_{service_name}", 0)
        if time.time() - last_check < service_config.health_check_interval:
            return
        
        setattr(self, f"_last_health_check_{service_name}", time.time())
        
        # Run health check
        health_ok = await self._run_health_check(service_name)
        
        if not health_ok and self.service_states[service_name] == ServiceState.RUNNING:
            logger.warning(f"Service {service_name} is unhealthy")
            # Could implement gradual degradation here
    
    def _handle_service_failure(self, service_name: str):
        """Handle service failure based on restart policy"""
        service_config = self.services[service_name]
        self.service_states[service_name] = ServiceState.FAILED
        
        # Check restart policy
        if service_config.restart_policy == "never":
            logger.info(f"Service {service_name} will not be restarted (policy: never)")
            return
        
        # Check restart count
        self.restart_counts[service_name] = self.restart_counts.get(service_name, 0) + 1
        
        if self.restart_counts[service_name] > service_config.max_restarts:
            logger.error(f"Service {service_name} exceeded max restarts ({service_config.max_restarts})")
            return
        
        # Schedule restart
        logger.info(f"Scheduling restart for {service_name} in {service_config.restart_delay} seconds...")
        self.service_states[service_name] = ServiceState.RESTARTING
        
        # Use a separate thread for delayed restart
        Thread(
            target=lambda: self._delayed_restart(service_name, service_config.restart_delay),
            daemon=True
        ).start()
    
    def _delayed_restart(self, service_name: str, delay: int):
        """Restart service after delay"""
        time.sleep(delay)
        
        if self.running:
            logger.info(f"Restarting service {service_name}...")
            asyncio.run(self._start_service(service_name))
    
    async def stop_service(self, service_name: str, timeout: Optional[int] = None):
        """Stop a single service"""
        if service_name not in self.services:
            logger.error(f"Service {service_name} not found")
            return
        
        if self.service_states[service_name] != ServiceState.RUNNING:
            logger.warning(f"Service {service_name} is not running")
            return
        
        service_config = self.services[service_name]
        timeout = timeout or service_config.shutdown_timeout
        
        logger.info(f"Stopping service: {service_name}")
        self.service_states[service_name] = ServiceState.STOPPING
        
        process = self.processes.get(service_name)
        if process:
            try:
                # Send terminate signal
                if os.name == 'nt':
                    process.terminate()
                else:
                    process.send_signal(signal.SIGTERM)
                
                # Wait for graceful shutdown
                try:
                    process.wait(timeout=timeout)
                except subprocess.TimeoutExpired:
                    logger.warning(f"Service {service_name} did not stop gracefully, forcing...")
                    process.kill()
                    process.wait()
                
                logger.info(f"Service {service_name} stopped")
                
            except Exception as e:
                logger.error(f"Error stopping service {service_name}: {str(e)}")
            finally:
                self.service_states[service_name] = ServiceState.STOPPED
                self.processes.pop(service_name, None)
    
    def stop(self):
        """Stop all services and the service manager"""
        logger.info("Stopping ServiceManager...")
        
        self.running = False
        self.stop_event.set()
        
        # Stop services in reverse priority order
        sorted_services = sorted(
            self.services.items(),
            key=lambda x: x[1].priority,
            reverse=True
        )
        
        for service_name, _ in sorted_services:
            if self.service_states[service_name] == ServiceState.RUNNING:
                asyncio.run(self.stop_service(service_name))
        
        # Wait for supervisor thread
        if self.supervisor_thread:
            self.supervisor_thread.join(timeout=5)
        
        logger.info("ServiceManager stopped")
    
    def get_status(self) -> Dict[str, ServiceStatus]:
        """Get status of all services"""
        statuses = {}
        
        for service_name, service_config in self.services.items():
            process = self.processes.get(service_name)
            
            # Get process info
            pid = None
            cpu_percent = 0.0
            memory_mb = 0.0
            
            if process and process.poll() is None:
                pid = process.pid
                try:
                    proc = psutil.Process(pid)
                    cpu_percent = proc.cpu_percent(interval=0.1)
                    memory_mb = proc.memory_info().rss / (1024 * 1024)
                except:
                    pass
            
            statuses[service_name] = ServiceStatus(
                name=service_name,
                state=self.service_states[service_name],
                pid=pid,
                start_time=self.start_times.get(service_name),
                restart_count=self.restart_counts.get(service_name, 0),
                last_health_check=getattr(self, f"_last_health_check_{service_name}", None),
                health_status=self.health_statuses.get(service_name, "unknown"),
                cpu_percent=cpu_percent,
                memory_mb=memory_mb
            )
        
        return statuses
    
    def print_status(self):
        """Print formatted status of all services"""
        statuses = self.get_status()
        
        print("\n" + "="*80)
        print("SERVICE STATUS")
        print("="*80)
        
        for service_name, status in statuses.items():
            print(f"\n{service_name}:")
            print(f"  State: {status.state.value}")
            print(f"  PID: {status.pid or 'N/A'}")
            print(f"  Health: {status.health_status}")
            print(f"  CPU: {status.cpu_percent:.1f}%")
            print(f"  Memory: {status.memory_mb:.1f} MB")
            print(f"  Restarts: {status.restart_count}")
            
            if status.start_time:
                uptime = datetime.now() - status.start_time
                print(f"  Uptime: {uptime}")
        
        print("\n" + "="*80)
    
    def save_services_config(self, filepath: str):
        """Save current service configuration to file"""
        config = {
            'services': {
                name: {
                    'command': svc.command,
                    'args': svc.args,
                    'working_dir': svc.working_dir,
                    'environment': svc.environment,
                    'dependencies': svc.dependencies,
                    'restart_policy': svc.restart_policy,
                    'restart_delay': svc.restart_delay,
                    'max_restarts': svc.max_restarts,
                    'health_check_interval': svc.health_check_interval,
                    'health_check_command': svc.health_check_command,
                    'startup_timeout': svc.startup_timeout,
                    'shutdown_timeout': svc.shutdown_timeout,
                    'log_file': svc.log_file,
                    'priority': svc.priority
                }
                for name, svc in self.services.items()
            }
        }
        
        with open(filepath, 'w') as f:
            yaml.dump(config, f, default_flow_style=False)
        
        logger.info(f"Service configuration saved to {filepath}")


# CLI interface
def main():
    """Command-line interface for service manager"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Service Manager CLI")
    parser.add_argument('command', choices=['start', 'stop', 'restart', 'status', 'save-config'])
    parser.add_argument('--config', default='services_config.yaml', help='Configuration file')
    parser.add_argument('--service', help='Specific service to operate on')
    
    args = parser.parse_args()
    
    manager = ServiceManager(args.config)
    
    if args.command == 'start':
        asyncio.run(manager.start())
        try:
            # Keep running
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            manager.stop()
            
    elif args.command == 'stop':
        if args.service:
            asyncio.run(manager.stop_service(args.service))
        else:
            manager.stop()
            
    elif args.command == 'restart':
        if args.service:
            asyncio.run(manager.stop_service(args.service))
            time.sleep(2)
            asyncio.run(manager._start_service(args.service))
        else:
            manager.stop()
            time.sleep(2)
            asyncio.run(manager.start())
            
    elif args.command == 'status':
        asyncio.run(manager.start())  # Start to get status
        manager.print_status()
        manager.stop()
        
    elif args.command == 'save-config':
        manager.save_services_config('services_config_output.yaml')


if __name__ == "__main__":
    main()
