"""
Model Cache Manager for Efficient Memory Management
Implements model sharing and intelligent caching across services
"""

import os
import time
import threading
import logging
from typing import Dict, Any, Optional, List, Tuple
from collections import OrderedDict
from contextlib import contextmanager
import psutil
import torch
import pickle
import hashlib
from pathlib import Path

logger = logging.getLogger(__name__)

class ModelCacheManager:
    """
    Manages model caching with intelligent eviction and sharing
    """
    
    def __init__(self, 
                 cache_dir: str = "./model_cache",
                 max_memory_gb: float = 8.0,
                 max_disk_cache_gb: float = 20.0):
        """
        Initialize model cache manager
        
        Args:
            cache_dir: Directory for disk cache
            max_memory_gb: Maximum memory usage in GB
            max_disk_cache_gb: Maximum disk cache size in GB
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        
        self.max_memory_bytes = max_memory_gb * 1024 * 1024 * 1024
        self.max_disk_cache_bytes = max_disk_cache_gb * 1024 * 1024 * 1024
        
        # Memory cache with LRU eviction
        self.memory_cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self.cache_lock = threading.RLock()
        
        # Model metadata
        self.model_sizes: Dict[str, int] = {}
        self.model_access_count: Dict[str, int] = {}
        self.model_last_access: Dict[str, float] = {}
        self.model_load_times: Dict[str, float] = {}
        
        # Model pool for sharing
        self.model_pool: Dict[str, Any] = {}
        self.model_refs: Dict[str, int] = {}
        
        self._clean_disk_cache()
        
    def _get_cache_key(self, model_id: str, model_version: str = "latest") -> str:
        """Generate a unique cache key for a model"""
        return f"{model_id}_{model_version}"
        
    def _get_model_size(self, model: Any) -> int:
        """Estimate model size in bytes"""
        try:
            # For PyTorch models
            if hasattr(model, 'state_dict'):
                param_size = sum(
                    p.nelement() * p.element_size() 
                    for p in model.parameters()
                )
                buffer_size = sum(
                    b.nelement() * b.element_size() 
                    for b in model.buffers()
                )
                return param_size + buffer_size
            
            # For transformers pipelines
            if hasattr(model, 'model'):
                return self._get_model_size(model.model)
                
            # Fallback: estimate using pickle
            import io
            buffer = io.BytesIO()
            pickle.dump(model, buffer)
            return buffer.tell()
            
        except Exception as e:
            logger.warning(f"Could not estimate model size: {str(e)}")
            return 1024 * 1024 * 100  # Default 100MB
            
    def _get_current_memory_usage(self) -> int:
        """Get current cache memory usage in bytes"""
        with self.cache_lock:
            return sum(
                self.model_sizes.get(key, 0) 
                for key in self.memory_cache
            )
            
    def _evict_lru_model(self):
        """Evict least recently used model from memory"""
        with self.cache_lock:
            if not self.memory_cache:
                return
                
            # Find LRU model
            lru_key = next(iter(self.memory_cache))
            
            # Check if model is in use
            if self.model_refs.get(lru_key, 0) > 0:
                # Find next available model
                for key in self.memory_cache:
                    if self.model_refs.get(key, 0) == 0:
                        lru_key = key
                        break
                else:
                    logger.warning("All models are in use, cannot evict")
                    return
                    
            logger.info(f"Evicting model {lru_key} from memory cache")
            
            # Save to disk cache before evicting
            self._save_to_disk(lru_key, self.memory_cache[lru_key])
            
            # Remove from memory
            del self.memory_cache[lru_key]
            if lru_key in self.model_pool:
                del self.model_pool[lru_key]
                
            # Force garbage collection
            import gc
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                
    def _ensure_memory_available(self, required_bytes: int):
        """Ensure enough memory is available for a new model"""
        current_usage = self._get_current_memory_usage()
        
        while current_usage + required_bytes > self.max_memory_bytes:
            if not self.memory_cache:
                break
            self._evict_lru_model()
            current_usage = self._get_current_memory_usage()
            
    def cache_model(self, 
                   model_id: str, 
                   model: Any,
                   tokenizer: Any = None,
                   model_version: str = "latest",
                   metadata: Dict[str, Any] = None) -> str:
        """
        Cache a model in memory and optionally disk
        
        Args:
            model_id: Unique identifier for the model
            model: The model object to cache
            tokenizer: Optional tokenizer to cache with model
            model_version: Model version
            metadata: Additional metadata to store
            
        Returns:
            Cache key for the model
        """
        cache_key = self._get_cache_key(model_id, model_version)
        
        with self.cache_lock:
            # Estimate model size
            model_size = self._get_model_size(model)
            self.model_sizes[cache_key] = model_size
            
            # Ensure memory available
            self._ensure_memory_available(model_size)
            
            # Create cache entry
            cache_entry = {
                "model": model,
                "tokenizer": tokenizer,
                "metadata": metadata or {},
                "cached_at": time.time(),
                "model_id": model_id,
                "version": model_version
            }
            
            # Add to memory cache (move to end for LRU)
            if cache_key in self.memory_cache:
                self.memory_cache.move_to_end(cache_key)
            else:
                self.memory_cache[cache_key] = cache_entry
                
            # Add to model pool for sharing
            self.model_pool[cache_key] = model
            self.model_refs[cache_key] = 0
            
            # Update metadata
            self.model_access_count[cache_key] = 0
            self.model_last_access[cache_key] = time.time()
            
            logger.info(f"Cached model {cache_key} ({model_size / 1024 / 1024:.1f} MB)")
            
        return cache_key
        
    @contextmanager
    def get_model(self, 
                  model_id: str, 
                  model_version: str = "latest",
                  load_func: Optional[callable] = None):
        """
        Get a model from cache with reference counting
        
        Args:
            model_id: Model identifier
            model_version: Model version
            load_func: Function to load model if not cached
            
        Yields:
            Model and tokenizer tuple
        """
        cache_key = self._get_cache_key(model_id, model_version)
        
        model = None
        tokenizer = None
        
        try:
            with self.cache_lock:
                # Check memory cache
                if cache_key in self.memory_cache:
                    # Move to end for LRU
                    self.memory_cache.move_to_end(cache_key)
                    cache_entry = self.memory_cache[cache_key]
                    
                else:
                    # Check disk cache
                    cache_entry = self._load_from_disk(cache_key)
                    
                    if cache_entry is None and load_func:
                        # Load model using provided function
                        logger.info(f"Loading model {cache_key} using load function")
                        model_data = load_func(model_id, model_version)
                        
                        if isinstance(model_data, tuple):
                            model, tokenizer = model_data
                        else:
                            model = model_data
                            
                        # Cache the loaded model
                        self.cache_model(
                            model_id, 
                            model, 
                            tokenizer, 
                            model_version
                        )
                        
                        cache_entry = self.memory_cache[cache_key]
                        
                    elif cache_entry is None:
                        raise ValueError(f"Model {cache_key} not found in cache")
                        
                # Update access metadata
                self.model_refs[cache_key] = self.model_refs.get(cache_key, 0) + 1
                self.model_access_count[cache_key] += 1
                self.model_last_access[cache_key] = time.time()
                
                model = cache_entry["model"]
                tokenizer = cache_entry.get("tokenizer")
                
            yield (model, tokenizer)
            
        finally:
            # Decrement reference count
            with self.cache_lock:
                if cache_key in self.model_refs:
                    self.model_refs[cache_key] = max(0, self.model_refs[cache_key] - 1)
                    
    def _save_to_disk(self, cache_key: str, cache_entry: Dict[str, Any]):
        """Save model to disk cache"""
        try:
            # Check disk cache size
            self._clean_disk_cache()
            
            cache_path = self.cache_dir / f"{cache_key}.pkl"
            
            # Save model state dict for PyTorch models
            if hasattr(cache_entry["model"], "save_pretrained"):
                model_dir = self.cache_dir / f"{cache_key}_model"
                cache_entry["model"].save_pretrained(model_dir)
                
                if cache_entry.get("tokenizer"):
                    tokenizer_dir = self.cache_dir / f"{cache_key}_tokenizer"
                    cache_entry["tokenizer"].save_pretrained(tokenizer_dir)
                    
                # Save metadata
                metadata = {
                    "model_dir": str(model_dir),
                    "tokenizer_dir": str(tokenizer_dir) if cache_entry.get("tokenizer") else None,
                    "metadata": cache_entry.get("metadata", {}),
                    "cached_at": cache_entry.get("cached_at", time.time())
                }
                
                with open(cache_path, "wb") as f:
                    pickle.dump(metadata, f)
                    
            else:
                # Fallback to pickle
                with open(cache_path, "wb") as f:
                    pickle.dump(cache_entry, f)
                    
            logger.info(f"Saved model {cache_key} to disk cache")
            
        except Exception as e:
            logger.error(f"Failed to save model to disk: {str(e)}")
            
    def _load_from_disk(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Load model from disk cache"""
        cache_path = self.cache_dir / f"{cache_key}.pkl"
        
        if not cache_path.exists():
            return None
            
        try:
            with open(cache_path, "rb") as f:
                data = pickle.load(f)
                
            if isinstance(data, dict) and "model_dir" in data:
                # Load transformers model
                from transformers import AutoModel, AutoTokenizer
                
                model = AutoModel.from_pretrained(data["model_dir"])
                tokenizer = None
                
                if data.get("tokenizer_dir"):
                    tokenizer = AutoTokenizer.from_pretrained(data["tokenizer_dir"])
                    
                cache_entry = {
                    "model": model,
                    "tokenizer": tokenizer,
                    "metadata": data.get("metadata", {}),
                    "cached_at": data.get("cached_at", time.time())
                }
                
            else:
                cache_entry = data
                
            logger.info(f"Loaded model {cache_key} from disk cache")
            
            # Add back to memory cache
            model_size = self._get_model_size(cache_entry["model"])
            self._ensure_memory_available(model_size)
            
            self.memory_cache[cache_key] = cache_entry
            self.model_sizes[cache_key] = model_size
            
            return cache_entry
            
        except Exception as e:
            logger.error(f"Failed to load model from disk: {str(e)}")
            return None
            
    def _clean_disk_cache(self):
        """Clean disk cache to stay within size limits"""
        try:
            cache_files = list(self.cache_dir.glob("*"))
            total_size = sum(f.stat().st_size for f in cache_files if f.is_file())
            
            if total_size > self.max_disk_cache_bytes:
                # Sort by modification time
                cache_files.sort(key=lambda f: f.stat().st_mtime)
                
                # Remove oldest files
                for file in cache_files:
                    if total_size <= self.max_disk_cache_bytes:
                        break
                        
                    file_size = file.stat().st_size
                    file.unlink()
                    total_size -= file_size
                    
                    logger.info(f"Removed {file.name} from disk cache")
                    
        except Exception as e:
            logger.error(f"Error cleaning disk cache: {str(e)}")
            
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self.cache_lock:
            memory_usage = self._get_current_memory_usage()
            
            stats = {
                "memory_cache_size": len(self.memory_cache),
                "memory_usage_mb": memory_usage / 1024 / 1024,
                "memory_usage_percent": (memory_usage / self.max_memory_bytes) * 100,
                "models_in_use": sum(1 for refs in self.model_refs.values() if refs > 0),
                "total_access_count": sum(self.model_access_count.values()),
                "cached_models": []
            }
            
            for key in self.memory_cache:
                stats["cached_models"].append({
                    "model_id": key,
                    "size_mb": self.model_sizes.get(key, 0) / 1024 / 1024,
                    "access_count": self.model_access_count.get(key, 0),
                    "in_use": self.model_refs.get(key, 0) > 0,
                    "last_access": time.time() - self.model_last_access.get(key, time.time())
                })
                
        return stats
        
    def clear_cache(self):
        """Clear all caches"""
        with self.cache_lock:
            # Check for models in use
            if any(refs > 0 for refs in self.model_refs.values()):
                logger.warning("Cannot clear cache: models are in use")
                return False
                
            self.memory_cache.clear()
            self.model_pool.clear()
            self.model_refs.clear()
            self.model_sizes.clear()
            self.model_access_count.clear()
            self.model_last_access.clear()
            
            # Force garbage collection
            import gc
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                
            logger.info("Cache cleared successfully")
            return True

# Singleton instance
_model_cache_manager = None

def get_model_cache_manager() -> ModelCacheManager:
    """Get the singleton model cache manager instance"""
    global _model_cache_manager
    if _model_cache_manager is None:
        _model_cache_manager = ModelCacheManager()
    return _model_cache_manager
