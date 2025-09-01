"""
Memory Manager - Optimizes memory usage across all services
Implements intelligent garbage collection, memory monitoring, and allocation optimization
"""

import asyncio
import gc
import logging
import time
from typing import Dict, List, Optional, Any, Callable, Set, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
import psutil
import os
import tracemalloc
import weakref
import sys
from collections import defaultdict
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class MemoryThreshold:
    """Memory threshold configuration"""
    warning_percent: float = 70.0
    critical_percent: float = 85.0
    emergency_percent: float = 95.0
    warning_mb: float = 1024.0  # 1GB free
    critical_mb: float = 512.0  # 512MB free
    emergency_mb: float = 256.0  # 256MB free


@dataclass
class MemorySnapshot:
    """Memory usage snapshot"""
    timestamp: datetime
    total_mb: float
    available_mb: float
    used_mb: float
    percent_used: float
    process_mb: float
    gc_stats: Dict[str, Any]
    top_allocations: List[Tuple[str, int]]


class MemoryPool:
    """Memory pool for efficient allocation"""
    
    def __init__(self, name: str, size_mb: float):
        self.name = name
        self.size_mb = size_mb
        self.allocated_mb = 0.0
        self.allocations: Dict[str, float] = {}
        self.lock = asyncio.Lock()
        
    async def allocate(self, key: str, size_mb: float) -> bool:
        """Allocate memory from pool"""
        async with self.lock:
            if self.allocated_mb + size_mb > self.size_mb:
                return False
                
            self.allocations[key] = size_mb
            self.allocated_mb += size_mb
            return True
            
    async def deallocate(self, key: str):
        """Deallocate memory from pool"""
        async with self.lock:
            if key in self.allocations:
                size = self.allocations.pop(key)
                self.allocated_mb -= size
                
    def get_usage(self) -> Dict[str, Any]:
        """Get pool usage statistics"""
        return {
            "name": self.name,
            "total_mb": self.size_mb,
            "allocated_mb": self.allocated_mb,
            "free_mb": self.size_mb - self.allocated_mb,
            "usage_percent": (self.allocated_mb / self.size_mb * 100) if self.size_mb > 0 else 0,
            "allocations": len(self.allocations)
        }


