"""
Circuit breaker pattern implementation for self-healing infrastructure.
Prevents cascading failures and provides automatic recovery.
"""

import asyncio
from typing import Callable, Any, Optional, Type, Union, Dict, List
from datetime import datetime, timedelta
from enum import Enum
from functools import wraps
import traceback
from loguru import logger


class CircuitBreakerState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"  # Normal operation
    OPEN = "open"      # Failing, reject calls
    HALF_OPEN = "half_open"  # Testing recovery


class CircuitBreakerError(Exception):
    """Raised when circuit breaker is open."""
    pass


class CircuitBreaker:
    """
    Circuit breaker implementation with async support.
    
    The circuit breaker pattern prevents cascading failures by:
    1. Monitoring failures
    2. Opening the circuit when failures exceed threshold
    3. Rejecting calls when open
    4. Attempting recovery after timeout
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception: Type[Exception] = Exception,
        success_threshold: int = 2,
        name: Optional[str] = None
    ):
        """
        Initialize circuit breaker.
        
        Args:
            failure_threshold: Number of failures before opening
            recovery_timeout: Seconds before attempting recovery
            expected_exception: Exception type to catch
            success_threshold: Successes needed to close from half-open
            name: Optional name for logging
        """
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        self.success_threshold = success_threshold
        self.name = name or "CircuitBreaker"
        
        # State management
        self._state = CircuitBreakerState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: Optional[datetime] = None
        self._last_state_change = datetime.utcnow()
        
        # Metrics
        self.total_calls = 0
        self.total_failures = 0
        self.total_successes = 0
        self.total_rejections = 0
        
        # Lock for thread safety
        self._lock = asyncio.Lock()
    
    @property
    def state(self) -> CircuitBreakerState:
        """Get current state."""
        return self._state
    
    @property
    def is_open(self) -> bool:
        """Check if circuit is open."""
        return self._state == CircuitBreakerState.OPEN
    
    @property
    def is_closed(self) -> bool:
        """Check if circuit is closed."""
        return self._state == CircuitBreakerState.CLOSED
    
    @property
    def failure_count(self) -> int:
        """Get current failure count."""
        return self._failure_count
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self._before_call()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if exc_type is None:
            await self._on_success()
        elif issubclass(exc_type, self.expected_exception):
            await self._on_failure(exc_val)
            return False  # Don't suppress the exception
        # Other exceptions pass through without affecting circuit
        return False
    
    def __call__(self, func: Callable) -> Callable:
        """Decorator for protecting functions."""
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            async with self:
                return await func(*args, **kwargs)
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            # For sync functions, run in event loop
            loop = asyncio.get_event_loop()
            return loop.run_until_complete(async_wrapper(*args, **kwargs))
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """Call function through circuit breaker."""
        async with self:
            if asyncio.iscoroutinefunction(func):
                return await func(*args, **kwargs)
            else:
                # Run sync function in executor
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(None, func, *args, **kwargs)
    
    async def _before_call(self):
        """Check circuit state before call."""
        async with self._lock:
            self.total_calls += 1
            
            # Update state based on timeout
            await self._update_state()
            
            if self._state == CircuitBreakerState.OPEN:
                self.total_rejections += 1
                logger.warning(
                    f"{self.name}: Circuit open, rejecting call "
                    f"(failures: {self._failure_count}/{self.failure_threshold})"
                )
                raise CircuitBreakerError(
                    f"{self.name} is open due to {self._failure_count} failures"
                )
            
            elif self._state == CircuitBreakerState.HALF_OPEN:
                logger.info(f"{self.name}: Circuit half-open, testing call")
    
    async def _on_success(self):
        """Handle successful call."""
        async with self._lock:
            self.total_successes += 1
            
            if self._state == CircuitBreakerState.HALF_OPEN:
                self._success_count += 1
                logger.info(
                    f"{self.name}: Success in half-open state "
                    f"({self._success_count}/{self.success_threshold})"
                )
                
                if self._success_count >= self.success_threshold:
                    await self._close_circuit()
            
            elif self._state == CircuitBreakerState.CLOSED:
                # Reset failure count on success
                self._failure_count = 0
    
    async def _on_failure(self, exception: Exception):
        """Handle failed call."""
        async with self._lock:
            self.total_failures += 1
            self._failure_count += 1
            self._last_failure_time = datetime.utcnow()
            
            logger.error(
                f"{self.name}: Failure {self._failure_count}/{self.failure_threshold} - {exception}"
            )
            
            if self._state == CircuitBreakerState.CLOSED:
                if self._failure_count >= self.failure_threshold:
                    await self._open_circuit()
            
            elif self._state == CircuitBreakerState.HALF_OPEN:
                # Single failure in half-open reopens circuit
                await self._open_circuit()
    
    async def _update_state(self):
        """Update state based on timeout."""
        if self._state == CircuitBreakerState.OPEN:
            if self._last_failure_time:
                time_since_failure = (
                    datetime.utcnow() - self._last_failure_time
                ).total_seconds()
                
                if time_since_failure >= self.recovery_timeout:
                    await self._half_open_circuit()
    
    async def _open_circuit(self):
        """Open the circuit."""
        self._state = CircuitBreakerState.OPEN
        self._last_state_change = datetime.utcnow()
        self._success_count = 0
        
        logger.warning(
            f"{self.name}: Circuit OPENED after {self._failure_count} failures"
        )
        
        # Emit event for monitoring
        await self._emit_state_change("open")
    
    async def _close_circuit(self):
        """Close the circuit."""
        self._state = CircuitBreakerState.CLOSED
        self._last_state_change = datetime.utcnow()
        self._failure_count = 0
        self._success_count = 0
        
        logger.info(f"{self.name}: Circuit CLOSED")
        
        # Emit event for monitoring
        await self._emit_state_change("closed")
    
    async def _half_open_circuit(self):
        """Set circuit to half-open."""
        self._state = CircuitBreakerState.HALF_OPEN
        self._last_state_change = datetime.utcnow()
        self._success_count = 0
        self._failure_count = 0
        
        logger.info(
            f"{self.name}: Circuit HALF-OPEN, testing recovery "
            f"(need {self.success_threshold} successes)"
        )
        
        # Emit event for monitoring
        await self._emit_state_change("half_open")
    
    async def _emit_state_change(self, new_state: str):
        """Emit state change event for monitoring."""
        # This could publish to Kafka, metrics system, etc.
        event = {
            "circuit_breaker": self.name,
            "state": new_state,
            "timestamp": datetime.utcnow().isoformat(),
            "metrics": self.get_metrics()
        }
        logger.debug(f"Circuit breaker state change: {event}")
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get circuit breaker metrics."""
        uptime = (datetime.utcnow() - self._last_state_change).total_seconds()
        
        return {
            "state": self._state.value,
            "failure_count": self._failure_count,
            "success_count": self._success_count,
            "total_calls": self.total_calls,
            "total_failures": self.total_failures,
            "total_successes": self.total_successes,
            "total_rejections": self.total_rejections,
            "success_rate": (
                self.total_successes / self.total_calls 
                if self.total_calls > 0 else 0
            ),
            "uptime_seconds": uptime
        }
    
    async def reset(self):
        """Manually reset circuit breaker."""
        async with self._lock:
            self._state = CircuitBreakerState.CLOSED
            self._failure_count = 0
            self._success_count = 0
            self._last_failure_time = None
            self._last_state_change = datetime.utcnow()
            
            logger.info(f"{self.name}: Circuit manually reset")


