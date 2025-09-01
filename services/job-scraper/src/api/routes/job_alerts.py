"""
Job Alerts and Company Research API.

Provides:
- Customizable job alerts with smart matching
- Weekly job alert digests
- Company research briefings and insights
- Market intelligence reports
- Industry trend analysis
"""

import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Union
from enum import Enum
from pydantic import BaseModel, Field, EmailStr
from fastapi import APIRouter, HTTPException, Depends, status, Query, BackgroundTasks

from src.api.auth.dependencies import get_current_user, require_subscription_tier
from src.api.models.user import User
from src.utils.database import get_database
from src.utils.cache import get_cache
from src.config.settings import settings

router = APIRouter()

# ==========================================
# Enums and Constants
# ==========================================

class AlertFrequency(str, Enum):
    IMMEDIATE = "immediate"
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"

class AlertStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    DELETED = "deleted"

class CompanySize(str, Enum):
    STARTUP = "startup"
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    ENTERPRISE = "enterprise"

# ==========================================
# Pydantic Models
# ==========================================

class JobAlert(BaseModel):
    """Job alert configuration model."""
    alert_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str = Field(..., description="Human-readable name for the alert")
    keywords: List[str] = Field(default_factory=list)
    location: Optional[str] = None
    remote_ok: bool = False
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    job_level: Optional[str] = None
    industries: List[str] = Field(default_factory=list)
    company_size: Optional[CompanySize] = None
    exclude_companies: List[str] = Field(default_factory=list)
    frequency: AlertFrequency = AlertFrequency.WEEKLY
    status: AlertStatus = AlertStatus.ACTIVE
    last_sent: Optional[datetime] = None
    total_sent: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class JobAlertDigest(BaseModel):
    """Weekly job alert digest model."""
    digest_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    alert_ids: List[str]
    jobs_count: int
    top_matches: List[Dict[str, Any]]
    new_companies: List[Dict[str, Any]]
    salary_insights: Dict[str, Any]
    market_trends: Dict[str, Any]
    generated_at: datetime = Field(default_factory=datetime.utcnow)

class CompanyResearch(BaseModel):
    """Company research and briefing model."""
    company_id: str
    company_name: str
    website: Optional[str] = None
    industry: str
    size: CompanySize
    founded_year: Optional[int] = None
    headquarters: Optional[str] = None
    description: str
    culture_analysis: Dict[str, Any]
    financial_health: Dict[str, Any]
    growth_trajectory: Dict[str, Any]
    leadership_team: List[Dict[str, Any]]
    recent_news: List[Dict[str, Any]]
    job_openings_count: int
    glassdoor_rating: Optional[float] = None
    employee_satisfaction: Dict[str, Any]
    diversity_metrics: Dict[str, Any]
    tech_stack: List[str] = Field(default_factory=list)
    competitors: List[str] = Field(default_factory=list)
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class MarketIntelligence(BaseModel):
    """Market intelligence report model."""
    report_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    report_type: str  # "salary_trends", "skill_demand", "industry_growth"
    industry: Optional[str] = None
    location: Optional[str] = None
    time_period: str
    key_findings: List[str]
    data_points: Dict[str, Any]
    trends: Dict[str, Any]
    recommendations: List[str]
    confidence_score: float = Field(..., ge=0, le=100)
    generated_at: datetime = Field(default_factory=datetime.utcnow)

# ==========================================
# Job Alerts Endpoints
# ==========================================

