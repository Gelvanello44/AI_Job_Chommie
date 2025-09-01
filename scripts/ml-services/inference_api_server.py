"""
FastAPI Server for Local AI Inference Service
Provides REST API endpoints for AI inference capabilities
"""

import os
import sys
import logging
import traceback
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
import time

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# Add current directory to path so we can import local modules
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

try:
    from local_inference_service import get_inference_service
    from local_model_config import MODEL_CONFIG, PERFORMANCE_SETTINGS
except ImportError as e:
    logging.error(f"Failed to import local inference modules: {e}")
    logging.error("Make sure all required Python packages are installed")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="AI Job Chommie - Local Inference API",
    description="High-performance local AI inference service for job matching and analysis",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure as needed for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global inference service instance
inference_service = None

# Pydantic models for API requests/responses
class TextAnalysisRequest(BaseModel):
    texts: Union[str, List[str]] = Field(..., description="Text(s) to analyze")
    batch_size: Optional[int] = Field(None, description="Batch size for processing")
    extract_keywords: bool = Field(False, description="Extract keywords from text")
    extract_entities: bool = Field(False, description="Extract named entities")
    extract_embeddings: bool = Field(False, description="Include embeddings in response")

class JobSimilarityRequest(BaseModel):
    job_descriptions: Union[str, List[str]] = Field(..., description="Job description(s)")
    candidate_texts: Union[str, List[str]] = Field(..., description="Candidate CV/profile text(s)")
    batch_size: Optional[int] = Field(None, description="Batch size for processing")
    return_detailed_scores: bool = Field(True, description="Return detailed similarity scores")

class PersonalityAnalysisRequest(BaseModel):
    texts: Union[str, List[str]] = Field(..., description="Text(s) to analyze for personality")
    batch_size: Optional[int] = Field(None, description="Batch size for processing")
    top_k: int = Field(5, description="Number of top personality traits to return")

class AdvancedAnalysisRequest(BaseModel):
    job_description: str = Field(..., description="Job description text")
    candidate_cv: str = Field(..., description="Candidate CV/resume text")
    analysis_depth: str = Field("comprehensive", description="Analysis depth: basic, standard, comprehensive")

class AdvancedJobSimilarityRequest(BaseModel):
    job_descriptions: Union[str, List[str]] = Field(..., description="Job description(s)")
    candidate_texts: Union[str, List[str]] = Field(..., description="Candidate CV/profile text(s)")
    industry: Optional[str] = Field(None, description="Industry hint for industry-specific embeddings")
    batch_size: Optional[int] = Field(None, description="Batch size for processing")
    return_detailed_scores: bool = Field(True, description="Return detailed similarity scores")
    priority: Optional[str] = Field(None, description="Optional priority flag (e.g., 'youth')")

class BatchAnalysisRequest(BaseModel):
    requests: List[Dict[str, Any]] = Field(..., description="List of analysis requests")
    max_concurrent: Optional[int] = Field(None, description="Maximum concurrent processing")

# API response models
class AnalysisResponse(BaseModel):
    success: bool = Field(..., description="Whether the analysis was successful")
    data: Optional[Dict[str, Any]] = Field(None, description="Analysis results")
    error: Optional[str] = Field(None, description="Error message if failed")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")

