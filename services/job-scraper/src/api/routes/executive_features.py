"""
Executive Features API for premium tier users.

Provides advanced career development tools:
- Personal branding tools and analysis
- Leadership assessment and scoring
- Career trajectory planning with AI recommendations
- Headhunter visibility and networking controls
- Executive coaching recommendations
"""

import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, status, Query
from fastapi.responses import FileResponse

from src.api.auth.dependencies import get_current_user, require_subscription_tier
from src.api.models.user import User
from src.utils.database import get_database
from src.utils.cache import get_cache
from src.config.settings import settings

router = APIRouter()

# ==========================================
# Pydantic Models
# ==========================================

class PersonalBrandingProfile(BaseModel):
    """Personal branding profile model."""
    user_id: str
    brand_statement: Optional[str] = None
    value_proposition: Optional[str] = None
    target_audience: Optional[str] = None
    unique_selling_points: List[str] = Field(default_factory=list)
    brand_keywords: List[str] = Field(default_factory=list)
    social_media_strategy: Optional[Dict[str, Any]] = None
    content_themes: List[str] = Field(default_factory=list)
    networking_goals: Optional[str] = None
    thought_leadership_topics: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class BrandingAnalysis(BaseModel):
    """Brand analysis and recommendations."""
    overall_score: float = Field(..., ge=0, le=100)
    strengths: List[str]
    improvement_areas: List[str]
    keyword_gaps: List[str]
    competitor_analysis: Dict[str, Any]
    recommendations: List[Dict[str, Any]]
    industry_alignment: float = Field(..., ge=0, le=100)