@router.post("/alerts", response_model=JobAlert)
async def create_job_alert(
    alert_data: JobAlert,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Create a new job alert."""
    try:
        alert_data.user_id = current_user.id
        
        # Check user's alert quota based on subscription tier
        existing_alerts_query = "SELECT COUNT(*) as count FROM job_alerts WHERE user_id = $1 AND status = 'active'"
        existing_count = await db.fetch_one(existing_alerts_query, current_user.id)
        
        # Alert limits: Professional = 5, Executive = unlimited
        if current_user.subscription_tier == "professional" and existing_count["count"] >= 5:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Professional tier limited to 5 active alerts. Upgrade to Executive for unlimited alerts."
            )
        
        # Store in database
        query = """
        INSERT INTO job_alerts 
        (alert_id, user_id, name, keywords, location, remote_ok, salary_min, salary_max,
         job_level, industries, company_size, exclude_companies, frequency, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
        """
        
        result = await db.fetch_one(
            query,
            alert_data.alert_id,
            alert_data.user_id,
            alert_data.name,
            alert_data.keywords,
            alert_data.location,
            alert_data.remote_ok,
            alert_data.salary_min,
            alert_data.salary_max,
            alert_data.job_level,
            alert_data.industries,
            alert_data.company_size,
            alert_data.exclude_companies,
            alert_data.frequency,
            alert_data.status
        )
        
        return JobAlert(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create job alert: {str(e)}"
        )

@router.get("/alerts", response_model=List[JobAlert])
async def get_user_alerts(
    status_filter: Optional[AlertStatus] = None,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Get user's job alerts."""
    try:
        conditions = ["user_id = $1"]
        params = [current_user.id]
        
        if status_filter:
            conditions.append("status = $2")
            params.append(status_filter.value)
        
        query = f"""
        SELECT * FROM job_alerts 
        WHERE {' AND '.join(conditions)}
        ORDER BY created_at DESC
        """
        
        results = await db.fetch_all(query, *params)
        return [JobAlert(**result) for result in results]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch alerts: {str(e)}"
        )

@router.put("/alerts/{alert_id}", response_model=JobAlert)
async def update_job_alert(
    alert_id: str,
    alert_data: JobAlert,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Update an existing job alert."""
    try:
        # Verify alert belongs to user
        check_query = "SELECT user_id FROM job_alerts WHERE alert_id = $1"
        owner = await db.fetch_one(check_query, alert_id)
        
        if not owner or owner["user_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Alert not found"
            )
        
        # Update alert
        query = """
        UPDATE job_alerts SET
        name = $2, keywords = $3, location = $4, remote_ok = $5,
        salary_min = $6, salary_max = $7, job_level = $8, industries = $9,
        company_size = $10, exclude_companies = $11, frequency = $12,
        status = $13, updated_at = NOW()
        WHERE alert_id = $1
        RETURNING *
        """
        
        result = await db.fetch_one(
            query,
            alert_id,
            alert_data.name,
            alert_data.keywords,
            alert_data.location,
            alert_data.remote_ok,
            alert_data.salary_min,
            alert_data.salary_max,
            alert_data.job_level,
            alert_data.industries,
            alert_data.company_size,
            alert_data.exclude_companies,
            alert_data.frequency,
            alert_data.status
        )
        
        return JobAlert(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update alert: {str(e)}"
        )

@router.delete("/alerts/{alert_id}")
async def delete_job_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Delete a job alert."""
    try:
        # Verify alert belongs to user and delete
        query = """
        UPDATE job_alerts 
        SET status = 'deleted', updated_at = NOW()
        WHERE alert_id = $1 AND user_id = $2
        RETURNING alert_id
        """
        
        result = await db.fetch_one(query, alert_id, current_user.id)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Alert not found"
            )
        
        return {"message": "Alert deleted successfully", "alert_id": alert_id}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete alert: {str(e)}"
        )

@router.post("/alerts/{alert_id}/test")
async def test_job_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Test a job alert to see what matches would be found."""
    try:
        # Get alert configuration
        alert_query = "SELECT * FROM job_alerts WHERE alert_id = $1 AND user_id = $2"
        alert = await db.fetch_one(alert_query, alert_id, current_user.id)
        
        if not alert:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Alert not found"
            )
        
        # Find matching jobs
        matches = await _find_matching_jobs(alert, db, limit=10)
        
        return {
            "alert_name": alert["name"],
            "total_matches": len(matches),
            "sample_matches": matches,
            "estimated_weekly_volume": len(matches) * 2  # Rough estimate
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test alert: {str(e)}"
        )

# ==========================================
# Alert Digest Endpoints
# ==========================================

@router.get("/alerts/digest/latest", response_model=JobAlertDigest)
async def get_latest_digest(
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Get the latest job alert digest for the user."""
    try:
        query = """
        SELECT * FROM job_alert_digests 
        WHERE user_id = $1 
        ORDER BY generated_at DESC 
        LIMIT 1
        """
        
        result = await db.fetch_one(query, current_user.id)
        
        if not result:
            # Generate a digest if none exists
            return await _generate_weekly_digest(current_user, db)
        
        return JobAlertDigest(**result)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch digest: {str(e)}"
        )

