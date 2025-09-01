"""
Advanced Cache Manager for AI Inference Optimization
Provides high-performance caching with LRU eviction, TTL, persistence, and memory management
"""

import os
import json
import time
import hashlib
import pickle
import threading
import logging
from typing import Any, Dict, Optional, Tuple, List, Union, Callable
from collections import OrderedDict
from datetime import datetime, timedelta
import numpy as np
from functools import wraps
import psutil
import zlib

logger = logging.getLogger(__name__)


class CacheEntry:
    """Represents a single cache entry with metadata"""
    
    def __init__(self, key: str, value: Any, ttl_seconds: Optional[int] = None, 
                 compressed: bool = False, size_bytes: int = 0):
        self.key = key
        self.value = value
        self.created_at = time.time()
        self.last_accessed = self.created_at
        self.access_count = 0
        self.ttl_seconds = ttl_seconds
        self.compressed = compressed
        self.size_bytes = size_bytes
        
    def is_expired(self) -> bool:
        """Check if the entry has expired based on TTL"""
        if self.ttl_seconds is None:
            return False
        return time.time() - self.created_at > self.ttl_seconds
    
    def access(self):
        """Update access metadata"""
        self.last_accessed = time.time()
        self.access_count += 1
    
    def get_age(self) -> float:
        """Get age of entry in seconds"""
        return time.time() - self.created_at


