"""
Application management API routes for tracking job applications.
Supports application status tracking, notes, timeline, and analytics.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel, validator
from datetime import datetime, timedelta
from enum import Enum
import secrets
import asyncio

from src.config.sentry import capture_api_error, add_scraping_breadcrumb
from src.api.routes.auth import get_current_user
from src.utils.database import get_database
from src.utils.cache import get_cache_manager

router = APIRouter()


class ApplicationStatus(str, Enum):
    """Application status enumeration."""
    APPLIED = "applied"
    VIEWED = "viewed"
    SCREENING = "screening"
    INTERVIEW_SCHEDULED = "interview_scheduled"
    INTERVIEWING = "interviewing"
    OFFER_RECEIVED = "offer_received"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class ApplicationRequest(BaseModel):
    """Application creation request."""
    job_id: str
    job_title: str
    company: str
    location: Optional[str] = None
    job_url: Optional[str] = None
    applied_via: str = "manual"  # manual, auto, platform
    cover_letter_used: bool = False
    cv_version: Optional[str] = None
    notes: Optional[str] = None


class ApplicationUpdateRequest(BaseModel):
    """Application update request."""
    status: Optional[ApplicationStatus] = None
    notes: Optional[str] = None
    interview_date: Optional[datetime] = None
    salary_offered: Optional[float] = None
    next_action: Optional[str] = None
    next_action_date: Optional[datetime] = None


class ApplicationNoteRequest(BaseModel):
    """Application note creation request."""
    content: str
    is_important: bool = False


class ApplicationResponse(BaseModel):
    """Application response model."""
    id: str
    user_id: str
    job_id: str
    job_title: str
    company: str
    location: Optional[str] = None
    job_url: Optional[str] = None
    status: ApplicationStatus
    applied_date: datetime
    applied_via: str
    cover_letter_used: bool
    cv_version: Optional[str] = None
    notes: Optional[str] = None
    interview_date: Optional[datetime] = None
    salary_offered: Optional[float] = None
    next_action: Optional[str] = None
    next_action_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ApplicationTimelineItem(BaseModel):
    """Application timeline item."""
    id: str
    application_id: str
    event_type: str  # status_change, note_added, interview_scheduled, etc.
    description: str
    previous_value: Optional[str] = None
    new_value: Optional[str] = None
    created_at: datetime
    created_by: str


class ApplicationAnalytics(BaseModel):
    """Application analytics summary."""
    total_applications: int
    applications_this_month: int
    success_rate: float
    avg_response_time_days: Optional[float] = None
    interviews_scheduled: int
    offers_received: int
    status_breakdown: Dict[str, int]
    monthly_trend: List[Dict[str, Any]]


@router.post("/", response_model=ApplicationResponse, tags=["Applications"])
async def create_application(
    app_data: ApplicationRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
    background_tasks: BackgroundTasks
):
    """
    Create a new job application record.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        add_scraping_breadcrumb("Creating application", data={
            "job_title": app_data.job_title,
            "company": app_data.company
        })
        
        app_id = secrets.token_urlsafe(16)
        now = datetime.utcnow()
        
        # Insert application
        await db.execute("""
            INSERT INTO applications (
                id, user_id, job_id, job_title, company, location, job_url,
                status, applied_date, applied_via, cover_letter_used, cv_version,
                notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            app_id, current_user['id'], app_data.job_id, app_data.job_title,
            app_data.company, app_data.location, app_data.job_url,
            ApplicationStatus.APPLIED.value, now, app_data.applied_via,
            app_data.cover_letter_used, app_data.cv_version,
            app_data.notes, now, now
        ))
        
        # Create timeline entry
        await db.execute("""
            INSERT INTO application_timeline (
                id, application_id, event_type, description, new_value, created_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            secrets.token_urlsafe(16), app_id, "application_created",
            f"Applied to {app_data.job_title} at {app_data.company}",
            ApplicationStatus.APPLIED.value, now, current_user['id']
        ))
        
        # Get the created application
        application = await db.execute(
            "SELECT * FROM applications WHERE id = ?", (app_id,)
        )
        
        if application:
            app = application[0]
            return ApplicationResponse(
                id=app['id'],
                user_id=app['user_id'],
                job_id=app['job_id'],
                job_title=app['job_title'],
                company=app['company'],
                location=app['location'],
                job_url=app['job_url'],
                status=ApplicationStatus(app['status']),
                applied_date=app['applied_date'],
                applied_via=app['applied_via'],
                cover_letter_used=app['cover_letter_used'],
                cv_version=app['cv_version'],
                notes=app['notes'],
                interview_date=app.get('interview_date'),
                salary_offered=app.get('salary_offered'),
                next_action=app.get('next_action'),
                next_action_date=app.get('next_action_date'),
                created_at=app['created_at'],
                updated_at=app['updated_at']
            )
        
        raise HTTPException(status_code=500, detail="Failed to create application")
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint="/applications", method="POST")
        raise HTTPException(status_code=500, detail="Failed to create application")


