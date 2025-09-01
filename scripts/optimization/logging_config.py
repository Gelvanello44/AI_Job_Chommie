"""
Comprehensive Logging Configuration - Production-grade logging with monitoring integration
Implements structured logging, log aggregation, metrics collection, and alerting
"""

import json
import logging
import logging.handlers
import os
import sys
import time
import traceback
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
import threading
from queue import Queue
import gzip
import shutil

# Try to import optional dependencies
try:
    import pythonjsonlogger.jsonlogger as jsonlogger
    HAS_JSON_LOGGER = True
except ImportError:
    HAS_JSON_LOGGER = False
    
try:
    from prometheus_client import Counter, Histogram, Gauge
    HAS_PROMETHEUS = True
except ImportError:
    HAS_PROMETHEUS = False


class StructuredFormatter(logging.Formatter):
    """Custom structured formatter for production logging"""
    
    def __init__(self, service_name: str = "ai-job-chommie", include_host: bool = True):
        super().__init__()
        self.service_name = service_name
        self.include_host = include_host
        self.hostname = os.environ.get('HOSTNAME', 'localhost')
        
    def format(self, record: logging.LogRecord) -> str:
        # Create structured log entry
        log_data = {
            '@timestamp': datetime.utcnow().isoformat() + 'Z',
            'service': self.service_name,
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
            'thread': record.thread,
            'thread_name': record.threadName,
            'process': record.process,
            'process_name': record.processName,
        }
        
        if self.include_host:
            log_data['host'] = self.hostname
            
        # Add extra fields
        if hasattr(record, 'user_id'):
            log_data['user_id'] = record.user_id
        if hasattr(record, 'request_id'):
            log_data['request_id'] = record.request_id
        if hasattr(record, 'duration_ms'):
            log_data['duration_ms'] = record.duration_ms
        if hasattr(record, 'status_code'):
            log_data['status_code'] = record.status_code
            
        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = {
                'type': record.exc_info[0].__name__,
                'message': str(record.exc_info[1]),
                'traceback': traceback.format_exception(*record.exc_info)
            }
            
        return json.dumps(log_data)


class MetricsHandler(logging.Handler):
    """Log handler that exports metrics to monitoring system"""
    
    def __init__(self):
        super().__init__()
        
        if HAS_PROMETHEUS:
            # Define Prometheus metrics
            self.log_counter = Counter(
                'log_messages_total',
                'Total number of log messages',
                ['level', 'logger']
            )
            self.error_counter = Counter(
                'log_errors_total',
                'Total number of error messages',
                ['logger', 'exception_type']
            )
            
    def emit(self, record: logging.LogRecord):
        """Emit log record to metrics"""
        try:
            if HAS_PROMETHEUS:
                # Count log messages
                self.log_counter.labels(
                    level=record.levelname,
                    logger=record.name
                ).inc()
                
                # Count errors with exception info
                if record.levelname in ['ERROR', 'CRITICAL'] and record.exc_info:
                    self.error_counter.labels(
                        logger=record.name,
                        exception_type=record.exc_info[0].__name__
                    ).inc()
                    
        except Exception:
            pass  # Don't let metrics break logging


class AsyncFileHandler(logging.handlers.RotatingFileHandler):
    """Asynchronous file handler for better performance"""
    
    def __init__(self, filename, mode='a', maxBytes=0, backupCount=0, 
                 encoding=None, delay=False, queue_size=1000):
        super().__init__(filename, mode, maxBytes, backupCount, encoding, delay)
        self.queue = Queue(maxsize=queue_size)
        self.thread = threading.Thread(target=self._writer_thread, daemon=True)
        self.thread.start()
        self._shutdown = False
        
    def emit(self, record):
        """Queue the record for async writing"""
        if not self._shutdown:
            try:
                self.queue.put_nowait(record)
            except:
                # Queue full, fall back to sync write
                super().emit(record)
                
    def _writer_thread(self):
        """Writer thread that processes queued log records"""
        while not self._shutdown:
            try:
                record = self.queue.get(timeout=1)
                if record:
                    super().emit(record)
            except:
                continue
                
    def close(self):
        """Shutdown the async writer"""
        self._shutdown = True
        if self.thread.is_alive():
            self.thread.join(timeout=5)
        super().close()


