"""
Enhanced API Configuration for Maximum Local Processing Performance
Removes all API limitations and enables unlimited local inference
"""

import os
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class ProcessingConfig:
    """Configuration for local processing optimization"""
    batch_size: int
    max_concurrent_requests: int
    enable_caching: bool
    cache_ttl_seconds: int
    timeout_seconds: Optional[int]
    retry_attempts: int
    enable_batch_aggregation: bool
    aggregation_timeout_ms: int


@dataclass
class ModelConfig:
    """Configuration for model-specific settings"""
    model_name: str
    model_type: str
    batch_size: int
    max_memory_mb: int
    enable_caching: bool
    preload_on_startup: bool
    optimization_level: str


class EnhancedAPIConfig:
    """Enhanced configuration for unlimited local processing with maximum performance"""
    
    def __init__(self):
        # Legacy Backend API Configuration (for backward compatibility)
        self.BACKEND_API_URL = os.getenv('BACKEND_API_URL', 'http://localhost:5000')
        self.BACKEND_API_VERSION = os.getenv('BACKEND_API_VERSION', 'v1')
        self.BACKEND_API_KEY = os.getenv('BACKEND_API_KEY', '')
        
        # Authentication (kept for compatibility)
        self.ADMIN_API_KEY = os.getenv('ADMIN_API_KEY', 'admin_key_change_this_to_32_plus_characters_for_security')
        self.SERVICE_AUTH_TOKEN = os.getenv('SERVICE_AUTH_TOKEN', '')
        
        # Local Processing Configuration (UNLIMITED POWER MODE)
        self.LOCAL_PROCESSING_ENABLED = True
        self.USE_LOCAL_MODELS_ONLY = True
        self.UNLIMITED_INFERENCE = True
        
        # Remove all API limitations
        self.API_RATE_LIMIT = None  # No rate limits
        self.API_QUOTA = float('inf')  # Infinite quota
        self.API_TIMEOUT = None  # No timeout for local processing
        self.API_RETRY_ATTEMPTS = 0  # No retries needed for local models
        
        # High-Performance Local Processing Settings
        self.processing_config = ProcessingConfig(
            batch_size=64,  # Large batch size for throughput
            max_concurrent_requests=50,  # High concurrency
            enable_caching=True,
            cache_ttl_seconds=3600,  # 1 hour cache
            timeout_seconds=None,  # No timeout
            retry_attempts=0,  # No retries needed
            enable_batch_aggregation=True,
            aggregation_timeout_ms=50  # Aggregate for 50ms
        )
        
        # Model-specific configurations for maximum performance
        self.model_configs = {
            'job_similarity': ModelConfig(
                model_name='sentence-transformers/all-MiniLM-L6-v2',
                model_type='sentence_transformer',
                batch_size=32,
                max_memory_mb=200,
                enable_caching=True,
                preload_on_startup=True,
                optimization_level='O2'
            ),
            'text_classification': ModelConfig(
                model_name='distilbert-base-uncased',
                model_type='pipeline',
                batch_size=16,
                max_memory_mb=300,
                enable_caching=True,
                preload_on_startup=True,
                optimization_level='O2'
            ),
            'text_analysis': ModelConfig(
                model_name='distilbert-base-uncased',
                model_type='pipeline',
                batch_size=20,
                max_memory_mb=300,
                enable_caching=True,
                preload_on_startup=True,
                optimization_level='O2'
            )
        }
        
        # Performance Monitoring Settings
        self.ENABLE_PERFORMANCE_MONITORING = True
        self.PERFORMANCE_LOG_INTERVAL = 60  # Log stats every minute
        self.ENABLE_DETAILED_METRICS = True
        
        # Cache Configuration
        self.CACHE_ENABLED = True
        self.CACHE_SIZE_MB = 2000  # 2GB cache
        self.CACHE_EVICTION_POLICY = 'lru'
        self.ENABLE_PERSISTENT_CACHE = True
        self.CACHE_PATH = './cache/api'
        
        # Resource Allocation
        self.MAX_MEMORY_GB = 6  # Use up to 6GB RAM
        self.CPU_THREADS = os.cpu_count() or 4
        self.ENABLE_GPU = False  # CPU-only for now
        
        # Advanced Features
        self.ENABLE_MODEL_QUANTIZATION = False  # Keep full precision
        self.ENABLE_DYNAMIC_BATCHING = True
        self.ENABLE_REQUEST_BATCHING = True
        self.BATCH_WINDOW_MS = 100  # Batch requests within 100ms window
        
        # Logging and Debugging
        self.DEBUG_MODE = os.getenv('DEBUG', 'false').lower() == 'true'
        self.LOG_INFERENCE_TIMES = True
        self.LOG_CACHE_HITS = True
        
        logger.info("EnhancedAPIConfig initialized with UNLIMITED LOCAL PROCESSING")
        logger.info(f"Local models enabled: {self.LOCAL_PROCESSING_ENABLED}")
        logger.info(f"Max concurrent requests: {self.processing_config.max_concurrent_requests}")
        logger.info(f"Cache size: {self.CACHE_SIZE_MB}MB")
    
    def get_backend_endpoint(self, endpoint: str) -> str:
        """Construct full backend API endpoint URL (for backward compatibility)"""
        base_url = f"{self.BACKEND_API_URL}/api/{self.BACKEND_API_VERSION}"
        return f"{base_url}/{endpoint.lstrip('/')}"
    
    def get_headers(self) -> dict:
        """Get headers for API requests (for backward compatibility)"""
        headers = {
            'Content-Type': 'application/json',
            'X-Service-Name': 'job-scraping-service-enhanced',
            'X-API-Version': self.BACKEND_API_VERSION,
            'X-Processing-Mode': 'local',
            'X-Unlimited-Mode': 'true'
        }
        
        if self.SERVICE_AUTH_TOKEN:
            headers['Authorization'] = f'Bearer {self.SERVICE_AUTH_TOKEN}'
        elif self.ADMIN_API_KEY:
            headers['X-Admin-API-Key'] = self.ADMIN_API_KEY
            
        return headers
    
    def get_processing_config(self, task_type: str = 'default') -> ProcessingConfig:
        """Get processing configuration for specific task type"""
        # Can customize per task type if needed
        config = self.processing_config
        
        # Override for specific tasks
        if task_type == 'batch_analysis':
            config.batch_size = 128  # Even larger batches for bulk processing
            config.max_concurrent_requests = 100
        elif task_type == 'real_time':
            config.batch_size = 1  # Single item for low latency
            config.enable_batch_aggregation = False
            
        return config
    
    def get_model_config(self, model_key: str) -> ModelConfig:
        """Get configuration for specific model"""
        return self.model_configs.get(model_key)
    
    def is_local_processing_enabled(self) -> bool:
        """Check if local processing is enabled"""
        return self.LOCAL_PROCESSING_ENABLED and self.USE_LOCAL_MODELS_ONLY
    
    def get_performance_settings(self) -> Dict[str, Any]:
        """Get performance optimization settings"""
        return {
            'max_memory_gb': self.MAX_MEMORY_GB,
            'cpu_threads': self.CPU_THREADS,
            'enable_gpu': self.ENABLE_GPU,
            'cache_size_mb': self.CACHE_SIZE_MB,
            'max_concurrent_requests': self.processing_config.max_concurrent_requests,
            'batch_size': self.processing_config.batch_size,
            'enable_monitoring': self.ENABLE_PERFORMANCE_MONITORING,
            'unlimited_inference': self.UNLIMITED_INFERENCE
        }
    
    def validate_configuration(self) -> List[str]:
        """Validate configuration and return any warnings"""
        warnings = []
        
        # Check memory allocation
        try:
            import psutil
            available_memory_gb = psutil.virtual_memory().available / (1024**3)
            if self.MAX_MEMORY_GB > available_memory_gb:
                warnings.append(f"Configured memory ({self.MAX_MEMORY_GB}GB) exceeds available ({available_memory_gb:.1f}GB)")
        except ImportError:
            warnings.append("psutil not installed - cannot validate memory settings")
        
        # Check cache directory
        if self.ENABLE_PERSISTENT_CACHE:
            cache_dir = os.path.dirname(self.CACHE_PATH)
            if not os.path.exists(cache_dir):
                try:
                    os.makedirs(cache_dir, exist_ok=True)
                except Exception as e:
                    warnings.append(f"Cannot create cache directory: {str(e)}")
        
        # Validate model configurations
        for model_key, config in self.model_configs.items():
            if config.batch_size > 256:
                warnings.append(f"Very large batch size for {model_key}: {config.batch_size}")
        
        return warnings
    
    def __str__(self) -> str:
        """String representation for debugging"""
        return (
            f"EnhancedAPIConfig("
            f"local_processing={self.LOCAL_PROCESSING_ENABLED}, "
            f"unlimited={self.UNLIMITED_INFERENCE}, "
            f"max_concurrent={self.processing_config.max_concurrent_requests}, "
            f"cache_size={self.CACHE_SIZE_MB}MB)"
        )


# Create singleton instance with maximum performance
api_config = EnhancedAPIConfig()

# Validate on startup
warnings = api_config.validate_configuration()
if warnings:
    for warning in warnings:
        logger.warning(f"Configuration warning: {warning}")
else:
    logger.info("Configuration validated successfully")


# Convenience functions for easy access
def get_batch_size(task_type: str = 'default') -> int:
    """Get optimal batch size for task type"""
    return api_config.get_processing_config(task_type).batch_size


def get_max_concurrent_requests() -> int:
    """Get maximum concurrent requests allowed"""
    return api_config.processing_config.max_concurrent_requests


def is_unlimited_mode() -> bool:
    """Check if running in unlimited inference mode"""
    return api_config.UNLIMITED_INFERENCE


def get_cache_config() -> Dict[str, Any]:
    """Get cache configuration"""
    return {
        'enabled': api_config.CACHE_ENABLED,
        'size_mb': api_config.CACHE_SIZE_MB,
        'eviction_policy': api_config.CACHE_EVICTION_POLICY,
        'persistent': api_config.ENABLE_PERSISTENT_CACHE,
        'path': api_config.CACHE_PATH
    }
