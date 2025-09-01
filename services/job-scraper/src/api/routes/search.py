"""
Advanced search API routes with AI-powered semantic search.
"""

from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, validator
from datetime import datetime, timedelta

from src.config.sentry import capture_api_error, add_scraping_breadcrumb
from src.utils.database import get_database
from src.utils.cache import get_cache_manager

router = APIRouter()


class SemanticSearchRequest(BaseModel):
    """Request model for semantic search."""
    query: str
    search_type: str = "jobs"  # jobs, companies, hybrid
    location: Optional[str] = None
    max_results: int = 50
    similarity_threshold: float = 0.7
    include_embeddings: bool = False
    
    @validator('search_type')
    def validate_search_type(cls, v):
        if v not in ["jobs", "companies", "hybrid"]:
            raise ValueError("search_type must be 'jobs', 'companies', or 'hybrid'")
        return v
    
    @validator('max_results')
    def validate_max_results(cls, v):
        if v > 200:
            raise ValueError("max_results cannot exceed 200")
        return v


class AdvancedSearchFilters(BaseModel):
    """Advanced search filters for power users."""
    # Job-specific filters
    job_types: Optional[List[str]] = None
    experience_levels: Optional[List[str]] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    remote_work: Optional[bool] = None
    skills_required: Optional[List[str]] = None
    skills_optional: Optional[List[str]] = None
    
    # Company-specific filters
    company_sizes: Optional[List[str]] = None
    industries: Optional[List[str]] = None
    company_age_min: Optional[int] = None
    company_age_max: Optional[int] = None
    culture_score_min: Optional[float] = None
    
    # Time-based filters
    posted_since: Optional[datetime] = None
    updated_since: Optional[datetime] = None
    
    # Location filters
    locations: Optional[List[str]] = None
    radius_km: Optional[int] = None
    include_remote: bool = True
    
    # Quality filters
    verified_companies_only: bool = False
    exclude_duplicates: bool = True
    min_job_description_length: Optional[int] = None


class SearchSuggestionResponse(BaseModel):
    """Search suggestions response model."""
    suggestions: List[str]
    categories: Dict[str, List[str]]
    trending_searches: List[str]
    personalized_suggestions: Optional[List[str]] = None


