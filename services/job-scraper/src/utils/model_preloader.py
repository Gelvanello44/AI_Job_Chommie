"""
Model Preloader for Hugging Face Models
Implements intelligent model preloading with lazy loading and caching
"""

import os
import time
import asyncio
import logging
from typing import Dict, List, Optional, Any, Set
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
import threading
import psutil
import torch
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    AutoModelForTokenClassification,
    AutoModel,
    pipeline
)

logger = logging.getLogger(__name__)

class ModelPreloader:
    """
    Manages intelligent preloading of Hugging Face models
    with lazy loading and memory optimization
    """
    
    def __init__(self, max_memory_usage: float = 0.7):
        """
        Initialize model preloader
        
        Args:
            max_memory_usage: Maximum percentage of system memory to use (0-1)
        """
        self.models: Dict[str, Any] = {}
        self.tokenizers: Dict[str, Any] = {}
        self.pipelines: Dict[str, Any] = {}
        self.model_configs: Dict[str, Dict[str, Any]] = {}
        self.load_times: Dict[str, float] = {}
        self.access_counts: Dict[str, int] = {}
        self.last_access: Dict[str, float] = {}
        self.loading_locks: Dict[str, threading.Lock] = {}
        self.max_memory_usage = max_memory_usage
        self.executor = ThreadPoolExecutor(max_workers=4)
        self._initialize_model_configs()
        
    def _initialize_model_configs(self):
        """Initialize model configurations with priorities"""
        self.model_configs = {
            # High priority models (load immediately)
            "job-classification": {
                "model_name": "distilbert-base-uncased-finetuned-sst-2-english",
                "task": "sentiment-analysis",
                "priority": 1,
                "preload": True
            },
            "skill-extraction": {
                "model_name": "dslim/bert-base-NER",
                "task": "ner",
                "priority": 1,
                "preload": True
            },
            # Medium priority models (load in background)
            "text-summarization": {
                "model_name": "facebook/bart-large-cnn",
                "task": "summarization",
                "priority": 2,
                "preload": False
            },
            "job-matching": {
                "model_name": "sentence-transformers/all-MiniLM-L6-v2",
                "task": "feature-extraction",
                "priority": 2,
                "preload": False
            },
            # Low priority models (load on demand)
            "language-detection": {
                "model_name": "papluca/xlm-roberta-base-language-detection",
                "task": "text-classification",
                "priority": 3,
                "preload": False
            }
        }
        
    async def start_preloading(self):
        """Start the preloading process for high priority models"""
        logger.info("Starting model preloading process...")
        
        # Group models by priority
        priority_groups = {}
        for model_id, config in self.model_configs.items():
            priority = config.get("priority", 3)
            if priority not in priority_groups:
                priority_groups[priority] = []
            priority_groups[priority].append((model_id, config))
        
        # Load models by priority
        for priority in sorted(priority_groups.keys()):
            models = priority_groups[priority]
            if priority == 1:
                # Load high priority models immediately
                await self._load_models_async(models)
            else:
                # Schedule lower priority models for background loading
                asyncio.create_task(self._load_models_async(models))
                
    async def _load_models_async(self, models: List[tuple]):
        """Load models asynchronously"""
        tasks = []
        for model_id, config in models:
            if config.get("preload", False) or config.get("priority", 3) <= 2:
                task = asyncio.create_task(self._load_model_background(model_id))
                tasks.append(task)
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
            
    async def _load_model_background(self, model_id: str):
        """Load a model in the background"""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(self.executor, self.load_model, model_id)
        
    def load_model(self, model_id: str) -> Optional[Any]:
        """
        Load a model with caching and lazy loading
        
        Args:
            model_id: Identifier for the model
            
        Returns:
            Loaded model pipeline or None if loading fails
        """
        # Check if model is already loaded
        if model_id in self.pipelines:
            self.access_counts[model_id] = self.access_counts.get(model_id, 0) + 1
            self.last_access[model_id] = time.time()
            return self.pipelines[model_id]
        
        # Acquire lock for this model
        if model_id not in self.loading_locks:
            self.loading_locks[model_id] = threading.Lock()
            
        with self.loading_locks[model_id]:
            # Double-check after acquiring lock
            if model_id in self.pipelines:
                return self.pipelines[model_id]
            
            # Check memory before loading
            if not self._check_memory_availability():
                self._evict_least_used_model()
            
            config = self.model_configs.get(model_id, {})
            if not config:
                logger.error(f"No configuration found for model: {model_id}")
                return None
            
            model_name = config["model_name"]
            task = config["task"]
            
            logger.info(f"Loading model: {model_id} ({model_name})")
            start_time = time.time()
            
            try:
                # Load model and tokenizer
                device = 0 if torch.cuda.is_available() else -1
                
                # Create pipeline with optimizations
                pipe = pipeline(
                    task=task,
                    model=model_name,
                    device=device,
                    # Optimization parameters
                    model_kwargs={
                        "torchscript": True if torch.cuda.is_available() else False,
                        "low_cpu_mem_usage": True
                    }
                )
                
                # Store in cache
                self.pipelines[model_id] = pipe
                self.load_times[model_id] = time.time() - start_time
                self.access_counts[model_id] = 1
                self.last_access[model_id] = time.time()
                
                logger.info(f"Model {model_id} loaded in {self.load_times[model_id]:.2f} seconds")
                return pipe
                
            except Exception as e:
                logger.error(f"Error loading model {model_id}: {str(e)}")
                return None
                
    def _check_memory_availability(self) -> bool:
        """Check if there's enough memory to load a new model"""
        memory = psutil.virtual_memory()
        return memory.percent < (self.max_memory_usage * 100)
        
    def _evict_least_used_model(self):
        """Evict the least recently used model to free memory"""
        if not self.pipelines:
            return
            
        # Find least recently used model
        lru_model_id = min(self.last_access, key=self.last_access.get)
        
        logger.info(f"Evicting model {lru_model_id} to free memory")
        
        # Remove from caches
        if lru_model_id in self.pipelines:
            del self.pipelines[lru_model_id]
        if lru_model_id in self.models:
            del self.models[lru_model_id]
        if lru_model_id in self.tokenizers:
            del self.tokenizers[lru_model_id]
            
        # Force garbage collection
        import gc
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
    def get_model(self, model_id: str) -> Optional[Any]:
        """
        Get a model, loading it if necessary
        
        Args:
            model_id: Identifier for the model
            
        Returns:
            Model pipeline or None
        """
        return self.load_model(model_id)
        
    def preload_critical_models(self):
        """Synchronously preload critical models during startup"""
        critical_models = [
            (model_id, config) 
            for model_id, config in self.model_configs.items() 
            if config.get("priority", 3) == 1 and config.get("preload", False)
        ]
        
        for model_id, _ in critical_models:
            self.load_model(model_id)
            
    def get_model_stats(self) -> Dict[str, Any]:
        """Get statistics about loaded models"""
        stats = {
            "loaded_models": list(self.pipelines.keys()),
            "total_models": len(self.model_configs),
            "memory_usage": psutil.virtual_memory().percent,
            "load_times": self.load_times,
            "access_counts": self.access_counts,
            "model_details": []
        }
        
        for model_id in self.pipelines:
            stats["model_details"].append({
                "model_id": model_id,
                "load_time": self.load_times.get(model_id, 0),
                "access_count": self.access_counts.get(model_id, 0),
                "last_access": time.time() - self.last_access.get(model_id, time.time())
            })
            
        return stats
        
    def cleanup(self):
        """Cleanup resources"""
        self.executor.shutdown(wait=True)
        self.pipelines.clear()
        self.models.clear()
        self.tokenizers.clear()
        
        # Force garbage collection
        import gc
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

# Singleton instance
_model_preloader = None

def get_model_preloader() -> ModelPreloader:
    """Get the singleton model preloader instance"""
    global _model_preloader
    if _model_preloader is None:
        _model_preloader = ModelPreloader()
    return _model_preloader
