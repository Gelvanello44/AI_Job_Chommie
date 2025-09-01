"""
Sentry configuration for the Job Scraping Service.
"""

import os
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.asyncio import AsyncioIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from typing import Optional

# Try to import optional integrations
try:
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    HAS_SQLALCHEMY = True
except ImportError:
    HAS_SQLALCHEMY = False

try:
    from sentry_sdk.integrations.celery import CeleryIntegration
    HAS_CELERY = True
except (ImportError, Exception):
    HAS_CELERY = False
    CeleryIntegration = None

try:
    from sentry_sdk.integrations.redis import RedisIntegration
    HAS_REDIS = True
except (ImportError, Exception):
    HAS_REDIS = False
    RedisIntegration = None


def init_sentry() -> None:
    """Initialize Sentry for the job scraping service."""
    
    # Get configuration from environment
    dsn = os.getenv('SENTRY_DSN')
    environment = os.getenv('ENVIRONMENT', 'development')
    
    if not dsn:
        print("SENTRY_DSN not configured, skipping Sentry initialization")
        return
    
    # Configure integrations
    integrations = [
        # FastAPI integration for web requests
        FastApiIntegration(
            auto_enabling_integrations=True,
            transaction_style="endpoint"
        ),
        
        # AsyncIO for async operations
        AsyncioIntegration(),
        
        # Logging integration
        LoggingIntegration(
            level=None,        # Capture info and above as breadcrumbs
            event_level=None   # Send no logs as events
        ),
    ]
    
    # Add optional integrations if available
    if HAS_SQLALCHEMY:
        integrations.append(SqlalchemyIntegration())
    
    if HAS_CELERY:
        integrations.append(CeleryIntegration())
    
    if HAS_REDIS:
        integrations.append(RedisIntegration())
    
    # Initialize Sentry
    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        integrations=integrations,
        
        # Performance monitoring
        traces_sample_rate=0.1 if environment == 'production' else 1.0,
        
        # Profile sampling (CPU profiling)
        profiles_sample_rate=0.1 if environment == 'production' else 1.0,
        
        # Release tracking
        release=os.getenv('APP_VERSION', '1.0.0'),
        
        # Send default PII (personally identifiable information)
        send_default_pii=True,
        
        # Configure initial scope
        before_send=_filter_events,
        
        # Configure sampling
        before_send_transaction=_filter_transactions,
    )
    
    # Set initial scope tags
    with sentry_sdk.configure_scope() as scope:
        scope.set_tag("component", "scraping-service")
        scope.set_tag("framework", "fastapi")
        scope.set_tag("language", "python")
        scope.set_tag("service", "job-scraper")


def _filter_events(event, hint):
    """Filter out unwanted events before sending to Sentry."""
    
    environment = os.getenv('ENVIRONMENT', 'development')
    
    if environment == 'production':
        # Filter out common scraping errors that are expected
        if event.get('exception'):
            for exception in event['exception'].get('values', []):
                error_message = exception.get('value', '')
                
                # Filter out connection timeouts (common in scraping)
                if any(keyword in error_message.lower() for keyword in [
                    'timeout', 'connection', 'dns', 'ssl', 'certificate'
                ]):
                    return None
                
                # Filter out rate limiting errors (expected in scraping)
                if any(keyword in error_message.lower() for keyword in [
                    'rate limit', '429', 'too many requests'
                ]):
                    return None
                
                # Filter out scraping-specific errors that are handled
                if any(keyword in error_message.lower() for keyword in [
                    'element not found', 'no such element', 'stale element'
                ]):
                    return None
    
    return event


def _filter_transactions(event, hint):
    """Filter out unwanted transactions before sending to Sentry."""
    
    # Don't send health check transactions
    transaction_name = event.get('transaction', '')
    
    if transaction_name in [
        'GET /health',
        'GET /api/health', 
        'GET /metrics',
        'GET /api/v1/health'
    ]:
        return None
    
    return event


# Utility functions for manual error tracking

