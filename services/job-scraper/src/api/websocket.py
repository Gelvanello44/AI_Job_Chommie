"""
WebSocket connection manager for real-time job updates and notifications.
"""

import json
import asyncio
from typing import Dict, List, Set, Any, Optional, Callable
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
from dataclasses import dataclass, asdict
import uuid

from src.config.sentry import capture_api_error, add_scraping_breadcrumb
from src.models.job_models import Job


@dataclass
class WebSocketMessage:
    """WebSocket message structure."""
    type: str
    data: Any
    timestamp: datetime
    client_id: Optional[str] = None
    message_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "data": self.data,
            "timestamp": self.timestamp.isoformat(),
            "client_id": self.client_id,
            "message_id": self.message_id or str(uuid.uuid4())
        }


@dataclass
class SubscriptionFilter:
    """Client subscription filter."""
    keywords: Optional[List[str]] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    experience_level: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    company: Optional[str] = None
    remote_only: Optional[bool] = None
    
    def matches_job(self, job: Job) -> bool:
        """Check if job matches subscription filter."""
        
        # Keyword matching
        if self.keywords:
            job_text = f"{job.title} {job.description} {job.company}".lower()
            if not any(keyword.lower() in job_text for keyword in self.keywords):
                return False
        
        # Location matching
        if self.location and job.location:
            if self.location.lower() not in job.location.lower():
                return False
        
        # Job type matching
        if self.job_type and job.job_type != self.job_type:
            return False
        
        # Experience level matching
        if self.experience_level and job.experience_level != self.experience_level:
            return False
        
        # Salary matching
        if self.salary_min and job.salary_max and job.salary_max < self.salary_min:
            return False
        
        if self.salary_max and job.salary_min and job.salary_min > self.salary_max:
            return False
        
        # Company matching
        if self.company and job.company:
            if self.company.lower() not in job.company.lower():
                return False
        
        # Remote work matching
        if self.remote_only and not job.remote_friendly:
            return False
        
        return True


