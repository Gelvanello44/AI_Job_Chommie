"""
Model Preloader - Intelligent model preloading and lazy loading system
Implements efficient model loading strategies to reduce startup times
"""

import asyncio
import threading
from typing import Dict, List, Set, Optional, Any
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import torch
from transformers import AutoModel, AutoTokenizer, pipeline
import logging
import psutil
import gc
from pathlib import Path
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ModelPreloader:
    """Intelligent model preloading system with lazy loading and background loading"""
    
    def __init__(self, config_path: str = "model_config.json"):
        self.models: Dict[str, Any] = {}
        self.tokenizers: Dict[str, Any] = {}
        self.pipelines: Dict[str, Any] = {}
        self.loading_status: Dict[str, str] = {}  # model_name: status
        self.load_times: Dict[str, float] = {}
        self.usage_count: Dict[str, int] = {}
        self.last_used: Dict[str, datetime] = {}
        self.config = self._load_config(config_path)
        self.executor = ThreadPoolExecutor(max_workers=4)
        self.loading_lock = threading.Lock()
        self.priority_models: Set[str] = set()
        self.background_tasks: List[asyncio.Task] = []
        
    def _load_config(self, config_path: str) -> Dict:
        """Load model configuration from file"""
        try:
            config_file = Path(config_path)
            if config_file.exists():
                with open(config_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load config from {config_path}: {e}")
        
        # Default configuration
        return {
            "priority_models": [
                "sentence-transformers/all-MiniLM-L6-v2",
                "facebook/bart-large-mnli"
            ],
            "background_models": [
                "distilbert-base-uncased",
                "roberta-base"
            ],
            "cache_size_mb": 4096,
            "max_concurrent_loads": 3,
            "preload_on_startup": True
        }
    
    def set_priority_models(self, model_names: List[str]):
        """Set models to be loaded with high priority"""
        self.priority_models = set(model_names)
        
    def get_loading_status(self) -> Dict[str, str]:
        """Get current loading status of all models"""
        return self.loading_status.copy()
    
    def _estimate_model_size(self, model_name: str) -> float:
        """Estimate model size in MB"""
        # Basic heuristic based on common model sizes
        size_map = {
            "mini": 50,
            "small": 150,
            "base": 500,
            "large": 1500,
            "xl": 3000
        }
        
        for size, mb in size_map.items():
            if size in model_name.lower():
                return mb
        return 500  # Default size
    
    def _get_available_memory(self) -> float:
        """Get available system memory in MB"""
        memory = psutil.virtual_memory()
        return memory.available / (1024 * 1024)
    
    def _can_load_model(self, model_name: str) -> bool:
        """Check if there's enough memory to load a model"""
        estimated_size = self._estimate_model_size(model_name)
        available_memory = self._get_available_memory()
        
        # Keep at least 1GB free
        return available_memory > (estimated_size + 1024)
    
    async def preload_priority_models(self):
        """Preload high-priority models during startup"""
        logger.info("Starting priority model preloading...")
        
        priority_models = self.config.get("priority_models", [])
        priority_models.extend(list(self.priority_models))
        
        tasks = []
        for model_name in priority_models:
            if model_name not in self.models:
                task = asyncio.create_task(self._load_model_async(model_name, priority=True))
                tasks.append(task)
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
            
        logger.info(f"Priority model preloading complete. Loaded {len(tasks)} models.")
    
    async def _load_model_async(self, model_name: str, priority: bool = False):
        """Load a model asynchronously"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.executor,
            self._load_model_sync,
            model_name,
            priority
        )
    
    def _load_model_sync(self, model_name: str, priority: bool = False):
        """Synchronously load a model"""
        with self.loading_lock:
            if model_name in self.models:
                return self.models[model_name]
            
            if not self._can_load_model(model_name):
                # Evict least recently used models if needed
                self._evict_unused_models()
            
            self.loading_status[model_name] = "loading"
            start_time = datetime.now()
            
            try:
                logger.info(f"Loading model: {model_name} (priority={priority})")
                
                # Load tokenizer
                tokenizer = AutoTokenizer.from_pretrained(model_name)
                self.tokenizers[model_name] = tokenizer
                
                # Load model
                model = AutoModel.from_pretrained(
                    model_name,
                    torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
                )
                
                # Move to GPU if available
                if torch.cuda.is_available():
                    model = model.cuda()
                
                self.models[model_name] = model
                
                # Record metrics
                load_time = (datetime.now() - start_time).total_seconds()
                self.load_times[model_name] = load_time
                self.usage_count[model_name] = 0
                self.last_used[model_name] = datetime.now()
                self.loading_status[model_name] = "loaded"
                
                logger.info(f"Model {model_name} loaded in {load_time:.2f} seconds")
                return model
                
            except Exception as e:
                logger.error(f"Failed to load model {model_name}: {e}")
                self.loading_status[model_name] = "failed"
                raise
    
    def get_model(self, model_name: str) -> Any:
        """Get a model, loading it if necessary"""
        if model_name in self.models:
            # Update usage metrics
            self.usage_count[model_name] += 1
            self.last_used[model_name] = datetime.now()
            return self.models[model_name]
        
        # Load model synchronously if not already loaded
        return self._load_model_sync(model_name)
    
    def get_tokenizer(self, model_name: str) -> Any:
        """Get a tokenizer, loading it if necessary"""
        if model_name not in self.tokenizers:
            self.get_model(model_name)  # This will load the tokenizer too
        return self.tokenizers.get(model_name)
    
    def get_pipeline(self, task: str, model_name: Optional[str] = None) -> Any:
        """Get or create a pipeline for a specific task"""
        pipeline_key = f"{task}:{model_name or 'default'}"
        
        if pipeline_key not in self.pipelines:
            if model_name:
                # Ensure model is loaded
                model = self.get_model(model_name)
                tokenizer = self.get_tokenizer(model_name)
                self.pipelines[pipeline_key] = pipeline(
                    task,
                    model=model,
                    tokenizer=tokenizer,
                    device=0 if torch.cuda.is_available() else -1
                )
            else:
                self.pipelines[pipeline_key] = pipeline(
                    task,
                    device=0 if torch.cuda.is_available() else -1
                )
        
        return self.pipelines[pipeline_key]
    
    def _evict_unused_models(self, target_memory_mb: float = 1024):
        """Evict least recently used models to free memory"""
        # Sort models by last used time
        sorted_models = sorted(
            self.models.keys(),
            key=lambda x: self.last_used.get(x, datetime.min)
        )
        
        freed_memory = 0
        evicted_models = []
        
        for model_name in sorted_models:
            if model_name in self.priority_models:
                continue  # Don't evict priority models
            
            if freed_memory >= target_memory_mb:
                break
            
            # Evict model
            if model_name in self.models:
                del self.models[model_name]
                evicted_models.append(model_name)
                freed_memory += self._estimate_model_size(model_name)
            
            if model_name in self.tokenizers:
                del self.tokenizers[model_name]
            
            # Remove from pipelines
            pipeline_keys_to_remove = [
                k for k in self.pipelines.keys() if model_name in k
            ]
            for key in pipeline_keys_to_remove:
                del self.pipelines[key]
        
        if evicted_models:
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            logger.info(f"Evicted models to free memory: {evicted_models}")
    
    async def start_background_loading(self):
        """Start loading non-priority models in the background"""
        background_models = self.config.get("background_models", [])
        
        for model_name in background_models:
            if model_name not in self.models:
                task = asyncio.create_task(self._load_model_async(model_name, priority=False))
                self.background_tasks.append(task)
        
        logger.info(f"Started background loading for {len(self.background_tasks)} models")
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get model loading and usage statistics"""
        return {
            "loaded_models": list(self.models.keys()),
            "loading_status": self.loading_status,
            "load_times": self.load_times,
            "usage_count": self.usage_count,
            "memory_usage_mb": sum(
                self._estimate_model_size(m) for m in self.models.keys()
            ),
            "available_memory_mb": self._get_available_memory()
        }
    
    async def cleanup(self):
        """Cleanup resources"""
        # Cancel background tasks
        for task in self.background_tasks:
            if not task.done():
                task.cancel()
        
        # Wait for tasks to complete
        if self.background_tasks:
            await asyncio.gather(*self.background_tasks, return_exceptions=True)
        
        # Shutdown executor
        self.executor.shutdown(wait=True)
        
        # Clear model cache
        self.models.clear()
        self.tokenizers.clear()
        self.pipelines.clear()
        
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


# Global instance
_preloader_instance: Optional[ModelPreloader] = None


def get_model_preloader() -> ModelPreloader:
    """Get or create the global ModelPreloader instance"""
    global _preloader_instance
    if _preloader_instance is None:
        _preloader_instance = ModelPreloader()
    return _preloader_instance


async def initialize_model_preloader(priority_models: Optional[List[str]] = None):
    """Initialize the model preloader with priority models"""
    preloader = get_model_preloader()
    
    if priority_models:
        preloader.set_priority_models(priority_models)
    
    # Start priority model loading
    await preloader.preload_priority_models()
    
    # Start background loading
    await preloader.start_background_loading()
    
    return preloader


if __name__ == "__main__":
    # Example usage
    async def main():
        # Initialize with priority models
        preloader = await initialize_model_preloader([
            "sentence-transformers/all-MiniLM-L6-v2",
            "facebook/bart-large-mnli"
        ])
        
        # Get a model (will load if not already loaded)
        model = preloader.get_model("sentence-transformers/all-MiniLM-L6-v2")
        print(f"Model loaded: {model is not None}")
        
        # Get statistics
        stats = preloader.get_statistics()
        print(f"Statistics: {json.dumps(stats, indent=2)}")
        
        # Cleanup
        await preloader.cleanup()
    
    asyncio.run(main())
