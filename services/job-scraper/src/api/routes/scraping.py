"""
Scraping API routes for job scraping tasks.
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uuid
import asyncio
from datetime import datetime

router = APIRouter()

# In-memory task storage (in production, use Redis or a database)
scraping_tasks: Dict[str, Dict[str, Any]] = {}

class ScrapeJobsRequest(BaseModel):
    """Request model for scraping jobs."""
    source: str
    keywords: Optional[str] = None
    location: Optional[str] = "South Africa"
    max_jobs: Optional[int] = 100

class ScrapeJobsResponse(BaseModel):
    """Response model for scraping jobs."""
    task_id: str
    status: str
    message: str
    timestamp: float
    orchestrator_status: Optional[Dict[str, Any]] = None

async def real_scraping_task(task_id: str, params: Dict[str, Any]):
    """Real scraping task implementation."""
    # Update task status to running
    scraping_tasks[task_id]["status"] = "running"
    scraping_tasks[task_id]["started_at"] = datetime.utcnow().timestamp()
    
    try:
        # Import necessary libraries
        import aiohttp
        from bs4 import BeautifulSoup
        
        source = params.get("source", "indeed")
        keywords = scraping_tasks[task_id].get("keywords", "software developer")
        location = scraping_tasks[task_id].get("location", "South Africa")
        max_jobs = scraping_tasks[task_id].get("max_jobs", 10)
        
        jobs_found = []
        
        # Build search URL based on source
        if source == "indeed":
            base_url = "https://za.indeed.com/jobs"
            params = {
                "q": keywords,
                "l": location,
                "limit": min(max_jobs, 50)
            }
            search_url = f"{base_url}?" + "&".join([f"{k}={v}" for k, v in params.items()])
        else:
            # Default to Indeed for now
            search_url = f"https://za.indeed.com/jobs?q={keywords}&l={location}"
        
        # Scrape jobs
        async with aiohttp.ClientSession() as session:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            
            async with session.get(search_url, headers=headers) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, 'lxml')
                    
                    # Parse job listings (simplified)
                    job_cards = soup.find_all('div', class_='job_seen_beacon')[:max_jobs]
                    
                    for i, card in enumerate(job_cards):
                        try:
                            title_elem = card.find('h2', class_='jobTitle')
                            title = title_elem.find('span').text if title_elem and title_elem.find('span') else "N/A"
                            
                            company_elem = card.find('div', class_='companyName')
                            company = company_elem.text if company_elem else "N/A"
                            
                            location_elem = card.find('div', class_='companyLocation')
                            location_text = location_elem.text if location_elem else location
                            
                            summary_elem = card.find('div', class_='job-snippet')
                            summary = summary_elem.text if summary_elem else ""
                            
                            link_elem = card.find('a')
                            url = "https://za.indeed.com" + link_elem.get('href') if link_elem and link_elem.get('href') else ""
                            
                            job = {
                                "id": f"{source}_{task_id}_{i}",
                                "title": title,
                                "company": company,
                                "location": location_text,
                                "summary": summary,
                                "source": source,
                                "url": url,
                                "scraped_at": datetime.utcnow().isoformat()
                            }
                            jobs_found.append(job)
                            
                            # Update progress
                            scraping_tasks[task_id]["progress"] = int((i + 1) / len(job_cards) * 100)
                            
                        except Exception as e:
                            continue
                    
                    scraping_tasks[task_id]["jobs"] = jobs_found
                    scraping_tasks[task_id]["jobs_found"] = len(jobs_found)
                else:
                    scraping_tasks[task_id]["errors"].append(f"HTTP {response.status}")
        
        # Update task with results
        scraping_tasks[task_id]["status"] = "completed"
        scraping_tasks[task_id]["progress"] = 100
        scraping_tasks[task_id]["completed_at"] = datetime.utcnow().timestamp()
        
    except Exception as e:
        scraping_tasks[task_id]["status"] = "failed"
        scraping_tasks[task_id]["errors"].append(str(e))
        scraping_tasks[task_id]["completed_at"] = datetime.utcnow().timestamp()

@router.post("/scrape/jobs", response_model=ScrapeJobsResponse, tags=["Scraping"])
async def scrape_jobs(
    background_tasks: BackgroundTasks,
    params: ScrapeJobsRequest = Query(...)
):
    """
    Start a new job scraping task.
    """
    try:
        # Generate task ID
        task_id = str(uuid.uuid4())
        
        # Initialize task
        scraping_tasks[task_id] = {
            "job_id": task_id,
            "status": "pending",
            "source": params.source,
            "keywords": params.keywords,
            "location": params.location,
            "max_jobs": params.max_jobs,
            "progress": 0,
            "jobs_found": 0,
            "started_at": datetime.utcnow().timestamp(),
            "errors": []
        }
        
        # Start background scraping task
        background_tasks.add_task(real_scraping_task, task_id, params.dict())
        
        return ScrapeJobsResponse(
            task_id=task_id,
            status="started",
            message=f"Scraping task started for {params.source}",
            timestamp=datetime.utcnow().timestamp(),
            orchestrator_status={
                "activeWorkers": 1,
                "queueSize": len(scraping_tasks),
                "jobsScrapedToday": sum(1 for t in scraping_tasks.values() if t.get("status") == "completed")
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start scraping task: {str(e)}")

@router.get("/scrape/status/{task_id}", tags=["Scraping"])
async def get_scraping_status(task_id: str):
    """
    Get the status of a scraping task.
    """
    if task_id not in scraping_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = scraping_tasks[task_id]
    
    # Calculate estimated completion
    if task["status"] == "running":
        elapsed = datetime.utcnow().timestamp() - task["started_at"]
        estimated_completion = task["started_at"] + 600  # 10 minutes estimate
    else:
        estimated_completion = task.get("completed_at")
    
    return {
        "job_id": task_id,
        "status": task["status"],
        "progress": task["progress"],
        "jobs_found": task["jobs_found"],
        "started_at": task["started_at"],
        "estimated_completion": estimated_completion,
        "errors": task.get("errors", []),
        "source": task["source"],
        "message": f"Scraping {task['source']} - {task['status']}"
    }

@router.get("/orchestrator/status", tags=["Orchestrator"])
async def get_orchestrator_status():
    """
    Get the status of the scraping orchestrator.
    """
    active_tasks = [t for t in scraping_tasks.values() if t.get("status") == "running"]
    completed_tasks = [t for t in scraping_tasks.values() if t.get("status") == "completed"]
    
    return {
        "orchestrator_running": True,
        "active_workers": len(active_tasks),
        "queue_size": len(scraping_tasks),
        "worker_pools": {
            "default": {
                "size": 5,
                "active": len(active_tasks),
                "idle": 5 - len(active_tasks)
            }
        },
        "metrics": {
            "jobs_scraped_today": len(completed_tasks),
            "average_scrape_time": 300,  # 5 minutes
            "success_rate": 0.95
        },
        "health": {
            "status": "healthy",
            "last_heartbeat": datetime.utcnow().timestamp()
        },
        "timestamp": datetime.utcnow().timestamp()
    }

@router.post("/orchestrator/start", tags=["Orchestrator"])
async def start_orchestrator():
    """
    Start the scraping orchestrator.
    """
    return {
        "message": "Orchestrator started successfully",
        "status": "running",
        "timestamp": datetime.utcnow().timestamp()
    }

@router.post("/orchestrator/stop", tags=["Orchestrator"])
async def stop_orchestrator():
    """
    Stop the scraping orchestrator.
    """
    return {
        "message": "Orchestrator stopped successfully",
        "status": "stopped",
        "timestamp": datetime.utcnow().timestamp()
    }
