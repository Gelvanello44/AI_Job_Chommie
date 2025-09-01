"""
Skills Assessment API with quiz engine, scoring, and badge generation.
Provides comprehensive skills evaluation with insights dashboard.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timedelta
from enum import Enum
import secrets
import json

from src.config.sentry import capture_api_error, add_scraping_breadcrumb
from src.api.routes.auth import get_current_user
from src.utils.database import get_database

router = APIRouter()

class SkillCategory(str, Enum):
    TECHNICAL = "technical"
    SOFT_SKILLS = "soft_skills"
    LEADERSHIP = "leadership"
    COMMUNICATION = "communication"
    PROBLEM_SOLVING = "problem_solving"

class QuestionType(str, Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    SCENARIO = "scenario"
    RANKING = "ranking"

class QuizQuestion(BaseModel):
    id: str
    category: SkillCategory
    question: str
    type: QuestionType
    options: List[str]
    correct_answer: str
    weight: float = 1.0
    difficulty: str = "medium"

class QuizAnswer(BaseModel):
    question_id: str
    selected_answer: str
    time_taken: Optional[int] = None

class SkillScore(BaseModel):
    category: SkillCategory
    score: float  # 0-100
    level: str  # beginner, intermediate, advanced, expert
    strengths: List[str]
    improvement_areas: List[str]

class AssessmentResult(BaseModel):
    id: str
    user_id: str
    overall_score: float
    skill_scores: List[SkillScore]
    top_skills: List[str]
    badges_earned: List[str]
    recommendations: List[str]
    completed_at: datetime
    can_retake_at: Optional[datetime] = None

@router.get("/quiz/start", tags=["Skills Assessment"])
async def start_quiz(
    category: Optional[SkillCategory] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Start a new skills assessment quiz."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Check if user can take quiz (not taken in last 7 days)
        recent_quiz = await db.execute("""
            SELECT completed_at FROM skill_assessments 
            WHERE user_id = ? AND completed_at > ?
            ORDER BY completed_at DESC LIMIT 1
        """, (current_user['id'], datetime.utcnow() - timedelta(days=7)))
        
        if recent_quiz:
            last_completed = recent_quiz[0]['completed_at']
            can_retake_at = last_completed + timedelta(days=7)
            if datetime.utcnow() < can_retake_at:
                raise HTTPException(
                    status_code=429, 
                    detail=f"Can retake quiz after {can_retake_at.isoformat()}"
                )
        
        # Generate quiz questions
        questions = _generate_quiz_questions(category)
        
        # Create quiz session
        quiz_id = secrets.token_urlsafe(16)
        await db.execute("""
            INSERT INTO quiz_sessions (
                id, user_id, category, questions, started_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, (
            quiz_id, current_user['id'], category.value if category else 'general',
            json.dumps([q.dict() for q in questions]),
            datetime.utcnow(), datetime.utcnow() + timedelta(hours=1)
        ))
        
        # Return questions without correct answers
        quiz_questions = []
        for q in questions:
            quiz_questions.append({
                "id": q.id,
                "category": q.category,
                "question": q.question,
                "type": q.type,
                "options": q.options,
                "difficulty": q.difficulty
            })
        
        return {
            "quiz_id": quiz_id,
            "questions": quiz_questions,
            "total_questions": len(questions),
            "time_limit_minutes": 30
        }
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint="/skills-assessment/quiz/start", method="GET")
        raise HTTPException(status_code=500, detail="Failed to start quiz")