class WebSocketClient:
    """WebSocket client connection wrapper."""
    
    def __init__(self, client_id: str, websocket: WebSocket):
        self.client_id = client_id
        self.websocket = websocket
        self.connected_at = datetime.utcnow()
        self.last_ping = datetime.utcnow()
        self.subscriptions: Dict[str, SubscriptionFilter] = {}
        self.user_id: Optional[str] = None
        self.user_tier: Optional[str] = None
        
        # Message statistics
        self.messages_sent = 0
        self.messages_received = 0
        self.last_activity = datetime.utcnow()
    
    async def send_message(self, message: WebSocketMessage) -> bool:
        """Send message to client."""
        try:
            await self.websocket.send_text(json.dumps(message.to_dict()))
            self.messages_sent += 1
            self.last_activity = datetime.utcnow()
            return True
        except Exception as e:
            capture_api_error(e, endpoint="websocket_send", method="WS")
            return False
    
    async def send_job_update(self, job: Job, update_type: str = "new_job") -> bool:
        """Send job update to client if it matches subscriptions."""
        
        # Check if job matches any active subscriptions
        matching_subscriptions = []
        for sub_id, filter_obj in self.subscriptions.items():
            if filter_obj.matches_job(job):
                matching_subscriptions.append(sub_id)
        
        if not matching_subscriptions:
            return False
        
        message = WebSocketMessage(
            type=update_type,
            data={
                "job": {
                    "id": job.id,
                    "title": job.title,
                    "company": job.company,
                    "location": job.location,
                    "salary_min": job.salary_min,
                    "salary_max": job.salary_max,
                    "job_type": job.job_type,
                    "experience_level": job.experience_level,
                    "remote_friendly": job.remote_friendly,
                    "posted_date": job.posted_date.isoformat() if job.posted_date else None,
                    "url": job.url
                },
                "matching_subscriptions": matching_subscriptions
            },
            timestamp=datetime.utcnow(),
            client_id=self.client_id
        )
        
        return await self.send_message(message)
    
    def add_subscription(self, subscription_id: str, filter_data: Dict[str, Any]):
        """Add subscription filter for client."""
        self.subscriptions[subscription_id] = SubscriptionFilter(**filter_data)
        add_scraping_breadcrumb(
            f"Client {self.client_id} added subscription",
            data={"subscription_id": subscription_id, "filter": filter_data}
        )
    
    def remove_subscription(self, subscription_id: str) -> bool:
        """Remove subscription filter."""
        if subscription_id in self.subscriptions:
            del self.subscriptions[subscription_id]
            add_scraping_breadcrumb(
                f"Client {self.client_id} removed subscription",
                data={"subscription_id": subscription_id}
            )
            return True
        return False
    
    def update_activity(self):
        """Update last activity timestamp."""
        self.last_activity = datetime.utcnow()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get client statistics."""
        return {
            "client_id": self.client_id,
            "connected_at": self.connected_at.isoformat(),
            "last_activity": self.last_activity.isoformat(),
            "messages_sent": self.messages_sent,
            "messages_received": self.messages_received,
            "active_subscriptions": len(self.subscriptions),
            "user_id": self.user_id,
            "user_tier": self.user_tier
        }


class ConnectionManager:
    """WebSocket connection manager for real-time job updates."""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocketClient] = {}
        self.subscription_index: Dict[str, Set[str]] = {}  # subscription_type -> client_ids
        
        # Background tasks
        self.cleanup_task: Optional[asyncio.Task] = None
        self.ping_task: Optional[asyncio.Task] = None
        
        # Statistics
        self.total_connections = 0
        self.total_messages_sent = 0
        self.start_time = datetime.utcnow()
        
        # Job update callbacks
        self.job_callbacks: List[Callable[[Job, str], None]] = []
    
    async def start_background_tasks(self):
        """Start background maintenance tasks."""
        if not self.cleanup_task:
            self.cleanup_task = asyncio.create_task(self._cleanup_inactive_connections())
        
        if not self.ping_task:
            self.ping_task = asyncio.create_task(self._ping_clients())
    
    async def stop_background_tasks(self):
        """Stop background maintenance tasks."""
        if self.cleanup_task:
            self.cleanup_task.cancel()
            self.cleanup_task = None
        
        if self.ping_task:
            self.ping_task.cancel()
            self.ping_task = None
    
    async def connect(self, websocket: WebSocket, client_id: str) -> WebSocketClient:
        """Accept WebSocket connection and create client."""
        await websocket.accept()
        
        client = WebSocketClient(client_id, websocket)
        self.active_connections[client_id] = client
        self.total_connections += 1
        
        add_scraping_breadcrumb(
            f"WebSocket client connected: {client_id}",
            data={"total_active": len(self.active_connections)}
        )
        
        # Send welcome message
        welcome_message = WebSocketMessage(
            type="connection_established",
            data={
                "client_id": client_id,
                "server_time": datetime.utcnow().isoformat(),
                "features": [
                    "job_notifications",
                    "real_time_updates",
                    "subscription_management"
                ]
            },
            timestamp=datetime.utcnow(),
            client_id=client_id
        )
        
        await client.send_message(welcome_message)
        
        # Start background tasks if not already running
        await self.start_background_tasks()
        
        return client
    
    def disconnect(self, client_id: str):
        """Remove client connection."""
        if client_id in self.active_connections:
            client = self.active_connections[client_id]
            
            # Remove from subscription index
            for subscription_id in client.subscriptions.keys():
                if subscription_id in self.subscription_index:
                    self.subscription_index[subscription_id].discard(client_id)
                    if not self.subscription_index[subscription_id]:
                        del self.subscription_index[subscription_id]
            
            del self.active_connections[client_id]
            
            add_scraping_breadcrumb(
                f"WebSocket client disconnected: {client_id}",
                data={"total_active": len(self.active_connections)}
            )
    
    async def subscribe(self, client_id: str, filters: Dict[str, Any]) -> bool:
        """Subscribe client to job updates with filters."""
        if client_id not in self.active_connections:
            return False
        
        client = self.active_connections[client_id]
        
        # Generate unique subscription ID
        subscription_id = f"sub_{client_id}_{uuid.uuid4().hex[:8]}"
        
        # Add subscription to client
        client.add_subscription(subscription_id, filters)
        
        # Update subscription index
        if subscription_id not in self.subscription_index:
            self.subscription_index[subscription_id] = set()
        self.subscription_index[subscription_id].add(client_id)
        
        # Send confirmation
        confirmation = WebSocketMessage(
            type="subscription_confirmed",
            data={
                "subscription_id": subscription_id,
                "filters": filters,
                "active_subscriptions": len(client.subscriptions)
            },
            timestamp=datetime.utcnow(),
            client_id=client_id
        )
        
        await client.send_message(confirmation)
        return True
    
    async def unsubscribe(self, client_id: str, subscription_id: Optional[str] = None) -> bool:
        """Unsubscribe client from job updates."""
        if client_id not in self.active_connections:
            return False
        
        client = self.active_connections[client_id]
        
        if subscription_id:
            # Remove specific subscription
            success = client.remove_subscription(subscription_id)
            if success and subscription_id in self.subscription_index:
                self.subscription_index[subscription_id].discard(client_id)
                if not self.subscription_index[subscription_id]:
                    del self.subscription_index[subscription_id]
        else:
            # Remove all subscriptions
            for sub_id in list(client.subscriptions.keys()):
                client.remove_subscription(sub_id)
                if sub_id in self.subscription_index:
                    self.subscription_index[sub_id].discard(client_id)
                    if not self.subscription_index[sub_id]:
                        del self.subscription_index[sub_id]
        
        # Send confirmation
        confirmation = WebSocketMessage(
            type="unsubscription_confirmed",
            data={
                "subscription_id": subscription_id,
                "active_subscriptions": len(client.subscriptions)
            },
            timestamp=datetime.utcnow(),
            client_id=client_id
        )
        
        await client.send_message(confirmation)
        return True
    
    async def broadcast_job_update(
        self,
        job: Job,
        update_type: str = "new_job",
        target_clients: Optional[List[str]] = None
    ):
        """Broadcast job update to subscribed clients."""
        
        if target_clients:
            clients_to_notify = [
                self.active_connections[client_id]
                for client_id in target_clients
                if client_id in self.active_connections
            ]
        else:
            clients_to_notify = list(self.active_connections.values())
        
        messages_sent = 0
        
        for client in clients_to_notify:
            try:
                if await client.send_job_update(job, update_type):
                    messages_sent += 1
            except Exception as e:
                capture_api_error(
                    e,
                    endpoint="websocket_broadcast",
                    method="WS"
                )
                # Remove disconnected client
                self.disconnect(client.client_id)
        
        self.total_messages_sent += messages_sent
        
        add_scraping_breadcrumb(
            f"Job update broadcast: {update_type}",
            data={
                "job_id": job.id,
                "job_title": job.title,
                "messages_sent": messages_sent,
                "total_clients": len(clients_to_notify)
            }
        )
    
    async def send_system_message(
        self,
        message_type: str,
        data: Any,
        target_clients: Optional[List[str]] = None
    ):
        """Send system message to clients."""
        
        if target_clients:
            clients_to_notify = [
                self.active_connections[client_id]
                for client_id in target_clients
                if client_id in self.active_connections
            ]
        else:
            clients_to_notify = list(self.active_connections.values())
        
        message = WebSocketMessage(
            type=message_type,
            data=data,
            timestamp=datetime.utcnow()
        )
        
        for client in clients_to_notify:
            try:
                await client.send_message(message)
            except Exception:
                self.disconnect(client.client_id)
    
    async def handle_client_message(
        self,
        client_id: str,
        message: Dict[str, Any]
    ) -> bool:
        """Handle incoming message from client."""
        
        if client_id not in self.active_connections:
            return False
        
        client = self.active_connections[client_id]
        client.messages_received += 1
        client.update_activity()
        
        message_type = message.get("type")
        
        try:
            if message_type == "subscribe":
                filters = message.get("filters", {})
                return await self.subscribe(client_id, filters)
            
            elif message_type == "unsubscribe":
                subscription_id = message.get("subscription_id")
                return await self.unsubscribe(client_id, subscription_id)
            
            elif message_type == "ping":
                client.last_ping = datetime.utcnow()
                pong_message = WebSocketMessage(
                    type="pong",
                    data={"timestamp": datetime.utcnow().isoformat()},
                    timestamp=datetime.utcnow(),
                    client_id=client_id
                )
                await client.send_message(pong_message)
                return True
            
            elif message_type == "get_stats":
                stats_message = WebSocketMessage(
                    type="stats",
                    data=client.get_stats(),
                    timestamp=datetime.utcnow(),
                    client_id=client_id
                )
                await client.send_message(stats_message)
                return True
            
            else:
                # Unknown message type
                error_message = WebSocketMessage(
                    type="error",
                    data={
                        "error": "Unknown message type",
                        "received_type": message_type
                    },
                    timestamp=datetime.utcnow(),
                    client_id=client_id
                )
                await client.send_message(error_message)
                return False
        
        except Exception as e:
            capture_api_error(
                e,
                endpoint="websocket_message_handler",
                method="WS"
            )
            return False
    
    async def _cleanup_inactive_connections(self):
        """Background task to clean up inactive connections."""
        while True:
            try:
                await asyncio.sleep(300)  # Run every 5 minutes
                
                current_time = datetime.utcnow()
                inactive_clients = []
                
                for client_id, client in self.active_connections.items():
                    # Consider client inactive if no activity for 30 minutes
                    if (current_time - client.last_activity).seconds > 1800:
                        inactive_clients.append(client_id)
                
                for client_id in inactive_clients:
                    add_scraping_breadcrumb(
                        f"Cleaning up inactive WebSocket client: {client_id}"
                    )
                    self.disconnect(client_id)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                capture_api_error(e, endpoint="websocket_cleanup", method="TASK")
    
    async def _ping_clients(self):
        """Background task to ping clients and maintain connections."""
        while True:
            try:
                await asyncio.sleep(60)  # Ping every minute
                
                ping_message = WebSocketMessage(
                    type="ping",
                    data={"server_time": datetime.utcnow().isoformat()},
                    timestamp=datetime.utcnow()
                )
                
                disconnected_clients = []
                
                for client_id, client in self.active_connections.items():
                    try:
                        await client.send_message(ping_message)
                    except Exception:
                        disconnected_clients.append(client_id)
                
                for client_id in disconnected_clients:
                    self.disconnect(client_id)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                capture_api_error(e, endpoint="websocket_ping", method="TASK")
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection manager statistics."""
        uptime = datetime.utcnow() - self.start_time
        
        return {
            "active_connections": len(self.active_connections),
            "total_connections": self.total_connections,
            "total_messages_sent": self.total_messages_sent,
            "uptime_seconds": uptime.total_seconds(),
            "active_subscriptions": len(self.subscription_index),
            "clients_by_tier": self._get_clients_by_tier(),
            "average_messages_per_client": (
                self.total_messages_sent / max(self.total_connections, 1)
            )
        }
    
    def _get_clients_by_tier(self) -> Dict[str, int]:
        """Get client count by user tier."""
        tier_counts = {}
        
        for client in self.active_connections.values():
            tier = client.user_tier or "anonymous"
            tier_counts[tier] = tier_counts.get(tier, 0) + 1
        
        return tier_counts
    
    def set_user_context(
        self,
        client_id: str,
        user_id: str,
        user_tier: str
    ) -> bool:
        """Set user context for client connection."""
        if client_id in self.active_connections:
            client = self.active_connections[client_id]
            client.user_id = user_id
            client.user_tier = user_tier
            return True
        return False


# Global connection manager instance
connection_manager = ConnectionManager()
