"""
Main FastAPI application with REST and GraphQL endpoints.
Provides comprehensive API for job scraping service.
"""

import asyncio
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Depends, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from strawberry.fastapi import GraphQLRouter
import strawberry
from loguru import logger
import sentry_sdk

from src.config.settings import settings
from src.config.sentry import (
    init_sentry,
    capture_scraping_error,
    capture_processing_error,
    capture_api_error,
    SentryScrapingContext
)
from src.api.routes import jobs, companies, search, analytics, admin, auth, applications, auto_applications, cv_builder, skills_assessment, executive_features, job_alerts, professional_tools
from src.api.graphql.schema import schema as graphql_schema
from src.api.websocket import ConnectionManager
from src.middleware.auth import AuthMiddleware
from src.middleware.rate_limit import RateLimitMiddleware
from src.utils.database import Database
from src.utils.cache import CacheManager
from src.utils.kafka_producer import KafkaProducer
from src.processors.job_enricher import JobEnricher


# Initialize Sentry first before anything else
init_sentry()


# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    # Startup
    logger.info("Starting job scraping service...")
    
    # Initialize database
    app.state.db = Database()
    await app.state.db.connect()
    
    # Initialize cache
    app.state.cache = CacheManager()
    await app.state.cache.connect()
    
    # Initialize Kafka producer
    app.state.kafka = KafkaProducer()
    await app.state.kafka.start()
    
    # Initialize job enricher
    app.state.enricher = JobEnricher()
    
    # Initialize WebSocket manager
    app.state.ws_manager = ConnectionManager()
    
    logger.info("Job scraping service started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down job scraping service...")
    
    await app.state.db.disconnect()
    await app.state.cache.disconnect()
    await app.state.kafka.stop()
    
    logger.info("Job scraping service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Job Scraping Service",
    description="Enterprise-grade job scraping microservice with AI features",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure based on your needs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(AuthMiddleware)
app.add_middleware(RateLimitMiddleware)

# Instrument with Prometheus
instrumentator = Instrumentator()
instrumentator.instrument(app).expose(app, endpoint="/metrics")

# Instrument with OpenTelemetry
if settings.jaeger_agent_host:
    FastAPIInstrumentor.instrument_app(app)

# Include routers
app.include_router(auth.router, prefix=f"{settings.api_prefix}/auth", tags=["auth"])
app.include_router(auto_applications.router, prefix=f"{settings.api_prefix}/auto-applications", tags=["auto-applications"])
app.include_router(cv_builder.router, prefix=f"{settings.api_prefix}/cv-builder", tags=["cv-builder"])
app.include_router(skills_assessment.router, prefix=f"{settings.api_prefix}/skills-assessment", tags=["skills-assessment"])
app.include_router(executive_features.router, prefix=f"{settings.api_prefix}/executive", tags=["executive-features"])
app.include_router(job_alerts.router, prefix=f"{settings.api_prefix}/job-alerts", tags=["job-alerts"])
app.include_router(professional_tools.router, prefix=f"{settings.api_prefix}/professional-tools", tags=["professional-tools"])
app.include_router(applications.router, prefix=f"{settings.api_prefix}/applications", tags=["applications"])
app.include_router(jobs.router, prefix=f"{settings.api_prefix}/jobs", tags=["jobs"])
app.include_router(companies.router, prefix=f"{settings.api_prefix}/companies", tags=["companies"])
app.include_router(search.router, prefix=f"{settings.api_prefix}/search", tags=["search"])
app.include_router(analytics.router, prefix=f"{settings.api_prefix}/analytics", tags=["analytics"])
app.include_router(admin.router, prefix=f"{settings.api_prefix}/admin", tags=["admin"])

# Add GraphQL endpoint
graphql_app = GraphQLRouter(graphql_schema)
app.include_router(graphql_app, prefix=settings.graphql_path)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": settings.service_name,
        "version": "1.0.0",
        "status": "operational",
        "environment": settings.environment
    }


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    checks = {
        "service": "healthy",
        "database": "unknown",
        "cache": "unknown",
        "kafka": "unknown"
    }
    
    # Check database
    try:
        await app.state.db.execute("SELECT 1")
        checks["database"] = "healthy"
    except Exception as e:
        checks["database"] = f"unhealthy: {str(e)}"
    
    # Check cache
    try:
        await app.state.cache.ping()
        checks["cache"] = "healthy"
    except Exception as e:
        checks["cache"] = f"unhealthy: {str(e)}"
    
    # Check Kafka
    try:
        if app.state.kafka.is_healthy():
            checks["kafka"] = "healthy"
        else:
            checks["kafka"] = "unhealthy"
    except Exception as e:
        checks["kafka"] = f"unhealthy: {str(e)}"
    
    # Overall health
    overall_healthy = all(v == "healthy" for v in checks.values())
    
    return JSONResponse(
        status_code=200 if overall_healthy else 503,
        content={
            "status": "healthy" if overall_healthy else "unhealthy",
            "checks": checks,
            "timestamp": asyncio.get_event_loop().time()
        }
    )


