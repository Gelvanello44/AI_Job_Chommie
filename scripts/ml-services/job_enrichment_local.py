"""
Enhanced Job Enrichment with Unlimited Local Model Processing
Replaces all API limitations with powerful local inference
"""

import re
import asyncio
from typing import Dict, List, Any, Optional, Set, Tuple
from datetime import datetime
import statistics
from dataclasses import dataclass
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging

from local_inference_service import get_inference_service, LocalInferenceService
from local_model_config import PERFORMANCE_SETTINGS, get_optimal_batch_size

logger = logging.getLogger(__name__)


@dataclass
class EnrichedJobData:
    """Enriched job data structure with AI-powered insights."""
    job_id: str
    original_data: Dict[str, Any]
    enriched_fields: Dict[str, Any]
    ai_insights: Dict[str, Any]
    enrichment_metadata: Dict[str, Any]
    processed_at: datetime


class AdvancedSkillExtractor:
    """Advanced skill extraction using local AI models for deep understanding."""
    
    def __init__(self, inference_service: LocalInferenceService):
        self.inference_service = inference_service
        
        # Enhanced skill categories with AI understanding
        self.skill_categories = {
            'programming_languages': {
                'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'php',
                'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala', 'r', 'matlab',
                'perl', 'shell', 'bash', 'powershell', 'objective-c', 'dart',
                'clojure', 'haskell', 'erlang', 'elixir', 'groovy', 'lua', 'julia',
                'fortran', 'cobol', 'pascal', 'assembly', 'vhdl', 'verilog'
            },
            'ai_ml_skills': {
                'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'pandas', 'numpy',
                'opencv', 'nltk', 'spacy', 'transformers', 'huggingface', 'mlflow',
                'kubeflow', 'ray', 'dask', 'spark mllib', 'xgboost', 'lightgbm',
                'catboost', 'prophet', 'statsmodels', 'gensim', 'fastai'
            },
            'cloud_platforms': {
                'aws', 'azure', 'gcp', 'google cloud', 'heroku', 'digitalocean',
                'linode', 'vultr', 'cloudflare', 'vercel', 'netlify', 'alibaba cloud',
                'oracle cloud', 'ibm cloud', 'openstack', 'vmware', 'kubernetes',
                'openshift', 'cloud foundry', 'rancher'
            },
            'advanced_technologies': {
                'blockchain', 'ethereum', 'solidity', 'web3', 'smart contracts',
                'quantum computing', 'iot', 'edge computing', 'ar/vr', 'computer vision',
                'nlp', 'deep learning', 'reinforcement learning', 'federated learning',
                'mlops', 'devsecops', 'gitops', 'service mesh', 'istio', 'linkerd'
            }
        }
        
        self._compile_patterns()
        logger.info("AdvancedSkillExtractor initialized with AI-powered extraction")
    
    def _compile_patterns(self):
        """Compile regex patterns for skill matching."""
        self.skill_patterns = {}
        
        for category, skills in self.skill_categories.items():
            for skill in skills:
                pattern = re.compile(r'\b' + re.escape(skill) + r'\b', re.IGNORECASE)
                self.skill_patterns[skill] = (pattern, category)
    
    async def extract_skills_with_ai(self, text: str) -> Dict[str, Any]:
        """Extract skills using both pattern matching and AI understanding."""
        
        if not text:
            return {}
        
        # Traditional pattern-based extraction
        pattern_skills = self._extract_pattern_based_skills(text)
        
        # AI-powered skill extraction
        ai_skills = await self._extract_ai_powered_skills(text)
        
        # Combine and enhance results
        combined_skills = self._combine_skill_results(pattern_skills, ai_skills)
        
        # Calculate skill complexity and rarity scores
        combined_skills['skill_metrics'] = await self._calculate_skill_metrics(combined_skills)
        
        return combined_skills
    
    def _extract_pattern_based_skills(self, text: str) -> Dict[str, List[str]]:
        """Traditional pattern-based skill extraction."""
        extracted_skills = {category: [] for category in self.skill_categories}
        extracted_skills['other'] = []
        
        for skill, (pattern, category) in self.skill_patterns.items():
            if pattern.search(text):
                extracted_skills[category].append(skill)
        
        # Extract experience and education
        extracted_skills['experience_requirements'] = self._extract_experience_years(text)
        extracted_skills['education_requirements'] = self._extract_education(text)
        
        # Remove duplicates
        for category in extracted_skills:
            if isinstance(extracted_skills[category], list):
                extracted_skills[category] = list(set(extracted_skills[category]))
        
        return {k: v for k, v in extracted_skills.items() if v}
    
    async def _extract_ai_powered_skills(self, text: str) -> Dict[str, Any]:
        """Use AI models to extract skills with deep understanding."""
        
        # Extract keywords and entities using local models
        text_features = await self.inference_service.analyze_text_features(
            text,
            extract_keywords=True,
            extract_entities=True,
            batch_size=1
        )
        
        if not text_features:
            return {}
        
        features = text_features[0]
        
        # Categorize AI-extracted keywords into skills
        ai_skills = {
            'technical_keywords': features.get('keywords', []),
            'entities': features.get('entities', []),
            'inferred_skills': []
        }
        
        # Use similarity model to find related skills
        if features.get('keywords'):
            skill_similarities = await self._find_similar_skills(features['keywords'])
            ai_skills['inferred_skills'] = skill_similarities
        
        return ai_skills
    
    async def _find_similar_skills(self, keywords: List[str]) -> List[Dict[str, Any]]:
        """Find skills similar to extracted keywords using sentence transformers."""
        
        if not keywords:
            return []
        
        # Create skill reference list
        all_skills = []
        for category, skills in self.skill_categories.items():
            for skill in skills:
                all_skills.append(skill)
        
        # Calculate similarities between keywords and known skills
        similarities = await self.inference_service.analyze_job_similarity(
            keywords[:10],  # Limit to top 10 keywords
            all_skills[:50],  # Compare against top 50 skills
            return_detailed_scores=True
        )
        
        # Extract high-confidence skill matches
        inferred_skills = []
        for result in similarities:
            if result['similarity_score'] > 0.7:
                keyword_idx = result['job_index']
                skill_idx = result['candidate_index']
                
                if keyword_idx < len(keywords) and skill_idx < len(all_skills):
                    inferred_skills.append({
                        'keyword': keywords[keyword_idx],
                        'matched_skill': all_skills[skill_idx],
                        'confidence': result['similarity_score']
                    })
        
        return inferred_skills
    
    def _combine_skill_results(self, pattern_skills: Dict, ai_skills: Dict) -> Dict[str, Any]:
        """Combine pattern-based and AI-extracted skills."""
        
        combined = pattern_skills.copy()
        
        # Add AI-inferred skills with high confidence
        if 'inferred_skills' in ai_skills:
            combined['ai_inferred_skills'] = [
                skill for skill in ai_skills['inferred_skills']
                if skill['confidence'] > 0.8
            ]
        
        # Add technical keywords not captured by patterns
        if 'technical_keywords' in ai_skills:
            tech_keywords = set(ai_skills['technical_keywords'])
            # Filter out common words and existing skills
            existing_skills = set()
            for skills in pattern_skills.values():
                if isinstance(skills, list):
                    existing_skills.update(s.lower() for s in skills)
            
            new_keywords = [kw for kw in tech_keywords if kw.lower() not in existing_skills]
            if new_keywords:
                combined['additional_technical_terms'] = new_keywords[:20]
        
        return combined
    
    async def _calculate_skill_metrics(self, skills: Dict[str, Any]) -> Dict[str, float]:
        """Calculate advanced metrics for extracted skills."""
        
        total_skills = 0
        skill_categories_found = 0
        
        # Count skills by category
        category_counts = {}
        for category, skill_list in skills.items():
            if isinstance(skill_list, list) and skill_list:
                count = len(skill_list)
                total_skills += count
                category_counts[category] = count
                skill_categories_found += 1
        
        # Calculate complexity score
        complexity_weights = {
            'ai_ml_skills': 3.0,
            'advanced_technologies': 2.8,
            'cloud_platforms': 2.2,
            'programming_languages': 2.0,
            'ai_inferred_skills': 2.5
        }
        
        weighted_score = 0
        for category, count in category_counts.items():
            weight = complexity_weights.get(category, 1.0)
            weighted_score += count * weight
        
        # Calculate rarity score based on advanced skills
        rare_skills = {
            'rust', 'quantum computing', 'blockchain', 'kubernetes operator',
            'reinforcement learning', 'federated learning', 'web3', 'solidity'
        }
        
        rarity_score = 0
        for category, skill_list in skills.items():
            if isinstance(skill_list, list):
                for skill in skill_list:
                    if skill.lower() in rare_skills:
                        rarity_score += 10
        
        return {
            'total_skills': total_skills,
            'skill_diversity': skill_categories_found / len(self.skill_categories) * 100,
            'complexity_score': min(weighted_score * 2, 100),
            'rarity_score': min(rarity_score, 100),
            'overall_skill_score': min((weighted_score + rarity_score + skill_categories_found * 5) / 3, 100)
        }
    
    def _extract_experience_years(self, text: str) -> List[str]:
        """Extract experience requirements with enhanced patterns."""
        experience_patterns = [
            r'(\d+)\+?\s*years?\s*(?:of\s*)?experience',
            r'(\d+)\+?\s*years?\s*in',
            r'minimum\s*(\d+)\s*years?',
            r'at\s*least\s*(\d+)\s*years?',
            r'(\d+)\-(\d+)\s*years?',
            r'(\d+)\s*to\s*(\d+)\s*years?',
            r'senior.*?(\d+)\s*years?',
            r'junior.*?(\d+)\s*years?'
        ]
        
        experience_reqs = []
        for pattern in experience_patterns:
            matches = re.findall(pattern, text.lower())
            for match in matches:
                if isinstance(match, tuple):
                    if len(match) == 2:
                        experience_reqs.append(f"{match[0]}-{match[1]} years")
                    else:
                        experience_reqs.append(f"{match[0]}+ years")
                else:
                    experience_reqs.append(f"{match}+ years")
        
        return list(set(experience_reqs))
    
    def _extract_education(self, text: str) -> List[str]:
        """Extract education requirements with comprehensive patterns."""
        education_patterns = {
            r'\b(?:bachelor\'?s?|bs|ba|b\.s\.|b\.a\.)\b.*?(?:degree|diploma)?': "Bachelor's Degree",
            r'\b(?:master\'?s?|ms|ma|mba|m\.s\.|m\.a\.)\b.*?(?:degree|diploma)?': "Master's Degree",
            r'\b(?:phd|ph\.d|doctorate|doctoral)\b': "PhD/Doctorate",
            r'\b(?:associate\'?s?|aa|as|a\.a\.|a\.s\.)\b.*?(?:degree|diploma)?': "Associate's Degree",
            r'\bhigh\s*school\b.*?(?:diploma|graduate|ged)': "High School Diploma",
            r'\b(?:bootcamp|boot camp)\b': "Bootcamp Graduate",
            r'\b(?:certification|certificate|certified)\b': "Professional Certification",
            r'\b(?:computer science|cs|engineering)\s*(?:degree|background)': "CS/Engineering Degree"
        }
        
        education_reqs = []
        text_lower = text.lower()
        
        for pattern, education_type in education_patterns.items():
            if re.search(pattern, text_lower):
                education_reqs.append(education_type)
        
        return list(set(education_reqs))


