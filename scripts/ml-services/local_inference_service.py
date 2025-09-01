"""
High-Performance Local Inference Service
Maximizes local model capabilities with concurrent processing and caching
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional, Tuple, Union
import numpy as np
from datetime import datetime
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import lru_cache
import hashlib

from model_manager import ModelManager, get_model_manager
from local_model_config import (
    MODEL_CONFIG, PERFORMANCE_SETTINGS, PRELOAD_CONFIG,
    get_optimal_batch_size, get_model_config, get_model_config_by_industry,
    INDUSTRY_MODEL_MAP
)

logger = logging.getLogger(__name__)


class LocalInferenceService:
    """
    High-performance inference service that leverages pre-loaded models,
    concurrent processing, and intelligent caching for maximum throughput
    """
    
    def __init__(self, preload_models: bool = True):
        """Initialize service with optional model preloading"""
        logger.info("Initializing LocalInferenceService with full power mode...")
        
        # Get model manager instance
        self.model_manager = get_model_manager()
        
        # Result caching
        self._cache_enabled = True
        self._result_cache = {}
        self._cache_hits = 0
        self._cache_misses = 0
        
        # Performance tracking
        self.performance_metrics = {
            "total_requests": 0,
            "avg_response_time": 0,
            "cache_hit_rate": 0,
            "concurrent_requests": 0,
            "total_processing_time": 0
        }
        
        # Thread pool for concurrent processing
        self.executor = ThreadPoolExecutor(
            max_workers=PERFORMANCE_SETTINGS["max_concurrent_requests"]
        )
        
        # Preload models if requested
        if preload_models:
            self._preload_all_models()
        
        logger.info("LocalInferenceService initialized successfully")
    
    def _preload_all_models(self):
        """Preload all configured models for instant access"""
        logger.info("Preloading all models for instant inference...")
        
        # Build model configs for preloading
        model_configs = []
        for model_key, config in MODEL_CONFIG.items():
            model_configs.append({
                "model_name": config["model_name"],
                "model_type": config["model_type"],
                **config
            })
        
        # Preload models concurrently
        futures = self.model_manager.preload_models(model_configs)
        
        # Wait for all models to load
        for model_name, future in futures.items():
            try:
                future.result()
                logger.info(f"Model {model_name} preloaded successfully")
            except Exception as e:
                logger.error(f"Failed to preload model {model_name}: {str(e)}")
        
        # Warm up models if configured
        if PRELOAD_CONFIG.get("enable_warmup_inference", True):
            self._warmup_models()
    
    def _warmup_models(self):
        """Warm up models with sample inference"""
        logger.info("Warming up models...")
        
        warmup_samples = PRELOAD_CONFIG.get("warmup_samples", [])
        if not warmup_samples:
            warmup_samples = ["Sample warmup text for model initialization."]
        
        # Warm up job similarity model
        try:
            self.analyze_job_similarity(warmup_samples, warmup_samples)
            logger.info("Job similarity model warmed up")
        except Exception as e:
            logger.warning(f"Failed to warm up job similarity model: {str(e)}")
        
        # Warm up personality analysis model
        try:
            self.analyze_personality(warmup_samples)
            logger.info("Personality analysis model warmed up")
        except Exception as e:
            logger.warning(f"Failed to warm up personality model: {str(e)}")
    
    def analyze_job_similarity(
        self,
        job_descriptions: Union[str, List[str]],
        candidate_texts: Union[str, List[str]],
        batch_size: Optional[int] = None,
        return_detailed_scores: bool = True
    ) -> Union[float, List[Dict[str, Any]]]:
        """
        Analyze similarity between job descriptions and candidate texts
        Uses pre-loaded all-MiniLM-L6-v2 model for instant inference
        """
        start_time = time.time()
        
        # Convert single strings to lists
        if isinstance(job_descriptions, str):
            job_descriptions = [job_descriptions]
        if isinstance(candidate_texts, str):
            candidate_texts = [candidate_texts]
        
        # Get optimal batch size
        if batch_size is None:
            batch_size = get_optimal_batch_size(
                "job_similarity", 
                len(job_descriptions) + len(candidate_texts)
            )
        
        try:
            # Get embeddings for job descriptions
            job_config = get_model_config("job_similarity")
            job_embeddings = self.model_manager.get_inference(
                job_config["model_name"],
                job_descriptions,
                batch_size=batch_size
            )
            
            # Get embeddings for candidate texts
            candidate_embeddings = self.model_manager.get_inference(
                job_config["model_name"],
                candidate_texts,
                batch_size=batch_size
            )
            
            # Calculate similarities
            similarities = self._calculate_similarities(
                job_embeddings, 
                candidate_embeddings
            )
            
            # Update metrics
            self._update_metrics(time.time() - start_time)
            
            if not return_detailed_scores:
                # Return average similarity
                return float(np.mean(similarities))
            
            # Return detailed results
            results = []
            for i, job_desc in enumerate(job_descriptions):
                for j, candidate_text in enumerate(candidate_texts):
                    results.append({
                        "job_index": i,
                        "candidate_index": j,
                        "similarity_score": float(similarities[i, j]),
                        "confidence": self._calculate_confidence(similarities[i, j]),
                        "match_level": self._get_match_level(similarities[i, j]),
                        "processing_time_ms": (time.time() - start_time) * 1000
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Error in job similarity analysis: {str(e)}")
            raise
    
    def analyze_job_similarity_with_industry(
        self,
        job_descriptions: Union[str, List[str]],
        candidate_texts: Union[str, List[str]],
        industry: Optional[str] = None,
        batch_size: Optional[int] = None,
        return_detailed_scores: bool = True
    ) -> Union[float, List[Dict[str, Any]]]:
        """
        Analyze similarity between job descriptions and candidate texts
        Uses industry-specific embeddings for better domain accuracy
        """
        start_time = time.time()
        
        # Convert single strings to lists
        if isinstance(job_descriptions, str):
            job_descriptions = [job_descriptions]
        if isinstance(candidate_texts, str):
            candidate_texts = [candidate_texts]
        
        # Get optimal batch size
        if batch_size is None:
            batch_size = get_optimal_batch_size(
                "job_similarity", 
                len(job_descriptions) + len(candidate_texts)
            )
        
        try:
            # Get industry-specific model config
            job_config = get_model_config_by_industry(industry)
            
            logger.info(f"Using model {job_config.get('model_name')} for industry: {industry or 'general'}")
            
            # Get embeddings for job descriptions
            job_embeddings = self.model_manager.get_inference(
                job_config["model_name"],
                job_descriptions,
                batch_size=batch_size
            )
            
            # Get embeddings for candidate texts
            candidate_embeddings = self.model_manager.get_inference(
                job_config["model_name"],
                candidate_texts,
                batch_size=batch_size
            )
            
            # Calculate similarities
            similarities = self._calculate_similarities(
                job_embeddings, 
                candidate_embeddings
            )
            
            # Update metrics
            self._update_metrics(time.time() - start_time)
            
            if not return_detailed_scores:
                # Return average similarity
                return float(np.mean(similarities))
            
            # Return detailed results with industry context
            results = []
            for i, job_desc in enumerate(job_descriptions):
                for j, candidate_text in enumerate(candidate_texts):
                    results.append({
                        "job_index": i,
                        "candidate_index": j,
                        "similarity_score": float(similarities[i, j]),
                        "confidence": self._calculate_confidence(similarities[i, j]),
                        "match_level": self._get_match_level(similarities[i, j]),
                        "industry": industry,
                        "model_used": job_config.get('model_name'),
                        "processing_time_ms": (time.time() - start_time) * 1000
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Error in industry-specific similarity analysis: {str(e)}")
            raise
    
    def analyze_personality(
        self,
        texts: Union[str, List[str]],
        batch_size: Optional[int] = None,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Analyze personality traits from text using pre-loaded distilbert model
        Processes multiple texts simultaneously for maximum efficiency
        """
        start_time = time.time()
        
        if isinstance(texts, str):
            texts = [texts]
        
        # Get optimal batch size
        if batch_size is None:
            batch_size = get_optimal_batch_size("personality_analysis", len(texts))
        
        try:
            # Get personality analysis config
            personality_config = get_model_config("personality_analysis")
            
            # Perform inference
            results = self.model_manager.get_inference(
                personality_config["model_name"],
                texts,
                batch_size=batch_size
            )
            
            # Process results
            processed_results = []
            for i, text in enumerate(texts):
                if i < len(results):
                    # Extract top personality traits
                    scores = results[i]
                    if isinstance(scores, list) and scores:
                        # Sort by score and get top k
                        sorted_traits = sorted(
                            scores,
                            key=lambda x: x.get('score', 0),
                            reverse=True
                        )[:top_k]
                        
                        processed_results.append({
                            "text_index": i,
                            "personality_traits": sorted_traits,
                            "dominant_trait": sorted_traits[0] if sorted_traits else None,
                            "trait_diversity": self._calculate_trait_diversity(sorted_traits),
                            "confidence_score": self._calculate_overall_confidence(sorted_traits),
                            "processing_time_ms": (time.time() - start_time) * 1000
                        })
                    else:
                        processed_results.append({
                            "text_index": i,
                            "error": "No results returned",
                            "processing_time_ms": (time.time() - start_time) * 1000
                        })
            
            # Update metrics
            self._update_metrics(time.time() - start_time)
            
            return processed_results
            
        except Exception as e:
            logger.error(f"Error in personality analysis: {str(e)}")
            raise
    
    def analyze_text_features(
        self,
        texts: Union[str, List[str]],
        extract_keywords: bool = True,
        extract_entities: bool = True,
        extract_embeddings: bool = True,
        batch_size: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Comprehensive text analysis using full model capabilities
        Extracts rich feature sets for advanced NLP tasks
        """
        start_time = time.time()
        
        if isinstance(texts, str):
            texts = [texts]
        
        # Get optimal batch size
        if batch_size is None:
            batch_size = get_optimal_batch_size("text_analysis", len(texts))
        
        try:
            results = []
            
            # Get text analysis config
            text_config = get_model_config("text_analysis")
            
            # Extract embeddings if requested
            if extract_embeddings:
                embeddings = self.model_manager.get_inference(
                    text_config["model_name"],
                    texts,
                    batch_size=batch_size
                )
            else:
                embeddings = [None] * len(texts)
            
            # Process each text
            for i, text in enumerate(texts):
                result = {
                    "text_index": i,
                    "text_length": len(text),
                    "processing_time_ms": (time.time() - start_time) * 1000
                }
                
                if extract_keywords:
                    # Extract keywords using TF-IDF or similar
                    result["keywords"] = self._extract_keywords(text)
                
                if extract_entities:
                    # Extract named entities
                    result["entities"] = self._extract_entities(text)
                
                if extract_embeddings and i < len(embeddings):
                    result["embedding_shape"] = embeddings[i].shape if hasattr(embeddings[i], 'shape') else None
                    result["embedding_norm"] = float(np.linalg.norm(embeddings[i])) if embeddings[i] is not None else None
                
                # Add text statistics
                result["statistics"] = {
                    "word_count": len(text.split()),
                    "sentence_count": len([s for s in text.split('.') if s.strip()]),
                    "avg_word_length": np.mean([len(w) for w in text.split()]) if text.split() else 0
                }
                
                results.append(result)
            
            # Update metrics
            self._update_metrics(time.time() - start_time)
            
            return results
            
        except Exception as e:
            logger.error(f"Error in text feature analysis: {str(e)}")
            raise
    
    def batch_process_multiple(
        self,
        requests: List[Dict[str, Any]],
        max_concurrent: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Process multiple different analysis requests concurrently
        Optimizes batch sizes and leverages concurrent processing
        """
        start_time = time.time()
        
        if max_concurrent is None:
            max_concurrent = PERFORMANCE_SETTINGS["max_concurrent_requests"]
        
        # Group requests by type for optimal batching
        grouped_requests = self._group_requests_by_type(requests)
        
        # Process groups concurrently
        futures = []
        results = {}
        
        with ThreadPoolExecutor(max_workers=max_concurrent) as executor:
            # Submit all grouped requests
            for request_type, request_group in grouped_requests.items():
                if request_type == "job_similarity":
                    future = executor.submit(
                        self._batch_process_similarity,
                        request_group
                    )
                elif request_type == "personality":
                    future = executor.submit(
                        self._batch_process_personality,
                        request_group
                    )
                elif request_type == "text_features":
                    future = executor.submit(
                        self._batch_process_text_features,
                        request_group
                    )
                else:
                    continue
                
                futures.append((request_type, request_group, future))
            
            # Collect results as they complete
            for request_type, request_group, future in futures:
                try:
                    group_results = future.result()
                    # Map results back to original request IDs
                    for i, req in enumerate(request_group):
                        if i < len(group_results):
                            results[req.get("id", str(i))] = group_results[i]
                except Exception as e:
                    logger.error(f"Error processing {request_type} batch: {str(e)}")
                    # Add error results for failed requests
                    for req in request_group:
                        results[req.get("id", str(i))] = {
                            "error": str(e),
                            "request_type": request_type
                        }
        
        # Update metrics
        self._update_metrics(time.time() - start_time)
        
        # Return results in original request order
        ordered_results = []
        for request in requests:
            req_id = request.get("id", str(requests.index(request)))
            ordered_results.append(results.get(req_id, {"error": "Not processed"}))
        
        return ordered_results
    
    def advanced_analysis_pipeline(
        self,
        job_description: str,
        candidate_cv: str,
        analysis_depth: str = "comprehensive"
    ) -> Dict[str, Any]:
        """
        Sophisticated multi-model analysis pipeline for comprehensive job matching
        Combines multiple models for deep insights
        """
        start_time = time.time()
        pipeline_results = {}
        
        try:
            # Stage 1: Similarity Analysis
            similarity_future = self.executor.submit(
                self.analyze_job_similarity,
                job_description,
                candidate_cv,
                return_detailed_scores=True
            )
            
            # Stage 2: Personality Analysis (concurrent)
            personality_future = self.executor.submit(
                self.analyze_personality,
                [job_description, candidate_cv]
            )
            
            # Stage 3: Text Feature Extraction (concurrent)
            features_future = self.executor.submit(
                self.analyze_text_features,
                [job_description, candidate_cv],
                extract_keywords=True,
                extract_entities=True
            )
            
            # Collect results
            similarity_results = similarity_future.result()
            personality_results = personality_future.result()
            feature_results = features_future.result()
            
            # Combine results
            pipeline_results = {
                "overall_match_score": similarity_results[0]["similarity_score"] if similarity_results else 0,
                "match_confidence": similarity_results[0]["confidence"] if similarity_results else 0,
                "match_level": similarity_results[0]["match_level"] if similarity_results else "unknown",
                
                "personality_alignment": self._calculate_personality_alignment(
                    personality_results[0] if personality_results else {},
                    personality_results[1] if len(personality_results) > 1 else {}
                ),
                
                "keyword_overlap": self._calculate_keyword_overlap(
                    feature_results[0].get("keywords", []) if feature_results else [],
                    feature_results[1].get("keywords", []) if len(feature_results) > 1 else []
                ),
                
                "detailed_analysis": {
                    "similarity_details": similarity_results,
                    "personality_details": personality_results,
                    "feature_details": feature_results
                },
                
                "recommendations": self._generate_recommendations(
                    similarity_results,
                    personality_results,
                    feature_results
                ),
                
                "processing_time_ms": (time.time() - start_time) * 1000,
                "analysis_depth": analysis_depth
            }
            
            # Add comprehensive insights if requested
            if analysis_depth == "comprehensive":
                pipeline_results["comprehensive_insights"] = self._generate_comprehensive_insights(
                    pipeline_results
                )
            
            # Update metrics
            self._update_metrics(time.time() - start_time)
            
            return pipeline_results
            
        except Exception as e:
            logger.error(f"Error in advanced analysis pipeline: {str(e)}")
            raise
    
    # Helper methods
    
    def _calculate_similarities(self, embeddings1: np.ndarray, 
                              embeddings2: np.ndarray) -> np.ndarray:
        """Calculate cosine similarities between embedding sets"""
        # Ensure embeddings are 2D
        if len(embeddings1.shape) == 1:
            embeddings1 = embeddings1.reshape(1, -1)
        if len(embeddings2.shape) == 1:
            embeddings2 = embeddings2.reshape(1, -1)
        
        # Normalize embeddings
        embeddings1 = embeddings1 / np.linalg.norm(embeddings1, axis=1, keepdims=True)
        embeddings2 = embeddings2 / np.linalg.norm(embeddings2, axis=1, keepdims=True)
        
        # Calculate cosine similarity
        similarities = np.dot(embeddings1, embeddings2.T)
        
        return similarities
    
    def _calculate_confidence(self, similarity_score: float) -> float:
        """Calculate confidence score based on similarity"""
        # High confidence for very high or very low similarities
        if similarity_score > 0.9 or similarity_score < 0.1:
            return 0.95
        elif similarity_score > 0.8 or similarity_score < 0.2:
            return 0.85
        elif similarity_score > 0.7 or similarity_score < 0.3:
            return 0.75
        else:
            return 0.65
    
    def _get_match_level(self, similarity_score: float) -> str:
        """Determine match level based on similarity score"""
        if similarity_score >= 0.9:
            return "excellent"
        elif similarity_score >= 0.8:
            return "very_good"
        elif similarity_score >= 0.7:
            return "good"
        elif similarity_score >= 0.6:
            return "moderate"
        elif similarity_score >= 0.5:
            return "fair"
        else:
            return "poor"
    
    def _calculate_trait_diversity(self, traits: List[Dict]) -> float:
        """Calculate diversity of personality traits"""
        if not traits or len(traits) < 2:
            return 0.0
        
        scores = [t.get('score', 0) for t in traits]
        if not scores:
            return 0.0
        
        # Calculate standard deviation as measure of diversity
        return float(np.std(scores))
    
    def _calculate_overall_confidence(self, traits: List[Dict]) -> float:
        """Calculate overall confidence from trait scores"""
        if not traits:
            return 0.0
        
        scores = [t.get('score', 0) for t in traits]
        if not scores:
            return 0.0
        
        # Average of top scores as confidence
        top_scores = sorted(scores, reverse=True)[:3]
        return float(np.mean(top_scores))
    
    def _extract_keywords(self, text: str, max_keywords: int = 10) -> List[str]:
        """Extract keywords from text (simplified implementation)"""
        # Simple keyword extraction based on word frequency
        words = text.lower().split()
        word_freq = {}
        
        stopwords = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were'}
        
        for word in words:
            word = word.strip('.,!?;:"')
            if word and word not in stopwords and len(word) > 2:
                word_freq[word] = word_freq.get(word, 0) + 1
        
        # Sort by frequency
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        
        return [word for word, freq in sorted_words[:max_keywords]]
    
    def _extract_entities(self, text: str) -> List[Dict[str, str]]:
        """Extract named entities from text (simplified implementation)"""
        # Simplified entity extraction - would use NER model in production
        entities = []
        
        # Look for capitalized words as potential entities
        words = text.split()
        for i, word in enumerate(words):
            if word[0].isupper() and i > 0:
                entities.append({
                    "text": word,
                    "type": "MISC",
                    "position": i
                })
        
        return entities[:10]  # Limit to 10 entities
    
    def _group_requests_by_type(self, requests: List[Dict]) -> Dict[str, List[Dict]]:
        """Group requests by type for batch processing"""
        grouped = {}
        
        for request in requests:
            req_type = request.get("type", "unknown")
            if req_type not in grouped:
                grouped[req_type] = []
            grouped[req_type].append(request)
        
        return grouped
    
    def _batch_process_similarity(self, requests: List[Dict]) -> List[Dict]:
        """Batch process similarity requests"""
        all_job_descs = []
        all_candidates = []
        request_indices = []
        
        for i, req in enumerate(requests):
            all_job_descs.append(req.get("job_description", ""))
            all_candidates.append(req.get("candidate_text", ""))
            request_indices.append(i)
        
        # Process all at once
        results = self.analyze_job_similarity(
            all_job_descs,
            all_candidates,
            return_detailed_scores=True
        )
        
        # Map results back to requests
        processed_results = []
        for i in range(len(requests)):
            matching_results = [r for r in results if r["job_index"] == i and r["candidate_index"] == i]
            if matching_results:
                processed_results.append(matching_results[0])
            else:
                processed_results.append({"error": "No matching result found"})
        
        return processed_results
    
    def _batch_process_personality(self, requests: List[Dict]) -> List[Dict]:
        """Batch process personality requests"""
        all_texts = [req.get("text", "") for req in requests]
        
        results = self.analyze_personality(all_texts)
        
        return results
    
    def _batch_process_text_features(self, requests: List[Dict]) -> List[Dict]:
        """Batch process text feature requests"""
        all_texts = [req.get("text", "") for req in requests]
        
        results = self.analyze_text_features(
            all_texts,
            extract_keywords=True,
            extract_entities=True
        )
        
        return results
    
    def _calculate_personality_alignment(self, personality1: Dict, personality2: Dict) -> Dict[str, Any]:
        """Calculate alignment between two personality profiles"""
        if not personality1 or not personality2:
            return {"alignment_score": 0, "compatible_traits": []}
        
        traits1 = personality1.get("personality_traits", [])
        traits2 = personality2.get("personality_traits", [])
        
        if not traits1 or not traits2:
            return {"alignment_score": 0, "compatible_traits": []}
        
        # Find common traits
        trait_names1 = {t.get("label", ""): t.get("score", 0) for t in traits1}
        trait_names2 = {t.get("label", ""): t.get("score", 0) for t in traits2}
        
        common_traits = set(trait_names1.keys()) & set(trait_names2.keys())
        
        if not common_traits:
            return {"alignment_score": 0, "compatible_traits": []}
        
        # Calculate alignment score
        alignment_scores = []
        compatible_traits = []
        
        for trait in common_traits:
            score1 = trait_names1[trait]
            score2 = trait_names2[trait]
            alignment = 1 - abs(score1 - score2)
            alignment_scores.append(alignment)
            
            if alignment > 0.7:
                compatible_traits.append({
                    "trait": trait,
                    "alignment": alignment,
                    "scores": [score1, score2]
                })
        
        return {
            "alignment_score": float(np.mean(alignment_scores)) if alignment_scores else 0,
            "compatible_traits": compatible_traits,
            "trait_overlap": len(common_traits) / max(len(trait_names1), len(trait_names2))
        }
    
    def _calculate_keyword_overlap(self, keywords1: List[str], keywords2: List[str]) -> Dict[str, Any]:
        """Calculate overlap between keyword sets"""
        if not keywords1 or not keywords2:
            return {"overlap_score": 0, "common_keywords": []}
        
        set1 = set(keywords1)
        set2 = set(keywords2)
        
        common = set1 & set2
        union = set1 | set2
        
        return {
            "overlap_score": len(common) / len(union) if union else 0,
            "common_keywords": list(common),
            "unique_to_job": list(set1 - set2),
            "unique_to_candidate": list(set2 - set1)
        }
    
    def _generate_recommendations(self, similarity_results: List[Dict],
                                 personality_results: List[Dict],
                                 feature_results: List[Dict]) -> List[str]:
        """Generate recommendations based on analysis results"""
        recommendations = []
        
        # Based on similarity score
        if similarity_results and similarity_results[0]["similarity_score"] > 0.8:
            recommendations.append("Strong match: Consider for immediate interview")
        elif similarity_results and similarity_results[0]["similarity_score"] > 0.7:
            recommendations.append("Good match: Review for potential interview")
        elif similarity_results and similarity_results[0]["similarity_score"] < 0.5:
            recommendations.append("Weak match: May not meet job requirements")
        
        # Based on personality
        if personality_results and len(personality_results) >= 2:
            if personality_results[0].get("dominant_trait") == personality_results[1].get("dominant_trait"):
                recommendations.append("Personality alignment detected")
        
        # Based on keywords
        if feature_results and len(feature_results) >= 2:
            job_keywords = feature_results[0].get("keywords", [])
            candidate_keywords = feature_results[1].get("keywords", [])
            overlap = len(set(job_keywords) & set(candidate_keywords))
            
            if overlap > 5:
                recommendations.append("Strong keyword match in skills and experience")
            elif overlap < 2:
                recommendations.append("Limited keyword overlap - review skill alignment")
        
        return recommendations
    
    def _generate_comprehensive_insights(self, results: Dict) -> Dict[str, Any]:
        """Generate comprehensive insights from pipeline results"""
        insights = {
            "summary": "",
            "strengths": [],
            "concerns": [],
            "interview_focus_areas": []
        }
        
        # Overall assessment
        match_score = results.get("overall_match_score", 0)
        if match_score > 0.8:
            insights["summary"] = "Excellent candidate with strong alignment to job requirements"
            insights["strengths"].append("High technical and experiential match")
        elif match_score > 0.7:
            insights["summary"] = "Good candidate with solid alignment to core requirements"
            insights["strengths"].append("Meets most job requirements")
        else:
            insights["summary"] = "Candidate shows limited alignment with job requirements"
            insights["concerns"].append("Significant gaps in required skills or experience")
        
        # Personality insights
        personality_alignment = results.get("personality_alignment", {})
        if personality_alignment.get("alignment_score", 0) > 0.7:
            insights["strengths"].append("Strong personality fit with role requirements")
        else:
            insights["interview_focus_areas"].append("Assess cultural fit and work style compatibility")
        
        # Keyword insights
        keyword_overlap = results.get("keyword_overlap", {})
        if keyword_overlap.get("overlap_score", 0) > 0.5:
            insights["strengths"].append("Relevant skills and terminology alignment")
        else:
            insights["concerns"].append("Limited overlap in key skills and experience areas")
            insights["interview_focus_areas"].append("Verify transferable skills and learning ability")
        
        return insights
    
    def _update_metrics(self, processing_time: float):
        """Update performance metrics"""
        self.performance_metrics["total_requests"] += 1
        self.performance_metrics["total_processing_time"] += processing_time
        
        # Update average response time
        total_requests = self.performance_metrics["total_requests"]
        self.performance_metrics["avg_response_time"] = (
            self.performance_metrics["total_processing_time"] / total_requests
        )
        
        # Update cache hit rate
        total_cache_requests = self._cache_hits + self._cache_misses
        if total_cache_requests > 0:
            self.performance_metrics["cache_hit_rate"] = (
                self._cache_hits / total_cache_requests
            )
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics"""
        return {
            **self.performance_metrics,
            "cache_hits": self._cache_hits,
            "cache_misses": self._cache_misses,
            "model_performance": self.model_manager.get_performance_stats()
        }
    
    def shutdown(self):
        """Gracefully shutdown the service"""
        logger.info("Shutting down LocalInferenceService...")
        self.executor.shutdown(wait=True)
        logger.info("LocalInferenceService shutdown complete")


# Singleton instance
_service_instance = None


def get_inference_service() -> LocalInferenceService:
    """Get or create singleton inference service instance"""
    global _service_instance
    if _service_instance is None:
        _service_instance = LocalInferenceService(preload_models=True)
    return _service_instance
