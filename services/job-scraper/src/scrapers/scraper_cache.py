"""
Scraper Cache Module
Maintains persistent scraper configurations and session management
"""

import asyncio
import logging
import time
import pickle
import json
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
from pathlib import Path
import aioredis
from cryptography.fernet import Fernet
import hashlib
import base64

logger = logging.getLogger(__name__)

class SessionCache:
    """Manages authentication sessions for scrapers"""
    
    def __init__(self, redis_url: str = None, encryption_key: str = None):
        self.redis_url = redis_url or "redis://localhost:6379"
        self.redis_client = None
        
        # Generate encryption key if not provided
        if encryption_key:
            self.cipher = Fernet(encryption_key.encode())
        else:
            key = Fernet.generate_key()
            self.cipher = Fernet(key)
            logger.warning("Using generated encryption key. Provide key for persistence.")
            
        self.session_prefix = "scraper_session:"
        self.config_prefix = "scraper_config:"
        
    async def initialize(self):
        """Initialize Redis connection"""
        self.redis_client = await aioredis.create_redis_pool(self.redis_url)
        logger.info("Session cache initialized")
        
    async def store_session(self, 
                           scraper_name: str, 
                           session_data: Dict[str, Any],
                           ttl: int = 3600):
        """
        Store encrypted session data
        
        Args:
            scraper_name: Name of the scraper
            session_data: Session data (cookies, tokens, etc.)
            ttl: Time to live in seconds
        """
        key = f"{self.session_prefix}{scraper_name}"
        
        # Serialize and encrypt session data
        serialized = json.dumps(session_data).encode()
        encrypted = self.cipher.encrypt(serialized)
        
        # Store in Redis
        await self.redis_client.setex(key, ttl, encrypted)
        logger.info(f"Stored session for {scraper_name} with TTL {ttl}s")
        
    async def get_session(self, scraper_name: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve and decrypt session data
        
        Args:
            scraper_name: Name of the scraper
            
        Returns:
            Session data or None if not found/expired
        """
        key = f"{self.session_prefix}{scraper_name}"
        
        # Get from Redis
        encrypted = await self.redis_client.get(key)
        if not encrypted:
            return None
            
        try:
            # Decrypt and deserialize
            decrypted = self.cipher.decrypt(encrypted)
            session_data = json.loads(decrypted.decode())
            logger.info(f"Retrieved session for {scraper_name}")
            return session_data
            
        except Exception as e:
            logger.error(f"Failed to decrypt session for {scraper_name}: {str(e)}")
            return None
            
    async def invalidate_session(self, scraper_name: str):
        """Invalidate a scraper session"""
        key = f"{self.session_prefix}{scraper_name}"
        await self.redis_client.delete(key)
        logger.info(f"Invalidated session for {scraper_name}")
        
    async def store_config(self, 
                          scraper_name: str, 
                          config: Dict[str, Any],
                          version: str = "latest"):
        """Store scraper configuration"""
        key = f"{self.config_prefix}{scraper_name}:{version}"
        
        # Add metadata
        config_with_meta = {
            **config,
            "_stored_at": datetime.utcnow().isoformat(),
            "_version": version
        }
        
        serialized = json.dumps(config_with_meta)
        await self.redis_client.set(key, serialized)
        logger.info(f"Stored config for {scraper_name} version {version}")
        
    async def get_config(self, 
                        scraper_name: str, 
                        version: str = "latest") -> Optional[Dict[str, Any]]:
        """Get scraper configuration"""
        key = f"{self.config_prefix}{scraper_name}:{version}"
        
        serialized = await self.redis_client.get(key)
        if not serialized:
            return None
            
        config = json.loads(serialized.decode())
        logger.info(f"Retrieved config for {scraper_name} version {version}")
        return config
        
    async def cleanup(self):
        """Cleanup resources"""
        if self.redis_client:
            self.redis_client.close()
            await self.redis_client.wait_closed()

class ScraperStateCache:
    """Caches scraper state for faster initialization"""
    
    def __init__(self, cache_dir: str = "./scraper_cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        self.state_cache: Dict[str, Dict[str, Any]] = {}
        self.cache_ttl = timedelta(hours=24)
        
    def _get_cache_path(self, scraper_name: str) -> Path:
        """Get cache file path for scraper"""
        return self.cache_dir / f"{scraper_name}_state.pkl"
        
    def save_state(self, scraper_name: str, state: Dict[str, Any]):
        """Save scraper state to disk"""
        cache_path = self._get_cache_path(scraper_name)
        
        state_with_meta = {
            "state": state,
            "saved_at": datetime.utcnow(),
            "scraper_name": scraper_name
        }
        
        try:
            with open(cache_path, "wb") as f:
                pickle.dump(state_with_meta, f)
            logger.info(f"Saved state for {scraper_name}")
            
            # Also update memory cache
            self.state_cache[scraper_name] = state_with_meta
            
        except Exception as e:
            logger.error(f"Failed to save state for {scraper_name}: {str(e)}")
            
    def load_state(self, scraper_name: str) -> Optional[Dict[str, Any]]:
        """Load scraper state from cache"""
        # Check memory cache first
        if scraper_name in self.state_cache:
            cached = self.state_cache[scraper_name]
            if datetime.utcnow() - cached["saved_at"] < self.cache_ttl:
                logger.info(f"Loaded state for {scraper_name} from memory")
                return cached["state"]
                
        # Load from disk
        cache_path = self._get_cache_path(scraper_name)
        if not cache_path.exists():
            return None
            
        try:
            with open(cache_path, "rb") as f:
                cached = pickle.load(f)
                
            # Check TTL
            if datetime.utcnow() - cached["saved_at"] > self.cache_ttl:
                logger.info(f"State cache for {scraper_name} expired")
                return None
                
            # Update memory cache
            self.state_cache[scraper_name] = cached
            logger.info(f"Loaded state for {scraper_name} from disk")
            return cached["state"]
            
        except Exception as e:
            logger.error(f"Failed to load state for {scraper_name}: {str(e)}")
            return None
            
    def invalidate_state(self, scraper_name: str):
        """Invalidate cached state"""
        # Remove from memory
        self.state_cache.pop(scraper_name, None)
        
        # Remove from disk
        cache_path = self._get_cache_path(scraper_name)
        if cache_path.exists():
            cache_path.unlink()
            
        logger.info(f"Invalidated state cache for {scraper_name}")

class SmartScraperCache:
    """
    Intelligent scraper cache with health monitoring and auto-restart
    """
    
    def __init__(self, session_cache: SessionCache, state_cache: ScraperStateCache):
        self.session_cache = session_cache
        self.state_cache = state_cache
        self.health_status: Dict[str, Dict[str, Any]] = {}
        self.restart_counts: Dict[str, int] = {}
        self.max_restart_attempts = 3
        
    async def initialize(self):
        """Initialize the smart cache"""
        await self.session_cache.initialize()
        logger.info("Smart scraper cache initialized")
        
    def update_health(self, 
                     scraper_name: str, 
                     status: str, 
                     error: Optional[str] = None,
                     metrics: Dict[str, Any] = None):
        """Update scraper health status"""
        self.health_status[scraper_name] = {
            "status": status,
            "last_update": datetime.utcnow(),
            "error": error,
            "metrics": metrics or {},
            "restart_count": self.restart_counts.get(scraper_name, 0)
        }
        
        # Check if restart needed
        if status == "failed" and error:
            asyncio.create_task(self._handle_failure(scraper_name, error))
            
    async def _handle_failure(self, scraper_name: str, error: str):
        """Handle scraper failure with potential restart"""
        restart_count = self.restart_counts.get(scraper_name, 0)
        
        if restart_count < self.max_restart_attempts:
            logger.warning(f"Attempting restart {restart_count + 1} for {scraper_name}")
            
            # Invalidate caches
            await self.session_cache.invalidate_session(scraper_name)
            self.state_cache.invalidate_state(scraper_name)
            
            # Update restart count
            self.restart_counts[scraper_name] = restart_count + 1
            
            # Mark for restart
            self.health_status[scraper_name]["status"] = "restarting"
            
        else:
            logger.error(f"Max restart attempts reached for {scraper_name}")
            self.health_status[scraper_name]["status"] = "dead"
            
    def get_health_report(self) -> Dict[str, Any]:
        """Get comprehensive health report"""
        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "scrapers": {},
            "summary": {
                "healthy": 0,
                "failed": 0,
                "restarting": 0,
                "dead": 0
            }
        }
        
        for scraper_name, health in self.health_status.items():
            status = health["status"]
            report["scrapers"][scraper_name] = health
            report["summary"][status] = report["summary"].get(status, 0) + 1
            
        return report
        
    async def get_optimized_scraper(self, scraper_name: str) -> Dict[str, Any]:
        """
        Get scraper with cached session and state
        
        Returns:
            Dict with session, state, and health info
        """
        session = await self.session_cache.get_session(scraper_name)
        state = self.state_cache.load_state(scraper_name)
        health = self.health_status.get(scraper_name, {"status": "unknown"})
        
        return {
            "scraper_name": scraper_name,
            "session": session,
            "state": state,
            "health": health,
            "has_cached_session": session is not None,
            "has_cached_state": state is not None
        }
        
    async def cleanup(self):
        """Cleanup resources"""
        await self.session_cache.cleanup()

# Example scraper with cache integration
class CachedScraper:
    """Base class for scrapers with caching support"""
    
    def __init__(self, name: str, cache: SmartScraperCache):
        self.name = name
        self.cache = cache
        self.session = None
        self.state = {}
        
    async def initialize(self):
        """Initialize with cached data"""
        cached_data = await self.cache.get_optimized_scraper(self.name)
        
        if cached_data["has_cached_session"]:
            self.session = cached_data["session"]
            logger.info(f"Restored session for {self.name}")
            
        if cached_data["has_cached_state"]:
            self.state = cached_data["state"]
            logger.info(f"Restored state for {self.name}")
            
        # Update health
        self.cache.update_health(self.name, "initializing")
        
    async def save_session(self):
        """Save current session"""
        if self.session:
            await self.cache.session_cache.store_session(
                self.name, 
                self.session,
                ttl=7200  # 2 hours
            )
            
    def save_state(self):
        """Save current state"""
        self.cache.state_cache.save_state(self.name, self.state)
        
    def reset(self):
        """Reset scraper state"""
        self.state = {}
        self.session = None

# Singleton instances
_session_cache = None
_state_cache = None
_smart_cache = None

def get_scraper_cache() -> SmartScraperCache:
    """Get the singleton scraper cache instance"""
    global _session_cache, _state_cache, _smart_cache
    
    if _smart_cache is None:
        _session_cache = SessionCache()
        _state_cache = ScraperStateCache()
        _smart_cache = SmartScraperCache(_session_cache, _state_cache)
        
    return _smart_cache