@router.get("/suggest", response_model=SearchSuggestionResponse, tags=["Search"])
async def get_search_suggestions(
    query: str = Query(..., min_length=1, description="Partial search query"),
    suggestion_type: str = Query("all", description="Type of suggestions: all, jobs, companies, skills"),
    limit: int = Query(10, le=20),
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """
    Get intelligent search suggestions based on user input.
    Includes trending searches and personalized recommendations.
    """
    try:
        add_scraping_breadcrumb("Search suggestions requested", data={"query": query[:50]})
        
        cache_key = f"search_suggestions:{query}:{suggestion_type}:{limit}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            return cached_result
        
        # Get suggestions from database
        suggestions_data = await db.get_search_suggestions(
            query=query,
            suggestion_type=suggestion_type,
            limit=limit
        )
        
        response = SearchSuggestionResponse(**suggestions_data)
        
        # Cache for 1 hour
        await cache.set(cache_key, response, ttl=3600)
        
        return response
        
    except Exception as e:
        capture_api_error(e, endpoint="/search/suggest", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get search suggestions")


@router.post("/semantic", tags=["Search"])
async def semantic_search(
    request: SemanticSearchRequest,
    filters: Optional[AdvancedSearchFilters] = None,
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """
    Perform AI-powered semantic search across jobs and companies.
    Professional+ feature with advanced matching algorithms.
    """
    try:
        add_scraping_breadcrumb("Semantic search initiated", data=request.dict())
        
        # Create cache key
        cache_key = f"semantic_search:{hash(str(request.dict()))}:{hash(str(filters.dict() if filters else {}))}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            add_scraping_breadcrumb("Semantic search result served from cache")
            return cached_result
        
        # Perform semantic search
        results = await db.semantic_search(
            query=request.query,
            search_type=request.search_type,
            location=request.location,
            max_results=request.max_results,
            similarity_threshold=request.similarity_threshold,
            filters=filters.dict() if filters else None,
            include_embeddings=request.include_embeddings
        )
        
        response = {
            "query": request.query,
            "search_type": request.search_type,
            "total_results": len(results),
            "results": results,
            "search_metadata": {
                "similarity_threshold": request.similarity_threshold,
                "search_time": datetime.utcnow(),
                "filters_applied": filters.dict() if filters else None
            }
        }
        
        # Cache for 15 minutes
        await cache.set(cache_key, response, ttl=900)
        
        add_scraping_breadcrumb("Semantic search completed", data={"results_count": len(results)})
        return response
        
    except Exception as e:
        capture_api_error(e, endpoint="/search/semantic", method="POST")
        raise HTTPException(status_code=500, detail="Failed to perform semantic search")


@router.get("/trending", tags=["Search"])
async def get_trending_searches(
    time_period: str = Query("week", description="Time period: day, week, month"),
    category: str = Query("all", description="Category: all, jobs, companies, skills"),
    location: Optional[str] = Query(None, description="Filter by location"),
    limit: int = Query(20, le=50),
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """
    Get trending search terms and popular queries.
    Executive+ feature for market intelligence.
    """
    try:
        cache_key = f"trending_searches:{time_period}:{category}:{location}:{limit}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            return cached_result
        
        # Map time period to days
        period_days = {"day": 1, "week": 7, "month": 30}.get(time_period, 7)
        
        # Get trending searches
        trending_data = await db.get_trending_searches(
            since=datetime.utcnow() - timedelta(days=period_days),
            category=category,
            location=location,
            limit=limit
        )
        
        response = {
            "trending_searches": trending_data["searches"],
            "search_volumes": trending_data["volumes"],
            "growth_rates": trending_data.get("growth_rates", []),
            "time_period": time_period,
            "category": category,
            "location": location,
            "generated_at": datetime.utcnow()
        }
        
        # Cache for 2 hours
        await cache.set(cache_key, response, ttl=7200)
        
        return response
        
    except Exception as e:
        capture_api_error(e, endpoint="/search/trending", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get trending searches")


@router.get("/autocomplete", tags=["Search"])
async def autocomplete_search(
    query: str = Query(..., min_length=1, description="Search query to autocomplete"),
    context: str = Query("general", description="Search context: general, job_titles, companies, skills, locations"),
    limit: int = Query(10, le=20),
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """
    Provide intelligent autocomplete suggestions for search queries.
    """
    try:
        cache_key = f"autocomplete:{query}:{context}:{limit}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            return cached_result
        
        # Get autocomplete suggestions
        suggestions = await db.get_autocomplete_suggestions(
            query=query,
            context=context,
            limit=limit
        )
        
        response = {
            "query": query,
            "suggestions": suggestions,
            "context": context
        }
        
        # Cache for 6 hours
        await cache.set(cache_key, response, ttl=21600)
        
        return response
        
    except Exception as e:
        capture_api_error(e, endpoint="/search/autocomplete", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get autocomplete suggestions")


@router.post("/similar-profiles", tags=["Search"])
async def find_similar_profiles(
    profile_data: Dict[str, Any],
    search_radius: int = Query(50, description="Search radius for similar profiles"),
    min_similarity: float = Query(0.7, description="Minimum similarity score"),
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """
    Find similar career profiles and job seekers.
    Executive+ feature for networking and talent acquisition.
    """
    try:
        cache_key = f"similar_profiles:{hash(str(profile_data))}:{search_radius}:{min_similarity}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            return cached_result
        
        # Find similar profiles using AI matching
        similar_profiles = await db.find_similar_profiles(
            profile_data=profile_data,
            search_radius=search_radius,
            min_similarity=min_similarity
        )
        
        response = {
            "similar_profiles": similar_profiles,
            "match_criteria": {
                "search_radius": search_radius,
                "min_similarity": min_similarity,
                "profile_features": list(profile_data.keys())
            },
            "total_matches": len(similar_profiles)
        }
        
        # Cache for 4 hours
        await cache.set(cache_key, response, ttl=14400)
        
        return response
        
    except Exception as e:
        capture_api_error(e, endpoint="/search/similar-profiles", method="POST")
        raise HTTPException(status_code=500, detail="Failed to find similar profiles")


@router.get("/market-insights", tags=["Search"])
async def get_search_market_insights(
    search_terms: List[str] = Query(..., description="Search terms to analyze"),
    time_period: int = Query(90, description="Analysis period in days"),
    location: Optional[str] = Query(None),
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """
    Get market insights based on search patterns and job availability.
    Enterprise tier feature for strategic career planning.
    """
    try:
        cache_key = f"search_market_insights:{':'.join(sorted(search_terms))}:{time_period}:{location}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            return cached_result
        
        # Analyze market insights
        insights = await db.analyze_search_market_insights(
            search_terms=search_terms,
            since=datetime.utcnow() - timedelta(days=time_period),
            location=location
        )
        
        response = {
            "market_insights": insights,
            "analysis_period_days": time_period,
            "search_terms": search_terms,
            "location": location,
            "generated_at": datetime.utcnow()
        }
        
        # Cache for 8 hours
        await cache.set(cache_key, response, ttl=28800)
        
        return response
        
    except Exception as e:
        capture_api_error(e, endpoint="/search/market-insights", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get market insights")


@router.get("/export", tags=["Search"])
async def export_search_results(
    search_id: str = Query(..., description="Search result ID to export"),
    export_format: str = Query("json", description="Export format: json, csv, pdf"),
    include_metadata: bool = Query(True, description="Include search metadata"),
    db=Depends(get_database),
    cache=Depends(get_cache_manager)
):
    """
    Export search results in various formats.
    Professional+ feature for data portability.
    """
    try:
        if export_format not in ["json", "csv", "pdf"]:
            raise HTTPException(status_code=400, detail="Invalid export format")
        
        # Get search results
        search_results = await db.get_search_results_by_id(search_id)
        
        if not search_results:
            raise HTTPException(status_code=404, detail="Search results not found")
        
        # Format results for export
        exported_data = await db.format_search_results_for_export(
            search_results=search_results,
            export_format=export_format,
            include_metadata=include_metadata
        )
        
        return {
            "export_data": exported_data,
            "format": export_format,
            "search_id": search_id,
            "exported_at": datetime.utcnow(),
            "record_count": len(search_results.get("results", []))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint="/search/export", method="GET")
        raise HTTPException(status_code=500, detail="Failed to export search results")