class MemoryManager:
    """
    Intelligent memory manager for system-wide optimization
    """
    
    def __init__(self, thresholds: Optional[MemoryThreshold] = None):
        self.thresholds = thresholds or MemoryThreshold()
        self.memory_pools: Dict[str, MemoryPool] = {}
        self.monitored_objects: weakref.WeakKeyDictionary = weakref.WeakKeyDictionary()
        self.gc_callbacks: List[Callable] = []
        self.memory_history: List[MemorySnapshot] = []
        self.is_monitoring = False
        self.monitor_task: Optional[asyncio.Task] = None
        self.last_gc_time = time.time()
        self.gc_interval = 60.0  # seconds
        self.emergency_mode = False
        
        # Memory allocation tracking
        self.allocation_stats: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "count": 0,
            "total_mb": 0.0,
            "peak_mb": 0.0
        })
        
        # Start tracemalloc for detailed memory tracking
        if not tracemalloc.is_tracing():
            tracemalloc.start(10)  # Keep top 10 frames
            
    def create_memory_pool(self, name: str, size_mb: float) -> MemoryPool:
        """Create a memory pool"""
        pool = MemoryPool(name, size_mb)
        self.memory_pools[name] = pool
        logger.info(f"Created memory pool '{name}' with {size_mb}MB")
        return pool
        
    def track_object(self, obj: Any, name: str):
        """Track an object for memory monitoring"""
        self.monitored_objects[obj] = {
            "name": name,
            "created": datetime.now(),
            "size_mb": self._get_object_size(obj)
        }
        
    def _get_object_size(self, obj: Any) -> float:
        """Estimate object size in MB"""
        try:
            # For numpy arrays
            if hasattr(obj, 'nbytes'):
                return obj.nbytes / (1024 * 1024)
                
            # For collections
            if hasattr(obj, '__len__'):
                # Rough estimate based on length and item size
                length = len(obj)
                if length > 0:
                    # Sample first item
                    first_item = next(iter(obj), None)
                    if first_item:
                        item_size = sys.getsizeof(first_item)
                        return (length * item_size) / (1024 * 1024)
                        
            # Default to getsizeof
            return sys.getsizeof(obj) / (1024 * 1024)
            
        except Exception:
            return 0.0
            
    def register_gc_callback(self, callback: Callable):
        """Register a callback to be called during garbage collection"""
        self.gc_callbacks.append(callback)
        
    async def get_memory_snapshot(self) -> MemorySnapshot:
        """Get current memory snapshot"""
        # System memory
        memory = psutil.virtual_memory()
        
        # Process memory
        process = psutil.Process()
        process_info = process.memory_info()
        
        # GC stats
        gc_stats = {
            "collections": gc.get_count(),
            "collected": gc.collect(0),  # Gen 0 collection
            "uncollectable": len(gc.garbage)
        }
        
        # Top memory allocations
        top_allocations = []
        if tracemalloc.is_tracing():
            snapshot = tracemalloc.take_snapshot()
            top_stats = snapshot.statistics('lineno')[:10]
            
            for stat in top_stats:
                top_allocations.append((
                    f"{stat.traceback.format()[0]}",
                    stat.size // (1024 * 1024)  # MB
                ))
                
        return MemorySnapshot(
            timestamp=datetime.now(),
            total_mb=memory.total / (1024 * 1024),
            available_mb=memory.available / (1024 * 1024),
            used_mb=memory.used / (1024 * 1024),
            percent_used=memory.percent,
            process_mb=process_info.rss / (1024 * 1024),
            gc_stats=gc_stats,
            top_allocations=top_allocations
        )
        
    async def check_memory_status(self) -> str:
        """Check current memory status"""
        snapshot = await self.get_memory_snapshot()
        
        # Check against thresholds
        if snapshot.available_mb < self.thresholds.emergency_mb or \
           snapshot.percent_used > self.thresholds.emergency_percent:
            return "emergency"
        elif snapshot.available_mb < self.thresholds.critical_mb or \
             snapshot.percent_used > self.thresholds.critical_percent:
            return "critical"
        elif snapshot.available_mb < self.thresholds.warning_mb or \
             snapshot.percent_used > self.thresholds.warning_percent:
            return "warning"
        else:
            return "normal"
            
    async def optimize_memory(self, level: str = "normal"):
        """Optimize memory based on current status"""
        logger.info(f"Optimizing memory (level: {level})")
        
        if level == "emergency":
            await self._emergency_gc()
        elif level == "critical":
            await self._aggressive_gc()
        elif level == "warning":
            await self._moderate_gc()
        else:
            await self._routine_gc()
            
    async def _routine_gc(self):
        """Routine garbage collection"""
        # Collect generation 0
        collected = gc.collect(0)
        logger.debug(f"Routine GC collected {collected} objects")
        
    async def _moderate_gc(self):
        """Moderate garbage collection"""
        # Collect all generations
        collected = gc.collect()
        logger.info(f"Moderate GC collected {collected} objects")
        
        # Run callbacks
        for callback in self.gc_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback("moderate")
                else:
                    await asyncio.get_event_loop().run_in_executor(
                        None, callback, "moderate"
                    )
            except Exception as e:
                logger.error(f"GC callback error: {e}")
                
    async def _aggressive_gc(self):
        """Aggressive garbage collection"""
        # Clear caches
        for module in sys.modules.values():
            if hasattr(module, '__dict__'):
                for attr_name in dir(module):
                    attr = getattr(module, attr_name, None)
                    if hasattr(attr, 'cache_clear'):
                        try:
                            attr.cache_clear()
                        except Exception:
                            pass
                            
        # Collect all generations multiple times
        for _ in range(3):
            collected = gc.collect()
            logger.info(f"Aggressive GC pass collected {collected} objects")
            
        # Run callbacks
        for callback in self.gc_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback("aggressive")
                else:
                    await asyncio.get_event_loop().run_in_executor(
                        None, callback, "aggressive"
                    )
            except Exception as e:
                logger.error(f"GC callback error: {e}")
                
    async def _emergency_gc(self):
        """Emergency garbage collection"""
        self.emergency_mode = True
        logger.warning("Entering emergency memory mode")
        
        # Run aggressive GC first
        await self._aggressive_gc()
        
        # Clear all tracked objects that are no longer referenced
        self.monitored_objects = weakref.WeakKeyDictionary()
        
        # Clear memory history
        if len(self.memory_history) > 10:
            self.memory_history = self.memory_history[-10:]
            
        # Force collection of all garbage
        gc.collect()
        gc.collect()  # Second pass to catch circular references
        
        # Run emergency callbacks
        for callback in self.gc_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback("emergency")
                else:
                    await asyncio.get_event_loop().run_in_executor(
                        None, callback, "emergency"
                    )
            except Exception as e:
                logger.error(f"Emergency GC callback error: {e}")
                
        logger.warning("Emergency GC complete")
        
    async def start_monitoring(self, interval: float = 10.0):
        """Start memory monitoring"""
        if self.is_monitoring:
            logger.warning("Memory monitoring already started")
            return
            
        self.is_monitoring = True
        self.monitor_task = asyncio.create_task(self._monitor_loop(interval))
        logger.info(f"Started memory monitoring (interval: {interval}s)")
        
    async def _monitor_loop(self, interval: float):
        """Memory monitoring loop"""
        while self.is_monitoring:
            try:
                # Get memory snapshot
                snapshot = await self.get_memory_snapshot()
                self.memory_history.append(snapshot)
                
                # Keep only recent history
                max_history = 100
                if len(self.memory_history) > max_history:
                    self.memory_history = self.memory_history[-max_history:]
                    
                # Check memory status
                status = await self.check_memory_status()
                
                # Log if not normal
                if status != "normal":
                    logger.warning(
                        f"Memory {status}: {snapshot.percent_used:.1f}% used, "
                        f"{snapshot.available_mb:.1f}MB available"
                    )
                    
                # Optimize if needed
                if status in ["warning", "critical", "emergency"]:
                    await self.optimize_memory(status)
                    
                # Periodic GC
                if time.time() - self.last_gc_time > self.gc_interval:
                    await self._routine_gc()
                    self.last_gc_time = time.time()
                    
                # Check for memory leaks
                await self._check_memory_leaks()
                
            except Exception as e:
                logger.error(f"Memory monitoring error: {e}")
                
            await asyncio.sleep(interval)
            
    async def _check_memory_leaks(self):
        """Check for potential memory leaks"""
        if len(self.memory_history) < 10:
            return
            
        # Check if memory usage is consistently increasing
        recent_history = self.memory_history[-10:]
        memory_trend = [h.process_mb for h in recent_history]
        
        # Simple trend detection
        if all(memory_trend[i] <= memory_trend[i+1] for i in range(len(memory_trend)-1)):
            increase = memory_trend[-1] - memory_trend[0]
            if increase > 100:  # 100MB increase
                logger.warning(
                    f"Potential memory leak detected: "
                    f"{increase:.1f}MB increase over {len(memory_trend)} samples"
                )
                
    async def stop_monitoring(self):
        """Stop memory monitoring"""
        self.is_monitoring = False
        
        if self.monitor_task and not self.monitor_task.done():
            self.monitor_task.cancel()
            try:
                await self.monitor_task
            except asyncio.CancelledError:
                pass
                
        logger.info("Memory monitoring stopped")
        
    def get_stats(self) -> Dict[str, Any]:
        """Get memory manager statistics"""
        current_snapshot = None
        if self.memory_history:
            current_snapshot = self.memory_history[-1]
            
        return {
            "monitoring": self.is_monitoring,
            "emergency_mode": self.emergency_mode,
            "memory_pools": {
                name: pool.get_usage()
                for name, pool in self.memory_pools.items()
            },
            "tracked_objects": len(self.monitored_objects),
            "gc_callbacks": len(self.gc_callbacks),
            "history_size": len(self.memory_history),
            "current_memory": {
                "total_mb": current_snapshot.total_mb if current_snapshot else 0,
                "available_mb": current_snapshot.available_mb if current_snapshot else 0,
                "used_percent": current_snapshot.percent_used if current_snapshot else 0,
                "process_mb": current_snapshot.process_mb if current_snapshot else 0
            } if current_snapshot else None,
            "thresholds": {
                "warning_percent": self.thresholds.warning_percent,
                "critical_percent": self.thresholds.critical_percent,
                "emergency_percent": self.thresholds.emergency_percent
            }
        }
        
    def get_memory_report(self) -> str:
        """Generate a detailed memory report"""
        report = ["=== Memory Report ==="]
        
        # Current memory status
        if self.memory_history:
            latest = self.memory_history[-1]
            report.append(f"\nSystem Memory:")
            report.append(f"  Total: {latest.total_mb:.1f}MB")
            report.append(f"  Available: {latest.available_mb:.1f}MB")
            report.append(f"  Used: {latest.percent_used:.1f}%")
            report.append(f"\nProcess Memory: {latest.process_mb:.1f}MB")
            
            # Top allocations
            if latest.top_allocations:
                report.append(f"\nTop Memory Allocations:")
                for location, size_mb in latest.top_allocations[:5]:
                    report.append(f"  {size_mb}MB - {location}")
                    
        # Memory pools
        if self.memory_pools:
            report.append(f"\nMemory Pools:")
            for name, pool in self.memory_pools.items():
                usage = pool.get_usage()
                report.append(
                    f"  {name}: {usage['allocated_mb']:.1f}/{usage['total_mb']:.1f}MB "
                    f"({usage['usage_percent']:.1f}%)"
                )
                
        # Tracked objects
        if self.monitored_objects:
            report.append(f"\nTracked Objects: {len(self.monitored_objects)}")
            
        return "\n".join(report)


