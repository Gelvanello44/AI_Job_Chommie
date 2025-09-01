#!/usr/bin/env python3
"""
Quick Production Launcher - Simplified startup for AI Job Chommie
"""

import os
import sys
import asyncio
import subprocess
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def ensure_data_dir():
    """Ensure data directory exists"""
    Path("data").mkdir(exist_ok=True)
    Path("logs").mkdir(exist_ok=True)
    Path("cache").mkdir(exist_ok=True)
    Path("models").mkdir(exist_ok=True)
    Path("uploads").mkdir(exist_ok=True)
    print(" Created required directories")

def start_model_service():
    """Start the AI model service"""
    print("\n Starting AI Model Service...")
    
    # Check if we have local_inference_service.py
    if Path("local_inference_service.py").exists():
        cmd = [sys.executable, "local_inference_service.py"]
        process = subprocess.Popen(cmd, creationflags=subprocess.CREATE_NEW_CONSOLE)
        print(f" Model Service started (PID: {process.pid})")
        return process
    else:
        print("  local_inference_service.py not found, skipping model service")
        return None

def start_backend_api():
    """Start the backend API"""
    print("\n Starting Backend API...")
    
    # Check for FastAPI backend
    if Path("ai-job-chommie-backend/src/server.js").exists():
        # Node.js backend
        print("Starting Node.js backend...")
        os.chdir("ai-job-chommie-backend")
        cmd = ["npm", "run", "dev"]
        process = subprocess.Popen(cmd, shell=True, creationflags=subprocess.CREATE_NEW_CONSOLE)
        os.chdir("..")
        print(f" Backend API started (PID: {process.pid})")
        return process
    elif Path("job_enrichment_local.py").exists():
        # Python backend
        cmd = [sys.executable, "job_enrichment_local.py"]
        process = subprocess.Popen(cmd, creationflags=subprocess.CREATE_NEW_CONSOLE)
        print(f" Backend API started (PID: {process.pid})")
        return process
    else:
        print("  Backend API not found")
        return None

def start_frontend():
    """Start the frontend"""
    print("\n Starting Frontend...")
    
    frontend_dir = "ai-job-chommie-landing-source"
    if Path(frontend_dir).exists():
        os.chdir(frontend_dir)
        
        # Install dependencies if needed
        if not Path("node_modules").exists():
            print("Installing frontend dependencies...")
            subprocess.run(["npm", "install"], shell=True)
        
        # Start frontend
        cmd = ["npm", "run", "dev"]
        process = subprocess.Popen(cmd, shell=True, creationflags=subprocess.CREATE_NEW_CONSOLE)
        os.chdir("..")
        print(f" Frontend started (PID: {process.pid})")
        return process
    else:
        print("  Frontend directory not found")
        return None

def start_simple_server():
    """Start a simple Python HTTP server to serve static files"""
    print("\n Starting simple HTTP server...")
    cmd = [sys.executable, "-m", "http.server", "3000"]
    process = subprocess.Popen(cmd, creationflags=subprocess.CREATE_NEW_CONSOLE)
    print(f" HTTP server started on http://localhost:3000 (PID: {process.pid})")
    return process

def main():
    print(" AI JOB CHOMMIE QUICK START")
    print("=" * 50)
    
    # Ensure directories exist
    ensure_data_dir()
    
    processes = []
    
    # Start services
    model_process = start_model_service()
    if model_process:
        processes.append(model_process)
    
    backend_process = start_backend_api()
    if backend_process:
        processes.append(backend_process)
    
    frontend_process = start_frontend()
    if frontend_process:
        processes.append(frontend_process)
    elif Path("index.html").exists():
        # Fallback to simple server
        server_process = start_simple_server()
        processes.append(server_process)
    
    print("\n" + "=" * 50)
    print(" STARTUP COMPLETE!")
    print("=" * 50)
    
    print("\n Available endpoints:")
    print("   Frontend: http://localhost:3000")
    print("   Backend API: http://localhost:3001")
    print("   Model API: http://localhost:5000")
    
    print("\n Running services:")
    for i, process in enumerate(processes):
        print(f"   Process {i+1}: PID {process.pid}")
    
    print("\nPress Ctrl+C to stop all services")
    
    try:
        # Keep running
        while True:
            input()
    except KeyboardInterrupt:
        print("\n\nShutting down...")
        for process in processes:
            process.terminate()
        print(" All services stopped")

if __name__ == "__main__":
    main()
