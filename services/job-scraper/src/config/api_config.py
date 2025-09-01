"""
API Configuration for connecting to the main AI Job Chommie backend.
"""

import os
from typing import Optional

class APIConfig:
    """Configuration for connecting to the main backend API."""
    
    def __init__(self):
        # Main Backend API Configuration
        self.BACKEND_API_URL = os.getenv('BACKEND_API_URL', 'http://localhost:5000')
        self.BACKEND_API_VERSION = os.getenv('BACKEND_API_VERSION', 'v1')
        self.BACKEND_API_KEY = os.getenv('BACKEND_API_KEY', '')
        
        # Authentication
        self.ADMIN_API_KEY = os.getenv('ADMIN_API_KEY', 'admin_key_change_this_to_32_plus_characters_for_security')
        
        # Service Authentication (for service-to-service communication)
        self.SERVICE_AUTH_TOKEN = os.getenv('SERVICE_AUTH_TOKEN', '')
        
        # Timeout settings
        self.API_TIMEOUT = int(os.getenv('API_TIMEOUT', '30'))
        self.API_RETRY_ATTEMPTS = int(os.getenv('API_RETRY_ATTEMPTS', '3'))
        self.API_RETRY_DELAY = int(os.getenv('API_RETRY_DELAY', '1'))
        
    def get_backend_endpoint(self, endpoint: str) -> str:
        """Construct full backend API endpoint URL."""
        base_url = f"{self.BACKEND_API_URL}/api/{self.BACKEND_API_VERSION}"
        return f"{base_url}/{endpoint.lstrip('/')}"
    
    def get_headers(self) -> dict:
        """Get headers for API requests."""
        headers = {
            'Content-Type': 'application/json',
            'X-Service-Name': 'job-scraping-service',
            'X-API-Version': self.BACKEND_API_VERSION
        }
        
        # Add authentication if available
        if self.SERVICE_AUTH_TOKEN:
            headers['Authorization'] = f'Bearer {self.SERVICE_AUTH_TOKEN}'
        elif self.ADMIN_API_KEY:
            headers['X-Admin-API-Key'] = self.ADMIN_API_KEY
            
        return headers
    
    def __str__(self) -> str:
        """String representation for debugging."""
        return f"APIConfig(backend_url={self.BACKEND_API_URL}, version={self.BACKEND_API_VERSION})"


# Create singleton instance
api_config = APIConfig()