class CacheManager:
    """
    High-performance cache manager with advanced features:
    - LRU eviction policy
    - TTL support
    - Memory management
    - Persistence
    - Compression
    - Cache statistics
    - Thread safety
    """
    
    def __init__(self, 
                 max_size_mb: int = 1000,
                 default_ttl_seconds: Optional[int] = 3600,
                 enable_persistence: bool = True,
                 persistence_path: str = "./cache/persistent",
                 enable_compression: bool = True,
                 compression_threshold_bytes: int = 1024,  # 1KB
                 eviction_policy: str = "lru"):
        """
        Initialize cache manager
        
        Args:
            max_size_mb: Maximum cache size in MB
            default_ttl_seconds: Default TTL for cache entries
            enable_persistence: Enable disk persistence
            persistence_path: Path for persistent cache storage
            enable_compression: Enable compression for large values
            compression_threshold_bytes: Minimum size for compression
            eviction_policy: Eviction policy (lru, lfu, ttl)
        """
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self.default_ttl_seconds = default_ttl_seconds
        self.enable_persistence = enable_persistence
        self.persistence_path = persistence_path
        self.enable_compression = enable_compression
        self.compression_threshold_bytes = compression_threshold_bytes
        self.eviction_policy = eviction_policy
        
        # Cache storage
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._lock = threading.RLock()
        
        # Cache statistics
        self._stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "compressions": 0,
            "persistence_saves": 0,
            "persistence_loads": 0,
            "total_size_bytes": 0,
            "total_entries": 0
        }
        
        # Performance metrics
        self._perf_metrics = {
            "avg_get_time_ms": 0,
            "avg_put_time_ms": 0,
            "compression_ratio": 0,
            "memory_efficiency": 0
        }
        
        # Initialize persistence
        if self.enable_persistence:
            self._init_persistence()
            self._load_persistent_cache()
        
        logger.info(f"CacheManager initialized with {max_size_mb}MB limit")
    
    def _init_persistence(self):
        """Initialize persistence directory"""
        if not os.path.exists(self.persistence_path):
            os.makedirs(self.persistence_path, exist_ok=True)
    
    def _get_cache_key(self, key: Union[str, Dict, List]) -> str:
        """Generate a consistent cache key from various input types"""
        if isinstance(key, str):
            return key
        
        # For complex objects, create a hash
        try:
            # Convert to JSON for consistent hashing
            key_str = json.dumps(key, sort_keys=True, default=str)
        except:
            # Fallback to string representation
            key_str = str(key)
        
        # Create hash
        return hashlib.sha256(key_str.encode()).hexdigest()
    
    def _estimate_size(self, value: Any) -> int:
        """Estimate the memory size of a value in bytes"""
        try:
            # For numpy arrays
            if isinstance(value, np.ndarray):
                return value.nbytes
            
            # For basic types
            if isinstance(value, (int, float, bool)):
                return 8
            
            # For strings
            if isinstance(value, str):
                return len(value.encode())
            
            # For collections
            if isinstance(value, (list, tuple)):
                return sum(self._estimate_size(item) for item in value) + 8 * len(value)
            
            if isinstance(value, dict):
                size = 0
                for k, v in value.items():
                    size += self._estimate_size(k) + self._estimate_size(v)
                return size + 16 * len(value)
            
            # Default: use pickle to estimate
            return len(pickle.dumps(value))
        except:
            return 1000  # Default estimate
    
    def _compress_value(self, value: Any) -> Tuple[Any, bool]:
        """Compress value if it's large enough"""
        if not self.enable_compression:
            return value, False
        
        size = self._estimate_size(value)
        if size < self.compression_threshold_bytes:
            return value, False
        
        try:
            # Serialize and compress
            serialized = pickle.dumps(value)
            compressed = zlib.compress(serialized)
            
            # Only use compression if it reduces size
            if len(compressed) < len(serialized):
                self._stats["compressions"] += 1
                return compressed, True
            
            return value, False
        except:
            return value, False
    
    def _decompress_value(self, value: Any, compressed: bool) -> Any:
        """Decompress value if compressed"""
        if not compressed:
            return value
        
        try:
            decompressed = zlib.decompress(value)
            return pickle.loads(decompressed)
        except:
            logger.error("Failed to decompress cache value")
            return None
    
    def _evict_entries(self, required_bytes: int):
        """Evict entries to make space for new data"""
        with self._lock:
            evicted = 0
            
            if self.eviction_policy == "lru":
                # Evict least recently used
                while self._stats["total_size_bytes"] + required_bytes > self.max_size_bytes:
                    if not self._cache:
                        break
                    
                    # Get least recently used item
                    oldest_key = next(iter(self._cache))
                    entry = self._cache.pop(oldest_key)
                    
                    self._stats["total_size_bytes"] -= entry.size_bytes
                    self._stats["evictions"] += 1
                    evicted += 1
            
            elif self.eviction_policy == "lfu":
                # Evict least frequently used
                sorted_entries = sorted(
                    self._cache.items(),
                    key=lambda x: x[1].access_count
                )
                
                for key, entry in sorted_entries:
                    if self._stats["total_size_bytes"] + required_bytes <= self.max_size_bytes:
                        break
                    
                    self._cache.pop(key)
                    self._stats["total_size_bytes"] -= entry.size_bytes
                    self._stats["evictions"] += 1
                    evicted += 1
            
            elif self.eviction_policy == "ttl":
                # Evict expired entries first, then oldest
                # First pass: remove expired
                expired_keys = []
                for key, entry in self._cache.items():
                    if entry.is_expired():
                        expired_keys.append(key)
                
                for key in expired_keys:
                    entry = self._cache.pop(key)
                    self._stats["total_size_bytes"] -= entry.size_bytes
                    self._stats["evictions"] += 1
                    evicted += 1
                
                # Second pass: LRU if still needed
                while self._stats["total_size_bytes"] + required_bytes > self.max_size_bytes:
                    if not self._cache:
                        break
                    
                    oldest_key = next(iter(self._cache))
                    entry = self._cache.pop(oldest_key)
                    
                    self._stats["total_size_bytes"] -= entry.size_bytes
                    self._stats["evictions"] += 1
                    evicted += 1
            
            logger.debug(f"Evicted {evicted} entries to free space")
    
    def get(self, key: Union[str, Dict, List], 
            default: Any = None) -> Optional[Any]:
        """
        Get value from cache
        
        Args:
            key: Cache key
            default: Default value if not found
            
        Returns:
            Cached value or default
        """
        start_time = time.time()
        
        cache_key = self._get_cache_key(key)
        
        with self._lock:
            if cache_key in self._cache:
                entry = self._cache[cache_key]
                
                # Check expiration
                if entry.is_expired():
                    self._cache.pop(cache_key)
                    self._stats["total_size_bytes"] -= entry.size_bytes
                    self._stats["misses"] += 1
                    return default
                
                # Update access metadata
                entry.access()
                
                # Move to end for LRU
                self._cache.move_to_end(cache_key)
                
                # Decompress if needed
                value = self._decompress_value(entry.value, entry.compressed)
                
                self._stats["hits"] += 1
                
                # Update performance metrics
                elapsed_ms = (time.time() - start_time) * 1000
                self._update_perf_metric("avg_get_time_ms", elapsed_ms)
                
                return value
            else:
                self._stats["misses"] += 1
                return default
    
    def put(self, key: Union[str, Dict, List], 
            value: Any, 
            ttl_seconds: Optional[int] = None) -> bool:
        """
        Put value in cache
        
        Args:
            key: Cache key
            value: Value to cache
            ttl_seconds: TTL override for this entry
            
        Returns:
            True if successfully cached
        """
        start_time = time.time()
        
        cache_key = self._get_cache_key(key)
        
        # Estimate size
        value_size = self._estimate_size(value)
        
        # Compress if needed
        compressed_value, is_compressed = self._compress_value(value)
        if is_compressed:
            actual_size = self._estimate_size(compressed_value)
        else:
            actual_size = value_size
        
        with self._lock:
            # Check if we need to evict entries
            if self._stats["total_size_bytes"] + actual_size > self.max_size_bytes:
                self._evict_entries(actual_size)
            
            # Create entry
            entry = CacheEntry(
                key=cache_key,
                value=compressed_value,
                ttl_seconds=ttl_seconds or self.default_ttl_seconds,
                compressed=is_compressed,
                size_bytes=actual_size
            )
            
            # If key exists, update total size
            if cache_key in self._cache:
                old_entry = self._cache[cache_key]
                self._stats["total_size_bytes"] -= old_entry.size_bytes
            
            # Add to cache
            self._cache[cache_key] = entry
            self._stats["total_size_bytes"] += actual_size
            self._stats["total_entries"] = len(self._cache)
            
            # Update performance metrics
            elapsed_ms = (time.time() - start_time) * 1000
            self._update_perf_metric("avg_put_time_ms", elapsed_ms)
            
            if is_compressed:
                compression_ratio = value_size / actual_size
                self._update_perf_metric("compression_ratio", compression_ratio)
        
        return True
    
    def delete(self, key: Union[str, Dict, List]) -> bool:
        """Delete entry from cache"""
        cache_key = self._get_cache_key(key)
        
        with self._lock:
            if cache_key in self._cache:
                entry = self._cache.pop(cache_key)
                self._stats["total_size_bytes"] -= entry.size_bytes
                self._stats["total_entries"] = len(self._cache)
                return True
        
        return False
    
    def clear(self):
        """Clear all cache entries"""
        with self._lock:
            self._cache.clear()
            self._stats["total_size_bytes"] = 0
            self._stats["total_entries"] = 0
            logger.info("Cache cleared")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._lock:
            hit_rate = 0
            total_requests = self._stats["hits"] + self._stats["misses"]
            if total_requests > 0:
                hit_rate = self._stats["hits"] / total_requests
            
            memory_usage_mb = self._stats["total_size_bytes"] / (1024 * 1024)
            memory_usage_percent = (self._stats["total_size_bytes"] / self.max_size_bytes) * 100
            
            return {
                **self._stats,
                "hit_rate": hit_rate,
                "memory_usage_mb": memory_usage_mb,
                "memory_usage_percent": memory_usage_percent,
                "performance_metrics": self._perf_metrics.copy()
            }
    
    def _update_perf_metric(self, metric: str, value: float):
        """Update performance metric with running average"""
        if metric not in self._perf_metrics:
            self._perf_metrics[metric] = value
        else:
            # Running average
            alpha = 0.1  # Smoothing factor
            self._perf_metrics[metric] = (
                alpha * value + (1 - alpha) * self._perf_metrics[metric]
            )
    
    def persist(self):
        """Persist cache to disk"""
        if not self.enable_persistence:
            return
        
        try:
            with self._lock:
                # Create snapshot
                snapshot = {
                    "entries": {},
                    "stats": self._stats.copy(),
                    "timestamp": datetime.now().isoformat()
                }
                
                # Add non-expired entries
                for key, entry in self._cache.items():
                    if not entry.is_expired():
                        snapshot["entries"][key] = {
                            "value": entry.value,
                            "created_at": entry.created_at,
                            "ttl_seconds": entry.ttl_seconds,
                            "compressed": entry.compressed,
                            "size_bytes": entry.size_bytes
                        }
                
                # Save to disk
                snapshot_path = os.path.join(self.persistence_path, "cache_snapshot.pkl")
                temp_path = snapshot_path + ".tmp"
                
                with open(temp_path, 'wb') as f:
                    pickle.dump(snapshot, f)
                
                # Atomic rename
                os.replace(temp_path, snapshot_path)
                
                self._stats["persistence_saves"] += 1
                logger.info(f"Persisted {len(snapshot['entries'])} cache entries")
                
        except Exception as e:
            logger.error(f"Failed to persist cache: {str(e)}")
    
    def _load_persistent_cache(self):
        """Load cache from disk"""
        snapshot_path = os.path.join(self.persistence_path, "cache_snapshot.pkl")
        
        if not os.path.exists(snapshot_path):
            return
        
        try:
            with open(snapshot_path, 'rb') as f:
                snapshot = pickle.load(f)
            
            loaded = 0
            total_size = 0
            
            with self._lock:
                for key, entry_data in snapshot["entries"].items():
                    # Check if entry would be expired
                    age = time.time() - entry_data["created_at"]
                    if entry_data["ttl_seconds"] and age > entry_data["ttl_seconds"]:
                        continue
                    
                    # Recreate entry
                    entry = CacheEntry(
                        key=key,
                        value=entry_data["value"],
                        ttl_seconds=entry_data["ttl_seconds"],
                        compressed=entry_data["compressed"],
                        size_bytes=entry_data["size_bytes"]
                    )
                    entry.created_at = entry_data["created_at"]
                    
                    # Add to cache if space available
                    if total_size + entry.size_bytes <= self.max_size_bytes:
                        self._cache[key] = entry
                        total_size += entry.size_bytes
                        loaded += 1
                
                self._stats["total_size_bytes"] = total_size
                self._stats["total_entries"] = len(self._cache)
                self._stats["persistence_loads"] += 1
            
            logger.info(f"Loaded {loaded} entries from persistent cache")
            
        except Exception as e:
            logger.error(f"Failed to load persistent cache: {str(e)}")
    
    def create_key_for_inference(self, 
                                model_name: str,
                                inputs: Union[str, List[str]],
                                **kwargs) -> str:
        """
        Create a cache key for model inference
        
        Args:
            model_name: Name of the model
            inputs: Input text(s)
            **kwargs: Additional parameters
            
        Returns:
            Cache key
        """
        key_data = {
            "model": model_name,
            "inputs": inputs if isinstance(inputs, list) else [inputs],
            "params": kwargs
        }
        return self._get_cache_key(key_data)
    
    def cache_inference(self, 
                       model_name: str,
                       inputs: Union[str, List[str]],
                       outputs: Any,
                       ttl_seconds: Optional[int] = None,
                       **kwargs) -> bool:
        """
        Cache model inference results
        
        Args:
            model_name: Name of the model
            inputs: Input text(s)
            outputs: Model outputs
            ttl_seconds: Optional TTL override
            **kwargs: Additional parameters
            
        Returns:
            True if cached successfully
        """
        key = self.create_key_for_inference(model_name, inputs, **kwargs)
        return self.put(key, outputs, ttl_seconds)
    
    def get_inference(self,
                     model_name: str,
                     inputs: Union[str, List[str]],
                     **kwargs) -> Optional[Any]:
        """
        Get cached inference results
        
        Args:
            model_name: Name of the model
            inputs: Input text(s)
            **kwargs: Additional parameters
            
        Returns:
            Cached results or None
        """
        key = self.create_key_for_inference(model_name, inputs, **kwargs)
        return self.get(key)
    
    def cleanup_expired(self):
        """Remove expired entries"""
        with self._lock:
            expired_keys = []
            
            for key, entry in self._cache.items():
                if entry.is_expired():
                    expired_keys.append(key)
            
            for key in expired_keys:
                entry = self._cache.pop(key)
                self._stats["total_size_bytes"] -= entry.size_bytes
            
            self._stats["total_entries"] = len(self._cache)
            
            if expired_keys:
                logger.info(f"Cleaned up {len(expired_keys)} expired entries")


