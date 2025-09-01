#!/usr/bin/env python3
"""
Test script for Legal Scraper Manager
Demonstrates visual monitoring of 100% legal scraping sources
"""

import asyncio
import sys
import os
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.scrapers.legal_scraper_manager import LegalScraperManager
from rich.console import Console
from rich.prompt import Prompt, Confirm
import signal


console = Console()


async def main():
    """Main test function with interactive menu."""
    
    # Banner
    console.print("\n" + "="*70)
    console.print("[bold cyan] LEGAL JOB SCRAPER SYSTEM[/bold cyan]", justify="center")
    console.print("[green]100% Legal Data Sources Only[/green]", justify="center")
    console.print("="*70 + "\n")
    
    # Initialize manager
    manager = LegalScraperManager()
    
    # Initialize scrapers
    await manager.initialize()
    
    # Show menu
    while True:
        console.print("\n[bold cyan] MENU[/bold cyan]")
        console.print("1. Run all legal scrapers")
        console.print("2. Start visual monitoring dashboard")
        console.print("3. Show disconnected scrapers")
        console.print("4. Test RSS feeds only")
        console.print("5. Test government portals only") 
        console.print("6. Test SerpAPI only")
        console.print("7. Show current status")
        console.print("8. Exit")
        
        choice = Prompt.ask("\n[yellow]Select option[/yellow]", choices=["1","2","3","4","5","6","7","8"])
        
        if choice == "1":
            # Run all scrapers
            console.print("\n[bold cyan]Starting all legal scrapers...[/bold cyan]")
            
            # Optional filters
            use_filters = Confirm.ask("Apply filters?", default=False)
            filters = None
            if use_filters:
                keywords = Prompt.ask("Keywords (comma separated)", default="")
                location = Prompt.ask("Location", default="Cape Town")
                filters = {
                    "keywords": keywords.split(",") if keywords else [],
                    "location": location
                }
            
            results = await manager.scrape_all_sources(filters)
            
            # Ask to save results
            if Confirm.ask("\nSave results to file?", default=True):
                import json
                filename = f"scraping_results_{results['session_id']}.json"
                with open(filename, "w") as f:
                    # Convert datetime objects to strings
                    def json_serial(obj):
                        if hasattr(obj, 'isoformat'):
                            return obj.isoformat()
                        raise TypeError(f"Type {type(obj)} not serializable")
                    
                    json.dump(results, f, indent=2, default=json_serial)
                console.print(f"[green] Results saved to {filename}[/green]")
        
        elif choice == "2":
            # Visual monitoring
            console.print("\n[bold cyan]Starting visual monitoring dashboard...[/bold cyan]")
            console.print("[dim]Press Ctrl+C to stop monitoring[/dim]\n")
            
            try:
                # Start monitoring in background
                monitor_task = asyncio.create_task(manager.start_visual_monitoring())
                
                # Also start periodic scraping
                async def periodic_scrape():
                    while manager.is_running:
                        await manager.scrape_all_sources()
                        await asyncio.sleep(300)  # Every 5 minutes
                
                scrape_task = asyncio.create_task(periodic_scrape())
                
                # Wait for interrupt
                await asyncio.gather(monitor_task, scrape_task)
                
            except KeyboardInterrupt:
                console.print("\n[yellow]Stopping monitor...[/yellow]")
                await manager.stop()
        
        elif choice == "3":
            # Show disconnected scrapers
            manager.show_disconnected()
        
        elif choice == "4":
            # Test RSS feeds only
            console.print("\n[bold cyan]Testing RSS feeds...[/bold cyan]")
            
            # Temporarily disable other scrapers
            for name in ["serpapi", "government", "company"]:
                manager.legal_scrapers[name]["enabled"] = False
            
            results = await manager.scrape_all_sources()
            
            # Re-enable
            for name in ["serpapi", "government", "company"]:
                manager.legal_scrapers[name]["enabled"] = True
        
        elif choice == "5":
            # Test government portals only
            console.print("\n[bold cyan]Testing government portals...[/bold cyan]")
            
            # Temporarily disable other scrapers
            for name in ["serpapi", "rss_feeds", "company"]:
                manager.legal_scrapers[name]["enabled"] = False
            
            results = await manager.scrape_all_sources()
            
            # Re-enable
            for name in ["serpapi", "rss_feeds", "company"]:
                manager.legal_scrapers[name]["enabled"] = True
        
        elif choice == "6":
            # Test SerpAPI only
            console.print("\n[bold cyan]Testing SerpAPI...[/bold cyan]")
            console.print("[yellow] This will use quota (currently limited)[/yellow]")
            
            if Confirm.ask("Continue?", default=False):
                # Temporarily disable other scrapers
                for name in ["rss_feeds", "government", "company"]:
                    manager.legal_scrapers[name]["enabled"] = False
                
                # Use high-value query
                filters = {
                    "keywords": ["software engineer", "developer"],
                    "location": "Cape Town"
                }
                results = await manager.scrape_all_sources(filters)
                
                # Re-enable
                for name in ["rss_feeds", "government", "company"]:
                    manager.legal_scrapers[name]["enabled"] = True
        
        elif choice == "7":
            # Show status
            status = await manager.get_status()
            
            console.print("\n[bold cyan] CURRENT STATUS[/bold cyan]")
            console.print(f"Total jobs scraped: {status['total_jobs_scraped']}")
            console.print(f"Errors: {status['errors']}")
            console.print(f"Uptime: {status['uptime']:.0f} seconds")
            
            console.print("\n[bold]Legal Scrapers:[/bold]")
            for name, info in status['legal_scrapers'].items():
                console.print(f"  • {name}: {info['status']} - {info['jobs_scraped']} jobs")
            
            console.print("\n[bold]Disconnected:[/bold]")
            console.print(f"  {len(status['disconnected_scrapers'])} scrapers disconnected")
        
        elif choice == "8":
            # Exit
            console.print("\n[bold green]Goodbye! Stay legal! [/bold green]")
            await manager.stop()
            break
    
    console.print("\n[green] Test completed successfully[/green]")


def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully."""
    console.print("\n[yellow]Interrupted by user[/yellow]")
    sys.exit(0)


if __name__ == "__main__":
    # Set up signal handler
    signal.signal(signal.SIGINT, signal_handler)
    
    # Check for required packages
    try:
        import feedparser
        import aiohttp
        from bs4 import BeautifulSoup
        from rich import print
    except ImportError as e:
        console.print(f"[red]Missing required package: {e}[/red]")
        console.print("[yellow]Installing required packages...[/yellow]")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "feedparser", "aiohttp", "beautifulsoup4", "rich", "python-dateutil"])
        console.print("[green] Packages installed![/green]")
    
    # Run async main
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        console.print("\n[yellow]Program interrupted[/yellow]")
    except Exception as e:
        console.print(f"\n[red]Error: {e}[/red]")
        import traceback
        traceback.print_exc()
