"""
GraphQL schema for job scraping service.
Provides flexible querying capabilities for all features.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
import strawberry
from strawberry.types import Info
from strawberry.scalars import JSON

from src.models.job_models import JobLevel, JobType
from src.utils.database import Database
from src.utils.cache import CacheManager
from src.processors.job_matcher import JobMatcher
from src.processors.analytics import AnalyticsProcessor


# GraphQL Types

@strawberry.type
class Company:
    """Company GraphQL type."""
    id: str
    name: str
    industry: Optional[str]
    size: Optional[str]
    headquarters: Optional[str]
    website: Optional[str]
    culture_score: Optional[float]
    review_count: int
    logo_url: Optional[str]
    
    @strawberry.field
    async def culture_insights(self) -> Optional[JSON]:
        """Get culture insights (Professional tier+)."""
        # This would check user tier
        return self._culture_insights
    
    @strawberry.field
    async def leadership_team(self) -> Optional[JSON]:
        """Get leadership team info (Executive tier+)."""
        return self._leadership_team
    
    @strawberry.field
    async def recent_news(self) -> Optional[JSON]:
        """Get recent company news (Executive tier+)."""
        return self._recent_news


@strawberry.type
class JobListing:
    """Job listing GraphQL type."""
    id: str
    title: str
    company: Company
    location: str
    remote_type: str
    description: str
    requirements: Optional[str]
    responsibilities: Optional[str]
    skills: List[str]
    salary_min: Optional[float]
    salary_max: Optional[float]
    salary_currency: str
    benefits: List[str]
    job_level: str
    job_type: str
    posted_date: datetime
    is_active: bool
    application_count: Optional[int]
    view_count: int
    competition_level: Optional[float]
    match_score: Optional[float]
    
    @strawberry.field
    async def is_executive(self) -> bool:
        """Check if executive position."""
        return self.job_level in ['executive', 'director', 'c_suite']
    
    @strawberry.field
    async def salary_insights(self, info: Info) -> Optional[JSON]:
        """Get salary insights (Professional tier+)."""
        # Would implement salary benchmarking
        return {
            "market_average": self.salary_min * 1.1 if self.salary_min else None,
            "percentile": 75,
            "trend": "increasing"
        }


@strawberry.type
class NetworkingEvent:
    """Networking event GraphQL type (Executive tier)."""
    id: str
    title: str
    event_type: str
    description: str
    date: datetime
    location: str
    is_virtual: bool
    industries: List[str]
    expected_attendees: int
    registration_url: Optional[str]
    cost: Optional[float]
    speakers: Optional[JSON]
    
    @strawberry.field
    async def recommended_for_user(self, info: Info) -> bool:
        """Check if event is recommended for user."""
        # Would use user profile to determine recommendation
        return True


@strawberry.type
class MarketIntelligence:
    """Market intelligence GraphQL type (Enterprise tier)."""
    id: str
    report_type: str
    title: str
    summary: str
    data: JSON
    insights: JSON
    industry: Optional[str]
    location: Optional[str]
    generated_date: datetime
    confidence_score: float


@strawberry.type
class JobSearchResult:
    """Job search result with pagination."""
    jobs: List[JobListing]
    total: int
    page: int
    per_page: int
    has_next: bool
    has_prev: bool
    
    @strawberry.field
    async def facets(self) -> JSON:
        """Get search facets for filtering."""
        return {
            "locations": ["Cape Town", "Johannesburg", "Durban"],
            "industries": ["Technology", "Finance", "Healthcare"],
            "job_levels": ["entry", "mid", "senior", "executive"],
            "salary_ranges": ["0-500k", "500k-1M", "1M+"]
        }


@strawberry.type
class SalaryBenchmark:
    """Salary benchmark result (Professional tier+)."""
    job_title: str
    location: str
    percentile_25: float
    median: float
    percentile_75: float
    sample_size: int
    last_updated: datetime
    factors: JSON


@strawberry.type
class CareerTrajectory:
    """Career trajectory analysis (Enterprise tier)."""
    current_position: str
    recommended_next_steps: List[str]
    skill_gaps: List[str]
    timeline: JSON
    success_probability: float


@strawberry.type
class PersonalBrandAudit:
    """Personal brand audit result (Enterprise tier)."""
    online_presence_score: float
    visibility_score: float
    consistency_score: float
    recommendations: List[str]
    competitor_analysis: JSON


# Input Types

@strawberry.input
class JobSearchInput:
    """Job search input parameters."""
    query: Optional[str] = None
    location: Optional[str] = None
    remote_type: Optional[str] = None
    job_levels: Optional[List[str]] = None
    job_types: Optional[List[str]] = None
    industries: Optional[List[str]] = None
    salary_min: Optional[float] = None
    skills: Optional[List[str]] = None
    posted_after: Optional[datetime] = None
    include_hidden_market: bool = False
    include_executive_only: bool = False
    sort_by: str = "relevance"
    page: int = 1
    per_page: int = 20


@strawberry.input
class CompanySearchInput:
    """Company search input parameters."""
    name: Optional[str] = None
    industry: Optional[str] = None
    min_culture_score: Optional[float] = None
    location: Optional[str] = None
    page: int = 1
    per_page: int = 20


@strawberry.input
class EventSearchInput:
    """Event search input parameters."""
    location: Optional[str] = None
    industries: Optional[List[str]] = None
    event_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_virtual: Optional[bool] = None
    page: int = 1
    per_page: int = 20


# Queries

@strawberry.type
class Query:
    """Root query type."""
    
    @strawberry.field
    async def search_jobs(
        self,
        info: Info,
        input: JobSearchInput
    ) -> JobSearchResult:
        """Search for jobs with advanced filters."""
        db: Database = info.context["db"]
        cache: CacheManager = info.context["cache"]
        
        # Check cache first
        cache_key = f"job_search:{hash(str(input))}"
        cached = await cache.get(cache_key)
        if cached:
            return JobSearchResult(**cached)
        
        # Perform search
        results = await db.search_jobs(input)
        
        # Cache results
        await cache.set(cache_key, results, expire=300)
        
        return JobSearchResult(**results)
    
    @strawberry.field
    async def get_job(self, info: Info, id: str) -> Optional[JobListing]:
        """Get job by ID."""
        db: Database = info.context["db"]
        job = await db.get_job_by_id(id)
        return JobListing(**job) if job else None
    
    @strawberry.field
    async def search_companies(
        self,
        info: Info,
        input: CompanySearchInput
    ) -> List[Company]:
        """Search for companies."""
        db: Database = info.context["db"]
        companies = await db.search_companies(input)
        return [Company(**c) for c in companies]
    
    @strawberry.field
    async def get_company(self, info: Info, id: str) -> Optional[Company]:
        """Get company by ID."""
        db: Database = info.context["db"]
        company = await db.get_company_by_id(id)
        return Company(**company) if company else None
    
    @strawberry.field
    async def networking_events(
        self,
        info: Info,
        input: EventSearchInput
    ) -> List[NetworkingEvent]:
        """Get networking events (Executive tier)."""
        # Check user tier
        user_tier = info.context.get("user_tier", "basic")
        if user_tier not in ["executive", "enterprise"]:
            raise Exception("This feature requires Executive tier or above")
        
        db: Database = info.context["db"]
        events = await db.search_networking_events(input)
        return [NetworkingEvent(**e) for e in events]
    
    @strawberry.field
    async def salary_benchmark(
        self,
        info: Info,
        job_title: str,
        location: str,
        experience_years: Optional[int] = None
    ) -> SalaryBenchmark:
        """Get salary benchmark (Professional tier+)."""
        user_tier = info.context.get("user_tier", "basic")
        if user_tier == "basic":
            raise Exception("This feature requires Professional tier or above")
        
        analytics = AnalyticsProcessor()
        benchmark = await analytics.get_salary_benchmark(
            job_title, location, experience_years
        )
        return SalaryBenchmark(**benchmark)
    
    @strawberry.field
    async def market_intelligence(
        self,
        info: Info,
        report_type: str,
        industry: Optional[str] = None,
        location: Optional[str] = None
    ) -> MarketIntelligence:
        """Get market intelligence (Enterprise tier)."""
        user_tier = info.context.get("user_tier", "basic")
        if user_tier != "enterprise":
            raise Exception("This feature requires Enterprise tier")
        
        db: Database = info.context["db"]
        report = await db.get_market_intelligence(
            report_type, industry, location
        )
        return MarketIntelligence(**report)
    
    @strawberry.field
    async def career_trajectory(
        self,
        info: Info,
        current_position: str,
        target_position: Optional[str] = None
    ) -> CareerTrajectory:
        """Analyze career trajectory (Enterprise tier)."""
        user_tier = info.context.get("user_tier", "basic")
        if user_tier != "enterprise":
            raise Exception("This feature requires Enterprise tier")
        
        analytics = AnalyticsProcessor()
        trajectory = await analytics.analyze_career_trajectory(
            current_position, target_position
        )
        return CareerTrajectory(**trajectory)
    
    @strawberry.field
    async def personal_brand_audit(
        self,
        info: Info,
        linkedin_url: str,
        other_profiles: Optional[List[str]] = None
    ) -> PersonalBrandAudit:
        """Audit personal brand (Enterprise tier)."""
        user_tier = info.context.get("user_tier", "basic")
        if user_tier != "enterprise":
            raise Exception("This feature requires Enterprise tier")
        
        analytics = AnalyticsProcessor()
        audit = await analytics.audit_personal_brand(
            linkedin_url, other_profiles
        )
        return PersonalBrandAudit(**audit)
    
    @strawberry.field
    async def recommended_jobs(
        self,
        info: Info,
        user_profile: JSON,
        limit: int = 10
    ) -> List[JobListing]:
        """Get AI-powered job recommendations."""
        matcher = JobMatcher()
        recommendations = await matcher.get_recommendations(
            user_profile, limit
        )
        return [JobListing(**job) for job in recommendations]


# Mutations

@strawberry.type
class Mutation:
    """Root mutation type."""
    
    @strawberry.mutation
    async def track_job_view(
        self,
        info: Info,
        job_id: str
    ) -> bool:
        """Track job view."""
        db: Database = info.context["db"]
        await db.increment_job_views(job_id)
        return True
    
    @strawberry.mutation
    async def save_job(
        self,
        info: Info,
        job_id: str,
        notes: Optional[str] = None
    ) -> bool:
        """Save job to user's list."""
        user_id = info.context.get("user_id")
        if not user_id:
            raise Exception("Authentication required")
        
        db: Database = info.context["db"]
        await db.save_job_for_user(user_id, job_id, notes)
        return True
    
    @strawberry.mutation
    async def apply_to_job(
        self,
        info: Info,
        job_id: str,
        cover_letter: Optional[str] = None
    ) -> bool:
        """Apply to job."""
        user_id = info.context.get("user_id")
        if not user_id:
            raise Exception("Authentication required")
        
        db: Database = info.context["db"]
        await db.create_job_application(user_id, job_id, cover_letter)
        
        # Send real-time update
        ws_manager = info.context["ws_manager"]
        await ws_manager.broadcast_application_update(user_id, job_id)
        
        return True
    
    @strawberry.mutation
    async def start_job_scraping(
        self,
        info: Info,
        sources: List[str],
        filters: Optional[JSON] = None
    ) -> str:
        """Start job scraping task."""
        kafka = info.context["kafka"]
        task_id = await kafka.send_message(
            topic="scraping-tasks",
            message={
                "action": "start",
                "sources": sources,
                "filters": filters or {}
            }
        )
        return task_id
    
    @strawberry.mutation
    async def subscribe_to_alerts(
        self,
        info: Info,
        search_criteria: JobSearchInput,
        frequency: str = "daily"
    ) -> bool:
        """Subscribe to job alerts."""
        user_id = info.context.get("user_id")
        if not user_id:
            raise Exception("Authentication required")
        
        db: Database = info.context["db"]
        await db.create_job_alert(user_id, search_criteria, frequency)
        return True


# Subscriptions

@strawberry.type
class Subscription:
    """Root subscription type for real-time updates."""
    
    @strawberry.subscription
    async def job_updates(
        self,
        info: Info,
        filters: Optional[JobSearchInput] = None
    ) -> JobListing:
        """Subscribe to real-time job updates."""
        ws_manager = info.context["ws_manager"]
        async for job in ws_manager.job_update_stream(filters):
            yield JobListing(**job)
    
    @strawberry.subscription
    async def application_status(
        self,
        info: Info,
        application_id: str
    ) -> JSON:
        """Subscribe to application status updates."""
        ws_manager = info.context["ws_manager"]
        async for update in ws_manager.application_status_stream(application_id):
            yield update


# Create schema
schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    subscription=Subscription
)