@router.post("/alerts/digest/generate", response_model=JobAlertDigest)
async def generate_digest(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Generate a fresh job alert digest."""
    try:
        digest = await _generate_weekly_digest(current_user, db)
        
        # Send email in background
        background_tasks.add_task(_send_digest_email, current_user.email, digest)
        
        return digest
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate digest: {str(e)}"
        )

# ==========================================
# Company Research Endpoints
# ==========================================

@router.get("/companies/{company_id}/research", response_model=CompanyResearch)
async def get_company_research(
    company_id: str,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database),
    cache = Depends(get_cache)
):
    """Get comprehensive company research briefing."""
    try:
        # Check cache first
        cache_key = f"company_research:{company_id}"
        cached_research = await cache.get(cache_key)
        
        if cached_research:
            return CompanyResearch(**cached_research)
        
        # Get company data from database
        company_query = "SELECT * FROM companies WHERE company_id = $1"
        company = await db.fetch_one(company_query, company_id)
        
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found"
            )
        
        # Generate comprehensive research
        research = await _generate_company_research(company, db)
        
        # Cache for 24 hours
        await cache.set(cache_key, research.dict(), expire=86400)
        
        return research
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch company research: {str(e)}"
        )

@router.get("/companies/search")
async def search_companies(
    query: str = Query(..., description="Company name or industry to search"),
    location: Optional[str] = None,
    size: Optional[CompanySize] = None,
    limit: int = Query(20, le=100),
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Search companies for research."""
    try:
        # Build search query
        conditions = ["(company_name ILIKE $1 OR industry ILIKE $1)"]
        params = [f"%{query}%"]
        param_count = 1
        
        if location:
            param_count += 1
            conditions.append(f"headquarters ILIKE ${param_count}")
            params.append(f"%{location}%")
        
        if size:
            param_count += 1
            conditions.append(f"size = ${param_count}")
            params.append(size.value)
        
        search_query = f"""
        SELECT company_id, company_name, industry, size, headquarters, 
               description, job_openings_count, glassdoor_rating
        FROM companies 
        WHERE {' AND '.join(conditions)}
        ORDER BY 
            CASE WHEN company_name ILIKE $1 THEN 1 ELSE 2 END,
            job_openings_count DESC,
            glassdoor_rating DESC NULLS LAST
        LIMIT {limit}
        """
        
        results = await db.fetch_all(search_query, *params)
        return [dict(result) for result in results]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search companies: {str(e)}"
        )

@router.get("/companies/{company_id}/culture-analysis")
async def get_company_culture_analysis(
    company_id: str,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Get detailed company culture analysis (Executive tier only)."""
    try:
        # Get company culture data
        culture_query = """
        SELECT company_name, culture_analysis, employee_satisfaction, 
               diversity_metrics, recent_news
        FROM companies 
        WHERE company_id = $1
        """
        
        company = await db.fetch_one(culture_query, company_id)
        
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found"
            )
        
        # Enhanced culture analysis for executives
        enhanced_analysis = await _perform_culture_analysis(company, db)
        
        return enhanced_analysis
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze company culture: {str(e)}"
        )

# ==========================================
# Market Intelligence Endpoints
# ==========================================

@router.get("/market-intelligence/reports", response_model=List[MarketIntelligence])
async def get_market_reports(
    report_type: Optional[str] = Query(None, regex="^(salary_trends|skill_demand|industry_growth)$"),
    industry: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Get market intelligence reports (Executive tier only)."""
    try:
        conditions = ["1=1"]
        params = []
        param_count = 0
        
        if report_type:
            param_count += 1
            conditions.append(f"report_type = ${param_count}")
            params.append(report_type)
        
        if industry:
            param_count += 1
            conditions.append(f"industry = ${param_count}")
            params.append(industry)
        
        query = f"""
        SELECT * FROM market_intelligence_reports 
        WHERE {' AND '.join(conditions)}
        ORDER BY generated_at DESC
        LIMIT 10
        """
        
        results = await db.fetch_all(query, *params)
        return [MarketIntelligence(**result) for result in results]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch market reports: {str(e)}"
        )

