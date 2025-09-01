"""
Advanced rate limiting middleware with tier-based limits and intelligent throttling.
"""

import time
import asyncio
from typing import Dict, Optional, Tuple, Any
from fastapi import HTTPException, status, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime, timedelta
import redis.asyncio as redis
import hashlib
import json

from src.config.settings import settings
from src.config.sentry import capture_api_error, add_scraping_breadcrumb
from src.middleware.auth import AuthenticatedUser, UserTier


class RateLimitExceeded(HTTPException):
    """Custom exception for rate limit exceeded."""
    
    def __init__(self, limit: int, window: int, retry_after: int):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Limit: {limit} requests per {window} seconds",
            headers={"Retry-After": str(retry_after)}
        )


class RateLimiter:
    """Redis-based rate limiter with sliding window."""
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.fallback_storage: Dict[str, Dict] = {}  # In-memory fallback
        
    async def initialize(self):
        """Initialize Redis connection."""
        try:
            self.redis_client = redis.from_url(
                settings.redis_url,
                password=settings.redis_password,
                decode_responses=True
            )
            await self.redis_client.ping()
            add_scraping_breadcrumb("Rate limiter initialized with Redis")
        except Exception as e:
            add_scraping_breadcrumb(f"Redis connection failed, using in-memory storage: {str(e)}")
            self.redis_client = None
    
    async def is_allowed(
        self,
        key: str,
        limit: int,
        window: int,
        identifier: str = None
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Check if request is allowed under rate limit.
        
        Args:
            key: Unique identifier for rate limiting
            limit: Number of requests allowed
            window: Time window in seconds
            identifier: Optional identifier for logging
        
        Returns:
            (is_allowed, metadata)
        """
        current_time = time.time()
        
        if self.redis_client:
            return await self._check_redis_limit(key, limit, window, current_time, identifier)
        else:
            return await self._check_memory_limit(key, limit, window, current_time, identifier)
    
    async def _check_redis_limit(
        self,
        key: str,
        limit: int,
        window: int,
        current_time: float,
        identifier: str = None
    ) -> Tuple[bool, Dict[str, Any]]:
        """Check rate limit using Redis sliding window."""
        try:
            pipe = self.redis_client.pipeline()
            
            # Remove expired entries
            pipe.zremrangebyscore(key, 0, current_time - window)
            
            # Count current requests
            pipe.zcard(key)
            
            # Add current request
            pipe.zadd(key, {str(current_time): current_time})
            
            # Set expiration
            pipe.expire(key, window)
            
            results = await pipe.execute()
            current_count = results[1]
            
            # Check if limit exceeded
            if current_count >= limit:
                # Remove the request we just added since it's not allowed
                await self.redis_client.zrem(key, str(current_time))
                
                # Calculate retry after
                oldest_request = await self.redis_client.zrange(key, 0, 0, withscores=True)
                retry_after = window
                if oldest_request:
                    retry_after = int(window - (current_time - oldest_request[0][1]))
                
                return False, {
                    "current_count": current_count,
                    "limit": limit,
                    "window": window,
                    "retry_after": max(1, retry_after),
                    "identifier": identifier
                }
            
            return True, {
                "current_count": current_count + 1,
                "limit": limit,
                "window": window,
                "remaining": limit - current_count - 1,
                "identifier": identifier
            }
            
        except Exception as e:
            add_scraping_breadcrumb(f"Redis rate limit check failed: {str(e)}")
            # Fall back to memory-based limiting
            return await self._check_memory_limit(key, limit, window, current_time, identifier)
    
    async def _check_memory_limit(
        self,
        key: str,
        limit: int,
        window: int,
        current_time: float,
        identifier: str = None
    ) -> Tuple[bool, Dict[str, Any]]:
        """Check rate limit using in-memory storage."""
        if key not in self.fallback_storage:
            self.fallback_storage[key] = {"requests": [], "last_cleanup": current_time}
        
        storage = self.fallback_storage[key]
        
        # Clean up old requests periodically
        if current_time - storage["last_cleanup"] > 60:  # Cleanup every minute
            storage["requests"] = [
                req_time for req_time in storage["requests"]
                if current_time - req_time < window
            ]
            storage["last_cleanup"] = current_time
        
        # Remove expired requests
        storage["requests"] = [
            req_time for req_time in storage["requests"]
            if current_time - req_time < window
        ]
        
        current_count = len(storage["requests"])
        
        if current_count >= limit:
            oldest_request = min(storage["requests"]) if storage["requests"] else current_time
            retry_after = int(window - (current_time - oldest_request))
            
            return False, {
                "current_count": current_count,
                "limit": limit,
                "window": window,
                "retry_after": max(1, retry_after),
                "identifier": identifier
            }
        
        # Add current request
        storage["requests"].append(current_time)
        
        return True, {
            "current_count": current_count + 1,
            "limit": limit,
            "window": window,
            "remaining": limit - current_count - 1,
            "identifier": identifier
        }
    
    async def get_usage_stats(self, key: str, window: int) -> Dict[str, Any]:
        """Get current usage statistics for a key."""
        current_time = time.time()
        
        if self.redis_client:
            try:
                # Count requests in current window
                count = await self.redis_client.zcount(
                    key,
                    current_time - window,
                    current_time
                )
                
                return {
                    "current_count": count,
                    "window": window,
                    "timestamp": current_time
                }
            except Exception:
                pass
        
        # Fallback to memory storage
        if key in self.fallback_storage:
            storage = self.fallback_storage[key]
            valid_requests = [
                req_time for req_time in storage["requests"]
                if current_time - req_time < window
            ]
            
            return {
                "current_count": len(valid_requests),
                "window": window,
                "timestamp": current_time
            }
        
        return {"current_count": 0, "window": window, "timestamp": current_time}


class TierBasedRateLimiter:
    """Rate limiter with user tier-based limits."""
    
    def __init__(self):
        self.rate_limiter = RateLimiter()
        
        # Default rate limits by tier (requests per hour)
        self.tier_limits = {
            UserTier.BASIC: {"limit": 100, "window": 3600},        # 100/hour
            UserTier.PROFESSIONAL: {"limit": 500, "window": 3600},  # 500/hour
            UserTier.EXECUTIVE: {"limit": 1000, "window": 3600},    # 1000/hour
            UserTier.ENTERPRISE: {"limit": 5000, "window": 3600},   # 5000/hour
            UserTier.ADMIN: {"limit": 10000, "window": 3600},       # 10000/hour
        }
        
        # Endpoint-specific limits
        self.endpoint_limits = {
            "/api/v1/search/semantic": {"multiplier": 0.5},  # More expensive
            "/api/v1/jobs/analytics": {"multiplier": 0.3},   # Very expensive
            "/api/v1/companies/culture": {"multiplier": 0.4}, # Expensive
            "/health": {"limit": None},  # No limits on health checks
        }
        
        # Anonymous user limits
        self.anonymous_limits = {"limit": 20, "window": 3600}  # 20/hour
    
    async def initialize(self):
        """Initialize the rate limiter."""
        await self.rate_limiter.initialize()
    
    def _get_rate_limit_config(
        self,
        user: Optional[AuthenticatedUser],
        endpoint: str
    ) -> Dict[str, Any]:
        """Get rate limit configuration for user and endpoint."""
        
        # Check if endpoint has no limits
        endpoint_config = self.endpoint_limits.get(endpoint, {})
        if endpoint_config.get("limit") is None:
            return {"limit": None, "window": 0}
        
        # Get base limits
        if user and user.tier:
            base_config = self.tier_limits.get(user.tier, self.tier_limits[UserTier.BASIC])
        else:
            base_config = self.anonymous_limits
        
        limit = base_config["limit"]
        window = base_config["window"]
        
        # Apply endpoint-specific multipliers
        multiplier = endpoint_config.get("multiplier", 1.0)
        if multiplier != 1.0:
            limit = int(limit * multiplier)
        
        # Apply custom endpoint limits
        if "limit" in endpoint_config:
            limit = endpoint_config["limit"]
        if "window" in endpoint_config:
            window = endpoint_config["window"]
        
        return {"limit": limit, "window": window}
    
    def _generate_rate_limit_key(
        self,
        request: Request,
        user: Optional[AuthenticatedUser]
    ) -> str:
        """Generate unique rate limit key."""
        if user:
            base_key = f"rl:user:{user.user_id}:{user.tier}"
        else:
            # Use IP address for anonymous users
            client_ip = self._get_client_ip(request)
            base_key = f"rl:ip:{client_ip}"
        
        # Add endpoint to key for endpoint-specific limits
        endpoint = request.url.path
        if endpoint in self.endpoint_limits:
            return f"{base_key}:ep:{hashlib.md5(endpoint.encode()).hexdigest()[:8]}"
        
        return base_key
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request."""
        # Check for forwarded headers first
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    async def check_rate_limit(
        self,
        request: Request,
        user: Optional[AuthenticatedUser] = None
    ) -> Tuple[bool, Dict[str, Any]]:
        """Check if request is within rate limits."""
        
        # Get rate limit configuration
        config = self._get_rate_limit_config(user, request.url.path)
        
        # Skip rate limiting if no limit set
        if config["limit"] is None:
            return True, {"unlimited": True}
        
        # Generate rate limit key
        key = self._generate_rate_limit_key(request, user)
        
        # Check rate limit
        identifier = user.user_id if user else self._get_client_ip(request)
        
        is_allowed, metadata = await self.rate_limiter.is_allowed(
            key=key,
            limit=config["limit"],
            window=config["window"],
            identifier=identifier
        )
        
        # Add configuration to metadata
        metadata.update({
            "tier": user.tier if user else "anonymous",
            "endpoint": request.url.path,
            "config": config
        })
        
        return is_allowed, metadata
    
    async def get_user_usage_stats(
        self,
        user: AuthenticatedUser,
        endpoint: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get usage statistics for a user."""
        stats = {}
        
        # Get overall stats
        base_key = f"rl:user:{user.user_id}:{user.tier}"
        overall_config = self.tier_limits.get(user.tier, self.tier_limits[UserTier.BASIC])
        overall_stats = await self.rate_limiter.get_usage_stats(
            base_key,
            overall_config["window"]
        )
        stats["overall"] = {**overall_stats, "config": overall_config}
        
        # Get endpoint-specific stats if requested
        if endpoint and endpoint in self.endpoint_limits:
            endpoint_key = f"{base_key}:ep:{hashlib.md5(endpoint.encode()).hexdigest()[:8]}"
            endpoint_config = self._get_rate_limit_config(user, endpoint)
            endpoint_stats = await self.rate_limiter.get_usage_stats(
                endpoint_key,
                endpoint_config["window"]
            )
            stats["endpoint"] = {**endpoint_stats, "config": endpoint_config}
        
        return stats


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware for FastAPI."""
    
    def __init__(self, app):
        super().__init__(app)
        self.rate_limiter = TierBasedRateLimiter()
        self._initialized = False
    
    async def _ensure_initialized(self):
        """Ensure rate limiter is initialized."""
        if not self._initialized:
            await self.rate_limiter.initialize()
            self._initialized = True
    
    async def dispatch(self, request: Request, call_next):
        """Apply rate limiting to requests."""
        await self._ensure_initialized()
        
        start_time = time.time()
        
        try:
            # Get user context if available
            user = getattr(request.state, "user", None)
            
            # Check rate limit
            is_allowed, metadata = await self.rate_limiter.check_rate_limit(request, user)
            
            if not is_allowed:
                add_scraping_breadcrumb(
                    "Rate limit exceeded",
                    data={
                        "identifier": metadata.get("identifier"),
                        "tier": metadata.get("tier"),
                        "endpoint": metadata.get("endpoint"),
                        "current_count": metadata.get("current_count"),
                        "limit": metadata.get("limit")
                    }
                )
                
                raise RateLimitExceeded(
                    limit=metadata["limit"],
                    window=metadata["window"],
                    retry_after=metadata.get("retry_after", metadata["window"])
                )
            
            # Process request
            response = await call_next(request)
            
            # Add rate limit headers
            if not metadata.get("unlimited", False):
                response.headers["X-RateLimit-Limit"] = str(metadata["limit"])
                response.headers["X-RateLimit-Remaining"] = str(metadata.get("remaining", 0))
                response.headers["X-RateLimit-Reset"] = str(
                    int(start_time + metadata["window"])
                )
                response.headers["X-RateLimit-Window"] = str(metadata["window"])
                
                if user:
                    response.headers["X-RateLimit-Tier"] = user.tier
            
            return response
            
        except RateLimitExceeded:
            raise
        except Exception as e:
            capture_api_error(e, endpoint=str(request.url.path), method=request.method)
            # Continue processing on rate limiter errors
            return await call_next(request)


# Utility functions for manual rate limiting
async def check_custom_rate_limit(
    key: str,
    limit: int,
    window: int,
    identifier: str = None
) -> bool:
    """Check custom rate limit outside of middleware."""
    rate_limiter = RateLimiter()
    await rate_limiter.initialize()
    
    is_allowed, metadata = await rate_limiter.is_allowed(
        key=key,
        limit=limit,
        window=window,
        identifier=identifier
    )
    
    if not is_allowed:
        raise RateLimitExceeded(
            limit=metadata["limit"],
            window=metadata["window"],
            retry_after=metadata.get("retry_after", window)
        )
    
    return True


async def get_rate_limit_stats(user: AuthenticatedUser) -> Dict[str, Any]:
    """Get rate limit statistics for a user."""
    rate_limiter = TierBasedRateLimiter()
    await rate_limiter.initialize()
    return await rate_limiter.get_user_usage_stats(user)
