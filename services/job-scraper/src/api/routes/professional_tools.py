"""
Professional Tools API for advanced career management.

Provides:
- Interview scheduling and calendar integration
- Follow-up email templates and automation
- LinkedIn profile optimization
- Reference management system
- Professional networking tools
- Application follow-up tracking
"""

import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Union
from enum import Enum
from pydantic import BaseModel, Field, EmailStr, HttpUrl
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

class InterviewType(str, Enum):
    PHONE = "phone"
    VIDEO = "video"
    IN_PERSON = "in_person"
    TECHNICAL = "technical"
    BEHAVIORAL = "behavioral"
    PANEL = "panel"

class InterviewStatus(str, Enum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"

class FollowUpType(str, Enum):
    THANK_YOU = "thank_you"
    CHECK_IN = "check_in"
    INTERVIEW_REQUEST = "interview_request"
    SALARY_NEGOTIATION = "salary_negotiation"
    WITHDRAWAL = "withdrawal"

class ReferenceStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CONTACTED = "contacted"
    COMPLETED = "completed"
    DECLINED = "declined"

# ==========================================
# Pydantic Models
# ==========================================

class Interview(BaseModel):
    """Interview scheduling model."""
    interview_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    job_application_id: str
    company_name: str
    position_title: str
    interview_type: InterviewType
    scheduled_datetime: datetime
    duration_minutes: int = 60
    location: Optional[str] = None
    meeting_link: Optional[HttpUrl] = None
    interviewer_name: Optional[str] = None
    interviewer_email: Optional[EmailStr] = None
    interviewer_phone: Optional[str] = None
    status: InterviewStatus = InterviewStatus.SCHEDULED
    notes: Optional[str] = None
    preparation_notes: Optional[str] = None
    follow_up_sent: bool = False
    reminder_sent: bool = False
    calendar_event_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class FollowUpTemplate(BaseModel):
    """Follow-up email template model."""
    template_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    follow_up_type: FollowUpType
    subject_template: str
    body_template: str
    timing_hours: int = Field(..., description="Hours after trigger event to send")
    is_active: bool = True
    usage_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class LinkedInOptimization(BaseModel):
    """LinkedIn profile optimization analysis."""
    user_id: str
    profile_url: Optional[str] = None
    current_score: float = Field(..., ge=0, le=100)
    analysis: Dict[str, Any]
    recommendations: List[Dict[str, Any]]
    keyword_suggestions: List[str]
    headline_suggestions: List[str]
    summary_improvements: List[str]
    skills_to_add: List[str]
    content_strategy: Dict[str, Any]
    last_analyzed: datetime = Field(default_factory=datetime.utcnow)

class Reference(BaseModel):
    """Professional reference model."""
    reference_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    title: str
    company: str
    email: EmailStr
    phone: Optional[str] = None
    relationship: str  # "manager", "colleague", "client", "mentor"
    years_known: int
    status: ReferenceStatus = ReferenceStatus.PENDING
    last_contacted: Optional[datetime] = None
    response_notes: Optional[str] = None
    reference_letter: Optional[str] = None
    linkedin_profile: Optional[HttpUrl] = None
    consent_given: bool = False
    consent_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CalendarIntegration(BaseModel):
    """Calendar integration settings."""
    user_id: str
    provider: str  # "google", "outlook", "apple"
    access_token: str
    refresh_token: Optional[str] = None
    calendar_id: Optional[str] = None
    auto_scheduling: bool = True
    buffer_minutes: int = 15
    timezone: str = "Africa/Johannesburg"
    last_sync: Optional[datetime] = None
    is_active: bool = True

# ==========================================
# Interview Scheduling Endpoints
# ==========================================

@router.post("/interviews", response_model=Interview)
async def schedule_interview(
    interview_data: Interview,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Schedule a new interview."""
    try:
        interview_data.user_id = current_user.id
        
        # Store in database
        query = """
        INSERT INTO interviews 
        (interview_id, user_id, job_application_id, company_name, position_title,
         interview_type, scheduled_datetime, duration_minutes, location, meeting_link,
         interviewer_name, interviewer_email, interviewer_phone, status, notes, preparation_notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
        """
        
        result = await db.fetch_one(
            query,
            interview_data.interview_id,
            interview_data.user_id,
            interview_data.job_application_id,
            interview_data.company_name,
            interview_data.position_title,
            interview_data.interview_type,
            interview_data.scheduled_datetime,
            interview_data.duration_minutes,
            interview_data.location,
            str(interview_data.meeting_link) if interview_data.meeting_link else None,
            interview_data.interviewer_name,
            interview_data.interviewer_email,
            interview_data.interviewer_phone,
            interview_data.status,
            interview_data.notes,
            interview_data.preparation_notes
        )
        
        # Schedule calendar event and reminders in background
        background_tasks.add_task(_create_calendar_event, interview_data, current_user)
        background_tasks.add_task(_schedule_interview_reminders, interview_data, current_user)
        
        return Interview(**result)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to schedule interview: {str(e)}"
        )

@router.get("/interviews", response_model=List[Interview])
async def get_interviews(
    status_filter: Optional[InterviewStatus] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Get user's interviews with optional filtering."""
    try:
        conditions = ["user_id = $1"]
        params = [current_user.id]
        param_count = 1
        
        if status_filter:
            param_count += 1
            conditions.append(f"status = ${param_count}")
            params.append(status_filter.value)
        
        if start_date:
            param_count += 1
            conditions.append(f"scheduled_datetime >= ${param_count}")
            params.append(start_date)
        
        if end_date:
            param_count += 1
            conditions.append(f"scheduled_datetime <= ${param_count}")
            params.append(end_date)
        
        query = f"""
        SELECT * FROM interviews 
        WHERE {' AND '.join(conditions)}
        ORDER BY scheduled_datetime ASC
        """
        
        results = await db.fetch_all(query, *params)
        return [Interview(**result) for result in results]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch interviews: {str(e)}"
        )

@router.put("/interviews/{interview_id}", response_model=Interview)
async def update_interview(
    interview_id: str,
    interview_data: Interview,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Update an interview."""
    try:
        # Verify interview belongs to user
        check_query = "SELECT user_id FROM interviews WHERE interview_id = $1"
        owner = await db.fetch_one(check_query, interview_id)
        
        if not owner or owner["user_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Interview not found"
            )
        
        # Update interview
        query = """
        UPDATE interviews SET
        company_name = $2, position_title = $3, interview_type = $4,
        scheduled_datetime = $5, duration_minutes = $6, location = $7,
        meeting_link = $8, interviewer_name = $9, interviewer_email = $10,
        interviewer_phone = $11, status = $12, notes = $13,
        preparation_notes = $14, updated_at = NOW()
        WHERE interview_id = $1
        RETURNING *
        """
        
        result = await db.fetch_one(
            query,
            interview_id,
            interview_data.company_name,
            interview_data.position_title,
            interview_data.interview_type,
            interview_data.scheduled_datetime,
            interview_data.duration_minutes,
            interview_data.location,
            str(interview_data.meeting_link) if interview_data.meeting_link else None,
            interview_data.interviewer_name,
            interview_data.interviewer_email,
            interview_data.interviewer_phone,
            interview_data.status,
            interview_data.notes,
            interview_data.preparation_notes
        )
        
        # Update calendar event in background
        background_tasks.add_task(_update_calendar_event, interview_data, current_user)
        
        return Interview(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update interview: {str(e)}"
        )

@router.post("/interviews/{interview_id}/complete")
async def complete_interview(
    interview_id: str,
    feedback_notes: Optional[str] = None,
    rating: Optional[int] = Query(None, ge=1, le=5),
    send_thank_you: bool = True,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Mark interview as completed and optionally send thank you email."""
    try:
        # Update interview status
        query = """
        UPDATE interviews SET
        status = 'completed',
        notes = COALESCE(notes, '') || COALESCE($2, ''),
        updated_at = NOW()
        WHERE interview_id = $1 AND user_id = $3
        RETURNING *
        """
        
        result = await db.fetch_one(query, interview_id, feedback_notes, current_user.id)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Interview not found"
            )
        
        # Send thank you email if requested
        if send_thank_you and result["interviewer_email"]:
            background_tasks.add_task(
                _send_thank_you_email, 
                result, 
                current_user, 
                feedback_notes
            )
        
        return {
            "message": "Interview marked as completed",
            "interview_id": interview_id,
            "thank_you_sent": send_thank_you and bool(result["interviewer_email"])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to complete interview: {str(e)}"
        )

# ==========================================
# Follow-up Templates Endpoints
# ==========================================

@router.post("/templates", response_model=FollowUpTemplate)
async def create_follow_up_template(
    template_data: FollowUpTemplate,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Create a new follow-up email template."""
    try:
        template_data.user_id = current_user.id
        
        # Store in database
        query = """
        INSERT INTO follow_up_templates 
        (template_id, user_id, name, follow_up_type, subject_template,
         body_template, timing_hours, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        """
        
        result = await db.fetch_one(
            query,
            template_data.template_id,
            template_data.user_id,
            template_data.name,
            template_data.follow_up_type,
            template_data.subject_template,
            template_data.body_template,
            template_data.timing_hours,
            template_data.is_active
        )
        
        return FollowUpTemplate(**result)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create template: {str(e)}"
        )

@router.get("/templates", response_model=List[FollowUpTemplate])
async def get_follow_up_templates(
    follow_up_type: Optional[FollowUpType] = None,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Get user's follow-up templates."""
    try:
        conditions = ["user_id = $1", "is_active = true"]
        params = [current_user.id]
        
        if follow_up_type:
            conditions.append("follow_up_type = $2")
            params.append(follow_up_type.value)
        
        query = f"""
        SELECT * FROM follow_up_templates 
        WHERE {' AND '.join(conditions)}
        ORDER BY follow_up_type, name
        """
        
        results = await db.fetch_all(query, *params)
        return [FollowUpTemplate(**result) for result in results]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch templates: {str(e)}"
        )

@router.post("/templates/{template_id}/use")
async def use_follow_up_template(
    template_id: str,
    application_id: str,
    custom_variables: Optional[Dict[str, str]] = None,
    send_immediately: bool = False,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Use a follow-up template to send an email."""
    try:
        # Get template
        template_query = "SELECT * FROM follow_up_templates WHERE template_id = $1 AND user_id = $2"
        template = await db.fetch_one(template_query, template_id, current_user.id)
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )
        
        # Get application details
        app_query = "SELECT * FROM job_applications WHERE application_id = $1 AND user_id = $2"
        application = await db.fetch_one(app_query, application_id, current_user.id)
        
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found"
            )
        
        # Prepare email content
        email_content = await _prepare_follow_up_email(
            template, application, current_user, custom_variables
        )
        
        if send_immediately:
            # Send email immediately
            background_tasks.add_task(_send_follow_up_email, email_content, current_user)
        else:
            # Schedule email based on template timing
            send_time = datetime.utcnow() + timedelta(hours=template["timing_hours"])
            background_tasks.add_task(_schedule_follow_up_email, email_content, send_time)
        
        # Update usage count
        await db.execute(
            "UPDATE follow_up_templates SET usage_count = usage_count + 1 WHERE template_id = $1",
            template_id
        )
        
        return {
            "message": "Follow-up email prepared",
            "template_name": template["name"],
            "scheduled_for": send_time if not send_immediately else "immediately",
            "recipient": email_content["to_email"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to use template: {str(e)}"
        )

# ==========================================
# LinkedIn Optimization Endpoints
# ==========================================

@router.post("/linkedin/analyze", response_model=LinkedInOptimization)
async def analyze_linkedin_profile(
    profile_url: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Analyze LinkedIn profile and provide optimization recommendations."""
    try:
        # If no URL provided, try to get from user profile
        if not profile_url:
            user_profile_query = "SELECT linkedin_url FROM user_profiles WHERE user_id = $1"
            user_profile = await db.fetch_one(user_profile_query, current_user.id)
            profile_url = user_profile.get("linkedin_url") if user_profile else None
        
        if not profile_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="LinkedIn profile URL required"
            )
        
        # Perform LinkedIn analysis
        analysis_result = await _analyze_linkedin_profile(profile_url, current_user, db)
        
        # Store analysis in database
        query = """
        INSERT INTO linkedin_optimizations
        (user_id, profile_url, current_score, analysis, recommendations,
         keyword_suggestions, headline_suggestions, summary_improvements,
         skills_to_add, content_strategy)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (user_id) DO UPDATE SET
        profile_url = EXCLUDED.profile_url,
        current_score = EXCLUDED.current_score,
        analysis = EXCLUDED.analysis,
        recommendations = EXCLUDED.recommendations,
        keyword_suggestions = EXCLUDED.keyword_suggestions,
        headline_suggestions = EXCLUDED.headline_suggestions,
        summary_improvements = EXCLUDED.summary_improvements,
        skills_to_add = EXCLUDED.skills_to_add,
        content_strategy = EXCLUDED.content_strategy,
        last_analyzed = NOW()
        RETURNING *
        """
        
        result = await db.fetch_one(
            query,
            current_user.id,
            profile_url,
            analysis_result["score"],
            analysis_result["analysis"],
            analysis_result["recommendations"],
            analysis_result["keyword_suggestions"],
            analysis_result["headline_suggestions"],
            analysis_result["summary_improvements"],
            analysis_result["skills_to_add"],
            analysis_result["content_strategy"]
        )
        
        return LinkedInOptimization(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze LinkedIn profile: {str(e)}"
        )

@router.get("/linkedin/optimization", response_model=LinkedInOptimization)
async def get_linkedin_optimization(
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Get latest LinkedIn optimization analysis."""
    query = "SELECT * FROM linkedin_optimizations WHERE user_id = $1"
    result = await db.fetch_one(query, current_user.id)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No LinkedIn analysis found. Please analyze your profile first."
        )
    
    return LinkedInOptimization(**result)

@router.post("/linkedin/optimize-headline")
async def optimize_linkedin_headline(
    target_role: str,
    target_industry: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Generate optimized LinkedIn headline suggestions."""
    try:
        # Get user's current CV and skills for context
        cv_query = "SELECT * FROM cvs WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1"
        cv_data = await db.fetch_one(cv_query, current_user.id)
        
        # Generate headline suggestions
        suggestions = await _generate_linkedin_headlines(
            target_role, target_industry, cv_data, current_user
        )
        
        return {
            "target_role": target_role,
            "target_industry": target_industry,
            "headline_suggestions": suggestions,
            "tips": [
                "Include your target role and key skills",
                "Use industry keywords for better discoverability", 
                "Keep it under 220 characters",
                "Add a personal value proposition"
            ]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate headlines: {str(e)}"
        )

# ==========================================
# Reference Management Endpoints
# ==========================================

@router.post("/references", response_model=Reference)
async def add_reference(
    reference_data: Reference,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Add a new professional reference."""
    try:
        reference_data.user_id = current_user.id
        
        # Check reference limit for Professional tier (unlimited for Executive)
        if current_user.subscription_tier == "professional":
            count_query = "SELECT COUNT(*) as count FROM references WHERE user_id = $1"
            existing_count = await db.fetch_one(count_query, current_user.id)
            
            if existing_count["count"] >= 10:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Professional tier limited to 10 references. Upgrade to Executive for unlimited."
                )
        
        # Store in database
        query = """
        INSERT INTO references 
        (reference_id, user_id, name, title, company, email, phone,
         relationship, years_known, status, linkedin_profile, consent_given)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
        """
        
        result = await db.fetch_one(
            query,
            reference_data.reference_id,
            reference_data.user_id,
            reference_data.name,
            reference_data.title,
            reference_data.company,
            reference_data.email,
            reference_data.phone,
            reference_data.relationship,
            reference_data.years_known,
            reference_data.status,
            str(reference_data.linkedin_profile) if reference_data.linkedin_profile else None,
            reference_data.consent_given
        )
        
        return Reference(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add reference: {str(e)}"
        )

@router.get("/references", response_model=List[Reference])
async def get_references(
    status_filter: Optional[ReferenceStatus] = None,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Get user's professional references."""
    try:
        conditions = ["user_id = $1"]
        params = [current_user.id]
        
        if status_filter:
            conditions.append("status = $2")
            params.append(status_filter.value)
        
        query = f"""
        SELECT * FROM references 
        WHERE {' AND '.join(conditions)}
        ORDER BY relationship, name
        """
        
        results = await db.fetch_all(query, *params)
        return [Reference(**result) for result in results]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch references: {str(e)}"
        )

@router.post("/references/{reference_id}/request")
async def request_reference(
    reference_id: str,
    message: Optional[str] = None,
    application_context: Optional[str] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Request a reference from a contact."""
    try:
        # Get reference details
        ref_query = "SELECT * FROM references WHERE reference_id = $1 AND user_id = $2"
        reference = await db.fetch_one(ref_query, reference_id, current_user.id)
        
        if not reference:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reference not found"
            )
        
        if not reference["consent_given"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reference consent not obtained"
            )
        
        # Update reference status
        update_query = """
        UPDATE references SET
        status = 'contacted',
        last_contacted = NOW(),
        updated_at = NOW()
        WHERE reference_id = $1
        RETURNING *
        """
        
        await db.fetch_one(update_query, reference_id)
        
        # Send reference request email
        background_tasks.add_task(
            _send_reference_request_email,
            reference, 
            current_user, 
            message, 
            application_context
        )
        
        return {
            "message": "Reference request sent",
            "reference_name": reference["name"],
            "contact_email": reference["email"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to request reference: {str(e)}"
        )

# ==========================================
# Calendar Integration Endpoints
# ==========================================

@router.post("/calendar/connect")
async def connect_calendar(
    provider: str = Query(..., regex="^(google|outlook|apple)$"),
    auth_code: str = Query(..., description="OAuth authorization code"),
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Connect calendar provider for automatic scheduling."""
    try:
        # Exchange auth code for tokens
        tokens = await _exchange_calendar_auth_code(provider, auth_code)
        
        # Store calendar integration
        query = """
        INSERT INTO calendar_integrations
        (user_id, provider, access_token, refresh_token, calendar_id, auto_scheduling, timezone)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, provider) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        calendar_id = EXCLUDED.calendar_id,
        is_active = true,
        last_sync = NOW()
        RETURNING provider, is_active
        """
        
        result = await db.fetch_one(
            query,
            current_user.id,
            provider,
            tokens["access_token"],
            tokens.get("refresh_token"),
            tokens.get("calendar_id"),
            True,  # auto_scheduling
            "Africa/Johannesburg"
        )
        
        return {
            "message": f"{provider.title()} calendar connected successfully",
            "provider": result["provider"],
            "auto_scheduling_enabled": result["is_active"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to connect calendar: {str(e)}"
        )

@router.get("/calendar/availability")
async def get_calendar_availability(
    start_date: datetime,
    end_date: datetime,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("professional")),
    db = Depends(get_database)
):
    """Get calendar availability for scheduling."""
    try:
        # Get calendar integration
        cal_query = "SELECT * FROM calendar_integrations WHERE user_id = $1 AND is_active = true"
        calendar_config = await db.fetch_one(cal_query, current_user.id)
        
        if not calendar_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No calendar integration found"
            )
        
        # Get availability from calendar provider
        availability = await _get_calendar_availability(
            calendar_config, start_date, end_date
        )
        
        return {
            "start_date": start_date,
            "end_date": end_date,
            "availability": availability,
            "timezone": calendar_config["timezone"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch availability: {str(e)}"
        )

# ==========================================
# Professional Networking Tools
# ==========================================

@router.get("/networking/suggestions")
async def get_networking_suggestions(
    target_industry: Optional[str] = None,
    target_role: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Get personalized networking suggestions (Executive tier only)."""
    try:
        # Get user's current profile and goals
        profile_query = "SELECT * FROM user_profiles WHERE user_id = $1"
        profile = await db.fetch_one(profile_query, current_user.id)
        
        # Generate networking suggestions
        suggestions = await _generate_networking_suggestions(
            target_industry, target_role, profile, current_user, db
        )
        
        return {
            "target_industry": target_industry,
            "target_role": target_role,
            "suggestions": suggestions,
            "generated_at": datetime.utcnow()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate networking suggestions: {str(e)}"
        )

@router.get("/networking/events")
async def get_networking_events(
    location: str = Query("South Africa"),
    industry: Optional[str] = None,
    event_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Get upcoming networking events (Executive tier only)."""
    try:
        conditions = ["location ILIKE $1", "event_date >= NOW()"]
        params = [f"%{location}%"]
        param_count = 1
        
        if industry:
            param_count += 1
            conditions.append(f"industries @> ${{param_count}}")
            params.append([industry])
        
        if event_type:
            param_count += 1
            conditions.append(f"event_type = ${param_count}")
            params.append(event_type)
        
        query = f"""
        SELECT * FROM networking_events 
        WHERE {' AND '.join(conditions)}
        ORDER BY event_date ASC
        LIMIT 20
        """
        
        results = await db.fetch_all(query, *params)
        return [dict(result) for result in results]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch networking events: {str(e)}"
        )

# ==========================================
# Helper Functions
# ==========================================

async def _create_calendar_event(interview: Interview, user: User):
    """Create calendar event for interview."""
    # Implementation would integrate with calendar APIs
    print(f"Creating calendar event for {interview.company_name} interview")

async def _update_calendar_event(interview: Interview, user: User):
    """Update calendar event for interview."""
    # Implementation would integrate with calendar APIs
    print(f"Updating calendar event for {interview.company_name} interview")

async def _schedule_interview_reminders(interview: Interview, user: User):
    """Schedule interview reminders."""
    # Implementation would schedule email/SMS reminders
    print(f"Scheduling reminders for {interview.company_name} interview")

async def _send_thank_you_email(interview: Dict[str, Any], user: User, feedback_notes: Optional[str]):
    """Send thank you email after interview."""
    # Implementation would send email via email service
    print(f"Sending thank you email to {interview['interviewer_email']}")

async def _prepare_follow_up_email(
    template: Dict[str, Any], 
    application: Dict[str, Any], 
    user: User,
    custom_variables: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """Prepare follow-up email content using template."""
    
    # Standard template variables
    variables = {
        "user_name": user.full_name,
        "company_name": application["company_name"],
        "position_title": application["position_title"],
        "application_date": application["created_at"].strftime("%B %d, %Y"),
        "interviewer_name": application.get("contact_name", "Hiring Manager")
    }
    
    # Add custom variables
    if custom_variables:
        variables.update(custom_variables)
    
    # Replace template variables
    subject = template["subject_template"]
    body = template["body_template"]
    
    for var, value in variables.items():
        subject = subject.replace(f"{{{var}}}", str(value))
        body = body.replace(f"{{{var}}}", str(value))
    
    return {
        "to_email": application.get("contact_email", "hr@company.com"),
        "subject": subject,
        "body": body,
        "template_type": template["follow_up_type"]
    }

async def _send_follow_up_email(email_content: Dict[str, Any], user: User):
    """Send follow-up email."""
    # Implementation would send email via email service
    print(f"Sending follow-up email: {email_content['subject']}")

async def _schedule_follow_up_email(email_content: Dict[str, Any], send_time: datetime):
    """Schedule follow-up email for later sending."""
    # Implementation would schedule email via job queue
    print(f"Scheduling follow-up email for {send_time}")

async def _analyze_linkedin_profile(profile_url: str, user: User, db) -> Dict[str, Any]:
    """Analyze LinkedIn profile and provide optimization recommendations."""
    # Simulate AI analysis (replace with actual LinkedIn analysis service)
    
    analysis = {
        "profile_completeness": 78,
        "keyword_optimization": 65,
        "engagement_potential": 72,
        "professional_image": 85,
        "network_quality": 68
    }
    
    score = sum(analysis.values()) / len(analysis)
    
    recommendations = [
        {
            "priority": "high",
            "area": "Headline Optimization",
            "current_issue": "Generic headline doesn't highlight unique value",
            "suggestion": "Include target role and key achievement metrics",
            "impact": "30% more profile views"
        },
        {
            "priority": "medium",
            "area": "Skills Section",
            "current_issue": "Missing trending industry keywords",
            "suggestion": "Add AI/ML, Cloud Computing, Digital Transformation",
            "impact": "Better search visibility"
        }
    ]
    
    return {
        "score": score,
        "analysis": analysis,
        "recommendations": recommendations,
        "keyword_suggestions": ["Leadership", "Digital Strategy", "Innovation", "Team Building"],
        "headline_suggestions": await _generate_linkedin_headlines("Senior Manager", None, None, user),
        "summary_improvements": [
            "Add quantified achievements",
            "Include industry keywords",
            "Highlight unique value proposition"
        ],
        "skills_to_add": ["Machine Learning", "Cloud Architecture", "Agile Methodology"],
        "content_strategy": {
            "posting_frequency": "2-3 times per week",
            "content_types": ["Industry insights", "Professional achievements", "Thought leadership"],
            "engagement_strategy": "Comment on industry leaders' posts, share relevant articles"
        }
    }

async def _generate_linkedin_headlines(
    target_role: str, 
    target_industry: Optional[str], 
    cv_data: Optional[Dict[str, Any]], 
    user: User
) -> List[str]:
    """Generate LinkedIn headline suggestions."""
    
    # Base headlines using target role
    headlines = [
        f"{target_role} | Driving Innovation & Growth",
        f"Experienced {target_role} | Strategic Leader",
        f"{target_role} | Passionate About Excellence",
    ]
    
    # Add industry-specific headlines
    if target_industry:
        headlines.extend([
            f"{target_role} | {target_industry} Specialist",
            f"Transforming {target_industry} Through {target_role} Excellence"
        ])
    
    # Add experience-based headlines if CV data available
    if cv_data and cv_data.get("experience"):
        years_exp = len(cv_data["experience"])
        headlines.append(f"{years_exp}+ Years {target_role} | Results-Driven Leader")
    
    return headlines

async def _exchange_calendar_auth_code(provider: str, auth_code: str) -> Dict[str, str]:
    """Exchange OAuth authorization code for access tokens."""
    # Implementation would handle OAuth flow for calendar providers
    # This is a mock implementation
    
    return {
        "access_token": f"mock_access_token_{provider}",
        "refresh_token": f"mock_refresh_token_{provider}",
        "calendar_id": "primary"
    }

async def _get_calendar_availability(
    calendar_config: Dict[str, Any], 
    start_date: datetime, 
    end_date: datetime
) -> List[Dict[str, Any]]:
    """Get calendar availability from provider."""
    # Implementation would query calendar API
    # Mock availability slots
    
    availability_slots = []
    current_date = start_date.date()
    end_date_only = end_date.date()
    
    while current_date <= end_date_only:
        # Mock: assume 9 AM - 5 PM availability with 1-hour slots
        for hour in range(9, 17):
            slot_time = datetime.combine(current_date, datetime.min.time().replace(hour=hour))
            availability_slots.append({
                "start_time": slot_time,
                "end_time": slot_time + timedelta(hours=1),
                "available": True  # Mock: all slots available
            })
        
        current_date += timedelta(days=1)
    
    return availability_slots

async def _send_reference_request_email(
    reference: Dict[str, Any], 
    user: User, 
    message: Optional[str], 
    application_context: Optional[str]
):
    """Send reference request email."""
    # Implementation would send email via email service
    print(f"Sending reference request to {reference['email']} for {user.full_name}")

async def _generate_networking_suggestions(
    target_industry: Optional[str],
    target_role: Optional[str], 
    profile: Optional[Dict[str, Any]],
    user: User,
    db
) -> List[Dict[str, Any]]:
    """Generate personalized networking suggestions."""
    
    suggestions = [
        {
            "type": "industry_leader",
            "name": "John Smith",
            "title": "VP of Engineering",
            "company": "TechCorp SA",
            "mutual_connections": 3,
            "reason": "Industry leader in your target field",
            "approach": "Comment on their recent post about digital transformation"
        },
        {
            "type": "alumni",
            "name": "Sarah Johnson", 
            "title": "Senior Product Manager",
            "company": "Innovation Labs",
            "mutual_connections": 5,
            "reason": "University of Cape Town alumni",
            "approach": "Mention shared alma mater and interest in product management"
        },
        {
            "type": "event_speaker",
            "name": "Dr. Michael Brown",
            "title": "CTO",
            "company": "AI Solutions",
            "upcoming_event": "Tech Leadership Summit 2024",
            "reason": "Speaking at upcoming event you should attend",
            "approach": "Attend their talk and ask thoughtful questions"
        }
    ]
    
    return suggestions
