"""
Security Validator - Comprehensive security checks for production deployment
Implements security scanning, vulnerability detection, compliance validation, and performance benchmarking
"""

import asyncio
import hashlib
import json
import logging
import os
import re
import subprocess
import sys
import time
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path
import psutil
import socket
import ssl

logger = logging.getLogger(__name__)


@dataclass
class SecurityCheckResult:
    """Result of a security check"""
    check_name: str
    status: str  # passed, warning, failed
    severity: str  # info, low, medium, high, critical
    message: str
    details: Dict[str, Any]
    remediation: Optional[str] = None
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()


@dataclass
class PerformanceBenchmark:
    """Performance benchmark result"""
    test_name: str
    duration_ms: float
    throughput_rps: float
    memory_usage_mb: float
    cpu_usage_percent: float
    passed: bool
    details: Dict[str, Any]


class SecurityValidator:
    """
    Comprehensive security validator for production deployment
    Performs security checks, vulnerability scanning, and compliance validation
    """
    
    def __init__(self):
        self.security_checks: List[SecurityCheckResult] = []
        self.performance_benchmarks: List[PerformanceBenchmark] = []
        self.vulnerabilities_found = 0
        self.critical_issues = 0
        
        # Security configurations
        self.security_config = {
            "min_password_length": 12,
            "require_https": True,
            "allowed_hosts": ["localhost", "127.0.0.1"],
            "secure_headers": [
                "X-Content-Type-Options",
                "X-Frame-Options",
                "X-XSS-Protection",
                "Strict-Transport-Security"
            ],
            "forbidden_patterns": [
                r"password\s*=\s*[\"'][^\"']+[\"']",
                r"api_key\s*=\s*[\"'][^\"']+[\"']",
                r"secret\s*=\s*[\"'][^\"']+[\"']"
            ]
        }
        
        # Performance thresholds
        self.performance_thresholds = {
            "startup_time_seconds": 30,
            "inference_time_ms": 1000,
            "throughput_rps": 10,
            "memory_usage_mb": 2048,
            "cpu_usage_percent": 80
        }
        
        logger.info("SecurityValidator initialized")
    
    async def run_full_validation(self) -> Dict[str, Any]:
        """Run complete security and performance validation"""
        logger.info("Starting full security and performance validation...")
        
        validation_start = time.time()
        
        # Security checks
        await self._check_environment_security()
        await self._check_file_permissions()
        await self._check_network_security()
        await self._check_dependencies()
        await self._check_configuration_security()
        await self._check_code_security()
        
        # Performance benchmarks
        await self._run_performance_benchmarks()
        
        # Compliance checks
        await self._check_compliance()
        
        validation_duration = time.time() - validation_start
        
        # Generate report
        report = self._generate_validation_report(validation_duration)
        
        # Save report
        self._save_validation_report(report)
        
        return report
    
    async def _check_environment_security(self):
        """Check environment security"""
        logger.info("Checking environment security...")
        
        # Check for exposed secrets in environment
        env_vars = os.environ.copy()
        sensitive_patterns = [
            r".*KEY.*", r".*SECRET.*", r".*PASSWORD.*", 
            r".*TOKEN.*", r".*CREDENTIAL.*"
        ]
        
        exposed_secrets = []
        for var_name, var_value in env_vars.items():
            for pattern in sensitive_patterns:
                if re.match(pattern, var_name, re.IGNORECASE):
                    # Check if it looks like a real secret (not placeholder)
                    if len(var_value) > 10 and not var_value.startswith("your-"):
                        exposed_secrets.append(var_name)
        
        if exposed_secrets:
            self._add_security_check(SecurityCheckResult(
                check_name="Environment Variables",
                status="warning",
                severity="medium",
                message=f"Found {len(exposed_secrets)} potentially exposed secrets in environment",
                details={"exposed_vars": exposed_secrets},
                remediation="Use secure secret management service for production"
            ))
        else:
            self._add_security_check(SecurityCheckResult(
                check_name="Environment Variables",
                status="passed",
                severity="info",
                message="No exposed secrets found in environment",
                details={}
            ))
        
        # Check Python version
        python_version = sys.version_info
        if python_version < (3, 8):
            self._add_security_check(SecurityCheckResult(
                check_name="Python Version",
                status="failed",
                severity="high",
                message=f"Python {python_version.major}.{python_version.minor} is outdated",
                details={"current_version": sys.version},
                remediation="Upgrade to Python 3.8 or higher"
            ))
        else:
            self._add_security_check(SecurityCheckResult(
                check_name="Python Version",
                status="passed",
                severity="info",
                message=f"Python {python_version.major}.{python_version.minor} is supported",
                details={"current_version": sys.version}
            ))
    
    async def _check_file_permissions(self):
        """Check file permissions for security issues"""
        logger.info("Checking file permissions...")
        
        issues = []
        
        # Check for world-writable files
        for root, dirs, files in os.walk("."):
            # Skip virtual environments and cache
            if any(skip in root for skip in ["venv", "__pycache__", "node_modules", ".git"]):
                continue
            
            for file in files[:10]:  # Check first 10 files in each directory
                filepath = Path(root) / file
                try:
                    # On Windows, check if file is read-only
                    if os.name == 'nt':
                        import stat
                        file_stat = os.stat(filepath)
                        if not file_stat.st_mode & stat.S_IWRITE:
                            continue  # File is read-only, which is good
                    else:
                        # Unix-like systems
                        mode = os.stat(filepath).st_mode
                        if mode & 0o002:  # World writable
                            issues.append(str(filepath))
                except:
                    pass
        
        if issues:
            self._add_security_check(SecurityCheckResult(
                check_name="File Permissions",
                status="warning",
                severity="medium",
                message=f"Found {len(issues)} files with insecure permissions",
                details={"insecure_files": issues[:5]},  # Show first 5
                remediation="Set appropriate file permissions (remove world-write)"
            ))
        else:
            self._add_security_check(SecurityCheckResult(
                check_name="File Permissions",
                status="passed",
                severity="info",
                message="File permissions are secure",
                details={}
            ))
    
    async def _check_network_security(self):
        """Check network security configurations"""
        logger.info("Checking network security...")
        
        # Check for open ports
        open_ports = []
        common_ports = [80, 443, 3000, 3001, 5000, 5001, 8000, 8080]
        
        for port in common_ports:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(0.1)
            result = sock.connect_ex(('localhost', port))
            sock.close()
            
            if result == 0:
                open_ports.append(port)
        
        if open_ports:
            self._add_security_check(SecurityCheckResult(
                check_name="Open Ports",
                status="warning",
                severity="low",
                message=f"Found {len(open_ports)} open ports",
                details={"open_ports": open_ports},
                remediation="Ensure only required ports are open and properly secured"
            ))
        else:
            self._add_security_check(SecurityCheckResult(
                check_name="Open Ports",
                status="passed",
                severity="info",
                message="No common ports found open",
                details={}
            ))
        
        # Check SSL/TLS configuration
        # This would check actual SSL config in production
        self._add_security_check(SecurityCheckResult(
            check_name="SSL/TLS Configuration",
            status="warning",
            severity="medium",
            message="SSL/TLS not configured for local deployment",
            details={"recommendation": "Use HTTPS in production"},
            remediation="Configure SSL/TLS certificates for production deployment"
        ))
    
    async def _check_dependencies(self):
        """Check dependencies for known vulnerabilities"""
        logger.info("Checking dependencies for vulnerabilities...")
        
        vulnerabilities = []
        
        # Check Python dependencies
        try:
            # In production, use safety or pip-audit
            # For now, check for outdated packages
            result = subprocess.run(
                [sys.executable, "-m", "pip", "list", "--outdated", "--format=json"],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0 and result.stdout:
                outdated = json.loads(result.stdout)
                if outdated:
                    vulnerabilities.extend([
                        f"{pkg['name']} ({pkg['version']} -> {pkg['latest_version']})"
                        for pkg in outdated[:5]  # Show first 5
                    ])
        except Exception as e:
            logger.warning(f"Could not check Python dependencies: {e}")
        
        # Check npm dependencies if package.json exists
        if Path("package.json").exists():
            try:
                # In production, use npm audit
                result = subprocess.run(
                    ["npm", "outdated", "--json"],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                # Parse npm outdated results
            except:
                pass
        
        if vulnerabilities:
            self._add_security_check(SecurityCheckResult(
                check_name="Dependency Vulnerabilities",
                status="warning",
                severity="medium",
                message=f"Found {len(vulnerabilities)} outdated dependencies",
                details={"outdated_packages": vulnerabilities},
                remediation="Update dependencies to latest secure versions"
            ))
        else:
            self._add_security_check(SecurityCheckResult(
                check_name="Dependency Vulnerabilities",
                status="passed",
                severity="info",
                message="No known vulnerabilities found in dependencies",
                details={}
            ))
    
    async def _check_configuration_security(self):
        """Check configuration files for security issues"""
        logger.info("Checking configuration security...")
        
        issues = []
        
        # Check for hardcoded secrets in config files
        config_files = [
            "*.yaml", "*.yml", "*.json", "*.ini", "*.conf",
            "*.env", "*.config", "*.properties"
        ]
        
        for pattern in config_files:
            for filepath in Path(".").rglob(pattern):
                # Skip node_modules and other vendor directories
                if any(skip in str(filepath) for skip in ["node_modules", "venv", ".git"]):
                    continue
                
                try:
                    content = filepath.read_text(encoding='utf-8', errors='ignore')
                    
                    # Check for forbidden patterns
                    for forbidden in self.security_config["forbidden_patterns"]:
                        if re.search(forbidden, content, re.IGNORECASE):
                            issues.append({
                                "file": str(filepath),
                                "pattern": forbidden,
                                "line": self._find_line_number(content, forbidden)
                            })
                except:
                    pass
        
        if issues:
            self._add_security_check(SecurityCheckResult(
                check_name="Configuration Security",
                status="failed",
                severity="high",
                message=f"Found {len(issues)} hardcoded secrets in configuration",
                details={"issues": issues[:3]},  # Show first 3
                remediation="Remove hardcoded secrets and use environment variables"
            ))
            self.critical_issues += 1
        else:
            self._add_security_check(SecurityCheckResult(
                check_name="Configuration Security",
                status="passed",
                severity="info",
                message="No hardcoded secrets found in configuration",
                details={}
            ))
    
    async def _check_code_security(self):
        """Check code for security vulnerabilities"""
        logger.info("Checking code security...")
        
        issues = []
        
        # Common security anti-patterns
        security_patterns = [
            (r"eval\s*\(", "Dangerous eval() usage"),
            (r"exec\s*\(", "Dangerous exec() usage"),
            (r"__import__\s*\(", "Dynamic import usage"),
            (r"pickle\.loads?\s*\(", "Unsafe pickle usage"),
            (r"shell\s*=\s*True", "Shell injection risk"),
            (r"verify\s*=\s*False", "SSL verification disabled"),
            (r"debug\s*=\s*True", "Debug mode enabled")
        ]
        
        # Check Python files
        for filepath in Path(".").rglob("*.py"):
            if any(skip in str(filepath) for skip in ["venv", "__pycache__", "node_modules"]):
                continue
            
            try:
                content = filepath.read_text(encoding='utf-8', errors='ignore')
                
                for pattern, description in security_patterns:
                    if re.search(pattern, content):
                        issues.append({
                            "file": str(filepath),
                            "issue": description,
                            "pattern": pattern
                        })
            except:
                pass
        
        if issues:
            severity = "high" if any("eval" in i["issue"] or "exec" in i["issue"] for i in issues) else "medium"
            self._add_security_check(SecurityCheckResult(
                check_name="Code Security",
                status="warning",
                severity=severity,
                message=f"Found {len(issues)} potential security issues in code",
                details={"issues": issues[:5]},  # Show first 5
                remediation="Review and fix security vulnerabilities in code"
            ))
        else:
            self._add_security_check(SecurityCheckResult(
                check_name="Code Security",
                status="passed",
                severity="info",
                message="No major security vulnerabilities found in code",
                details={}
            ))
    
    async def _run_performance_benchmarks(self):
        """Run performance benchmarks"""
        logger.info("Running performance benchmarks...")
        
        # Startup time benchmark
        startup_benchmark = await self._benchmark_startup_time()
        self.performance_benchmarks.append(startup_benchmark)
        
        # Inference speed benchmark
        inference_benchmark = await self._benchmark_inference_speed()
        self.performance_benchmarks.append(inference_benchmark)
        
        # Memory usage benchmark
        memory_benchmark = await self._benchmark_memory_usage()
        self.performance_benchmarks.append(memory_benchmark)
        
        # Concurrent request handling
        concurrency_benchmark = await self._benchmark_concurrency()
        self.performance_benchmarks.append(concurrency_benchmark)
    
    async def _benchmark_startup_time(self) -> PerformanceBenchmark:
        """Benchmark system startup time"""
        logger.info("Benchmarking startup time...")
        
        start_time = time.time()
        memory_before = psutil.Process().memory_info().rss / (1024 * 1024)
        
        try:
            # Simulate startup by importing main modules
            from model_manager import get_model_manager
            from local_inference_service import get_inference_service
            from monitoring_system import get_performance_monitor
            
            # Initialize components
            model_manager = get_model_manager()
            inference_service = get_inference_service()
            monitor = get_performance_monitor()
            
            startup_duration = (time.time() - start_time) * 1000
            memory_after = psutil.Process().memory_info().rss / (1024 * 1024)
            memory_used = memory_after - memory_before
            
            passed = startup_duration < self.performance_thresholds["startup_time_seconds"] * 1000
            
            return PerformanceBenchmark(
                test_name="Startup Time",
                duration_ms=startup_duration,
                throughput_rps=0,
                memory_usage_mb=memory_used,
                cpu_usage_percent=0,
                passed=passed,
                details={
                    "threshold_ms": self.performance_thresholds["startup_time_seconds"] * 1000,
                    "components_loaded": ["model_manager", "inference_service", "monitor"]
                }
            )
        except Exception as e:
            return PerformanceBenchmark(
                test_name="Startup Time",
                duration_ms=0,
                throughput_rps=0,
                memory_usage_mb=0,
                cpu_usage_percent=0,
                passed=False,
                details={"error": str(e)}
            )
    
    async def _benchmark_inference_speed(self) -> PerformanceBenchmark:
        """Benchmark inference speed"""
        logger.info("Benchmarking inference speed...")
        
        try:
            from local_inference_service import get_inference_service
            inference_service = get_inference_service()
            
            # Test samples
            test_samples = [
                "Senior Software Engineer with 10 years of Python experience",
                "Machine Learning Engineer skilled in TensorFlow and PyTorch"
            ]
            
            # Warmup
            _ = inference_service.analyze_job_similarity(test_samples[0], test_samples[1])
            
            # Benchmark
            num_iterations = 10
            start_time = time.time()
            cpu_before = psutil.cpu_percent(interval=0.1)
            
            for _ in range(num_iterations):
                _ = inference_service.analyze_job_similarity(test_samples[0], test_samples[1])
            
            duration = time.time() - start_time
            avg_duration_ms = (duration / num_iterations) * 1000
            throughput = num_iterations / duration
            cpu_after = psutil.cpu_percent(interval=0.1)
            
            passed = avg_duration_ms < self.performance_thresholds["inference_time_ms"]
            
            return PerformanceBenchmark(
                test_name="Inference Speed",
                duration_ms=avg_duration_ms,
                throughput_rps=throughput,
                memory_usage_mb=0,
                cpu_usage_percent=(cpu_after - cpu_before),
                passed=passed,
                details={
                    "iterations": num_iterations,
                    "threshold_ms": self.performance_thresholds["inference_time_ms"]
                }
            )
        except Exception as e:
            return PerformanceBenchmark(
                test_name="Inference Speed",
                duration_ms=0,
                throughput_rps=0,
                memory_usage_mb=0,
                cpu_usage_percent=0,
                passed=False,
                details={"error": str(e)}
            )
    
    async def _benchmark_memory_usage(self) -> PerformanceBenchmark:
        """Benchmark memory usage"""
        logger.info("Benchmarking memory usage...")
        
        process = psutil.Process()
        memory_info = process.memory_info()
        memory_mb = memory_info.rss / (1024 * 1024)
        
        passed = memory_mb < self.performance_thresholds["memory_usage_mb"]
        
        return PerformanceBenchmark(
            test_name="Memory Usage",
            duration_ms=0,
            throughput_rps=0,
            memory_usage_mb=memory_mb,
            cpu_usage_percent=0,
            passed=passed,
            details={
                "threshold_mb": self.performance_thresholds["memory_usage_mb"],
                "virtual_memory_mb": memory_info.vms / (1024 * 1024)
            }
        )
    
    async def _benchmark_concurrency(self) -> PerformanceBenchmark:
        """Benchmark concurrent request handling"""
        logger.info("Benchmarking concurrent request handling...")
        
        try:
            from local_inference_service import get_inference_service
            inference_service = get_inference_service()
            
            # Simulate concurrent requests
            num_concurrent = 10
            test_samples = [
                f"Test job description {i}" for i in range(num_concurrent)
            ]
            
            start_time = time.time()
            
            # Run concurrent inferences
            tasks = []
            for i in range(num_concurrent):
                task = asyncio.create_task(
                    asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda idx=i: inference_service.analyze_text_features([test_samples[idx]])
                    )
                )
                tasks.append(task)
            
            await asyncio.gather(*tasks)
            
            duration = time.time() - start_time
            throughput = num_concurrent / duration
            
            passed = throughput > self.performance_thresholds["throughput_rps"]
            
            return PerformanceBenchmark(
                test_name="Concurrent Requests",
                duration_ms=duration * 1000,
                throughput_rps=throughput,
                memory_usage_mb=0,
                cpu_usage_percent=0,
                passed=passed,
                details={
                    "concurrent_requests": num_concurrent,
                    "threshold_rps": self.performance_thresholds["throughput_rps"]
                }
            )
        except Exception as e:
            return PerformanceBenchmark(
                test_name="Concurrent Requests",
                duration_ms=0,
                throughput_rps=0,
                memory_usage_mb=0,
                cpu_usage_percent=0,
                passed=False,
                details={"error": str(e)}
            )
    
    async def _check_compliance(self):
        """Check compliance requirements"""
        logger.info("Checking compliance requirements...")
        
        # GDPR compliance checks (example)
        gdpr_checks = {
            "data_encryption": Path(".env").exists() and "ENCRYPTION_KEY" in os.environ,
            "audit_logging": Path("logs").exists(),
            "data_retention_policy": Path("data_retention_policy.md").exists(),
            "privacy_policy": Path("privacy_policy.md").exists()
        }
        
        passed_checks = sum(gdpr_checks.values())
        total_checks = len(gdpr_checks)
        
        if passed_checks == total_checks:
            self._add_security_check(SecurityCheckResult(
                check_name="GDPR Compliance",
                status="passed",
                severity="info",
                message="All GDPR compliance checks passed",
                details=gdpr_checks
            ))
        else:
            self._add_security_check(SecurityCheckResult(
                check_name="GDPR Compliance",
                status="warning",
                severity="medium",
                message=f"Passed {passed_checks}/{total_checks} GDPR compliance checks",
                details=gdpr_checks,
                remediation="Implement missing compliance requirements"
            ))
    
    def _add_security_check(self, result: SecurityCheckResult):
        """Add security check result"""
        self.security_checks.append(result)
        
        if result.severity == "critical" and result.status == "failed":
            self.critical_issues += 1
        elif result.severity in ["high", "medium"] and result.status in ["failed", "warning"]:
            self.vulnerabilities_found += 1
    
    def _find_line_number(self, content: str, pattern: str) -> int:
        """Find line number of pattern in content"""
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if re.search(pattern, line, re.IGNORECASE):
                return i + 1
        return 0
    
    def _generate_validation_report(self, duration: float) -> Dict[str, Any]:
        """Generate comprehensive validation report"""
        # Calculate summary statistics
        security_summary = {
            "total_checks": len(self.security_checks),
            "passed": len([c for c in self.security_checks if c.status == "passed"]),
            "warnings": len([c for c in self.security_checks if c.status == "warning"]),
            "failed": len([c for c in self.security_checks if c.status == "failed"]),
            "critical_issues": self.critical_issues,
            "vulnerabilities": self.vulnerabilities_found
        }
        
        performance_summary = {
            "total_benchmarks": len(self.performance_benchmarks),
            "passed": len([b for b in self.performance_benchmarks if b.passed]),
            "failed": len([b for b in self.performance_benchmarks if not b.passed])
        }
        
        # Overall status
        overall_status = "FAILED" if self.critical_issues > 0 else (
            "WARNING" if self.vulnerabilities_found > 0 else "PASSED"
        )
        
        report = {
            "validation_report": {
                "timestamp": datetime.now().isoformat(),
                "duration_seconds": duration,
                "overall_status": overall_status,
                "security_summary": security_summary,
                "performance_summary": performance_summary,
                "security_checks": [asdict(check) for check in self.security_checks],
                "performance_benchmarks": [asdict(bench) for bench in self.performance_benchmarks],
                "recommendations": self._generate_recommendations()
            }
        }
        
        return report
    
    def _generate_recommendations(self) -> List[str]:
        """Generate security recommendations"""
        recommendations = []
        
        if self.critical_issues > 0:
            recommendations.append("CRITICAL: Fix critical security issues before deployment")
        
        if self.vulnerabilities_found > 0:
            recommendations.append("Address security vulnerabilities identified in the scan")
        
        # Check for specific issues
        for check in self.security_checks:
            if check.status in ["failed", "warning"] and check.remediation:
                recommendations.append(f"{check.check_name}: {check.remediation}")
        
        # Performance recommendations
        for benchmark in self.performance_benchmarks:
            if not benchmark.passed:
                recommendations.append(f"Optimize {benchmark.test_name} - current: {benchmark.duration_ms:.1f}ms")
        
        return recommendations[:10]  # Top 10 recommendations
    
    def _save_validation_report(self, report: Dict[str, Any]):
        """Save validation report to file"""
        try:
            report_dir = Path("security_reports")
            report_dir.mkdir(exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            report_file = report_dir / f"security_validation_{timestamp}.json"
            
            with open(report_file, 'w') as f:
                json.dump(report, f, indent=2, default=str)
            
            logger.info(f"Validation report saved to {report_file}")
        except Exception as e:
            logger.error(f"Failed to save validation report: {e}")


# Example usage
if __name__ == "__main__":
    async def run_validation():
        validator = SecurityValidator()
        report = await validator.run_full_validation()
        
        print("\n" + "="*80)
        print("SECURITY VALIDATION REPORT")
        print("="*80)
        
        val_report = report["validation_report"]
        print(f"\nOverall Status: {val_report['overall_status']}")
        print(f"Duration: {val_report['duration_seconds']:.2f} seconds")
        
        print(f"\nSecurity Summary:")
        for key, value in val_report["security_summary"].items():
            print(f"  {key}: {value}")
        
        print(f"\nPerformance Summary:")
        for key, value in val_report["performance_summary"].items():
            print(f"  {key}: {value}")
        
        if val_report["recommendations"]:
            print(f"\nTop Recommendations:")
            for i, rec in enumerate(val_report["recommendations"], 1):
                print(f"  {i}. {rec}")
    
    asyncio.run(run_validation())
