"""
CV Builder API with ATS optimization and professional templates.
Supports CV creation, editing, ATS scoring, keyword recommendations, and PDF export.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, validator
from datetime import datetime
from enum import Enum
import secrets
import json
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.units import inch

from src.config.sentry import capture_api_error, add_scraping_breadcrumb
from src.api.routes.auth import get_current_user
from src.utils.database import get_database
from src.utils.cache import get_cache_manager
from src.lib.planFeatures import hasFeature

router = APIRouter()


class CVTemplate(str, Enum):
    """CV template types."""
    STANDARD = "standard"
    PROFESSIONAL = "professional"
    EXECUTIVE = "executive"
    CREATIVE = "creative"
    TECHNICAL = "technical"


class ATSScore(BaseModel):
    """ATS optimization score."""
    overall_score: float  # 0-100
    keyword_score: float
    format_score: float
    structure_score: float
    readability_score: float
    recommendations: List[str]
    missing_keywords: List[str]
    suggestions: List[str]


class CVSection(BaseModel):
    """CV section data."""
    section_type: str  # personal, summary, experience, education, skills, etc.
    title: str
    content: Dict[str, Any]
    order: int = 0
    is_visible: bool = True


class CVData(BaseModel):
    """Complete CV data structure."""
    id: Optional[str] = None
    user_id: str
    template: CVTemplate = CVTemplate.STANDARD
    title: str = "My CV"
    sections: List[CVSection] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    ats_score: Optional[ATSScore] = None
    is_published: bool = False
    public_url: Optional[str] = None


class CVCreateRequest(BaseModel):
    """CV creation request."""
    title: str
    template: CVTemplate = CVTemplate.STANDARD
    sections: List[CVSection] = []


class CVUpdateRequest(BaseModel):
    """CV update request."""
    title: Optional[str] = None
    template: Optional[CVTemplate] = None
    sections: Optional[List[CVSection]] = None
    is_published: Optional[bool] = None


class KeywordSuggestion(BaseModel):
    """Keyword suggestion for CV optimization."""
    keyword: str
    relevance_score: float
    section_suggested: str
    context: str
    priority: str  # high, medium, low


@router.post("/", response_model=CVData, tags=["CV Builder"])
async def create_cv(
    cv_request: CVCreateRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Create a new CV.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        cv_id = secrets.token_urlsafe(16)
        now = datetime.utcnow()
        
        # Create CV record
        await db.execute("""
            INSERT INTO cvs (
                id, user_id, title, template, sections, 
                created_at, updated_at, is_published
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            cv_id, current_user['id'], cv_request.title, 
            cv_request.template.value, json.dumps([s.dict() for s in cv_request.sections]),
            now, now, False
        ))
        
        # Calculate initial ATS score
        ats_score = await _calculate_ats_score(cv_request.sections, cv_request.template)
        
        # Update with ATS score
        await db.execute(
            "UPDATE cvs SET ats_score = ? WHERE id = ?",
            (json.dumps(ats_score.dict()), cv_id)
        )
        
        # Return created CV
        cv_data = CVData(
            id=cv_id,
            user_id=current_user['id'],
            title=cv_request.title,
            template=cv_request.template,
            sections=cv_request.sections,
            created_at=now,
            updated_at=now,
            ats_score=ats_score,
            is_published=False
        )
        
        add_scraping_breadcrumb("CV created", data={
            "cv_id": cv_id,
            "template": cv_request.template.value,
            "user_plan": current_user['plan']
        })
        
        return cv_data
        
    except Exception as e:
        capture_api_error(e, endpoint="/cv-builder", method="POST")
        raise HTTPException(status_code=500, detail="Failed to create CV")