class LeadershipAssessment(BaseModel):
    """Leadership assessment model."""
    assessment_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    assessment_type: str  # "360_review", "self_assessment", "situational_judgment"
    questions: List[Dict[str, Any]]
    responses: List[Dict[str, Any]] = Field(default_factory=list)
    scores: Optional[Dict[str, float]] = None
    competency_breakdown: Optional[Dict[str, float]] = None
    leadership_style: Optional[str] = None
    development_areas: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    action_plan: List[Dict[str, Any]] = Field(default_factory=list)
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CareerTrajectory(BaseModel):
    """Career trajectory and planning model."""
    user_id: str
    current_role: str
    target_roles: List[str]
    career_goals: Dict[str, Any]  # short_term, medium_term, long_term
    timeline: Dict[str, datetime]
    skill_gaps: List[Dict[str, Any]]
    recommended_actions: List[Dict[str, Any]]
    milestone_progress: Dict[str, float]
    industry_transitions: Optional[List[str]] = None
    salary_projections: Optional[Dict[str, Any]] = None
    networking_targets: Optional[List[str]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class HeadhunterVisibility(BaseModel):
    """Headhunter and recruiter visibility settings."""
    user_id: str
    is_visible: bool = True
    visibility_level: str = "high"  # "low", "medium", "high", "exclusive"
    target_industries: List[str] = Field(default_factory=list)
    target_roles: List[str] = Field(default_factory=list)
    salary_expectations: Optional[Dict[str, float]] = None
    availability_timeline: Optional[str] = None
    preferred_locations: List[str] = Field(default_factory=list)
    exclusion_companies: List[str] = Field(default_factory=list)
    contact_preferences: Dict[str, Any] = Field(default_factory=dict)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ExecutiveOpportunity(BaseModel):
    """Executive job opportunity model."""
    opportunity_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    company: str
    location: str
    salary_range: Dict[str, float]
    equity_package: Optional[Dict[str, Any]] = None
    reporting_structure: Optional[str] = None
    team_size: Optional[int] = None
    industry: str
    requirements: List[str]
    responsibilities: List[str]
    growth_potential: str
    company_stage: str  # "startup", "scale-up", "enterprise", "public"
    is_confidential: bool = False
    headhunter_contact: Optional[Dict[str, str]] = None
    application_deadline: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ==========================================
# Personal Branding Endpoints
# ==========================================

@router.post("/branding/profile", response_model=PersonalBrandingProfile)
async def create_branding_profile(
    profile_data: PersonalBrandingProfile,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Create or update personal branding profile."""
    try:
        profile_data.user_id = current_user.id
        
        # Store in database
        query = """
        INSERT INTO personal_branding_profiles 
        (user_id, brand_statement, value_proposition, target_audience, 
         unique_selling_points, brand_keywords, social_media_strategy,
         content_themes, networking_goals, thought_leadership_topics)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (user_id) DO UPDATE SET
        brand_statement = EXCLUDED.brand_statement,
        value_proposition = EXCLUDED.value_proposition,
        target_audience = EXCLUDED.target_audience,
        unique_selling_points = EXCLUDED.unique_selling_points,
        brand_keywords = EXCLUDED.brand_keywords,
        social_media_strategy = EXCLUDED.social_media_strategy,
        content_themes = EXCLUDED.content_themes,
        networking_goals = EXCLUDED.networking_goals,
        thought_leadership_topics = EXCLUDED.thought_leadership_topics,
        updated_at = NOW()
        RETURNING *
        """
        
        result = await db.fetch_one(
            query,
            profile_data.user_id,
            profile_data.brand_statement,
            profile_data.value_proposition,
            profile_data.target_audience,
            profile_data.unique_selling_points,
            profile_data.brand_keywords,
            profile_data.social_media_strategy,
            profile_data.content_themes,
            profile_data.networking_goals,
            profile_data.thought_leadership_topics
        )
        
        return PersonalBrandingProfile(**result)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save branding profile: {str(e)}"
        )

@router.get("/branding/profile", response_model=PersonalBrandingProfile)
async def get_branding_profile(
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Get user's personal branding profile."""
    query = "SELECT * FROM personal_branding_profiles WHERE user_id = $1"
    result = await db.fetch_one(query, current_user.id)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branding profile not found"
        )
    
    return PersonalBrandingProfile(**result)

@router.post("/branding/analyze", response_model=BrandingAnalysis)
async def analyze_personal_brand(
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Analyze personal brand and provide recommendations."""
    try:
        # Get user's branding profile
        profile_query = "SELECT * FROM personal_branding_profiles WHERE user_id = $1"
        profile = await db.fetch_one(profile_query, current_user.id)
        
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Please create a branding profile first"
            )
        
        # Get user's CV and application history for analysis
        cv_query = "SELECT * FROM cvs WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1"
        cv_data = await db.fetch_one(cv_query, current_user.id)
        
        # Perform AI-powered brand analysis
        analysis = await _analyze_brand_strength(profile, cv_data, current_user)
        
        return analysis
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze brand: {str(e)}"
        )

# ==========================================
# Leadership Assessment Endpoints
# ==========================================

@router.post("/leadership/assessment/start", response_model=LeadershipAssessment)
async def start_leadership_assessment(
    assessment_type: str = Query(..., regex="^(360_review|self_assessment|situational_judgment)$"),
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Start a new leadership assessment."""
    try:
        # Generate questions based on assessment type
        questions = await _generate_leadership_questions(assessment_type, current_user)
        
        assessment = LeadershipAssessment(
            user_id=current_user.id,
            assessment_type=assessment_type,
            questions=questions
        )
        
        # Store in database
        query = """
        INSERT INTO leadership_assessments 
        (assessment_id, user_id, assessment_type, questions)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        """
        
        result = await db.fetch_one(
            query,
            assessment.assessment_id,
            assessment.user_id,
            assessment.assessment_type,
            assessment.questions
        )
        
        return LeadershipAssessment(**result)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start assessment: {str(e)}"
        )

@router.post("/leadership/assessment/{assessment_id}/submit")
async def submit_leadership_responses(
    assessment_id: str,
    responses: List[Dict[str, Any]],
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Submit responses for leadership assessment."""
    try:
        # Verify assessment belongs to user
        check_query = "SELECT * FROM leadership_assessments WHERE assessment_id = $1 AND user_id = $2"
        assessment = await db.fetch_one(check_query, assessment_id, current_user.id)
        
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found"
            )
        
        # Score the responses
        scoring_result = await _score_leadership_assessment(
            assessment["questions"], 
            responses, 
            assessment["assessment_type"]
        )
        
        # Update assessment with results
        update_query = """
        UPDATE leadership_assessments 
        SET responses = $1, scores = $2, competency_breakdown = $3,
            leadership_style = $4, development_areas = $5, strengths = $6,
            action_plan = $7, completed_at = NOW()
        WHERE assessment_id = $8
        RETURNING *
        """
        
        result = await db.fetch_one(
            update_query,
            responses,
            scoring_result["scores"],
            scoring_result["competency_breakdown"],
            scoring_result["leadership_style"],
            scoring_result["development_areas"],
            scoring_result["strengths"],
            scoring_result["action_plan"],
            assessment_id
        )
        
        return {
            "assessment_id": assessment_id,
            "overall_score": scoring_result["scores"]["overall"],
            "leadership_style": scoring_result["leadership_style"],
            "strengths": scoring_result["strengths"],
            "development_areas": scoring_result["development_areas"],
            "action_plan": scoring_result["action_plan"],
            "competency_breakdown": scoring_result["competency_breakdown"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit assessment: {str(e)}"
        )

@router.get("/leadership/assessments", response_model=List[Dict[str, Any]])
async def get_leadership_assessments(
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Get user's leadership assessment history."""
    query = """
    SELECT assessment_id, assessment_type, completed_at, scores, leadership_style
    FROM leadership_assessments 
    WHERE user_id = $1 
    ORDER BY created_at DESC
    """
    
    results = await db.fetch_all(query, current_user.id)
    return [dict(result) for result in results]

# ==========================================
# Career Trajectory Planning
# ==========================================

@router.post("/career/trajectory", response_model=CareerTrajectory)
async def create_career_trajectory(
    trajectory_data: CareerTrajectory,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Create or update career trajectory plan."""
    try:
        trajectory_data.user_id = current_user.id
        
        # AI-powered trajectory analysis and recommendations
        ai_recommendations = await _generate_career_recommendations(trajectory_data, current_user)
        trajectory_data.recommended_actions = ai_recommendations["actions"]
        trajectory_data.skill_gaps = ai_recommendations["skill_gaps"]
        trajectory_data.salary_projections = ai_recommendations["salary_projections"]
        
        # Store in database
        query = """
        INSERT INTO career_trajectories 
        (user_id, current_role, target_roles, career_goals, timeline,
         skill_gaps, recommended_actions, milestone_progress,
         industry_transitions, salary_projections, networking_targets)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (user_id) DO UPDATE SET
        current_role = EXCLUDED.current_role,
        target_roles = EXCLUDED.target_roles,
        career_goals = EXCLUDED.career_goals,
        timeline = EXCLUDED.timeline,
        skill_gaps = EXCLUDED.skill_gaps,
        recommended_actions = EXCLUDED.recommended_actions,
        milestone_progress = EXCLUDED.milestone_progress,
        industry_transitions = EXCLUDED.industry_transitions,
        salary_projections = EXCLUDED.salary_projections,
        networking_targets = EXCLUDED.networking_targets,
        updated_at = NOW()
        RETURNING *
        """
        
        result = await db.fetch_one(
            query,
            trajectory_data.user_id,
            trajectory_data.current_role,
            trajectory_data.target_roles,
            trajectory_data.career_goals,
            trajectory_data.timeline,
            trajectory_data.skill_gaps,
            trajectory_data.recommended_actions,
            trajectory_data.milestone_progress,
            trajectory_data.industry_transitions,
            trajectory_data.salary_projections,
            trajectory_data.networking_targets
        )
        
        return CareerTrajectory(**result)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create trajectory: {str(e)}"
        )

@router.get("/career/trajectory", response_model=CareerTrajectory)
async def get_career_trajectory(
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Get user's career trajectory plan."""
    query = "SELECT * FROM career_trajectories WHERE user_id = $1"
    result = await db.fetch_one(query, current_user.id)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career trajectory not found"
        )
    
    return CareerTrajectory(**result)

@router.post("/career/trajectory/milestone/{milestone_id}/update")
async def update_milestone_progress(
    milestone_id: str,
    progress: float = Query(..., ge=0, le=100),
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Update progress on a career milestone."""
    try:
        # Update milestone progress
        query = """
        UPDATE career_trajectories 
        SET milestone_progress = jsonb_set(
            milestone_progress, 
            ARRAY[$2], 
            to_jsonb($3::float)
        ),
        updated_at = NOW()
        WHERE user_id = $1
        RETURNING *
        """
        
        result = await db.fetch_one(query, current_user.id, milestone_id, progress)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Career trajectory not found"
            )
        
        return {"milestone_id": milestone_id, "progress": progress, "updated_at": datetime.utcnow()}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update milestone: {str(e)}"
        )

# ==========================================
# Headhunter Visibility Controls
# ==========================================

@router.post("/headhunter/visibility", response_model=HeadhunterVisibility)
async def update_headhunter_visibility(
    visibility_data: HeadhunterVisibility,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Update headhunter visibility settings."""
    try:
        visibility_data.user_id = current_user.id
        
        query = """
        INSERT INTO headhunter_visibility 
        (user_id, is_visible, visibility_level, target_industries,
         target_roles, salary_expectations, availability_timeline,
         preferred_locations, exclusion_companies, contact_preferences)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (user_id) DO UPDATE SET
        is_visible = EXCLUDED.is_visible,
        visibility_level = EXCLUDED.visibility_level,
        target_industries = EXCLUDED.target_industries,
        target_roles = EXCLUDED.target_roles,
        salary_expectations = EXCLUDED.salary_expectations,
        availability_timeline = EXCLUDED.availability_timeline,
        preferred_locations = EXCLUDED.preferred_locations,
        exclusion_companies = EXCLUDED.exclusion_companies,
        contact_preferences = EXCLUDED.contact_preferences,
        updated_at = NOW()
        RETURNING *
        """
        
        result = await db.fetch_one(
            query,
            visibility_data.user_id,
            visibility_data.is_visible,
            visibility_data.visibility_level,
            visibility_data.target_industries,
            visibility_data.target_roles,
            visibility_data.salary_expectations,
            visibility_data.availability_timeline,
            visibility_data.preferred_locations,
            visibility_data.exclusion_companies,
            visibility_data.contact_preferences
        )
        
        return HeadhunterVisibility(**result)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update visibility: {str(e)}"
        )

@router.get("/headhunter/visibility", response_model=HeadhunterVisibility)
async def get_headhunter_visibility(
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Get headhunter visibility settings."""
    query = "SELECT * FROM headhunter_visibility WHERE user_id = $1"
    result = await db.fetch_one(query, current_user.id)
    
    if not result:
        # Return default settings if none exist
        return HeadhunterVisibility(user_id=current_user.id)
    
    return HeadhunterVisibility(**result)

# ==========================================
# Executive Opportunities
# ==========================================

@router.get("/opportunities", response_model=List[ExecutiveOpportunity])
async def get_executive_opportunities(
    industry: Optional[str] = None,
    min_salary: Optional[float] = None,
    location: Optional[str] = None,
    include_confidential: bool = True,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Get executive-level opportunities matched to user's profile."""
    try:
        # Build dynamic query based on filters
        conditions = ["1=1"]  # Always true condition to start
        params = []
        param_count = 0
        
        if industry:
            param_count += 1
            conditions.append(f"industry = ${param_count}")
            params.append(industry)
            
        if min_salary:
            param_count += 1
            conditions.append(f"(salary_range->>'max')::float >= ${param_count}")
            params.append(min_salary)
            
        if location:
            param_count += 1
            conditions.append(f"location ILIKE ${param_count}")
            params.append(f"%{location}%")
            
        if not include_confidential:
            conditions.append("is_confidential = false")
        
        query = f"""
        SELECT * FROM executive_opportunities 
        WHERE {' AND '.join(conditions)}
        ORDER BY created_at DESC
        LIMIT 20
        """
        
        results = await db.fetch_all(query, *params)
        return [ExecutiveOpportunity(**result) for result in results]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch opportunities: {str(e)}"
        )

@router.get("/opportunities/{opportunity_id}", response_model=ExecutiveOpportunity)
async def get_opportunity_details(
    opportunity_id: str,
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Get detailed information about an executive opportunity."""
    query = "SELECT * FROM executive_opportunities WHERE opportunity_id = $1"
    result = await db.fetch_one(query, opportunity_id)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found"
        )
    
    return ExecutiveOpportunity(**result)

# ==========================================
# Executive Coaching Recommendations
# ==========================================

@router.get("/coaching/recommendations")
async def get_coaching_recommendations(
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Get personalized executive coaching recommendations."""
    try:
        # Get user's assessment data for recommendations
        leadership_query = """
        SELECT * FROM leadership_assessments 
        WHERE user_id = $1 AND completed_at IS NOT NULL
        ORDER BY completed_at DESC LIMIT 1
        """
        
        trajectory_query = "SELECT * FROM career_trajectories WHERE user_id = $1"
        
        leadership_data = await db.fetch_one(leadership_query, current_user.id)
        trajectory_data = await db.fetch_one(trajectory_query, current_user.id)
        
        # Generate coaching recommendations
        recommendations = await _generate_coaching_recommendations(
            leadership_data, trajectory_data, current_user
        )
        
        return {
            "coaching_areas": recommendations["areas"],
            "recommended_coaches": recommendations["coaches"],
            "development_programs": recommendations["programs"],
            "timeline": recommendations["timeline"],
            "investment_estimate": recommendations["investment"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get coaching recommendations: {str(e)}"
        )

# ==========================================
# Reports and Analytics
# ==========================================

@router.get("/reports/brand-performance")
async def get_brand_performance_report(
    period: str = Query("30d", regex="^(7d|30d|90d|1y)$"),
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Get brand performance analytics report."""
    try:
        # Calculate period start date
        days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
        start_date = datetime.utcnow() - timedelta(days=days_map[period])
        
        # Get metrics for the period
        metrics = await _calculate_brand_metrics(current_user.id, start_date, db)
        
        return {
            "period": period,
            "metrics": metrics,
            "trends": await _calculate_brand_trends(current_user.id, start_date, db),
            "generated_at": datetime.utcnow()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report: {str(e)}"
        )

@router.get("/reports/career-progress")
async def get_career_progress_report(
    current_user: User = Depends(get_current_user),
    subscription_check: bool = Depends(require_subscription_tier("executive")),
    db = Depends(get_database)
):
    """Get comprehensive career progress report."""
    try:
        # Get trajectory data
        trajectory_query = "SELECT * FROM career_trajectories WHERE user_id = $1"
        trajectory = await db.fetch_one(trajectory_query, current_user.id)
        
        if not trajectory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Career trajectory not found"
            )
        
        # Calculate progress metrics
        progress_metrics = await _calculate_career_progress(trajectory, current_user, db)
        
        return {
            "overall_progress": progress_metrics["overall"],
            "milestone_status": progress_metrics["milestones"],
            "skill_development": progress_metrics["skills"],
            "network_growth": progress_metrics["network"],
            "market_positioning": progress_metrics["positioning"],
            "next_steps": progress_metrics["next_steps"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate progress report: {str(e)}"
        )

# ==========================================
# Helper Functions
# ==========================================

async def _analyze_brand_strength(profile: Dict[str, Any], cv_data: Optional[Dict[str, Any]], user: User) -> BrandingAnalysis:
    """Analyze personal brand strength and provide recommendations."""
    # Simulate AI analysis (replace with actual AI service call)
    strengths = []
    improvement_areas = []
    keyword_gaps = []
    
    # Analyze brand statement
    if profile.get("brand_statement"):
        strengths.append("Clear brand statement defined")
    else:
        improvement_areas.append("Develop a compelling brand statement")
    
    # Analyze keyword optimization
    if profile.get("brand_keywords") and len(profile["brand_keywords"]) >= 5:
        strengths.append("Good keyword diversity")
    else:
        improvement_areas.append("Expand brand keyword portfolio")
        keyword_gaps.extend(["leadership", "innovation", "transformation", "strategy"])
    
    # Overall scoring
    score_components = {
        "brand_clarity": 75 if profile.get("brand_statement") else 30,
        "keyword_optimization": 80 if len(profile.get("brand_keywords", [])) >= 5 else 40,
        "value_proposition": 85 if profile.get("value_proposition") else 25,
        "thought_leadership": 70 if profile.get("thought_leadership_topics") else 20
    }
    
    overall_score = sum(score_components.values()) / len(score_components)
    
    return BrandingAnalysis(
        overall_score=overall_score,
        strengths=strengths,
        improvement_areas=improvement_areas,
        keyword_gaps=keyword_gaps,
        competitor_analysis={"industry_leaders": ["Top performers in your field"]},
        recommendations=[
            {"area": "Content Strategy", "action": "Publish weekly thought leadership content"},
            {"area": "Networking", "action": "Attend 2 industry events monthly"},
            {"area": "Digital Presence", "action": "Optimize LinkedIn profile weekly"}
        ],
        industry_alignment=75.0
    )

async def _generate_leadership_questions(assessment_type: str, user: User) -> List[Dict[str, Any]]:
    """Generate leadership assessment questions based on type."""
    questions = []
    
    if assessment_type == "self_assessment":
        questions = [
            {
                "id": "leadership_1",
                "question": "How do you typically handle conflict within your team?",
                "type": "multiple_choice",
                "options": [
                    "Address it directly and immediately",
                    "Facilitate a discussion between parties",
                    "Escalate to higher management",
                    "Let team members work it out themselves"
                ]
            },
            {
                "id": "leadership_2", 
                "question": "Describe a time when you had to make a difficult decision with limited information.",
                "type": "text",
                "max_words": 200
            },
            {
                "id": "leadership_3",
                "question": "Rate your ability to inspire and motivate others (1-10):",
                "type": "scale",
                "min": 1,
                "max": 10
            }
        ]
    elif assessment_type == "situational_judgment":
        questions = [
            {
                "id": "situation_1",
                "scenario": "Your team missed a critical deadline. The client is upset and your CEO wants answers.",
                "question": "What is your first action?",
                "type": "multiple_choice",
                "options": [
                    "Take full responsibility and present a recovery plan",
                    "Analyze what went wrong with the team first",
                    "Meet with the client to manage expectations",
                    "Document lessons learned for future projects"
                ]
            }
        ]
    
    return questions

async def _score_leadership_assessment(questions: List[Dict], responses: List[Dict], assessment_type: str) -> Dict[str, Any]:
    """Score leadership assessment responses."""
    # Simulate AI scoring (replace with actual AI service)
    
    competency_scores = {
        "strategic_thinking": 78.5,
        "team_leadership": 85.2,
        "communication": 82.1,
        "decision_making": 76.8,
        "emotional_intelligence": 88.3,
        "adaptability": 79.4
    }
    
    overall_score = sum(competency_scores.values()) / len(competency_scores)
    
    # Determine leadership style
    leadership_style = "Transformational Leader"  # Based on assessment responses
    
    return {
        "scores": {
            "overall": overall_score,
            **competency_scores
        },
        "competency_breakdown": competency_scores,
        "leadership_style": leadership_style,
        "strengths": ["Emotional Intelligence", "Team Leadership"],
        "development_areas": ["Strategic Thinking", "Decision Making"],
        "action_plan": [
            {
                "area": "Strategic Thinking",
                "actions": ["Complete strategic planning course", "Seek mentorship from senior executives"],
                "timeline": "3 months"
            }
        ]
    }

async def _generate_career_recommendations(trajectory: CareerTrajectory, user: User) -> Dict[str, Any]:
    """Generate AI-powered career recommendations."""
    # Simulate AI recommendations (replace with actual AI service)
    
    return {
        "actions": [
            {
                "priority": "high",
                "action": "Complete MBA or executive education program",
                "impact": "Qualify for C-suite positions",
                "timeline": "12-24 months"
            },
            {
                "priority": "medium", 
                "action": "Build thought leadership through speaking engagements",
                "impact": "Increase industry visibility",
                "timeline": "6 months"
            }
        ],
        "skill_gaps": [
            {
                "skill": "Digital Transformation",
                "current_level": 6,
                "target_level": 9,
                "development_path": ["Course", "Certification", "Project Experience"]
            }
        ],
        "salary_projections": {
            "current": 850000,
            "1_year": 950000,
            "3_year": 1200000,
            "5_year": 1500000
        }
    }

async def _generate_coaching_recommendations(leadership_data: Optional[Dict], trajectory_data: Optional[Dict], user: User) -> Dict[str, Any]:
    """Generate personalized coaching recommendations."""
    
    return {
        "areas": ["Executive Presence", "Strategic Communication", "Change Management"],
        "coaches": [
            {
                "name": "Dr. Sarah Mitchell",
                "specialization": "C-Suite Coaching",
                "experience": "15+ years",
                "rate": "R2500/hour",
                "availability": "Within 2 weeks"
            }
        ],
        "programs": [
            {
                "name": "Executive Leadership Intensive",
                "duration": "6 months",
                "format": "1-on-1 + group sessions",
                "investment": "R45,000"
            }
        ],
        "timeline": "6-12 months for significant impact",
        "investment": "R35,000 - R75,000 depending on program selection"
    }

async def _calculate_brand_metrics(user_id: str, start_date: datetime, db) -> Dict[str, Any]:
    """Calculate brand performance metrics."""
    
    return {
        "profile_views": 245,
        "content_engagement": 18.5,
        "network_growth": 23,
        "thought_leadership_score": 78.2,
        "industry_ranking": "Top 15%"
    }

async def _calculate_brand_trends(user_id: str, start_date: datetime, db) -> Dict[str, Any]:
    """Calculate brand performance trends."""
    
    return {
        "profile_views_trend": "+12%",
        "engagement_trend": "+8.5%",
        "network_growth_trend": "+15%",
        "industry_ranking_trend": "Stable"
    }

async def _calculate_career_progress(trajectory: Dict[str, Any], user: User, db) -> Dict[str, Any]:
    """Calculate career progress metrics."""
    
    return {
        "overall": 68.5,
        "milestones": {
            "skill_development": 75,
            "network_building": 60,
            "leadership_experience": 70,
            "industry_recognition": 45
        },
        "skills": {
            "completed_courses": 4,
            "certifications_earned": 2,
            "competency_improvements": ["Digital Strategy", "Team Leadership"]
        },
        "network": {
            "connections_added": 35,
            "meaningful_relationships": 8,
            "mentor_relationships": 2
        },
        "positioning": {
            "market_visibility": "High",
            "thought_leadership": "Developing",
            "industry_recognition": "Growing"
        },
        "next_steps": [
            "Complete leadership certification",
            "Speak at industry conference",
            "Expand network in target industry"
        ]
    }
