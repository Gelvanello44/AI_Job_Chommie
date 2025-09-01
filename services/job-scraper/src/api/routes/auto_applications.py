"""
Auto Job Application Engine with AI matching and automated submission.
Handles intelligent job matching, application submission, and quota management.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, validator
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import secrets
import json

from src.config.sentry import capture_api_error, add_scraping_breadcrumb
from src.api.routes.auth import get_current_user
from src.utils.database import get_database
from src.utils.cache import get_cache_manager
from src.lib.planFeatures import getQuotaLimit, hasFeature

router = APIRouter()


class JobMatchLevel(str, Enum):
    """Job match level enumeration."""
    BASIC = "basic"
    ADVANCED = "advanced"
    EXECUTIVE = "executive"


class ApplicationPreferences(BaseModel):
    """User application preferences."""
    job_titles: List[str] = []
    preferred_locations: List[str] = ["South Africa"]
    remote_preference: str = "hybrid"  # remote, onsite, hybrid, any
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    job_levels: List[str] = ["entry", "mid"]  # entry, mid, senior, executive
    industries: List[str] = []
    company_sizes: List[str] = []  # startup, small, medium, large, enterprise
    skills_required: List[str] = []
    skills_nice_to_have: List[str] = []
    avoid_keywords: List[str] = []
    application_frequency: str = "weekly"  # daily, weekly, biweekly
    auto_apply_enabled: bool = True
    require_confirmation: bool = True


class JobMatch(BaseModel):
    """Job match with AI scoring."""
    job_id: str
    job_title: str
    company: str
    location: str
    match_score: float  # 0-100
    match_reasons: List[str]
    salary_match: Optional[bool] = None
    location_match: bool
    skills_match_score: float
    title_match_score: float
    experience_match: bool
    recommended_action: str  # apply, consider, skip
    confidence_level: str  # high, medium, low
    custom_cover_letter_suggested: bool = False


class AutoApplicationRequest(BaseModel):
    """Auto application setup request."""
    preferences: ApplicationPreferences
    cv_version: str = "default"
    cover_letter_template: Optional[str] = None


class AutoApplicationStatus(BaseModel):
    """Auto application status response."""
    is_active: bool
    preferences: Optional[ApplicationPreferences] = None
    quota_used: int
    quota_limit: int
    next_application_date: Optional[datetime] = None
    last_run_date: Optional[datetime] = None
    matches_pending: int
    applications_this_month: int


@router.post("/preferences", tags=["Auto Applications"])
async def update_application_preferences(
    preferences_data: ApplicationPreferences,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Update user's auto application preferences.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Convert preferences to JSON
        preferences_json = json.dumps(preferences_data.dict())
        
        # Update user preferences
        await db.execute("""
            UPDATE users 
            SET preferences = JSON_SET(
                COALESCE(preferences, '{}'), 
                '$.auto_applications', ?
            )
            WHERE id = ?
        """, (preferences_json, current_user['id']))
        
        # If auto apply is enabled, schedule next matching job
        if preferences_data.auto_apply_enabled:
            await _schedule_next_application_check(current_user['id'], preferences_data)
        
        return {"message": "Preferences updated successfully"}
        
    except Exception as e:
        capture_api_error(e, endpoint="/auto-applications/preferences", method="POST")
        raise HTTPException(status_code=500, detail="Failed to update preferences")


@router.get("/status", response_model=AutoApplicationStatus, tags=["Auto Applications"])
async def get_auto_application_status(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Get current auto application status and settings.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Get quota limit based on user plan
        quota_limit = getQuotaLimit(current_user['plan'], 'autoApplicationsLimit')
        
        # Get current usage
        quota_used = json.loads(current_user.get('quotas', '{}')).get('autoApplicationsUsed', 0)
        
        # Get preferences
        preferences_data = json.loads(current_user.get('preferences', '{}')).get('auto_applications')
        preferences = ApplicationPreferences(**preferences_data) if preferences_data else None
        
        # Get pending matches count
        pending_matches = await db.execute("""
            SELECT COUNT(*) as count FROM job_matches 
            WHERE user_id = ? AND status = 'pending' AND match_score >= 70
        """, (current_user['id'],))
        
        matches_count = pending_matches[0]['count'] if pending_matches else 0
        
        # Get applications this month
        month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_apps = await db.execute("""
            SELECT COUNT(*) as count FROM applications 
            WHERE user_id = ? AND applied_date >= ? AND applied_via = 'auto'
        """, (current_user['id'], month_start))
        
        apps_this_month = month_apps[0]['count'] if month_apps else 0
        
        # Calculate next application date based on frequency
        next_app_date = None
        last_run_date = None
        
        if preferences and preferences.auto_apply_enabled:
            # Get last auto application
            last_app = await db.execute("""
                SELECT applied_date FROM applications 
                WHERE user_id = ? AND applied_via = 'auto' 
                ORDER BY applied_date DESC LIMIT 1
            """, (current_user['id'],))
            
            if last_app:
                last_run_date = last_app[0]['applied_date']
                
                # Calculate next application date based on frequency
                if preferences.application_frequency == "daily":
                    next_app_date = last_run_date + timedelta(days=1)
                elif preferences.application_frequency == "weekly":
                    next_app_date = last_run_date + timedelta(weeks=1)
                elif preferences.application_frequency == "biweekly":
                    next_app_date = last_run_date + timedelta(weeks=2)
        
        return AutoApplicationStatus(
            is_active=preferences.auto_apply_enabled if preferences else False,
            preferences=preferences,
            quota_used=quota_used,
            quota_limit=quota_limit,
            next_application_date=next_app_date,
            last_run_date=last_run_date,
            matches_pending=matches_count,
            applications_this_month=apps_this_month
        )
        
    except Exception as e:
        capture_api_error(e, endpoint="/auto-applications/status", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get status")


@router.get("/matches", response_model=List[JobMatch], tags=["Auto Applications"])
async def get_job_matches(
    limit: int = 20,
    min_score: float = 70.0,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Get AI-powered job matches for the user.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Get user preferences
        preferences_data = json.loads(current_user.get('preferences', '{}')).get('auto_applications')
        if not preferences_data:
            return []
        
        preferences = ApplicationPreferences(**preferences_data)
        
        # Run AI matching algorithm
        matches = await _find_job_matches(current_user, preferences, limit, min_score, db)
        
        return matches
        
    except Exception as e:
        capture_api_error(e, endpoint="/auto-applications/matches", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get matches")


@router.post("/apply/{job_id}", tags=["Auto Applications"])
async def apply_to_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Auto-apply to a specific job (with quota checking).
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Check quota
        quota_limit = getQuotaLimit(current_user['plan'], 'autoApplicationsLimit')
        quota_used = json.loads(current_user.get('quotas', '{}')).get('autoApplicationsUsed', 0)
        
        if quota_used >= quota_limit:
            raise HTTPException(status_code=429, detail="Monthly application quota exceeded")
        
        # Get job details
        job = await db.execute(
            "SELECT * FROM jobs WHERE id = ?", (job_id,)
        )
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        job_data = job[0]
        
        # Queue application submission
        application_id = await _queue_job_application(
            current_user, job_data, background_tasks, db
        )
        
        # Update quota
        await _update_quota_usage(current_user['id'], db)
        
        return {
            "message": "Application queued successfully",
            "application_id": application_id,
            "quota_remaining": quota_limit - quota_used - 1
        }
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/auto-applications/apply/{job_id}", method="POST")
        raise HTTPException(status_code=500, detail="Failed to submit application")


@router.post("/run-matching", tags=["Auto Applications"])
async def run_matching_engine(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Manually trigger the job matching engine.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Get user preferences
        preferences_data = json.loads(current_user.get('preferences', '{}')).get('auto_applications')
        if not preferences_data:
            raise HTTPException(status_code=400, detail="No preferences set")
        
        preferences = ApplicationPreferences(**preferences_data)
        
        # Queue matching job
        background_tasks.add_task(
            _run_matching_for_user, 
            current_user['id'], 
            preferences
        )
        
        return {"message": "Matching engine started"}
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint="/auto-applications/run-matching", method="POST")
        raise HTTPException(status_code=500, detail="Failed to start matching")


# Internal helper functions

async def _find_job_matches(
    user: dict, 
    preferences: ApplicationPreferences, 
    limit: int, 
    min_score: float,
    db
) -> List[JobMatch]:
    """Find and score job matches using AI algorithm."""
    
    # Get recent jobs that match basic criteria
    location_filter = " OR ".join([f"location LIKE '%{loc}%'" for loc in preferences.preferred_locations])
    
    query = f"""
        SELECT * FROM jobs 
        WHERE 
            created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND ({location_filter})
            AND is_active = 1
        ORDER BY created_at DESC
        LIMIT {limit * 3}
    """
    
    jobs = await db.execute(query)
    
    matches = []
    
    for job in jobs:
        # Calculate AI match score
        match_score, reasons = _calculate_match_score(job, preferences)
        
        if match_score >= min_score:
            # Determine match level based on user plan
            match_level = _get_match_level(user['plan'])
            
            # Create detailed match analysis
            job_match = JobMatch(
                job_id=job['id'],
                job_title=job['title'],
                company=job['company_name'] if 'company_name' in job else job.get('company', {}).get('name', 'Unknown'),
                location=job['location'],
                match_score=match_score,
                match_reasons=reasons,
                salary_match=_check_salary_match(job, preferences),
                location_match=_check_location_match(job, preferences),
                skills_match_score=_calculate_skills_match(job, preferences),
                title_match_score=_calculate_title_match(job, preferences),
                experience_match=_check_experience_match(job, preferences),
                recommended_action=_get_recommendation(match_score),
                confidence_level=_get_confidence_level(match_score),
                custom_cover_letter_suggested=match_score > 85
            )
            
            matches.append(job_match)
    
    # Sort by match score
    matches.sort(key=lambda x: x.match_score, reverse=True)
    
    return matches[:limit]


def _calculate_match_score(job: dict, preferences: ApplicationPreferences) -> tuple:
    """Calculate AI match score and reasons."""
    score = 0
    reasons = []
    max_score = 100
    
    # Title matching (30 points)
    title_score = _calculate_title_match(job, preferences)
    score += title_score * 0.3
    if title_score > 70:
        reasons.append(f"Strong title match ({title_score:.0f}%)")
    
    # Skills matching (25 points)
    skills_score = _calculate_skills_match(job, preferences)
    score += skills_score * 0.25
    if skills_score > 60:
        reasons.append(f"Good skills alignment ({skills_score:.0f}%)")
    
    # Location matching (15 points)
    location_score = 100 if _check_location_match(job, preferences) else 20
    score += location_score * 0.15
    if location_score == 100:
        reasons.append("Perfect location match")
    
    # Experience level matching (15 points)
    exp_score = 100 if _check_experience_match(job, preferences) else 30
    score += exp_score * 0.15
    if exp_score == 100:
        reasons.append("Experience level matches")
    
    # Salary matching (10 points)
    salary_match = _check_salary_match(job, preferences)
    if salary_match is True:
        score += 10
        reasons.append("Salary within range")
    elif salary_match is False:
        score += 3
    else:
        score += 7  # Unknown salary
    
    # Company size preference (5 points)
    if preferences.company_sizes:
        company_size = _infer_company_size(job)
        if company_size in preferences.company_sizes:
            score += 5
            reasons.append(f"Preferred company size ({company_size})")
    else:
        score += 5  # No preference = full points
    
    return min(score, max_score), reasons


def _calculate_title_match(job: dict, preferences: ApplicationPreferences) -> float:
    """Calculate title matching score."""
    job_title = job.get('title', '').lower()
    
    if not preferences.job_titles:
        return 50  # Neutral score if no preferences
    
    max_match = 0
    for preferred_title in preferences.job_titles:
        preferred_title = preferred_title.lower()
        
        # Exact match
        if preferred_title in job_title or job_title in preferred_title:
            max_match = max(max_match, 100)
        
        # Keyword overlap
        job_words = set(job_title.split())
        pref_words = set(preferred_title.split())
        overlap = len(job_words.intersection(pref_words))
        total_words = len(job_words.union(pref_words))
        
        if total_words > 0:
            similarity = (overlap / total_words) * 100
            max_match = max(max_match, similarity)
    
    return max_match


def _calculate_skills_match(job: dict, preferences: ApplicationPreferences) -> float:
    """Calculate skills matching score."""
    job_desc = (job.get('description', '') + ' ' + job.get('requirements', '')).lower()
    
    required_skills = [skill.lower() for skill in preferences.skills_required]
    nice_skills = [skill.lower() for skill in preferences.skills_nice_to_have]
    
    if not required_skills and not nice_skills:
        return 60  # Neutral score
    
    required_matches = sum(1 for skill in required_skills if skill in job_desc)
    nice_matches = sum(1 for skill in nice_skills if skill in job_desc)
    
    total_required = len(required_skills) if required_skills else 1
    total_nice = len(nice_skills) if nice_skills else 1
    
    # Weight required skills more heavily
    required_score = (required_matches / total_required) * 70
    nice_score = (nice_matches / total_nice) * 30
    
    return required_score + nice_score


def _check_location_match(job: dict, preferences: ApplicationPreferences) -> bool:
    """Check if job location matches preferences."""
    job_location = job.get('location', '').lower()
    
    for pref_location in preferences.preferred_locations:
        if pref_location.lower() in job_location:
            return True
    
    # Check remote preferences
    if preferences.remote_preference in ['remote', 'any']:
        if 'remote' in job_location or 'work from home' in job.get('description', '').lower():
            return True
    
    return False


def _check_experience_match(job: dict, preferences: ApplicationPreferences) -> bool:
    """Check if experience level matches."""
    job_level = job.get('job_level', 'mid').lower()
    return job_level in [level.lower() for level in preferences.job_levels]


def _check_salary_match(job: dict, preferences: ApplicationPreferences) -> Optional[bool]:
    """Check salary match. Returns None if salary unknown."""
    job_salary_min = job.get('salary_min')
    job_salary_max = job.get('salary_max')
    
    if not job_salary_min and not job_salary_max:
        return None  # Salary unknown
    
    pref_min = preferences.salary_min
    pref_max = preferences.salary_max
    
    if not pref_min and not pref_max:
        return True  # No preference
    
    # Check if there's overlap between ranges
    job_min = job_salary_min or 0
    job_max = job_salary_max or float('inf')
    user_min = pref_min or 0
    user_max = pref_max or float('inf')
    
    return not (job_max < user_min or job_min > user_max)


def _get_match_level(plan: str) -> JobMatchLevel:
    """Get match level based on user plan."""
    if plan == "executive":
        return JobMatchLevel.EXECUTIVE
    elif plan == "pro":
        return JobMatchLevel.ADVANCED
    else:
        return JobMatchLevel.BASIC


def _get_recommendation(score: float) -> str:
    """Get recommendation based on match score."""
    if score >= 85:
        return "apply"
    elif score >= 70:
        return "consider"
    else:
        return "skip"


def _get_confidence_level(score: float) -> str:
    """Get confidence level based on match score."""
    if score >= 85:
        return "high"
    elif score >= 70:
        return "medium"
    else:
        return "low"


def _infer_company_size(job: dict) -> str:
    """Infer company size from job posting."""
    company_name = job.get('company', {}).get('name', '').lower() if isinstance(job.get('company'), dict) else job.get('company_name', '').lower()
    description = job.get('description', '').lower()
    
    # Known large companies
    large_companies = ['google', 'microsoft', 'amazon', 'facebook', 'apple', 'shoprite', 'pick n pay', 'vodacom', 'mtn']
    if any(company in company_name for company in large_companies):
        return 'large'
    
    # Check for size indicators in description
    if any(term in description for term in ['multinational', 'fortune', 'global leader', '1000+ employees']):
        return 'large'
    elif any(term in description for term in ['startup', 'young company', 'growing team', 'small team']):
        return 'startup'
    elif any(term in description for term in ['established company', 'medium-sized', '50-200 employees']):
        return 'medium'
    
    return 'medium'  # Default


async def _queue_job_application(user: dict, job: dict, background_tasks: BackgroundTasks, db) -> str:
    """Queue job application for processing."""
    
    app_id = secrets.token_urlsafe(16)
    now = datetime.utcnow()
    
    # Create application record
    await db.execute("""
        INSERT INTO applications (
            id, user_id, job_id, job_title, company, location, job_url,
            status, applied_date, applied_via, cover_letter_used, cv_version,
            notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        app_id, user['id'], job['id'], job['title'],
        job.get('company_name', job.get('company', {}).get('name', 'Unknown')),
        job['location'], job.get('source_url'), 'applied', now, 
        'auto', True, 'default', 
        'Auto-applied via AI Job Chommie', now, now
    ))
    
    # Queue actual submission (this would integrate with external job boards)
    background_tasks.add_task(_process_job_application, app_id, user, job)
    
    return app_id


