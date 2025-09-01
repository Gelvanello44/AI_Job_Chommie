"""
Core data models for job listings and related entities.
Supports all pricing tiers and features.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field, HttpUrl, validator
from sqlalchemy import Column, String, Integer, Float, DateTime, JSON, Text, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector

Base = declarative_base()


class JobLevel(str, Enum):
    """Job level enumeration."""
    ENTRY = "entry"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"
    MANAGER = "manager"
    DIRECTOR = "director"
    EXECUTIVE = "executive"
    C_SUITE = "c_suite"


class JobType(str, Enum):
    """Job type enumeration."""
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    FREELANCE = "freelance"
    INTERNSHIP = "internship"
    TEMPORARY = "temporary"


class ApplicationStatus(str, Enum):
    """Application status enumeration."""
    DRAFT = "draft"
    APPLIED = "applied"
    VIEWED = "viewed"
    SHORTLISTED = "shortlisted"
    INTERVIEW = "interview"
    OFFER = "offer"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


# SQLAlchemy Models

class JobListing(Base):
    """Job listing database model."""
    __tablename__ = "job_listings"
    
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False, index=True)
    company_id = Column(String, ForeignKey("companies.id"))
    location = Column(String)
    remote_type = Column(String)  # onsite, remote, hybrid
    
    # Job Details
    description = Column(Text)
    requirements = Column(Text)
    responsibilities = Column(Text)
    skills = Column(JSON)  # List of required skills
    
    # Compensation
    salary_min = Column(Float)
    salary_max = Column(Float)
    salary_currency = Column(String, default="ZAR")
    benefits = Column(JSON)
    
    # Classification
    job_level = Column(String)
    job_type = Column(String)
    department = Column(String)
    industry = Column(String)
    
    # Metadata
    source_url = Column(String)
    posted_date = Column(DateTime)
    expiry_date = Column(DateTime)
    last_updated = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Advanced Features
    application_count = Column(Integer, default=0)
    view_count = Column(Integer, default=0)
    competition_level = Column(Float)  # 0-1 score
    match_scores = Column(JSON)  # User-specific match scores
    
    # Vector Embedding for semantic search
    embedding = Column(Vector(768))
    
    # Executive Features
    is_executive = Column(Boolean, default=False)
    is_headhunter_posted = Column(Boolean, default=False)
    is_hidden_market = Column(Boolean, default=False)
    
    # Relationships
    company = relationship("Company", back_populates="job_listings")
    applications = relationship("JobApplication", back_populates="job_listing")


class Company(Base):
    """Company database model."""
    __tablename__ = "companies"
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False, index=True)
    industry = Column(String)
    size = Column(String)  # 1-10, 11-50, 51-200, etc.
    founded_year = Column(Integer)
    
    # Location
    headquarters = Column(String)
    locations = Column(JSON)  # List of office locations
    
    # Details
    description = Column(Text)
    website = Column(String)
    linkedin_url = Column(String)
    glassdoor_url = Column(String)
    
    # Culture & Reviews
    culture_score = Column(Float)  # 0-5 rating
    review_count = Column(Integer)
    culture_insights = Column(JSON)
    employee_reviews = Column(JSON)
    
    # Leadership (Executive tier)
    leadership_team = Column(JSON)
    recent_news = Column(JSON)
    financial_data = Column(JSON)
    
    # Metadata
    logo_url = Column(String)
    last_updated = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    job_listings = relationship("JobListing", back_populates="company")


class JobApplication(Base):
    """Job application tracking model."""
    __tablename__ = "job_applications"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, index=True)
    job_listing_id = Column(String, ForeignKey("job_listings.id"))
    
    # Application Details
    status = Column(String, default=ApplicationStatus.DRAFT.value)
    applied_date = Column(DateTime)
    cover_letter = Column(Text)
    resume_version = Column(String)
    
    # Tracking
    recruiter_name = Column(String)
    recruiter_email = Column(String)
    recruiter_phone = Column(String)
    hr_contact = Column(JSON)
    
    # Interview Management (Professional/Executive)
    interview_dates = Column(JSON)
    interview_notes = Column(JSON)
    interviewer_profiles = Column(JSON)
    
    # References (Executive)
    references_provided = Column(JSON)
    reference_check_status = Column(String)
    
    # Analytics
    response_received = Column(Boolean, default=False)
    response_date = Column(DateTime)
    match_score = Column(Float)
    
    # Relationships
    job_listing = relationship("JobListing", back_populates="applications")


class NetworkingEvent(Base):
    """Networking event model (Executive tier)."""
    __tablename__ = "networking_events"
    
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    event_type = Column(String)  # conference, meetup, webinar, etc.
    
    # Event Details
    description = Column(Text)
    date = Column(DateTime)
    end_date = Column(DateTime)
    location = Column(String)
    is_virtual = Column(Boolean, default=False)
    
    # Target Audience
    industries = Column(JSON)
    job_levels = Column(JSON)
    expected_attendees = Column(Integer)
    
    # Registration
    registration_url = Column(String)
    cost = Column(Float)
    registration_deadline = Column(DateTime)
    
    # Metadata
    organizer = Column(String)
    speakers = Column(JSON)
    sponsors = Column(JSON)
    last_updated = Column(DateTime, default=datetime.utcnow)


class MarketIntelligence(Base):
    """Market intelligence data (Enterprise tier)."""
    __tablename__ = "market_intelligence"
    
    id = Column(String, primary_key=True)
    report_type = Column(String)  # salary_trend, skill_demand, industry_growth
    
    # Report Data
    title = Column(String)
    summary = Column(Text)
    data = Column(JSON)
    insights = Column(JSON)
    
    # Scope
    industry = Column(String)
    location = Column(String)
    job_level = Column(String)
    time_period = Column(String)
    
    # Metadata
    generated_date = Column(DateTime, default=datetime.utcnow)
    confidence_score = Column(Float)
    data_sources = Column(JSON)


# Pydantic Models for API

class JobListingCreate(BaseModel):
    """Job listing creation model."""
    title: str
    company_id: str
    location: str
    remote_type: str = "onsite"
    description: str
    requirements: Optional[str] = None
    responsibilities: Optional[str] = None
    skills: List[str] = []
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_currency: str = "ZAR"
    benefits: List[str] = []
    job_level: JobLevel
    job_type: JobType
    department: Optional[str] = None
    industry: Optional[str] = None
    source_url: HttpUrl
    posted_date: datetime
    expiry_date: Optional[datetime] = None
    is_executive: bool = False
    is_headhunter_posted: bool = False
    is_hidden_market: bool = False
    
    @validator('salary_max')
    def validate_salary_range(cls, v, values):
        """Ensure salary max is greater than min."""
        if v and 'salary_min' in values and values['salary_min']:
            if v < values['salary_min']:
                raise ValueError('salary_max must be greater than salary_min')
        return v


class JobListingResponse(JobListingCreate):
    """Job listing response model."""
    id: str
    last_updated: datetime
    is_active: bool = True
    application_count: int = 0
    view_count: int = 0
    competition_level: Optional[float] = None
    match_score: Optional[float] = None
    company: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True


class CompanyCreate(BaseModel):
    """Company creation model."""
    name: str
    industry: Optional[str] = None
    size: Optional[str] = None
    founded_year: Optional[int] = None
    headquarters: Optional[str] = None
    locations: List[str] = []
    description: Optional[str] = None
    website: Optional[HttpUrl] = None
    linkedin_url: Optional[HttpUrl] = None
    glassdoor_url: Optional[HttpUrl] = None
    logo_url: Optional[HttpUrl] = None


class CompanyResponse(CompanyCreate):
    """Company response model."""
    id: str
    culture_score: Optional[float] = None
    review_count: int = 0
    culture_insights: Optional[Dict[str, Any]] = None
    employee_reviews: Optional[List[Dict[str, Any]]] = None
    leadership_team: Optional[List[Dict[str, Any]]] = None
    recent_news: Optional[List[Dict[str, Any]]] = None
    last_updated: datetime
    
    class Config:
        from_attributes = True


class JobSearchQuery(BaseModel):
    """Job search query model."""
    query: Optional[str] = None
    location: Optional[str] = None
    remote_type: Optional[str] = None
    job_levels: Optional[List[JobLevel]] = None
    job_types: Optional[List[JobType]] = None
    industries: Optional[List[str]] = None
    salary_min: Optional[float] = None
    skills: Optional[List[str]] = None
    company_ids: Optional[List[str]] = None
    posted_after: Optional[datetime] = None
    include_hidden_market: bool = False
    include_executive_only: bool = False
    sort_by: str = "relevance"  # relevance, date, salary
    page: int = 1
    per_page: int = 20
    
    @validator('per_page')
    def validate_per_page(cls, v):
        """Limit results per page."""
        if v > 100:
            raise ValueError('per_page cannot exceed 100')
        return v


class JobMatchResult(BaseModel):
    """Job match result with scoring."""
    job: JobListingResponse
    match_score: float = Field(..., ge=0, le=1)
    match_reasons: List[str] = []
    missing_skills: List[str] = []
    salary_match: bool = True
    location_match: bool = True
    experience_match: bool = True


# Alias for backward compatibility with existing imports
Job = JobListingResponse
JobFilter = JobSearchQuery