# WebSocket endpoint for real-time updates
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time job updates."""
    await app.state.ws_manager.connect(websocket, client_id)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            
            # Handle different message types
            if data.get("type") == "subscribe":
                # Subscribe to job updates
                filters = data.get("filters", {})
                await app.state.ws_manager.subscribe(client_id, filters)
                
            elif data.get("type") == "unsubscribe":
                # Unsubscribe from updates
                await app.state.ws_manager.unsubscribe(client_id)
                
            elif data.get("type") == "ping":
                # Respond to ping
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        app.state.ws_manager.disconnect(client_id)
        logger.info(f"Client {client_id} disconnected")


# Scraping control endpoints
@app.post(f"{settings.api_prefix}/scraping/start")
async def start_scraping(
    sources: List[str] = Query(default=["linkedin", "indeed", "glassdoor"]),
    job_level: Optional[str] = None,
    location: Optional[str] = None,
    keywords: Optional[List[str]] = None
):
    """Start scraping jobs from specified sources."""
    try:
        task_id = await app.state.kafka.send_message(
            topic="scraping-tasks",
            message={
                "action": "start",
                "sources": sources,
                "filters": {
                    "job_level": job_level,
                    "location": location,
                    "keywords": keywords
                }
            }
        )
        
        return {
            "status": "started",
            "task_id": task_id,
            "sources": sources
        }
    except Exception as e:
        capture_scraping_error(
            error=e,
            context={
                "sources": sources,
                "filters": {
                    "job_level": job_level,
                    "location": location,
                    "keywords": keywords
                }
            },
            scraper_type="orchestrator"
        )
        raise HTTPException(status_code=500, detail="Failed to start scraping tasks")


# SA Market Coverage Endpoints
@app.post(f"{settings.api_prefix}/scraping/sa-market/start")
async def start_sa_market_coverage():
    """Start comprehensive SA job market coverage."""
    try:
        from src.schedulers.sa_market_scheduler import start_sa_market_coverage
        await start_sa_market_coverage()
        
        return {
            "status": "started",
            "message": "SA market coverage initiated",
            "target_daily_jobs": 5400,
            "estimated_coverage": "50%+",
            "focus": "Entry-level and comprehensive job market"
        }
    except Exception as e:
        capture_scraping_error(
            error=e,
            context={"operation": "sa_market_coverage_start"},
            scraper_type="sa_scheduler"
        )
        raise HTTPException(status_code=500, detail="Failed to start SA market coverage")


@app.get(f"{settings.api_prefix}/scraping/sa-market/status")
async def get_sa_market_status():
    """Get current SA job market coverage status."""
    try:
        from src.schedulers.sa_market_scheduler import get_sa_coverage_status
        status = await get_sa_coverage_status()
        
        return {
            "status": "active",
            "coverage_metrics": status,
            "last_updated": datetime.utcnow().isoformat()
        }
    except Exception as e:
        capture_api_error(
            error=e,
            endpoint=f"{settings.api_prefix}/scraping/sa-market/status",
            method="GET"
        )
        raise HTTPException(status_code=500, detail="Failed to get SA market status")


@app.post(f"{settings.api_prefix}/scraping/sa-market/force-sweep")
async def force_sa_market_sweep():
    """Force immediate comprehensive SA market sweep."""
    try:
        from src.schedulers.sa_market_scheduler import sa_scheduler
        await sa_scheduler.force_comprehensive_sweep()
        
        return {
            "status": "initiated",
            "message": "Comprehensive SA market sweep started",
            "estimated_completion": "15-30 minutes",
            "expected_jobs": "2000-5000"
        }
    except Exception as e:
        capture_scraping_error(
            error=e,
            context={"operation": "force_sa_sweep"},
            scraper_type="sa_scheduler"
        )
        raise HTTPException(status_code=500, detail="Failed to initiate SA market sweep")


@app.get(f"{settings.api_prefix}/entry-level/jobs")
async def get_entry_level_jobs(
    location: Optional[str] = Query("South Africa"),
    keywords: Optional[List[str]] = Query([]),
    limit: int = Query(50, le=200)
):
    """Get entry-level jobs specifically for people without qualifications."""
    try:
        # Query database for entry-level jobs
        filters = {
            "job_level": "entry",
            "location": location,
            "keywords": keywords,
            "no_experience_required": True
        }
        
        jobs = await app.state.db.search_jobs(filters, limit=limit)
        
        # Categorize by industry for easier browsing
        categorized = {
            "retail": [],
            "food_service": [],
            "security": [],
            "cleaning": [],
            "general_labor": [],
            "other": []
        }
        
        for job in jobs:
            category = _categorize_entry_level_job(job)
            categorized[category].append(job)
        
        return {
            "total_jobs": len(jobs),
            "location": location,
            "categories": categorized,
            "last_updated": datetime.utcnow().isoformat(),
            "message": "Jobs suitable for people without formal qualifications"
        }
        
    except Exception as e:
        capture_api_error(
            error=e,
            endpoint=f"{settings.api_prefix}/entry-level/jobs",
            method="GET"
        )
        raise HTTPException(status_code=500, detail="Failed to fetch entry-level jobs")


def _categorize_entry_level_job(job: Dict[str, Any]) -> str:
    """Categorize entry-level job by industry."""
    title = job.get("title", "").lower()
    company = job.get("company", {}).get("name", "").lower()
    
    # Retail
    if any(word in title for word in ["cashier", "sales", "retail", "shop"]) or \
       any(comp in company for comp in ["shoprite", "pick n pay", "checkers", "woolworths"]):
        return "retail"
    
    # Food service
    elif any(word in title for word in ["kitchen", "food", "waiter", "server"]) or \
         any(comp in company for comp in ["kfc", "mcdonald", "steers", "nandos"]):
        return "food_service"
    
    # Security
    elif any(word in title for word in ["security", "guard", "patrol"]):
        return "security"
    
    # Cleaning
    elif any(word in title for word in ["clean", "janitor", "housekeeping"]):
        return "cleaning"
    
    # General labor
    elif any(word in title for word in ["general worker", "packer", "laborer", "helper"]):
        return "general_labor"
    
    return "other"


@app.post(f"{settings.api_prefix}/scraping/stop")
async def stop_scraping(task_id: Optional[str] = None):
    """Stop scraping tasks."""
    await app.state.kafka.send_message(
        topic="scraping-tasks",
        message={
            "action": "stop",
            "task_id": task_id
        }
    )
    
    return {"status": "stopped", "task_id": task_id}


@app.get(f"{settings.api_prefix}/scraping/status")
async def scraping_status():
    """Get current scraping status and metrics."""
    # This would connect to your scraper monitoring system
    return {
        "active_scrapers": 5,
        "jobs_scraped_today": 12543,
        "success_rate": 0.97,
        "average_response_time": 1.23,
        "blocked_domains": [],
        "queue_size": 342
    }


# Feature extraction endpoint
@app.post(f"{settings.api_prefix}/extract/features")
async def extract_features(
    job_url: str,
    extract_company_culture: bool = True,
    extract_leadership: bool = False,
    extract_salary_insights: bool = True
):
    """Extract advanced features from a job posting."""
    try:
        # Queue feature extraction task
        task_id = await app.state.kafka.send_message(
            topic="feature-extraction",
            message={
                "job_url": job_url,
                "features": {
                    "company_culture": extract_company_culture,
                    "leadership": extract_leadership,
                    "salary_insights": extract_salary_insights
                }
            }
        )
        
        return {
            "status": "queued",
            "task_id": task_id,
            "estimated_time": 30  # seconds
        }
    except Exception as e:
        capture_processing_error(
            error=e,
            job_data={"url": job_url},
            processing_stage="feature_extraction_queueing"
        )
        raise HTTPException(status_code=500, detail="Failed to queue feature extraction task")


# Tier-specific endpoints
@app.get(f"{settings.api_prefix}/executive/opportunities")
async def get_executive_opportunities(
    min_salary: Optional[float] = Query(None, description="Minimum salary in ZAR"),
    industries: Optional[List[str]] = Query(None),
    include_hidden_market: bool = Query(True)
):
    """Get executive-level opportunities (Executive tier only)."""
    # This would check user tier and filter accordingly
    opportunities = await app.state.db.get_executive_opportunities(
        min_salary=min_salary,
        industries=industries,
        include_hidden_market=include_hidden_market
    )
    
    return {
        "total": len(opportunities),
        "opportunities": opportunities
    }


@app.get(f"{settings.api_prefix}/networking/events")
async def get_networking_events(
    location: Optional[str] = Query(None),
    industries: Optional[List[str]] = Query(None),
    event_type: Optional[str] = Query(None)
):
    """Get upcoming networking events (Executive tier only)."""
    events = await app.state.db.get_networking_events(
        location=location,
        industries=industries,
        event_type=event_type
    )
    
    return {
        "total": len(events),
        "events": events
    }


@app.get(f"{settings.api_prefix}/intelligence/market")
async def get_market_intelligence(
    report_type: str = Query(..., description="salary_trends, skill_demand, industry_growth"),
    industry: Optional[str] = Query(None),
    location: Optional[str] = Query(None)
):
    """Get market intelligence reports (Enterprise tier only)."""
    report = await app.state.db.get_market_intelligence(
        report_type=report_type,
        industry=industry,
        location=location
    )
    
    return report


# Sentry debug endpoints (development only)
if settings.debug:
    @app.get("/sentry-debug")
    async def trigger_error():
        """Debug endpoint to trigger an error for Sentry testing."""
        division_by_zero = 1 / 0
        return {"this": "should not be reached"}
    
    @app.post("/sentry-debug/scraping")
    async def trigger_scraping_error(url: str = "https://example.com"):
        """Debug endpoint to trigger a scraping error for Sentry testing."""
        try:
            # Simulate a scraping error
            raise ValueError(f"Failed to scrape data from {url}")
        except Exception as e:
            capture_scraping_error(
                error=e,
                context={"test_data": "debug_scraping_error"},
                url=url,
                scraper_type="debug"
            )
            raise HTTPException(status_code=500, detail="Scraping error triggered for testing")
    
    @app.post("/sentry-debug/processing")
    async def trigger_processing_error():
        """Debug endpoint to trigger a processing error for Sentry testing."""
        try:
            # Simulate a processing error
            raise KeyError("Required field 'salary' missing from job data")
        except Exception as e:
            capture_processing_error(
                error=e,
                job_data={"title": "Software Engineer", "company": "Test Corp"},
                processing_stage="data_validation"
            )
            raise HTTPException(status_code=500, detail="Processing error triggered for testing")
    
    @app.get("/sentry-debug/message")
    async def send_test_message():
        """Debug endpoint to send a test message to Sentry."""
        sentry_sdk.capture_message("This is a test message from the scraping service", level="info")
        return {"message": "Test message sent to Sentry"}


# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions."""
    # Capture 5xx errors in Sentry, but not 4xx client errors
    if exc.status_code >= 500:
        capture_api_error(
            error=exc,
            endpoint=str(request.url.path),
            method=request.method,
            status_code=exc.status_code
        )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "path": str(request.url)
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions."""
    logger.error(f"Unhandled exception: {exc}")
    
    # Capture all unhandled exceptions in Sentry
    capture_api_error(
        error=exc,
        endpoint=str(request.url.path),
        method=request.method,
        status_code=500
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc) if settings.debug else "An error occurred"
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.api.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )
