"""
Scraping API Routes for the Job Scraping Service.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, List, Any, Optional
import uuid
from datetime import datetime
import asyncio

from src.config.sentry import capture_scraping_error, add_scraping_breadcrumb
from src.services.backend_integration import backend_service

router = APIRouter(prefix="/api/v1/scrape", tags=["Scraping"])

# In-memory storage for demo purposes - replace with Redis/DB in production
scraping_tasks = {}

@router.post("/jobs")
async def start_job_scraping(
    source: str = Query(..., description="Job board source (e.g., indeed, linkedin)"),
    keywords: Optional[str] = Query(None, description="Search keywords"),
    location: Optional[str] = Query("South Africa", description="Job location"),
    max_jobs: Optional[int] = Query(100, ge=1, le=1000, description="Maximum jobs to scrape")
) -> Dict[str, Any]:
    """
    Start a new job scraping task.
    """
    try:
        # Generate task ID
        task_id = str(uuid.uuid4())
        
        add_scraping_breadcrumb(f"Starting scraping task {task_id} for {source}")
        
        # Create task record
        task = {
            "task_id": task_id,
            "source": source,
            "keywords": keywords,
            "location": location,
            "max_jobs": max_jobs,
            "status": "pending",
            "progress": 0,
            "jobs_found": 0,
            "started_at": datetime.utcnow().timestamp(),
            "errors": []
        }
        
        scraping_tasks[task_id] = task
        
        # Start scraping in background (in production, use Celery/Redis Queue)
        asyncio.create_task(perform_scraping(task_id, task))
        
        # Check orchestrator status
        orchestrator_status = {
            "activeWorkers": len([t for t in scraping_tasks.values() if t["status"] == "running"]),
            "queueSize": len([t for t in scraping_tasks.values() if t["status"] == "pending"]),
            "jobsScrapedToday": sum(t.get("jobs_found", 0) for t in scraping_tasks.values())
        }
        
        return {
            "task_id": task_id,
            "status": "started",
            "message": f"Scraping task started for {source}",
            "timestamp": datetime.utcnow().timestamp(),
            "orchestrator_status": orchestrator_status
        }
        
    except Exception as e:
        capture_scraping_error(e, {"source": source, "keywords": keywords}, url=None, scraper_type=source)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{task_id}")
async def get_task_status(task_id: str) -> Dict[str, Any]:
    """
    Get the status of a scraping task.
    """
    if task_id not in scraping_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = scraping_tasks[task_id]
    
    # Calculate estimated completion based on progress
    if task["status"] == "completed":
        estimated_completion = task.get("completed_at", datetime.utcnow().timestamp())
    elif task["status"] == "running":
        # Estimate based on progress
        elapsed = datetime.utcnow().timestamp() - task["started_at"]
        if task["progress"] > 0:
            total_time = elapsed / (task["progress"] / 100)
            estimated_completion = task["started_at"] + total_time
        else:
            estimated_completion = task["started_at"] + 600  # Default 10 minutes
    else:
        estimated_completion = task["started_at"] + 600
    
    return {
        "job_id": task_id,
        "status": task["status"],
        "progress": task["progress"],
        "jobs_found": task["jobs_found"],
        "started_at": task["started_at"],
        "estimated_completion": estimated_completion,
        "errors": task.get("errors", []),
        "source": task["source"],
        "message": f"Scraping {task['source']}: {task['progress']}% complete"
    }

async def perform_scraping(task_id: str, task: Dict[str, Any]):
    """
    Perform real job scraping using SerpAPI and other scrapers.
    NO MORE MOCK DATA - This now uses real scrapers for actual job listings.
    """
    from src.scrapers.serpapi_scraper import SerpAPIScraper
    from src.scrapers.orchestrator import orchestrator
    import os
    
    try:
        # Update status to running
        task["status"] = "running"
        add_scraping_breadcrumb(f"Starting REAL scraping for task {task_id} using {task['source']}")
        
        # Update backend about task start
        await backend_service.update_task_status(
            task_id=task_id,
            status="running",
            progress=0,
            jobs_found=0
        )
        
        # REAL SCRAPING - NO MOCK DATA
        jobs_collected = []
        
        # Initialize real scraper based on source or use SerpAPI as primary
        scraper = None
        
        # Check if real scraping is enabled
        if not os.getenv('ENABLE_REAL_SCRAPING', 'false').lower() == 'true':
            raise Exception("Real scraping is not enabled. Set ENABLE_REAL_SCRAPING=true in environment.")
        
        if os.getenv('USE_MOCK_DATA', 'false').lower() == 'true':
            raise Exception("Mock data is still enabled. Set USE_MOCK_DATA=false in environment.")
        
        # Use SerpAPI as primary scraper for all sources
        scraper = SerpAPIScraper()
        await scraper.initialize()
        
        # Build filters for scraping
        filters = {
            "keywords": task["keywords"].split() if task["keywords"] else [],
            "location": task["location"] or "South Africa",
            "max_results": task["max_jobs"] or 100
        }
        
        add_scraping_breadcrumb(f"REAL SCRAPING: Using SerpAPI to scrape {task['source']} with filters: {filters}")
        
        # Update progress - starting real scraping
        task["progress"] = 10
        await backend_service.update_task_status(
            task_id=task_id,
            status="running",
            progress=10,
            jobs_found=0
        )
        
        # Perform REAL scraping using SerpAPI
        try:
            scraping_results = await scraper.scrape(
                source=task["source"],
                filters=filters
            )
            
            add_scraping_breadcrumb(f"REAL SCRAPING COMPLETE: Found {len(scraping_results.get('jobs', []))} real jobs")
            
            # Process real job results
            real_jobs = scraping_results.get("jobs", [])
            
            if real_jobs:
                add_scraping_breadcrumb(f"Processing {len(real_jobs)} REAL jobs from SerpAPI")
                
                # Convert SerpAPI results to our format
                for job_data in real_jobs:
                    # This is REAL job data from SerpAPI
                    job = {
                        "id": job_data.get("id"),
                        "title": job_data.get("title", "Unknown Title"),
                        "company": job_data.get("company", {}).get("name", "Unknown Company"),
                        "location": job_data.get("location", task["location"]),
                        "description": job_data.get("description", ""),
                        "url": job_data.get("source_url", ""),
                        "salary": job_data.get("salary_formatted", ""),
                        "posted_date": job_data.get("posted_date", datetime.utcnow().isoformat()),
                        "source": "serpapi_" + task["source"],
                        "job_type": job_data.get("job_type", ""),
                        "job_level": job_data.get("job_level", ""),
                        "remote_type": job_data.get("remote_type", "onsite"),
                        "requirements": job_data.get("requirements", []),
                        "skills": job_data.get("skills", []),
                        "scraped_at": datetime.utcnow().isoformat(),
                        "is_real_data": True  # Flag to indicate this is real data
                    }
                    jobs_collected.append(job)
                
                task["jobs_found"] = len(jobs_collected)
                
                # Update progress - jobs collected
                task["progress"] = 80
                await backend_service.update_task_status(
                    task_id=task_id,
                    status="running",
                    progress=80,
                    jobs_found=task["jobs_found"]
                )
                
                add_scraping_breadcrumb(f"REAL DATA SUCCESS: Collected {len(jobs_collected)} real jobs")
            else:
                add_scraping_breadcrumb("WARNING: No jobs found from real SerpAPI scraping")
                task["errors"].append("No jobs found from SerpAPI. Check search parameters or API quota.")
            
        except Exception as scraping_error:
            add_scraping_breadcrumb(f"REAL SCRAPING ERROR: {str(scraping_error)}")
            raise Exception(f"Real scraping failed: {str(scraping_error)}")
        
        finally:
            # Clean up scraper
            if scraper:
                await scraper.cleanup()
        
        # Push REAL jobs to backend
        if jobs_collected:
            add_scraping_breadcrumb(f"Pushing {len(jobs_collected)} REAL jobs to backend")
            await backend_service.push_scraped_jobs(jobs_collected, task["source"])
        
        # Mark as completed
        task["status"] = "completed"
        task["progress"] = 100
        task["completed_at"] = datetime.utcnow().timestamp()
        
        add_scraping_breadcrumb(f"REAL SCRAPING COMPLETE: Task {task_id} finished with {task['jobs_found']} real jobs")
        
        # Final update to backend
        await backend_service.update_task_status(
            task_id=task_id,
            status="completed",
            progress=100,
            jobs_found=task["jobs_found"]
        )
        
    except Exception as e:
        task["status"] = "failed"
        task["errors"].append(str(e))
        
        add_scraping_breadcrumb(f"REAL SCRAPING FAILED: {str(e)}")
        
        capture_scraping_error(
            e,
            context={"task_id": task_id, "source": task["source"], "real_scraping": True},
            scraper_type=task["source"]
        )
        
        # Update backend about failure
        await backend_service.update_task_status(
            task_id=task_id,
            status="failed",
            progress=task["progress"],
            jobs_found=task["jobs_found"],
            errors=task["errors"]
        )
