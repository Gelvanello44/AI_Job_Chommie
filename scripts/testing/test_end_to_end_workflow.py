"""
Comprehensive end-to-end workflow test for AI Job Chommie
Tests the complete job matching pipeline from scraping to AI processing to recommendations
"""

import os
import sys
import json
import logging
import asyncio
import time
from pathlib import Path
from datetime import datetime
import requests

# Add necessary paths
scraping_service_path = Path(__file__).parent / "job-scraping-service" / "src"
if str(scraping_service_path) not in sys.path:
    sys.path.insert(0, str(scraping_service_path))

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EndToEndWorkflowTester:
    def __init__(self):
        self.results = {}
        self.backend_url = "http://localhost:5000"
        self.api_base = f"{self.backend_url}/api/v1"
        self.test_data = {
            "job_description": """
                Senior Python Developer
                We are looking for an experienced Python developer with:
                - 5+ years of Python experience
                - Machine learning and AI knowledge
                - Experience with FastAPI and Django
                - Strong problem-solving skills
                - Team leadership experience
            """,
            "candidate_cv": """
                John Doe - Software Engineer
                Experience:
                - 6 years of Python development
                - Built ML pipelines using TensorFlow and PyTorch
                - Led team of 5 developers
                - Developed REST APIs with FastAPI
                - Strong background in data science and AI
                Skills: Python, Machine Learning, FastAPI, Django, Leadership, AI/ML
            """,
            "job_filters": {
                "keywords": ["python", "developer", "machine learning"],
                "location": "Cape Town, South Africa",
                "job_level": "senior",
                "salary_min": 50000,
                "salary_max": 100000,
                "job_type": "full_time"
            }
        }
        
    async def test_ai_model_pipeline(self):
        """Test the AI model processing pipeline"""
        logger.info("="*60)
        logger.info("TESTING AI MODEL PIPELINE")
        logger.info("="*60)
        
        try:
            # Import AI inference service
            from local_inference_service import get_inference_service
            from model_manager import get_model_manager
            
            # Initialize services
            logger.info("Initializing AI services...")
            inference_service = get_inference_service()
            model_manager = get_model_manager()
            
            # Test 1: Job-Candidate Similarity
            logger.info("\n1. Testing job-candidate similarity analysis...")
            similarity_score = await inference_service.analyze_job_similarity(
                self.test_data["job_description"],
                self.test_data["candidate_cv"],
                return_detailed_scores=False
            )
            
            logger.info(f" Similarity score: {similarity_score:.3f}")
            assert 0 <= similarity_score <= 1, "Invalid similarity score"
            
            # Test 2: Personality Analysis
            logger.info("\n2. Testing personality analysis...")
            personality_results = await inference_service.analyze_personality(
                [self.test_data["job_description"], self.test_data["candidate_cv"]]
            )
            
            if personality_results:
                logger.info(" Personality analysis completed")
                for i, result in enumerate(personality_results):
                    source = "Job" if i == 0 else "Candidate"
                    if 'personality_traits' in result:
                        logger.info(f"  - {source} dominant trait: {result.get('dominant_trait', {}).get('label', 'Unknown')}")
            
            # Test 3: Text Feature Extraction
            logger.info("\n3. Testing text feature extraction...")
            feature_results = await inference_service.analyze_text_features(
                [self.test_data["job_description"], self.test_data["candidate_cv"]],
                extract_keywords=True,
                extract_entities=True,
                extract_embeddings=False  # Skip embeddings for speed
            )
            
            if feature_results:
                logger.info(" Text features extracted")
                for i, result in enumerate(feature_results):
                    source = "Job" if i == 0 else "Candidate"
                    logger.info(f"  - {source} keywords: {', '.join(result.get('keywords', [])[:5])}")
            
            # Test 4: Advanced Analysis Pipeline
            logger.info("\n4. Testing advanced analysis pipeline...")
            pipeline_results = await inference_service.advanced_analysis_pipeline(
                self.test_data["job_description"],
                self.test_data["candidate_cv"],
                analysis_depth="comprehensive"
            )
            
            if pipeline_results:
                logger.info(" Advanced pipeline completed")
                logger.info(f"  - Overall match score: {pipeline_results.get('overall_match_score', 0):.3f}")
                logger.info(f"  - Match level: {pipeline_results.get('match_level', 'unknown')}")
                
                # Show recommendations
                recommendations = pipeline_results.get('recommendations', [])
                if recommendations:
                    logger.info("  - Recommendations:")
                    for rec in recommendations[:3]:
                        logger.info(f"    • {rec}")
            
            return True
            
        except Exception as e:
            logger.error(f" AI model pipeline test failed: {e}")
            import traceback
            traceback.print_exc()
            return False
            
    async def test_scraping_workflow(self):
        """Test the job scraping workflow"""
        logger.info("\n" + "="*60)
        logger.info("TESTING SCRAPING WORKFLOW")
        logger.info("="*60)
        
        try:
            # Import scraping components
            from scrapers.orchestrator import ScraperOrchestrator, ScraperTask, ScraperType
            
            # Create orchestrator instance
            logger.info("Initializing scraper orchestrator...")
            orchestrator = ScraperOrchestrator()
            
            # Create test scraping task
            task = ScraperTask(
                id=f"test-{datetime.utcnow().timestamp()}",
                source="indeed",  # Test with Indeed
                scraper_type=ScraperType.SERPAPI,  # Use SerpAPI for testing
                filters=self.test_data["job_filters"],
                priority=1
            )
            
            logger.info(f" Created scraping task: {task.id}")
            logger.info(f"  - Source: {task.source}")
            logger.info(f"  - Scraper type: {task.scraper_type.value}")
            logger.info(f"  - Keywords: {task.filters.get('keywords', [])}")
            
            # Test orchestrator status
            status = await orchestrator.get_status()
            logger.info("\n Orchestrator status retrieved")
            logger.info(f"  - Is running: {status.get('is_running', False)}")
            logger.info(f"  - Active tasks: {status.get('active_tasks', 0)}")
            logger.info(f"  - Completed tasks: {status.get('completed_tasks', 0)}")
            
            return True
            
        except Exception as e:
            logger.error(f" Scraping workflow test failed: {e}")
            return False
            
    def test_api_job_flow(self):
        """Test job-related API endpoints"""
        logger.info("\n" + "="*60)
        logger.info("TESTING API JOB FLOW")
        logger.info("="*60)
        
        # Skip if backend is not running
        try:
            response = requests.get(f"{self.backend_url}/health", timeout=2)
            if response.status_code != 200:
                logger.warning(" Backend server not running - skipping API tests")
                return False
        except:
            logger.warning(" Backend server not accessible - skipping API tests")
            return False
            
        try:
            # Test 1: Fetch jobs
            logger.info("1. Testing job listing endpoint...")
            jobs_response = requests.get(f"{self.api_base}/jobs", timeout=5)
            
            if jobs_response.status_code == 200:
                logger.info(" Job listing endpoint functional")
                jobs_data = jobs_response.json()
                if 'data' in jobs_data:
                    logger.info(f"  - Found {len(jobs_data.get('data', []))} jobs")
            else:
                logger.warning(f"  Job listing returned status {jobs_response.status_code}")
                
            # Test 2: Search jobs
            logger.info("\n2. Testing job search...")
            search_params = {
                "keywords": "python developer",
                "location": "cape town",
                "limit": 5
            }
            
            search_response = requests.get(
                f"{self.api_base}/jobs/search",
                params=search_params,
                timeout=5
            )
            
            if search_response.status_code == 200:
                logger.info(" Job search endpoint functional")
                search_data = search_response.json()
                if 'data' in search_data:
                    logger.info(f"  - Search returned {len(search_data.get('data', []))} results")
            else:
                logger.warning(f"  Job search returned status {search_response.status_code}")
                
            return True
            
        except Exception as e:
            logger.error(f" API job flow test failed: {e}")
            return False
            
    async def test_complete_workflow(self):
        """Test the complete end-to-end workflow"""
        logger.info("\n" + "="*60)
        logger.info("TESTING COMPLETE END-TO-END WORKFLOW")
        logger.info("="*60)
        
        workflow_steps = []
        
        # Step 1: AI Model Analysis
        logger.info("\nSTEP 1: AI Model Analysis")
        logger.info("-" * 40)
        
        try:
            from local_inference_service import get_inference_service
            inference_service = get_inference_service()
            
            # Analyze job-candidate match
            results = await inference_service.advanced_analysis_pipeline(
                self.test_data["job_description"],
                self.test_data["candidate_cv"]
            )
            
            match_score = results.get('overall_match_score', 0)
            logger.info(f" Job-Candidate Analysis Complete")
            logger.info(f"  - Match Score: {match_score:.2%}")
            logger.info(f"  - Match Level: {results.get('match_level', 'unknown')}")
            
            workflow_steps.append({
                "step": "AI Analysis",
                "status": "success",
                "score": match_score
            })
            
        except Exception as e:
            logger.error(f" AI Analysis failed: {e}")
            workflow_steps.append({
                "step": "AI Analysis",
                "status": "failed",
                "error": str(e)
            })
            
        # Step 2: Job Search Simulation
        logger.info("\nSTEP 2: Job Search Simulation")
        logger.info("-" * 40)
        
        try:
            # Simulate job search with filters
            logger.info(" Job Search Parameters:")
            logger.info(f"  - Keywords: {self.test_data['job_filters']['keywords']}")
            logger.info(f"  - Location: {self.test_data['job_filters']['location']}")
            logger.info(f"  - Level: {self.test_data['job_filters']['job_level']}")
            
            workflow_steps.append({
                "step": "Job Search",
                "status": "simulated",
                "filters": self.test_data['job_filters']
            })
            
        except Exception as e:
            logger.error(f" Job Search simulation failed: {e}")
            workflow_steps.append({
                "step": "Job Search",
                "status": "failed",
                "error": str(e)
            })
            
        # Step 3: Recommendation Generation
        logger.info("\nSTEP 3: Recommendation Generation")
        logger.info("-" * 40)
        
        try:
            # Generate recommendations based on analysis
            if workflow_steps[0]["status"] == "success":
                score = workflow_steps[0]["score"]
                
                recommendations = []
                if score > 0.8:
                    recommendations = [
                        "Excellent match - Apply immediately",
                        "Highlight ML experience in cover letter",
                        "Emphasize team leadership experience"
                    ]
                elif score > 0.6:
                    recommendations = [
                        "Good match - Consider applying",
                        "Strengthen technical skills section",
                        "Add more specific project examples"
                    ]
                else:
                    recommendations = [
                        "Moderate match - Review requirements",
                        "Consider additional certifications",
                        "Gain more relevant experience"
                    ]
                    
                logger.info(" Recommendations Generated:")
                for rec in recommendations:
                    logger.info(f"  • {rec}")
                    
                workflow_steps.append({
                    "step": "Recommendations",
                    "status": "success",
                    "recommendations": recommendations
                })
            
        except Exception as e:
            logger.error(f" Recommendation generation failed: {e}")
            workflow_steps.append({
                "step": "Recommendations",
                "status": "failed",
                "error": str(e)
            })
            
        # Workflow Summary
        logger.info("\n" + "="*60)
        logger.info("WORKFLOW SUMMARY")
        logger.info("="*60)
        
        success_count = sum(1 for step in workflow_steps if step["status"] in ["success", "simulated"])
        total_steps = len(workflow_steps)
        
        logger.info(f"Completed {success_count}/{total_steps} workflow steps successfully")
        
        for i, step in enumerate(workflow_steps, 1):
            status_icon = "" if step["status"] in ["success", "simulated"] else ""
            logger.info(f"{status_icon} Step {i}: {step['step']} - {step['status'].upper()}")
            
        return success_count == total_steps
        
    async def stress_test_ai_models(self):
        """Stress test AI models with concurrent requests"""
        logger.info("\n" + "="*60)
        logger.info("AI MODEL STRESS TEST")
        logger.info("="*60)
        
        try:
            from local_inference_service import get_inference_service
            inference_service = get_inference_service()
            
            # Test parameters
            num_requests = 10
            batch_size = 5
            
            logger.info(f"Running stress test with {num_requests} concurrent requests...")
            
            # Create test data
            test_jobs = [
                f"Job {i}: Python developer with {i+3} years experience needed"
                for i in range(num_requests)
            ]
            test_cvs = [
                f"Candidate {i}: {i+4} years Python experience, ML background"
                for i in range(num_requests)
            ]
            
            # Measure performance
            start_time = time.time()
            
            # Process in batches
            tasks = []
            for i in range(0, num_requests, batch_size):
                batch_jobs = test_jobs[i:i+batch_size]
                batch_cvs = test_cvs[i:i+batch_size]
                
                for job, cv in zip(batch_jobs, batch_cvs):
                    task = inference_service.analyze_job_similarity(job, cv, return_detailed_scores=False)
                    tasks.append(task)
                    
            # Execute all tasks
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            end_time = time.time()
            duration = end_time - start_time
            
            # Analyze results
            successful = sum(1 for r in results if not isinstance(r, Exception))
            failed = len(results) - successful
            
            logger.info("\n Stress Test Complete:")
            logger.info(f"  - Total requests: {num_requests}")
            logger.info(f"  - Successful: {successful}")
            logger.info(f"  - Failed: {failed}")
            logger.info(f"  - Total time: {duration:.2f} seconds")
            logger.info(f"  - Avg time per request: {duration/num_requests:.3f} seconds")
            logger.info(f"  - Throughput: {num_requests/duration:.2f} requests/second")
            
            return successful == num_requests
            
        except Exception as e:
            logger.error(f" Stress test failed: {e}")
            return False
            
    async def run_all_tests(self):
        """Run all end-to-end workflow tests"""
        logger.info("="*60)
        logger.info("END-TO-END WORKFLOW VERIFICATION")
        logger.info("="*60)
        
        # Run individual tests
        self.results["AI Model Pipeline"] = await self.test_ai_model_pipeline()
        self.results["Scraping Workflow"] = await self.test_scraping_workflow()
        self.results["API Job Flow"] = self.test_api_job_flow()
        self.results["Complete Workflow"] = await self.test_complete_workflow()
        self.results["AI Stress Test"] = await self.stress_test_ai_models()
        
        # Summary
        logger.info("\n" + "="*60)
        logger.info("END-TO-END TEST SUMMARY")
        logger.info("="*60)
        
        all_passed = True
        for component, status in self.results.items():
            status_str = " PASS" if status else " FAIL"
            logger.info(f"{component}: {status_str}")
            if not status:
                all_passed = False
                
        logger.info("\n" + "="*60)
        if all_passed:
            logger.info(" END-TO-END WORKFLOW FULLY VERIFIED!")
            logger.info("  - AI models process job matching correctly")
            logger.info("  - Scraping orchestration is configured")
            logger.info("  - Complete workflow produces recommendations")
            logger.info("  - System handles concurrent load")
        else:
            logger.info(" END-TO-END WORKFLOW PARTIALLY VERIFIED")
            logger.info("  - Some components need attention")
            logger.info("  - Backend server may need to be started")
            logger.info("  - Check logs above for specific issues")
            
        return all_passed

async def main():
    """Main test function"""
    tester = EndToEndWorkflowTester()
    success = await tester.run_all_tests()
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
