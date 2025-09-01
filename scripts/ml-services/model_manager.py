"""
High-Performance Model Manager for Local AI Processing
Leverages full capabilities of downloaded models with concurrent processing
"""

import os
import json
import logging
import threading
from typing import Dict, Any, Optional, List, Tuple
from concurrent.futures import ThreadPoolExecutor, Future
from datetime import datetime
import time
import psutil
from transformers import (
    AutoModel, AutoTokenizer, AutoModelForSequenceClassification,
    pipeline, Pipeline
)
from sentence_transformers import SentenceTransformer
import torch
import numpy as np
from collections import OrderedDict
import hashlib

logger = logging.getLogger(__name__)


class ModelManager:
    """
    High-performance model manager with concurrent model support,
    intelligent caching, and optimized for maximum throughput
    """
    
    def __init__(self, model_cache_dir: str = "./models", max_workers: int = 4):
        """Initialize ModelManager with full power configuration"""
        self.model_cache_dir = model_cache_dir
        self.loaded_models: Dict[str, Any] = {}
        self.model_locks: Dict[str, threading.Lock] = {}
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.performance_stats: Dict[str, Dict] = {}
        
        # Model loading futures for concurrent loading
        self.loading_futures: Dict[str, Future] = {}
        
        # Cache for model outputs
        self.inference_cache = OrderedDict()
        self.max_cache_size = 10000  # Large cache for frequent requests
        
        # Performance optimization settings
        self.enable_concurrent_loading = True
        self.enable_aggressive_caching = True
        self.enable_batch_optimization = True
        
        # CPU optimization for i3 processor
        self.cpu_threads = min(4, psutil.cpu_count(logical=True))
        torch.set_num_threads(self.cpu_threads)
        
        # Create cache directory
        os.makedirs(model_cache_dir, exist_ok=True)
        
        logger.info(f"ModelManager initialized with {self.cpu_threads} CPU threads")
        logger.info(f"Cache directory: {self.model_cache_dir}")
        logger.info("Full-power mode enabled with concurrent processing")
    
    def preload_models(self, model_configs: List[Dict[str, Any]]) -> Dict[str, Future]:
        """Preload multiple models concurrently for instant access"""
        logger.info(f"Preloading {len(model_configs)} models concurrently...")
        
        futures = {}
        for config in model_configs:
            model_name = config.get("model_name")
            model_type = config.get("model_type", "transformer")
            
            if model_name and model_name not in self.loaded_models:
                future = self.executor.submit(
                    self._load_model_internal,
                    model_name,
                    model_type,
                    config
                )
                self.loading_futures[model_name] = future
                futures[model_name] = future
        
        return futures
    
    def load_model(self, model_name: str, model_type: str = "transformer", 
                   config: Optional[Dict] = None) -> Any:
        """Load model with caching and concurrent support"""
        # Check if model is already loaded
        if model_name in self.loaded_models:
            logger.info(f"Model {model_name} already loaded, returning cached instance")
            return self.loaded_models[model_name]
        
        # Check if model is currently being loaded
        if model_name in self.loading_futures:
            logger.info(f"Model {model_name} is being loaded, waiting for completion...")
            future = self.loading_futures[model_name]
            return future.result()
        
        # Load model
        return self._load_model_internal(model_name, model_type, config)
    
    def _load_model_internal(self, model_name: str, model_type: str, 
                           config: Optional[Dict] = None) -> Any:
        """Internal method to load model with proper locking"""
        # Create lock for this model if it doesn't exist
        if model_name not in self.model_locks:
            self.model_locks[model_name] = threading.Lock()
        
        with self.model_locks[model_name]:
            # Double-check if model was loaded while waiting for lock
            if model_name in self.loaded_models:
                return self.loaded_models[model_name]
            
            start_time = time.time()
            logger.info(f"Loading model: {model_name} (type: {model_type})")
            
            try:
                if model_type == "sentence_transformer":
                    model = SentenceTransformer(model_name, cache_folder=self.model_cache_dir)
                    # Optimize for CPU
                    model.max_seq_length = 512  # Optimize for performance
                    
                elif model_type == "transformer":
                    model = AutoModel.from_pretrained(
                        model_name, 
                        cache_dir=self.model_cache_dir,
                        torch_dtype=torch.float32  # Use float32 for CPU
                    )
                    
                elif model_type == "classification":
                    model = AutoModelForSequenceClassification.from_pretrained(
                        model_name,
                        cache_dir=self.model_cache_dir,
                        torch_dtype=torch.float32
                    )
                    
                elif model_type == "pipeline":
                    task = config.get("task", "text-classification") if config else "text-classification"
                    model = pipeline(
                        task,
                        model=model_name,
                        device=-1,  # CPU
                        model_kwargs={"cache_dir": self.model_cache_dir}
                    )
                    
                else:
                    raise ValueError(f"Unknown model type: {model_type}")
                
                # Store loaded model
                self.loaded_models[model_name] = model
                
                # Update performance stats
                load_time = time.time() - start_time
                self.performance_stats[model_name] = {
                    "load_time": load_time,
                    "loaded_at": datetime.now().isoformat(),
                    "model_type": model_type,
                    "inference_count": 0,
                    "avg_inference_time": 0
                }
                
                logger.info(f"Model {model_name} loaded successfully in {load_time:.2f}s")
                
                # Clean up loading future
                if model_name in self.loading_futures:
                    del self.loading_futures[model_name]
                
                return model
                
            except Exception as e:
                logger.error(f"Error loading model {model_name}: {str(e)}")
                # Clean up on error
                if model_name in self.loading_futures:
                    del self.loading_futures[model_name]
                raise
    
    def get_inference(self, model_name: str, inputs: Any, 
                     batch_size: Optional[int] = None,
                     use_cache: bool = True) -> Any:
        """Get inference from model with caching and batch optimization"""
        # Generate cache key if caching is enabled
        cache_key = None
        if use_cache and self.enable_aggressive_caching:
            cache_key = self._generate_cache_key(model_name, inputs)
            if cache_key in self.inference_cache:
                logger.debug(f"Cache hit for model {model_name}")
                # Move to end (LRU behavior)
                self.inference_cache.move_to_end(cache_key)
                return self.inference_cache[cache_key]
        
        # Get model
        if model_name not in self.loaded_models:
            raise ValueError(f"Model {model_name} not loaded. Call load_model first.")
        
        model = self.loaded_models[model_name]
        
        # Perform inference with timing
        start_time = time.time()
        
        try:
            # Determine model type and perform appropriate inference
            if isinstance(model, SentenceTransformer):
                result = self._inference_sentence_transformer(model, inputs, batch_size)
            elif isinstance(model, Pipeline):
                result = self._inference_pipeline(model, inputs, batch_size)
            else:
                result = self._inference_transformer(model, inputs, batch_size)
            
            # Update performance stats
            inference_time = time.time() - start_time
            self._update_performance_stats(model_name, inference_time)
            
            # Cache result if enabled
            if cache_key and self.enable_aggressive_caching:
                self._add_to_cache(cache_key, result)
            
            return result
            
        except Exception as e:
            logger.error(f"Error during inference with model {model_name}: {str(e)}")
            raise
    
    def _inference_sentence_transformer(self, model: SentenceTransformer, 
                                      inputs: Any, batch_size: Optional[int]) -> np.ndarray:
        """Optimized inference for sentence transformers"""
        if isinstance(inputs, str):
            inputs = [inputs]
        
        # Use optimal batch size for performance
        if batch_size is None:
            batch_size = 32 if len(inputs) > 32 else len(inputs)
        
        # Encode with show_progress_bar for large batches
        embeddings = model.encode(
            inputs,
            batch_size=batch_size,
            show_progress_bar=len(inputs) > 100,
            convert_to_numpy=True,
            normalize_embeddings=True
        )
        
        return embeddings
    
    def _inference_pipeline(self, model: Pipeline, inputs: Any, 
                          batch_size: Optional[int]) -> List[Dict]:
        """Optimized inference for transformers pipelines"""
        if isinstance(inputs, str):
            inputs = [inputs]
        
        # Use optimal batch size
        if batch_size is None:
            batch_size = 16 if len(inputs) > 16 else len(inputs)
        
        # Process in batches
        results = []
        for i in range(0, len(inputs), batch_size):
            batch = inputs[i:i + batch_size]
            batch_results = model(batch)
            results.extend(batch_results)
        
        return results
    
    def _inference_transformer(self, model: Any, inputs: Any, 
                             batch_size: Optional[int]) -> Any:
        """Generic transformer inference"""
        # This would need proper tokenization and processing
        # Simplified for demonstration
        return model(inputs)
    
    def batch_process_multiple(self, requests: List[Dict[str, Any]], 
                             max_concurrent: int = 10) -> List[Tuple[str, Any]]:
        """Process multiple inference requests concurrently"""
        logger.info(f"Processing {len(requests)} requests concurrently")
        
        futures = []
        for request in requests[:max_concurrent]:
            future = self.executor.submit(
                self.get_inference,
                request["model_name"],
                request["inputs"],
                request.get("batch_size"),
                request.get("use_cache", True)
            )
            futures.append((request.get("id", ""), future))
        
        # Process remaining requests as initial ones complete
        remaining = requests[max_concurrent:]
        results = []
        
        for req_id, future in futures:
            result = future.result()
            results.append((req_id, result))
            
            if remaining:
                next_request = remaining.pop(0)
                new_future = self.executor.submit(
                    self.get_inference,
                    next_request["model_name"],
                    next_request["inputs"],
                    next_request.get("batch_size"),
                    next_request.get("use_cache", True)
                )
                futures.append((next_request.get("id", ""), new_future))
        
        return results
    
    def optimize_for_performance(self):
        """Optimize models and settings for maximum performance"""
        logger.info("Optimizing ModelManager for maximum performance...")
        
        # Enable all performance features
        self.enable_concurrent_loading = True
        self.enable_aggressive_caching = True
        self.enable_batch_optimization = True
        
        # Increase cache size for better hit rates
        self.max_cache_size = 50000
        
        # Optimize each loaded model
        for model_name, model in self.loaded_models.items():
            if isinstance(model, SentenceTransformer):
                # Optimize sentence transformer
                model.max_seq_length = 512
                if hasattr(model, 'eval'):
                    model.eval()  # Set to evaluation mode
        
        # Clear old cache entries if needed
        self._cleanup_cache()
        
        logger.info("Performance optimization complete")
    
    def _generate_cache_key(self, model_name: str, inputs: Any) -> str:
        """Generate unique cache key for inputs"""
        # Convert inputs to string representation
        if isinstance(inputs, list):
            inputs_str = json.dumps(inputs, sort_keys=True)
        else:
            inputs_str = str(inputs)
        
        # Create hash
        key_data = f"{model_name}:{inputs_str}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def _add_to_cache(self, key: str, value: Any):
        """Add result to cache with LRU eviction"""
        self.inference_cache[key] = value
        
        # Evict oldest entries if cache is too large
        if len(self.inference_cache) > self.max_cache_size:
            # Remove oldest 10% of entries
            num_to_remove = int(self.max_cache_size * 0.1)
            for _ in range(num_to_remove):
                self.inference_cache.popitem(last=False)
    
    def _cleanup_cache(self):
        """Clean up cache to maintain performance"""
        current_size = len(self.inference_cache)
        if current_size > self.max_cache_size * 0.9:
            # Remove 20% of oldest entries
            num_to_remove = int(current_size * 0.2)
            for _ in range(num_to_remove):
                if self.inference_cache:
                    self.inference_cache.popitem(last=False)
            logger.info(f"Cleaned up {num_to_remove} cache entries")
    
    def _update_performance_stats(self, model_name: str, inference_time: float):
        """Update performance statistics for model"""
        if model_name in self.performance_stats:
            stats = self.performance_stats[model_name]
            stats["inference_count"] += 1
            
            # Update average inference time
            current_avg = stats["avg_inference_time"]
            count = stats["inference_count"]
            stats["avg_inference_time"] = (
                (current_avg * (count - 1) + inference_time) / count
            )
            stats["last_inference_time"] = inference_time
            stats["last_inference_at"] = datetime.now().isoformat()
    
    def get_performance_stats(self) -> Dict[str, Dict]:
        """Get performance statistics for all models"""
        return self.performance_stats.copy()
    
    def shutdown(self):
        """Gracefully shutdown the ModelManager"""
        logger.info("Shutting down ModelManager...")
        
        # Cancel any pending futures
        for future in self.loading_futures.values():
            future.cancel()
        
        # Shutdown executor
        self.executor.shutdown(wait=True)
        
        # Clear models and cache
        self.loaded_models.clear()
        self.inference_cache.clear()
        
        logger.info("ModelManager shutdown complete")


# Singleton instance for global access
_model_manager_instance = None


def get_model_manager() -> ModelManager:
    """Get or create singleton ModelManager instance"""
    global _model_manager_instance
    if _model_manager_instance is None:
        _model_manager_instance = ModelManager()
    return _model_manager_instance
