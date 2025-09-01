"""
Advanced cache manager with Redis support and intelligent caching strategies.
"""

import json
import pickle
import hashlib
from typing import Any, Optional, List, Dict, Union
from datetime import datetime, timedelta
import redis.asyncio as redis
import asyncio

from src.config.settings import settings
from src.config.sentry import capture_api_error, add_scraping_breadcrumb


class CacheManager:
    """Redis-based cache manager with fallback to memory storage."""
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.memory_cache: Dict[str, Dict] = {}  # Fallback storage
        self._initialized = False
        
        # Cache configuration
        self.default_ttl = 3600  # 1 hour
        self.max_memory_items = 1000  # Limit memory cache size
    
    async def connect(self):
        """Initialize Redis connection."""
        if self._initialized:
            return
        
        try:
            # Connect to Redis
            self.redis_client = redis.from_url(
                settings.redis_url,
                password=settings.redis_password,
                decode_responses=False,  # Handle binary data
                retry_on_timeout=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
                socket_keepalive_options={}
            )
            
            # Test connection
            await self.redis_client.ping()
            
            self._initialized = True
            add_scraping_breadcrumb("Cache manager initialized with Redis")
            
        except Exception as e:
            add_scraping_breadcrumb(f"Redis connection failed, using memory cache: {str(e)}")
            self.redis_client = None
            self._initialized = True
    
    async def disconnect(self):
        """Close Redis connection."""
        if self.redis_client:
            await self.redis_client.close()
        self._initialized = False
        add_scraping_breadcrumb("Cache manager disconnected")
    
    def _serialize_value(self, value: Any) -> bytes:
        """Serialize value for storage."""
        try:
            # Try JSON first (more readable)
            if isinstance(value, (dict, list, str, int, float, bool)) or value is None:
                return json.dumps(value, default=str).encode('utf-8')
            else:
                # Fall back to pickle for complex objects
                return pickle.dumps(value)
        except Exception:
            return pickle.dumps(value)
    
    def _deserialize_value(self, data: bytes) -> Any:
        """Deserialize value from storage."""
        try:
            # Try JSON first
            return json.loads(data.decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            try:
                # Fall back to pickle
                return pickle.loads(data)
            except Exception:
                return None
    
    def _generate_key(self, key: str, prefix: str = "scraper") -> str:
        """Generate cache key with prefix."""
        return f"{prefix}:{key}"
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        prefix: str = "scraper"
    ) -> bool:
        """Set cache value with TTL."""
        if not self._initialized:
            await self.connect()
        
        full_key = self._generate_key(key, prefix)
        ttl = ttl or self.default_ttl
        
        try:
            if self.redis_client:
                # Use Redis
                serialized_value = self._serialize_value(value)
                await self.redis_client.setex(full_key, ttl, serialized_value)
                return True
            else:
                # Use memory cache
                self._manage_memory_cache_size()
                self.memory_cache[full_key] = {
                    "value": value,
                    "expires_at": datetime.utcnow() + timedelta(seconds=ttl)
                }
                return True
                
        except Exception as e:
            capture_api_error(e, endpoint="cache_set", method="INTERNAL")
            return False
    
    async def get(self, key: str, prefix: str = "scraper") -> Any:
        """Get cache value."""
        if not self._initialized:
            await self.connect()
        
        full_key = self._generate_key(key, prefix)
        
        try:
            if self.redis_client:
                # Use Redis
                data = await self.redis_client.get(full_key)
                if data:
                    return self._deserialize_value(data)
                return None
            else:
                # Use memory cache
                if full_key in self.memory_cache:
                    cached_item = self.memory_cache[full_key]
                    if datetime.utcnow() < cached_item["expires_at"]:
                        return cached_item["value"]
                    else:
                        # Remove expired item
                        del self.memory_cache[full_key]
                return None
                
        except Exception as e:
            capture_api_error(e, endpoint="cache_get", method="INTERNAL")
            return None
    
    async def delete(self, key: str, prefix: str = "scraper") -> bool:
        """Delete cache value."""
        if not self._initialized:
            await self.connect()
        
        full_key = self._generate_key(key, prefix)
        
        try:
            if self.redis_client:
                result = await self.redis_client.delete(full_key)
                return result > 0
            else:
                if full_key in self.memory_cache:
                    del self.memory_cache[full_key]
                    return True
                return False
                
        except Exception as e:
            capture_api_error(e, endpoint="cache_delete", method="INTERNAL")
            return False
    
    async def delete_pattern(self, pattern: str, prefix: str = "scraper") -> int:
        """Delete multiple keys matching pattern."""
        if not self._initialized:
            await self.connect()
        
        full_pattern = self._generate_key(pattern, prefix)
        deleted_count = 0
        
        try:
            if self.redis_client:
                # Get matching keys
                keys = await self.redis_client.keys(full_pattern)
                if keys:
                    deleted_count = await self.redis_client.delete(*keys)
            else:
                # Memory cache pattern matching
                keys_to_delete = [
                    key for key in self.memory_cache.keys()
                    if self._matches_pattern(key, full_pattern)
                ]
                for key in keys_to_delete:
                    del self.memory_cache[key]
                deleted_count = len(keys_to_delete)
                
            return deleted_count
            
        except Exception as e:
            capture_api_error(e, endpoint="cache_delete_pattern", method="INTERNAL")
            return 0
    
    def _matches_pattern(self, key: str, pattern: str) -> bool:
        """Simple pattern matching for memory cache."""
        # Replace * with regex equivalent
        import re
        regex_pattern = pattern.replace("*", ".*")
        return bool(re.match(regex_pattern, key))
    
    async def exists(self, key: str, prefix: str = "scraper") -> bool:
        """Check if key exists in cache."""
        value = await self.get(key, prefix)
        return value is not None
    
    async def ttl(self, key: str, prefix: str = "scraper") -> int:
        """Get TTL for key."""
        if not self._initialized:
            await self.connect()
        
        full_key = self._generate_key(key, prefix)
        
        try:
            if self.redis_client:
                return await self.redis_client.ttl(full_key)
            else:
                if full_key in self.memory_cache:
                    cached_item = self.memory_cache[full_key]
                    remaining = cached_item["expires_at"] - datetime.utcnow()
                    return int(remaining.total_seconds())
                return -2  # Key doesn't exist
                
        except Exception as e:
            capture_api_error(e, endpoint="cache_ttl", method="INTERNAL")
            return -1
    
    async def increment(
        self,
        key: str,
        amount: int = 1,
        prefix: str = "scraper",
        ttl: Optional[int] = None
    ) -> int:
        """Increment numeric value."""
        if not self._initialized:
            await self.connect()
        
        full_key = self._generate_key(key, prefix)
        
        try:
            if self.redis_client:
                # Use Redis atomic increment
                result = await self.redis_client.incrby(full_key, amount)
                if ttl:
                    await self.redis_client.expire(full_key, ttl)
                return result
            else:
                # Memory cache increment
                current_value = await self.get(key, prefix) or 0
                new_value = current_value + amount
                await self.set(key, new_value, ttl, prefix)
                return new_value
                
        except Exception as e:
            capture_api_error(e, endpoint="cache_increment", method="INTERNAL")
            return 0
    
    async def set_multiple(
        self,
        items: Dict[str, Any],
        ttl: Optional[int] = None,
        prefix: str = "scraper"
    ) -> bool:
        """Set multiple cache values."""
        try:
            if self.redis_client:
                # Use Redis pipeline for efficiency
                pipe = self.redis_client.pipeline()
                
                for key, value in items.items():
                    full_key = self._generate_key(key, prefix)
                    serialized_value = self._serialize_value(value)
                    pipe.setex(full_key, ttl or self.default_ttl, serialized_value)
                
                await pipe.execute()
                return True
            else:
                # Memory cache
                for key, value in items.items():
                    await self.set(key, value, ttl, prefix)
                return True
                
        except Exception as e:
            capture_api_error(e, endpoint="cache_set_multiple", method="INTERNAL")
            return False
    
    async def get_multiple(
        self,
        keys: List[str],
        prefix: str = "scraper"
    ) -> Dict[str, Any]:
        """Get multiple cache values."""
        result = {}
        
        try:
            if self.redis_client:
                # Use Redis pipeline
                full_keys = [self._generate_key(key, prefix) for key in keys]
                values = await self.redis_client.mget(full_keys)
                
                for i, value in enumerate(values):
                    if value:
                        result[keys[i]] = self._deserialize_value(value)
                    else:
                        result[keys[i]] = None
            else:
                # Memory cache
                for key in keys:
                    result[key] = await self.get(key, prefix)
            
            return result
            
        except Exception as e:
            capture_api_error(e, endpoint="cache_get_multiple", method="INTERNAL")
            return {key: None for key in keys}
    
    def _manage_memory_cache_size(self):
        """Manage memory cache size to prevent memory issues."""
        if len(self.memory_cache) >= self.max_memory_items:
            # Remove expired items first
            current_time = datetime.utcnow()
            expired_keys = [
                key for key, item in self.memory_cache.items()
                if current_time >= item["expires_at"]
            ]
            
            for key in expired_keys:
                del self.memory_cache[key]
            
            # If still too many items, remove oldest ones
            if len(self.memory_cache) >= self.max_memory_items:
                # Sort by expiration time and remove oldest
                sorted_items = sorted(
                    self.memory_cache.items(),
                    key=lambda x: x[1]["expires_at"]
                )
                
                items_to_remove = len(sorted_items) - self.max_memory_items + 100
                for i in range(items_to_remove):
                    key = sorted_items[i][0]
                    del self.memory_cache[key]
    
    async def clear_all(self, prefix: str = "scraper") -> bool:
        """Clear all cache entries with prefix."""
        try:
            if self.redis_client:
                pattern = f"{prefix}:*"
                keys = await self.redis_client.keys(pattern)
                if keys:
                    await self.redis_client.delete(*keys)
            else:
                # Clear memory cache
                keys_to_delete = [
                    key for key in self.memory_cache.keys()
                    if key.startswith(f"{prefix}:")
                ]
                for key in keys_to_delete:
                    del self.memory_cache[key]
            
            return True
            
        except Exception as e:
            capture_api_error(e, endpoint="cache_clear_all", method="INTERNAL")
            return False
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        stats = {"type": "memory" if self.redis_client is None else "redis"}
        
        try:
            if self.redis_client:
                info = await self.redis_client.info()
                stats.update({
                    "connected_clients": info.get("connected_clients", 0),
                    "used_memory": info.get("used_memory_human", "unknown"),
                    "keyspace_hits": info.get("keyspace_hits", 0),
                    "keyspace_misses": info.get("keyspace_misses", 0),
                })
            else:
                # Memory cache stats
                current_time = datetime.utcnow()
                expired_count = sum(
                    1 for item in self.memory_cache.values()
                    if current_time >= item["expires_at"]
                )
                
                stats.update({
                    "total_keys": len(self.memory_cache),
                    "expired_keys": expired_count,
                    "active_keys": len(self.memory_cache) - expired_count,
                    "max_items": self.max_memory_items
                })
            
            return stats
            
        except Exception as e:
            capture_api_error(e, endpoint="cache_get_stats", method="INTERNAL")
            return {"error": str(e)}
    
    async def ping(self) -> bool:
        """Test cache connectivity."""
        try:
            if self.redis_client:
                await self.redis_client.ping()
                return True
            else:
                # Memory cache is always available
                return True
        except Exception:
            return False


# Global cache manager instance
_cache_manager: Optional[CacheManager] = None


async def get_cache_manager() -> CacheManager:
    """Get cache manager instance for dependency injection."""
    global _cache_manager
    
    if _cache_manager is None:
        _cache_manager = CacheManager()
        await _cache_manager.connect()
    
    return _cache_manager


# Utility functions for common caching patterns
async def cached_function(
    cache_key: str,
    func,
    ttl: int = 3600,
    prefix: str = "func"
):
    """Decorator-like function for caching expensive operations."""
    cache = await get_cache_manager()
    
    # Try to get from cache first
    cached_result = await cache.get(cache_key, prefix)
    if cached_result is not None:
        return cached_result
    
    # Execute function and cache result
    result = await func() if asyncio.iscoroutinefunction(func) else func()
    await cache.set(cache_key, result, ttl, prefix)
    
    return result


def cache_key_generator(*args, **kwargs) -> str:
    """Generate cache key from arguments."""
    # Create deterministic hash from arguments
    key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
    return hashlib.md5(key_data.encode()).hexdigest()
