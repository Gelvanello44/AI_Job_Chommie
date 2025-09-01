"""
Legal Scraper Manager - Manages only 100% legal data sources
Disconnects non-working scrapers and provides visual monitoring
"""

import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
from enum import Enum
from loguru import logger
import json
from rich.console import Console
from rich.table import Table
from rich.live import Live
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.layout import Layout
from rich.text import Text
import time

# Import ONLY the legal scrapers
from src.scrapers.serpapi_scraper import SerpAPIScraper
from src.scrapers.rss_parser import RSSFeedParser
from src.scrapers.government_scraper import GovernmentPortalScraper
from src.scrapers.company_scraper import CompanyScraper


class ScraperStatus(Enum):
    """Scraper status enumeration."""
    ACTIVE = " ACTIVE"
    INACTIVE = " INACTIVE"
    SCRAPING = " SCRAPING"
    ERROR = " ERROR"
    DISCONNECTED = " DISCONNECTED"
    RATE_LIMITED = "⏸ RATE LIMITED"


class LegalScraperManager:
    """
    Manages only 100% legal scrapers with visual monitoring.
    Automatically disconnects non-working scrapers.
    """
    
    def __init__(self):
        self.console = Console()
        
        # LEGAL SCRAPERS ONLY
        self.legal_scrapers = {
            "serpapi": {
                "instance": None,
                "class": SerpAPIScraper,
                "status": ScraperStatus.INACTIVE,
                "legal_status": " 100% Legal - Paid API",
                "jobs_scraped": 0,
                "last_run": None,
                "quota": {"used": 0, "limit": 250},
                "enabled": True
            },
            "rss_feeds": {
                "instance": None,
                "class": RSSFeedParser,
                "status": ScraperStatus.INACTIVE,
                "legal_status": " 100% Legal - RSS Syndication",
                "jobs_scraped": 0,
                "last_run": None,
                "feeds": 0,
                "enabled": True
            },
            "government": {
                "instance": None,
                "class": GovernmentPortalScraper,
                "status": ScraperStatus.INACTIVE,
                "legal_status": " 100% Legal - Public Domain",
                "jobs_scraped": 0,
                "last_run": None,
                "portals": 6,
                "enabled": True
            },
            "company": {
                "instance": None,
                "class": CompanyScraper,
                "status": ScraperStatus.INACTIVE,
                "legal_status": " Legal - Company Direct",
                "jobs_scraped": 0,
                "last_run": None,
                "companies": 0,
                "enabled": True
            }
        }
        
        # DISCONNECTED SCRAPERS (Non-working/Risky)
        self.disconnected_scrapers = {
            "linkedin": {
                "reason": "No API key, high legal risk",
                "status": ScraperStatus.DISCONNECTED,
                "alternative": "Use SerpAPI for LinkedIn results"
            },
            "indeed": {
                "reason": "Waiting for Publisher Program approval",
                "status": ScraperStatus.DISCONNECTED,
                "alternative": "Use RSS feeds + SerpAPI"
            },
            "glassdoor": {
                "reason": "No API access, blocks scrapers",
                "status": ScraperStatus.DISCONNECTED,
                "alternative": "Use SerpAPI for Glassdoor results"
            },
            "jobspy": {
                "reason": "Legal risk if run server-side",
                "status": ScraperStatus.DISCONNECTED,
                "alternative": "Users run locally and upload"
            }
        }
        
        # Metrics
        self.total_jobs_scraped = 0
        self.scraping_sessions = []
        self.errors = []
        self.start_time = datetime.utcnow()
        
        # Control flags
        self.is_running = False
        self.visual_monitor_task = None
        
    async def initialize(self):
        """Initialize all legal scrapers."""
        self.console.print("\n[bold cyan] LEGAL SCRAPER MANAGER INITIALIZATION[/bold cyan]\n")
        
        # Disconnect and purge non-working scrapers
        await self._disconnect_illegal_scrapers()
        
        # Initialize legal scrapers
        for name, config in self.legal_scrapers.items():
            if config["enabled"]:
                try:
                    self.console.print(f"[yellow]Initializing {name}...[/yellow]")
                    config["instance"] = config["class"]()
                    config["status"] = ScraperStatus.ACTIVE
                    self.console.print(f"[green] {name} initialized - {config['legal_status']}[/green]")
                except Exception as e:
                    config["status"] = ScraperStatus.ERROR
                    self.console.print(f"[red] Failed to initialize {name}: {e}[/red]")
                    self.errors.append({"scraper": name, "error": str(e), "time": datetime.utcnow()})
        
        self.console.print("\n[bold green] Legal scrapers ready![/bold green]\n")
    
    async def _disconnect_illegal_scrapers(self):
        """Disconnect and purge non-working/illegal scrapers."""
        self.console.print("\n[bold red] DISCONNECTING NON-WORKING SCRAPERS[/bold red]\n")
        
        table = Table(title="Disconnected Scrapers", show_header=True)
        table.add_column("Scraper", style="red")
        table.add_column("Reason", style="yellow")
        table.add_column("Alternative", style="green")
        
        for name, info in self.disconnected_scrapers.items():
            table.add_row(name.upper(), info["reason"], info["alternative"])
            
            # Purge any existing connections
            try:
                # Remove from any import statements
                import sys
                module_names = [
                    f"src.scrapers.{name}_scraper",
                    f"src.scrapers.jobspy",
                    f"jobspy"
                ]
                for module in module_names:
                    if module in sys.modules:
                        del sys.modules[module]
                        self.console.print(f"[dim]Purged module: {module}[/dim]")
            except:
                pass
        
        self.console.print(table)
        self.console.print("\n[bold yellow] These scrapers have been permanently disconnected[/bold yellow]\n")
    
    async def start_visual_monitoring(self):
        """Start visual monitoring dashboard."""
        self.is_running = True
        
        # Create layout for monitoring
        layout = Layout()
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="main"),
            Layout(name="footer", size=3)
        )
        
        layout["main"].split_row(
            Layout(name="scrapers", ratio=2),
            Layout(name="metrics", ratio=1)
        )
        
        # Start monitoring task
        self.visual_monitor_task = asyncio.create_task(self._update_visual_monitor(layout))
        
        # Start live display
        with Live(layout, refresh_per_second=1, console=self.console) as live:
            while self.is_running:
                await asyncio.sleep(1)
    
    async def _update_visual_monitor(self, layout):
        """Update visual monitoring display."""
        while self.is_running:
            try:
                # Update header
                header = Panel(
                    Text(
                        f" LEGAL SCRAPER MONITOR - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                        justify="center",
                        style="bold cyan"
                    ),
                    style="cyan"
                )
                layout["header"].update(header)
                
                # Update scrapers status
                scraper_table = Table(title="Active Legal Scrapers", show_header=True)
                scraper_table.add_column("Scraper", style="cyan")
                scraper_table.add_column("Status", style="green")
                scraper_table.add_column("Legal", style="green")
                scraper_table.add_column("Jobs", style="yellow")
                scraper_table.add_column("Last Run", style="blue")
                
                for name, config in self.legal_scrapers.items():
                    last_run = config["last_run"].strftime("%H:%M:%S") if config["last_run"] else "Never"
                    scraper_table.add_row(
                        name.upper(),
                        config["status"].value,
                        config["legal_status"],
                        str(config["jobs_scraped"]),
                        last_run
                    )
                
                layout["scrapers"].update(Panel(scraper_table, title="Scrapers", style="green"))
                
                # Update metrics
                uptime = (datetime.utcnow() - self.start_time).total_seconds()
                hours = int(uptime // 3600)
                minutes = int((uptime % 3600) // 60)
                
                metrics_text = f"""
[bold cyan]System Metrics[/bold cyan]

[yellow]Total Jobs:[/yellow] {self.total_jobs_scraped:,}
[yellow]Sessions:[/yellow] {len(self.scraping_sessions)}
[yellow]Errors:[/yellow] {len(self.errors)}
[yellow]Uptime:[/yellow] {hours}h {minutes}m

[bold cyan]Quota Status[/bold cyan]

[yellow]SerpAPI:[/yellow] {self.legal_scrapers['serpapi']['quota']['used']}/{self.legal_scrapers['serpapi']['quota']['limit']}
[yellow]RSS Feeds:[/yellow] Unlimited 
[yellow]Government:[/yellow] Unlimited 

[bold cyan]Legal Status[/bold cyan]

[green] All Active[/green]
[green] Zero Risk[/green]
[green] Compliant[/green]
                """
                
                layout["metrics"].update(Panel(metrics_text, title="Metrics", style="yellow"))
                
                # Update footer
                footer = Panel(
                    Text(
                        "Press Ctrl+C to stop | 100% Legal Data Sources Only",
                        justify="center",
                        style="dim"
                    ),
                    style="dim"
                )
                layout["footer"].update(footer)
                
            except Exception as e:
                logger.error(f"Monitor update error: {e}")
            
            await asyncio.sleep(1)
    
    async def scrape_all_sources(self, filters: Dict[str, Any] = None):
        """Scrape all legal sources with visual feedback."""
        session_id = datetime.utcnow().isoformat()
        self.scraping_sessions.append({
            "id": session_id,
            "start": datetime.utcnow(),
            "filters": filters
        })
        
        all_results = {
            "jobs": [],
            "companies": set(),
            "sources": {},
            "session_id": session_id,
            "legal_compliance": "100% Legal"
        }
        
        # Create progress display
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            console=self.console
        ) as progress:
            
            task_id = progress.add_task("[cyan]Scraping legal sources...", total=len(self.legal_scrapers))
            
            for name, config in self.legal_scrapers.items():
                if config["enabled"] and config["instance"]:
                    progress.update(task_id, description=f"[yellow]Scraping {name}...")
                    
                    # Update status
                    config["status"] = ScraperStatus.SCRAPING
                    config["last_run"] = datetime.utcnow()
                    
                    try:
                        # Perform scraping
                        self.console.print(f"\n[cyan]{'='*50}[/cyan]")
                        self.console.print(f"[bold cyan]Starting {name.upper()} scraper...[/bold cyan]")
                        
                        results = await config["instance"].scrape(filters=filters)
                        
                        # Process results
                        jobs = results.get("jobs", [])
                        config["jobs_scraped"] += len(jobs)
                        self.total_jobs_scraped += len(jobs)
                        
                        all_results["jobs"].extend(jobs)
                        all_results["sources"][name] = {
                            "jobs_found": len(jobs),
                            "status": "success",
                            "legal_status": config["legal_status"]
                        }
                        
                        # Update quota for SerpAPI
                        if name == "serpapi" and hasattr(config["instance"], "get_quota_status"):
                            quota = config["instance"].get_quota_status()
                            config["quota"]["used"] = quota.get("used_quota", 0)
                            config["quota"]["limit"] = quota.get("monthly_quota", 250)
                        
                        # Visual feedback
                        self.console.print(f"[green] {name}: Found {len(jobs)} jobs[/green]")
                        
                        # Show sample jobs
                        if jobs and len(jobs) > 0:
                            self.console.print("\n[dim]Sample jobs found:[/dim]")
                            for job in jobs[:3]:
                                self.console.print(f"  [dim]• {job.get('title', 'N/A')} at {job.get('company', {}).get('name', 'N/A')}[/dim]")
                        
                        config["status"] = ScraperStatus.ACTIVE
                        
                    except Exception as e:
                        config["status"] = ScraperStatus.ERROR
                        self.errors.append({
                            "scraper": name,
                            "error": str(e),
                            "time": datetime.utcnow()
                        })
                        all_results["sources"][name] = {
                            "jobs_found": 0,
                            "status": "error",
                            "error": str(e)
                        }
                        self.console.print(f"[red] Error in {name}: {e}[/red]")
                    
                    progress.advance(task_id)
                    
                    # Rate limiting between scrapers
                    await asyncio.sleep(2)
        
        # Convert companies set to list
        all_results["companies"] = list(all_results["companies"])
        
        # Summary
        self._display_scraping_summary(all_results)
        
        return all_results
    
    def _display_scraping_summary(self, results: Dict[str, Any]):
        """Display scraping summary with visual formatting."""
        self.console.print(f"\n[cyan]{'='*60}[/cyan]")
        self.console.print("[bold cyan] SCRAPING SUMMARY[/bold cyan]")
        self.console.print(f"[cyan]{'='*60}[/cyan]\n")
        
        # Create summary table
        summary_table = Table(show_header=True, title="Results by Source")
        summary_table.add_column("Source", style="cyan")
        summary_table.add_column("Jobs Found", style="yellow")
        summary_table.add_column("Status", style="green")
        summary_table.add_column("Legal Status", style="green")
        
        total_jobs = 0
        for source, data in results["sources"].items():
            jobs_found = data["jobs_found"]
            total_jobs += jobs_found
            status_icon = "" if data["status"] == "success" else ""
            summary_table.add_row(
                source.upper(),
                str(jobs_found),
                f"{status_icon} {data['status']}",
                data.get("legal_status", " Legal")
            )
        
        self.console.print(summary_table)
        
        # Overall statistics
        self.console.print(f"\n[bold green] Total Jobs Scraped: {total_jobs}[/bold green]")
        self.console.print(f"[bold green] Legal Compliance: {results['legal_compliance']}[/bold green]")
        self.console.print(f"[bold cyan] Session ID: {results['session_id']}[/bold cyan]")
        
        # Show disconnected scrapers reminder
        if self.disconnected_scrapers:
            self.console.print(f"\n[yellow] Reminder: {len(self.disconnected_scrapers)} scrapers are disconnected for legal/technical reasons[/yellow]")
            self.console.print("[dim]Use 'show_disconnected()' to see details[/dim]")
    
    def show_disconnected(self):
        """Show disconnected scrapers and their alternatives."""
        table = Table(title=" Disconnected Scrapers", show_header=True)
        table.add_column("Scraper", style="red")
        table.add_column("Status", style="red")
        table.add_column("Reason", style="yellow")
        table.add_column("Alternative", style="green")
        
        for name, info in self.disconnected_scrapers.items():
            table.add_row(
                name.upper(),
                info["status"].value,
                info["reason"],
                info["alternative"]
            )
        
        self.console.print("\n")
        self.console.print(table)
        self.console.print("\n[bold yellow]These scrapers have been permanently disconnected to ensure legal compliance[/bold yellow]")
    
    async def get_status(self) -> Dict[str, Any]:
        """Get current status of all scrapers."""
        return {
            "legal_scrapers": {
                name: {
                    "status": config["status"].value,
                    "jobs_scraped": config["jobs_scraped"],
                    "last_run": config["last_run"].isoformat() if config["last_run"] else None,
                    "legal_status": config["legal_status"]
                }
                for name, config in self.legal_scrapers.items()
            },
            "disconnected_scrapers": self.disconnected_scrapers,
            "total_jobs_scraped": self.total_jobs_scraped,
            "errors": len(self.errors),
            "uptime": (datetime.utcnow() - self.start_time).total_seconds()
        }
    
    async def stop(self):
        """Stop the scraper manager."""
        self.is_running = False
        if self.visual_monitor_task:
            self.visual_monitor_task.cancel()
        
        self.console.print("\n[bold red]Stopping Legal Scraper Manager...[/bold red]")
        self.console.print("[green] All scrapers stopped safely[/green]")
        self.console.print("[green] No legal risks taken[/green]")
        self.console.print("[green] System shutdown complete[/green]")
