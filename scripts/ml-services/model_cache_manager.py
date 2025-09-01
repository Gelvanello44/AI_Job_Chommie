"""
Model Cache Manager - Manages model memory efficiently
Implements model sharing between services and intelligent cache eviction
"""

import asyncio
import threading
from typing import Dict, List, Optional, Any, Tuple, Set
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import torch
from transformers import AutoModel, AutoTokenizer, PreTrainedModel, PreTrainedTokenizer
import logging
import psutil
import gc
from pathlib import Path
import json
import heapq
from contextlib import contextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ModelType(Enum):
    """Types of models that can be cached"""
    TRANSFORMER = "transformer"
    SENTENCE_TRANSFORMER = "sentence_transformer"
    PIPELINE = "pipeline"
    CUSTOM = "custom"


@dataclass
class ModelEntry:
    """Entry in the model cache"""
    model_name: str
    model_type: ModelType
    model: Any
    tokenizer: Optional[Any]
    size_mb: float
    last_accessed: datetime
    access_count: int = 0
    load_time_seconds: float = 0.0
    device: str = "cpu"
    shared_count: int = 0  # Number of services sharing this model


class ModelCacheManager:
    """
    Manages model memory efficiently with sharing between services
    """
    
    def __init__(self, 
                 max_cache_size_mb: float = 8192,
                 min_free_memory_mb: float = 2048,
                 eviction_policy: str = "lru"):
        self.cache: Dict[str, ModelEntry] = {}
        self.cache_lock = threading.RLock()
        self.max_cache_size_mb = max_cache_size_mb
        self.min_free_memory_mb = min_free_memory_mb
        self.eviction_policy = eviction_policy
        self.loading_models: Set[str] = set()
        self.model_locks: Dict[str, threading.Lock] = {}
        self.cache_hits = 0
        self.cache_misses = 0
        self.total_evictions = 0
        
        # Model pools for reuse
        self.model_pools: Dict[str, List[ModelEntry]] = {}
        
        # Start background memory monitoring
        self._monitoring_task: Optional[asyncio.Task] = None
        self._shutdown_event = asyncio.Event()
        
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self.cache_lock:
            total_size = sum(entry.size_mb for entry in self.cache.values())
            hit_rate = self.cache_hits / (self.cache_hits + self.cache_misses) if (self.cache_hits + self.cache_misses) > 0 else 0
            
            return {
                "cache_size_mb": total_size,
                "max_cache_size_mb": self.max_cache_size_mb,
                "num_models": len(self.cache),
                "cache_hits": self.cache_hits,
                "cache_misses": self.cache_misses,
                "hit_rate": hit_rate,
                "total_evictions": self.total_evictions,
                "models": {
                    name: {
                        "size_mb": entry.size_mb,
                        "access_count": entry.access_count,
                        "last_accessed": entry.last_accessed.isoformat(),
                        "shared_count": entry.shared_count,
                        "device": entry.device
                    }
                    for name, entry in self.cache.items()
                }
            }
            
    def _estimate_model_size(self, model: Any) -> float:
        """Estimate model size in MB"""
        try:
            # For PyTorch models
            if hasattr(model, 'parameters'):
                total_params = sum(p.numel() * p.element_size() for p in model.parameters())
                return total_params / (1024 * 1024)
            
            # For other objects, use a rough estimate based on object size
            import sys
            return sys.getsizeof(model) / (1024 * 1024)
        except:
            return 500.0  # Default estimate
            
    def _get_available_memory(self) -> float:
        """Get available system memory in MB"""
        memory = psutil.virtual_memory()
        return memory.available / (1024 * 1024)
        
    def _get_gpu_memory(self) -> Optional[Tuple[float, float]]:
        """Get GPU memory usage (used_mb, total_mb)"""
        if torch.cuda.is_available():
            try:
                used = torch.cuda.memory_allocated() / (1024 * 1024)
                total = torch.cuda.get_device_properties(0).total_memory / (1024 * 1024)
                return (used, total)
            except:
                pass
        return None
        
    async def get_model(self, 
                       model_name: str,
                       model_type: ModelType = ModelType.TRANSFORMER,
                       device: Optional[str] = None,
                       load_func: Optional[callable] = None) -> Tuple[Any, Optional[Any]]:
        """
        Get a model from cache or load it
        
        Returns:
            Tuple[model, tokenizer]
        """
        # Determine device
        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
            
        cache_key = f"{model_name}:{device}"
        
        # Check cache first
        with self.cache_lock:
            if cache_key in self.cache:
                entry = self.cache[cache_key]
                entry.last_accessed = datetime.now()
                entry.access_count += 1
                entry.shared_count += 1
                self.cache_hits += 1
                logger.info(f"Cache hit for model: {model_name} (device: {device})")
                return entry.model, entry.tokenizer
                
        # Cache miss - need to load
        self.cache_misses += 1
        
        # Ensure we're not already loading this model
        async with self._get_model_lock(cache_key):
            # Double-check cache after acquiring lock
            with self.cache_lock:
                if cache_key in self.cache:
                    entry = self.cache[cache_key]
                    entry.last_accessed = datetime.now()
                    entry.access_count += 1
                    entry.shared_count += 1
                    return entry.model, entry.tokenizer
                    
            # Load the model
            logger.info(f"Loading model: {model_name} to {device}")
            start_time = datetime.now()
            
            try:
                if load_func:
                    # Use custom load function
                    model, tokenizer = await self._load_with_custom_func(load_func)
                else:
                    # Use default loading based on model type
                    model, tokenizer = await self._load_default(model_name, model_type, device)
                    
                # Estimate model size
                size_mb = self._estimate_model_size(model)
                
                # Check if we need to evict models
                await self._ensure_cache_space(size_mb)
                
                # Create cache entry
                entry = ModelEntry(
                    model_name=model_name,
                    model_type=model_type,
                    model=model,
                    tokenizer=tokenizer,
                    size_mb=size_mb,
                    last_accessed=datetime.now(),
                    access_count=1,
                    load_time_seconds=(datetime.now() - start_time).total_seconds(),
                    device=device,
                    shared_count=1
                )
                
                # Add to cache
                with self.cache_lock:
                    self.cache[cache_key] = entry
                    
                logger.info(
                    f"Model {model_name} loaded successfully in {entry.load_time_seconds:.2f}s "
                    f"(size: {size_mb:.1f}MB, device: {device})"
                )
                
                return model, tokenizer
                
            except Exception as e:
                logger.error(f"Failed to load model {model_name}: {e}")
                raise
                
    async def _load_with_custom_func(self, load_func: callable) -> Tuple[Any, Optional[Any]]:
        """Load model using custom function"""
        loop = asyncio.get_event_loop()
        
        if asyncio.iscoroutinefunction(load_func):
            result = await load_func()
        else:
            result = await loop.run_in_executor(None, load_func)
            
        # Handle different return formats
        if isinstance(result, tuple) and len(result) == 2:
            return result
        else:
            return result, None
            
    async def _load_default(self, 
                           model_name: str, 
                           model_type: ModelType,
                           device: str) -> Tuple[Any, Optional[Any]]:
        """Default model loading logic"""
        loop = asyncio.get_event_loop()
        
        def _load_sync():
            if model_type == ModelType.TRANSFORMER:
                tokenizer = AutoTokenizer.from_pretrained(model_name)
                model = AutoModel.from_pretrained(
                    model_name,
                    torch_dtype=torch.float16 if device == "cuda" else torch.float32
                )
                if device == "cuda":
                    model = model.cuda()
                return model, tokenizer
                
            elif model_type == ModelType.SENTENCE_TRANSFORMER:
                from sentence_transformers import SentenceTransformer
                model = SentenceTransformer(model_name, device=device)
                return model, None
                
            else:
                raise ValueError(f"Unsupported model type: {model_type}")
                
        return await loop.run_in_executor(None, _load_sync)
        
    @contextmanager
    async def _get_model_lock(self, cache_key: str):
        """Get or create a lock for a specific model"""
        if cache_key not in self.model_locks:
            self.model_locks[cache_key] = threading.Lock()
            
        lock = self.model_locks[cache_key]
        lock.acquire()
        try:
            yield
        finally:
            lock.release()
            
    async def _ensure_cache_space(self, required_mb: float):
        """Ensure there's enough space in cache for new model"""
        with self.cache_lock:
            current_size = sum(entry.size_mb for entry in self.cache.values())
            available_memory = self._get_available_memory()
            
            # Check if we need to evict
            need_to_free = 0.0
            
            # Check cache size limit
            if current_size + required_mb > self.max_cache_size_mb:
                need_to_free = max(need_to_free, (current_size + required_mb) - self.max_cache_size_mb)
                
            # Check system memory
            if available_memory - required_mb < self.min_free_memory_mb:
                need_to_free = max(need_to_free, self.min_free_memory_mb - (available_memory - required_mb))
                
            if need_to_free > 0:
                await self._evict_models(need_to_free)
                
    async def _evict_models(self, target_mb: float):
        """Evict models based on policy"""
        logger.info(f"Evicting models to free {target_mb:.1f}MB")
        
        with self.cache_lock:
            if self.eviction_policy == "lru":
                # Sort by last accessed time (oldest first) and shared count
                candidates = sorted(
                    self.cache.items(),
                    key=lambda x: (x[1].shared_count, x[1].last_accessed)
                )
            elif self.eviction_policy == "lfu":
                # Sort by access count (least frequently used first)
                candidates = sorted(
                    self.cache.items(),
                    key=lambda x: (x[1].shared_count, x[1].access_count)
                )
            else:
                raise ValueError(f"Unknown eviction policy: {self.eviction_policy}")
                
            freed_mb = 0.0
            evicted = []
            
            for cache_key, entry in candidates:
                if entry.shared_count > 0:
                    continue  # Skip models currently in use
                    
                if freed_mb >= target_mb:
                    break
                    
                # Evict the model
                del self.cache[cache_key]
                evicted.append(entry.model_name)
                freed_mb += entry.size_mb
                self.total_evictions += 1
                
                # Clean up GPU memory if applicable
                if entry.device == "cuda" and hasattr(entry.model, 'to'):
                    entry.model.cpu()
                    del entry.model
                    if entry.tokenizer:
                        del entry.tokenizer
                    torch.cuda.empty_cache()
                    
            # Force garbage collection
            gc.collect()
            
            logger.info(f"Evicted {len(evicted)} models, freed {freed_mb:.1f}MB: {evicted}")
            
    def release_model(self, model_name: str, device: str = None):
        """Release a model reference (decrement shared count)"""
        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
            
        cache_key = f"{model_name}:{device}"
        
        with self.cache_lock:
            if cache_key in self.cache:
                entry = self.cache[cache_key]
                entry.shared_count = max(0, entry.shared_count - 1)
                
    async def preload_models(self, model_configs: List[Dict[str, Any]]):
        """Preload multiple models"""
        tasks = []
        
        for config in model_configs:
            task = asyncio.create_task(
                self.get_model(
                    model_name=config["name"],
                    model_type=ModelType[config.get("type", "TRANSFORMER")],
                    device=config.get("device"),
                    load_func=config.get("load_func")
                )
            )
            tasks.append(task)
            
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        successful = sum(1 for r in results if not isinstance(r, Exception))
        logger.info(f"Preloaded {successful}/{len(model_configs)} models")
        
    async def start_monitoring(self):
        """Start background memory monitoring"""
        if self._monitoring_task is None:
            self._monitoring_task = asyncio.create_task(self._monitor_memory())
            
    async def _monitor_memory(self):
        """Monitor memory usage and trigger evictions if needed"""
        while not self._shutdown_event.is_set():
            try:
                await asyncio.sleep(10)  # Check every 10 seconds
                
                available_memory = self._get_available_memory()
                
                if available_memory < self.min_free_memory_mb:
                    logger.warning(
                        f"Low memory detected: {available_memory:.1f}MB available "
                        f"(minimum: {self.min_free_memory_mb}MB)"
                    )
                    
                    # Calculate how much to free
                    to_free = self.min_free_memory_mb - available_memory + 512  # Extra buffer
                    await self._evict_models(to_free)
                    
                # Check GPU memory if available
                gpu_info = self._get_gpu_memory()
                if gpu_info:
                    used_gpu, total_gpu = gpu_info
                    gpu_usage_percent = (used_gpu / total_gpu) * 100
                    
                    if gpu_usage_percent > 90:
                        logger.warning(f"High GPU memory usage: {gpu_usage_percent:.1f}%")
                        
            except Exception as e:
                logger.error(f"Error in memory monitoring: {e}")
                
    async def clear_cache(self):
        """Clear all cached models"""
        with self.cache_lock:
            for entry in self.cache.values():
                if entry.device == "cuda" and hasattr(entry.model, 'to'):
                    entry.model.cpu()
                    
            self.cache.clear()
            self.cache_hits = 0
            self.cache_misses = 0
            
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
        logger.info("Model cache cleared")
        
    async def shutdown(self):
        """Shutdown cache manager and cleanup resources"""
        self._shutdown_event.set()
        
        if self._monitoring_task:
            await self._monitoring_task
            
        await self.clear_cache()
        logger.info("Model cache manager shutdown complete")


# Global instance
_cache_manager: Optional[ModelCacheManager] = None


def get_model_cache_manager() -> ModelCacheManager:
    """Get or create the global ModelCacheManager instance"""
    global _cache_manager
    if _cache_manager is None:
        _cache_manager = ModelCacheManager()
    return _cache_manager


# Example usage
if __name__ == "__main__":
    async def main():
        # Get cache manager
        cache_manager = get_model_cache_manager()
        
        # Start monitoring
        await cache_manager.start_monitoring()
        
        # Load a model
        model, tokenizer = await cache_manager.get_model(
            "sentence-transformers/all-MiniLM-L6-v2",
            ModelType.SENTENCE_TRANSFORMER
        )
        print(f"Model loaded: {model is not None}")
        
        # Get cache stats
        stats = cache_manager.get_cache_stats()
        print(f"Cache stats: {json.dumps(stats, indent=2)}")
        
        # Release model
        cache_manager.release_model("sentence-transformers/all-MiniLM-L6-v2")
        
        # Shutdown
        await cache_manager.shutdown()
        
    asyncio.run(main())
