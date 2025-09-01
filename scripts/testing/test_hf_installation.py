"""
Test script to verify HuggingFace transformers installation
"""
import torch
from transformers import pipeline, AutoTokenizer, AutoModel
from sentence_transformers import SentenceTransformer
import numpy as np

print("Testing HuggingFace Transformers installation...")
print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")

# Test 1: Basic pipeline
print("\n1. Testing basic pipeline...")
try:
    classifier = pipeline('sentiment-analysis')
    result = classifier('This is a great job opportunity!')
    print(f" Sentiment analysis pipeline works: {result}")
except Exception as e:
    print(f" Pipeline test failed: {e}")

# Test 2: Sentence Transformers
print("\n2. Testing Sentence Transformers...")
try:
    model = SentenceTransformer('all-MiniLM-L6-v2')
    embeddings = model.encode(['This is a test sentence', 'Another test sentence'])
    print(f" Sentence embeddings shape: {embeddings.shape}")
    print(f" Similarity score: {np.dot(embeddings[0], embeddings[1]):.4f}")
except Exception as e:
    print(f" Sentence Transformers test failed: {e}")

# Test 3: AutoModel and AutoTokenizer
print("\n3. Testing AutoModel and AutoTokenizer...")
try:
    tokenizer = AutoTokenizer.from_pretrained('distilbert-base-uncased')
    model = AutoModel.from_pretrained('distilbert-base-uncased')
    
    inputs = tokenizer("Testing model loading", return_tensors='pt')
    outputs = model(**inputs)
    print(f" DistilBERT model loaded successfully")
    print(f" Output shape: {outputs.last_hidden_state.shape}")
except Exception as e:
    print(f" AutoModel test failed: {e}")

print("\nAll tests completed!")
