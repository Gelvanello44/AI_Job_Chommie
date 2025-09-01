#!/usr/bin/env python3
"""
Visual Demonstration of Legal Scraping System
Shows real-time scraping with visual feedback
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime
import random

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from rich.console import Console
from rich.table import Table
from rich.live import Live
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn
from rich.layout import Layout
from rich.text import Text
from rich.columns import Columns
import time


console = Console()


def create_layout():
    """Create the visual layout."""
    layout = Layout()
    
    layout.split_column(
        Layout(name="header", size=3),
        Layout(name="body"),
        Layout(name="footer", size=3)
    )
    
    layout["body"].split_row(
        Layout(name="left"),
        Layout(name="right")
    )
    
    return layout


async def simulate_scraping():
    """Simulate the scraping process with visual feedback."""
    
    console.clear()
    
    # Header
    console.print("\n" + "="*80)
    console.print("[bold cyan] LEGAL JOB SCRAPER - VISUAL DEMONSTRATION[/bold cyan]", justify="center")
    console.print("[green]100% Legal Data Sources Only[/green]", justify="center")
    console.print("="*80 + "\n")
    
    # Show disconnected scrapers first
    console.print("[bold red] STEP 1: DISCONNECTING NON-WORKING SCRAPERS[/bold red]\n")
    
    disconnected = [
        ("LinkedIn", "No API key, high legal risk", " DISCONNECTED"),
        ("Indeed", "Waiting for approval", " DISCONNECTED"),
        ("Glassdoor", "Blocks scrapers", " DISCONNECTED"),
        ("JobSpy", "Legal risk server-side", " DISCONNECTED"),
    ]
    
    for name, reason, status in disconnected:
        console.print(f"  [red]• {name}: {reason} - {status}[/red]")
        await asyncio.sleep(0.5)
    
    console.print("\n[yellow] All risky scrapers have been purged from the system[/yellow]\n")
    await asyncio.sleep(2)
    
    # Initialize legal scrapers
    console.print("[bold green] STEP 2: INITIALIZING LEGAL SCRAPERS[/bold green]\n")
    
    legal_scrapers = [
        ("RSS Feeds", "100% Legal - RSS Syndication", ""),
        ("Government Portals", "100% Legal - Public Domain", ""),
        ("SerpAPI", "100% Legal - Paid API", ""),
        ("Company Direct", "Legal - Career Pages", ""),
    ]
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TimeElapsedColumn(),
        console=console
    ) as progress:
        
        task = progress.add_task("[cyan]Initializing legal scrapers...", total=len(legal_scrapers))
        
        for name, status, icon in legal_scrapers:
            progress.update(task, description=f"[yellow]Initializing {name}...")
            await asyncio.sleep(1)
            console.print(f"  {icon} [green]{name}: {status}[/green]")
            progress.advance(task)
    
    await asyncio.sleep(2)
    
    # Start scraping simulation
    console.print("\n[bold cyan] STEP 3: STARTING LEGAL SCRAPING[/bold cyan]\n")
    
    # Create visual layout
    layout = create_layout()
    
    with Live(layout, refresh_per_second=2, console=console) as live:
        
        # Scraping sources
        sources = [
            {
                "name": "RSS Feeds",
                "status": " WAITING",
                "jobs": 0,
                "speed": random.randint(50, 100),
                "feeds": ["Careers24", "JobMail", "PNet"],
                "current_feed": 0
            },
            {
                "name": "Government",
                "status": " WAITING",
                "jobs": 0,
                "speed": random.randint(20, 40),
                "portals": ["DPSA", "Cape Town", "Universities"],
                "current_portal": 0
            },
            {
                "name": "SerpAPI",
                "status": " WAITING",
                "jobs": 0,
                "speed": random.randint(5, 15),
                "quota": {"used": 16, "limit": 250},
                "queries": ["developer", "engineer", "manager"]
            },
            {
                "name": "Company",
                "status": " WAITING",
                "jobs": 0,
                "speed": random.randint(10, 30),
                "companies": ["Google", "Microsoft", "Amazon"],
                "current_company": 0
            }
        ]
        
        total_jobs = 0
        elapsed_time = 0
        
        # Simulate scraping for 20 seconds
        for tick in range(40):
            
            # Update header
            header_text = f"""