@router.post("/quiz/{quiz_id}/submit", response_model=AssessmentResult, tags=["Skills Assessment"])
async def submit_quiz(
    quiz_id: str,
    answers: List[QuizAnswer],
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Submit quiz answers and get assessment results."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Get quiz session
        quiz_session = await db.execute(
            "SELECT * FROM quiz_sessions WHERE id = ? AND user_id = ?",
            (quiz_id, current_user['id'])
        )
        
        if not quiz_session:
            raise HTTPException(status_code=404, detail="Quiz session not found")
        
        session = quiz_session[0]
        if datetime.utcnow() > session['expires_at']:
            raise HTTPException(status_code=410, detail="Quiz session expired")
        
        questions = [QuizQuestion(**q) for q in json.loads(session['questions'])]
        
        # Calculate scores
        result = _calculate_assessment_scores(questions, answers)
        result.user_id = current_user['id']
        result.id = secrets.token_urlsafe(16)
        
        # Save assessment result
        await db.execute("""
            INSERT INTO skill_assessments (
                id, user_id, overall_score, skill_scores, top_skills,
                badges_earned, recommendations, completed_at, can_retake_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            result.id, result.user_id, result.overall_score,
            json.dumps([s.dict() for s in result.skill_scores]),
            json.dumps(result.top_skills), json.dumps(result.badges_earned),
            json.dumps(result.recommendations), result.completed_at,
            result.can_retake_at
        ))
        
        # Clean up quiz session
        await db.execute("DELETE FROM quiz_sessions WHERE id = ?", (quiz_id,))
        
        add_scraping_breadcrumb("Skills assessment completed", data={
            "user_id": current_user['id'],
            "overall_score": result.overall_score,
            "badges_earned": len(result.badges_earned)
        })
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        capture_api_error(e, endpoint=f"/skills-assessment/quiz/{quiz_id}/submit", method="POST")
        raise HTTPException(status_code=500, detail="Failed to submit quiz")

@router.get("/results", response_model=List[AssessmentResult], tags=["Skills Assessment"])
async def get_assessment_history(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get user's skills assessment history."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        assessments = await db.execute("""
            SELECT * FROM skill_assessments 
            WHERE user_id = ? 
            ORDER BY completed_at DESC
            LIMIT 10
        """, (current_user['id'],))
        
        results = []
        for assessment in assessments:
            result = AssessmentResult(
                id=assessment['id'],
                user_id=assessment['user_id'],
                overall_score=assessment['overall_score'],
                skill_scores=[SkillScore(**s) for s in json.loads(assessment['skill_scores'])],
                top_skills=json.loads(assessment['top_skills']),
                badges_earned=json.loads(assessment['badges_earned']),
                recommendations=json.loads(assessment['recommendations']),
                completed_at=assessment['completed_at'],
                can_retake_at=assessment.get('can_retake_at')
            )
            results.append(result)
        
        return results
        
    except Exception as e:
        capture_api_error(e, endpoint="/skills-assessment/results", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get assessment history")

@router.get("/badges", tags=["Skills Assessment"])
async def get_user_badges(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get all badges earned by the user."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Get latest assessment
        latest = await db.execute("""
            SELECT badges_earned FROM skill_assessments 
            WHERE user_id = ? 
            ORDER BY completed_at DESC LIMIT 1
        """, (current_user['id'],))
        
        if not latest:
            return {"badges": [], "total_badges": 0}
        
        badges_earned = json.loads(latest[0]['badges_earned'])
        
        # Get badge details
        badge_details = _get_badge_details(badges_earned)
        
        return {
            "badges": badge_details,
            "total_badges": len(badges_earned)
        }
        
    except Exception as e:
        capture_api_error(e, endpoint="/skills-assessment/badges", method="GET")
        raise HTTPException(status_code=500, detail="Failed to get badges")

# Helper functions
def _generate_quiz_questions(category: Optional[SkillCategory] = None) -> List[QuizQuestion]:
    """Generate quiz questions based on category."""
    
    questions = []
    
    # Technical questions
    tech_questions = [
        {
            "id": "tech_1",
            "category": SkillCategory.TECHNICAL,
            "question": "Which programming paradigm focuses on writing code as a sequence of functions?",
            "type": QuestionType.MULTIPLE_CHOICE,
            "options": ["Object-Oriented", "Functional", "Procedural", "Logic"],
            "correct_answer": "Functional",
            "difficulty": "intermediate"
        },
        {
            "id": "tech_2",
            "category": SkillCategory.TECHNICAL,
            "question": "What does API stand for?",
            "type": QuestionType.MULTIPLE_CHOICE,
            "options": ["Application Programming Interface", "Advanced Program Integration", "Automated Process Integration", "Application Process Interface"],
            "correct_answer": "Application Programming Interface",
            "difficulty": "beginner"
        }
    ]
    
    # Soft skills questions
    soft_questions = [
        {
            "id": "soft_1",
            "category": SkillCategory.SOFT_SKILLS,
            "question": "When working on a team project with conflicting opinions, what's your best approach?",
            "type": QuestionType.MULTIPLE_CHOICE,
            "options": ["Assert your opinion strongly", "Listen to all viewpoints and find common ground", "Let the team leader decide", "Avoid the conflict"],
            "correct_answer": "Listen to all viewpoints and find common ground",
            "difficulty": "intermediate"
        }
    ]
    
    # Leadership questions
    leadership_questions = [
        {
            "id": "lead_1",
            "category": SkillCategory.LEADERSHIP,
            "question": "How do you motivate a team member who's underperforming?",
            "type": QuestionType.SCENARIO,
            "options": ["Provide clear expectations and support", "Criticize their work publicly", "Ignore the issue", "Assign them easier tasks"],
            "correct_answer": "Provide clear expectations and support",
            "difficulty": "advanced"
        }
    ]
    
    all_questions = tech_questions + soft_questions + leadership_questions
    
    if category:
        filtered = [q for q in all_questions if q["category"] == category]
        questions = [QuizQuestion(**q) for q in filtered]
    else:
        # Mix of all categories
        questions = [QuizQuestion(**q) for q in all_questions[:10]]
    
    return questions

def _calculate_assessment_scores(questions: List[QuizQuestion], answers: List[QuizAnswer]) -> AssessmentResult:
    """Calculate assessment scores and generate insights."""
    
    answer_dict = {a.question_id: a.selected_answer for a in answers}
    
    # Calculate scores by category
    category_scores = {}
    category_totals = {}
    
    for question in questions:
        cat = question.category
        if cat not in category_scores:
            category_scores[cat] = 0
            category_totals[cat] = 0
        
        user_answer = answer_dict.get(question.id)
        if user_answer == question.correct_answer:
            category_scores[cat] += question.weight
        category_totals[cat] += question.weight
    
    # Generate skill scores
    skill_scores = []
    for category, total_score in category_scores.items():
        total_possible = category_totals[category]
        percentage = (total_score / total_possible * 100) if total_possible > 0 else 0
        
        level = "beginner"
        if percentage >= 90:
            level = "expert"
        elif percentage >= 75:
            level = "advanced"
        elif percentage >= 60:
            level = "intermediate"
        
        strengths = []
        improvement_areas = []
        
        if percentage >= 75:
            strengths.append(f"Strong {category.value.replace('_', ' ')} skills")
        else:
            improvement_areas.append(f"Consider improving {category.value.replace('_', ' ')} skills")
        
        skill_scores.append(SkillScore(
            category=category,
            score=percentage,
            level=level,
            strengths=strengths,
            improvement_areas=improvement_areas
        ))
    
    # Calculate overall score
    overall_score = sum(s.score for s in skill_scores) / len(skill_scores) if skill_scores else 0
    
    # Determine top skills
    top_skills = [s.category.value for s in sorted(skill_scores, key=lambda x: x.score, reverse=True)[:3]]
    
    # Award badges
    badges_earned = []
    if overall_score >= 90:
        badges_earned.append("Skills Master")
    if overall_score >= 75:
        badges_earned.append("High Achiever")
    if any(s.score >= 95 for s in skill_scores):
        badges_earned.append("Expert Level")
    
    # Generate recommendations
    recommendations = []
    for skill in skill_scores:
        if skill.score < 70:
            recommendations.append(f"Consider taking courses in {skill.category.value.replace('_', ' ')}")
    
    if not recommendations:
        recommendations.append("Great job! Consider taking advanced courses to further improve")
    
    return AssessmentResult(
        id="",  # Will be set by caller
        user_id="",  # Will be set by caller
        overall_score=overall_score,
        skill_scores=skill_scores,
        top_skills=top_skills,
        badges_earned=badges_earned,
        recommendations=recommendations,
        completed_at=datetime.utcnow(),
        can_retake_at=datetime.utcnow() + timedelta(days=7)
    )

def _get_badge_details(badges_earned: List[str]) -> List[Dict[str, Any]]:
    """Get detailed information about earned badges."""
    
    badge_info = {
        "Skills Master": {
            "name": "Skills Master",
            "description": "Achieved 90%+ overall score",
            "icon": "",
            "color": "gold"
        },
        "High Achiever": {
            "name": "High Achiever", 
            "description": "Achieved 75%+ overall score",
            "icon": "",
            "color": "silver"
        },
        "Expert Level": {
            "name": "Expert Level",
            "description": "Achieved 95%+ in at least one skill category",
            "icon": "",
            "color": "diamond"
        }
    }
    
    return [badge_info.get(badge, {"name": badge, "description": "Special achievement"}) for badge in badges_earned]
