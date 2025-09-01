"""
Advanced database manager with PostgreSQL, pgvector, and connection pooling.
"""

import asyncio
import asyncpg
from typing import List, Dict, Any, Optional, Tuple, Union
from datetime import datetime, timedelta
import numpy as np
import json
from contextlib import asynccontextmanager
from dataclasses import asdict

from src.config.settings import settings
from src.config.sentry import capture_api_error, add_scraping_breadcrumb
from src.models.job_models import Job, JobFilter


class Database:
    """Advanced database manager with connection pooling and vector operations."""
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self._initialized = False
    
    async def connect(self):
        """Initialize database connection pool."""
        if self._initialized:
            return
        
        try:
            # Parse database URL
            db_config = self._parse_database_url(settings.database_url)
            
            # Create connection pool
            self.pool = await asyncpg.create_pool(
                host=db_config["host"],
                port=db_config["port"],
                user=db_config["user"],
                password=db_config["password"],
                database=db_config["database"],
                min_size=5,
                max_size=settings.database_pool_size,
                max_queries=50000,
                max_inactive_connection_lifetime=300.0,
                setup=self._setup_connection
            )
            
            # Initialize database schema
            await self._initialize_schema()
            
            self._initialized = True
            add_scraping_breadcrumb("Database connection pool initialized")
            
        except Exception as e:
            capture_api_error(e, endpoint="database_connect", method="INTERNAL")
            raise
    
    async def disconnect(self):
        """Close database connection pool."""
        if self.pool:
            await self.pool.close()
            self._initialized = False
            add_scraping_breadcrumb("Database connection pool closed")
    
    def _parse_database_url(self, url: str) -> Dict[str, Any]:
        """Parse PostgreSQL connection URL."""
        # Simple URL parsing - in production use urllib.parse
        # postgresql://user:password@host:port/database
        url = url.replace("postgresql://", "")
        
        if "@" in url:
            auth_part, host_part = url.split("@", 1)
            if ":" in auth_part:
                user, password = auth_part.split(":", 1)
            else:
                user, password = auth_part, ""
        else:
            user, password = "postgres", ""
            host_part = url
        
        if "/" in host_part:
            host_port, database = host_part.split("/", 1)
        else:
            host_port, database = host_part, "postgres"
        
        if ":" in host_port:
            host, port = host_port.split(":", 1)
            port = int(port)
        else:
            host, port = host_port, 5432
        
        return {
            "host": host,
            "port": port,
            "user": user,
            "password": password,
            "database": database
        }
    
    async def _setup_connection(self, conn):
        """Setup individual connection with extensions."""
        # Enable pgvector extension
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        
        # Set search path
        await conn.execute("SET search_path TO public")
    
    async def _initialize_schema(self):
        """Initialize database schema and tables."""
        async with self.pool.acquire() as conn:
            # Create jobs table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    title TEXT NOT NULL,
                    company TEXT NOT NULL,
                    company_id UUID,
                    location TEXT,
                    description TEXT,
                    url TEXT UNIQUE,
                    salary_min NUMERIC,
                    salary_max NUMERIC,
                    job_type TEXT DEFAULT 'full_time',
                    experience_level TEXT DEFAULT 'mid_level',
                    skills_required TEXT[],
                    remote_friendly BOOLEAN DEFAULT false,
                    is_active BOOLEAN DEFAULT true,
                    embedding VECTOR(768),
                    posted_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    scraped_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    source TEXT,
                    raw_data JSONB,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create companies table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS companies (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name TEXT UNIQUE NOT NULL,
                    website TEXT,
                    industry TEXT,
                    size_range TEXT,
                    headquarters TEXT,
                    founded_year INTEGER,
                    description TEXT,
                    culture_score NUMERIC,
                    benefits_score NUMERIC,
                    career_growth_score NUMERIC,
                    work_life_balance_score NUMERIC,
                    diversity_score NUMERIC,
                    logo_url TEXT,
                    social_media JSONB,
                    financial_info JSONB,
                    leadership_info JSONB,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create search analytics table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS search_analytics (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    query TEXT NOT NULL,
                    user_id TEXT,
                    search_type TEXT,
                    results_count INTEGER,
                    filters JSONB,
                    location TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create indexes
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company)")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location)")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_jobs_posted_date ON jobs(posted_date)")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_jobs_active ON jobs(is_active)")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_jobs_embedding ON jobs USING ivfflat (embedding vector_cosine_ops)")
            
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name)")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry)")
            
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_search_query ON search_analytics(query)")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_search_created_at ON search_analytics(created_at)")
    
    @asynccontextmanager
    async def acquire_connection(self):
        """Acquire database connection from pool."""
        if not self._initialized:
            await self.connect()
        
        async with self.pool.acquire() as conn:
            yield conn
    
    async def execute(self, query: str, *args) -> str:
        """Execute a query and return status."""
        async with self.acquire_connection() as conn:
            return await conn.execute(query, *args)
    
    async def fetch(self, query: str, *args) -> List[Dict[str, Any]]:
        """Fetch multiple rows as dictionaries."""
        async with self.acquire_connection() as conn:
            rows = await conn.fetch(query, *args)
            return [dict(row) for row in rows]
    
    async def fetchrow(self, query: str, *args) -> Optional[Dict[str, Any]]:
        """Fetch single row as dictionary."""
        async with self.acquire_connection() as conn:
            row = await conn.fetchrow(query, *args)
            return dict(row) if row else None
    
    async def fetchval(self, query: str, *args) -> Any:
        """Fetch single value."""
        async with self.acquire_connection() as conn:
            return await conn.fetchval(query, *args)
    
    # Job-specific methods
    async def create_job(self, job_data: Dict[str, Any]) -> Job:
        """Create a new job posting."""
        query = """
            INSERT INTO jobs (
                title, company, location, description, url,
                salary_min, salary_max, job_type, experience_level,
                skills_required, remote_friendly, source, raw_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        """
        
        async with self.acquire_connection() as conn:
            row = await conn.fetchrow(
                query,
                job_data.get("title"),
                job_data.get("company"),
                job_data.get("location"),
                job_data.get("description"),
                job_data.get("url"),
                job_data.get("salary_min"),
                job_data.get("salary_max"),
                job_data.get("job_type", "full_time"),
                job_data.get("experience_level", "mid_level"),
                job_data.get("skills_required", []),
                job_data.get("remote_friendly", False),
                job_data.get("source"),
                json.dumps(job_data.get("raw_data", {}))
            )
            
            return Job(**dict(row))
    
    async def get_job_by_id(self, job_id: str) -> Optional[Job]:
        """Get job by ID."""
        query = "SELECT * FROM jobs WHERE id = $1"
        row = await self.fetchrow(query, job_id)
        return Job(**row) if row else None
    
    async def update_job(self, job_id: str, updates: Dict[str, Any]) -> Job:
        """Update job information."""
        # Build dynamic update query
        set_clauses = []
        values = []
        param_count = 1
        
        for key, value in updates.items():
            if key not in ["id", "created_at"]:  # Skip immutable fields
                set_clauses.append(f"{key} = ${param_count}")
                values.append(value)
                param_count += 1
        
        set_clauses.append(f"updated_date = ${param_count}")
        values.append(datetime.utcnow())
        values.append(job_id)  # For WHERE clause
        
        query = f"""
            UPDATE jobs 
            SET {', '.join(set_clauses)}
            WHERE id = ${param_count + 1}
            RETURNING *
        """
        
        row = await self.fetchrow(query, *values)
        return Job(**row) if row else None
    
    async def delete_job(self, job_id: str) -> bool:
        """Delete job posting."""
        query = "DELETE FROM jobs WHERE id = $1"
        result = await self.execute(query, job_id)
        return "DELETE 1" in result
    
    async def search_jobs(
        self,
        filters: JobFilter,
        limit: int = 50,
        offset: int = 0,
        sort_by: str = "relevance"
    ) -> Tuple[List[Job], int]:
        """Search jobs with advanced filtering."""
        where_conditions = ["is_active = true"]
        params = []
        param_count = 1
        
        # Text search
        if filters.query:
            where_conditions.append(f"""
                (title ILIKE ${param_count} OR description ILIKE ${param_count} OR company ILIKE ${param_count})
            """)
            params.append(f"%{filters.query}%")
            param_count += 1
        
        # Location filter
        if filters.location:
            where_conditions.append(f"location ILIKE ${param_count}")
            params.append(f"%{filters.location}%")
            param_count += 1
        
        # Company filter
        if filters.company:
            where_conditions.append(f"company ILIKE ${param_count}")
            params.append(f"%{filters.company}%")
            param_count += 1
        
        # Job type filter
        if filters.job_type:
            where_conditions.append(f"job_type = ${param_count}")
            params.append(filters.job_type)
            param_count += 1
        
        # Experience level filter
        if filters.experience_level:
            where_conditions.append(f"experience_level = ${param_count}")
            params.append(filters.experience_level)
            param_count += 1
        
        # Salary range filter
        if filters.salary_range and filters.salary_range[0]:
            where_conditions.append(f"salary_min >= ${param_count}")
            params.append(filters.salary_range[0])
            param_count += 1
        
        if filters.salary_range and filters.salary_range[1]:
            where_conditions.append(f"salary_max <= ${param_count}")
            params.append(filters.salary_range[1])
            param_count += 1
        
        # Remote work filter
        if filters.remote_only:
            where_conditions.append("remote_friendly = true")
        
        # Skills filter
        if filters.skills:
            where_conditions.append(f"skills_required && ${param_count}")
            params.append(filters.skills)
            param_count += 1
        
        # Date filter
        if filters.posted_since:
            where_conditions.append(f"posted_date >= ${param_count}")
            params.append(filters.posted_since)
            param_count += 1
        
        # Build ORDER BY clause
        order_clauses = {
            "relevance": "posted_date DESC, salary_max DESC NULLS LAST",
            "date": "posted_date DESC",
            "salary": "salary_max DESC NULLS LAST"
        }
        order_by = order_clauses.get(sort_by, order_clauses["relevance"])
        
        # Count query
        count_query = f"""
            SELECT COUNT(*) FROM jobs 
            WHERE {' AND '.join(where_conditions)}
        """
        
        total_count = await self.fetchval(count_query, *params)
        
        # Main query
        main_query = f"""
            SELECT * FROM jobs 
            WHERE {' AND '.join(where_conditions)}
            ORDER BY {order_by}
            LIMIT ${param_count} OFFSET ${param_count + 1}
        """
        
        params.extend([limit, offset])
        rows = await self.fetch(main_query, *params)
        
        jobs = [Job(**row) for row in rows]
        return jobs, total_count
    
    async def find_similar_jobs(
        self,
        job_embedding: List[float],
        limit: int = 10,
        exclude_job_id: str = None
    ) -> List[Job]:
        """Find similar jobs using vector similarity."""
        where_clause = "is_active = true AND embedding IS NOT NULL"
        params = [job_embedding, limit]
        
        if exclude_job_id:
            where_clause += " AND id != $3"
            params.append(exclude_job_id)
        
        query = f"""
            SELECT *, 1 - (embedding <=> $1) as similarity
            FROM jobs 
            WHERE {where_clause}
            ORDER BY embedding <=> $1
            LIMIT $2
        """
        
        rows = await self.fetch(query, *params)
        return [Job(**{k: v for k, v in row.items() if k != "similarity"}) for row in rows]
    
    async def get_trending_skills(
        self,
        since: datetime,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get trending skills from recent job postings."""
        query = """
            SELECT skill, COUNT(*) as frequency
            FROM (
                SELECT unnest(skills_required) as skill
                FROM jobs 
                WHERE posted_date >= $1 AND is_active = true
            ) skills
            GROUP BY skill
            ORDER BY frequency DESC
            LIMIT $2
        """
        
        rows = await self.fetch(query, since, limit)
        return [{"skill": row["skill"], "frequency": row["frequency"]} for row in rows]
    
    async def get_salary_insights(
        self,
        title: Optional[str] = None,
        location: Optional[str] = None,
        experience_level: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get salary insights and benchmarking data."""
        where_conditions = ["is_active = true", "salary_min IS NOT NULL", "salary_max IS NOT NULL"]
        params = []
        param_count = 1
        
        if title:
            where_conditions.append(f"title ILIKE ${param_count}")
            params.append(f"%{title}%")
            param_count += 1
        
        if location:
            where_conditions.append(f"location ILIKE ${param_count}")
            params.append(f"%{location}%")
            param_count += 1
        
        if experience_level:
            where_conditions.append(f"experience_level = ${param_count}")
            params.append(experience_level)
            param_count += 1
        
        query = f"""
            SELECT 
                AVG((salary_min + salary_max) / 2) as avg_salary,
                MIN(salary_min) as min_salary,
                MAX(salary_max) as max_salary,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (salary_min + salary_max) / 2) as median_salary,
                PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY (salary_min + salary_max) / 2) as p25_salary,
                PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY (salary_min + salary_max) / 2) as p75_salary,
                COUNT(*) as sample_size
            FROM jobs
            WHERE {' AND '.join(where_conditions)}
        """
        
        result = await self.fetchrow(query, *params)
        return dict(result) if result else {}
    
    # Company-specific methods
    async def search_companies(
        self,
        query: Optional[str] = None,
        industry: Optional[str] = None,
        location: Optional[str] = None,
        size_range: Optional[str] = None,
        min_culture_score: Optional[float] = None,
        has_remote_jobs: Optional[bool] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Search companies with filtering."""
        where_conditions = []
        params = []
        param_count = 1
        
        if query:
            where_conditions.append(f"(name ILIKE ${param_count} OR description ILIKE ${param_count})")
            params.append(f"%{query}%")
            param_count += 1
        
        if industry:
            where_conditions.append(f"industry = ${param_count}")
            params.append(industry)
            param_count += 1
        
        if location:
            where_conditions.append(f"headquarters ILIKE ${param_count}")
            params.append(f"%{location}%")
            param_count += 1
        
        if size_range:
            where_conditions.append(f"size_range = ${param_count}")
            params.append(size_range)
            param_count += 1
        
        if min_culture_score:
            where_conditions.append(f"culture_score >= ${param_count}")
            params.append(min_culture_score)
            param_count += 1
        
        where_clause = f"WHERE {' AND '.join(where_conditions)}" if where_conditions else ""
        
        # Count query
        count_query = f"SELECT COUNT(*) FROM companies {where_clause}"
        total_count = await self.fetchval(count_query, *params)
        
        # Main query
        main_query = f"""
            SELECT * FROM companies {where_clause}
            ORDER BY name
            LIMIT ${param_count} OFFSET ${param_count + 1}
        """
        
        params.extend([limit, offset])
        rows = await self.fetch(main_query, *params)
        
        return rows, total_count
    
    # Analytics methods
    async def log_search(
        self,
        query: str,
        user_id: Optional[str] = None,
        search_type: str = "jobs",
        results_count: int = 0,
        filters: Optional[Dict[str, Any]] = None,
        location: Optional[str] = None
    ):
        """Log search for analytics."""
        insert_query = """
            INSERT INTO search_analytics (
                query, user_id, search_type, results_count, filters, location
            ) VALUES ($1, $2, $3, $4, $5, $6)
        """
        
        await self.execute(
            insert_query,
            query,
            user_id,
            search_type,
            results_count,
            json.dumps(filters) if filters else None,
            location
        )


    async def bulk_insert_jobs(self, jobs: List[Job]) -> int:
        """Bulk insert job records with improved performance."""
        if not jobs:
            return 0
        
        job_records = []
        for job in jobs:
            record = (
                job.title, job.company, job.location, job.description,
                job.url, job.salary_min, job.salary_max, job.job_type,
                job.experience_level, job.skills, job.remote_friendly,
                job.source, json.dumps(asdict(job)) if hasattr(job, '__dict__') else None
            )
            job_records.append(record)
        
        insert_query = """
            INSERT INTO jobs (
                title, company, location, description, url,
                salary_min, salary_max, job_type, experience_level,
                skills_required, remote_friendly, source, raw_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (url) DO UPDATE SET
                updated_date = CURRENT_TIMESTAMP,
                description = EXCLUDED.description,
                salary_min = EXCLUDED.salary_min,
                salary_max = EXCLUDED.salary_max
        """
        
        async with self.acquire_connection() as conn:
            async with conn.transaction():
                await conn.executemany(insert_query, job_records)
        
        add_scraping_breadcrumb(
            f"Bulk inserted {len(jobs)} jobs",
            data={"job_count": len(jobs)}
        )
        
        return len(jobs)
    
    async def update_job_embeddings(self, job_id: str, embedding: List[float]):
        """Update job embedding for similarity search."""
        query = "UPDATE jobs SET embedding = $1 WHERE id = $2"
        await self.execute(query, embedding, job_id)
    
    async def get_database_stats(self) -> Dict[str, Any]:
        """Get comprehensive database statistics."""
        queries = {
            "total_jobs": "SELECT COUNT(*) FROM jobs",
            "active_jobs": "SELECT COUNT(*) FROM jobs WHERE is_active = true",
            "total_companies": "SELECT COUNT(*) FROM companies",
            "jobs_today": "SELECT COUNT(*) FROM jobs WHERE DATE(created_at) = CURRENT_DATE",
            "jobs_this_week": "SELECT COUNT(*) FROM jobs WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'",
            "avg_salary": "SELECT AVG((salary_min + salary_max) / 2) FROM jobs WHERE salary_min IS NOT NULL AND salary_max IS NOT NULL",
            "remote_jobs_percentage": "SELECT (COUNT(CASE WHEN remote_friendly THEN 1 END) * 100.0 / COUNT(*)) FROM jobs WHERE is_active = true"
        }
        
        stats = {}
        for key, query in queries.items():
            try:
                value = await self.fetchval(query)
                stats[key] = value
            except Exception as e:
                capture_api_error(e, endpoint=f"stats_{key}", method="DB")
                stats[key] = 0
        
        return stats
    
    async def cleanup_old_jobs(self, days_old: int = 90) -> int:
        """Clean up old job postings."""
        cutoff_date = datetime.utcnow() - timedelta(days=days_old)
        
        # Soft delete by setting is_active = false
        query = """
            UPDATE jobs 
            SET is_active = false, updated_date = CURRENT_TIMESTAMP
            WHERE posted_date < $1 AND is_active = true
        """
        
        result = await self.execute(query, cutoff_date)
        
        # Extract number from result string like "UPDATE 42"
        import re
        match = re.search(r'UPDATE (\d+)', result)
        updated_count = int(match.group(1)) if match else 0
        
        add_scraping_breadcrumb(
            f"Cleaned up {updated_count} old jobs",
            data={"days_old": days_old, "updated_count": updated_count}
        )
        
        return updated_count
    
    async def get_job_distribution(self) -> Dict[str, Any]:
        """Get job distribution analytics."""
        distribution_queries = {
            "by_location": """
                SELECT location, COUNT(*) as count
                FROM jobs 
                WHERE is_active = true AND location IS NOT NULL
                GROUP BY location
                ORDER BY count DESC
                LIMIT 10
            """,
            "by_company": """
                SELECT company, COUNT(*) as count
                FROM jobs 
                WHERE is_active = true
                GROUP BY company
                ORDER BY count DESC
                LIMIT 10
            """,
            "by_job_type": """
                SELECT job_type, COUNT(*) as count
                FROM jobs 
                WHERE is_active = true
                GROUP BY job_type
                ORDER BY count DESC
            """,
            "by_experience_level": """
                SELECT experience_level, COUNT(*) as count
                FROM jobs 
                WHERE is_active = true
                GROUP BY experience_level
                ORDER BY count DESC
            """
        }
        
        distribution = {}
        for key, query in distribution_queries.items():
            try:
                rows = await self.fetch(query)
                distribution[key] = [dict(row) for row in rows]
            except Exception as e:
                capture_api_error(e, endpoint=f"distribution_{key}", method="DB")
                distribution[key] = []
        
        return distribution


class CacheManager:
    """Redis-based caching layer."""
    
    def __init__(self):
        self.redis_url = settings.redis_url if hasattr(settings, 'redis_url') else "redis://localhost:6379"
        self.redis = None
        self._initialized = False
    
    async def connect(self):
        """Initialize Redis connection."""
        if self._initialized:
            return
        
        try:
            import redis.asyncio as aioredis
            self.redis = aioredis.from_url(self.redis_url, decode_responses=True)
            # Test connection
            await self.redis.ping()
            self._initialized = True
            add_scraping_breadcrumb("Redis cache connected")
        except Exception as e:
            capture_api_error(e, endpoint="cache_connect", method="CACHE")
            # Continue without cache if Redis is not available
            self.redis = None
    
    async def get(self, key: str, default=None):
        """Get value from cache."""
        if not self.redis:
            return default
        
        try:
            value = await self.redis.get(key)
            if value:
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    return value
            return default
        except Exception:
            return default
    
    async def set(self, key: str, value, expire: int = 300):
        """Set value in cache with expiration."""
        if not self.redis:
            return False
        
        try:
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            
            await self.redis.setex(key, expire, value)
            return True
        except Exception:
            return False
    
    async def delete(self, key: str):
        """Delete key from cache."""
        if not self.redis:
            return False
        
        try:
            await self.redis.delete(key)
            return True
        except Exception:
            return False
    
    async def close(self):
        """Close Redis connection."""
        if self.redis:
            await self.redis.aclose()
            self._initialized = False


# Global instances
_database_instance = None
_cache_instance = None


async def get_database() -> Database:
    """Get database instance for dependency injection."""
    global _database_instance
    if _database_instance is None:
        _database_instance = Database()
        await _database_instance.connect()
    return _database_instance


async def get_cache() -> CacheManager:
    """Get cache instance for dependency injection."""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = CacheManager()
        await _cache_instance.connect()
    return _cache_instance
