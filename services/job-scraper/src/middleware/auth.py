"""
Authentication middleware for API security and user tier management.
"""

import jwt
from typing import Optional, Dict, Any
from fastapi import HTTPException, status, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime, timedelta
import time

from src.config.settings import settings
from src.config.sentry import capture_api_error, add_scraping_breadcrumb, set_scraping_user_context
from src.utils.cache import get_cache_manager

# JWT Secret - in production, this should come from environment
JWT_SECRET = "your-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"

security = HTTPBearer()


class UserTier:
    """User tier definitions with feature access levels."""
    BASIC = "basic"
    PROFESSIONAL = "professional"
    EXECUTIVE = "executive"
    ENTERPRISE = "enterprise"
    ADMIN = "admin"


class TierFeatures:
    """Feature access mapping by tier."""
    TIER_FEATURES = {
        UserTier.BASIC: {
            "monthly_applications": (2, 8),
            "features": ["job_matching", "basic_search"],
            "api_rate_limit": 100,  # requests per hour
            "advanced_search": False,
            "ai_insights": False,
            "export_data": False
        },
        UserTier.PROFESSIONAL: {
            "monthly_applications": (8, 20),
            "features": ["salary_benchmarking", "analytics", "advanced_search", "ai_insights"],
            "api_rate_limit": 500,
            "advanced_search": True,
            "ai_insights": True,
            "export_data": True
        },
        UserTier.EXECUTIVE: {
            "monthly_applications": (20, 50),
            "features": [
                "networking_events", "company_research", "leadership_assessments",
                "headhunter_visibility", "interview_scheduling", "reference_management",
                "market_intelligence"
            ],
            "api_rate_limit": 1000,
            "advanced_search": True,
            "ai_insights": True,
            "export_data": True
        },
        UserTier.ENTERPRISE: {
            "monthly_applications": (50, None),
            "features": [
                "personal_brand_audit", "career_trajectory", "industry_intelligence",
                "mock_interviews", "hidden_job_market", "executive_search",
                "market_analytics", "bulk_operations", "api_access"
            ],
            "api_rate_limit": 5000,
            "advanced_search": True,
            "ai_insights": True,
            "export_data": True
        },
        UserTier.ADMIN: {
            "monthly_applications": (None, None),
            "features": ["all"],
            "api_rate_limit": None,
            "advanced_search": True,
            "ai_insights": True,
            "export_data": True
        }
    }

    @classmethod
    def has_feature(cls, tier: str, feature: str) -> bool:
        """Check if a tier has access to a specific feature."""
        tier_config = cls.TIER_FEATURES.get(tier, {})
        features = tier_config.get("features", [])
        return "all" in features or feature in features

    @classmethod
    def get_rate_limit(cls, tier: str) -> Optional[int]:
        """Get API rate limit for a tier."""
        return cls.TIER_FEATURES.get(tier, {}).get("api_rate_limit")