class HealthResponse(BaseModel):
    status: str = Field(..., description="Service health status")
    timestamp: str = Field(..., description="Response timestamp")
    service_info: Dict[str, Any] = Field(..., description="Service information")
    performance_metrics: Dict[str, Any] = Field(..., description="Performance metrics")

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize the inference service on startup"""
    global inference_service
    logger.info("Starting AI Inference Service...")
    
    try:
        # Initialize the inference service
        inference_service = get_inference_service()
        logger.info(" AI Inference Service started successfully")
        logger.info(" Service running in high-performance mode")
        
    except Exception as e:
        logger.error(f" Failed to start inference service: {str(e)}")
        logger.error(traceback.format_exc())
        raise

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    try:
        if inference_service is None:
            raise HTTPException(status_code=503, detail="Inference service not initialized")
        
        # Get performance metrics
        metrics = inference_service.get_performance_metrics()
        
        return HealthResponse(
            status="healthy",
            timestamp=datetime.now().isoformat(),
            service_info={
                "name": "AI Job Chommie - Local Inference API",
                "version": "1.0.0",
                "models_loaded": len(inference_service.model_manager.loaded_models),
                "max_workers": PERFORMANCE_SETTINGS.get("max_concurrent_requests", 4)
            },
            performance_metrics=metrics
        )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

# Metrics endpoint for monitoring
@app.get("/api/v1/metrics")
async def get_metrics():
    try:
        if inference_service is None:
            raise HTTPException(status_code=503, detail="Inference service not initialized")
        return inference_service.get_performance_metrics()
    except Exception as e:
        logger.error(f"Metrics retrieval failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Metrics retrieval failed: {str(e)}")

# Job similarity analysis endpoint
@app.post("/api/v1/job-similarity", response_model=AnalysisResponse)
async def analyze_job_similarity(request: JobSimilarityRequest):
    """Analyze similarity between job descriptions and candidate texts"""
    start_time = time.time()
    
    try:
        if inference_service is None:
            raise HTTPException(status_code=503, detail="Inference service not available")
        
        logger.info(f"Processing job similarity request with {len(request.job_descriptions) if isinstance(request.job_descriptions, list) else 1} jobs and {len(request.candidate_texts) if isinstance(request.candidate_texts, list) else 1} candidates")
        
        # Process similarity analysis
        result = inference_service.analyze_job_similarity(
            job_descriptions=request.job_descriptions,
            candidate_texts=request.candidate_texts,
            batch_size=request.batch_size,
            return_detailed_scores=request.return_detailed_scores
        )
        
        processing_time = (time.time() - start_time) * 1000
        
        return AnalysisResponse(
            success=True,
            data={
                "similarity_analysis": result,
                "job_count": len(request.job_descriptions) if isinstance(request.job_descriptions, list) else 1,
                "candidate_count": len(request.candidate_texts) if isinstance(request.candidate_texts, list) else 1
            },
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Job similarity analysis failed: {str(e)}")
        
        return AnalysisResponse(
            success=False,
            error=str(e),
            processing_time_ms=processing_time
        )

# Advanced industry-aware job similarity endpoint
@app.post("/api/v1/advanced-job-similarity", response_model=AnalysisResponse)
async def analyze_advanced_job_similarity(request: AdvancedJobSimilarityRequest):
    """Analyze similarity using industry-aware embeddings"""
    start_time = time.time()

    try:
        if inference_service is None:
            raise HTTPException(status_code=503, detail="Inference service not available")

        # For priority (e.g., youth), we can favor lower latency by reducing batch size
        batch_size = request.batch_size
        if request.priority == "youth" and (batch_size is None or batch_size > 8):
            batch_size = 8

        result = inference_service.analyze_job_similarity_with_industry(
            job_descriptions=request.job_descriptions,
            candidate_texts=request.candidate_texts,
            industry=request.industry,
            batch_size=batch_size,
            return_detailed_scores=request.return_detailed_scores
        )

        processing_time = (time.time() - start_time) * 1000

        return AnalysisResponse(
            success=True,
            data={
                "similarity_analysis": result,
                "industry": request.industry,
                "job_count": len(request.job_descriptions) if isinstance(request.job_descriptions, list) else 1,
                "candidate_count": len(request.candidate_texts) if isinstance(request.candidate_texts, list) else 1
            },
            processing_time_ms=processing_time
        )
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Advanced job similarity failed: {str(e)}")
        return AnalysisResponse(success=False, error=str(e), processing_time_ms=processing_time)

# Personality analysis endpoint
@app.post("/api/v1/personality", response_model=AnalysisResponse)
async def analyze_personality(request: PersonalityAnalysisRequest):
    """Analyze personality traits from text"""
    start_time = time.time()
    
    try:
        if inference_service is None:
            raise HTTPException(status_code=503, detail="Inference service not available")
        
        logger.info(f"Processing personality analysis for {len(request.texts) if isinstance(request.texts, list) else 1} texts")
        
        # Process personality analysis
        result = inference_service.analyze_personality(
            texts=request.texts,
            batch_size=request.batch_size,
            top_k=request.top_k
        )
        
        processing_time = (time.time() - start_time) * 1000
        
        return AnalysisResponse(
            success=True,
            data={
                "personality_analysis": result,
                "text_count": len(request.texts) if isinstance(request.texts, list) else 1
            },
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Personality analysis failed: {str(e)}")
        
        return AnalysisResponse(
            success=False,
            error=str(e),
            processing_time_ms=processing_time
        )

# Text features analysis endpoint
@app.post("/api/v1/text-features", response_model=AnalysisResponse)
async def analyze_text_features(request: TextAnalysisRequest):
    """Extract features from text including keywords, entities, and embeddings"""
    start_time = time.time()
    
    try:
        if inference_service is None:
            raise HTTPException(status_code=503, detail="Inference service not available")
        
        logger.info(f"Processing text feature analysis for {len(request.texts) if isinstance(request.texts, list) else 1} texts")
        
        # Process text features analysis
        result = inference_service.analyze_text_features(
            texts=request.texts,
            batch_size=request.batch_size,
            extract_keywords=request.extract_keywords,
            extract_entities=request.extract_entities,
            extract_embeddings=request.extract_embeddings
        )
        
        processing_time = (time.time() - start_time) * 1000
        
        return AnalysisResponse(
            success=True,
            data={
                "text_features": result,
                "text_count": len(request.texts) if isinstance(request.texts, list) else 1
            },
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Text features analysis failed: {str(e)}")
        
        return AnalysisResponse(
            success=False,
            error=str(e),
            processing_time_ms=processing_time
        )

# Advanced analysis pipeline endpoint
@app.post("/api/v1/advanced-analysis", response_model=AnalysisResponse)
async def advanced_analysis_pipeline(request: AdvancedAnalysisRequest):
    """Run comprehensive analysis pipeline combining multiple AI models"""
    start_time = time.time()
    
    try:
        if inference_service is None:
            raise HTTPException(status_code=503, detail="Inference service not available")
        
        logger.info(f"Processing advanced analysis pipeline with depth: {request.analysis_depth}")
        
        # Process advanced analysis
        result = inference_service.advanced_analysis_pipeline(
            job_description=request.job_description,
            candidate_cv=request.candidate_cv,
            analysis_depth=request.analysis_depth
        )
        
        processing_time = (time.time() - start_time) * 1000
        
        return AnalysisResponse(
            success=True,
            data=result,
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Advanced analysis failed: {str(e)}")
        
        return AnalysisResponse(
            success=False,
            error=str(e),
            processing_time_ms=processing_time
        )

# Batch processing endpoint
@app.post("/api/v1/batch-analysis", response_model=AnalysisResponse)
async def batch_analysis(request: BatchAnalysisRequest):
    """Process multiple analysis requests concurrently"""
    start_time = time.time()
    
    try:
        if inference_service is None:
            raise HTTPException(status_code=503, detail="Inference service not available")
        
        logger.info(f"Processing batch analysis with {len(request.requests)} requests")
        
        # Process batch analysis
        result = inference_service.batch_process_multiple(
            requests=request.requests,
            max_concurrent=request.max_concurrent if request.max_concurrent is not None else None
        )
        
        processing_time = (time.time() - start_time) * 1000
        
        return AnalysisResponse(
            success=True,
            data={
                "batch_results": result,
                "request_count": len(request.requests)
            },
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Batch analysis failed: {str(e)}")
        
        return AnalysisResponse(
            success=False,
            error=str(e),
            processing_time_ms=processing_time
        )


# Root endpoint with service information
@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "AI Job Chommie - Local Inference API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "health": "/health",
        "endpoints": [
            "/api/v1/job-similarity",
            "/api/v1/advanced-job-similarity",
            "/api/v1/personality", 
            "/api/v1/text-features",
            "/api/v1/advanced-analysis",
            "/api/v1/batch-analysis",
            "/api/v1/metrics"
        ]
    }

# Graceful shutdown
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    global inference_service
    logger.info("Shutting down AI Inference Service...")
    
    if inference_service:
        inference_service.shutdown()
    
    logger.info(" AI Inference Service shutdown complete")

if __name__ == "__main__":
    # Get configuration from environment
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("MODEL_API_PORT", "5000"))
    workers = int(os.getenv("MODEL_WORKERS", "1"))  # Use 1 worker for local deployment
    
    logger.info(" Starting AI Job Chommie Local Inference API Server...")
    logger.info(f" Host: {host}:{port}")
    logger.info(f" Workers: {workers}")
    logger.info(f" Documentation available at: http://{host}:{port}/docs")
    
    # Run the server
    uvicorn.run(
        "inference_api_server:app",
        host=host,
        port=port,
        workers=workers,
        log_level="info",
        access_log=True,
        reload=False  # Don't use reload in production
    )
