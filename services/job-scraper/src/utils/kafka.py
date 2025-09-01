"""
Kafka integration for job processing pipeline and event streaming.
"""

import asyncio
import json
import uuid
from typing import Dict, List, Any, Optional, Callable, Union
from datetime import datetime
from dataclasses import dataclass, asdict
import logging

from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from aiokafka.errors import KafkaError
import orjson

from src.config.settings import get_settings
from src.config.sentry import capture_api_error, add_scraping_breadcrumb
from src.models.job_models import Job


@dataclass
class KafkaMessage:
    """Standard Kafka message structure."""
    message_id: str
    timestamp: datetime
    message_type: str
    data: Any
    source: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "message_id": self.message_id,
            "timestamp": self.timestamp.isoformat(),
            "message_type": self.message_type,
            "data": self.data,
            "source": self.source,
            "metadata": self.metadata or {}
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'KafkaMessage':
        return cls(
            message_id=data["message_id"],
            timestamp=datetime.fromisoformat(data["timestamp"]),
            message_type=data["message_type"],
            data=data["data"],
            source=data.get("source"),
            metadata=data.get("metadata", {})
        )


class KafkaProducerManager:
    """Kafka producer for sending messages to various topics."""
    
    def __init__(self):
        self.settings = get_settings()
        self.producer: Optional[AIOKafkaProducer] = None
        self.is_connected = False
        
        # Message statistics
        self.messages_sent = 0
        self.send_errors = 0
        
        add_scraping_breadcrumb("KafkaProducerManager initialized")
    
    async def start(self):
        """Initialize and start Kafka producer."""
        
        if self.is_connected:
            return
        
        try:
            kafka_config = {
                'bootstrap_servers': self.settings.KAFKA_BOOTSTRAP_SERVERS.split(','),
                'security_protocol': self.settings.KAFKA_SECURITY_PROTOCOL,
                'api_version': 'auto',
                'acks': 'all',  # Wait for all replicas
                'retries': 3,
                'max_in_flight_requests_per_connection': 1,
                'enable_idempotence': True,
                'compression_type': 'gzip',
                'batch_size': 16384,
                'linger_ms': 10,
                'buffer_memory': 33554432
            }
            
            # Add SASL configuration if needed
            if hasattr(self.settings, 'KAFKA_SASL_MECHANISM') and self.settings.KAFKA_SASL_MECHANISM:
                kafka_config.update({
                    'sasl_mechanism': self.settings.KAFKA_SASL_MECHANISM,
                    'sasl_plain_username': self.settings.KAFKA_SASL_USERNAME,
                    'sasl_plain_password': self.settings.KAFKA_SASL_PASSWORD
                })
            
            self.producer = AIOKafkaProducer(
                value_serializer=self._serialize_message,
                **kafka_config
            )
            
            await self.producer.start()
            self.is_connected = True
            
            add_scraping_breadcrumb(
                "Kafka producer started successfully",
                data={"bootstrap_servers": kafka_config['bootstrap_servers']}
            )
        
        except Exception as e:
            capture_api_error(e, endpoint="kafka_producer_start", method="KAFKA")
            raise
    
    async def stop(self):
        """Stop Kafka producer."""
        
        if self.producer:
            try:
                await self.producer.stop()
                self.is_connected = False
                add_scraping_breadcrumb("Kafka producer stopped")
            except Exception as e:
                capture_api_error(e, endpoint="kafka_producer_stop", method="KAFKA")
    
    def _serialize_message(self, message: Union[Dict, KafkaMessage]) -> bytes:
        """Serialize message for Kafka."""
        
        if isinstance(message, KafkaMessage):
            message = message.to_dict()
        
        return orjson.dumps(message)
    
    async def send_message(
        self,
        topic: str,
        message: Union[Dict[str, Any], KafkaMessage],
        key: Optional[str] = None,
        partition: Optional[int] = None
    ) -> bool:
        """Send message to Kafka topic."""
        
        if not self.is_connected:
            await self.start()
        
        try:
            # Convert to KafkaMessage if needed
            if isinstance(message, dict):
                kafka_message = KafkaMessage(
                    message_id=str(uuid.uuid4()),
                    timestamp=datetime.utcnow(),
                    message_type=message.get('message_type', 'unknown'),
                    data=message.get('data', message),
                    source=message.get('source'),
                    metadata=message.get('metadata')
                )
            else:
                kafka_message = message
            
            # Send message
            await self.producer.send(
                topic=topic,
                value=kafka_message,
                key=key.encode('utf-8') if key else None,
                partition=partition
            )
            
            self.messages_sent += 1
            
            add_scraping_breadcrumb(
                f"Message sent to Kafka topic: {topic}",
                data={
                    "message_id": kafka_message.message_id,
                    "message_type": kafka_message.message_type,
                    "key": key
                }
            )
            
            return True
        
        except Exception as e:
            self.send_errors += 1
            capture_api_error(
                e,
                endpoint="kafka_send_message",
                method="KAFKA",
                context={"topic": topic, "key": key}
            )
            return False
    
    async def send_job_scraped(self, job: Job, source: str = "scraper") -> bool:
        """Send job scraped event."""
        
        message = KafkaMessage(
            message_id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            message_type="job_scraped",
            data={
                "job_id": job.id,
                "title": job.title,
                "company": job.company,
                "location": job.location,
                "url": job.url,
                "source": job.source,
                "salary_min": job.salary_min,
                "salary_max": job.salary_max,
                "job_type": job.job_type,
                "experience_level": job.experience_level,
                "remote_friendly": job.remote_friendly,
                "posted_date": job.posted_date.isoformat() if job.posted_date else None,
                "skills": job.skills,
                "metadata": job.metadata
            },
            source=source,
            metadata={"scraper_version": "1.0"}
        )
        
        return await self.send_message(
            topic=self.settings.KAFKA_JOBS_TOPIC,
            message=message,
            key=f"job_{job.id}"
        )
    
    async def send_scraping_started(
        self,
        scraper_name: str,
        filters: Dict[str, Any],
        estimated_jobs: Optional[int] = None
    ) -> bool:
        """Send scraping started event."""
        
        message = KafkaMessage(
            message_id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            message_type="scraping_started",
            data={
                "scraper_name": scraper_name,
                "filters": filters,
                "estimated_jobs": estimated_jobs,
                "started_at": datetime.utcnow().isoformat()
            },
            source="scraper_coordinator",
            metadata={"event_version": "1.0"}
        )
        
        return await self.send_message(
            topic=self.settings.KAFKA_EVENTS_TOPIC,
            message=message,
            key=f"scraping_{scraper_name}"
        )
    
    async def send_scraping_completed(
        self,
        scraper_name: str,
        jobs_found: int,
        duration_seconds: float,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> bool:
        """Send scraping completed event."""
        
        message = KafkaMessage(
            message_id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            message_type="scraping_completed",
            data={
                "scraper_name": scraper_name,
                "jobs_found": jobs_found,
                "duration_seconds": duration_seconds,
                "success": success,
                "error_message": error_message,
                "completed_at": datetime.utcnow().isoformat()
            },
            source="scraper_coordinator",
            metadata={"event_version": "1.0"}
        )
        
        return await self.send_message(
            topic=self.settings.KAFKA_EVENTS_TOPIC,
            message=message,
            key=f"scraping_{scraper_name}"
        )
    
    async def send_job_enrichment_request(self, job_id: str, job_data: Dict[str, Any]) -> bool:
        """Send job enrichment request."""
        
        message = KafkaMessage(
            message_id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            message_type="job_enrichment_request",
            data={
                "job_id": job_id,
                "job_data": job_data,
                "requested_at": datetime.utcnow().isoformat()
            },
            source="job_processor",
            metadata={"priority": "normal"}
        )
        
        return await self.send_message(
            topic=self.settings.KAFKA_ENRICHMENT_TOPIC,
            message=message,
            key=f"enrich_{job_id}"
        )
    
    def get_stats(self) -> Dict[str, Any]:
        """Get producer statistics."""
        
        return {
            "is_connected": self.is_connected,
            "messages_sent": self.messages_sent,
            "send_errors": self.send_errors,
            "success_rate": (
                (self.messages_sent / (self.messages_sent + self.send_errors))
                if (self.messages_sent + self.send_errors) > 0 else 0
            )
        }


class KafkaConsumerManager:
    """Kafka consumer for processing messages from various topics."""
    
    def __init__(self):
        self.settings = get_settings()
        self.consumers: Dict[str, AIOKafkaConsumer] = {}
        self.message_handlers: Dict[str, List[Callable]] = {}
        self.is_running = False
        
        # Message statistics
        self.messages_received = 0
        self.messages_processed = 0
        self.processing_errors = 0
        
        add_scraping_breadcrumb("KafkaConsumerManager initialized")
    
    async def start_consumer(
        self,
        topic: str,
        consumer_group: str,
        message_handler: Callable[[KafkaMessage], None]
    ):
        """Start consumer for specific topic."""
        
        try:
            kafka_config = {
                'bootstrap_servers': self.settings.KAFKA_BOOTSTRAP_SERVERS.split(','),
                'group_id': consumer_group,
                'security_protocol': self.settings.KAFKA_SECURITY_PROTOCOL,
                'api_version': 'auto',
                'auto_offset_reset': 'latest',
                'enable_auto_commit': True,
                'auto_commit_interval_ms': 5000,
                'max_poll_records': 100,
                'session_timeout_ms': 30000,
                'heartbeat_interval_ms': 10000
            }
            
            # Add SASL configuration if needed
            if hasattr(self.settings, 'KAFKA_SASL_MECHANISM') and self.settings.KAFKA_SASL_MECHANISM:
                kafka_config.update({
                    'sasl_mechanism': self.settings.KAFKA_SASL_MECHANISM,
                    'sasl_plain_username': self.settings.KAFKA_SASL_USERNAME,
                    'sasl_plain_password': self.settings.KAFKA_SASL_PASSWORD
                })
            
            consumer = AIOKafkaConsumer(
                topic,
                value_deserializer=self._deserialize_message,
                **kafka_config
            )
            
            await consumer.start()
            self.consumers[topic] = consumer
            
            # Register message handler
            if topic not in self.message_handlers:
                self.message_handlers[topic] = []
            self.message_handlers[topic].append(message_handler)
            
            add_scraping_breadcrumb(
                f"Kafka consumer started for topic: {topic}",
                data={"consumer_group": consumer_group}
            )
            
            # Start consuming messages
            asyncio.create_task(self._consume_messages(topic))
        
        except Exception as e:
            capture_api_error(
                e,
                endpoint="kafka_start_consumer",
                method="KAFKA",
                context={"topic": topic, "consumer_group": consumer_group}
            )
            raise
    
    async def stop_all_consumers(self):
        """Stop all consumers."""
        
        self.is_running = False
        
        for topic, consumer in self.consumers.items():
            try:
                await consumer.stop()
                add_scraping_breadcrumb(f"Kafka consumer stopped for topic: {topic}")
            except Exception as e:
                capture_api_error(
                    e,
                    endpoint="kafka_stop_consumer",
                    method="KAFKA",
                    context={"topic": topic}
                )
        
        self.consumers.clear()
        self.message_handlers.clear()
    
    def _deserialize_message(self, message_bytes: bytes) -> KafkaMessage:
        """Deserialize message from Kafka."""
        
        try:
            data = orjson.loads(message_bytes)
            return KafkaMessage.from_dict(data)
        except Exception as e:
            # Fallback to basic dict structure
            return KafkaMessage(
                message_id=str(uuid.uuid4()),
                timestamp=datetime.utcnow(),
                message_type="unknown",
                data={"raw": message_bytes.decode('utf-8', errors='ignore')},
                metadata={"deserialization_error": str(e)}
            )
    
    async def _consume_messages(self, topic: str):
        """Consume messages from topic."""
        
        consumer = self.consumers[topic]
        handlers = self.message_handlers.get(topic, [])
        
        self.is_running = True
        
        try:
            async for message in consumer:
                if not self.is_running:
                    break
                
                self.messages_received += 1
                
                try:
                    kafka_message = message.value
                    
                    # Process message with all registered handlers
                    for handler in handlers:
                        try:
                            if asyncio.iscoroutinefunction(handler):
                                await handler(kafka_message)
                            else:
                                handler(kafka_message)
                            
                            self.messages_processed += 1
                        
                        except Exception as e:
                            self.processing_errors += 1
                            capture_api_error(
                                e,
                                endpoint="kafka_message_handler",
                                method="KAFKA",
                                context={
                                    "topic": topic,
                                    "message_id": kafka_message.message_id,
                                    "message_type": kafka_message.message_type
                                }
                            )
                
                except Exception as e:
                    self.processing_errors += 1
                    capture_api_error(
                        e,
                        endpoint="kafka_consume_message",
                        method="KAFKA",
                        context={"topic": topic}
                    )
        
        except Exception as e:
            capture_api_error(
                e,
                endpoint="kafka_consume_loop",
                method="KAFKA",
                context={"topic": topic}
            )
    
    def get_stats(self) -> Dict[str, Any]:
        """Get consumer statistics."""
        
        return {
            "is_running": self.is_running,
            "active_consumers": len(self.consumers),
            "messages_received": self.messages_received,
            "messages_processed": self.messages_processed,
            "processing_errors": self.processing_errors,
            "success_rate": (
                (self.messages_processed / self.messages_received)
                if self.messages_received > 0 else 0
            )
        }


class JobProcessingPipeline:
    """Job processing pipeline using Kafka for coordination."""
    
    def __init__(self, producer: KafkaProducerManager, consumer: KafkaConsumerManager):
        self.producer = producer
        self.consumer = consumer
        self.settings = get_settings()
        
        # Processing statistics
        self.jobs_processed = 0
        self.jobs_enriched = 0
        self.processing_errors = 0
        
        add_scraping_breadcrumb("JobProcessingPipeline initialized")
    
    async def start_pipeline(self):
        """Start the job processing pipeline."""
        
        # Start consumers for different stages
        await self.consumer.start_consumer(
            topic=self.settings.KAFKA_JOBS_TOPIC,
            consumer_group="job_processor",
            message_handler=self._handle_job_scraped
        )
        
        await self.consumer.start_consumer(
            topic=self.settings.KAFKA_ENRICHMENT_TOPIC,
            consumer_group="job_enricher",
            message_handler=self._handle_enrichment_request
        )
        
        add_scraping_breadcrumb("Job processing pipeline started")
    
    async def stop_pipeline(self):
        """Stop the job processing pipeline."""
        
        await self.consumer.stop_all_consumers()
        await self.producer.stop()
        
        add_scraping_breadcrumb("Job processing pipeline stopped")
    
    async def _handle_job_scraped(self, message: KafkaMessage):
        """Handle job scraped event."""
        
        try:
            if message.message_type != "job_scraped":
                return
            
            job_data = message.data
            job_id = job_data.get("job_id")
            
            add_scraping_breadcrumb(
                f"Processing scraped job: {job_id}",
                data={
                    "title": job_data.get("title"),
                    "company": job_data.get("company"),
                    "source": job_data.get("source")
                }
            )
            
            # Send for enrichment
            await self.producer.send_job_enrichment_request(job_id, job_data)
            
            # Send to WebSocket for real-time updates
            await self._notify_websocket_clients(job_data)
            
            self.jobs_processed += 1
        
        except Exception as e:
            self.processing_errors += 1
            capture_api_error(
                e,
                endpoint="handle_job_scraped",
                method="KAFKA",
                context={"message_id": message.message_id}
            )
    
    async def _handle_enrichment_request(self, message: KafkaMessage):
        """Handle job enrichment request."""
        
        try:
            if message.message_type != "job_enrichment_request":
                return
            
            job_id = message.data.get("job_id")
            job_data = message.data.get("job_data")
            
            add_scraping_breadcrumb(
                f"Enriching job: {job_id}",
                data={"title": job_data.get("title")}
            )
            
            # Perform enrichment (placeholder for actual enrichment logic)
            enriched_data = await self._enrich_job_data(job_data)
            
            # Send enrichment completion event
            await self.producer.send_message(
                topic=self.settings.KAFKA_EVENTS_TOPIC,
                message=KafkaMessage(
                    message_id=str(uuid.uuid4()),
                    timestamp=datetime.utcnow(),
                    message_type="job_enriched",
                    data={
                        "job_id": job_id,
                        "enriched_data": enriched_data,
                        "enriched_at": datetime.utcnow().isoformat()
                    },
                    source="job_enricher"
                ),
                key=f"enriched_{job_id}"
            )
            
            self.jobs_enriched += 1
        
        except Exception as e:
            self.processing_errors += 1
            capture_api_error(
                e,
                endpoint="handle_enrichment_request",
                method="KAFKA",
                context={"message_id": message.message_id}
            )
    
    async def _enrich_job_data(self, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Enrich job data with additional information."""
        
        enriched = {
            "processed_at": datetime.utcnow().isoformat(),
            "enrichment_version": "1.0"
        }
        
        # Add salary normalization
        if job_data.get("salary_min") and job_data.get("salary_max"):
            enriched["salary_normalized"] = {
                "annual_min": job_data["salary_min"],
                "annual_max": job_data["salary_max"],
                "currency": "USD",
                "normalized_at": datetime.utcnow().isoformat()
            }
        
        # Add skill categorization
        if job_data.get("skills"):
            enriched["skill_categories"] = self._categorize_skills(job_data["skills"])
        
        # Add location enrichment
        if job_data.get("location"):
            enriched["location_data"] = await self._enrich_location(job_data["location"])
        
        return enriched
    
    def _categorize_skills(self, skills: List[str]) -> Dict[str, List[str]]:
        """Categorize skills into different groups."""
        
        categories = {
            "programming_languages": [],
            "frameworks": [],
            "databases": [],
            "cloud_platforms": [],
            "tools": [],
            "soft_skills": [],
            "other": []
        }
        
        # Simple categorization logic (can be enhanced with ML)
        programming_languages = {
            'python', 'java', 'javascript', 'typescript', 'go', 'rust',
            'c++', 'c#', 'php', 'ruby', 'swift', 'kotlin', 'scala'
        }
        
        frameworks = {
            'react', 'angular', 'vue', 'django', 'flask', 'spring',
            'express', 'rails', 'laravel', 'fastapi', 'nextjs'
        }
        
        databases = {
            'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
            'cassandra', 'dynamodb', 'sqlite'
        }
        
        cloud_platforms = {
            'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform'
        }
        
        for skill in skills:
            skill_lower = skill.lower()
            
            if skill_lower in programming_languages:
                categories["programming_languages"].append(skill)
            elif skill_lower in frameworks:
                categories["frameworks"].append(skill)
            elif skill_lower in databases:
                categories["databases"].append(skill)
            elif skill_lower in cloud_platforms:
                categories["cloud_platforms"].append(skill)
            else:
                categories["other"].append(skill)
        
        return categories
    
    async def _enrich_location(self, location: str) -> Dict[str, Any]:
        """Enrich location data."""
        
        # Simple location parsing (can be enhanced with geocoding)
        location_data = {
            "raw_location": location,
            "parsed_at": datetime.utcnow().isoformat()
        }
        
        # Extract city, state, country (basic parsing)
        parts = [part.strip() for part in location.split(',')]
        
        if len(parts) >= 1:
            location_data["city"] = parts[0]
        
        if len(parts) >= 2:
            location_data["state"] = parts[1]
        
        if len(parts) >= 3:
            location_data["country"] = parts[2]
        else:
            location_data["country"] = "US"  # Default assumption
        
        return location_data
    
    async def _notify_websocket_clients(self, job_data: Dict[str, Any]):
        """Notify WebSocket clients about new job."""
        
        try:
            # Import here to avoid circular imports
            from src.api.websocket import connection_manager
            
            # Create job object for WebSocket notification
            from src.models.job_models import Job
            
            job = Job(
                id=job_data.get("job_id"),
                title=job_data.get("title", ""),
                company=job_data.get("company", ""),
                location=job_data.get("location", ""),
                url=job_data.get("url", ""),
                source=job_data.get("source", ""),
                job_type=job_data.get("job_type"),
                experience_level=job_data.get("experience_level"),
                salary_min=job_data.get("salary_min"),
                salary_max=job_data.get("salary_max"),
                remote_friendly=job_data.get("remote_friendly", False),
                posted_date=datetime.fromisoformat(job_data["posted_date"]) if job_data.get("posted_date") else None,
                skills=job_data.get("skills", []),
                metadata=job_data.get("metadata", {})
            )
            
            await connection_manager.broadcast_job_update(job, "new_job")
        
        except Exception as e:
            capture_api_error(
                e,
                endpoint="notify_websocket_clients",
                method="KAFKA",
                context={"job_id": job_data.get("job_id")}
            )
    
    def get_stats(self) -> Dict[str, Any]:
        """Get pipeline statistics."""
        
        return {
            "jobs_processed": self.jobs_processed,
            "jobs_enriched": self.jobs_enriched,
            "processing_errors": self.processing_errors,
            "producer_stats": self.producer.get_stats(),
            "consumer_stats": self.consumer.get_stats()
        }


# Global instances
kafka_producer = KafkaProducerManager()
kafka_consumer = KafkaConsumerManager()
job_pipeline = JobProcessingPipeline(kafka_producer, kafka_consumer)


async def initialize_kafka():
    """Initialize Kafka components."""
    
    try:
        await kafka_producer.start()
        await job_pipeline.start_pipeline()
        add_scraping_breadcrumb("Kafka components initialized successfully")
    except Exception as e:
        capture_api_error(e, endpoint="initialize_kafka", method="KAFKA")
        # Don't raise - allow service to start without Kafka if needed
        add_scraping_breadcrumb("Kafka initialization failed, continuing without Kafka")


async def shutdown_kafka():
    """Shutdown Kafka components."""
    
    try:
        await job_pipeline.stop_pipeline()
        add_scraping_breadcrumb("Kafka components shut down successfully")
    except Exception as e:
        capture_api_error(e, endpoint="shutdown_kafka", method="KAFKA")
