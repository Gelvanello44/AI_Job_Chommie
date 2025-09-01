# Local Model Configuration
from typing import Optional
CACHE_DIR = r'C:\Users\user\Downloads\home\ubuntu\ai-job-chommie-landing\local_models_cache'

# Updated configuration to match inference service expectations
# Includes industry-specific embedding models and pipelines for personality/text analysis
MODEL_CONFIG = {
    # General-purpose job similarity (default)
    'job_similarity': {
        'model_name': 'sentence-transformers/all-MiniLM-L6-v2',
        'model_type': 'sentence_transformer',
        'task': 'sentence-similarity'
    },

    # Industry-specific similarity models (override-able by industry)
    'job_similarity_tech': {
        'model_name': 'sentence-transformers/all-MiniLM-L6-v2',
        'model_type': 'sentence_transformer',
        'task': 'sentence-similarity'
    },
    'job_similarity_finance': {
        'model_name': 'sentence-transformers/paraphrase-MiniLM-L6-v2',
        'model_type': 'sentence_transformer',
        'task': 'sentence-similarity'
    },
    'job_similarity_healthcare': {
        'model_name': 'sentence-transformers/paraphrase-MiniLM-L6-v2',
        'model_type': 'sentence_transformer',
        'task': 'sentence-similarity'
    },
    'job_similarity_marketing': {
        'model_name': 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
        'model_type': 'sentence_transformer',
        'task': 'sentence-similarity'
    },
    'job_similarity_sales': {
        'model_name': 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
        'model_type': 'sentence_transformer',
        'task': 'sentence-similarity'
    },

    # Text analysis embeddings (used for keyword/entity context, features)
    'text_analysis': {
        'model_name': 'sentence-transformers/all-MiniLM-L6-v2',
        'model_type': 'sentence_transformer',
        'task': 'sentence-embeddings'
    },

    # Pipelines
    'text_classification': {
        'model_name': 'distilbert-base-uncased',
        'model_type': 'classification',
        'task': 'text-classification'
    },
    'ner': {
        'model_name': 'dslim/bert-base-NER',
        'model_type': 'token-classification',
        'task': 'token-classification'
    },
    'sentiment_analysis': {
        'model_name': 'nlptown/bert-base-multilingual-uncased-sentiment',
        'model_type': 'pipeline',
        'task': 'sentiment-analysis'
    },
    # Personality analysis uses a text-classification pipeline; model is a placeholder
    'personality_analysis': {
        'model_name': 'joeddav/distilbert-base-uncased-go-emotions-student',
        'model_type': 'pipeline',
        'task': 'text-classification'
    }
}

# Map general industry names to model keys
INDUSTRY_MODEL_MAP = {
    'tech': 'job_similarity_tech',
    'software': 'job_similarity_tech',
    'engineering': 'job_similarity_tech',
    'it': 'job_similarity_tech',
    'finance': 'job_similarity_finance',
    'banking': 'job_similarity_finance',
    'fintech': 'job_similarity_finance',
    'health': 'job_similarity_healthcare',
    'healthcare': 'job_similarity_healthcare',
    'medical': 'job_similarity_healthcare',
    'marketing': 'job_similarity_marketing',
    'communications': 'job_similarity_marketing',
    'sales': 'job_similarity_sales',
    'retail': 'job_similarity_sales'
}

PERFORMANCE_SETTINGS = {
    'max_concurrent_requests': 4,
    'batch_size': 16,
    'enable_caching': True,
    'cache_ttl_seconds': 3600
}

PRELOAD_CONFIG = {
    'enable_warmup_inference': True,
    'warmup_samples': [
        'Software Engineer with 5 years of Python experience',
        'Data Scientist role requiring machine learning expertise',
        'Full-stack developer needed for React and Node.js project'
    ]
}

def get_optimal_batch_size(task_type: str, input_count: int) -> int:
    """Get optimal batch size for a task"""
    base_batch_size = PERFORMANCE_SETTINGS['batch_size']
    if input_count < base_batch_size:
        return input_count
    return base_batch_size

def get_model_config(model_key: str) -> dict:
    """Get model configuration by key"""
    return MODEL_CONFIG.get(model_key, {})

def get_model_config_by_industry(industry: Optional[str]) -> dict:
    """Return a model config based on an industry hint"""
    if not industry:
        return MODEL_CONFIG.get('job_similarity', {})
    key = INDUSTRY_MODEL_MAP.get(industry.lower().strip())
    if key and key in MODEL_CONFIG:
        return MODEL_CONFIG[key]
    # Try fuzzy lookup by simple containment
    for k, v in INDUSTRY_MODEL_MAP.items():
        if k in industry.lower():
            if v in MODEL_CONFIG:
                return MODEL_CONFIG[v]
    return MODEL_CONFIG.get('job_similarity', {})

# Legacy models dict for backward compatibility
MODELS = {
    'sentence_similarity': 'sentence-transformers/all-MiniLM-L6-v2',
    'text_classification': 'distilbert-base-uncased',
    'ner': 'dslim/bert-base-NER',
    'sentiment_analysis': 'nlptown/bert-base-multilingual-uncased-sentiment'
}