class JWTAuth:
    """JWT authentication handler."""
    
    @staticmethod
    def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token."""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(hours=24)
        
        to_encode.update({"exp": expire, "type": "access"})
        encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
        return encoded_jwt
    
    @staticmethod
    def create_api_key(user_id: str, tier: str, expires_delta: Optional[timedelta] = None) -> str:
        """Create long-term API key."""
        to_encode = {
            "user_id": user_id,
            "tier": tier,
            "type": "api_key",
            "created_at": time.time()
        }
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(days=365)  # 1 year default
        
        to_encode["exp"] = expire.timestamp()
        encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
        return encoded_jwt
    
    @staticmethod
    def decode_token(token: str) -> Dict[str, Any]:
        """Decode and validate JWT token."""
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )


class AuthenticatedUser:
    """Authenticated user context."""
    
    def __init__(self, user_id: str, tier: str, token_type: str = "access", **kwargs):
        self.user_id = user_id
        self.tier = tier
        self.token_type = token_type
        self.features = TierFeatures.TIER_FEATURES.get(tier, {}).get("features", [])
        self.rate_limit = TierFeatures.get_rate_limit(tier)
        
        # Additional user data
        for key, value in kwargs.items():
            setattr(self, key, value)
    
    def has_feature(self, feature: str) -> bool:
        """Check if user has access to a feature."""
        return TierFeatures.has_feature(self.tier, feature)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "user_id": self.user_id,
            "tier": self.tier,
            "token_type": self.token_type,
            "features": self.features,
            "rate_limit": self.rate_limit
        }


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = security
) -> AuthenticatedUser:
    """Get current authenticated user from JWT token."""
    try:
        # Decode token
        payload = JWTAuth.decode_token(credentials.credentials)
        
        # Extract user information
        user_id = payload.get("user_id")
        tier = payload.get("tier", UserTier.BASIC)
        token_type = payload.get("type", "access")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        
        # Create authenticated user
        user = AuthenticatedUser(
            user_id=user_id,
            tier=tier,
            token_type=token_type,
            **{k: v for k, v in payload.items() if k not in ["user_id", "tier", "type", "exp", "iat"]}
        )
        
        # Set user context for Sentry
        set_scraping_user_context(
            user_id=user_id,
            user_type="authenticated",
            additional_data={"tier": tier, "token_type": token_type}
        )
        
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint="auth_middleware", method="GET")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )


async def get_optional_user(request: Request) -> Optional[AuthenticatedUser]:
    """Get authenticated user if present, None otherwise."""
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        
        token = auth_header.split(" ")[1]
        payload = JWTAuth.decode_token(token)
        
        user_id = payload.get("user_id")
        tier = payload.get("tier", UserTier.BASIC)
        token_type = payload.get("type", "access")
        
        if not user_id:
            return None
        
        return AuthenticatedUser(
            user_id=user_id,
            tier=tier,
            token_type=token_type,
            **{k: v for k, v in payload.items() if k not in ["user_id", "tier", "type", "exp", "iat"]}
        )
        
    except Exception:
        return None


def require_tier(minimum_tier: str):
    """Decorator to require minimum user tier."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Extract user from kwargs (assuming it's passed as dependency)
            user = None
            for arg in args:
                if isinstance(arg, AuthenticatedUser):
                    user = arg
                    break
            
            if not user:
                for value in kwargs.values():
                    if isinstance(value, AuthenticatedUser):
                        user = value
                        break
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Define tier hierarchy
            tier_hierarchy = [
                UserTier.BASIC,
                UserTier.PROFESSIONAL,
                UserTier.EXECUTIVE,
                UserTier.ENTERPRISE,
                UserTier.ADMIN
            ]
            
            if user.tier not in tier_hierarchy:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invalid user tier"
                )
            
            user_tier_level = tier_hierarchy.index(user.tier)
            required_tier_level = tier_hierarchy.index(minimum_tier)
            
            if user_tier_level < required_tier_level:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"This feature requires {minimum_tier} tier or higher"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def require_feature(feature: str):
    """Decorator to require specific feature access."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Extract user from kwargs
            user = None
            for arg in args:
                if isinstance(arg, AuthenticatedUser):
                    user = arg
                    break
            
            if not user:
                for value in kwargs.values():
                    if isinstance(value, AuthenticatedUser):
                        user = value
                        break
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            if not user.has_feature(feature):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access to '{feature}' requires a higher tier subscription"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


class AuthMiddleware(BaseHTTPMiddleware):
    """Authentication middleware for automatic user detection."""
    
    async def dispatch(self, request: Request, call_next):
        """Process request and add user context if available."""
        start_time = time.time()
        
        try:
            # Add user context to request if authenticated
            user = await get_optional_user(request)
            if user:
                request.state.user = user
                add_scraping_breadcrumb(
                    f"Authenticated user: {user.user_id}",
                    data={"tier": user.tier, "token_type": user.token_type}
                )
            
            # Process request
            response = await call_next(request)
            
            # Add timing header
            process_time = time.time() - start_time
            response.headers["X-Process-Time"] = str(process_time)
            
            # Add user tier to response headers (if authenticated)
            if user:
                response.headers["X-User-Tier"] = user.tier
            
            return response
            
        except Exception as e:
            capture_api_error(e, endpoint=str(request.url.path), method=request.method)
            raise


# Dependency functions for FastAPI
async def get_authenticated_user(
    credentials: HTTPAuthorizationCredentials = security
) -> AuthenticatedUser:
    """Dependency to get authenticated user (required)."""
    return await get_current_user(credentials)


async def get_optional_authenticated_user(request: Request) -> Optional[AuthenticatedUser]:
    """Dependency to get authenticated user (optional)."""
    return getattr(request.state, "user", None)


# API Key authentication for service-to-service communication
async def get_api_key_user(
    credentials: HTTPAuthorizationCredentials = security
) -> AuthenticatedUser:
    """Get user from API key token."""
    try:
        payload = JWTAuth.decode_token(credentials.credentials)
        
        if payload.get("type") != "api_key":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type for API access"
            )
        
        user_id = payload.get("user_id")
        tier = payload.get("tier", UserTier.BASIC)
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key"
            )
        
        return AuthenticatedUser(
            user_id=user_id,
            tier=tier,
            token_type="api_key",
            **{k: v for k, v in payload.items() if k not in ["user_id", "tier", "type", "exp", "iat"]}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint="api_key_auth", method="GET")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key authentication failed"
        )
