"""
Test script to verify core AI model components
"""

import sys
import os
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_model_config():
    """Test local_model_config.py"""
    logger.info("Testing local_model_config.py...")
    try:
        from local_model_config import MODEL_CONFIG, CACHE_DIR, get_model_config
        
        logger.info(f" Successfully imported local_model_config")
        logger.info(f"  - Cache directory: {CACHE_DIR}")
        logger.info(f"  - Number of configured models: {len(MODEL_CONFIG)}")
        
        # Test getting a model config
        job_sim_config = get_model_config("job_similarity")
        logger.info(f"  - Job similarity model: {job_sim_config['model_name']}")
        
        return True
    except Exception as e:
        logger.error(f" Failed to load local_model_config: {str(e)}")
        return False

def test_model_manager():
    """Test model_manager.py"""
    logger.info("\nTesting model_manager.py...")
    try:
        from model_manager import ModelManager, get_model_manager
        
        logger.info(f" Successfully imported model_manager")
        
        # Get manager instance
        manager = get_model_manager()
        logger.info(f"  - ModelManager instance created")
        logger.info(f"  - CPU threads: {manager.cpu_threads}")
        logger.info(f"  - Cache directory: {manager.model_cache_dir}")
        
        return True
    except Exception as e:
        logger.error(f" Failed to load model_manager: {str(e)}")
        return False

def test_model_loading():
    """Test loading an actual model"""
    logger.info("\nTesting model loading...")
    try:
        from model_manager import get_model_manager
        from local_model_config import CACHE_DIR
        
        manager = get_model_manager()
        
        # Try to load a small model
        logger.info("  - Attempting to load sentence-transformers/all-MiniLM-L6-v2...")
        model = manager.load_model(
            "sentence-transformers/all-MiniLM-L6-v2",
            model_type="sentence_transformer",
            config={"cache_dir": CACHE_DIR}
        )
        
        logger.info(f" Successfully loaded model")
        logger.info(f"  - Model type: {type(model).__name__}")
        
        # Test inference
        logger.info("  - Testing inference...")
        result = manager.get_inference(
            "sentence-transformers/all-MiniLM-L6-v2",
            "Test sentence for inference"
        )
        logger.info(f" Inference successful, output shape: {result.shape}")
        
        return True
    except Exception as e:
        logger.error(f" Failed to load/test model: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_inference_service():
    """Test local_inference_service.py"""
    logger.info("\nTesting local_inference_service.py...")
    try:
        from local_inference_service import LocalInferenceService, get_inference_service
        
        logger.info(f" Successfully imported local_inference_service")
        
        # Create service instance (without preloading to speed up test)
        service = LocalInferenceService(preload_models=False)
        logger.info(f"  - LocalInferenceService instance created")
        
        # Test a simple similarity analysis
        logger.info("  - Testing job similarity analysis...")
        result = service.analyze_job_similarity(
            "Python developer with machine learning experience",
            "Software engineer skilled in Python and AI",
            return_detailed_scores=False
        )
        
        logger.info(f" Similarity analysis successful, score: {result:.3f}")
        
        return True
    except Exception as e:
        logger.error(f" Failed to test inference service: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def check_model_files():
    """Check if model files exist"""
    logger.info("\nChecking model files...")
    try:
        from local_model_config import CACHE_DIR
        
        models_to_check = [
            "models--sentence-transformers--all-MiniLM-L6-v2",
            "models--distilbert-base-uncased",
            "models--dslim--bert-base-NER",
            "models--nlptown--bert-base-multilingual-uncased-sentiment"
        ]
        
        all_exist = True
        for model_dir in models_to_check:
            model_path = os.path.join(CACHE_DIR, model_dir)
            exists = os.path.exists(model_path)
            status = "" if exists else ""
            logger.info(f"  {status} {model_dir}: {'Found' if exists else 'Missing'}")
            if not exists:
                all_exist = False
        
        return all_exist
    except Exception as e:
        logger.error(f" Failed to check model files: {str(e)}")
        return False

def main():
    """Run all tests"""
    logger.info("="*60)
    logger.info("CORE AI COMPONENTS VERIFICATION")
    logger.info("="*60)
    
    results = {
        "Model Config": test_model_config(),
        "Model Manager": test_model_manager(),
        "Model Files": check_model_files(),
        "Model Loading": test_model_loading(),
        "Inference Service": test_inference_service()
    }
    
    logger.info("\n" + "="*60)
    logger.info("SUMMARY")
    logger.info("="*60)
    
    for component, status in results.items():
        status_str = " PASS" if status else " FAIL"
        logger.info(f"{component}: {status_str}")
    
    all_passed = all(results.values())
    
    if all_passed:
        logger.info("\n ALL CORE AI COMPONENTS ARE OPERATIONAL!")
    else:
        logger.info("\n Some components failed verification. Check logs above.")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