[bold cyan] LEGAL SCRAPER MONITOR[/bold cyan]
[green]Time: {datetime.now().strftime('%H:%M:%S')} | Elapsed: {elapsed_time}s[/green]
            """
            layout["header"].update(Panel(header_text.strip(), style="cyan"))
            
            # Update scrapers
            for i, source in enumerate(sources):
                if tick == i * 5:  # Stagger start times
                    source["status"] = " SCRAPING"
                
                if source["status"] == " SCRAPING":
                    # Simulate finding jobs
                    new_jobs = random.randint(0, source["speed"] // 10)
                    source["jobs"] += new_jobs
                    total_jobs += new_jobs
                    
                    # Update feed/portal progress
                    if "feeds" in source and tick % 3 == 0:
                        source["current_feed"] = (source["current_feed"] + 1) % len(source["feeds"])
                    if "portals" in source and tick % 4 == 0:
                        source["current_portal"] = (source["current_portal"] + 1) % len(source["portals"])
                    if "companies" in source and tick % 5 == 0:
                        source["current_company"] = (source["current_company"] + 1) % len(source["companies"])
                    
                    # Mark complete after some time
                    if tick > (i * 5 + 15):
                        source["status"] = " COMPLETE"
            
            # Create scrapers table
            scraper_table = Table(title="Active Scrapers", show_header=True)
            scraper_table.add_column("Source", style="cyan")
            scraper_table.add_column("Status", style="yellow")
            scraper_table.add_column("Jobs Found", style="green")
            scraper_table.add_column("Current Target", style="blue")
            
            for source in sources:
                current = ""
                if "feeds" in source and source["status"] == " SCRAPING":
                    current = source["feeds"][source["current_feed"]]
                elif "portals" in source and source["status"] == " SCRAPING":
                    current = source["portals"][source["current_portal"]]
                elif "companies" in source and source["status"] == " SCRAPING":
                    current = source["companies"][source["current_company"]]
                elif "queries" in source and source["status"] == " SCRAPING":
                    current = f"Query {(tick % 3) + 1}/3"
                
                scraper_table.add_row(
                    source["name"],
                    source["status"],
                    str(source["jobs"]),
                    current
                )
            
            layout["left"].update(Panel(scraper_table, title="Scrapers", style="green"))
            
            # Create metrics panel
            metrics_text = f"""
[bold cyan]Live Metrics[/bold cyan]

[yellow]Total Jobs:[/yellow] {total_jobs:,}
[yellow]Active Scrapers:[/yellow] {sum(1 for s in sources if s['status'] == ' SCRAPING')}
[yellow]Completed:[/yellow] {sum(1 for s in sources if s['status'] == ' COMPLETE')}

[bold cyan]Quota Status[/bold cyan]

[yellow]SerpAPI:[/yellow] {sources[2]['quota']['used']}/{sources[2]['quota']['limit']}
[yellow]RSS:[/yellow] Unlimited 
[yellow]Gov:[/yellow] Unlimited 

[bold cyan]Legal Status[/bold cyan]

[green] 100% Legal[/green]
[green] Zero Risk[/green]
[green] Compliant[/green]

[bold cyan]Sample Jobs[/bold cyan]

[dim]• Software Engineer
• Data Analyst
• Project Manager
• Accountant
• Teacher[/dim]
            """
            
            layout["right"].update(Panel(metrics_text.strip(), title="Statistics", style="yellow"))
            
            # Update footer
            footer_text = "[dim]Live scraping demonstration | Press Ctrl+C to stop[/dim]"
            layout["footer"].update(Panel(footer_text, style="dim"))
            
            elapsed_time += 0.5
            await asyncio.sleep(0.5)
    
    # Final summary
    console.print("\n" + "="*80)
    console.print("[bold green] SCRAPING COMPLETE![/bold green]", justify="center")
    console.print("="*80 + "\n")
    
    # Summary table
    summary_table = Table(title="Final Results", show_header=True)
    summary_table.add_column("Source", style="cyan")
    summary_table.add_column("Jobs Found", style="yellow")
    summary_table.add_column("Legal Status", style="green")
    
    for source in sources:
        summary_table.add_row(
            source["name"],
            str(source["jobs"]),
            " 100% Legal"
        )
    
    summary_table.add_row("", "", "", style="dim")
    summary_table.add_row(
        "[bold]TOTAL[/bold]",
        f"[bold]{total_jobs}[/bold]",
        "[bold green] COMPLIANT[/bold green]"
    )
    
    console.print(summary_table)
    
    console.print("\n[bold cyan]Key Benefits:[/bold cyan]")
    console.print("  • [green]Zero legal risk - all sources are 100% legal[/green]")
    console.print("  • [green]No proxy costs - direct access to public data[/green]")
    console.print("  • [green]Sustainable - can run 24/7 without issues[/green]")
    console.print("  • [green]High quality - official sources only[/green]")
    
    console.print("\n[bold yellow]Disconnected Scrapers:[/bold yellow]")
    console.print("  • [red]LinkedIn, Indeed, Glassdoor, JobSpy - All permanently disconnected[/red]")
    console.print("  • [green]Replaced with legal alternatives (RSS, Gov, APIs)[/green]")


async def main():
    """Main function."""
    try:
        await simulate_scraping()
        
        console.print("\n[bold cyan]This was a visual demonstration of the legal scraping system.[/bold cyan]")
        console.print("[yellow]To run actual scraping, use: python test_legal_scrapers.py[/yellow]")
        
    except KeyboardInterrupt:
        console.print("\n[yellow]Demo interrupted by user[/yellow]")
    except Exception as e:
        console.print(f"\n[red]Error: {e}[/red]")


if __name__ == "__main__":
    asyncio.run(main())
