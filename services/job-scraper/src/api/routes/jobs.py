"""
Jobs API routes for comprehensive job management and retrieval.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, Path, BackgroundTasks
from pydantic import BaseModel, validator
from datetime import datetime, timedelta
import asyncio

from src.config.sentry import capture_api_error, add_scraping_breadcrumb
from src.models.job_models import Job, JobFilter, JobSearchResponse
from src.utils.database import get_database
from src.utils.cache import get_cache_manager
from src.processors.job_enricher import JobEnricher

router = APIRouter()


class JobCreateRequest(BaseModel):
    """Request model for creating a new job."""
    title: str
    company: str
    location: str
    description: str
    url: str
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    job_type: Optional[str] = "full_time"
    experience_level: Optional[str] = "mid_level"
    skills_required: Optional[List[str]] = []
    remote_friendly: bool = False
    
    @validator('salary_min', 'salary_max')
    def validate_salary(cls, v):
        if v is not None and v < 0:
            raise ValueError('Salary must be non-negative')
        return v


class JobUpdateRequest(BaseModel):
    """Request model for updating job information."""
    title: Optional[str] = None
    description: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None


class JobSearchRequest(BaseModel):
    """Request model for job search."""
    query: Optional[str] = None
    location: Optional[str] = None
    company: Optional[str] = None
    job_type: Optional[str] = None
    experience_level: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    remote_only: bool = False
    skills: Optional[List[str]] = []
    posted_days_ago: Optional[int] = 30
    limit: int = 50
    offset: int = 0
    sort_by: str = "relevance"  # relevance, date, salary
    
    @validator('limit')
    def validate_limit(cls, v):
        if v > 1000:
            raise ValueError('Limit cannot exceed 1000')
        return v


@router.get("/", response_model=JobSearchResponse, tags=["Jobs"])
async def search_jobs(
    request: JobSearchRequest = Depends(),
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """
    Search for jobs with advanced filtering and ranking.
    Supports semantic search, location-based filtering, and salary ranges.
    """
    try:
        add_scraping_breadcrumb("Job search initiated", data=request.dict())
        
        # Check cache first
        cache_key = f"job_search:{hash(str(request.dict()))}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            add_scraping_breadcrumb("Job search result served from cache")
            return cached_result
        
        # Build search filters
        filters = JobFilter(
            query=request.query,
            location=request.location,
            company=request.company,
            job_type=request.job_type,
            experience_level=request.experience_level,
            salary_range=(request.salary_min, request.salary_max),
            remote_only=request.remote_only,
            skills=request.skills,
            posted_since=datetime.utcnow() - timedelta(days=request.posted_days_ago)
        )
        
        # Execute search
        jobs, total_count = await db.search_jobs(
            filters=filters,
            limit=request.limit,
            offset=request.offset,
            sort_by=request.sort_by
        )
        
        # Prepare response
        response = JobSearchResponse(
            jobs=jobs,
            total=total_count,
            limit=request.limit,
            offset=request.offset,
            filters=filters
        )
        
        # Cache result for 5 minutes
        await cache.set(cache_key, response, ttl=300)
        
        add_scraping_breadcrumb("Job search completed", data={"total_found": total_count})
        return response
        
    except Exception as e:
        capture_api_error(e, endpoint="/jobs", method="GET")
        raise HTTPException(status_code=500, detail="Failed to search jobs")


@router.get("/{job_id}", response_model=Job, tags=["Jobs"])
async def get_job_by_id(
    job_id: str = Path(..., description="Job ID"),
    enrich: bool = Query(False, description="Whether to enrich job data with AI insights"),
    db=Depends(get_database),
    cache=Depends(get_cache_manager),
    enricher: JobEnricher = Depends()
):
    """
    Get detailed job information by ID.
    Optionally enrich with AI-powered insights for Professional+ tiers.
    """
    try:
        # Check cache first
        cache_key = f"job:{job_id}:enriched:{enrich}"
        cached_job = await cache.get(cache_key)
        
        if cached_job:
            return cached_job
        
        # Get job from database
        job = await db.get_job_by_id(job_id)
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Enrich job data if requested (Professional+ feature)
        if enrich:
            job = await enricher.enrich_job(job)
        
        # Cache for 10 minutes
        await cache.set(cache_key, job, ttl=600)
        
        return job
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/jobs/{job_id}", method="GET")
        raise HTTPException(status_code=500, detail="Failed to retrieve job")


@router.post("/", response_model=Job, tags=["Jobs"])
async def create_job(
    job_data: JobCreateRequest,
    background_tasks: BackgroundTasks,
    db=Depends(get_database),
    enricher: JobEnricher = Depends()
):
    """
    Create a new job posting.
    Automatically enriches job data with AI insights.
    """
    try:
        add_scraping_breadcrumb("Creating new job", data={"title": job_data.title})
        
        # Create job in database
        job = await db.create_job(job_data.dict())
        
        # Schedule background enrichment
        background_tasks.add_task(enricher.enrich_job_background, job.id)
        
        add_scraping_breadcrumb("Job created successfully", data={"job_id": job.id})
        return job
        
    except Exception as e:
        capture_api_error(e, endpoint="/jobs", method="POST")
        raise HTTPException(status_code=500, detail="Failed to create job")


@router.put("/{job_id}", response_model=Job, tags=["Jobs"])
async def update_job(
    job_id: str,
    job_data: JobUpdateRequest,
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """Update existing job information."""
    try:
        # Check if job exists
        existing_job = await db.get_job_by_id(job_id)
        if not existing_job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Update job
        updated_job = await db.update_job(job_id, job_data.dict(exclude_unset=True))
        
        # Invalidate cache
        await cache.delete_pattern(f"job:{job_id}:*")
        
        return updated_job
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/jobs/{job_id}", method="PUT")
        raise HTTPException(status_code=500, detail="Failed to update job")


@router.delete("/{job_id}", tags=["Jobs"])
async def delete_job(
    job_id: str,
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """Delete a job posting."""
    try:
        # Check if job exists
        existing_job = await db.get_job_by_id(job_id)
        if not existing_job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Delete job
        await db.delete_job(job_id)
        
        # Invalidate cache
        await cache.delete_pattern(f"job:{job_id}:*")
        
        return {"message": "Job deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/jobs/{job_id}", method="DELETE")
        raise HTTPException(status_code=500, detail="Failed to delete job")


@router.get("/similar/{job_id}", response_model=List[Job], tags=["Jobs"])
async def get_similar_jobs(
    job_id: str,
    limit: int = Query(10, le=50),
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """
    Get jobs similar to the specified job using AI-powered similarity matching.
    Professional+ feature.
    """
    try:
        cache_key = f"similar_jobs:{job_id}:{limit}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            return cached_result
        
        # Get base job
        base_job = await db.get_job_by_id(job_id)
        if not base_job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Find similar jobs using vector similarity
        similar_jobs = await db.find_similar_jobs(
            job_embedding=base_job.embedding,
            limit=limit,
            exclude_job_id=job_id
        )
        
        # Cache for 30 minutes
        await cache.set(cache_key, similar_jobs, ttl=1800)
        
        return similar_jobs
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/jobs/similar/{job_id}", method="GET")
        raise HTTPException(status_code=500, detail="Failed to find similar jobs")


@router.get("/trending/skills", tags=["Jobs"])
async def get_trending_skills(
    days: int = Query(30, description="Number of days to analyze"),
    limit: int = Query(20, le=100),
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """
    Get trending skills from recent job postings.
    Executive+ feature for market intelligence.
    """
    try:
        cache_key = f"trending_skills:{days}:{limit}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            return cached_result
        
        # Analyze trending skills
        trending_skills = await db.get_trending_skills(
            since=datetime.utcnow() - timedelta(days=days),
            limit=limit
        )
        
        # Cache for 2 hours
        await cache.set(cache_key, trending_skills, ttl=7200)
        
        return {
            "trending_skills": trending_skills,
            "analysis_period_days": days,
            "generated_at": datetime.utcnow()
        }
        
    except Exception as e:
        capture_api_error(e, endpoint="/jobs/trending/skills", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get trending skills")


@router.get("/analytics/salary-insights", tags=["Jobs"])
async def get_salary_insights(
    title: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    experience_level: Optional[str] = Query(None),
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """
    Get salary insights and benchmarking data.
    Professional+ feature.
    """
    try:
        cache_key = f"salary_insights:{title}:{location}:{experience_level}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            return cached_result
        
        # Get salary insights
        insights = await db.get_salary_insights(
            title=title,
            location=location,
            experience_level=experience_level
        )
        
        # Cache for 4 hours
        await cache.set(cache_key, insights, ttl=14400)
        
        return insights
        
    except Exception as e:
        capture_api_error(e, endpoint="/jobs/analytics/salary-insights", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get salary insights")