class CircuitBreakerManager:
    """Manages multiple circuit breakers."""
    
    def __init__(self):
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        self._lock = asyncio.Lock()
    
    async def get_or_create(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        **kwargs
    ) -> CircuitBreaker:
        """Get existing or create new circuit breaker."""
        async with self._lock:
            if name not in self.circuit_breakers:
                self.circuit_breakers[name] = CircuitBreaker(
                    name=name,
                    failure_threshold=failure_threshold,
                    recovery_timeout=recovery_timeout,
                    **kwargs
                )
            
            return self.circuit_breakers[name]
    
    def get(self, name: str) -> Optional[CircuitBreaker]:
        """Get circuit breaker by name."""
        return self.circuit_breakers.get(name)
    
    async def reset_all(self):
        """Reset all circuit breakers."""
        for cb in self.circuit_breakers.values():
            await cb.reset()
    
    def get_all_metrics(self) -> Dict[str, Dict[str, Any]]:
        """Get metrics for all circuit breakers."""
        return {
            name: cb.get_metrics()
            for name, cb in self.circuit_breakers.items()
        }
    
    def get_open_circuits(self) -> List[str]:
        """Get list of open circuits."""
        return [
            name for name, cb in self.circuit_breakers.items()
            if cb.is_open
        ]


# Global circuit breaker manager
circuit_breaker_manager = CircuitBreakerManager()


# Decorator for easy use
def circuit_breaker(
    name: Optional[str] = None,
    failure_threshold: int = 5,
    recovery_timeout: int = 60,
    expected_exception: Type[Exception] = Exception
):
    """
    Decorator to apply circuit breaker pattern to a function.
    
    Usage:
        @circuit_breaker(name="external_api", failure_threshold=3)
        async def call_external_api():
            ...
    """
    def decorator(func: Callable) -> Callable:
        # Use function name if no name provided
        cb_name = name or f"{func.__module__}.{func.__name__}"
        
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            cb = await circuit_breaker_manager.get_or_create(
                cb_name,
                failure_threshold=failure_threshold,
                recovery_timeout=recovery_timeout,
                expected_exception=expected_exception
            )
            return await cb.call(func, *args, **kwargs)
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            loop = asyncio.get_event_loop()
            return loop.run_until_complete(async_wrapper(*args, **kwargs))
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator
