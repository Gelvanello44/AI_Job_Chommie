"""
Enterprise-Level AI Performance Monitoring System
Provides comprehensive monitoring, analytics, and optimization recommendations
"""

import asyncio
import json
import logging
import threading
import time
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
from collections import defaultdict, deque
from dataclasses import dataclass, asdict
import psutil
import numpy as np
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetric:
    """Individual performance metric data"""
    timestamp: float
    metric_name: str
    metric_value: float
    metric_type: str  # 'gauge', 'counter', 'histogram'
    tags: Dict[str, str]
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SystemResourceMetrics:
    """System resource utilization metrics"""
    timestamp: float
    cpu_usage_percent: float
    memory_usage_percent: float
    memory_used_mb: float
    memory_available_mb: float
    disk_usage_percent: float
    disk_free_gb: float
    process_count: int
    thread_count: int
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ModelPerformanceMetrics:
    """Model-specific performance metrics"""
    model_name: str
    inference_count: int
    total_inference_time_ms: float
    avg_inference_time_ms: float
    min_inference_time_ms: float
    max_inference_time_ms: float
    cache_hit_rate: float
    memory_usage_mb: float
    batch_sizes_used: List[int]
    error_count: int
    last_used: float
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AlertRule:
    """Alert rule configuration"""
    name: str
    metric_name: str
    condition: str  # 'gt', 'lt', 'eq', 'gte', 'lte'
    threshold: float
    duration_seconds: int
    severity: str  # 'info', 'warning', 'critical'
    enabled: bool = True
    cooldown_seconds: int = 300
    
    def evaluate(self, value: float, duration_met: bool) -> bool:
        """Evaluate if alert condition is met"""
        if not self.enabled:
            return False
            
        condition_met = False
        if self.condition == 'gt':
            condition_met = value > self.threshold
        elif self.condition == 'lt':
            condition_met = value < self.threshold
        elif self.condition == 'gte':
            condition_met = value >= self.threshold
        elif self.condition == 'lte':
            condition_met = value <= self.threshold
        elif self.condition == 'eq':
            condition_met = abs(value - self.threshold) < 0.01
            
        return condition_met and duration_met


class PerformanceMonitor:
    """Comprehensive performance monitoring and analytics system"""
    
    def __init__(self, 
                 collection_interval: int = 10,
                 retention_hours: int = 24,
                 enable_alerts: bool = True,
                 storage_path: str = "./monitoring"):
        """Initialize performance monitor"""
        self.collection_interval = collection_interval
        self.retention_hours = retention_hours
        self.enable_alerts = enable_alerts
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        # Metric storage
        self.metrics: deque = deque(maxlen=int(retention_hours * 3600 / collection_interval))
        self.system_metrics: deque = deque(maxlen=int(retention_hours * 3600 / collection_interval))
        self.model_metrics: Dict[str, ModelPerformanceMetrics] = {}
        
        # Alert management
        self.alert_rules: List[AlertRule] = []
        self.active_alerts: Dict[str, datetime] = {}
        self.alert_history: deque = deque(maxlen=1000)
        
        # Monitoring state
        self.is_monitoring = False
        self.monitor_thread: Optional[threading.Thread] = None
        self.executor = ThreadPoolExecutor(max_workers=2)
        
        # Performance tracking
        self.request_counts = defaultdict(int)
        self.response_times = defaultdict(list)
        self.error_counts = defaultdict(int)
        self.cache_stats = defaultdict(dict)
        
        # Initialize default alert rules
        self._setup_default_alerts()
        
        logger.info(f"PerformanceMonitor initialized with {collection_interval}s interval")
    
    def _setup_default_alerts(self):
        """Setup default alert rules for common issues"""
        default_alerts = [
            AlertRule(
                name="High CPU Usage",
                metric_name="cpu_usage_percent",
                condition="gt",
                threshold=85.0,
                duration_seconds=60,
                severity="warning"
            ),
            AlertRule(
                name="High Memory Usage",
                metric_name="memory_usage_percent", 
                condition="gt",
                threshold=90.0,
                duration_seconds=30,
                severity="critical"
            ),
            AlertRule(
                name="Slow Inference",
                metric_name="avg_inference_time_ms",
                condition="gt",
                threshold=2000.0,  # 2 seconds
                duration_seconds=120,
                severity="warning"
            ),
            AlertRule(
                name="High Error Rate",
                metric_name="error_rate",
                condition="gt",
                threshold=0.05,  # 5%
                duration_seconds=60,
                severity="critical"
            ),
            AlertRule(
                name="Low Cache Hit Rate",
                metric_name="cache_hit_rate",
                condition="lt",
                threshold=0.7,  # 70%
                duration_seconds=300,
                severity="info"
            )
        ]
        
        self.alert_rules.extend(default_alerts)
    
    def start_monitoring(self):
        """Start the monitoring system"""
        if self.is_monitoring:
            logger.warning("Monitoring already running")
            return
            
        self.is_monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self.monitor_thread.start()
        
        logger.info("Performance monitoring started")
    
    def stop_monitoring(self):
        """Stop the monitoring system"""
        self.is_monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        
        logger.info("Performance monitoring stopped")
    
    def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.is_monitoring:
            try:
                # Collect system metrics
                self._collect_system_metrics()
                
                # Collect model metrics
                self._collect_model_metrics()
                
                # Check alerts
                if self.enable_alerts:
                    self._check_alerts()
                
                # Persist metrics
                self._persist_metrics()
                
                # Sleep until next collection
                time.sleep(self.collection_interval)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {str(e)}")
                time.sleep(self.collection_interval)
    
    def _collect_system_metrics(self):
        """Collect system resource metrics"""
        try:
            # CPU and memory
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # Process information
            process = psutil.Process()
            process_info = process.as_dict(['num_threads'])
            
            metrics = SystemResourceMetrics(
                timestamp=time.time(),
                cpu_usage_percent=cpu_percent,
                memory_usage_percent=memory.percent,
                memory_used_mb=memory.used / (1024**2),
                memory_available_mb=memory.available / (1024**2),
                disk_usage_percent=disk.percent,
                disk_free_gb=disk.free / (1024**3),
                process_count=len(psutil.pids()),
                thread_count=process_info['num_threads']
            )
            
            self.system_metrics.append(metrics)
            
            # Add individual metrics for alerting
            timestamp = time.time()
            self.metrics.append(PerformanceMetric(
                timestamp=timestamp,
                metric_name="cpu_usage_percent",
                metric_value=cpu_percent,
                metric_type="gauge",
                tags={"source": "system"}
            ))
            
            self.metrics.append(PerformanceMetric(
                timestamp=timestamp,
                metric_name="memory_usage_percent",
                metric_value=memory.percent,
                metric_type="gauge",
                tags={"source": "system"}
            ))
            
        except Exception as e:
            logger.error(f"Error collecting system metrics: {str(e)}")
    
    def _collect_model_metrics(self):
        """Collect model-specific performance metrics"""
        try:
            # Get metrics from model manager if available
            from model_manager import get_model_manager
            
            model_manager = get_model_manager()
            performance_stats = model_manager.get_performance_stats()
            
            timestamp = time.time()
            
            for model_name, stats in performance_stats.items():
                # Update or create model metrics
                if model_name not in self.model_metrics:
                    self.model_metrics[model_name] = ModelPerformanceMetrics(
                        model_name=model_name,
                        inference_count=0,
                        total_inference_time_ms=0,
                        avg_inference_time_ms=0,
                        min_inference_time_ms=float('inf'),
                        max_inference_time_ms=0,
                        cache_hit_rate=0,
                        memory_usage_mb=0,
                        batch_sizes_used=[],
                        error_count=0,
                        last_used=timestamp
                    )
                
                model_metrics = self.model_metrics[model_name]
                
                # Update metrics
                model_metrics.inference_count = stats.get('inference_count', 0)
                model_metrics.avg_inference_time_ms = stats.get('avg_inference_time', 0) * 1000
                model_metrics.last_used = timestamp
                
                # Add metric for alerting
                self.metrics.append(PerformanceMetric(
                    timestamp=timestamp,
                    metric_name="avg_inference_time_ms",
                    metric_value=model_metrics.avg_inference_time_ms,
                    metric_type="gauge",
                    tags={"model": model_name}
                ))
                
        except Exception as e:
            logger.error(f"Error collecting model metrics: {str(e)}")
    
    def _check_alerts(self):
        """Check alert rules and trigger alerts"""
        current_time = datetime.now()
        
        for alert_rule in self.alert_rules:
            try:
                # Get recent metrics for this rule
                recent_metrics = [
                    m for m in self.metrics
                    if m.metric_name == alert_rule.metric_name
                    and time.time() - m.timestamp <= alert_rule.duration_seconds
                ]
                
                if not recent_metrics:
                    continue
                
                # Check if condition is met for the duration
                latest_value = recent_metrics[-1].metric_value
                duration_start = time.time() - alert_rule.duration_seconds
                
                violations = [
                    m for m in recent_metrics
                    if m.timestamp >= duration_start and alert_rule.evaluate(m.metric_value, True)
                ]
                
                duration_met = len(violations) >= len(recent_metrics) * 0.8  # 80% of samples
                
                if alert_rule.evaluate(latest_value, duration_met):
                    self._trigger_alert(alert_rule, latest_value, current_time)
                else:
                    # Clear alert if it was active
                    if alert_rule.name in self.active_alerts:
                        self._clear_alert(alert_rule, current_time)
                        
            except Exception as e:
                logger.error(f"Error checking alert rule {alert_rule.name}: {str(e)}")
    
    def _trigger_alert(self, rule: AlertRule, value: float, timestamp: datetime):
        """Trigger an alert"""
        # Check cooldown
        if rule.name in self.active_alerts:
            last_alert = self.active_alerts[rule.name]
            if (timestamp - last_alert).seconds < rule.cooldown_seconds:
                return
        
        # Record alert
        self.active_alerts[rule.name] = timestamp
        
        alert_data = {
            "rule_name": rule.name,
            "metric_name": rule.metric_name,
            "current_value": value,
            "threshold": rule.threshold,
            "severity": rule.severity,
            "timestamp": timestamp.isoformat(),
            "message": f"{rule.name}: {rule.metric_name} = {value:.2f} (threshold: {rule.threshold})"
        }
        
        self.alert_history.append(alert_data)
        
        # Log alert
        log_level = logging.ERROR if rule.severity == 'critical' else logging.WARNING
        logger.log(log_level, f"ALERT: {alert_data['message']}")
        
        # Could add webhook/email notifications here
        self._handle_alert_notification(alert_data)
    
    def _clear_alert(self, rule: AlertRule, timestamp: datetime):
        """Clear an active alert"""
        if rule.name in self.active_alerts:
            del self.active_alerts[rule.name]
            
            logger.info(f"ALERT CLEARED: {rule.name}")
    
    def _handle_alert_notification(self, alert_data: Dict[str, Any]):
        """Handle alert notifications (webhook, email, etc.)"""
        # Implement notification logic here
        # For now, just log to a file
        try:
            alert_file = self.storage_path / "alerts.jsonl"
            with open(alert_file, 'a') as f:
                f.write(json.dumps(alert_data) + '\n')
        except Exception as e:
            logger.error(f"Error writing alert notification: {str(e)}")
    
    def _persist_metrics(self):
        """Persist metrics to disk"""
        try:
            timestamp = datetime.now()
            daily_file = self.storage_path / f"metrics_{timestamp.strftime('%Y%m%d')}.jsonl"
            
            # Write recent metrics
            recent_metrics = [m for m in self.metrics if time.time() - m.timestamp <= 3600]  # Last hour
            
            with open(daily_file, 'a') as f:
                for metric in recent_metrics:
                    f.write(json.dumps(metric.to_dict()) + '\n')
                    
        except Exception as e:
            logger.error(f"Error persisting metrics: {str(e)}")
    
    def record_inference(self, model_name: str, inference_time_ms: float, 
                        batch_size: int = 1, success: bool = True):
        """Record an inference event"""
        timestamp = time.time()
        
        # Update request counts
        self.request_counts[model_name] += 1
        
        # Track response times
        if len(self.response_times[model_name]) > 1000:
            self.response_times[model_name] = self.response_times[model_name][-500:]
        self.response_times[model_name].append(inference_time_ms)
        
        # Track errors
        if not success:
            self.error_counts[model_name] += 1
        
        # Add metric
        self.metrics.append(PerformanceMetric(
            timestamp=timestamp,
            metric_name="inference_time_ms",
            metric_value=inference_time_ms,
            metric_type="histogram",
            tags={"model": model_name, "batch_size": str(batch_size)}
        ))
        
        self.metrics.append(PerformanceMetric(
            timestamp=timestamp,
            metric_name="inference_count",
            metric_value=1,
            metric_type="counter",
            tags={"model": model_name, "success": str(success)}
        ))
    
    def record_cache_hit(self, model_name: str, hit: bool):
        """Record a cache hit/miss event"""
        if model_name not in self.cache_stats:
            self.cache_stats[model_name] = {"hits": 0, "misses": 0}
        
        if hit:
            self.cache_stats[model_name]["hits"] += 1
        else:
            self.cache_stats[model_name]["misses"] += 1
        
        # Calculate hit rate
        stats = self.cache_stats[model_name]
        total = stats["hits"] + stats["misses"]
        hit_rate = stats["hits"] / total if total > 0 else 0
        
        self.metrics.append(PerformanceMetric(
            timestamp=time.time(),
            metric_name="cache_hit_rate",
            metric_value=hit_rate,
            metric_type="gauge",
            tags={"model": model_name}
        ))
    
    def get_performance_summary(self, hours: int = 1) -> Dict[str, Any]:
        """Get performance summary for the last N hours"""
        cutoff_time = time.time() - (hours * 3600)
        
        # Filter recent metrics
        recent_metrics = [m for m in self.metrics if m.timestamp >= cutoff_time]
        recent_system = [m for m in self.system_metrics if m.timestamp >= cutoff_time]
        
        summary = {
            "time_period_hours": hours,
            "system_performance": {},
            "model_performance": {},
            "alerts": {
                "active_alerts": len(self.active_alerts),
                "total_alerts": len(self.alert_history)
            },
            "recommendations": []
        }
        
        # System performance summary
        if recent_system:
            cpu_values = [m.cpu_usage_percent for m in recent_system]
            memory_values = [m.memory_usage_percent for m in recent_system]
            
            summary["system_performance"] = {
                "avg_cpu_usage": np.mean(cpu_values),
                "max_cpu_usage": np.max(cpu_values),
                "avg_memory_usage": np.mean(memory_values),
                "max_memory_usage": np.max(memory_values),
                "current_memory_mb": recent_system[-1].memory_used_mb
            }
        
        # Model performance summary
        model_groups = defaultdict(list)
        for metric in recent_metrics:
            if "model" in metric.tags:
                model_name = metric.tags["model"]
                model_groups[model_name].append(metric)
        
        for model_name, metrics in model_groups.items():
            inference_times = [m.metric_value for m in metrics if m.metric_name == "inference_time_ms"]
            
            if inference_times:
                summary["model_performance"][model_name] = {
                    "avg_inference_time_ms": np.mean(inference_times),
                    "min_inference_time_ms": np.min(inference_times),
                    "max_inference_time_ms": np.max(inference_times),
                    "total_inferences": len(inference_times),
                    "requests_per_hour": len(inference_times) / hours
                }
        
        # Add recommendations
        summary["recommendations"] = self._generate_recommendations(summary)
        
        return summary
    
    def _generate_recommendations(self, summary: Dict[str, Any]) -> List[str]:
        """Generate performance optimization recommendations"""
        recommendations = []
        
        # CPU recommendations
        system_perf = summary.get("system_performance", {})
        if system_perf.get("avg_cpu_usage", 0) > 70:
            recommendations.append("Consider reducing concurrent requests - CPU usage is high")
        elif system_perf.get("avg_cpu_usage", 0) < 30:
            recommendations.append("CPU usage is low - you can increase concurrent processing")
        
        # Memory recommendations  
        if system_perf.get("avg_memory_usage", 0) > 80:
            recommendations.append("Memory usage is high - consider reducing cache sizes")
        elif system_perf.get("avg_memory_usage", 0) < 50:
            recommendations.append("Memory usage is low - you can increase cache sizes for better performance")
        
        # Model performance recommendations
        model_perf = summary.get("model_performance", {})
        for model_name, perf in model_perf.items():
            avg_time = perf.get("avg_inference_time_ms", 0)
            if avg_time > 1000:
                recommendations.append(f"Model {model_name} is slow - consider increasing batch sizes")
            elif avg_time < 50:
                recommendations.append(f"Model {model_name} is very fast - you can increase workload")
        
        # Cache recommendations
        for model_name in model_perf.keys():
            if model_name in self.cache_stats:
                stats = self.cache_stats[model_name]
                total = stats["hits"] + stats["misses"]
                hit_rate = stats["hits"] / total if total > 0 else 0
                
                if hit_rate < 0.5:
                    recommendations.append(f"Low cache hit rate for {model_name} - consider increasing cache size")
        
        return recommendations
    
    def create_dashboard_data(self) -> Dict[str, Any]:
        """Create data for performance dashboard"""
        summary = self.get_performance_summary(hours=4)
        
        # Get time series data for charts
        cutoff_time = time.time() - (4 * 3600)  # Last 4 hours
        recent_metrics = [m for m in self.metrics if m.timestamp >= cutoff_time]
        recent_system = [m for m in self.system_metrics if m.timestamp >= cutoff_time]
        
        # CPU/Memory time series
        cpu_series = [(m.timestamp, m.cpu_usage_percent) for m in recent_system]
        memory_series = [(m.timestamp, m.memory_usage_percent) for m in recent_system]
        
        # Inference time series by model
        inference_series = defaultdict(list)
        for metric in recent_metrics:
            if metric.metric_name == "inference_time_ms" and "model" in metric.tags:
                model_name = metric.tags["model"]
                inference_series[model_name].append((metric.timestamp, metric.metric_value))
        
        dashboard = {
            "summary": summary,
            "time_series": {
                "cpu_usage": cpu_series,
                "memory_usage": memory_series,
                "inference_times": dict(inference_series)
            },
            "active_alerts": [
                {"name": name, "since": timestamp.isoformat()}
                for name, timestamp in self.active_alerts.items()
            ],
            "recent_alerts": list(self.alert_history)[-10:],  # Last 10 alerts
            "model_stats": {
                name: metrics.to_dict() 
                for name, metrics in self.model_metrics.items()
            }
        }
        
        return dashboard
    
    def export_metrics(self, hours: int = 24, format: str = "json") -> str:
        """Export metrics in specified format"""
        cutoff_time = time.time() - (hours * 3600)
        recent_metrics = [m for m in self.metrics if m.timestamp >= cutoff_time]
        recent_system = [m for m in self.system_metrics if m.timestamp >= cutoff_time]
        
        data = {
            "export_time": datetime.now().isoformat(),
            "time_period_hours": hours,
            "metrics": [m.to_dict() for m in recent_metrics],
            "system_metrics": [m.to_dict() for m in recent_system],
            "model_metrics": {k: v.to_dict() for k, v in self.model_metrics.items()},
            "alert_history": list(self.alert_history)
        }
        
        if format.lower() == "json":
            return json.dumps(data, indent=2)
        else:
            raise ValueError(f"Unsupported export format: {format}")


# Global monitoring instance
_monitor_instance = None


def get_performance_monitor() -> PerformanceMonitor:
    """Get or create singleton performance monitor"""
    global _monitor_instance
    if _monitor_instance is None:
        _monitor_instance = PerformanceMonitor()
    return _monitor_instance


def start_monitoring():
    """Start global performance monitoring"""
    monitor = get_performance_monitor()
    monitor.start_monitoring()
    return monitor


def stop_monitoring():
    """Stop global performance monitoring"""
    monitor = get_performance_monitor()
    monitor.stop_monitoring()


# Auto-start monitoring if enabled
if os.getenv('AUTO_START_MONITORING', 'true').lower() == 'true':
    start_monitoring()
    logger.info("Auto-started performance monitoring")
