"""
Model Warmup - Preloads critical models and performs warmup inference
Implements intelligent warmup based on usage patterns and automatic health verification
"""

import asyncio
import time
import logging
from typing import Dict, List, Optional, Any, Callable, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import torch
import numpy as np
from pathlib import Path
import json
import psutil

from model_cache_manager import get_model_cache_manager, ModelType
from production_model_config import get_production_model_config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class WarmupConfig:
    """Configuration for model warmup"""
    model_name: str
    warmup_iterations: int = 5
    batch_sizes: List[int] = field(default_factory=lambda: [1, 8, 16])
    sequence_lengths: List[int] = field(default_factory=lambda: [128, 256, 512])
    verify_outputs: bool = True
    timeout_seconds: float = 300.0
    priority: int = 1


@dataclass
class WarmupResult:
    """Result of model warmup"""
    model_name: str
    success: bool
    load_time: float
    warmup_time: float
    avg_inference_time: float
    memory_usage_mb: float
    error: Optional[str] = None
    performance_metrics: Dict[str, float] = field(default_factory=dict)


class ModelWarmup:
    """
    Manages model preloading and warmup during application startup
    """
    
    def __init__(self):
        self.cache_manager = get_model_cache_manager()
        self.production_config = get_production_model_config()
        self.warmup_configs: Dict[str, WarmupConfig] = {}
        self.warmup_results: Dict[str, WarmupResult] = {}
        self.usage_patterns: Dict[str, Dict[str, Any]] = {}
        self.is_warming_up = False
        
        # Load usage patterns if exists
        self._load_usage_patterns()
        
    def _load_usage_patterns(self):
        """Load historical usage patterns"""
        patterns_file = Path("model_usage_patterns.json")
        if patterns_file.exists():
            try:
                with open(patterns_file, 'r') as f:
                    self.usage_patterns = json.load(f)
                logger.info(f"Loaded usage patterns for {len(self.usage_patterns)} models")
            except Exception as e:
                logger.warning(f"Could not load usage patterns: {e}")
                
    def save_usage_patterns(self):
        """Save usage patterns to file"""
        patterns_file = Path("model_usage_patterns.json")
        try:
            with open(patterns_file, 'w') as f:
                json.dump(self.usage_patterns, f, indent=2)
        except Exception as e:
            logger.error(f"Could not save usage patterns: {e}")
            
    def register_warmup_config(self, config: WarmupConfig):
        """Register a warmup configuration"""
        self.warmup_configs[config.model_name] = config
        logger.info(f"Registered warmup config for {config.model_name}")
        
    def _get_default_warmup_configs(self) -> List[WarmupConfig]:
        """Get default warmup configurations based on production config"""
        configs = []
        
        # Get all configured models
        for name, model_config in self.production_config.configs.items():
            # Determine warmup parameters based on model task
            if model_config.task == "sentence-similarity":
                warmup_config = WarmupConfig(
                    model_name=name,
                    warmup_iterations=10,
                    batch_sizes=[1, 16, 32],
                    sequence_lengths=[128, 256],
                    priority=1
                )
            elif model_config.task == "zero-shot-classification":
                warmup_config = WarmupConfig(
                    model_name=name,
                    warmup_iterations=5,
                    batch_sizes=[1, 4, 8],
                    sequence_lengths=[256, 512],
                    priority=2
                )
            else:
                warmup_config = WarmupConfig(
                    model_name=name,
                    warmup_iterations=5,
                    batch_sizes=[1, 8],
                    sequence_lengths=[256],
                    priority=3
                )
                
            configs.append(warmup_config)
            
        return configs
        
    async def warmup_all_models(self, parallel: bool = True) -> Dict[str, WarmupResult]:
        """Warmup all configured models"""
        if self.is_warming_up:
            logger.warning("Model warmup already in progress")
            return self.warmup_results
            
        self.is_warming_up = True
        start_time = time.time()
        
        logger.info("Starting model warmup process...")
        
        # Get warmup configs
        if not self.warmup_configs:
            # Use default configs
            for config in self._get_default_warmup_configs():
                self.register_warmup_config(config)
                
        # Sort by priority
        sorted_configs = sorted(
            self.warmup_configs.values(),
            key=lambda x: x.priority
        )
        
        # Group by priority for parallel execution
        priority_groups = {}
        for config in sorted_configs:
            if config.priority not in priority_groups:
                priority_groups[config.priority] = []
            priority_groups[config.priority].append(config)
            
        # Warmup models by priority group
        for priority, configs in sorted(priority_groups.items()):
            logger.info(f"Warming up priority {priority} models...")
            
            if parallel and len(configs) > 1:
                # Parallel warmup within priority group
                tasks = []
                for config in configs:
                    task = asyncio.create_task(self.warmup_model(config))
                    tasks.append(task)
                    
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Process results
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        logger.error(f"Warmup failed for {configs[i].model_name}: {result}")
                        self.warmup_results[configs[i].model_name] = WarmupResult(
                            model_name=configs[i].model_name,
                            success=False,
                            load_time=0,
                            warmup_time=0,
                            avg_inference_time=0,
                            memory_usage_mb=0,
                            error=str(result)
                        )
                    else:
                        self.warmup_results[configs[i].model_name] = result
            else:
                # Sequential warmup
                for config in configs:
                    try:
                        result = await self.warmup_model(config)
                        self.warmup_results[config.model_name] = result
                    except Exception as e:
                        logger.error(f"Warmup failed for {config.model_name}: {e}")
                        self.warmup_results[config.model_name] = WarmupResult(
                            model_name=config.model_name,
                            success=False,
                            load_time=0,
                            warmup_time=0,
                            avg_inference_time=0,
                            memory_usage_mb=0,
                            error=str(e)
                        )
                        
        # Update usage patterns
        self._update_usage_patterns()
        
        total_time = time.time() - start_time
        successful = sum(1 for r in self.warmup_results.values() if r.success)
        
        logger.info(
            f"Model warmup completed in {total_time:.2f}s. "
            f"Success: {successful}/{len(self.warmup_results)}"
        )
        
        self.is_warming_up = False
        return self.warmup_results
        
    async def warmup_model(self, config: WarmupConfig) -> WarmupResult:
        """Warmup a single model"""
        logger.info(f"Warming up model: {config.model_name}")
        
        # Track memory before loading
        process = psutil.Process()
        memory_before = process.memory_info().rss / (1024 * 1024)
        
        load_start = time.time()
        
        try:
            # Get model config
            if config.model_name not in self.production_config.configs:
                raise ValueError(f"Model {config.model_name} not found in production config")
                
            model_config = self.production_config.configs[config.model_name]
            
            # Load model using optimized loader
            loader = self.production_config.get_optimized_model_loader(config.model_name)
            model, tokenizer = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(None, loader),
                timeout=config.timeout_seconds
            )
            
            load_time = time.time() - load_start
            
            # Perform warmup inference
            warmup_start = time.time()
            inference_times = []
            
            for batch_size in config.batch_sizes:
                for seq_length in config.sequence_lengths:
                    # Generate dummy inputs
                    inputs = self._generate_dummy_inputs(
                        tokenizer,
                        batch_size,
                        seq_length,
                        model_config.task
                    )
                    
                    # Run warmup iterations
                    iteration_times = []
                    for _ in range(config.warmup_iterations):
                        iter_start = time.time()
                        
                        # Run inference
                        with torch.no_grad():
                            if hasattr(model, 'forward'):
                                # PyTorch model
                                outputs = model(**inputs)
                            elif hasattr(model, 'run'):
                                # ONNX model
                                input_dict = {
                                    k: v.numpy() if torch.is_tensor(v) else v 
                                    for k, v in inputs.items()
                                }
                                outputs = model.run(None, input_dict)
                            else:
                                # Other model types
                                outputs = model(inputs)
                                
                        iteration_times.append(time.time() - iter_start)
                        
                    # Record average time for this configuration
                    avg_time = sum(iteration_times) / len(iteration_times)
                    inference_times.append(avg_time)
                    
                    logger.debug(
                        f"Warmup {config.model_name} - "
                        f"batch_size={batch_size}, seq_len={seq_length}: "
                        f"{avg_time*1000:.2f}ms"
                    )
                    
            warmup_time = time.time() - warmup_start
            avg_inference_time = sum(inference_times) / len(inference_times)
            
            # Track memory after warmup
            memory_after = process.memory_info().rss / (1024 * 1024)
            memory_usage = memory_after - memory_before
            
            # Verify model outputs if configured
            if config.verify_outputs:
                self._verify_model_outputs(model, tokenizer, model_config.task)
                
            # Create result
            result = WarmupResult(
                model_name=config.model_name,
                success=True,
                load_time=load_time,
                warmup_time=warmup_time,
                avg_inference_time=avg_inference_time,
                memory_usage_mb=memory_usage,
                performance_metrics={
                    "min_inference_time": min(inference_times),
                    "max_inference_time": max(inference_times),
                    "std_inference_time": np.std(inference_times),
                    "throughput_samples_per_sec": 1.0 / avg_inference_time if avg_inference_time > 0 else 0
                }
            )
            
            logger.info(
                f"Model {config.model_name} warmup complete: "
                f"load_time={load_time:.2f}s, "
                f"avg_inference={avg_inference_time*1000:.2f}ms, "
                f"memory={memory_usage:.1f}MB"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Model warmup failed for {config.model_name}: {e}")
            return WarmupResult(
                model_name=config.model_name,
                success=False,
                load_time=time.time() - load_start,
                warmup_time=0,
                avg_inference_time=0,
                memory_usage_mb=0,
                error=str(e)
            )
            
    def _generate_dummy_inputs(
        self, 
        tokenizer: Any,
        batch_size: int,
        seq_length: int,
        task: str
    ) -> Dict[str, torch.Tensor]:
        """Generate dummy inputs for warmup"""
        # Generate dummy text based on task
        if task == "sentence-similarity":
            texts = [
                "This is a sample sentence for model warmup and testing."
            ] * batch_size
        elif task == "zero-shot-classification":
            texts = [
                "The company announced record profits in the quarterly earnings report."
            ] * batch_size
        elif task == "token-classification":
            texts = [
                "John Smith works at Microsoft in Seattle, Washington."
            ] * batch_size
        else:
            texts = ["Sample text for warmup inference."] * batch_size
            
        # Tokenize
        inputs = tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=seq_length,
            return_tensors="pt"
        )
        
        # Move to appropriate device
        if torch.cuda.is_available():
            inputs = {k: v.cuda() for k, v in inputs.items()}
            
        return inputs
        
    def _verify_model_outputs(self, model: Any, tokenizer: Any, task: str):
        """Verify model outputs are valid"""
        # Generate test input
        test_inputs = self._generate_dummy_inputs(tokenizer, 1, 128, task)
        
        try:
            with torch.no_grad():
                if hasattr(model, 'forward'):
                    outputs = model(**test_inputs)
                    
                    # Basic verification
                    if hasattr(outputs, 'last_hidden_state'):
                        assert outputs.last_hidden_state is not None
                        assert outputs.last_hidden_state.shape[0] == 1
                    elif hasattr(outputs, 'logits'):
                        assert outputs.logits is not None
                        assert outputs.logits.shape[0] == 1
                        
            logger.debug(f"Model output verification passed")
            
        except Exception as e:
            logger.warning(f"Model output verification failed: {e}")
            raise
            
    def _update_usage_patterns(self):
        """Update usage patterns based on warmup results"""
        for model_name, result in self.warmup_results.items():
            if model_name not in self.usage_patterns:
                self.usage_patterns[model_name] = {
                    "load_count": 0,
                    "total_load_time": 0,
                    "avg_load_time": 0,
                    "avg_inference_time": 0,
                    "last_loaded": None
                }
                
            pattern = self.usage_patterns[model_name]
            pattern["load_count"] += 1
            pattern["total_load_time"] += result.load_time
            pattern["avg_load_time"] = pattern["total_load_time"] / pattern["load_count"]
            pattern["avg_inference_time"] = result.avg_inference_time
            pattern["last_loaded"] = datetime.now().isoformat()
            
    def get_warmup_report(self) -> str:
        """Generate warmup report"""
        report = ["=== Model Warmup Report ==="]
        
        if not self.warmup_results:
            report.append("No warmup results available")
            return "\n".join(report)
            
        # Summary
        successful = sum(1 for r in self.warmup_results.values() if r.success)
        total_load_time = sum(r.load_time for r in self.warmup_results.values())
        total_memory = sum(r.memory_usage_mb for r in self.warmup_results.values())
        
        report.append(f"\nSummary:")
        report.append(f"  Models warmed up: {len(self.warmup_results)}")
        report.append(f"  Successful: {successful}")
        report.append(f"  Total load time: {total_load_time:.2f}s")
        report.append(f"  Total memory usage: {total_memory:.1f}MB")
        
        # Per-model results
        report.append(f"\nPer-Model Results:")
        for name, result in sorted(self.warmup_results.items()):
            status = "" if result.success else ""
            report.append(
                f"  {status} {name}: "
                f"load={result.load_time:.2f}s, "
                f"inference={result.avg_inference_time*1000:.1f}ms, "
                f"memory={result.memory_usage_mb:.1f}MB"
            )
            if result.error:
                report.append(f"    Error: {result.error}")
                
        # Performance metrics
        report.append(f"\nPerformance Metrics:")
        for name, result in self.warmup_results.items():
            if result.success and result.performance_metrics:
                metrics = result.performance_metrics
                report.append(
                    f"  {name}: "
                    f"throughput={metrics.get('throughput_samples_per_sec', 0):.1f} samples/sec"
                )
                
        return "\n".join(report)
        
    def get_recommended_models(self, max_models: int = 5) -> List[str]:
        """Get recommended models to preload based on usage patterns"""
        if not self.usage_patterns:
            # Return default high-priority models
            return ["embeddings", "classification"]
            
        # Sort by usage frequency and recency
        now = datetime.now()
        scored_models = []
        
        for model_name, pattern in self.usage_patterns.items():
            # Calculate score based on usage and recency
            usage_score = pattern["load_count"]
            
            if pattern["last_loaded"]:
                last_loaded = datetime.fromisoformat(pattern["last_loaded"])
                days_since_use = (now - last_loaded).days
                recency_score = 1.0 / (days_since_use + 1)
            else:
                recency_score = 0
                
            total_score = usage_score + (recency_score * 10)
            scored_models.append((model_name, total_score))
            
        # Sort by score and return top models
        scored_models.sort(key=lambda x: x[1], reverse=True)
        return [model for model, _ in scored_models[:max_models]]


# Global instance
_model_warmup: Optional[ModelWarmup] = None


def get_model_warmup() -> ModelWarmup:
    """Get or create the global ModelWarmup instance"""
    global _model_warmup
    if _model_warmup is None:
        _model_warmup = ModelWarmup()
    return _model_warmup


# Example usage
if __name__ == "__main__":
    async def main():
        warmup = get_model_warmup()
        
        # Register custom warmup config
        warmup.register_warmup_config(WarmupConfig(
            model_name="embeddings",
            warmup_iterations=10,
            batch_sizes=[1, 16, 32],
            sequence_lengths=[128, 256],
            priority=1
        ))
        
        # Perform warmup
        results = await warmup.warmup_all_models(parallel=True)
        
        # Generate report
        report = warmup.get_warmup_report()
        print(report)
        
        # Get recommended models
        recommended = warmup.get_recommended_models()
        print(f"\nRecommended models for preloading: {recommended}")
        
        # Save usage patterns
        warmup.save_usage_patterns()
        
    asyncio.run(main())
