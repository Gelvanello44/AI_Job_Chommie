"""
Orchestrator Optimizer Module
Implements intelligent scheduling with model loading awareness
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Set, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import heapq
from collections import defaultdict
import time

from ..utils.model_preloader import get_model_preloader
from ..utils.model_cache_manager import get_model_cache_manager
from .scraper_optimization import get_scraper_optimizer

logger = logging.getLogger(__name__)

class TaskPriority(Enum):
    """Task priority levels"""
    CRITICAL = 1
    HIGH = 2
    MEDIUM = 3
    LOW = 4
    BACKGROUND = 5

@dataclass
class OptimizedTask:
    """Enhanced task with model requirements"""
    id: str
    scraper_name: str
    task_data: Dict[str, Any]
    priority: TaskPriority
    required_models: List[str] = field(default_factory=list)
    estimated_duration: float = 30.0  # seconds
    created_at: datetime = field(default_factory=datetime.utcnow)
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: str = "pending"
    result: Optional[Any] = None
    error: Optional[str] = None
    
    def __lt__(self, other):
        """Compare tasks for priority queue"""
        return (self.priority.value, self.created_at) < (other.priority.value, other.created_at)

class ResourceManager:
    """Manages available resources for task scheduling"""
    
    def __init__(self):
        self.model_preloader = get_model_preloader()
        self.model_cache = get_model_cache_manager()
        self.scraper_optimizer = get_scraper_optimizer()
        
        # Resource tracking
        self.model_loading_status: Dict[str, bool] = {}
        self.scraper_availability: Dict[str, int] = {}
        self.active_tasks: Dict[str, OptimizedTask] = {}
        
    def get_model_status(self, model_id: str) -> bool:
        """Check if a model is loaded and ready"""
        return model_id in self.model_preloader.pipelines
        
    def get_scraper_availability(self, scraper_name: str) -> int:
        """Get number of available scraper instances"""
        stats = self.scraper_optimizer.get_all_stats()
        pool_stats = stats.get("pools", {}).get(scraper_name, {})
        return pool_stats.get("available", 0)
        
    def estimate_model_load_time(self, model_id: str) -> float:
        """Estimate time to load a model"""
        # Use historical data if available
        if model_id in self.model_preloader.load_times:
            return self.model_preloader.load_times[model_id]
        
        # Default estimates based on model type
        model_config = self.model_preloader.model_configs.get(model_id, {})
        priority = model_config.get("priority", 3)
        
        if priority == 1:
            return 5.0  # Fast models
        elif priority == 2:
            return 10.0  # Medium models
        else:
            return 20.0  # Large models
            
    def can_execute_task(self, task: OptimizedTask) -> bool:
        """Check if a task can be executed with current resources"""
        # Check scraper availability
        if self.get_scraper_availability(task.scraper_name) == 0:
            return False
            
        # Check model availability
        for model_id in task.required_models:
            if not self.get_model_status(model_id):
                return False
                
        return True

class IntelligentScheduler:
    """Intelligent task scheduler with model awareness"""
    
    def __init__(self, resource_manager: ResourceManager):
        self.resource_manager = resource_manager
        self.task_queue: List[OptimizedTask] = []  # Min heap
        self.pending_tasks: Dict[str, OptimizedTask] = {}
        self.model_loading_tasks: Set[str] = set()
        self.execution_history: List[Dict[str, Any]] = []
        
    def schedule_task(self, task: OptimizedTask):
        """Schedule a task for execution"""
        # Add to pending tasks
        self.pending_tasks[task.id] = task
        
        # Check if models need loading
        missing_models = [
            model_id for model_id in task.required_models
            if not self.resource_manager.get_model_status(model_id)
        ]
        
        if missing_models:
            # Queue model loading
            for model_id in missing_models:
                if model_id not in self.model_loading_tasks:
                    self.model_loading_tasks.add(model_id)
                    asyncio.create_task(self._load_model(model_id))
                    
        # Add to priority queue
        heapq.heappush(self.task_queue, task)
        task.scheduled_at = datetime.utcnow()
        
    async def _load_model(self, model_id: str):
        """Load a model asynchronously"""
        try:
            logger.info(f"Loading model {model_id} for scheduled tasks")
            await self.resource_manager.model_preloader._load_model_background(model_id)
            self.model_loading_tasks.discard(model_id)
            
            # Re-evaluate pending tasks
            await self._reevaluate_tasks()
            
        except Exception as e:
            logger.error(f"Failed to load model {model_id}: {str(e)}")
            self.model_loading_tasks.discard(model_id)
            
    async def _reevaluate_tasks(self):
        """Re-evaluate tasks after resource changes"""
        # Check if any pending tasks can now be executed
        executable_tasks = []
        
        for task in self.task_queue:
            if self.resource_manager.can_execute_task(task):
                executable_tasks.append(task)
                
        # Notify executor about newly executable tasks
        for task in executable_tasks:
            logger.info(f"Task {task.id} is now ready for execution")
            
    def get_next_task(self) -> Optional[OptimizedTask]:
        """Get next task that can be executed"""
        while self.task_queue:
            # Peek at highest priority task
            task = self.task_queue[0]
            
            if self.resource_manager.can_execute_task(task):
                # Remove and return task
                heapq.heappop(self.task_queue)
                del self.pending_tasks[task.id]
                return task
                
            # Task cannot be executed yet, try next
            heapq.heappop(self.task_queue)
            heapq.heappush(self.task_queue, task)  # Re-add to maintain order
            
            # Break to avoid infinite loop
            break
            
        return None
        
    def requeue_task(self, task: OptimizedTask):
        """Requeue a failed task with lower priority"""
        task.priority = TaskPriority(min(task.priority.value + 1, TaskPriority.BACKGROUND.value))
        task.created_at = datetime.utcnow()  # Reset creation time for fairness
        self.schedule_task(task)

class OrchestratorOptimizer:
    """
    Optimizes orchestrator performance with intelligent scheduling
    """
    
    def __init__(self, max_concurrent_tasks: int = 20):
        self.resource_manager = ResourceManager()
        self.scheduler = IntelligentScheduler(self.resource_manager)
        self.max_concurrent_tasks = max_concurrent_tasks
        self.active_tasks: Dict[str, asyncio.Task] = {}
        self.task_semaphore = asyncio.Semaphore(max_concurrent_tasks)
        self.is_running = False
        self.stats = defaultdict(int)
        
    async def initialize(self):
        """Initialize the optimizer"""
        logger.info("Initializing orchestrator optimizer...")
        
        # Initialize scraper optimizer
        await self.resource_manager.scraper_optimizer.initialize_scrapers()
        
        # Start scheduler worker
        self.is_running = True
        asyncio.create_task(self._scheduler_worker())
        
        logger.info("Orchestrator optimizer initialized")
        
    async def _scheduler_worker(self):
        """Background worker that processes scheduled tasks"""
        while self.is_running:
            try:
                # Check for executable tasks
                task = self.scheduler.get_next_task()
                
                if task:
                    # Execute task
                    asyncio.create_task(self._execute_task(task))
                    
                # Brief pause to prevent CPU spinning
                await asyncio.sleep(0.1)
                
            except Exception as e:
                logger.error(f"Scheduler worker error: {str(e)}")
                await asyncio.sleep(1)
                
    async def _execute_task(self, task: OptimizedTask):
        """Execute a scheduled task"""
        async with self.task_semaphore:
            task.started_at = datetime.utcnow()
            task.status = "running"
            self.resource_manager.active_tasks[task.id] = task
            
            try:
                # Get scraper from pool
                scraper = self.resource_manager.scraper_optimizer.get_scraper(
                    task.scraper_name
                )
                
                # Execute scraping
                logger.info(f"Executing task {task.id} with scraper {task.scraper_name}")
                task.result = await self._run_scraper(scraper, task.task_data)
                
                task.status = "completed"
                task.completed_at = datetime.utcnow()
                self.stats["tasks_completed"] += 1
                
                # Record execution time
                execution_time = (task.completed_at - task.started_at).total_seconds()
                self.scheduler.execution_history.append({
                    "task_id": task.id,
                    "scraper": task.scraper_name,
                    "execution_time": execution_time,
                    "success": True
                })
                
            except Exception as e:
                logger.error(f"Task {task.id} failed: {str(e)}")
                task.status = "failed"
                task.error = str(e)
                task.completed_at = datetime.utcnow()
                self.stats["tasks_failed"] += 1
                
                # Requeue if retries available
                if task.task_data.get("retry_count", 0) < 3:
                    task.task_data["retry_count"] = task.task_data.get("retry_count", 0) + 1
                    self.scheduler.requeue_task(task)
                    
            finally:
                # Release scraper back to pool
                if 'scraper' in locals():
                    self.resource_manager.scraper_optimizer.release_scraper(
                        task.scraper_name,
                        scraper
                    )
                    
                # Remove from active tasks
                del self.resource_manager.active_tasks[task.id]
                
    async def _run_scraper(self, scraper, task_data: Dict[str, Any]) -> Any:
        """Run scraper with task data"""
        # This would call the actual scraper methods
        # For now, simulate scraping
        await asyncio.sleep(task_data.get("duration", 5))
        return {"status": "success", "data": task_data}
        
    def submit_task(self, 
                   scraper_name: str,
                   task_data: Dict[str, Any],
                   priority: TaskPriority = TaskPriority.MEDIUM,
                   required_models: List[str] = None) -> str:
        """Submit a new task for execution"""
        task_id = f"{scraper_name}_{int(time.time() * 1000)}"
        
        task = OptimizedTask(
            id=task_id,
            scraper_name=scraper_name,
            task_data=task_data,
            priority=priority,
            required_models=required_models or []
        )
        
        self.scheduler.schedule_task(task)
        self.stats["tasks_submitted"] += 1
        
        return task_id
        
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a task"""
        # Check active tasks
        if task_id in self.resource_manager.active_tasks:
            task = self.resource_manager.active_tasks[task_id]
        # Check pending tasks
        elif task_id in self.scheduler.pending_tasks:
            task = self.scheduler.pending_tasks[task_id]
        else:
            return None
            
        return {
            "id": task.id,
            "status": task.status,
            "priority": task.priority.name,
            "created_at": task.created_at.isoformat(),
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "error": task.error
        }
        
    def get_stats(self) -> Dict[str, Any]:
        """Get optimizer statistics"""
        return {
            "tasks": dict(self.stats),
            "active_tasks": len(self.resource_manager.active_tasks),
            "pending_tasks": len(self.scheduler.pending_tasks),
            "models_loading": len(self.scheduler.model_loading_tasks),
            "scraper_stats": self.resource_manager.scraper_optimizer.get_all_stats(),
            "model_stats": self.resource_manager.model_preloader.get_model_stats()
        }
        
    async def shutdown(self):
        """Shutdown the optimizer"""
        self.is_running = False
        
        # Wait for active tasks to complete
        if self.active_tasks:
            await asyncio.gather(*self.active_tasks.values(), return_exceptions=True)
            
        # Cleanup resources
        self.resource_manager.scraper_optimizer.cleanup()
        logger.info("Orchestrator optimizer shut down")

# Singleton instance
_orchestrator_optimizer = None

def get_orchestrator_optimizer() -> OrchestratorOptimizer:
    """Get the singleton orchestrator optimizer instance"""
    global _orchestrator_optimizer
    if _orchestrator_optimizer is None:
        _orchestrator_optimizer = OrchestratorOptimizer()
    return _orchestrator_optimizer
