"""
Backend Integration Service for communicating with the main AI Job Chommie API.
"""

import aiohttp
import asyncio
import json
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging
from src.config.api_config import api_config
from src.config.sentry import capture_api_error, add_scraping_breadcrumb

logger = logging.getLogger(__name__)

class BackendIntegrationService:
    """Service for integrating with the main backend API."""
    
    def __init__(self):
        self.config = api_config
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def __aenter__(self):
        """Async context manager entry."""
        self.session = aiohttp.ClientSession(
            headers=self.config.get_headers(),
            timeout=aiohttp.ClientTimeout(total=self.config.API_TIMEOUT)
        )
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
    
    async def ensure_session(self):
        """Ensure aiohttp session is created."""
        if not self.session:
            self.session = aiohttp.ClientSession(
                headers=self.config.get_headers(),
                timeout=aiohttp.ClientTimeout(total=self.config.API_TIMEOUT)
            )
    
    async def close_session(self):
        """Close aiohttp session."""
        if self.session:
            await self.session.close()
            self.session = None
    
    async def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                          params: Optional[Dict] = None) -> Dict[str, Any]:
        """Make an HTTP request to the backend API with retry logic."""
        await self.ensure_session()
        
        url = self.config.get_backend_endpoint(endpoint)
        attempt = 0
        last_error = None
        
        while attempt < self.config.API_RETRY_ATTEMPTS:
            try:
                add_scraping_breadcrumb(f"Making {method} request to backend: {endpoint}")
                
                async with self.session.request(
                    method=method,
                    url=url,
                    json=data,
                    params=params
                ) as response:
                    response_data = await response.json()
                    
                    if response.status >= 200 and response.status < 300:
                        return response_data
                    else:
                        error_msg = response_data.get('error', 'Unknown error')
                        raise Exception(f"Backend API error ({response.status}): {error_msg}")
                        
            except Exception as e:
                attempt += 1
                last_error = e
                logger.warning(f"Backend API request failed (attempt {attempt}): {str(e)}")
                
                if attempt < self.config.API_RETRY_ATTEMPTS:
                    await asyncio.sleep(self.config.API_RETRY_DELAY * attempt)
                else:
                    capture_api_error(
                        e,
                        endpoint=endpoint,
                        method=method,
                        context={'url': url, 'attempts': attempt}
                    )
                    raise
        
        raise last_error
    
    async def push_scraped_jobs(self, jobs: List[Dict[str, Any]], source: str) -> Dict[str, Any]:
        """Push scraped jobs to the main backend."""
        logger.info(f"Pushing {len(jobs)} jobs from {source} to backend")
        
        data = {
            "jobs": jobs,
            "source": source,
            "scraped_at": datetime.utcnow().isoformat(),
            "scraper_version": "1.0.0"
        }
        
        try:
            response = await self._make_request(
                method="POST",
                endpoint="jobs/bulk-import",
                data=data
            )
            
            logger.info(f"Successfully pushed {len(jobs)} jobs to backend")
            return response
            
        except Exception as e:
            logger.error(f"Failed to push jobs to backend: {str(e)}")
            raise
    
    async def update_task_status(self, task_id: str, status: str, 
                                progress: int, jobs_found: int = 0,
                                errors: Optional[List[str]] = None) -> Dict[str, Any]:
        """Update scraping task status in the backend."""
        data = {
            "task_id": task_id,
            "status": status,
            "progress": progress,
            "jobs_found": jobs_found,
            "updated_at": datetime.utcnow().isoformat(),
            "errors": errors or []
        }
        
        try:
            response = await self._make_request(
                method="PUT",
                endpoint=f"scraping/tasks/{task_id}/status",
                data=data
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Failed to update task status: {str(e)}")
            # Don't raise here, task status update failures shouldn't stop scraping
            return {"success": False, "error": str(e)}
    
    async def get_scraping_config(self, source: str) -> Dict[str, Any]:
        """Get scraping configuration from the backend."""
        try:
            response = await self._make_request(
                method="GET",
                endpoint=f"scraping/config/{source}"
            )
            
            return response.get('data', {})
            
        except Exception as e:
            logger.warning(f"Failed to get scraping config: {str(e)}")
            # Return default config on failure
            return {
                "max_pages": 10,
                "delay_between_requests": 1.0,
                "timeout": 30,
                "retry_attempts": 3
            }
    
    async def report_scraping_metrics(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Report scraping metrics to the backend."""
        data = {
            "metrics": metrics,
            "reported_at": datetime.utcnow().isoformat(),
            "service_name": "job-scraping-service"
        }
        
        try:
            response = await self._make_request(
                method="POST",
                endpoint="scraping/metrics",
                data=data
            )
            
            return response
            
        except Exception as e:
            logger.warning(f"Failed to report metrics: {str(e)}")
            # Metrics reporting failures shouldn't stop the service
            return {"success": False, "error": str(e)}
    
    async def check_backend_health(self) -> bool:
        """Check if the backend API is healthy."""
        try:
            response = await self._make_request(
                method="GET",
                endpoint="../health"  # Health endpoint is at root level
            )
            
            return response.get('status') == 'ok'
            
        except Exception:
            return False


# Singleton instance
backend_service = BackendIntegrationService()
