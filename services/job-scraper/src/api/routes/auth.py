"""
Authentication API routes for user login, signup, and management.
Supports JWT tokens and plan-based access control.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, status, Response, Cookie
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, validator
from datetime import datetime, timedelta
import jwt
import hashlib
import secrets
import asyncio

from src.config.settings import settings
from src.config.sentry import capture_api_error, add_scraping_breadcrumb
from src.utils.database import get_database
from src.utils.cache import get_cache_manager

router = APIRouter()
security = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    """Login request model."""
    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    """Signup request model."""
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        return v


class UserResponse(BaseModel):
    """User response model."""
    id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    plan: str = "free"
    created_at: datetime
    quotas: Dict[str, Any] = {}
    preferences: Dict[str, Any] = {}
    is_active: bool = True


class TokenResponse(BaseModel):
    """Token response model."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=7)  # 7 days default
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm="HS256")
    return encoded_jwt


def hash_password(password: str) -> str:
    """Hash password using SHA256."""
    salt = settings.password_salt.encode()
    return hashlib.pbkdf2_hex(password.encode(), salt, 100000, dklen=32)


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    return hash_password(password) == hashed_password


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db=Depends(get_database)
) -> Optional[Dict[str, Any]]:
    """Get current authenticated user from JWT token."""
    if not credentials:
        return None
    
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret_key, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        
        if user_id is None:
            return None
            
        # Get user from database
        user = await db.execute(
            "SELECT * FROM users WHERE id = ? AND is_active = 1", 
            (user_id,)
        )
        
        if not user:
            return None
            
        return user[0] if user else None
        
    except jwt.PyJWTError:
        return None


@router.post("/signup", response_model=dict, tags=["Authentication"])
async def signup(
    user_data: SignupRequest,
    db=Depends(get_database)
):
    """
    Create a new user account with FREE plan by default.
    """
    try:
        add_scraping_breadcrumb("User signup initiated", data={"email": user_data.email})
        
        # Check if user already exists
        existing_user = await db.execute(
            "SELECT id FROM users WHERE email = ?", 
            (user_data.email,)
        )
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )
        
        # Hash password
        hashed_password = hash_password(user_data.password)
        
        # Create user with FREE plan and default quotas
        user_id = secrets.token_urlsafe(16)
        
        await db.execute("""
            INSERT INTO users (
                id, email, password_hash, first_name, last_name, 
                plan, created_at, is_active, quotas, preferences
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            user_data.email,
            hashed_password,
            user_data.first_name,
            user_data.last_name,
            "free",
            datetime.utcnow(),
            True,
            '{"autoApplicationsUsed": 0}',  # JSON string
            '{}'  # Empty preferences
        ))
        
        add_scraping_breadcrumb("User created successfully", data={"user_id": user_id})
        
        return {"message": "Account created successfully. Please log in."}
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint="/auth/signup", method="POST")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create account"
        )


@router.post("/login", response_model=TokenResponse, tags=["Authentication"])
async def login(
    response: Response,
    user_data: LoginRequest,
    db=Depends(get_database)
):
    """
    Authenticate user and return JWT token.
    """
    try:
        add_scraping_breadcrumb("User login attempted", data={"email": user_data.email})
        
        # Get user from database
        user_result = await db.execute(
            "SELECT * FROM users WHERE email = ? AND is_active = 1",
            (user_data.email,)
        )
        
        if not user_result:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        user = user_result[0]
        
        # Verify password
        if not verify_password(user_data.password, user['password_hash']):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Create access token
        access_token = create_access_token(
            data={"sub": user['id']},
            expires_delta=timedelta(days=7)
        )
        
        # Parse quotas and preferences JSON
        import json
        quotas = json.loads(user.get('quotas', '{}'))
        preferences = json.loads(user.get('preferences', '{}'))
        
        user_response = UserResponse(
            id=user['id'],
            email=user['email'],
            first_name=user.get('first_name'),
            last_name=user.get('last_name'),
            plan=user['plan'],
            created_at=user['created_at'],
            quotas=quotas,
            preferences=preferences,
            is_active=user['is_active']
        )
        
        # Set HTTP-only cookie for web app
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=settings.environment == "production",
            samesite="lax",
            max_age=7 * 24 * 60 * 60  # 7 days
        )
        
        add_scraping_breadcrumb("User logged in successfully", data={"user_id": user['id']})
        
        return TokenResponse(
            access_token=access_token,
            user=user_response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint="/auth/login", method="POST")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )


@router.post("/logout", tags=["Authentication"])
async def logout(response: Response):
    """
    Log out user by clearing the authentication cookie.
    """
    response.delete_cookie(key="access_token")
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse, tags=["Authentication"])
async def get_current_user_info(
    current_user: dict = Depends(get_current_user)
):
    """
    Get current authenticated user information.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    import json
    quotas = json.loads(current_user.get('quotas', '{}'))
    preferences = json.loads(current_user.get('preferences', '{}'))
    
    return UserResponse(
        id=current_user['id'],
        email=current_user['email'],
        first_name=current_user.get('first_name'),
        last_name=current_user.get('last_name'),
        plan=current_user['plan'],
        created_at=current_user['created_at'],
        quotas=quotas,
        preferences=preferences,
        is_active=current_user['is_active']
    )


@router.put("/me", response_model=UserResponse, tags=["Authentication"])
async def update_user_profile(
    user_updates: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Update current user profile information.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    try:
        # Build update query dynamically
        allowed_fields = ['first_name', 'last_name', 'preferences']
        updates = []
        params = []
        
        for field, value in user_updates.items():
            if field in allowed_fields:
                if field == 'preferences':
                    import json
                    value = json.dumps(value)
                updates.append(f"{field} = ?")
                params.append(value)
        
        if not updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid fields to update"
            )
        
        params.append(current_user['id'])
        
        await db.execute(
            f"UPDATE users SET {', '.join(updates)} WHERE id = ?",
            tuple(params)
        )
        
        # Get updated user
        updated_user = await db.execute(
            "SELECT * FROM users WHERE id = ?",
            (current_user['id'],)
        )
        
        if updated_user:
            user = updated_user[0]
            import json
            quotas = json.loads(user.get('quotas', '{}'))
            preferences = json.loads(user.get('preferences', '{}'))
            
            return UserResponse(
                id=user['id'],
                email=user['email'],
                first_name=user.get('first_name'),
                last_name=user.get('last_name'),
                plan=user['plan'],
                created_at=user['created_at'],
                quotas=quotas,
                preferences=preferences,
                is_active=user['is_active']
            )
        
        raise HTTPException(status_code=404, detail="User not found")
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint="/auth/me", method="PUT")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )
