"""
Production Model Config - Optimizes model loading for production environment
Implements model quantization, compilation optimization, and hardware-specific configuration
"""

import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import torch
from pathlib import Path
import os
from transformers import AutoConfig, AutoModel, AutoTokenizer
import onnx
import onnxruntime as ort

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ModelOptimizationLevel(Enum):
    """Model optimization levels"""
    NONE = "none"
    BASIC = "basic"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"
    EXTREME = "extreme"


class ModelFormat(Enum):
    """Model format types"""
    PYTORCH = "pytorch"
    ONNX = "onnx"
    TENSORRT = "tensorrt"
    OPENVINO = "openvino"
    QUANTIZED = "quantized"


@dataclass
class ModelConfig:
    """Production model configuration"""
    name: str
    model_id: str
    task: str
    format: ModelFormat = ModelFormat.PYTORCH
    optimization_level: ModelOptimizationLevel = ModelOptimizationLevel.MODERATE
    quantization: Optional[str] = None  # int8, fp16, dynamic
    batch_size: int = 1
    max_sequence_length: int = 512
    device: str = "auto"
    num_threads: Optional[int] = None
    memory_limit_mb: Optional[float] = None
    cache_dir: Optional[str] = None
    custom_config: Dict[str, Any] = field(default_factory=dict)