class AIJobEnrichmentProcessor:
    """Enhanced job enrichment with unlimited local AI processing power."""
    
    def __init__(self):
        self.inference_service = get_inference_service()
        self.skill_extractor = AdvancedSkillExtractor(self.inference_service)
        
        # Concurrent processing executor
        self.executor = ThreadPoolExecutor(
            max_workers=PERFORMANCE_SETTINGS["max_concurrent_requests"]
        )
        
        # Processing statistics
        self.jobs_processed = 0
        self.enrichment_errors = 0
        self.total_processing_time = 0
        
        logger.info("AIJobEnrichmentProcessor initialized with unlimited local processing")
    
    async def enrich_job_batch(self, jobs: List[Any], batch_size: int = 10) -> List[EnrichedJobData]:
        """Process multiple jobs concurrently for maximum efficiency."""
        
        results = []
        
        # Process jobs in optimal batches
        for i in range(0, len(jobs), batch_size):
            batch = jobs[i:i + batch_size]
            
            # Submit all jobs in batch for concurrent processing
            futures = []
            for job in batch:
                future = self.executor.submit(
                    asyncio.run,
                    self.enrich_job(job)
                )
                futures.append(future)
            
            # Collect results as they complete
            for future in as_completed(futures):
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    logger.error(f"Error processing job in batch: {str(e)}")
        
        return results
    
    async def enrich_job(self, job: Any) -> EnrichedJobData:
        """Enrich a single job with comprehensive AI-powered analysis."""
        
        start_time = datetime.utcnow()
        
        try:
            enriched_fields = {}
            ai_insights = {}
            
            # Extract skills with AI enhancement
            if hasattr(job, 'description') and job.description:
                skills_data = await self.skill_extractor.extract_skills_with_ai(job.description)
                if skills_data:
                    enriched_fields['extracted_skills'] = skills_data
                    enriched_fields['skill_metrics'] = skills_data.get('skill_metrics', {})
            
            # Perform comprehensive job analysis using AI
            if hasattr(job, 'description') and hasattr(job, 'title'):
                full_text = f"{job.title}\n\n{job.description}"
                
                # Get AI insights concurrently
                analysis_tasks = [
                    self._analyze_job_quality(full_text),
                    self._analyze_company_culture(full_text),
                    self._analyze_growth_opportunities(full_text),
                    self._analyze_work_style(full_text)
                ]
                
                quality, culture, growth, work_style = await asyncio.gather(*analysis_tasks)
                
                ai_insights.update({
                    'job_quality_analysis': quality,
                    'company_culture_analysis': culture,
                    'growth_opportunities': growth,
                    'work_style_analysis': work_style
                })
            
            # Calculate enhanced job scores
            enriched_fields['job_scores'] = await self._calculate_comprehensive_scores(
                job, enriched_fields, ai_insights
            )
            
            # Market positioning analysis
            enriched_fields['market_analysis'] = await self._analyze_market_position(
                job, enriched_fields
            )
            
            # Generate AI-powered recommendations
            ai_insights['recommendations'] = await self._generate_ai_recommendations(
                job, enriched_fields, ai_insights
            )
            
            # Calculate processing metrics
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            self.total_processing_time += processing_time
            self.jobs_processed += 1
            
            enrichment_metadata = {
                'processor_version': '2.0',
                'ai_powered': True,
                'processing_time_seconds': processing_time,
                'enrichment_modules': list(enriched_fields.keys()),
                'ai_insights_modules': list(ai_insights.keys()),
                'confidence_score': self._calculate_confidence_score(enriched_fields, ai_insights)
            }
            
            return EnrichedJobData(
                job_id=job.id if hasattr(job, 'id') else str(hash(job)),
                original_data=job.__dict__ if hasattr(job, '__dict__') else {},
                enriched_fields=enriched_fields,
                ai_insights=ai_insights,
                enrichment_metadata=enrichment_metadata,
                processed_at=datetime.utcnow()
            )
            
        except Exception as e:
            self.enrichment_errors += 1
            logger.error(f"Error enriching job: {str(e)}")
            
            # Return minimal enriched data on error
            return EnrichedJobData(
                job_id=job.id if hasattr(job, 'id') else str(hash(job)),
                original_data=job.__dict__ if hasattr(job, '__dict__') else {},
                enriched_fields={'error': str(e)},
                ai_insights={'error': True},
                enrichment_metadata={'error': True, 'error_message': str(e)},
                processed_at=datetime.utcnow()
            )
    
    async def _analyze_job_quality(self, text: str) -> Dict[str, Any]:
        """Analyze job quality using AI models."""
        
        # Use personality analysis model to assess job quality indicators
        quality_results = await self.inference_service.analyze_personality(
            [text],
            batch_size=1
        )
        
        if not quality_results:
            return {}
        
        # Interpret results as job quality metrics
        result = quality_results[0]
        traits = result.get('personality_traits', [])
        
        quality_indicators = {
            'clarity_score': 0,
            'detail_level': 0,
            'professionalism': 0,
            'transparency': 0
        }
        
        # Map personality traits to quality indicators (simplified)
        for trait in traits:
            label = trait.get('label', '').lower()
            score = trait.get('score', 0)
            
            if 'clear' in label or 'concise' in label:
                quality_indicators['clarity_score'] = max(quality_indicators['clarity_score'], score * 100)
            elif 'detail' in label or 'comprehensive' in label:
                quality_indicators['detail_level'] = max(quality_indicators['detail_level'], score * 100)
            elif 'professional' in label or 'formal' in label:
                quality_indicators['professionalism'] = max(quality_indicators['professionalism'], score * 100)
            elif 'open' in label or 'transparent' in label:
                quality_indicators['transparency'] = max(quality_indicators['transparency'], score * 100)
        
        # Calculate overall quality score
        quality_indicators['overall_quality'] = statistics.mean(quality_indicators.values())
        
        return quality_indicators
    
    async def _analyze_company_culture(self, text: str) -> Dict[str, Any]:
        """Extract company culture insights using AI."""
        
        culture_keywords = {
            'collaborative': ['team', 'collaborate', 'together', 'cross-functional'],
            'innovative': ['innovative', 'cutting-edge', 'pioneer', 'disrupt'],
            'fast_paced': ['fast-paced', 'dynamic', 'agile', 'rapid'],
            'work_life_balance': ['balance', 'flexible', 'wellness', 'time off'],
            'growth_oriented': ['growth', 'learning', 'development', 'career'],
            'inclusive': ['diverse', 'inclusive', 'equity', 'belonging'],
            'results_driven': ['results', 'performance', 'metrics', 'kpi'],
            'customer_focused': ['customer', 'client', 'user-centric', 'service']
        }
        
        # Extract keywords for culture analysis
        text_features = await self.inference_service.analyze_text_features(
            [text],
            extract_keywords=True,
            batch_size=1
        )
        
        culture_scores = {}
        
        if text_features:
            keywords = text_features[0].get('keywords', [])
            text_lower = text.lower()
            
            for culture_type, indicators in culture_keywords.items():
                score = 0
                for indicator in indicators:
                    if indicator in text_lower:
                        score += 10
                    if indicator in keywords:
                        score += 5
                
                culture_scores[culture_type] = min(score, 100)
        
        # Determine dominant culture type
        if culture_scores:
            dominant_culture = max(culture_scores, key=culture_scores.get)
            culture_scores['dominant_culture'] = dominant_culture
            culture_scores['culture_strength'] = culture_scores[dominant_culture]
        
        return culture_scores
    
    async def _analyze_growth_opportunities(self, text: str) -> Dict[str, Any]:
        """Analyze growth and learning opportunities."""
        
        growth_indicators = {
            'mentorship': ['mentor', 'coaching', 'guidance', 'senior'],
            'training': ['training', 'courses', 'certification', 'learning'],
            'career_path': ['career', 'progression', 'advancement', 'promotion'],
            'skill_development': ['develop', 'grow', 'expand', 'skills'],
            'leadership': ['lead', 'manage', 'leadership', 'responsibility'],
            'conferences': ['conference', 'events', 'networking', 'community']
        }
        
        text_lower = text.lower()
        growth_scores = {}
        
        for opportunity, keywords in growth_indicators.items():
            score = sum(10 for keyword in keywords if keyword in text_lower)
            growth_scores[opportunity] = min(score, 100)
        
        # Calculate overall growth potential
        growth_scores['overall_growth_potential'] = statistics.mean(growth_scores.values())
        
        # Determine growth focus areas
        high_growth_areas = [area for area, score in growth_scores.items() if score > 50]
        growth_scores['high_growth_areas'] = high_growth_areas
        
        return growth_scores
    
    async def _analyze_work_style(self, text: str) -> Dict[str, Any]:
        """Analyze work style and environment preferences."""
        
        work_style_patterns = {
            'remote_friendly': ['remote', 'work from home', 'distributed', 'anywhere'],
            'hybrid': ['hybrid', 'flexible location', 'office optional'],
            'on_site': ['on-site', 'in-office', 'office location', 'headquarters'],
            'flexible_hours': ['flexible hours', 'flex time', 'work-life', 'unlimited pto'],
            'structured': ['structured', 'process', 'methodology', 'framework'],
            'autonomous': ['autonomous', 'independent', 'self-directed', 'ownership'],
            'collaborative': ['collaborative', 'team-based', 'pair programming', 'mob programming']
        }
        
        text_lower = text.lower()
        work_style_scores = {}
        
        for style, patterns in work_style_patterns.items():
            score = sum(15 for pattern in patterns if pattern in text_lower)
            work_style_scores[style] = min(score, 100)
        
        # Determine primary work style
        if work_style_scores:
            primary_style = max(work_style_scores, key=work_style_scores.get)
            work_style_scores['primary_work_style'] = primary_style
            
            # Check for conflicts
            if work_style_scores.get('remote_friendly', 0) > 50 and work_style_scores.get('on_site', 0) > 50:
                work_style_scores['style_clarity'] = 'mixed_signals'
            else:
                work_style_scores['style_clarity'] = 'clear'
        
        return work_style_scores
    
    async def _calculate_comprehensive_scores(
        self, job: Any, enriched_fields: Dict, ai_insights: Dict
    ) -> Dict[str, float]:
        """Calculate comprehensive job scores using all available data."""
        
        scores = {
            'overall_match_score': 50.0,  # Base score
            'skill_alignment_score': 0,
            'culture_fit_score': 0,
            'growth_potential_score': 0,
            'compensation_score': 0,
            'location_score': 0,
            'company_reputation_score': 0
        }
        
        # Skill alignment score
        if 'skill_metrics' in enriched_fields:
            metrics = enriched_fields['skill_metrics']
            scores['skill_alignment_score'] = metrics.get('overall_skill_score', 0)
            scores['overall_match_score'] += scores['skill_alignment_score'] * 0.3
        
        # Culture fit score
        if 'company_culture_analysis' in ai_insights:
            culture = ai_insights['company_culture_analysis']
            scores['culture_fit_score'] = culture.get('culture_strength', 0)
            scores['overall_match_score'] += scores['culture_fit_score'] * 0.2
        
        # Growth potential score
        if 'growth_opportunities' in ai_insights:
            growth = ai_insights['growth_opportunities']
            scores['growth_potential_score'] = growth.get('overall_growth_potential', 0)
            scores['overall_match_score'] += scores['growth_potential_score'] * 0.2
        
        # Calculate other scores based on job attributes
        if hasattr(job, 'salary_min') and job.salary_min:
            if job.salary_min >= 150000:
                scores['compensation_score'] = 100
            elif job.salary_min >= 120000:
                scores['compensation_score'] = 80
            elif job.salary_min >= 90000:
                scores['compensation_score'] = 60
            else:
                scores['compensation_score'] = 40
            
            scores['overall_match_score'] += scores['compensation_score'] * 0.15
        
        # Location score
        if hasattr(job, 'remote_friendly') and job.remote_friendly:
            scores['location_score'] = 90
        elif hasattr(job, 'location') and job.location:
            if any(hub in job.location.lower() for hub in ['san francisco', 'new york', 'seattle']):
                scores['location_score'] = 70
            else:
                scores['location_score'] = 50
        
        scores['overall_match_score'] += scores['location_score'] * 0.1
        
        # Normalize overall score
        scores['overall_match_score'] = min(scores['overall_match_score'], 100)
        
        return scores
    
    async def _analyze_market_position(self, job: Any, enriched_fields: Dict) -> Dict[str, Any]:
        """Analyze job's position in the current market."""
        
        market_analysis = {
            'demand_level': 'medium',
            'competition_level': 'medium',
            'salary_competitiveness': 'average',
            'skill_demand_score': 0,
            'market_trends': []
        }
        
        # Analyze skill demand
        if 'extracted_skills' in enriched_fields:
            high_demand_skills = {
                'kubernetes', 'terraform', 'aws', 'react', 'python',
                'machine learning', 'golang', 'rust', 'blockchain'
            }
            
            skills_found = set()
            for category, skills in enriched_fields['extracted_skills'].items():
                if isinstance(skills, list):
                    skills_found.update(skill.lower() for skill in skills)
            
            demand_score = len(skills_found.intersection(high_demand_skills)) * 10
            market_analysis['skill_demand_score'] = min(demand_score, 100)
            
            if demand_score >= 50:
                market_analysis['demand_level'] = 'high'
                market_analysis['market_trends'].append('high_demand_skills')
            elif demand_score >= 20:
                market_analysis['demand_level'] = 'medium'
        
        # Analyze salary competitiveness
        if hasattr(job, 'salary_min') and job.salary_min:
            if job.salary_min >= 140000:
                market_analysis['salary_competitiveness'] = 'highly_competitive'
            elif job.salary_min >= 100000:
                market_analysis['salary_competitiveness'] = 'competitive'
            elif job.salary_min >= 70000:
                market_analysis['salary_competitiveness'] = 'average'
            else:
                market_analysis['salary_competitiveness'] = 'below_average'
        
        # Add trend analysis
        if market_analysis['skill_demand_score'] > 70:
            market_analysis['market_trends'].append('emerging_tech_focus')
        
        if hasattr(job, 'remote_friendly') and job.remote_friendly:
            market_analysis['market_trends'].append('remote_work_trend')
        
        return market_analysis
    
    async def _generate_ai_recommendations(
        self, job: Any, enriched_fields: Dict, ai_insights: Dict
    ) -> List[Dict[str, Any]]:
        """Generate AI-powered recommendations for job seekers."""
        
        recommendations = []
        
        # Skill-based recommendations
        if 'skill_metrics' in enriched_fields:
            metrics = enriched_fields['skill_metrics']
            if metrics.get('complexity_score', 0) > 80:
                recommendations.append({
                    'type': 'skill_match',
                    'priority': 'high',
                    'message': 'This role requires advanced technical skills. Highlight your expertise in the required technologies.',
                    'action_items': ['Update resume with specific project examples', 'Prepare technical interview materials']
                })
            
            if metrics.get('rarity_score', 0) > 60:
                recommendations.append({
                    'type': 'competitive_advantage',
                    'priority': 'high',
                    'message': 'This position seeks rare skills that you may have. Emphasize any experience with these specialized technologies.',
                    'action_items': ['Highlight unique skill combinations', 'Provide concrete examples of using rare technologies']
                })
        
        # Culture fit recommendations
        if 'company_culture_analysis' in ai_insights:
            culture = ai_insights['company_culture_analysis']
            dominant = culture.get('dominant_culture', '')
            
            culture_recommendations = {
                'collaborative': 'Emphasize teamwork experiences and cross-functional projects',
                'innovative': 'Highlight creative solutions and cutting-edge project work',
                'fast_paced': 'Demonstrate ability to work under pressure and deliver quickly',
                'results_driven': 'Focus on quantifiable achievements and impact metrics'
            }
            
            if dominant in culture_recommendations:
                recommendations.append({
                    'type': 'culture_alignment',
                    'priority': 'medium',
                    'message': f'Company culture appears to be {dominant}. {culture_recommendations[dominant]}',
                    'action_items': ['Tailor cover letter to culture fit', 'Prepare relevant behavioral interview examples']
                })
        
        # Growth opportunity recommendations
        if 'growth_opportunities' in ai_insights:
            growth = ai_insights['growth_opportunities']
            if growth.get('overall_growth_potential', 0) > 70:
                recommendations.append({
                    'type': 'career_growth',
                    'priority': 'high',
                    'message': 'This role offers significant growth opportunities. Express your eagerness to learn and advance.',
                    'action_items': ['Discuss career goals in cover letter', 'Ask about growth paths in interview']
                })
        
        # Compensation recommendations
        if 'market_analysis' in enriched_fields:
            market = enriched_fields['market_analysis']
            if market.get('salary_competitiveness') == 'highly_competitive':
                recommendations.append({
                    'type': 'negotiation',
                    'priority': 'medium',
                    'message': 'This position offers competitive compensation. Be prepared to discuss your salary expectations confidently.',
                    'action_items': ['Research market rates for similar roles', 'Prepare salary negotiation strategy']
                })
        
        # Overall strategy recommendation
        if 'job_scores' in enriched_fields:
            overall_score = enriched_fields['job_scores'].get('overall_match_score', 0)
            if overall_score > 85:
                recommendations.append({
                    'type': 'application_strategy',
                    'priority': 'high',
                    'message': 'This is an excellent match for your profile! Apply as soon as possible with a tailored application.',
                    'action_items': ['Customize resume for this specific role', 'Write personalized cover letter', 'Apply within 24 hours']
                })
            elif overall_score > 70:
                recommendations.append({
                    'type': 'application_strategy',
                    'priority': 'medium',
                    'message': 'Good match with some areas to address. Focus on highlighting your strengths that align with the role.',
                    'action_items': ['Identify and address any skill gaps', 'Emphasize transferable skills']
                })
        
        return recommendations
    
    def _calculate_confidence_score(self, enriched_fields: Dict, ai_insights: Dict) -> float:
        """Calculate confidence score for the enrichment."""
        
        field_weights = {
            'extracted_skills': 0.25,
            'skill_metrics': 0.15,
            'job_scores': 0.20,
            'market_analysis': 0.10,
            'job_quality_analysis': 0.10,
            'company_culture_analysis': 0.10,
            'growth_opportunities': 0.05,
            'recommendations': 0.05
        }
        
        confidence = 0.0
        
        # Check enriched fields
        for field, weight in field_weights.items():
            if field in enriched_fields and enriched_fields[field]:
                confidence += weight * 0.5
        
        # Check AI insights
        for field, weight in field_weights.items():
            if field in ai_insights and ai_insights[field]:
                confidence += weight * 0.5
        
        return min(confidence * 100, 100.0)
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get comprehensive performance statistics."""
        
        avg_processing_time = (
            self.total_processing_time / self.jobs_processed 
            if self.jobs_processed > 0 else 0
        )
        
        return {
            'jobs_processed': self.jobs_processed,
            'enrichment_errors': self.enrichment_errors,
            'success_rate': (
                (self.jobs_processed / (self.jobs_processed + self.enrichment_errors))
                if (self.jobs_processed + self.enrichment_errors) > 0 else 0
            ) * 100,
            'average_processing_time_seconds': avg_processing_time,
            'throughput_per_minute': 60 / avg_processing_time if avg_processing_time > 0 else 0,
            'ai_powered': True,
            'local_inference': True,
            'unlimited_capacity': True
        }


# Global instance with full AI power
ai_job_enrichment_processor = AIJobEnrichmentProcessor()
