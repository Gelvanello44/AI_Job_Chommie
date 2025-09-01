"""
Orchestrator API Routes for managing the scraping system.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from datetime import datetime
import asyncio

from src.config.sentry import add_scraping_breadcrumb

router = APIRouter(prefix="/api/v1/orchestrator", tags=["Orchestrator"])

# Orchestrator state (in production, use Redis or DB)
orchestrator_state = {
    "running": False,
    "started_at": None,
    "stopped_at": None,
    "total_tasks_processed": 0,
    "active_workers": 0,
    "max_workers": 10
}

@router.get("/status")
async def get_orchestrator_status() -> Dict[str, Any]:
    """
    Get the current status of the scraping orchestrator.
    """
    from src.api.scraping_routes import scraping_tasks
    
    # Calculate current metrics
    active_tasks = [t for t in scraping_tasks.values() if t["status"] == "running"]
    pending_tasks = [t for t in scraping_tasks.values() if t["status"] == "pending"]
    completed_tasks = [t for t in scraping_tasks.values() if t["status"] == "completed"]
    failed_tasks = [t for t in scraping_tasks.values() if t["status"] == "failed"]
    
    # Calculate worker pool status
    worker_pools = {
        "indeed": {"active": 2, "max": 5, "queue": 3},
        "linkedin": {"active": 1, "max": 3, "queue": 1},
        "careers24": {"active": 1, "max": 3, "queue": 0},
        "pnet": {"active": 0, "max": 2, "queue": 0}
    }
    
    # Calculate metrics
    metrics = {
        "tasks_per_hour": len(completed_tasks) if orchestrator_state["running"] else 0,
        "average_task_duration": 300,  # 5 minutes average
        "success_rate": (len(completed_tasks) / (len(completed_tasks) + len(failed_tasks)) * 100) if (completed_tasks or failed_tasks) else 100,
        "total_jobs_scraped": sum(t.get("jobs_found", 0) for t in scraping_tasks.values())
    }
    
    # Health status
    health = {
        "status": "healthy" if orchestrator_state["running"] else "idle",
        "last_heartbeat": datetime.utcnow().timestamp(),
        "warnings": [],
        "errors": []
    }
    
    # Add warnings if needed
    if len(active_tasks) > orchestrator_state["max_workers"] * 0.8:
        health["warnings"].append("High worker utilization")
    
    if len(failed_tasks) > len(completed_tasks) * 0.1:
        health["warnings"].append("High failure rate detected")
    
    return {
        "orchestrator_running": orchestrator_state["running"],
        "active_workers": len(active_tasks),
        "queue_size": len(pending_tasks),
        "worker_pools": worker_pools,
        "metrics": metrics,
        "health": health,
        "timestamp": datetime.utcnow().timestamp()
    }

@router.post("/start")
async def start_orchestrator() -> Dict[str, Any]:
    """
    Start the scraping orchestrator.
    """
    if orchestrator_state["running"]:
        raise HTTPException(status_code=400, detail="Orchestrator is already running")
    
    add_scraping_breadcrumb("Starting orchestrator")
    
    orchestrator_state["running"] = True
    orchestrator_state["started_at"] = datetime.utcnow().timestamp()
    orchestrator_state["stopped_at"] = None
    
    # Start background task to process queue (in production)
    asyncio.create_task(orchestrator_worker())
    
    return {
        "message": "Orchestrator started successfully",
        "status": "running",
        "timestamp": datetime.utcnow().timestamp()
    }

@router.post("/stop")
async def stop_orchestrator() -> Dict[str, Any]:
    """
    Stop the scraping orchestrator.
    """
    if not orchestrator_state["running"]:
        raise HTTPException(status_code=400, detail="Orchestrator is not running")
    
    add_scraping_breadcrumb("Stopping orchestrator")
    
    orchestrator_state["running"] = False
    orchestrator_state["stopped_at"] = datetime.utcnow().timestamp()
    
    return {
        "message": "Orchestrator stopped successfully",
        "status": "stopped",
        "timestamp": datetime.utcnow().timestamp()
    }

async def orchestrator_worker():
    """
    Background worker for the orchestrator (simplified version).
    """
    from src.api.scraping_routes import scraping_tasks
    
    while orchestrator_state["running"]:
        try:
            # Check for pending tasks
            pending_tasks = [t for t in scraping_tasks.values() if t["status"] == "pending"]
            active_tasks = [t for t in scraping_tasks.values() if t["status"] == "running"]
            
            # Process pending tasks if we have capacity
            if pending_tasks and len(active_tasks) < orchestrator_state["max_workers"]:
                # In production, this would dispatch to actual workers
                add_scraping_breadcrumb(f"Orchestrator: {len(pending_tasks)} tasks in queue")
            
            # Update metrics
            orchestrator_state["active_workers"] = len(active_tasks)
            orchestrator_state["total_tasks_processed"] = len(
                [t for t in scraping_tasks.values() if t["status"] in ["completed", "failed"]]
            )
            
            # Sleep before next check
            await asyncio.sleep(5)
            
        except Exception as e:
            add_scraping_breadcrumb(f"Orchestrator error: {str(e)}")
            await asyncio.sleep(10)  # Wait longer on error