@router.get("/", response_model=List[CVData], tags=["CV Builder"])
async def get_user_cvs(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Get all CVs for the current user.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        cvs = await db.execute(
            "SELECT * FROM cvs WHERE user_id = ? ORDER BY updated_at DESC",
            (current_user['id'],)
        )
        
        result = []
        for cv in cvs:
            sections = json.loads(cv['sections']) if cv['sections'] else []
            ats_score = json.loads(cv['ats_score']) if cv['ats_score'] else None
            
            cv_data = CVData(
                id=cv['id'],
                user_id=cv['user_id'],
                title=cv['title'],
                template=CVTemplate(cv['template']),
                sections=[CVSection(**s) for s in sections],
                created_at=cv['created_at'],
                updated_at=cv['updated_at'],
                ats_score=ATSScore(**ats_score) if ats_score else None,
                is_published=cv['is_published'],
                public_url=cv.get('public_url')
            )
            result.append(cv_data)
        
        return result
        
    except Exception as e:
        capture_api_error(e, endpoint="/cv-builder", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get CVs")


@router.get("/{cv_id}", response_model=CVData, tags=["CV Builder"])
async def get_cv(
    cv_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Get specific CV by ID.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        cv = await db.execute(
            "SELECT * FROM cvs WHERE id = ? AND user_id = ?",
            (cv_id, current_user['id'])
        )
        
        if not cv:
            raise HTTPException(status_code=404, detail="CV not found")
        
        cv_data = cv[0]
        sections = json.loads(cv_data['sections']) if cv_data['sections'] else []
        ats_score = json.loads(cv_data['ats_score']) if cv_data['ats_score'] else None
        
        return CVData(
            id=cv_data['id'],
            user_id=cv_data['user_id'],
            title=cv_data['title'],
            template=CVTemplate(cv_data['template']),
            sections=[CVSection(**s) for s in sections],
            created_at=cv_data['created_at'],
            updated_at=cv_data['updated_at'],
            ats_score=ATSScore(**ats_score) if ats_score else None,
            is_published=cv_data['is_published'],
            public_url=cv_data.get('public_url')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/cv-builder/{cv_id}", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get CV")


@router.put("/{cv_id}", response_model=CVData, tags=["CV Builder"])
async def update_cv(
    cv_id: str,
    update_request: CVUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Update CV content and recalculate ATS score.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Check if CV exists
        existing = await db.execute(
            "SELECT * FROM cvs WHERE id = ? AND user_id = ?",
            (cv_id, current_user['id'])
        )
        
        if not existing:
            raise HTTPException(status_code=404, detail="CV not found")
        
        cv_data = existing[0]
        
        # Build update query
        updates = []
        params = []
        
        if update_request.title:
            updates.append("title = ?")
            params.append(update_request.title)
        
        if update_request.template:
            updates.append("template = ?")
            params.append(update_request.template.value)
        
        if update_request.sections:
            updates.append("sections = ?")
            params.append(json.dumps([s.dict() for s in update_request.sections]))
            
            # Recalculate ATS score
            template = CVTemplate(update_request.template.value if update_request.template else cv_data['template'])
            ats_score = await _calculate_ats_score(update_request.sections, template)
            updates.append("ats_score = ?")
            params.append(json.dumps(ats_score.dict()))
        
        if update_request.is_published is not None:
            updates.append("is_published = ?")
            params.append(update_request.is_published)
            
            # Generate public URL if publishing
            if update_request.is_published and not cv_data.get('public_url'):
                public_url = f"/public/cv/{secrets.token_urlsafe(16)}"
                updates.append("public_url = ?")
                params.append(public_url)
        
        # Add updated timestamp
        updates.append("updated_at = ?")
        params.append(datetime.utcnow())
        params.append(cv_id)
        
        # Update CV
        await db.execute(
            f"UPDATE cvs SET {', '.join(updates)} WHERE id = ?",
            tuple(params)
        )
        
        # Return updated CV
        return await get_cv(cv_id, current_user, db)
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/cv-builder/{cv_id}", method="PUT")
        raise HTTPException(status_code=500, detail="Failed to update CV")


@router.get("/{cv_id}/ats-score", response_model=ATSScore, tags=["CV Builder"])
async def get_ats_score(
    cv_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Get detailed ATS optimization score for a CV.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        cv = await db.execute(
            "SELECT sections, template, ats_score FROM cvs WHERE id = ? AND user_id = ?",
            (cv_id, current_user['id'])
        )
        
        if not cv:
            raise HTTPException(status_code=404, detail="CV not found")
        
        cv_data = cv[0]
        
        # Return cached score or recalculate
        if cv_data['ats_score']:
            return ATSScore(**json.loads(cv_data['ats_score']))
        
        # Recalculate if not cached
        sections = json.loads(cv_data['sections']) if cv_data['sections'] else []
        template = CVTemplate(cv_data['template'])
        sections_obj = [CVSection(**s) for s in sections]
        
        ats_score = await _calculate_ats_score(sections_obj, template)
        
        # Cache the score
        await db.execute(
            "UPDATE cvs SET ats_score = ? WHERE id = ?",
            (json.dumps(ats_score.dict()), cv_id)
        )
        
        return ats_score
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/cv-builder/{cv_id}/ats-score", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get ATS score")


@router.get("/{cv_id}/keyword-suggestions", response_model=List[KeywordSuggestion], tags=["CV Builder"])
async def get_keyword_suggestions(
    cv_id: str,
    job_title: Optional[str] = None,
    industry: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Get keyword suggestions for CV optimization.
    Professional+ feature.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Feature gating - Professional+ only
    if not hasFeature(current_user['plan'], 'cvBuilder.keywordRecommendations'):
        raise HTTPException(status_code=403, detail="Professional plan required for keyword suggestions")
    
    try:
        cv = await db.execute(
            "SELECT sections FROM cvs WHERE id = ? AND user_id = ?",
            (cv_id, current_user['id'])
        )
        
        if not cv:
            raise HTTPException(status_code=404, detail="CV not found")
        
        sections = json.loads(cv[0]['sections']) if cv[0]['sections'] else []
        sections_obj = [CVSection(**s) for s in sections]
        
        # Generate keyword suggestions based on job title and industry
        suggestions = await _generate_keyword_suggestions(sections_obj, job_title, industry, db)
        
        return suggestions
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/cv-builder/{cv_id}/keyword-suggestions", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get keyword suggestions")


@router.get("/{cv_id}/export/pdf", tags=["CV Builder"])
async def export_cv_pdf(
    cv_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Export CV as PDF.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        cv = await db.execute(
            "SELECT * FROM cvs WHERE id = ? AND user_id = ?",
            (cv_id, current_user['id'])
        )
        
        if not cv:
            raise HTTPException(status_code=404, detail="CV not found")
        
        cv_data = cv[0]
        sections = json.loads(cv_data['sections']) if cv_data['sections'] else []
        
        # Generate PDF
        pdf_buffer = await _generate_pdf(
            title=cv_data['title'],
            template=CVTemplate(cv_data['template']),
            sections=[CVSection(**s) for s in sections]
        )
        
        # Return PDF as streaming response
        return StreamingResponse(
            io.BytesIO(pdf_buffer),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={cv_data['title']}.pdf"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/cv-builder/{cv_id}/export/pdf", method="GET")
        raise HTTPException(status_code=500, detail="Failed to export PDF")


@router.get("/templates/", tags=["CV Builder"])
async def get_available_templates(
    current_user: dict = Depends(get_current_user)
):
    """
    Get available CV templates based on user plan.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Base templates for all users
    templates = [
        {
            "id": "standard",
            "name": "Standard",
            "description": "Clean, professional layout suitable for most industries",
            "preview_url": "/templates/previews/standard.png",
            "available": True
        }
    ]
    
    # Professional templates
    if hasFeature(current_user['plan'], 'cvBuilder.templates'):
        templates.extend([
            {
                "id": "professional",
                "name": "Professional",
                "description": "Modern design with emphasis on achievements",
                "preview_url": "/templates/previews/professional.png",
                "available": True
            },
            {
                "id": "technical",
                "name": "Technical",
                "description": "Perfect for IT and engineering roles",
                "preview_url": "/templates/previews/technical.png",
                "available": True
            }
        ])
    
    # Executive templates
    if hasFeature(current_user['plan'], 'cvBuilder.executiveTemplate'):
        templates.append({
            "id": "executive",
            "name": "Executive",
            "description": "Leadership-focused design for C-level positions",
            "preview_url": "/templates/previews/executive.png",
            "available": True
        })
    
    return {"templates": templates}


@router.delete("/{cv_id}", tags=["CV Builder"])
async def delete_cv(
    cv_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Delete a CV.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Check if CV exists
        existing = await db.execute(
            "SELECT id FROM cvs WHERE id = ? AND user_id = ?",
            (cv_id, current_user['id'])
        )
        
        if not existing:
            raise HTTPException(status_code=404, detail="CV not found")
        
        # Delete CV
        await db.execute(
            "DELETE FROM cvs WHERE id = ?",
            (cv_id,)
        )
        
        return {"message": "CV deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/cv-builder/{cv_id}", method="DELETE")
        raise HTTPException(status_code=500, detail="Failed to delete CV")


# Helper functions

async def _calculate_ats_score(sections: List[CVSection], template: CVTemplate) -> ATSScore:
    """Calculate ATS optimization score."""
    
    # Initialize scores
    keyword_score = 0
    format_score = 0
    structure_score = 0
    readability_score = 0
    
    recommendations = []
    missing_keywords = []
    suggestions = []
    
    # Analyze sections
    has_summary = any(s.section_type == 'summary' for s in sections)
    has_experience = any(s.section_type == 'experience' for s in sections)
    has_skills = any(s.section_type == 'skills' for s in sections)
    has_education = any(s.section_type == 'education' for s in sections)
    
    # Structure score (0-25 points)
    structure_points = 0
    if has_summary:
        structure_points += 8
    else:
        recommendations.append("Add a professional summary section")
        
    if has_experience:
        structure_points += 10
    else:
        recommendations.append("Add work experience section")
        
    if has_skills:
        structure_points += 4
        
    if has_education:
        structure_points += 3
        
    structure_score = structure_points
    
    # Format score (0-25 points)
    format_points = 20  # Base score for using templates
    if template in [CVTemplate.PROFESSIONAL, CVTemplate.EXECUTIVE]:
        format_points += 5
    format_score = format_points
    
    # Keyword score (0-30 points) - simplified analysis
    total_content = ""
    for section in sections:
        if isinstance(section.content, dict):
            for key, value in section.content.items():
                if isinstance(value, str):
                    total_content += value + " "
    
    word_count = len(total_content.split())
    if word_count > 200:
        keyword_score = 25
    elif word_count > 100:
        keyword_score = 15
    else:
        keyword_score = 5
        recommendations.append("Add more detailed content to improve keyword relevance")
    
    # Readability score (0-20 points)
    readability_score = 18  # Base good score
    
    # Calculate overall score
    overall_score = keyword_score + format_score + structure_score + readability_score
    
    # Generate suggestions
    if overall_score < 70:
        suggestions.extend([
            "Use action verbs to describe achievements",
            "Quantify your accomplishments with numbers",
            "Include relevant industry keywords"
        ])
    
    return ATSScore(
        overall_score=overall_score,
        keyword_score=keyword_score,
        format_score=format_score,
        structure_score=structure_score,
        readability_score=readability_score,
        recommendations=recommendations,
        missing_keywords=missing_keywords,
        suggestions=suggestions
    )


async def _generate_keyword_suggestions(
    sections: List[CVSection], 
    job_title: Optional[str], 
    industry: Optional[str],
    db
) -> List[KeywordSuggestion]:
    """Generate keyword suggestions based on job title and industry."""
    
    suggestions = []
    
    # Common professional keywords
    professional_keywords = [
        "leadership", "management", "strategic planning", "team collaboration",
        "project management", "problem solving", "communication", "analytical"
    ]
    
    # Industry-specific keywords
    industry_keywords = {
        "technology": ["agile", "scrum", "DevOps", "cloud computing", "API", "database"],
        "finance": ["financial analysis", "budgeting", "risk management", "compliance"],
        "marketing": ["digital marketing", "SEO", "content strategy", "brand management"],
        "retail": ["customer service", "sales", "inventory management", "merchandising"]
    }
    
    # Add professional keywords
    for keyword in professional_keywords[:5]:  # Limit to top 5
        suggestions.append(KeywordSuggestion(
            keyword=keyword,
            relevance_score=0.8,
            section_suggested="summary",
            context=f"Include '{keyword}' in your professional summary",
            priority="medium"
        ))
    
    # Add industry-specific keywords
    if industry and industry.lower() in industry_keywords:
        for keyword in industry_keywords[industry.lower()][:3]:  # Limit to top 3
            suggestions.append(KeywordSuggestion(
                keyword=keyword,
                relevance_score=0.9,
                section_suggested="skills",
                context=f"Add '{keyword}' to your skills section",
                priority="high"
            ))
    
    # Job title specific suggestions
    if job_title:
        title_words = job_title.lower().split()
        for word in title_words:
            if len(word) > 3:  # Skip short words
                suggestions.append(KeywordSuggestion(
                    keyword=word,
                    relevance_score=1.0,
                    section_suggested="summary",
                    context=f"Ensure '{word}' appears in your summary to match the job title",
                    priority="high"
                ))
    
    return suggestions


async def _generate_pdf(title: str, template: CVTemplate, sections: List[CVSection]) -> bytes:
    """Generate PDF from CV data."""
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=24,
        spaceAfter=30,
        alignment=1  # Center
    )
    story.append(Paragraph(title, title_style))
    story.append(Spacer(1, 0.2*inch))
    
    # Sort sections by order
    sorted_sections = sorted(sections, key=lambda x: x.order)
    
    for section in sorted_sections:
        if not section.is_visible:
            continue
            
        # Section title
        section_style = ParagraphStyle(
            'SectionTitle',
            parent=styles['Heading2'],
            fontSize=16,
            spaceAfter=12,
            textColor='navy'
        )
        story.append(Paragraph(section.title, section_style))
        
        # Section content
        if isinstance(section.content, dict):
            content_text = ""
            for key, value in section.content.items():
                if isinstance(value, str):
                    content_text += f"{value}\n"
                elif isinstance(value, list):
                    content_text += "\n".join(str(item) for item in value) + "\n"
            
            if content_text.strip():
                story.append(Paragraph(content_text, styles['Normal']))
                story.append(Spacer(1, 0.1*inch))
    
    # Build PDF
    doc.build(story)
    pdf_data = buffer.getvalue()
    buffer.close()
    
    return pdf_data