@router.get("/", response_model=List[ApplicationResponse], tags=["Applications"])
async def get_applications(
    status: Optional[ApplicationStatus] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Get user's job applications with optional filtering.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Build query
        where_clause = "WHERE user_id = ?"
        params = [current_user['id']]
        
        if status:
            where_clause += " AND status = ?"
            params.append(status.value)
        
        applications = await db.execute(f"""
            SELECT * FROM applications 
            {where_clause}
            ORDER BY applied_date DESC
            LIMIT ? OFFSET ?
        """, tuple(params + [limit, offset]))
        
        result = []
        for app in applications:
            result.append(ApplicationResponse(
                id=app['id'],
                user_id=app['user_id'],
                job_id=app['job_id'],
                job_title=app['job_title'],
                company=app['company'],
                location=app['location'],
                job_url=app['job_url'],
                status=ApplicationStatus(app['status']),
                applied_date=app['applied_date'],
                applied_via=app['applied_via'],
                cover_letter_used=app['cover_letter_used'],
                cv_version=app['cv_version'],
                notes=app['notes'],
                interview_date=app.get('interview_date'),
                salary_offered=app.get('salary_offered'),
                next_action=app.get('next_action'),
                next_action_date=app.get('next_action_date'),
                created_at=app['created_at'],
                updated_at=app['updated_at']
            ))
        
        return result
        
    except Exception as e:
        capture_api_error(e, endpoint="/applications", method="GET")
        raise HTTPException(status_code=500, detail="Failed to retrieve applications")


@router.get("/{application_id}", response_model=ApplicationResponse, tags=["Applications"])
async def get_application(
    application_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Get specific application details.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        application = await db.execute(
            "SELECT * FROM applications WHERE id = ? AND user_id = ?",
            (application_id, current_user['id'])
        )
        
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        app = application[0]
        return ApplicationResponse(
            id=app['id'],
            user_id=app['user_id'],
            job_id=app['job_id'],
            job_title=app['job_title'],
            company=app['company'],
            location=app['location'],
            job_url=app['job_url'],
            status=ApplicationStatus(app['status']),
            applied_date=app['applied_date'],
            applied_via=app['applied_via'],
            cover_letter_used=app['cover_letter_used'],
            cv_version=app['cv_version'],
            notes=app['notes'],
            interview_date=app.get('interview_date'),
            salary_offered=app.get('salary_offered'),
            next_action=app.get('next_action'),
            next_action_date=app.get('next_action_date'),
            created_at=app['created_at'],
            updated_at=app['updated_at']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/applications/{application_id}", method="GET")
        raise HTTPException(status_code=500, detail="Failed to retrieve application")


@router.put("/{application_id}", response_model=ApplicationResponse, tags=["Applications"])
async def update_application(
    application_id: str,
    update_data: ApplicationUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Update application status and details.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Check if application exists and belongs to user
        existing = await db.execute(
            "SELECT * FROM applications WHERE id = ? AND user_id = ?",
            (application_id, current_user['id'])
        )
        
        if not existing:
            raise HTTPException(status_code=404, detail="Application not found")
        
        old_app = existing[0]
        
        # Build update query
        updates = []
        params = []
        timeline_entries = []
        
        for field, value in update_data.dict(exclude_none=True).items():
            if field == "status":
                updates.append("status = ?")
                params.append(value.value)
                
                # Create timeline entry for status change
                timeline_entries.append({
                    "event_type": "status_changed",
                    "description": f"Status changed from {old_app['status']} to {value.value}",
                    "previous_value": old_app['status'],
                    "new_value": value.value
                })
            else:
                updates.append(f"{field} = ?")
                params.append(value)
                
                if field == "interview_date" and value:
                    timeline_entries.append({
                        "event_type": "interview_scheduled",
                        "description": f"Interview scheduled for {value}",
                        "new_value": value.isoformat()
                    })
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Add updated_at
        updates.append("updated_at = ?")
        params.append(datetime.utcnow())
        params.append(application_id)
        
        # Update application
        await db.execute(
            f"UPDATE applications SET {', '.join(updates)} WHERE id = ?",
            tuple(params)
        )
        
        # Add timeline entries
        for entry in timeline_entries:
            await db.execute("""
                INSERT INTO application_timeline (
                    id, application_id, event_type, description, 
                    previous_value, new_value, created_at, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                secrets.token_urlsafe(16), application_id, entry["event_type"],
                entry["description"], entry.get("previous_value"),
                entry.get("new_value"), datetime.utcnow(), current_user['id']
            ))
        
        # Return updated application
        return await get_application(application_id, current_user, db)
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/applications/{application_id}", method="PUT")
        raise HTTPException(status_code=500, detail="Failed to update application")


@router.get("/{application_id}/timeline", response_model=List[ApplicationTimelineItem], tags=["Applications"])
async def get_application_timeline(
    application_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Get application timeline/history.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Verify application belongs to user
        app_check = await db.execute(
            "SELECT id FROM applications WHERE id = ? AND user_id = ?",
            (application_id, current_user['id'])
        )
        
        if not app_check:
            raise HTTPException(status_code=404, detail="Application not found")
        
        timeline = await db.execute("""
            SELECT * FROM application_timeline 
            WHERE application_id = ?
            ORDER BY created_at DESC
        """, (application_id,))
        
        result = []
        for item in timeline:
            result.append(ApplicationTimelineItem(
                id=item['id'],
                application_id=item['application_id'],
                event_type=item['event_type'],
                description=item['description'],
                previous_value=item.get('previous_value'),
                new_value=item.get('new_value'),
                created_at=item['created_at'],
                created_by=item['created_by']
            ))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/applications/{application_id}/timeline", method="GET")
        raise HTTPException(status_code=500, detail="Failed to retrieve timeline")


@router.get("/analytics/overview", response_model=ApplicationAnalytics, tags=["Applications"])
async def get_application_analytics(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Get application analytics and performance metrics.
    Professional+ tier feature.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Feature gating - Professional+ only
    if current_user['plan'] not in ['pro', 'executive']:
        raise HTTPException(status_code=403, detail="Professional plan required for analytics")
    
    try:
        # Total applications
        total_apps = await db.execute(
            "SELECT COUNT(*) as count FROM applications WHERE user_id = ?",
            (current_user['id'],)
        )
        total_count = total_apps[0]['count'] if total_apps else 0
        
        # Applications this month
        month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_apps = await db.execute(
            "SELECT COUNT(*) as count FROM applications WHERE user_id = ? AND applied_date >= ?",
            (current_user['id'], month_start)
        )
        month_count = month_apps[0]['count'] if month_apps else 0
        
        # Status breakdown
        status_breakdown = await db.execute("""
            SELECT status, COUNT(*) as count 
            FROM applications 
            WHERE user_id = ? 
            GROUP BY status
        """, (current_user['id'],))
        
        status_dict = {item['status']: item['count'] for item in status_breakdown}
        
        # Success metrics
        interviews = status_dict.get('interview_scheduled', 0) + status_dict.get('interviewing', 0)
        offers = status_dict.get('offer_received', 0) + status_dict.get('accepted', 0)
        success_rate = (interviews / total_count * 100) if total_count > 0 else 0
        
        # Monthly trend (last 6 months)
        monthly_trend = []
        for i in range(6):
            month_date = datetime.utcnow().replace(day=1) - timedelta(days=30*i)
            next_month = month_date.replace(month=month_date.month % 12 + 1) if month_date.month < 12 else month_date.replace(year=month_date.year + 1, month=1)
            
            count_result = await db.execute("""
                SELECT COUNT(*) as count FROM applications 
                WHERE user_id = ? AND applied_date >= ? AND applied_date < ?
            """, (current_user['id'], month_date, next_month))
            
            count = count_result[0]['count'] if count_result else 0
            monthly_trend.append({
                "month": month_date.strftime("%Y-%m"),
                "applications": count
            })
        
        return ApplicationAnalytics(
            total_applications=total_count,
            applications_this_month=month_count,
            success_rate=round(success_rate, 1),
            interviews_scheduled=interviews,
            offers_received=offers,
            status_breakdown=status_dict,
            monthly_trend=list(reversed(monthly_trend))
        )
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint="/applications/analytics/overview", method="GET")
        raise HTTPException(status_code=500, detail="Failed to retrieve analytics")


@router.delete("/{application_id}", tags=["Applications"])
async def delete_application(
    application_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Delete an application record.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Check if application exists and belongs to user
        existing = await db.execute(
            "SELECT id FROM applications WHERE id = ? AND user_id = ?",
            (application_id, current_user['id'])
        )
        
        if not existing:
            raise HTTPException(status_code=404, detail="Application not found")
        
        # Delete timeline entries first (foreign key constraint)
        await db.execute(
            "DELETE FROM application_timeline WHERE application_id = ?",
            (application_id,)
        )
        
        # Delete application
        await db.execute(
            "DELETE FROM applications WHERE id = ?",
            (application_id,)
        )
        
        return {"message": "Application deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/applications/{application_id}", method="DELETE")
        raise HTTPException(status_code=500, detail="Failed to delete application")
