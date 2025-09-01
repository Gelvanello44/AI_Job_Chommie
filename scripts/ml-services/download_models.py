"""
Download and cache essential HuggingFace models for local inference
"""
import os
from transformers import (
    AutoTokenizer, 
    AutoModel, 
    AutoModelForSequenceClassification,
    AutoModelForTokenClassification,
    pipeline
)
from sentence_transformers import SentenceTransformer
import torch

# Set cache directory
CACHE_DIR = os.path.join(os.path.dirname(__file__), 'local_models_cache')
os.makedirs(CACHE_DIR, exist_ok=True)

print(f"Models will be cached in: {CACHE_DIR}")

# List of models to download
MODELS_TO_DOWNLOAD = {
    'sentence_similarity': {
        'name': 'sentence-transformers/all-MiniLM-L6-v2',
        'type': 'sentence-transformer'
    },
    'text_classification': {
        'name': 'distilbert-base-uncased',
        'type': 'classification'
    },
    'ner': {
        'name': 'dslim/bert-base-NER',
        'type': 'token-classification'
    },
    'sentiment_analysis': {
        'name': 'nlptown/bert-base-multilingual-uncased-sentiment',
        'type': 'classification'
    }
}

def download_model(model_info, model_key):
    """Download and cache a model"""
    model_name = model_info['name']
    model_type = model_info['type']
    
    print(f"\n{'='*60}")
    print(f"Downloading {model_key}: {model_name}")
    print(f"Type: {model_type}")
    
    try:
        if model_type == 'sentence-transformer':
            # Download Sentence Transformer
            model = SentenceTransformer(model_name, cache_folder=CACHE_DIR)
            print(f" Downloaded {model_name}")
            
            # Test the model
            test_embedding = model.encode("Test sentence")
            print(f" Model works! Embedding shape: {test_embedding.shape}")
            
        elif model_type == 'classification':
            # Download classification model
            tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir=CACHE_DIR)
            model = AutoModelForSequenceClassification.from_pretrained(model_name, cache_dir=CACHE_DIR)
            print(f" Downloaded {model_name}")
            
            # Test the model
            inputs = tokenizer("Test sentence", return_tensors="pt")
            with torch.no_grad():
                outputs = model(**inputs)
            print(f" Model works! Output shape: {outputs.logits.shape}")
            
        elif model_type == 'token-classification':
            # Download NER model
            tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir=CACHE_DIR)
            model = AutoModelForTokenClassification.from_pretrained(model_name, cache_dir=CACHE_DIR)
            print(f" Downloaded {model_name}")
            
            # Test the model
            inputs = tokenizer("Test sentence", return_tensors="pt")
            with torch.no_grad():
                outputs = model(**inputs)
            print(f" Model works! Output shape: {outputs.logits.shape}")
            
    except Exception as e:
        print(f" Error downloading {model_name}: {e}")
        return False
    
    return True

def main():
    print("Starting model download process...")
    print(f"Using PyTorch version: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    
    successful_downloads = 0
    
    for model_key, model_info in MODELS_TO_DOWNLOAD.items():
        if download_model(model_info, model_key):
            successful_downloads += 1
    
    print(f"\n{'='*60}")
    print(f"Download complete! {successful_downloads}/{len(MODELS_TO_DOWNLOAD)} models downloaded successfully.")
    print(f"Models cached in: {CACHE_DIR}")
    
    # Create a config file for easy access to model paths
    config_content = f"""# Local Model Configuration
CACHE_DIR = r'{CACHE_DIR}'

MODELS = {{
    'sentence_similarity': 'sentence-transformers/all-MiniLM-L6-v2',
    'text_classification': 'distilbert-base-uncased',
    'ner': 'dslim/bert-base-NER',
    'sentiment_analysis': 'nlptown/bert-base-multilingual-uncased-sentiment'
}}
"""
    
    config_path = os.path.join(os.path.dirname(__file__), 'local_model_config.py')
    with open(config_path, 'w') as f:
        f.write(config_content)
    
    print(f"\nModel configuration saved to: {config_path}")

if __name__ == "__main__":
    main()
