"""
Comprehensive South African Job Market Scheduler
Orchestrates daily sweeps to achieve 50%+ market coverage
"""

import asyncio
import schedule
from datetime import datetime, time
from typing import Dict, List, Any
from loguru import logger

from src.scrapers.orchestrator import orchestrator
from src.config.settings import settings


class SAMarketScheduler:
    """Scheduler for comprehensive SA job market coverage."""
    
    def __init__(self):
        self.is_running = False
        self.daily_targets = {
            "entry_level": 800,   # Optimized for limited API calls
            "mid_level": 300,
            "senior_level": 150,
            "executive_level": 50,
            "government": 100,
            "total_target": 1400  # Realistic target with 214 calls budget
        }
        
        # API call budget management
        self.api_budget = {
            "remaining_calls": 214,  # After reserving 20 for testing
            "daily_call_limit": 8,   # Sustainable rate for September
            "launch_period_calls": 20,  # Aug 29-31 (2 days)
            "september_calls": 194    # Remaining for September
        }
        
        # Comprehensive search strategies
        self.search_strategies = [
            {
                "name": "entry_level_sweep",
                "source": "comprehensive_sa",
                "filters": {
                    "job_level": "entry",
                    "keywords": ["cashier", "packer", "general worker", "cleaner"],
                    "location": "South Africa"
                },
                "schedule": "06:00",  # Early morning
                "priority": 1
            },
            {
                "name": "retail_chains_sweep",
                "source": "comprehensive_sa", 
                "filters": {
                    "keywords": ["Shoprite", "Pick n Pay", "Checkers", "KFC", "McDonald's"],
                    "location": "South Africa"
                },
                "schedule": "07:00",
                "priority": 1
            },
            {
                "name": "government_jobs_sweep",
                "source": "comprehensive_sa",
                "filters": {
                    "keywords": ["government", "municipality", "DPSA", "civil service"],
                    "location": "South Africa"
                },
                "schedule": "08:00",
                "priority": 2
            },
            {
                "name": "professional_jobs_sweep",
                "source": "comprehensive_sa",
                "filters": {
                    "job_level": "mid",
                    "keywords": ["IT", "finance", "marketing", "engineering"],
                    "location": "South Africa"
                },
                "schedule": "09:00",
                "priority": 2
            },
            {
                "name": "executive_sweep",
                "source": "comprehensive_sa",
                "filters": {
                    "job_level": "executive",
                    "include_hidden_market": True,
                    "location": "South Africa"
                },
                "schedule": "10:00",
                "priority": 3
            },
            {
                "name": "regional_sweep_johannesburg",
                "source": "comprehensive_sa",
                "filters": {
                    "location": "Johannesburg",
                    "keywords": ["jobs", "careers"]
                },
                "schedule": "11:00",
                "priority": 2
            },
            {
                "name": "regional_sweep_cape_town",
                "source": "comprehensive_sa", 
                "filters": {
                    "location": "Cape Town",
                    "keywords": ["jobs", "careers"]
                },
                "schedule": "12:00",
                "priority": 2
            },
            {
                "name": "regional_sweep_durban",
                "source": "comprehensive_sa",
                "filters": {
                    "location": "Durban", 
                    "keywords": ["jobs", "careers"]
                },
                "schedule": "13:00",
                "priority": 2
            },
            {
                "name": "industry_specific_mining",
                "source": "comprehensive_sa",
                "filters": {
                    "keywords": ["mining", "gold", "platinum", "coal"],
                    "location": "South Africa"
                },
                "schedule": "14:00",
                "priority": 2
            },
            {
                "name": "industry_specific_healthcare",
                "source": "comprehensive_sa",
                "filters": {
                    "keywords": ["nurse", "doctor", "healthcare", "medical"],
                    "location": "South Africa"
                },
                "schedule": "15:00",
                "priority": 2
            },
            {
                "name": "part_time_weekend_jobs",
                "source": "comprehensive_sa",
                "filters": {
                    "keywords": ["part time", "weekend", "student job"],
                    "location": "South Africa"
                },
                "schedule": "16:00",
                "priority": 1
            },
            {
                "name": "fresh_graduate_sweep",
                "source": "comprehensive_sa",
                "filters": {
                    "keywords": ["graduate", "internship", "trainees"],
                    "location": "South Africa"
                },
                "schedule": "17:00",
                "priority": 1
            },
            {
                "name": "evening_comprehensive_sweep",
                "source": "comprehensive_sa",
                "filters": {
                    "keywords": ["jobs", "vacancies", "careers"],
                    "location": "South Africa"
                },
                "schedule": "18:00",
                "priority": 1
            }
        ]
        
        # Performance tracking
        self.daily_stats = {
            "jobs_scraped": 0,
            "sources_covered": set(),
            "sweep_results": {},
            "target_achievement": 0.0
        }

    async def start(self):
        """Start the SA market scheduler."""
        if self.is_running:
            logger.warning("SA Market Scheduler already running")
            return
            
        self.is_running = True
        logger.info("Starting SA Market Scheduler...")
        
        # Schedule all sweeps
        for strategy in self.search_strategies:
            schedule.every().day.at(strategy["schedule"]).do(
                self._schedule_sweep, strategy
            )
        
        # Schedule daily report
        schedule.every().day.at("23:00").do(self._generate_daily_report)
        
        # Schedule weekly comprehensive sweep
        schedule.every().sunday.at("02:00").do(self._weekly_comprehensive_sweep)
        
        # Start scheduler loop
        asyncio.create_task(self._scheduler_loop())
        
        logger.info("SA Market Scheduler started successfully")

    async def stop(self):
        """Stop the scheduler."""
        self.is_running = False
        schedule.clear()
        logger.info("SA Market Scheduler stopped")

    async def _scheduler_loop(self):
        """Main scheduler loop."""
        while self.is_running:
            schedule.run_pending()
            await asyncio.sleep(60)  # Check every minute

    def _schedule_sweep(self, strategy: Dict[str, Any]):
        """Schedule a sweep task."""
        logger.info(f"Scheduling sweep: {strategy['name']}")
        
        # Send to Kafka for orchestrator to pick up
        asyncio.create_task(
            orchestrator.kafka_producer.send(
                'scraping-tasks',
                value={
                    "action": "start",
                    "sources": [strategy["source"]],
                    "filters": strategy["filters"],
                    "strategy_name": strategy["name"],
                    "priority": strategy["priority"],
                    "scheduled_at": datetime.utcnow().isoformat()
                }
            )
        )

    async def _weekly_comprehensive_sweep(self):
        """Run a comprehensive weekly sweep to catch anything missed."""
        logger.info("Starting weekly comprehensive sweep...")
        
        comprehensive_strategies = [
            {
                "source": "comprehensive_sa",
                "filters": {
                    "keywords": ["entry level", "no experience", "trainee"],
                    "location": loc
                }
            }
            for loc in ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth"]
        ]
        
        # Add government-specific sweep
        comprehensive_strategies.append({
            "source": "comprehensive_sa",
            "filters": {
                "keywords": ["government", "municipality", "public sector", "civil service"],
                "location": "South Africa"
            }
        })
        
        # Add major employer sweep
        major_employers = [
            "Shoprite", "Pick n Pay", "Woolworths", "Game", "Makro",
            "KFC", "McDonald's", "Steers", "Nandos", "Burger King",
            "Sasol", "MTN", "Vodacom", "Standard Bank", "FNB"
        ]
        
        for employer in major_employers:
            comprehensive_strategies.append({
                "source": "comprehensive_sa",
                "filters": {
                    "keywords": [employer, "jobs"],
                    "location": "South Africa"
                }
            })
        
        # Execute all comprehensive strategies
        for strategy in comprehensive_strategies:
            await orchestrator.kafka_producer.send(
                'scraping-tasks',
                value={
                    "action": "start", 
                    "sources": [strategy["source"]],
                    "filters": strategy["filters"],
                    "strategy_name": "weekly_comprehensive",
                    "priority": 1
                }
            )
            
            # Small delay to prevent overwhelming
            await asyncio.sleep(2)

    async def _generate_daily_report(self):
        """Generate daily performance report."""
        logger.info("Generating daily SA market coverage report...")
        
        try:
            # Get orchestrator metrics
            status = await orchestrator.get_status()
            
            report = {
                "date": datetime.utcnow().isoformat(),
                "jobs_scraped_today": status["metrics"]["jobs_scraped"],
                "target_achievement": min(
                    status["metrics"]["jobs_scraped"] / self.daily_targets["total_target"],
                    1.0
                ),
                "sources_active": len([
                    pool for pool_name, pool in orchestrator.scraper_pools.items()
                    if pool_name in ["comprehensive_sa", "serpapi"]
                ]),
                "success_rate": status["metrics"].get("success_rate", 0.0),
                "recommendations": []
            }
            
            # Add recommendations based on performance
            if report["target_achievement"] < 0.5:
                report["recommendations"].append(
                    "Consider increasing SerpAPI query frequency for better coverage"
                )
                
            if report["success_rate"] < 0.8:
                report["recommendations"].append(
                    "Review circuit breaker status and proxy rotation"
                )
            
            # Send report to monitoring
            await orchestrator.kafka_producer.send(
                settings.kafka_topic_analytics,
                value={
                    "type": "daily_sa_market_report",
                    "report": report
                }
            )
            
            logger.info(f"Daily report: {report['jobs_scraped_today']} jobs "
                       f"({report['target_achievement']:.1%} of target)")
                       
        except Exception as e:
            logger.error(f"Error generating daily report: {e}")

    async def force_comprehensive_sweep(self):
        """Force a comprehensive sweep immediately."""
        logger.info("Forcing comprehensive SA market sweep...")
        
        # Execute all strategies immediately
        for strategy in self.search_strategies:
            await orchestrator.kafka_producer.send(
                'scraping-tasks',
                value={
                    "action": "start",
                    "sources": [strategy["source"]], 
                    "filters": strategy["filters"],
                    "strategy_name": f"forced_{strategy['name']}",
                    "priority": 1
                }
            )
            
            # Small delay between tasks
            await asyncio.sleep(1)
        
        logger.info("Comprehensive sweep initiated")

    async def get_coverage_metrics(self) -> Dict[str, Any]:
        """Get current SA job market coverage metrics."""
        status = await orchestrator.get_status()
        
        estimated_market_size = {
            "total_daily_jobs_posted": 10800,  # Conservative estimate
            "entry_level": 5400,
            "mid_level": 3200,
            "senior_level": 1600,
            "executive_level": 600
        }
        
        current_coverage = {
            "jobs_scraped_today": status["metrics"]["jobs_scraped"],
            "market_coverage_percentage": min(
                status["metrics"]["jobs_scraped"] / estimated_market_size["total_daily_jobs_posted"],
                1.0
            ) * 100,
            "target_achievement": min(
                status["metrics"]["jobs_scraped"] / self.daily_targets["total_target"],
                1.0
            ) * 100,
            "estimated_market_size": estimated_market_size,
            "active_scrapers": status["active_workers"],
            "success_rate": status["metrics"].get("success_rate", 0.0) * 100
        }
        
        return current_coverage


# Global scheduler instance
sa_scheduler = SAMarketScheduler()


async def start_sa_market_coverage():
    """Start comprehensive SA job market coverage."""
    await sa_scheduler.start()
    logger.info("SA job market coverage started - targeting 50%+ market share")


async def get_sa_coverage_status():
    """Get current SA job market coverage status."""
    return await sa_scheduler.get_coverage_metrics()