class MultiLevelCache:
    """
    Multi-level cache implementation with memory and disk tiers
    """
    
    def __init__(self,
                 l1_size_mb: int = 100,  # Fast memory cache
                 l2_size_mb: int = 1000,  # Larger disk cache
                 l1_ttl_seconds: int = 300,  # 5 minutes
                 l2_ttl_seconds: int = 3600,  # 1 hour
                 persistence_path: str = "./cache/multilevel"):
        """Initialize multi-level cache"""
        
        # Level 1: Fast in-memory cache
        self.l1_cache = CacheManager(
            max_size_mb=l1_size_mb,
            default_ttl_seconds=l1_ttl_seconds,
            enable_persistence=False,
            enable_compression=False  # No compression for speed
        )
        
        # Level 2: Larger persistent cache
        self.l2_cache = CacheManager(
            max_size_mb=l2_size_mb,
            default_ttl_seconds=l2_ttl_seconds,
            enable_persistence=True,
            persistence_path=persistence_path,
            enable_compression=True
        )
        
        self._stats = {
            "l1_hits": 0,
            "l2_hits": 0,
            "misses": 0
        }
    
    def get(self, key: Union[str, Dict, List], default: Any = None) -> Optional[Any]:
        """Get from cache, checking L1 then L2"""
        # Try L1 first
        value = self.l1_cache.get(key)
        if value is not None:
            self._stats["l1_hits"] += 1
            return value
        
        # Try L2
        value = self.l2_cache.get(key)
        if value is not None:
            self._stats["l2_hits"] += 1
            # Promote to L1
            self.l1_cache.put(key, value)
            return value
        
        self._stats["misses"] += 1
        return default
    
    def put(self, key: Union[str, Dict, List], value: Any, 
            ttl_seconds: Optional[int] = None) -> bool:
        """Put in both cache levels"""
        # Always put in L1
        self.l1_cache.put(key, value, ttl_seconds)
        
        # Put in L2 for larger/longer-term storage
        return self.l2_cache.put(key, value, ttl_seconds)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get combined statistics"""
        total_requests = sum(self._stats.values())
        hit_rate = 0
        if total_requests > 0:
            hit_rate = (self._stats["l1_hits"] + self._stats["l2_hits"]) / total_requests
        
        return {
            "multi_level_stats": self._stats,
            "hit_rate": hit_rate,
            "l1_stats": self.l1_cache.get_stats(),
            "l2_stats": self.l2_cache.get_stats()
        }


def cache_decorator(cache_manager: CacheManager, 
                   ttl_seconds: Optional[int] = None,
                   key_func: Optional[Callable] = None):
    """
    Decorator for caching function results
    
    Args:
        cache_manager: CacheManager instance
        ttl_seconds: TTL for cached results
        key_func: Function to generate cache key from arguments
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                # Default key generation
                cache_key = {
                    "func": func.__name__,
                    "args": args,
                    "kwargs": kwargs
                }
            
            # Check cache
            cached_result = cache_manager.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Call function
            result = func(*args, **kwargs)
            
            # Cache result
            cache_manager.put(cache_key, result, ttl_seconds)
            
            return result
        
        return wrapper
    return decorator


# Singleton instances
_cache_manager = None
_multi_level_cache = None


def get_cache_manager() -> CacheManager:
    """Get or create singleton cache manager"""
    global _cache_manager
    if _cache_manager is None:
        from local_model_config import CACHE_CONFIG
        
        inference_config = CACHE_CONFIG.get("inference_cache", {})
        _cache_manager = CacheManager(
            max_size_mb=inference_config.get("size_mb", 1000),
            default_ttl_seconds=inference_config.get("ttl_minutes", 120) * 60,
            enable_persistence=inference_config.get("enable_persistence", True),
            persistence_path=inference_config.get("persistence_path", "./cache/inference")
        )
    
    return _cache_manager


def get_multi_level_cache() -> MultiLevelCache:
    """Get or create singleton multi-level cache"""
    global _multi_level_cache
    if _multi_level_cache is None:
        _multi_level_cache = MultiLevelCache()
    
    return _multi_level_cache