class CompressedRotatingFileHandler(logging.handlers.RotatingFileHandler):
    """File handler that compresses rotated logs"""
    
    def doRollover(self):
        """Override to compress old logs"""
        super().doRollover()
        
        # Compress the rotated file
        if self.backupCount > 0:
            for i in range(self.backupCount - 1, 0, -1):
                sfn = self.rotation_filename("%s.%d.gz" % (self.baseFilename, i))
                dfn = self.rotation_filename("%s.%d.gz" % (self.baseFilename, i + 1))
                if os.path.exists(sfn):
                    if os.path.exists(dfn):
                        os.remove(dfn)
                    os.rename(sfn, dfn)
                    
            dfn = self.rotation_filename(self.baseFilename + ".1")
            if os.path.exists(dfn):
                with open(dfn, 'rb') as f_in:
                    with gzip.open(dfn + '.gz', 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                os.remove(dfn)


class LogAggregator:
    """Aggregates logs for batch processing and forwarding"""
    
    def __init__(self, batch_size: int = 100, flush_interval: float = 5.0):
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.buffer: List[Dict[str, Any]] = []
        self.lock = threading.Lock()
        self.last_flush = time.time()
        self.flush_thread = threading.Thread(target=self._flush_periodically, daemon=True)
        self.flush_thread.start()
        
    def add_log(self, log_entry: Dict[str, Any]):
        """Add log entry to buffer"""
        with self.lock:
            self.buffer.append(log_entry)
            if len(self.buffer) >= self.batch_size:
                self._flush()
                
    def _flush(self):
        """Flush buffered logs"""
        if not self.buffer:
            return
            
        logs_to_send = self.buffer.copy()
        self.buffer.clear()
        
        # In production, send to log aggregation service
        # For now, just count them
        if HAS_PROMETHEUS:
            from prometheus_client import Counter
            log_batch_counter = Counter('log_batches_sent', 'Number of log batches sent')
            log_batch_counter.inc()
            
    def _flush_periodically(self):
        """Periodic flush thread"""
        while True:
            time.sleep(self.flush_interval)
            if time.time() - self.last_flush > self.flush_interval:
                with self.lock:
                    self._flush()
                    self.last_flush = time.time()


def setup_logging(
    service_name: str = "ai-job-chommie",
    log_level: str = "INFO",
    log_dir: str = "logs",
    enable_console: bool = True,
    enable_file: bool = True,
    enable_metrics: bool = True,
    enable_async: bool = True,
    enable_compression: bool = True,
    max_bytes: int = 104857600,  # 100MB
    backup_count: int = 10,
    format_type: str = "json"  # json or text
) -> Dict[str, logging.Logger]:
    """
    Setup comprehensive logging configuration
    
    Returns dict of configured loggers
    """
    # Create log directory
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # Create formatters
    if format_type == "json" and HAS_JSON_LOGGER:
        json_formatter = jsonlogger.JsonFormatter(
            fmt='%(asctime)s %(name)s %(levelname)s %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        formatter = json_formatter
    else:
        formatter = StructuredFormatter(service_name)
    
    # Console handler
    if enable_console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        console_handler.setLevel(logging.INFO)
        root_logger.addHandler(console_handler)
    
    # File handlers
    if enable_file:
        # Main application log
        if enable_async:
            app_handler = AsyncFileHandler(
                filename=log_path / "app.log",
                maxBytes=max_bytes,
                backupCount=backup_count
            )
        elif enable_compression:
            app_handler = CompressedRotatingFileHandler(
                filename=log_path / "app.log",
                maxBytes=max_bytes,
                backupCount=backup_count
            )
        else:
            app_handler = logging.handlers.RotatingFileHandler(
                filename=log_path / "app.log",
                maxBytes=max_bytes,
                backupCount=backup_count
            )
        
        app_handler.setFormatter(formatter)
        app_handler.setLevel(logging.DEBUG)
        root_logger.addHandler(app_handler)
        
        # Error log
        error_handler = logging.handlers.RotatingFileHandler(
            filename=log_path / "error.log",
            maxBytes=max_bytes // 2,
            backupCount=backup_count // 2
        )
        error_handler.setFormatter(formatter)
        error_handler.setLevel(logging.ERROR)
        root_logger.addHandler(error_handler)
        
        # Access log for API requests
        access_logger = logging.getLogger('access')
        access_handler = logging.handlers.RotatingFileHandler(
            filename=log_path / "access.log",
            maxBytes=max_bytes,
            backupCount=backup_count
        )
        access_handler.setFormatter(formatter)
        access_logger.addHandler(access_handler)
        access_logger.setLevel(logging.INFO)
        access_logger.propagate = False
        
        # Security log
        security_logger = logging.getLogger('security')
        security_handler = logging.handlers.RotatingFileHandler(
            filename=log_path / "security.log",
            maxBytes=max_bytes // 2,
            backupCount=backup_count
        )
        security_handler.setFormatter(formatter)
        security_logger.addHandler(security_handler)
        security_logger.setLevel(logging.WARNING)
        security_logger.propagate = False
        
        # Performance log
        performance_logger = logging.getLogger('performance')
        perf_handler = logging.handlers.RotatingFileHandler(
            filename=log_path / "performance.log",
            maxBytes=max_bytes,
            backupCount=backup_count // 2
        )
        perf_handler.setFormatter(formatter)
        performance_logger.addHandler(perf_handler)
        performance_logger.setLevel(logging.INFO)
        performance_logger.propagate = False
    
    # Metrics handler
    if enable_metrics and HAS_PROMETHEUS:
        metrics_handler = MetricsHandler()
        metrics_handler.setLevel(logging.INFO)
        root_logger.addHandler(metrics_handler)
    
    # Configure specific loggers
    loggers = {
        'root': root_logger,
        'access': logging.getLogger('access'),
        'security': logging.getLogger('security'),
        'performance': logging.getLogger('performance'),
        'model': logging.getLogger('model'),
        'api': logging.getLogger('api'),
        'database': logging.getLogger('database'),
        'cache': logging.getLogger('cache')
    }
    
    # Set levels for specific loggers
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('requests').setLevel(logging.WARNING)
    logging.getLogger('transformers').setLevel(logging.WARNING)
    
    # Log startup message
    root_logger.info(
        "Logging system initialized",
        extra={
            'service': service_name,
            'log_level': log_level,
            'handlers': [h.__class__.__name__ for h in root_logger.handlers]
        }
    )
    
    return loggers


def log_request(logger: logging.Logger, request_data: Dict[str, Any]):
    """Log API request with structured data"""
    logger.info(
        "API Request",
        extra={
            'request_id': request_data.get('request_id'),
            'method': request_data.get('method'),
            'path': request_data.get('path'),
            'user_id': request_data.get('user_id'),
            'ip_address': request_data.get('ip_address'),
            'user_agent': request_data.get('user_agent')
        }
    )


def log_response(logger: logging.Logger, response_data: Dict[str, Any]):
    """Log API response with structured data"""
    logger.info(
        "API Response",
        extra={
            'request_id': response_data.get('request_id'),
            'status_code': response_data.get('status_code'),
            'duration_ms': response_data.get('duration_ms'),
            'content_length': response_data.get('content_length')
        }
    )


def log_model_inference(logger: logging.Logger, inference_data: Dict[str, Any]):
    """Log model inference with metrics"""
    logger.info(
        "Model Inference",
        extra={
            'model_name': inference_data.get('model_name'),
            'input_size': inference_data.get('input_size'),
            'output_size': inference_data.get('output_size'),
            'duration_ms': inference_data.get('duration_ms'),
            'batch_size': inference_data.get('batch_size', 1),
            'cache_hit': inference_data.get('cache_hit', False)
        }
    )


def log_security_event(logger: logging.Logger, event_data: Dict[str, Any]):
    """Log security event"""
    logger.warning(
        "Security Event",
        extra={
            'event_type': event_data.get('event_type'),
            'user_id': event_data.get('user_id'),
            'ip_address': event_data.get('ip_address'),
            'details': event_data.get('details')
        }
    )


def create_monitoring_dashboard_config():
    """Create configuration for monitoring dashboards"""
    return {
        "dashboards": [
            {
                "name": "System Overview",
                "panels": [
                    {
                        "title": "Log Volume",
                        "type": "graph",
                        "query": "sum(rate(log_messages_total[5m])) by (level)"
                    },
                    {
                        "title": "Error Rate",
                        "type": "graph",
                        "query": "sum(rate(log_errors_total[5m])) by (logger)"
                    },
                    {
                        "title": "API Response Time",
                        "type": "graph",
                        "query": "histogram_quantile(0.95, rate(api_response_duration_seconds_bucket[5m]))"
                    }
                ]
            },
            {
                "name": "Model Performance",
                "panels": [
                    {
                        "title": "Inference Rate",
                        "type": "graph",
                        "query": "sum(rate(model_inference_total[5m])) by (model_name)"
                    },
                    {
                        "title": "Inference Latency",
                        "type": "graph",
                        "query": "histogram_quantile(0.95, rate(model_inference_duration_seconds_bucket[5m])) by (model_name)"
                    },
                    {
                        "title": "Cache Hit Rate",
                        "type": "graph",
                        "query": "sum(rate(cache_hits_total[5m])) / sum(rate(cache_requests_total[5m]))"
                    }
                ]
            }
        ],
        "alerts": [
            {
                "name": "HighErrorRate",
                "query": "sum(rate(log_errors_total[5m])) > 10",
                "severity": "warning",
                "description": "Error rate exceeds 10 per minute"
            },
            {
                "name": "SlowAPIResponse",
                "query": "histogram_quantile(0.95, rate(api_response_duration_seconds_bucket[5m])) > 2",
                "severity": "warning",
                "description": "95th percentile API response time exceeds 2 seconds"
            }
        ]
    }


# Example usage and testing
if __name__ == "__main__":
    # Setup logging
    loggers = setup_logging(
        service_name="ai-job-chommie-test",
        log_level="DEBUG",
        enable_console=True,
        enable_file=True,
        enable_metrics=True,
        format_type="json"
    )
    
    # Test different log levels
    logger = loggers['root']
    logger.debug("Debug message")
    logger.info("Info message")
    logger.warning("Warning message")
    logger.error("Error message")
    
    # Test structured logging
    log_request(loggers['access'], {
        'request_id': '123-456',
        'method': 'POST',
        'path': '/api/v1/analyze',
        'user_id': 'user123'
    })
    
    log_model_inference(loggers['performance'], {
        'model_name': 'embeddings',
        'input_size': 512,
        'output_size': 768,
        'duration_ms': 125.5
    })
    
    # Test exception logging
    try:
        1 / 0
    except Exception as e:
        logger.exception("Test exception")
    
    print("\nLogging configuration complete. Check logs directory for output.")