# Global instance
_memory_manager: Optional[MemoryManager] = None


def get_memory_manager() -> MemoryManager:
    """Get or create the global MemoryManager instance"""
    global _memory_manager
    if _memory_manager is None:
        _memory_manager = MemoryManager()
    return _memory_manager


# Example usage
if __name__ == "__main__":
    async def example_gc_callback(level: str):
        """Example garbage collection callback"""
        logger.info(f"GC callback triggered at level: {level}")
        
        # Perform service-specific cleanup based on level
        if level == "emergency":
            # Clear all caches, close non-essential connections, etc.
            logger.info("Performing emergency cleanup")
        elif level == "aggressive":
            # Clear old cache entries, reduce pool sizes, etc.
            logger.info("Performing aggressive cleanup")
            
    async def main():
        manager = get_memory_manager()
        
        # Register GC callback
        manager.register_gc_callback(example_gc_callback)
        
        # Create memory pools
        model_pool = manager.create_memory_pool("models", 4096)  # 4GB for models
        cache_pool = manager.create_memory_pool("cache", 1024)   # 1GB for cache
        
        # Start monitoring
        await manager.start_monitoring(interval=5.0)
        
        # Simulate memory allocation
        await model_pool.allocate("model1", 512)
        await model_pool.allocate("model2", 256)
        await cache_pool.allocate("cache1", 128)
        
        # Track some objects
        large_array = np.zeros((1000, 1000))  # ~8MB
        manager.track_object(large_array, "large_array")
        
        # Run for a bit
        await asyncio.sleep(15)
        
        # Get stats
        stats = manager.get_stats()
        print(f"Memory stats: {stats}")
        
        # Generate report
        report = manager.get_memory_report()
        print(f"\n{report}")
        
        # Stop monitoring
        await manager.stop_monitoring()
        
    asyncio.run(main())