class ProductionModelConfig:
    """
    Production model configuration manager with hardware optimization
    """
    
    def __init__(self, config_file: Optional[str] = None):
        self.configs: Dict[str, ModelConfig] = {}
        self.hardware_info = self._detect_hardware()
        self.optimization_settings = self._determine_optimization_settings()
        
        if config_file and Path(config_file).exists():
            self._load_configs(config_file)
        else:
            self._setup_default_configs()
            
    def _detect_hardware(self) -> Dict[str, Any]:
        """Detect hardware capabilities"""
        hardware = {
            "cpu": {
                "vendor": "unknown",
                "cores": os.cpu_count() or 1,
                "supports_avx": False,
                "supports_avx2": False,
                "supports_avx512": False
            },
            "gpu": {
                "available": torch.cuda.is_available(),
                "count": 0,
                "devices": []
            },
            "memory": {
                "total_gb": 0,
                "available_gb": 0
            }
        }
        
        # Detect CPU features
        try:
            import cpuinfo
            cpu_info = cpuinfo.get_cpu_info()
            hardware["cpu"]["vendor"] = cpu_info.get("vendor_id", "unknown")
            hardware["cpu"]["supports_avx"] = "avx" in cpu_info.get("flags", [])
            hardware["cpu"]["supports_avx2"] = "avx2" in cpu_info.get("flags", [])
            hardware["cpu"]["supports_avx512"] = any("avx512" in flag for flag in cpu_info.get("flags", []))
        except Exception as e:
            logger.warning(f"Could not detect CPU features: {e}")
            
        # Detect GPU capabilities
        if torch.cuda.is_available():
            hardware["gpu"]["count"] = torch.cuda.device_count()
            for i in range(hardware["gpu"]["count"]):
                props = torch.cuda.get_device_properties(i)
                hardware["gpu"]["devices"].append({
                    "name": props.name,
                    "memory_gb": props.total_memory / (1024**3),
                    "compute_capability": f"{props.major}.{props.minor}"
                })
                
        # Detect memory
        try:
            import psutil
            mem = psutil.virtual_memory()
            hardware["memory"]["total_gb"] = mem.total / (1024**3)
            hardware["memory"]["available_gb"] = mem.available / (1024**3)
        except Exception as e:
            logger.warning(f"Could not detect memory info: {e}")
            
        logger.info(f"Detected hardware: {hardware}")
        return hardware
        
    def _determine_optimization_settings(self) -> Dict[str, Any]:
        """Determine optimization settings based on hardware"""
        settings = {
            "use_gpu": self.hardware_info["gpu"]["available"],
            "gpu_memory_fraction": 0.8,
            "num_threads": min(self.hardware_info["cpu"]["cores"], 8),
            "enable_quantization": True,
            "enable_onnx": True,
            "enable_graph_optimization": True,
            "enable_mixed_precision": self.hardware_info["gpu"]["available"],
            "batch_processing": True
        }
        
        # Adjust based on available memory
        total_memory_gb = self.hardware_info["memory"]["total_gb"]
        if total_memory_gb < 8:
            settings["enable_quantization"] = True
            settings["gpu_memory_fraction"] = 0.6
            settings["batch_processing"] = False
        elif total_memory_gb < 16:
            settings["gpu_memory_fraction"] = 0.7
            
        # Adjust based on GPU
        if self.hardware_info["gpu"]["available"] and self.hardware_info["gpu"]["devices"]:
            gpu_memory = self.hardware_info["gpu"]["devices"][0]["memory_gb"]
            if gpu_memory < 4:
                settings["enable_mixed_precision"] = True
                settings["gpu_memory_fraction"] = 0.9
            elif gpu_memory < 8:
                settings["gpu_memory_fraction"] = 0.8
                
        return settings
        
    def _setup_default_configs(self):
        """Setup default model configurations"""
        # Sentence transformer for embeddings
        self.add_model_config(ModelConfig(
            name="embeddings",
            model_id="sentence-transformers/all-MiniLM-L6-v2",
            task="sentence-similarity",
            optimization_level=ModelOptimizationLevel.AGGRESSIVE,
            quantization="int8" if self.hardware_info["memory"]["total_gb"] < 16 else "fp16",
            batch_size=32,
            max_sequence_length=256
        ))
        
        # Classification model
        self.add_model_config(ModelConfig(
            name="classification",
            model_id="facebook/bart-large-mnli",
            task="zero-shot-classification",
            optimization_level=ModelOptimizationLevel.MODERATE,
            quantization="fp16",
            batch_size=8,
            max_sequence_length=512
        ))
        
        # NER model
        self.add_model_config(ModelConfig(
            name="ner",
            model_id="dslim/bert-base-NER",
            task="token-classification",
            optimization_level=ModelOptimizationLevel.AGGRESSIVE,
            quantization="int8",
            batch_size=16,
            max_sequence_length=256
        ))
        
    def add_model_config(self, config: ModelConfig):
        """Add a model configuration"""
        # Auto-configure device if set to auto
        if config.device == "auto":
            if self.optimization_settings["use_gpu"]:
                config.device = "cuda"
            else:
                config.device = "cpu"
                
        # Set number of threads
        if config.num_threads is None:
            config.num_threads = self.optimization_settings["num_threads"]
            
        # Set memory limit based on available memory
        if config.memory_limit_mb is None:
            available_memory_mb = self.hardware_info["memory"]["available_gb"] * 1024
            # Use 20% of available memory per model as default
            config.memory_limit_mb = available_memory_mb * 0.2
            
        self.configs[config.name] = config
        logger.info(f"Added model config: {config.name} ({config.model_id})")
        
    def get_optimized_model_loader(self, name: str) -> callable:
        """Get optimized model loader function"""
        if name not in self.configs:
            raise KeyError(f"Model config '{name}' not found")
            
        config = self.configs[name]
        
        def load_optimized_model():
            """Load model with optimizations"""
            logger.info(f"Loading optimized model: {config.name}")
            
            # Set environment variables for optimization
            os.environ["OMP_NUM_THREADS"] = str(config.num_threads)
            os.environ["MKL_NUM_THREADS"] = str(config.num_threads)
            
            if config.format == ModelFormat.ONNX:
                return self._load_onnx_model(config)
            elif config.format == ModelFormat.QUANTIZED:
                return self._load_quantized_model(config)
            else:
                return self._load_pytorch_model(config)
                
        return load_optimized_model
        
    def _load_pytorch_model(self, config: ModelConfig) -> Tuple[Any, Any]:
        """Load PyTorch model with optimizations"""
        # Load tokenizer
        tokenizer = AutoTokenizer.from_pretrained(
            config.model_id,
            cache_dir=config.cache_dir
        )
        
        # Load model configuration
        model_config = AutoConfig.from_pretrained(
            config.model_id,
            cache_dir=config.cache_dir
        )
        
        # Apply configuration optimizations
        if hasattr(model_config, "use_cache"):
            model_config.use_cache = False  # Disable cache for inference
            
        # Load model
        model = AutoModel.from_pretrained(
            config.model_id,
            config=model_config,
            cache_dir=config.cache_dir,
            torch_dtype=self._get_torch_dtype(config)
        )
        
        # Move to device
        device = torch.device(config.device)
        model = model.to(device)
        
        # Apply optimizations
        model = self._apply_pytorch_optimizations(model, config)
        
        # Set to eval mode
        model.eval()
        
        return model, tokenizer
        
    def _load_quantized_model(self, config: ModelConfig) -> Tuple[Any, Any]:
        """Load quantized model"""
        logger.info(f"Loading quantized model with {config.quantization} quantization")
        
        # Load base model first
        model, tokenizer = self._load_pytorch_model(config)
        
        if config.quantization == "int8":
            # Dynamic quantization
            model = torch.quantization.quantize_dynamic(
                model,
                {torch.nn.Linear},
                dtype=torch.qint8
            )
        elif config.quantization == "fp16":
            # Half precision
            model = model.half()
            
        return model, tokenizer
        
    def _load_onnx_model(self, config: ModelConfig) -> Tuple[Any, Any]:
        """Load ONNX model for optimized inference"""
        logger.info("Loading ONNX model")
        
        # Load tokenizer
        tokenizer = AutoTokenizer.from_pretrained(
            config.model_id,
            cache_dir=config.cache_dir
        )
        
        # ONNX model path
        onnx_path = Path(config.cache_dir or ".") / f"{config.name}.onnx"
        
        # Convert to ONNX if not exists
        if not onnx_path.exists():
            self._convert_to_onnx(config, onnx_path)
            
        # Create ONNX runtime session
        providers = ['CUDAExecutionProvider'] if config.device == "cuda" else ['CPUExecutionProvider']
        
        sess_options = ort.SessionOptions()
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        sess_options.intra_op_num_threads = config.num_threads
        
        session = ort.InferenceSession(
            str(onnx_path),
            sess_options,
            providers=providers
        )
        
        return session, tokenizer
        
    def _convert_to_onnx(self, config: ModelConfig, output_path: Path):
        """Convert PyTorch model to ONNX"""
        logger.info(f"Converting model to ONNX: {output_path}")
        
        # This is a placeholder - actual implementation would require
        # model-specific conversion logic
        raise NotImplementedError("ONNX conversion not implemented")
        
    def _apply_pytorch_optimizations(self, model: Any, config: ModelConfig) -> Any:
        """Apply PyTorch-specific optimizations"""
        if config.optimization_level == ModelOptimizationLevel.NONE:
            return model
            
        # Torch JIT optimization
        if config.optimization_level in [ModelOptimizationLevel.MODERATE, 
                                       ModelOptimizationLevel.AGGRESSIVE]:
            try:
                # Script the model for better performance
                model = torch.jit.script(model)
                logger.info("Applied TorchScript optimization")
            except Exception as e:
                logger.warning(f"Could not apply TorchScript: {e}")
                
        # Graph optimization
        if config.optimization_level in [ModelOptimizationLevel.AGGRESSIVE, 
                                       ModelOptimizationLevel.EXTREME]:
            try:
                # Fuse operations
                model = torch.jit.optimize_for_inference(model)
                logger.info("Applied graph optimization")
            except Exception as e:
                logger.warning(f"Could not apply graph optimization: {e}")
                
        return model
        
    def _get_torch_dtype(self, config: ModelConfig) -> torch.dtype:
        """Get torch dtype based on configuration"""
        if config.quantization == "fp16":
            return torch.float16
        elif config.device == "cpu":
            return torch.float32
        else:
            # Use fp16 on GPU if supported
            if self.optimization_settings["enable_mixed_precision"]:
                return torch.float16
            return torch.float32
            
    def get_batch_settings(self, name: str) -> Dict[str, int]:
        """Get optimal batch settings for a model"""
        if name not in self.configs:
            raise KeyError(f"Model config '{name}' not found")
            
        config = self.configs[name]
        
        # Adjust batch size based on available memory
        available_memory_mb = self.hardware_info["memory"]["available_gb"] * 1024
        
        if config.device == "cuda" and self.hardware_info["gpu"]["devices"]:
            # Use GPU memory for calculation
            gpu_memory_gb = self.hardware_info["gpu"]["devices"][0]["memory_gb"]
            available_memory_mb = gpu_memory_gb * 1024 * self.optimization_settings["gpu_memory_fraction"]
            
        # Estimate memory per sample (rough heuristic)
        memory_per_sample = config.max_sequence_length * 0.1  # MB
        
        # Calculate optimal batch size
        optimal_batch_size = min(
            config.batch_size,
            int(available_memory_mb * 0.5 / memory_per_sample)
        )
        
        return {
            "batch_size": max(1, optimal_batch_size),
            "max_sequence_length": config.max_sequence_length,
            "num_threads": config.num_threads
        }
        
    def _load_configs(self, config_file: str):
        """Load configurations from file"""
        with open(config_file, 'r') as f:
            configs = json.load(f)
            
        for name, config_dict in configs.items():
            config = ModelConfig(
                name=name,
                **config_dict
            )
            self.add_model_config(config)
            
    def save_configs(self, config_file: str):
        """Save configurations to file"""
        configs = {}
        for name, config in self.configs.items():
            configs[name] = {
                "model_id": config.model_id,
                "task": config.task,
                "format": config.format.value,
                "optimization_level": config.optimization_level.value,
                "quantization": config.quantization,
                "batch_size": config.batch_size,
                "max_sequence_length": config.max_sequence_length,
                "device": config.device,
                "num_threads": config.num_threads,
                "memory_limit_mb": config.memory_limit_mb,
                "custom_config": config.custom_config
            }
            
        with open(config_file, 'w') as f:
            json.dump(configs, f, indent=2)
            
    def get_deployment_info(self) -> Dict[str, Any]:
        """Get deployment information"""
        return {
            "hardware": self.hardware_info,
            "optimization_settings": self.optimization_settings,
            "models": {
                name: {
                    "model_id": config.model_id,
                    "optimization_level": config.optimization_level.value,
                    "device": config.device,
                    "batch_size": config.batch_size,
                    "memory_limit_mb": config.memory_limit_mb
                }
                for name, config in self.configs.items()
            }
        }


# Global instance
_production_config: Optional[ProductionModelConfig] = None


def get_production_model_config() -> ProductionModelConfig:
    """Get or create the global ProductionModelConfig instance"""
    global _production_config
    if _production_config is None:
        _production_config = ProductionModelConfig()
    return _production_config


# Example usage
if __name__ == "__main__":
    # Get production config
    config = get_production_model_config()
    
    # Get deployment info
    deployment_info = config.get_deployment_info()
    print(f"Deployment info: {json.dumps(deployment_info, indent=2)}")
    
    # Get optimized loader
    loader = config.get_optimized_model_loader("embeddings")
    
    # Get batch settings
    batch_settings = config.get_batch_settings("embeddings")
    print(f"Batch settings: {batch_settings}")
    
    # Save configurations
    config.save_configs("production_models.json")
