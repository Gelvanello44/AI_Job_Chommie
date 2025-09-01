"""
Companies API routes for company intelligence and insights.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, Path
from pydantic import BaseModel
from datetime import datetime, timedelta

from src.config.sentry import capture_api_error, add_scraping_breadcrumb
from src.utils.database import get_database
from src.utils.cache import get_cache_manager

router = APIRouter()


class CompanyProfile(BaseModel):
    """Company profile model."""
    id: str
    name: str
    website: Optional[str] = None
    industry: Optional[str] = None
    size_range: Optional[str] = None
    headquarters: Optional[str] = None
    founded_year: Optional[int] = None
    description: Optional[str] = None
    culture_score: Optional[float] = None
    benefits_score: Optional[float] = None
    career_growth_score: Optional[float] = None
    work_life_balance_score: Optional[float] = None
    diversity_score: Optional[float] = None
    total_jobs: int = 0
    active_jobs: int = 0
    avg_salary_range: Optional[tuple] = None
    recent_news: List[Dict[str, Any]] = []
    leadership_info: Optional[Dict[str, Any]] = None


class CompanySearchRequest(BaseModel):
    """Company search request model."""
    query: Optional[str] = None
    industry: Optional[str] = None
    location: Optional[str] = None
    size_range: Optional[str] = None
    min_culture_score: Optional[float] = None
    has_remote_jobs: Optional[bool] = None
    limit: int = 20
    offset: int = 0


@router.get("/", tags=["Companies"])
async def search_companies(
    request: CompanySearchRequest = Depends(),
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """
    Search companies with filtering and culture insights.
    Professional+ feature with advanced company intelligence.
    """
    try:
        add_scraping_breadcrumb("Company search initiated", data=request.dict())
        
        # Check cache first
        cache_key = f"company_search:{hash(str(request.dict()))}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            return cached_result
        
        # Execute search
        companies, total_count = await db.search_companies(
            query=request.query,
            industry=request.industry,
            location=request.location,
            size_range=request.size_range,
            min_culture_score=request.min_culture_score,
            has_remote_jobs=request.has_remote_jobs,
            limit=request.limit,
            offset=request.offset
        )
        
        response = {
            "companies": companies,
            "total": total_count,
            "limit": request.limit,
            "offset": request.offset
        }
        
        # Cache for 30 minutes
        await cache.set(cache_key, response, ttl=1800)
        
        return response
        
    except Exception as e:
        capture_api_error(e, endpoint="/companies", method="GET")
        raise HTTPException(status_code=500, detail="Failed to search companies")


@router.get("/{company_id}", response_model=CompanyProfile, tags=["Companies"])
async def get_company_profile(
    company_id: str = Path(..., description="Company ID"),
    include_leadership: bool = Query(False, description="Include leadership information (Executive+ feature)"),
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """
    Get detailed company profile with culture insights.
    Executive+ features include leadership information.
    """
    try:
        cache_key = f"company_profile:{company_id}:leadership:{include_leadership}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            return cached_result
        
        # Get company profile
        company = await db.get_company_profile(company_id, include_leadership=include_leadership)
        
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        
        # Cache for 4 hours
        await cache.set(cache_key, company, ttl=14400)
        
        return company
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/companies/{company_id}", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get company profile")


@router.get("/{company_id}/jobs", tags=["Companies"])
async def get_company_jobs(
    company_id: str,
    active_only: bool = Query(True),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """Get all jobs posted by a specific company."""
    try:
        cache_key = f"company_jobs:{company_id}:{active_only}:{limit}:{offset}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            return cached_result
        
        # Get company jobs
        jobs, total_count = await db.get_company_jobs(
            company_id=company_id,
            active_only=active_only,
            limit=limit,
            offset=offset
        )
        
        response = {
            "jobs": jobs,
            "total": total_count,
            "company_id": company_id,
            "limit": limit,
            "offset": offset
        }
        
        # Cache for 15 minutes
        await cache.set(cache_key, response, ttl=900)
        
        return response
        
    except Exception as e:
        capture_api_error(e, endpoint=f"/companies/{company_id}/jobs", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get company jobs")


@router.get("/{company_id}/culture", tags=["Companies"])
async def get_company_culture_insights(
    company_id: str,
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """
    Get detailed company culture insights and employee reviews.
    Professional+ feature with AI-powered culture analysis.
    """
    try:
        cache_key = f"company_culture:{company_id}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            return cached_result
        
        # Get culture insights
        culture_data = await db.get_company_culture_insights(company_id)
        
        if not culture_data:
            raise HTTPException(status_code=404, detail="Company culture data not found")
        
        # Cache for 6 hours
        await cache.set(cache_key, culture_data, ttl=21600)
        
        return culture_data
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/companies/{company_id}/culture", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get company culture insights")


@router.get("/{company_id}/salary-bands", tags=["Companies"])
async def get_company_salary_bands(
    company_id: str,
    role_category: Optional[str] = Query(None),
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """
    Get salary bands and compensation data for a company.
    Professional+ feature.
    """
    try:
        cache_key = f"company_salary_bands:{company_id}:{role_category}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            return cached_result
        
        # Get salary bands
        salary_data = await db.get_company_salary_bands(
            company_id=company_id,
            role_category=role_category
        )
        
        # Cache for 8 hours
        await cache.set(cache_key, salary_data, ttl=28800)
        
        return salary_data
        
    except Exception as e:
        capture_api_error(e, endpoint=f"/companies/{company_id}/salary-bands", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get company salary bands")


@router.get("/trending/hiring", tags=["Companies"])
async def get_trending_hiring_companies(
    location: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    time_period: int = Query(30, description="Days to analyze"),
    limit: int = Query(20, le=50),
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """
    Get companies that are actively hiring based on recent job postings.
    Executive+ feature for market intelligence.
    """
    try:
        cache_key = f"trending_hiring:{location}:{industry}:{time_period}:{limit}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            return cached_result
        
        # Get trending hiring companies
        trending_companies = await db.get_trending_hiring_companies(
            location=location,
            industry=industry,
            since=datetime.utcnow() - timedelta(days=time_period),
            limit=limit
        )
        
        response = {
            "trending_companies": trending_companies,
            "analysis_period_days": time_period,
            "location": location,
            "industry": industry,
            "generated_at": datetime.utcnow()
        }
        
        # Cache for 4 hours
        await cache.set(cache_key, response, ttl=14400)
        
        return response
        
    except Exception as e:
        capture_api_error(e, endpoint="/companies/trending/hiring", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get trending hiring companies")


@router.get("/{company_id}/growth-trajectory", tags=["Companies"])
async def get_company_growth_trajectory(
    company_id: str,
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """
    Get company growth trajectory and expansion patterns.
    Enterprise tier feature for strategic career planning.
    """
    try:
        cache_key = f"company_growth:{company_id}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            return cached_result
        
        # Get growth trajectory data
        growth_data = await db.get_company_growth_trajectory(company_id)
        
        if not growth_data:
            raise HTTPException(status_code=404, detail="Company growth data not found")
        
        # Cache for 12 hours
        await cache.set(cache_key, growth_data, ttl=43200)
        
        return growth_data
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/companies/{company_id}/growth-trajectory", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get company growth trajectory")


@router.get("/compare", tags=["Companies"])
async def compare_companies(
    company_ids: List[str] = Query(..., description="List of company IDs to compare"),
    metrics: List[str] = Query(["culture", "salary", "benefits"], description="Metrics to compare"),
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """
    Compare multiple companies across various metrics.
    Professional+ feature.
    """
    try:
        if len(company_ids) > 5:
            raise HTTPException(status_code=400, detail="Cannot compare more than 5 companies")
        
        cache_key = f"company_compare:{':'.join(sorted(company_ids))}:{':'.join(sorted(metrics))}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            return cached_result
        
        # Get comparison data
        comparison_data = await db.compare_companies(
            company_ids=company_ids,
            metrics=metrics
        )
        
        # Cache for 2 hours
        await cache.set(cache_key, comparison_data, ttl=7200)
        
        return comparison_data
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint="/companies/compare", method="GET")
        raise HTTPException(status_code=500, detail="Failed to compare companies")
