"""
Adaptive rate limiter with self-healing capabilities.
Automatically adjusts rate limits based on response patterns.
"""

import asyncio
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Dict, Optional, Deque
from datetime import datetime, timedelta
import math

from loguru import logger

from src.config.settings import settings


@dataclass
class DomainStats:
    """Statistics for a specific domain."""
    requests_made: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    blocked_requests: int = 0
    last_request_time: float = 0
    last_block_time: float = 0
    current_delay: float = 1.0
    request_times: Deque[float] = field(default_factory=lambda: deque(maxlen=100))
    response_times: Deque[float] = field(default_factory=lambda: deque(maxlen=100))
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate."""
        if self.requests_made == 0:
            return 1.0
        return self.successful_requests / self.requests_made
    
    @property
    def avg_response_time(self) -> float:
        """Calculate average response time."""
        if not self.response_times:
            return 0.0
        return sum(self.response_times) / len(self.response_times)
    
    @property
    def requests_per_minute(self) -> float:
        """Calculate current request rate."""
        if len(self.request_times) < 2:
            return 0.0
        
        time_span = self.request_times[-1] - self.request_times[0]
        if time_span == 0:
            return 0.0
        
        return (len(self.request_times) / time_span) * 60


class AdaptiveRateLimiter:
    """Adaptive rate limiter that adjusts based on server responses."""
    
    def __init__(self):
        self.domain_stats: Dict[str, DomainStats] = defaultdict(DomainStats)
        self.global_stats = DomainStats()
        
        # Configuration
        self.min_delay = 0.1  # Minimum delay between requests
        self.max_delay = 60.0  # Maximum delay between requests
        self.initial_delay = 1.0  # Initial delay for new domains
        
        # Adaptive parameters
        self.target_success_rate = 0.95
        self.block_penalty_multiplier = 2.0
        self.success_reward_factor = 0.9
        self.failure_penalty_factor = 1.2
        
        # Rate limit windows
        self.windows: Dict[str, Dict[str, any]] = defaultdict(lambda: {
            'requests': deque(maxlen=1000),
            'limit': settings.rate_limit_per_domain,
            'window_size': settings.rate_limit_window
        })
        
        # Lock for thread safety
        self._locks: Dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
    
    async def wait(self, domain: str, priority: int = 5) -> None:
        """Wait before making a request to a domain."""
        async with self._locks[domain]:
            stats = self.domain_stats[domain]
            
            # Calculate adaptive delay
            delay = self._calculate_delay(domain, stats)
            
            # Apply priority (1-10, where 1 is highest priority)
            delay *= (priority / 5.0)
            
            # Ensure minimum time between requests
            time_since_last = time.time() - stats.last_request_time
            if time_since_last < delay:
                wait_time = delay - time_since_last
                logger.debug(f"Rate limiting {domain}: waiting {wait_time:.2f}s")
                await asyncio.sleep(wait_time)
            
            # Record request time
            current_time = time.time()
            stats.request_times.append(current_time)
            stats.last_request_time = current_time
            stats.requests_made += 1
            
            # Update global stats
            self.global_stats.requests_made += 1
            self.global_stats.request_times.append(current_time)
    
    def record_success(self, domain: str, response_time: Optional[float] = None) -> None:
        """Record a successful request."""
        stats = self.domain_stats[domain]
        stats.successful_requests += 1
        self.global_stats.successful_requests += 1
        
        if response_time:
            stats.response_times.append(response_time)
            self.global_stats.response_times.append(response_time)
        
        # Reward success with reduced delay
        if settings.adaptive_rate_limiting:
            stats.current_delay *= self.success_reward_factor
            stats.current_delay = max(stats.current_delay, self.min_delay)
            
            logger.debug(f"Success on {domain}: delay reduced to {stats.current_delay:.2f}s")
    
    def record_failure(self, domain: str, is_blocked: bool = False) -> None:
        """Record a failed request."""
        stats = self.domain_stats[domain]
        stats.failed_requests += 1
        self.global_stats.failed_requests += 1
        
        if is_blocked:
            stats.blocked_requests += 1
            stats.last_block_time = time.time()
            self.global_stats.blocked_requests += 1
            
            # Heavy penalty for blocks
            if settings.adaptive_rate_limiting:
                stats.current_delay *= self.block_penalty_multiplier
                stats.current_delay = min(stats.current_delay, self.max_delay)
                
                logger.warning(f"Blocked on {domain}: delay increased to {stats.current_delay:.2f}s")
        else:
            # Light penalty for regular failures
            if settings.adaptive_rate_limiting:
                stats.current_delay *= self.failure_penalty_factor
                stats.current_delay = min(stats.current_delay, self.max_delay)
    
    def _calculate_delay(self, domain: str, stats: DomainStats) -> float:
        """Calculate adaptive delay for a domain."""
        if not settings.adaptive_rate_limiting:
            return self.initial_delay
        
        # Start with current delay
        delay = stats.current_delay
        
        # Adjust based on success rate
        if stats.requests_made > 10:  # Need some data
            success_rate = stats.success_rate
            
            if success_rate < self.target_success_rate:
                # Increase delay if below target
                rate_diff = self.target_success_rate - success_rate
                delay *= (1 + rate_diff)
            
            # Adjust based on response times
            if stats.response_times:
                avg_response = stats.avg_response_time
                if avg_response > 2.0:  # Slow responses
                    delay *= (avg_response / 2.0)
        
        # Check if recently blocked
        if stats.last_block_time > 0:
            time_since_block = time.time() - stats.last_block_time
            if time_since_block < 300:  # 5 minutes
                # Exponential backoff from blocks
                block_factor = math.exp(-time_since_block / 300) * 2
                delay *= (1 + block_factor)
        
        # Apply rate limiting window
        window = self.windows[domain]
        current_time = time.time()
        
        # Remove old requests from window
        window['requests'] = deque(
            [t for t in window['requests'] if current_time - t < window['window_size']],
            maxlen=1000
        )
        
        # Check if at rate limit
        if len(window['requests']) >= window['limit']:
            # Calculate how long to wait
            oldest_request = window['requests'][0]
            wait_until = oldest_request + window['window_size']
            additional_wait = max(0, wait_until - current_time)
            delay = max(delay, additional_wait + 0.1)
        
        # Record request in window
        window['requests'].append(current_time)
        
        # Ensure within bounds
        delay = max(self.min_delay, min(delay, self.max_delay))
        
        return delay
    
    def get_stats(self, domain: Optional[str] = None) -> Dict[str, any]:
        """Get statistics for a domain or all domains."""
        if domain:
            stats = self.domain_stats.get(domain)
            if not stats:
                return {}
            
            return {
                'domain': domain,
                'requests_made': stats.requests_made,
                'successful_requests': stats.successful_requests,
                'failed_requests': stats.failed_requests,
                'blocked_requests': stats.blocked_requests,
                'success_rate': stats.success_rate,
                'current_delay': stats.current_delay,
                'avg_response_time': stats.avg_response_time,
                'requests_per_minute': stats.requests_per_minute
            }
        
        # Return global stats
        return {
            'total_domains': len(self.domain_stats),
            'total_requests': self.global_stats.requests_made,
            'total_successful': self.global_stats.successful_requests,
            'total_failed': self.global_stats.failed_requests,
            'total_blocked': self.global_stats.blocked_requests,
            'global_success_rate': self.global_stats.success_rate,
            'global_avg_response_time': self.global_stats.avg_response_time,
            'domain_stats': {
                domain: self.get_stats(domain)
                for domain in self.domain_stats.keys()
            }
        }
    
    def reset_domain(self, domain: str) -> None:
        """Reset statistics for a domain."""
        if domain in self.domain_stats:
            self.domain_stats[domain] = DomainStats(current_delay=self.initial_delay)
            logger.info(f"Reset rate limiter stats for {domain}")
    
    def adjust_limits(self, domain: str, new_limit: int, new_window: int) -> None:
        """Adjust rate limits for a specific domain."""
        window = self.windows[domain]
        window['limit'] = new_limit
        window['window_size'] = new_window
        logger.info(f"Adjusted rate limits for {domain}: {new_limit} requests per {new_window}s")
    
    async def health_check(self) -> Dict[str, any]:
        """Perform health check on rate limiter."""
        problematic_domains = []
        
        for domain, stats in self.domain_stats.items():
            # Check for domains with poor success rates
            if stats.requests_made > 50 and stats.success_rate < 0.5:
                problematic_domains.append({
                    'domain': domain,
                    'success_rate': stats.success_rate,
                    'current_delay': stats.current_delay,
                    'blocked_count': stats.blocked_requests
                })
        
        return {
            'healthy': len(problematic_domains) == 0,
            'problematic_domains': problematic_domains,
            'global_success_rate': self.global_stats.success_rate,
            'total_domains_tracked': len(self.domain_stats)
        }
