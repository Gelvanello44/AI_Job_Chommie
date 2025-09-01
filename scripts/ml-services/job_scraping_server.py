"""
Simple Job Scraping Service Launcher
Launches the job scraping service with minimal dependencies
"""

import os
import sys
import logging
import time
from datetime import datetime

# Add the job scraping service to the Python path
scraping_service_path = os.path.join(os.path.dirname(__file__), 'job-scraping-service', 'src')
if scraping_service_path not in sys.path:
    sys.path.insert(0, scraping_service_path)

# Set up minimal environment variables
os.environ.setdefault('ENVIRONMENT', 'development')
os.environ.setdefault('SENTRY_DSN', '')  # Skip sentry initialization
os.environ.setdefault('HOST', '0.0.0.0')
os.environ.setdefault('PORT', '8000')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
    import uvicorn

    # Create a simplified FastAPI app
    app = FastAPI(
        title="AI Job Chommie - Scraping Service",
        description="Intelligent job scraping service for AI Job Chommie platform",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc"
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Basic health check endpoint
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0.0",
            "environment": os.getenv('ENVIRONMENT', 'development'),
            "service": "job-scraping-service",
            "uptime": time.time()
        }

    # Root endpoint
    @app.get("/")
    async def root():
        """Root endpoint with service information."""
        return {
            "service": "AI Job Chommie - Scraping Service",
            "version": "1.0.0",
            "status": "running",
            "environment": os.getenv('ENVIRONMENT', 'development'),
            "documentation": "/docs",
            "health": "/health",
            "timestamp": datetime.utcnow().isoformat()
        }

    # REAL JOB SCRAPING ENDPOINT - SERPAPI ACTIVATED
    @app.post("/api/v1/scrape/jobs")
    async def start_real_job_scraping(
        source: str = "serpapi",
        keywords: str = "software engineer",
        location: str = "South Africa", 
        max_jobs: int = 100
    ):
        """Start REAL job scraping using SerpAPI - NO MORE MOCK DATA!"""
        import uuid
        import os
        import sys
        
        # Add scraping service to path
        scraping_path = os.path.join(os.path.dirname(__file__), 'job-scraping-service', 'src')
        if scraping_path not in sys.path:
            sys.path.insert(0, scraping_path)
        
        task_id = str(uuid.uuid4())
        
        try:
            # Import REAL SerpAPI scraper
            from scrapers.serpapi_scraper import SerpAPIScraper
            
            # Initialize REAL scraper with API key
            scraper = SerpAPIScraper()
        
            # Execute REAL scraping
            logger.info(f" STARTING REAL SCRAPING - Task {task_id}")
            logger.info(f" Source: {source}, Keywords: {keywords}, Location: {location}, Max: {max_jobs}")
            
            # Build search filters
            filters = {
                "keywords": keywords.split() if keywords else ["jobs"],
                "location": location,
                "max_results": max_jobs,
                "job_level": "entry"  # Focus on entry-level for SA market
            }
        
            # REAL API CALL TO SERPAPI - NO MOCK DATA!
            results = await scraper.scrape(source="comprehensive_sa", filters=filters)
            
            jobs_found = len(results.get("jobs", []))
            companies_found = len(results.get("companies", []))
        
            logger.info(f" REAL SCRAPING SUCCESS: {jobs_found} jobs, {companies_found} companies found")
            
            return {
                "task_id": task_id,
                "status": "completed",
                "message": f"REAL scraping completed from {source}",
                "parameters": {
                    "source": source,
                    "keywords": keywords,
                    "location": location,
                    "max_jobs": max_jobs
                },
                "results": {
                    "jobs_found": jobs_found,
                    "companies_found": companies_found,
                    "api_calls_made": results.get("api_calls", 0),
                    "data_source": "REAL SerpAPI - NOT MOCK DATA"
                },
                "timestamp": datetime.utcnow().isoformat(),
                "note": " REAL SCRAPING ACTIVE - Using live SerpAPI with South African job market focus!"
            }
            
        except Exception as e:
            logger.error(f" REAL SCRAPING FAILED: {str(e)}")
            return {
                "task_id": task_id,
                "status": "failed",
                "message": f"Real scraping failed: {str(e)}",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e)
            }

    # Service status endpoint
    @app.get("/api/v1/status")
    async def service_status():
        """Get service status and metrics."""
        return {
            "service": "job-scraping-service", 
            "status": "running",
            "version": "1.0.0",
            "capabilities": [
                "REAL-SERPAPI-SCRAPING",
                "health-monitoring", 
                "SA-job-market-focus"
            ],
            "endpoints": [
                "/health",
                "/api/v1/scrape/jobs",
                "/api/v1/status"
            ],
            "timestamp": datetime.utcnow().isoformat(),
            "scraping_mode": "REAL - NO MOCK DATA"
        }

except ImportError as e:
    logger.error(f"Failed to import required modules: {e}")
    logger.error("Please ensure FastAPI and uvicorn are installed: pip install fastapi uvicorn")
    sys.exit(1)


if __name__ == "__main__":
    try:
        host = os.getenv("HOST", "0.0.0.0")
        port = int(os.getenv("PORT", "8000"))
        
        logger.info(" Starting Job Scraping Service (Simplified Mode)...")
        logger.info(f" Host: {host}:{port}")
        logger.info(f" Documentation available at: http://{host}:{port}/docs")
        
        # Run the server
        uvicorn.run(
            "job_scraping_server:app",
            host=host,
            port=port,
            log_level="info",
            access_log=True,
            reload=False
        )
        
    except Exception as e:
        logger.error(f" Failed to start Job Scraping Service: {e}")
        sys.exit(1)
