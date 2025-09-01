"""
Kafka consumer for real-time job data processing.
Handles streaming data with change detection and analytics.
"""

import asyncio
import json
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
import hashlib

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from aiokafka.errors import KafkaError
from loguru import logger
import numpy as np

from src.config.settings import settings
from src.utils.database import Database
from src.utils.cache import CacheManager
from src.processors.job_enricher import JobEnricher
from src.processors.sentiment_analyzer import SentimentAnalyzer
from src.processors.market_predictor import MarketPredictor
from src.api.websocket import ConnectionManager


class JobDataProcessor:
    """Process streaming job data with analytics."""
    
    def __init__(self):
        self.db = Database()
        self.cache = CacheManager()
        self.enricher = JobEnricher()
        self.sentiment_analyzer = SentimentAnalyzer()
        self.market_predictor = MarketPredictor()
        self.ws_manager = ConnectionManager()
        
        # Kafka setup
        self.consumer = None
        self.producer = None
        
        # Processing state
        self.processed_jobs = set()
        self.job_changes = {}
        self.processing_stats = {
            "total_processed": 0,
            "changes_detected": 0,
            "enrichments_completed": 0,
            "predictions_made": 0,
            "errors": 0
        }
    
    async def start(self):
        """Start the consumer and processing pipeline."""
        await self.db.connect()
        await self.cache.connect()
        
        # Initialize Kafka consumer
        self.consumer = AIOKafkaConsumer(
            settings.kafka_topic_jobs,
            "feature-extraction",
            "scraping-results",
            bootstrap_servers=settings.kafka_servers_list,
            group_id=settings.kafka_consumer_group,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            enable_auto_commit=False,
            auto_offset_reset='earliest'
        )
        
        # Initialize Kafka producer for downstream events
        self.producer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_servers_list,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        
        await self.consumer.start()
        await self.producer.start()
        
        logger.info("Kafka consumer started, processing job data stream...")
        
        try:
            await self.consume_messages()
        finally:
            await self.stop()
    
    async def stop(self):
        """Stop the consumer and cleanup."""
        if self.consumer:
            await self.consumer.stop()
        if self.producer:
            await self.producer.stop()
        await self.db.disconnect()
        await self.cache.disconnect()
        
        logger.info(f"Consumer stopped. Stats: {self.processing_stats}")
    
    async def consume_messages(self):
        """Main message consumption loop."""
        async for msg in self.consumer:
            try:
                # Process based on topic
                if msg.topic == settings.kafka_topic_jobs:
                    await self.process_job_update(msg.value)
                elif msg.topic == "feature-extraction":
                    await self.process_feature_extraction(msg.value)
                elif msg.topic == "scraping-results":
                    await self.process_scraping_result(msg.value)
                
                # Commit offset after successful processing
                await self.consumer.commit()
                
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                self.processing_stats["errors"] += 1
                # Don't commit on error - message will be reprocessed
    
    async def process_job_update(self, job_data: Dict[str, Any]):
        """Process job update with change detection."""
        job_id = job_data.get('id')
        
        # Check for duplicates
        if job_id in self.processed_jobs:
            return
        
        self.processed_jobs.add(job_id)
        self.processing_stats["total_processed"] += 1
        
        # Detect changes
        changes = await self.detect_changes(job_id, job_data)
        if changes:
            self.processing_stats["changes_detected"] += 1
            await self.handle_job_changes(job_id, changes)
        
        # Enrich job data
        enriched_data = await self.enrich_job_data(job_data)
        
        # Perform sentiment analysis on description and reviews
        sentiment_data = await self.analyze_sentiment(enriched_data)
        enriched_data['sentiment'] = sentiment_data
        
        # Generate market predictions
        predictions = await self.generate_predictions(enriched_data)
        enriched_data['predictions'] = predictions
        
        # Store in database
        await self.db.upsert_job(enriched_data)
        
        # Cache for quick access
        await self.cache.set(
            f"job:{job_id}",
            enriched_data,
            expire=3600
        )
        
        # Send real-time updates
        await self.send_realtime_updates(enriched_data)
        
        # Publish enriched data for downstream processing
        await self.producer.send(
            "enriched-jobs",
            value=enriched_data
        )
    
    async def detect_changes(self, job_id: str, new_data: Dict[str, Any]) -> Dict[str, Any]:
        """Detect changes in job data."""
        # Get previous version from database
        old_data = await self.db.get_job_by_id(job_id)
        if not old_data:
            return {}
        
        changes = {}
        
        # Track important field changes
        tracked_fields = [
            'salary_min', 'salary_max', 'requirements',
            'description', 'is_active', 'application_count'
        ]
        
        for field in tracked_fields:
            if old_data.get(field) != new_data.get(field):
                changes[field] = {
                    'old': old_data.get(field),
                    'new': new_data.get(field),
                    'changed_at': datetime.utcnow().isoformat()
                }
        
        # Special handling for salary changes
        if 'salary_min' in changes or 'salary_max' in changes:
            old_avg = (old_data.get('salary_min', 0) + old_data.get('salary_max', 0)) / 2
            new_avg = (new_data.get('salary_min', 0) + new_data.get('salary_max', 0)) / 2
            if old_avg > 0:
                changes['salary_change_percent'] = ((new_avg - old_avg) / old_avg) * 100
        
        return changes
    
    async def handle_job_changes(self, job_id: str, changes: Dict[str, Any]):
        """Handle detected changes in job data."""
        # Store change history
        await self.db.store_job_change_history(job_id, changes)
        
        # Send notifications for significant changes
        if 'salary_min' in changes or 'salary_max' in changes:
            # Notify users watching this job
            await self.notify_salary_change(job_id, changes)
        
        if 'is_active' in changes and not changes['is_active']['new']:
            # Job closed - notify applicants
            await self.notify_job_closed(job_id)
        
        # Update analytics
        await self.producer.send(
            settings.kafka_topic_analytics,
            value={
                'event': 'job_changed',
                'job_id': job_id,
                'changes': changes,
                'timestamp': datetime.utcnow().isoformat()
            }
        )
    
    async def enrich_job_data(self, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Enrich job data with additional information."""
        enriched = job_data.copy()
        
        # Add vector embeddings for semantic search
        if 'description' in enriched:
            embeddings = await self.enricher.generate_embeddings(enriched['description'])
            enriched['embedding'] = embeddings.tolist()
        
        # Extract additional features
        enriched['extracted_skills'] = await self.enricher.extract_skills(enriched)
        enriched['experience_required'] = await self.enricher.extract_experience(enriched)
        enriched['education_required'] = await self.enricher.extract_education(enriched)
        
        # Calculate competition level
        enriched['competition_level'] = await self.calculate_competition_level(enriched)
        
        # Add market context
        enriched['market_context'] = await self.get_market_context(enriched)
        
        self.processing_stats["enrichments_completed"] += 1
        
        return enriched
    
    async def analyze_sentiment(self, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze sentiment in job description and company reviews."""
        sentiment_data = {}
        
        # Analyze job description sentiment
        if 'description' in job_data:
            desc_sentiment = await self.sentiment_analyzer.analyze_text(
                job_data['description']
            )
            sentiment_data['description_sentiment'] = desc_sentiment
        
        # Analyze company culture if available
        if 'company' in job_data and 'employee_reviews' in job_data['company']:
            reviews = job_data['company']['employee_reviews']
            if reviews:
                review_sentiments = []
                for review in reviews[:10]:  # Analyze top 10 reviews
                    sentiment = await self.sentiment_analyzer.analyze_text(
                        review.get('text', '')
                    )
                    review_sentiments.append(sentiment)
                
                # Aggregate sentiment scores
                sentiment_data['company_sentiment'] = {
                    'average': np.mean([s['score'] for s in review_sentiments]),
                    'positive_ratio': sum(1 for s in review_sentiments if s['label'] == 'positive') / len(review_sentiments)
                }
        
        return sentiment_data
    
    async def generate_predictions(self, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate market predictions for the job."""
        predictions = {}
        
        # Predict salary trends
        if job_data.get('salary_min') and job_data.get('salary_max'):
            salary_prediction = await self.market_predictor.predict_salary_trend(
                job_title=job_data['title'],
                location=job_data['location'],
                current_salary=(job_data['salary_min'] + job_data['salary_max']) / 2
            )
            predictions['salary_trend'] = salary_prediction
        
        # Predict demand
        demand_prediction = await self.market_predictor.predict_job_demand(
            job_title=job_data['title'],
            skills=job_data.get('extracted_skills', []),
            location=job_data['location']
        )
        predictions['demand_forecast'] = demand_prediction
        
        # Predict time to fill
        fill_time = await self.market_predictor.predict_time_to_fill(job_data)
        predictions['estimated_days_to_fill'] = fill_time
        
        self.processing_stats["predictions_made"] += 1
        
        return predictions
    
    async def calculate_competition_level(self, job_data: Dict[str, Any]) -> float:
        """Calculate competition level for the job."""
        factors = []
        
        # Application count factor
        if 'application_count' in job_data:
            app_count = job_data['application_count']
            factors.append(min(app_count / 100, 1.0))  # Normalize to 0-1
        
        # Salary competitiveness
        if job_data.get('market_context', {}).get('salary_percentile'):
            percentile = job_data['market_context']['salary_percentile']
            factors.append((100 - percentile) / 100)  # Higher percentile = less competition
        
        # Skills rarity
        rare_skills = await self.enricher.identify_rare_skills(
            job_data.get('extracted_skills', [])
        )
        if rare_skills:
            factors.append(len(rare_skills) / max(len(job_data.get('extracted_skills', [])), 1))
        
        # Calculate weighted average
        if factors:
            return sum(factors) / len(factors)
        return 0.5  # Default medium competition
    
    async def get_market_context(self, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Get market context for the job."""
        context = {}
        
        # Get salary benchmarks
        if job_data.get('salary_min') and job_data.get('salary_max'):
            avg_salary = (job_data['salary_min'] + job_data['salary_max']) / 2
            benchmarks = await self.db.get_salary_benchmarks(
                job_title=job_data['title'],
                location=job_data['location']
            )
            
            if benchmarks:
                context['salary_percentile'] = self.calculate_percentile(
                    avg_salary, benchmarks
                )
                context['market_average'] = np.mean(benchmarks)
        
        # Get similar jobs count
        similar_count = await self.db.count_similar_jobs(
            title=job_data['title'],
            location=job_data['location'],
            posted_after=datetime.utcnow() - timedelta(days=30)
        )
        context['similar_jobs_count'] = similar_count
        
        # Industry trends
        if 'industry' in job_data:
            trends = await self.db.get_industry_trends(job_data['industry'])
            context['industry_growth'] = trends.get('growth_rate')
            context['industry_hiring_trend'] = trends.get('hiring_trend')
        
        return context
    
    async def send_realtime_updates(self, job_data: Dict[str, Any]):
        """Send real-time updates via WebSocket."""
        # Check which users should receive this update
        matching_filters = await self.cache.get("ws_subscriptions") or {}
        
        for client_id, filters in matching_filters.items():
            if self.matches_filters(job_data, filters):
                await self.ws_manager.send_job_update(client_id, job_data)
    
    async def process_feature_extraction(self, task: Dict[str, Any]):
        """Process feature extraction tasks."""
        job_url = task.get('job_url')
        features = task.get('features', {})
        
        # Fetch and parse the job
        job_data = await self.enricher.extract_from_url(job_url)
        
        if features.get('company_culture'):
            culture_data = await self.enricher.extract_company_culture(job_data)
            job_data['company_culture'] = culture_data
        
        if features.get('leadership'):
            leadership_data = await self.enricher.extract_leadership_info(job_data)
            job_data['leadership'] = leadership_data
        
        if features.get('salary_insights'):
            salary_insights = await self.enricher.extract_salary_insights(job_data)
            job_data['salary_insights'] = salary_insights
        
        # Process the enriched job
        await self.process_job_update(job_data)
    
    async def process_scraping_result(self, result: Dict[str, Any]):
        """Process scraping results."""
        if result.get('type') == 'job':
            await self.process_job_update(result['data'])
        elif result.get('type') == 'company':
            await self.process_company_update(result['data'])
        elif result.get('type') == 'networking_event':
            await self.process_event_update(result['data'])
    
    async def process_company_update(self, company_data: Dict[str, Any]):
        """Process company data updates."""
        # Store in database
        await self.db.upsert_company(company_data)
        
        # Update related jobs
        await self.update_jobs_with_company_data(company_data)
    
    async def process_event_update(self, event_data: Dict[str, Any]):
        """Process networking event updates."""
        # Store in database
        await self.db.upsert_networking_event(event_data)
        
        # Send notifications to executive tier users
        await self.notify_executive_users(event_data)
    
    def matches_filters(self, job_data: Dict[str, Any], filters: Dict[str, Any]) -> bool:
        """Check if job matches user filters."""
        if filters.get('location') and job_data.get('location') != filters['location']:
            return False
        
        if filters.get('job_level') and job_data.get('job_level') != filters['job_level']:
            return False
        
        if filters.get('min_salary') and job_data.get('salary_min', 0) < filters['min_salary']:
            return False
        
        if filters.get('keywords'):
            job_text = f"{job_data.get('title', '')} {job_data.get('description', '')}".lower()
            if not any(keyword.lower() in job_text for keyword in filters['keywords']):
                return False
        
        return True
    
    def calculate_percentile(self, value: float, data: List[float]) -> float:
        """Calculate percentile of value in data."""
        if not data:
            return 50.0
        
        sorted_data = sorted(data)
        position = sum(1 for x in sorted_data if x <= value)
        return (position / len(sorted_data)) * 100
    
    async def notify_salary_change(self, job_id: str, changes: Dict[str, Any]):
        """Notify users about salary changes."""
        # Get users watching this job
        watchers = await self.db.get_job_watchers(job_id)
        
        for user_id in watchers:
            await self.producer.send(
                "notifications",
                value={
                    'user_id': user_id,
                    'type': 'salary_change',
                    'job_id': job_id,
                    'changes': changes,
                    'timestamp': datetime.utcnow().isoformat()
                }
            )
    
    async def notify_job_closed(self, job_id: str):
        """Notify users when job is closed."""
        # Get applicants
        applicants = await self.db.get_job_applicants(job_id)
        
        for user_id in applicants:
            await self.producer.send(
                "notifications",
                value={
                    'user_id': user_id,
                    'type': 'job_closed',
                    'job_id': job_id,
                    'timestamp': datetime.utcnow().isoformat()
                }
            )
    
    async def notify_executive_users(self, event_data: Dict[str, Any]):
        """Notify executive tier users about events."""
        # Get executive users interested in this type of event
        users = await self.db.get_executive_users_by_interests(
            industries=event_data.get('industries', []),
            location=event_data.get('location')
        )
        
        for user_id in users:
            await self.producer.send(
                "notifications",
                value={
                    'user_id': user_id,
                    'type': 'networking_event',
                    'event': event_data,
                    'timestamp': datetime.utcnow().isoformat()
                }
            )


# Run consumer
if __name__ == "__main__":
    processor = JobDataProcessor()
    asyncio.run(processor.start())
