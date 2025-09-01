"""
Main FastAPI application for the Job Scraping Service.
"""

# Initialize Sentry BEFORE importing other modules
from src.config.sentry import init_sentry
init_sentry()

import os
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html
from typing import Dict, Any
import sentry_sdk
from src.config.sentry import (
    capture_api_error, 
    capture_processing_error,
    capture_scraping_error,
    add_scraping_breadcrumb,
    set_scraping_user_context
)

# Import API routes
from src.api.scraping_routes import router as scraping_router
from src.api.orchestrator_routes import router as orchestrator_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager."""
    
    # Startup
    add_scraping_breadcrumb("FastAPI application starting up")
    print(" Job Scraping Service starting...")
    
    # Initialize any services here
    # await initialize_database()
    # await initialize_redis()
    # await initialize_scrapers()
    
    add_scraping_breadcrumb("FastAPI application startup completed")
    print(" Job Scraping Service started successfully")
    
    yield
    
    # Shutdown
    add_scraping_breadcrumb("FastAPI application shutting down")
    print("⏹  Job Scraping Service shutting down...")
    
    # Cleanup any resources here
    # await cleanup_database()
    # await cleanup_redis()
    # await cleanup_scrapers()
    
    add_scraping_breadcrumb("FastAPI application shutdown completed")
    print(" Job Scraping Service shutdown completed")


# Create FastAPI application
app = FastAPI(
    title="AI Job Chommie - Scraping Service",
    description="Intelligent job scraping service for AI Job Chommie platform",
    version="1.0.0",
    contact={
        "name": "AI Job Chommie Team",
        "email": "support@aijobchommie.co.za",
        "url": "https://aijobchommie.co.za"
    },
    license_info={
        "name": "Private License",
        "url": "https://aijobchommie.co.za/license"
    },
    lifespan=lifespan,
    docs_url="/docs" if os.getenv('ENVIRONMENT') != 'production' else None,
    redoc_url="/redoc" if os.getenv('ENVIRONMENT') != 'production' else None
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(scraping_router)
app.include_router(orchestrator_router)


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check() -> Dict[str, Any]:
    """
    Health check endpoint.
    Returns the current status of the scraping service.
    """
    try:
        # Add basic health checks here
        # db_healthy = await check_database_health()
        # redis_healthy = await check_redis_health()
        
        health_data = {
            "status": "healthy",
            "timestamp": time.time(),
            "version": "1.0.0",
            "environment": os.getenv('ENVIRONMENT', 'development'),
            "services": {
                "database": "healthy",  # Replace with actual checks
                "redis": "healthy",     # Replace with actual checks
                "scrapers": "healthy"   # Replace with actual checks
            }
        }
        
        return JSONResponse(
            status_code=200,
            content=health_data
        )
        
    except Exception as e:
        capture_api_error(
            e,
            endpoint="/health",
            method="GET",
            status_code=503
        )
        
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "timestamp": time.time(),
                "error": "Health check failed"
            }
        )


# Root endpoint
@app.get("/", tags=["Root"])
async def root() -> Dict[str, Any]:
    """
    Root endpoint with service information.
    """
    return {
        "service": "AI Job Chommie - Scraping Service",
        "version": "1.0.0",
        "status": "running",
        "environment": os.getenv('ENVIRONMENT', 'development'),
        "documentation": "/docs" if os.getenv('ENVIRONMENT') != 'production' else None,
        "health": "/health",
        "timestamp": time.time()
    }


# Sentry debug endpoint (development only)
@app.get("/sentry-debug", tags=["Debug"])
async def sentry_debug() -> Dict[str, Any]:
    """
    Sentry debug endpoint for testing error tracking.
    Only available in development environment.
    """
    environment = os.getenv('ENVIRONMENT', 'development')
    
    if environment == 'production':
        raise HTTPException(
            status_code=404,
            detail="Debug endpoints not available in production"
        )
    
    try:
        # Test different types of errors
        error_type = "test_error"
        
        if error_type == "test_error":
            raise Exception("Test error from Python FastAPI Scraping Service - Sentry Debug Endpoint")
        elif error_type == "scraping_error":
            from src.config.sentry import capture_scraping_error
            error = Exception("Test scraping error")
            capture_scraping_error(
                error,
                context={"test": True, "scraper": "debug"},
                url="https://example.com",
                scraper_type="debug_scraper"
            )
        elif error_type == "processing_error":
            from src.config.sentry import capture_processing_error
            error = Exception("Test processing error")
            capture_processing_error(
                error,
                job_data={"title": "Test Job", "company": "Test Company"},
                processing_stage="data_extraction"
            )
            
    except Exception as e:
        capture_api_error(
            e,
            endpoint="/sentry-debug",
            method="GET",
            status_code=500
        )
        
        return JSONResponse(
            status_code=500,
            content={
                "message": "Test error thrown and captured by Sentry",
                "timestamp": time.time(),
                "service": "scraping-service"
            }
        )




# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    """Handle HTTP exceptions."""
    
    capture_api_error(
        Exception(exc.detail),
        endpoint=str(request.url.path),
        method=request.method,
        status_code=exc.status_code
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "timestamp": time.time(),
            "path": str(request.url.path)
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    """Handle general exceptions."""
    
    capture_api_error(
        exc,
        endpoint=str(request.url.path),
        method=request.method,
        status_code=500
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "timestamp": time.time(),
            "path": str(request.url.path),
            "detail": str(exc) if os.getenv('ENVIRONMENT') != 'production' else None
        }
    )


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    environment = os.getenv("ENVIRONMENT", "development")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=environment == "development",
        log_level="info" if environment == "production" else "debug"
    )
