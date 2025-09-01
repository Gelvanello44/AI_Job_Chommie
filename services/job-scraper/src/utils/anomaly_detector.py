"""
Anomaly detection utility for identifying unusual patterns in scraping behavior.
"""

import asyncio
import statistics
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
import numpy as np
from loguru import logger


@dataclass
class Anomaly:
    """Detected anomaly information."""
    type: str
    severity: str  # low, medium, high, critical
    message: str
    detected_at: datetime
    metrics: Dict[str, Any]
    suggested_actions: List[str]


class AnomalyDetector:
    """ML-powered anomaly detection for scraping operations."""
    
    def __init__(self):
        self.metric_history: Dict[str, List[float]] = {}
        self.baselines: Dict[str, Dict[str, float]] = {}
        self.detection_windows = {
            "success_rate": 50,  # Last 50 measurements
            "response_time": 100,  # Last 100 measurements
            "jobs_per_task": 30,  # Last 30 measurements
            "error_rate": 50   # Last 50 measurements
        }
        
        # Anomaly thresholds (z-score based)
        self.thresholds = {
            "low": 1.5,      # 1.5 standard deviations
            "medium": 2.0,   # 2.0 standard deviations  
            "high": 2.5,     # 2.5 standard deviations
            "critical": 3.0  # 3.0 standard deviations
        }
        
        # Minimum samples required for detection
        self.min_samples = 10
    
    async def detect(self, current_metrics: Dict[str, float]) -> List[Anomaly]:
        """Detect anomalies in current metrics."""
        anomalies = []
        
        for metric_name, value in current_metrics.items():
            if metric_name in self.detection_windows:
                anomaly = await self._check_metric_anomaly(metric_name, value)
                if anomaly:
                    anomalies.append(anomaly)
        
        # Update baselines with new data
        await self._update_baselines(current_metrics)
        
        return anomalies
    
    async def _check_metric_anomaly(self, metric_name: str, value: float) -> Optional[Anomaly]:
        """Check if a metric value is anomalous."""
        # Initialize history if not exists
        if metric_name not in self.metric_history:
            self.metric_history[metric_name] = []
        
        history = self.metric_history[metric_name]
        
        # Add current value to history
        history.append(value)
        
        # Maintain sliding window
        window_size = self.detection_windows[metric_name]
        if len(history) > window_size:
            history.pop(0)
        
        # Need minimum samples for detection
        if len(history) < self.min_samples:
            return None
        
        # Calculate z-score
        mean = statistics.mean(history[:-1])  # Exclude current value
        if len(history) < 2:
            return None
            
        stdev = statistics.stdev(history[:-1]) if len(history) > 2 else 0
        
        if stdev == 0:
            return None  # No variance, can't detect anomalies
        
        z_score = abs(value - mean) / stdev
        
        # Determine anomaly severity
        severity = None
        if z_score >= self.thresholds["critical"]:
            severity = "critical"
        elif z_score >= self.thresholds["high"]:
            severity = "high"
        elif z_score >= self.thresholds["medium"]:
            severity = "medium"
        elif z_score >= self.thresholds["low"]:
            severity = "low"
        
        if severity:
            return self._create_anomaly(metric_name, value, mean, z_score, severity)
        
        return None
    
    def _create_anomaly(
        self, 
        metric_name: str, 
        value: float, 
        baseline: float, 
        z_score: float, 
        severity: str
    ) -> Anomaly:
        """Create anomaly object with contextual information."""
        
        # Generate appropriate message
        if value > baseline:
            direction = "increased"
            comparison = "above"
        else:
            direction = "decreased"
            comparison = "below"
        
        message = f"{metric_name} has {direction} significantly: {value:.3f} ({comparison} baseline {baseline:.3f}, z-score: {z_score:.2f})"
        
        # Generate suggested actions based on metric and severity
        suggested_actions = self._get_suggested_actions(metric_name, value, baseline, severity)
        
        return Anomaly(
            type=metric_name,
            severity=severity,
            message=message,
            detected_at=datetime.utcnow(),
            metrics={
                "current_value": value,
                "baseline": baseline,
                "z_score": z_score,
                "threshold": self.thresholds[severity]
            },
            suggested_actions=suggested_actions
        )
    
    def _get_suggested_actions(
        self, 
        metric_name: str, 
        value: float, 
        baseline: float, 
        severity: str
    ) -> List[str]:
        """Generate suggested actions based on anomaly."""
        actions = []
        
        if metric_name == "success_rate":
            if value < baseline:  # Success rate dropped
                actions = [
                    "Check proxy rotation and IP health",
                    "Verify target website changes",
                    "Review rate limiting settings",
                    "Check for blocking or CAPTCHA issues"
                ]
                if severity in ["high", "critical"]:
                    actions.extend([
                        "Enable backup scraping methods",
                        "Switch to SerpAPI fallback",
                        "Alert operations team"
                    ])
        
        elif metric_name == "response_time":
            if value > baseline:  # Response time increased
                actions = [
                    "Check network connectivity",
                    "Review concurrent scraper limits",
                    "Monitor target website performance",
                    "Consider load balancing"
                ]
                if severity in ["high", "critical"]:
                    actions.extend([
                        "Reduce concurrent requests",
                        "Scale up infrastructure",
                        "Implement request queuing"
                    ])
        
        elif metric_name == "jobs_per_task":
            if value < baseline:  # Fewer jobs extracted
                actions = [
                    "Check website layout changes",
                    "Update CSS selectors",
                    "Verify search parameters",
                    "Review filtering logic"
                ]
                if severity in ["high", "critical"]:
                    actions.extend([
                        "Manual investigation required",
                        "Consider alternative data sources"
                    ])
        
        elif metric_name == "error_rate":
            if value > baseline:  # Error rate increased
                actions = [
                    "Review error logs for patterns",
                    "Check dependency health",
                    "Verify configuration settings",
                    "Test connectivity to external services"
                ]
                if severity in ["high", "critical"]:
                    actions.extend([
                        "Enable circuit breakers",
                        "Activate fallback systems",
                        "Immediate incident response"
                    ])
        
        return actions
    
    async def _update_baselines(self, metrics: Dict[str, float]):
        """Update baseline calculations with new metrics."""
        for metric_name, value in metrics.items():
            if metric_name in self.metric_history:
                history = self.metric_history[metric_name]
                
                if len(history) >= self.min_samples:
                    self.baselines[metric_name] = {
                        "mean": statistics.mean(history),
                        "median": statistics.median(history),
                        "stdev": statistics.stdev(history) if len(history) > 1 else 0,
                        "min": min(history),
                        "max": max(history),
                        "samples": len(history),
                        "updated_at": datetime.utcnow().isoformat()
                    }
    
    def get_baselines(self) -> Dict[str, Dict[str, float]]:
        """Get current baseline statistics."""
        return self.baselines.copy()
    
    def get_metric_history(self, metric_name: str) -> List[float]:
        """Get history for a specific metric."""
        return self.metric_history.get(metric_name, []).copy()
    
    async def reset_metric_history(self, metric_name: Optional[str] = None):
        """Reset metric history for specific metric or all metrics."""
        if metric_name:
            self.metric_history[metric_name] = []
            if metric_name in self.baselines:
                del self.baselines[metric_name]
        else:
            self.metric_history.clear()
            self.baselines.clear()
        
        logger.info(f"Reset metric history: {metric_name or 'all metrics'}")
    
    def calculate_trend(self, metric_name: str, window_size: int = 20) -> Dict[str, Any]:
        """Calculate trend for a specific metric."""
        if metric_name not in self.metric_history:
            return {"trend": "unknown", "confidence": 0}
        
        history = self.metric_history[metric_name]
        if len(history) < window_size:
            return {"trend": "insufficient_data", "confidence": 0}
        
        recent_data = history[-window_size:]
        
        # Calculate linear trend using least squares
        x = np.arange(len(recent_data))
        y = np.array(recent_data)
        
        # Linear regression
        n = len(x)
        slope = (n * np.sum(x * y) - np.sum(x) * np.sum(y)) / (n * np.sum(x**2) - (np.sum(x))**2)
        
        # Determine trend direction
        if abs(slope) < 0.01:  # Threshold for "stable"
            trend = "stable"
        elif slope > 0:
            trend = "increasing"
        else:
            trend = "decreasing"
        
        # Calculate confidence (R²)
        y_mean = np.mean(y)
        ss_res = np.sum((y - (slope * x + np.mean(y) - slope * np.mean(x)))**2)
        ss_tot = np.sum((y - y_mean)**2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
        
        return {
            "trend": trend,
            "slope": slope,
            "confidence": max(0, min(1, r_squared)),
            "data_points": len(recent_data),
            "calculated_at": datetime.utcnow().isoformat()
        }