def capture_scraping_error(
    error: Exception, 
    context: Optional[dict] = None,
    url: Optional[str] = None,
    scraper_type: Optional[str] = None
) -> None:
    """Capture scraping-specific errors with additional context."""
    
    with sentry_sdk.configure_scope() as scope:
        if context:
            scope.set_context("scraping_context", context)
        
        if url:
            scope.set_tag("target_url", url)
            scope.set_context("url_info", {"url": url})
        
        if scraper_type:
            scope.set_tag("scraper_type", scraper_type)
        
        scope.set_tag("error_category", "scraping")
        
        sentry_sdk.capture_exception(error)


def capture_processing_error(
    error: Exception,
    job_data: Optional[dict] = None,
    processing_stage: Optional[str] = None
) -> None:
    """Capture job processing errors with context."""
    
    with sentry_sdk.configure_scope() as scope:
        if job_data:
            # Remove sensitive data before logging
            safe_job_data = {k: v for k, v in job_data.items() 
                           if k not in ['email', 'phone', 'personal_info']}
            scope.set_context("job_data", safe_job_data)
        
        if processing_stage:
            scope.set_tag("processing_stage", processing_stage)
        
        scope.set_tag("error_category", "processing")
        
        sentry_sdk.capture_exception(error)


def capture_api_error(
    error: Exception,
    endpoint: Optional[str] = None,
    method: Optional[str] = None,
    status_code: Optional[int] = None
) -> None:
    """Capture API-related errors."""
    
    with sentry_sdk.configure_scope() as scope:
        if endpoint:
            scope.set_tag("api_endpoint", endpoint)
        
        if method:
            scope.set_tag("http_method", method)
        
        if status_code:
            scope.set_tag("status_code", str(status_code))
        
        scope.set_tag("error_category", "api")
        
        sentry_sdk.capture_exception(error)


def add_scraping_breadcrumb(
    message: str,
    url: Optional[str] = None,
    data: Optional[dict] = None
) -> None:
    """Add a breadcrumb for scraping operations."""
    
    breadcrumb_data = data or {}
    if url:
        breadcrumb_data['url'] = url
    
    sentry_sdk.add_breadcrumb(
        message=message,
        category='scraping',
        level='info',
        data=breadcrumb_data
    )


def set_scraping_user_context(
    user_id: str,
    user_type: Optional[str] = None,
    additional_data: Optional[dict] = None
) -> None:
    """Set user context for scraping operations."""
    
    user_data = {
        'id': user_id,
        'type': user_type or 'scraper'
    }
    
    if additional_data:
        user_data.update(additional_data)
    
    sentry_sdk.set_user(user_data)


def clear_user_context() -> None:
    """Clear the current user context."""
    sentry_sdk.set_user(None)


def capture_performance_metric(
    operation: str,
    duration: float,
    success: bool = True,
    additional_data: Optional[dict] = None
) -> None:
    """Capture performance metrics for scraping operations."""
    
    with sentry_sdk.configure_scope() as scope:
        scope.set_tag("operation_type", operation)
        scope.set_tag("operation_success", str(success))
        
        metric_data = {
            'operation': operation,
            'duration_seconds': duration,
            'success': success
        }
        
        if additional_data:
            metric_data.update(additional_data)
        
        scope.set_context("performance", metric_data)
        
        # Capture as a message for performance tracking
        sentry_sdk.capture_message(
            f"Performance: {operation} completed in {duration:.2f}s", 
            level='info'
        )


# Context managers for automatic error handling

class SentryScrapingContext:
    """Context manager for scraping operations with automatic error capture."""
    
    def __init__(self, url: str, scraper_type: str):
        self.url = url
        self.scraper_type = scraper_type
        self.start_time = None
    
    def __enter__(self):
        import time
        self.start_time = time.time()
        
        add_scraping_breadcrumb(
            f"Starting scraping operation: {self.scraper_type}",
            url=self.url
        )
        
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        import time
        duration = time.time() - self.start_time if self.start_time else 0
        
        if exc_type is not None:
            # An exception occurred
            capture_scraping_error(
                exc_val,
                context={
                    'duration': duration,
                    'scraper_type': self.scraper_type
                },
                url=self.url,
                scraper_type=self.scraper_type
            )
        else:
            # Success
            capture_performance_metric(
                operation=f"scrape_{self.scraper_type}",
                duration=duration,
                success=True,
                additional_data={'url': self.url}
            )
