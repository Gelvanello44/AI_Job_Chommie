"""
Core configuration module for the job scraping service.
Manages all application settings and environment variables.
"""

from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field, validator
import os
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings with validation and type hints."""
    
    # Service Configuration
    service_name: str = Field(default="job-scraping-service")
    environment: str = Field(default="development")
    debug: bool = Field(default=False)
    log_level: str = Field(default="INFO")
    
    # API Configuration
    api_host: str = Field(default="0.0.0.0")
    api_port: int = Field(default=8000)
    api_prefix: str = Field(default="/api/v1")
    graphql_path: str = Field(default="/graphql")
    ws_path: str = Field(default="/ws")
    
    # Database Configuration
    database_url: str = Field(default="postgresql://localhost:5432/jobscraper")
    database_pool_size: int = Field(default=20)
    database_max_overflow: int = Field(default=40)
    vector_dimension: int = Field(default=768)
    
    # Redis Configuration
    redis_url: str = Field(default="redis://localhost:6379/0")
    redis_cluster_nodes: Optional[str] = Field(default=None)
    redis_password: Optional[str] = Field(default=None)
    redis_max_connections: int = Field(default=100)
    
    # Kafka Configuration
    kafka_bootstrap_servers: str = Field(default="localhost:9092")
    kafka_topic_jobs: str = Field(default="job-updates")
    kafka_topic_analytics: str = Field(default="job-analytics")
    kafka_consumer_group: str = Field(default="job-processor")
    
    # Authentication Configuration
    jwt_secret_key: str = Field(default="your-secret-key-change-in-production")
    jwt_algorithm: str = Field(default="HS256")
    jwt_expiration_hours: int = Field(default=168)  # 7 days
    password_salt: str = Field(default="your-password-salt-change-in-production")
    
    # External API Configuration
    serp_api_key: Optional[str] = Field(default=None)
    serp_api_timeout: int = Field(default=30)
    huggingface_api_key: Optional[str] = Field(default=None)
    huggingface_model: str = Field(default="sentence-transformers/all-MiniLM-L6-v2")
    
    # SerpAPI Configuration - REAL SCRAPING ACTIVATION
    serpapi_api_key: Optional[str] = Field(default=None)
    serpapi_enabled: bool = Field(default=True)  #  ACTIVATED
    enable_real_scraping: bool = Field(default=True)  #  ACTIVATED  
    use_mock_data: bool = Field(default=False)  #  DISABLED
    
    # South African Market Configuration
    serpapi_location: str = Field(default="South Africa")
    serpapi_country: str = Field(default="ZA")
    serpapi_language: str = Field(default="en")
    serpapi_currency: str = Field(default="ZAR")
    serpapi_max_results: int = Field(default=100)
    serpapi_engine: str = Field(default="google_jobs")
    
    # Rate Limiting - Critical for API Quota Management
    serpapi_requests_per_minute: int = Field(default=60)
    serpapi_max_retries: int = Field(default=3)
    serpapi_retry_delay: int = Field(default=5)
    
    #  CRITICAL QUOTA MANAGEMENT - FREE TIER LIMITS
    serpapi_monthly_quota: int = Field(default=250)
    serpapi_used_quota: int = Field(default=16)  # Already used
    serpapi_remaining_quota: int = Field(default=234)  # 234 searches left
    serpapi_daily_limit: int = Field(default=78)  # 234 / 3 days
    serpapi_enable_quota_protection: bool = Field(default=True)
    serpapi_quota_buffer: int = Field(default=10)  # Safety buffer
    
    # FREE TIER OPTIMIZATION
    serpapi_free_tier_mode: bool = Field(default=True)
    serpapi_high_value_queries_only: bool = Field(default=True)
    serpapi_max_searches_per_hour: int = Field(default=3)  # 78/day = ~3.25/hour
    
    #  AUTOMATIC MONTH TRANSITION TRACKING
    serpapi_last_reset_month: Optional[int] = Field(default=None)  # Track last quota reset month
    serpapi_last_reset_year: Optional[int] = Field(default=None)   # Track last quota reset year
    serpapi_auto_adjust_daily_limit: bool = Field(default=True)    # Enable dynamic daily limits
    
    # Scraping Configuration
    max_concurrent_scrapers: int = Field(default=50)
    scraper_timeout: int = Field(default=60)
    retry_attempts: int = Field(default=3)
    retry_delay: int = Field(default=5)
    user_agent_rotation: bool = Field(default=True)
    
    # Proxy Configuration
    proxy_provider: str = Field(default="rotating-proxies")
    proxy_api_key: Optional[str] = Field(default=None)
    proxy_rotation_interval: int = Field(default=300)
    
    # Anti-Detection Configuration
    fingerprint_rotation: bool = Field(default=True)
    tls_randomization: bool = Field(default=True)
    behavioral_mimicking: bool = Field(default=True)
    captcha_solver_api_key: Optional[str] = Field(default=None)
    
    # Rate Limiting
    rate_limit_per_domain: int = Field(default=10)
    rate_limit_window: int = Field(default=60)
    adaptive_rate_limiting: bool = Field(default=True)
    
    # Monitoring
    prometheus_port: int = Field(default=9090)
    jaeger_agent_host: str = Field(default="localhost")
    jaeger_agent_port: int = Field(default=6831)
    sentry_dsn: Optional[str] = Field(default=None)
    app_version: str = Field(default="1.0.0")
    
    # Performance Targets
    target_daily_jobs: int = Field(default=50000)
    target_response_time_ms: int = Field(default=100)
    target_uptime_percent: float = Field(default=99.95)
    max_concurrent_updates: int = Field(default=1000)
    
    # Pricing Tier Features
    tier_features: dict = Field(default={
        "basic": {
            "monthly_applications": (2, 8),
            "features": ["job_matching", "basic_search"]
        },
        "professional": {
            "monthly_applications": (8, 20),
            "features": ["salary_benchmarking", "analytics", "advanced_search"]
        },
        "executive": {
            "monthly_applications": (20, 50),
            "features": [
                "networking_events", "company_research", "leadership_assessments",
                "headhunter_visibility", "interview_scheduling", "reference_management"
            ]
        },
        "enterprise": {
            "monthly_applications": (50, None),
            "features": [
                "personal_brand_audit", "career_trajectory", "industry_intelligence",
                "mock_interviews", "hidden_job_market", "executive_search",
                "market_analytics"
            ]
        }
    })
    
    @validator('redis_cluster_nodes')
    def parse_cluster_nodes(cls, v):
        """Parse Redis cluster nodes from comma-separated string."""
        if v:
            return [node.strip() for node in v.split(',')]
        return None
    
    @validator('environment')
    def validate_environment(cls, v):
        """Validate environment name."""
        allowed = ["development", "staging", "production"]
        if v not in allowed:
            raise ValueError(f"Environment must be one of {allowed}")
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        
    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.environment == "production"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development."""
        return self.environment == "development"
    
    @property
    def kafka_servers_list(self) -> List[str]:
        """Get Kafka servers as list."""
        return [s.strip() for s in self.kafka_bootstrap_servers.split(',')]
    
    @property
    def database_settings(self) -> dict:
        """Get database connection settings."""
        return {
            "url": self.database_url,
            "pool_size": self.database_pool_size,
            "max_overflow": self.database_max_overflow,
            "pool_pre_ping": True,
            "echo": self.debug
        }


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Create global settings instance
settings = get_settings()