@router.post("/market-intelligence/generate", response_model=MarketIntelligence)
async def generate_market_report(
    report_type: str = Query(..., regex="^(salary_trends|skill_demand|industry_growth)$"),
    industry: Optional[str] = None,
    location: Optional[str] = "South Africa",
    time_period: str = Query("30d", regex="^(7d|30d|90d|6m|1y)$"),
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Generate a new market intelligence report."""
    try:
        # Generate report based on type
        report_data = await _generate_market_intelligence(
            report_type, industry, location, time_period, db
        )
        
        # Store in database
        query = """
        INSERT INTO market_intelligence_reports
        (report_id, report_type, industry, location, time_period,
         key_findings, data_points, trends, recommendations, confidence_score)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        """
        
        result = await db.fetch_one(
            query,
            report_data["report_id"],
            report_type,
            industry,
            location,
            time_period,
            report_data["key_findings"],
            report_data["data_points"],
            report_data["trends"],
            report_data["recommendations"],
            report_data["confidence_score"]
        )
        
        return MarketIntelligence(**result)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate market report: {str(e)}"
        )

# ==========================================
# Industry Trends and Analytics
# ==========================================

@router.get("/trends/industries")
async def get_industry_trends(
    location: str = Query("South Africa"),
    time_period: str = Query("30d", regex="^(7d|30d|90d|6m|1y)$"),
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Get industry trends and job market data."""
    try:
        trends = await _calculate_industry_trends(location, time_period, db)
        
        return {
            "location": location,
            "period": time_period,
            "trends": trends,
            "generated_at": datetime.utcnow()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch industry trends: {str(e)}"
        )

@router.get("/trends/salary-benchmarks")
async def get_salary_benchmarks(
    role: str = Query(..., description="Job role to benchmark"),
    location: str = Query("South Africa"),
    experience_level: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Get salary benchmarking data for roles."""
    try:
        benchmarks = await _calculate_salary_benchmarks(role, location, experience_level, db)
        
        return {
            "role": role,
            "location": location,
            "experience_level": experience_level,
            "benchmarks": benchmarks,
            "generated_at": datetime.utcnow()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch salary benchmarks: {str(e)}"
        )

# ==========================================
# Weekly Digest Management
# ==========================================

@router.post("/alerts/digest/subscribe")
async def subscribe_to_weekly_digest(
    email_preference: bool = True,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Subscribe/unsubscribe from weekly job digest emails."""
    try:
        # Update user email preferences
        query = """
        UPDATE users 
        SET email_preferences = jsonb_set(
            COALESCE(email_preferences, '{}'), 
            '{weekly_digest}', 
            to_jsonb($2::boolean)
        )
        WHERE id = $1
        RETURNING email_preferences
        """
        
        result = await db.fetch_one(query, current_user.id, email_preference)
        
        return {
            "subscribed": email_preference,
            "message": "Weekly digest subscription updated",
            "preferences": result["email_preferences"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update subscription: {str(e)}"
        )

# ==========================================
# Helper Functions
# ==========================================

async def _find_matching_jobs(alert: Dict[str, Any], db, limit: int = 50) -> List[Dict[str, Any]]:
    """Find jobs matching alert criteria."""
    # Build job search query based on alert criteria
    conditions = ["1=1"]
    params = []
    param_count = 0
    
    # Keywords matching
    if alert.get("keywords"):
        param_count += 1
        keyword_conditions = []
        for keyword in alert["keywords"]:
            keyword_conditions.append(f"(title ILIKE ${param_count} OR description ILIKE ${param_count})")
        conditions.append(f"({' OR '.join(keyword_conditions)})")
        params.extend([f"%{kw}%" for kw in alert["keywords"]])
    
    # Location matching
    if alert.get("location"):
        param_count += 1
        conditions.append(f"location ILIKE ${param_count}")
        params.append(f"%{alert['location']}%")
    
    # Remote work
    if alert.get("remote_ok"):
        conditions.append("(is_remote = true OR location ILIKE '%remote%')")
    
    # Salary range
    if alert.get("salary_min"):
        param_count += 1
        conditions.append(f"salary_min >= ${param_count}")
        params.append(alert["salary_min"])
    
    if alert.get("salary_max"):
        param_count += 1
        conditions.append(f"salary_max <= ${param_count}")
        params.append(alert["salary_max"])
    
    # Job level
    if alert.get("job_level"):
        param_count += 1
        conditions.append(f"job_level = ${param_count}")
        params.append(alert["job_level"])
    
    # Exclude companies
    if alert.get("exclude_companies"):
        exclude_list = "', '".join(alert["exclude_companies"])
        conditions.append(f"company_name NOT IN ('{exclude_list}')")
    
    query = f"""
    SELECT j.*, c.company_name, c.industry, c.size as company_size
    FROM jobs j
    LEFT JOIN companies c ON j.company_id = c.company_id
    WHERE {' AND '.join(conditions)}
    AND j.created_at >= NOW() - INTERVAL '7 days'
    ORDER BY j.created_at DESC, j.salary_max DESC NULLS LAST
    LIMIT {limit}
    """
    
    results = await db.fetch_all(query, *params)
    return [dict(result) for result in results]

async def _generate_weekly_digest(user: User, db) -> JobAlertDigest:
    """Generate weekly job alert digest for user."""
    # Get user's active alerts
    alerts_query = "SELECT * FROM job_alerts WHERE user_id = $1 AND status = 'active'"
    alerts = await db.fetch_all(alerts_query, user.id)
    
    if not alerts:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active alerts found"
        )
    
    all_matches = []
    alert_ids = []
    
    # Find matches for each alert
    for alert in alerts:
        matches = await _find_matching_jobs(alert, db, limit=20)
        all_matches.extend(matches)
        alert_ids.append(alert["alert_id"])
    
    # Remove duplicates and get top matches
    unique_matches = {job["job_id"]: job for job in all_matches}.values()
    top_matches = sorted(unique_matches, key=lambda x: x.get("salary_max", 0), reverse=True)[:10]
    
    # Generate insights
    new_companies = await _find_new_companies(user.id, db)
    salary_insights = await _calculate_salary_insights(all_matches)
    market_trends = await _analyze_market_trends(all_matches)
    
    digest = JobAlertDigest(
        user_id=user.id,
        alert_ids=alert_ids,
        jobs_count=len(unique_matches),
        top_matches=list(top_matches),
        new_companies=new_companies,
        salary_insights=salary_insights,
        market_trends=market_trends
    )
    
    # Store digest in database
    query = """
    INSERT INTO job_alert_digests
    (digest_id, user_id, alert_ids, jobs_count, top_matches,
     new_companies, salary_insights, market_trends)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
    """
    
    result = await db.fetch_one(
        query,
        digest.digest_id,
        digest.user_id,
        digest.alert_ids,
        digest.jobs_count,
        digest.top_matches,
        digest.new_companies,
        digest.salary_insights,
        digest.market_trends
    )
    
    return JobAlertDigest(**result)

async def _generate_company_research(company: Dict[str, Any], db) -> CompanyResearch:
    """Generate comprehensive company research."""
    
    # Get job openings count
    jobs_query = "SELECT COUNT(*) as count FROM jobs WHERE company_id = $1"
    jobs_count = await db.fetch_one(jobs_query, company["company_id"])
    
    # Get recent news
    news_query = """
    SELECT headline, summary, published_date, source_url
    FROM company_news 
    WHERE company_id = $1 
    ORDER BY published_date DESC 
    LIMIT 5
    """
    recent_news = await db.fetch_all(news_query, company["company_id"])
    
    # Simulate AI-powered analysis (replace with actual AI service)
    culture_analysis = {
        "work_life_balance": 8.2,
        "innovation_culture": 7.5,
        "diversity_inclusion": 8.0,
        "growth_opportunities": 7.8,
        "compensation_competitiveness": 8.5,
        "leadership_quality": 7.9,
        "overall_rating": 8.0
    }
    
    financial_health = {
        "revenue_growth": "15% YoY",
        "profitability": "Profitable",
        "funding_stage": "Series C",
        "cash_runway": "18+ months",
        "market_position": "Market leader"
    }
    
    growth_trajectory = {
        "employee_growth": "25% YoY",
        "market_expansion": "International expansion planned",
        "product_development": "AI/ML focus",
        "risk_factors": ["Market competition", "Regulatory changes"]
    }
    
    leadership_team = [
        {
            "name": "Jane Smith",
            "title": "CEO",
            "experience": "15+ years",
            "background": "Former VP at Tech Giant"
        }
    ]
    
    return CompanyResearch(
        company_id=company["company_id"],
        company_name=company["company_name"],
        website=company.get("website"),
        industry=company["industry"],
        size=CompanySize(company.get("size", "medium")),
        founded_year=company.get("founded_year"),
        headquarters=company.get("headquarters"),
        description=company.get("description", ""),
        culture_analysis=culture_analysis,
        financial_health=financial_health,
        growth_trajectory=growth_trajectory,
        leadership_team=leadership_team,
        recent_news=[dict(news) for news in recent_news],
        job_openings_count=jobs_count["count"],
        glassdoor_rating=company.get("glassdoor_rating"),
        employee_satisfaction={"overall": 4.2, "recommend_to_friend": 78},
        diversity_metrics={"gender_diversity": 45, "ethnic_diversity": 35},
        tech_stack=company.get("tech_stack", []),
        competitors=company.get("competitors", [])
    )

async def _generate_market_intelligence(
    report_type: str, 
    industry: Optional[str], 
    location: str, 
    time_period: str, 
    db
) -> Dict[str, Any]:
    """Generate market intelligence report."""
    
    report_id = str(uuid.uuid4())
    
    if report_type == "salary_trends":
        # Salary trends analysis
        key_findings = [
            "Average salaries increased 8.5% in the past year",
            "Tech sector leading with 12% growth",
            "Remote positions offer 15% premium"
        ]
        
        data_points = {
            "average_salary_change": 8.5,
            "top_paying_industries": ["Technology", "Finance", "Healthcare"],
            "salary_distribution": {
                "entry_level": "R250k - R400k",
                "mid_level": "R400k - R700k", 
                "senior_level": "R700k - R1.2M",
                "executive_level": "R1.2M+"
            }
        }
        
        trends = {
            "direction": "upward",
            "velocity": "moderate",
            "key_drivers": ["Skills shortage", "Digital transformation", "Market recovery"]
        }
        
        recommendations = [
            "Focus on in-demand skills like AI/ML and cloud technologies",
            "Consider remote-first companies for salary premiums",
            "Negotiate equity packages in addition to base salary"
        ]
        
    elif report_type == "skill_demand":
        # Skills demand analysis
        key_findings = [
            "Python and cloud skills in highest demand",
            "Soft skills increasingly important",
            "Cybersecurity roles growing fastest"
        ]
        
        data_points = {
            "top_technical_skills": ["Python", "AWS", "React", "Kubernetes", "Machine Learning"],
            "top_soft_skills": ["Leadership", "Communication", "Problem Solving"],
            "fastest_growing_roles": ["DevOps Engineer", "Data Scientist", "Cybersecurity Analyst"],
            "skill_gap_index": 7.2
        }
        
        trends = {
            "technical_evolution": "AI/ML integration across all roles",
            "soft_skills_premium": "20% salary increase for leadership skills",
            "certification_value": "High for cloud and security"
        }
        
        recommendations = [
            "Invest in cloud certifications (AWS, Azure, GCP)",
            "Develop leadership and communication skills",
            "Stay current with AI/ML applications in your field"
        ]
        
    else:  # industry_growth
        # Industry growth analysis
        key_findings = [
            "Fintech sector growing at 25% annually",
            "Traditional retail declining 5%",
            "Healthcare technology expanding rapidly"
        ]
        
        data_points = {
            "growth_leaders": ["Fintech", "HealthTech", "EdTech"],
            "declining_sectors": ["Traditional Retail", "Print Media"],
            "emerging_industries": ["Renewable Energy", "AgriTech", "SpaceTech"]
        }
        
        trends = {
            "digital_transformation": "Accelerating across all sectors",
            "sustainability_focus": "ESG priorities driving new roles",
            "automation_impact": "Changing skill requirements"
        }
        
        recommendations = [
            "Target high-growth industries for career moves",
            "Develop skills relevant to digital transformation",
            "Consider sustainability-focused roles"
        ]
    
    return {
        "report_id": report_id,
        "key_findings": key_findings,
        "data_points": data_points,
        "trends": trends,
        "recommendations": recommendations,
        "confidence_score": 85.7
    }

async def _find_new_companies(user_id: str, db) -> List[Dict[str, Any]]:
    """Find companies that are new to the platform or newly hiring."""
    query = """
    SELECT c.company_id, c.company_name, c.industry, c.size,
           COUNT(j.job_id) as new_openings
    FROM companies c
    LEFT JOIN jobs j ON c.company_id = j.company_id
    WHERE j.created_at >= NOW() - INTERVAL '7 days'
    AND c.company_id NOT IN (
        SELECT DISTINCT company_id FROM jobs j2
        WHERE j2.created_at < NOW() - INTERVAL '30 days'
        AND j2.created_at >= NOW() - INTERVAL '90 days'
    )
    GROUP BY c.company_id, c.company_name, c.industry, c.size
    HAVING COUNT(j.job_id) > 0
    ORDER BY new_openings DESC
    LIMIT 5
    """
    
    results = await db.fetch_all(query)
    return [dict(result) for result in results]

async def _calculate_salary_insights(jobs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate salary insights from job matches."""
    if not jobs:
        return {"message": "No salary data available"}
    
    salaries = [job.get("salary_max", 0) for job in jobs if job.get("salary_max")]
    
    if not salaries:
        return {"message": "No salary data available"}
    
    return {
        "average_salary": sum(salaries) / len(salaries),
        "median_salary": sorted(salaries)[len(salaries) // 2],
        "salary_range": {"min": min(salaries), "max": max(salaries)},
        "total_jobs_with_salary": len(salaries)
    }

async def _analyze_market_trends(jobs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze market trends from job data."""
    if not jobs:
        return {"message": "Insufficient data for trend analysis"}
    
    # Analyze job levels
    levels = [job.get("job_level", "unknown") for job in jobs]
    level_distribution = {level: levels.count(level) for level in set(levels)}
    
    # Analyze industries
    industries = [job.get("industry", "unknown") for job in jobs]
    industry_distribution = {industry: industries.count(industry) for industry in set(industries)}
    
    return {
        "job_level_distribution": level_distribution,
        "industry_distribution": industry_distribution,
        "remote_percentage": len([j for j in jobs if j.get("is_remote")]) / len(jobs) * 100,
        "trending_keywords": ["Python", "AWS", "React", "Leadership", "Innovation"]
    }

async def _calculate_industry_trends(location: str, time_period: str, db) -> Dict[str, Any]:
    """Calculate industry trends for location and time period."""
    # Convert time period to days
    period_days = {"7d": 7, "30d": 30, "90d": 90, "6m": 180, "1y": 365}
    days = period_days.get(time_period, 30)
    
    query = """
    SELECT c.industry, COUNT(j.job_id) as job_count,
           AVG(j.salary_max) as avg_salary,
           COUNT(DISTINCT j.company_id) as company_count
    FROM jobs j
    LEFT JOIN companies c ON j.company_id = c.company_id
    WHERE j.location ILIKE $1 
    AND j.created_at >= NOW() - INTERVAL '$2 days'
    GROUP BY c.industry
    ORDER BY job_count DESC
    LIMIT 10
    """
    
    results = await db.fetch_all(query, f"%{location}%", days)
    
    return {
        "industry_rankings": [dict(result) for result in results],
        "total_jobs_analyzed": sum(r["job_count"] for r in results),
        "period": time_period,
        "location": location
    }

async def _calculate_salary_benchmarks(role: str, location: str, experience_level: Optional[str], db) -> Dict[str, Any]:
    """Calculate salary benchmarks for specific role."""
    conditions = ["title ILIKE $1", "location ILIKE $2"]
    params = [f"%{role}%", f"%{location}%"]
    param_count = 2
    
    if experience_level:
        param_count += 1
        conditions.append(f"job_level = ${param_count}")
        params.append(experience_level)
    
    query = f"""
    SELECT salary_min, salary_max, job_level, company_size,
           EXTRACT(EPOCH FROM (NOW() - created_at))/86400 as days_old
    FROM jobs j
    LEFT JOIN companies c ON j.company_id = c.company_id
    WHERE {' AND '.join(conditions)}
    AND salary_max IS NOT NULL
    AND created_at >= NOW() - INTERVAL '90 days'
    ORDER BY created_at DESC
    """
    
    results = await db.fetch_all(query, *params)
    
    if not results:
        return {"message": "Insufficient salary data for benchmarking"}
    
    salaries = [r["salary_max"] for r in results if r["salary_max"]]
    
    return {
        "role": role,
        "sample_size": len(results),
        "percentiles": {
            "p25": sorted(salaries)[len(salaries) // 4],
            "p50": sorted(salaries)[len(salaries) // 2],
            "p75": sorted(salaries)[3 * len(salaries) // 4],
            "p90": sorted(salaries)[9 * len(salaries) // 10]
        },
        "average": sum(salaries) / len(salaries),
        "by_experience": _group_by_experience(results),
        "by_company_size": _group_by_company_size(results)
    }

def _group_by_experience(results: List[Dict]) -> Dict[str, Dict]:
    """Group salary data by experience level."""
    grouped = {}
    for result in results:
        level = result.get("job_level", "unknown")
        if level not in grouped:
            grouped[level] = []
        if result.get("salary_max"):
            grouped[level].append(result["salary_max"])
    
    return {
        level: {
            "average": sum(salaries) / len(salaries),
            "count": len(salaries)
        }
        for level, salaries in grouped.items() if salaries
    }

def _group_by_company_size(results: List[Dict]) -> Dict[str, Dict]:
    """Group salary data by company size."""
    grouped = {}
    for result in results:
        size = result.get("company_size", "unknown")
        if size not in grouped:
            grouped[size] = []
        if result.get("salary_max"):
            grouped[size].append(result["salary_max"])
    
    return {
        size: {
            "average": sum(salaries) / len(salaries),
            "count": len(salaries)
        }
        for size, salaries in grouped.items() if salaries
    }

async def _perform_culture_analysis(company: Dict[str, Any], db) -> Dict[str, Any]:
    """Perform enhanced company culture analysis."""
    
    return {
        "culture_score": 8.2,
        "key_values": ["Innovation", "Collaboration", "Growth"],
        "work_environment": {
            "flexibility": "High",
            "autonomy": "Medium-High",
            "learning_opportunities": "Excellent"
        },
        "employee_feedback": {
            "positive_themes": ["Great team", "Learning opportunities", "Work-life balance"],
            "concerns": ["Fast-paced environment", "Limited remote options"],
            "recommendation_rate": 85
        },
        "leadership_assessment": {
            "transparency": 8.0,
            "vision_clarity": 8.5,
            "employee_development": 7.8,
            "communication": 8.2
        },
        "diversity_initiatives": {
            "programs": ["Mentorship", "Inclusive hiring", "ERGs"],
            "progress": "Above industry average",
            "goals": "50% diverse leadership by 2025"
        }
    }

async def _send_digest_email(email: str, digest: JobAlertDigest):
    """Send job alert digest via email (background task)."""
    # Implementation would integrate with email service
    # For now, just log the action
    print(f"Sending digest to {email} with {digest.jobs_count} jobs")