async def _process_job_application(app_id: str, user: dict, job: dict):
    """Process the actual job application submission."""
    # This would integrate with external job board APIs
    # For now, we'll mark it as submitted
    
    try:
        # Simulate application submission process
        await asyncio.sleep(2)  # Simulate processing time
        
        # Update application status
        # In real implementation, this would submit to job boards
        
        add_scraping_breadcrumb("Auto application processed", data={
            "application_id": app_id,
            "job_title": job['title'],
            "user_plan": user['plan']
        })
        
    except Exception as e:
        capture_api_error(e, endpoint="background_job_application", method="POST")


async def _update_quota_usage(user_id: str, db):
    """Update user's quota usage."""
    await db.execute("""
        UPDATE users 
        SET quotas = JSON_SET(
            COALESCE(quotas, '{}'), 
            '$.autoApplicationsUsed',
            COALESCE(JSON_EXTRACT(quotas, '$.autoApplicationsUsed'), 0) + 1
        )
        WHERE id = ?
    """, (user_id,))


async def _schedule_next_application_check(user_id: str, preferences: ApplicationPreferences):
    """Schedule next application check based on user preferences."""
    # This would integrate with a job scheduler like Celery
    # For now, we'll add a placeholder
    
    add_scraping_breadcrumb("Next application check scheduled", data={
        "user_id": user_id,
        "frequency": preferences.application_frequency
    })


async def _run_matching_for_user(user_id: str, preferences: ApplicationPreferences):
    """Background task to run matching for a user."""
    try:
        # This would run the full matching algorithm
        # and potentially auto-apply to top matches
        
        add_scraping_breadcrumb("Background matching completed", data={
            "user_id": user_id
        })
        
    except Exception as e:
        capture_api_error(e, endpoint="background_matching", method="POST")
