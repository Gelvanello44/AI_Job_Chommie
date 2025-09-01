#!/usr/bin/env node

/**
 * Production startup script for Koyeb deployment
 * This script ensures the app starts correctly in production
 */

const path = require('path');
const { spawn } = require('child_process');

// Set production environment
process.env.NODE_ENV = 'production';

// Ensure port is set
if (!process.env.PORT) {
  process.env.PORT = '5000';
}

console.log('Starting AI Job Chommie Backend...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT);

// Check if TypeScript build exists
const fs = require('fs');
const distPath = path.join(__dirname, 'dist');

if (!fs.existsSync(distPath)) {
  console.log('Build directory not found. Building application...');
  
  // Run build
  const buildProcess = spawn('npm', ['run', 'build'], {
    stdio: 'inherit',
    shell: true
  });

  buildProcess.on('close', (code) => {
    if (code !== 0) {
      console.error('Build failed with code', code);
      process.exit(1);
    }
    
    // Start the application
    startApp();
  });
} else {
  // Start the application directly
  startApp();
}

function startApp() {
  console.log('Starting application...');
  
  // Generate Prisma client if needed
  const prismaProcess = spawn('npx', ['prisma', 'generate'], {
    stdio: 'inherit',
    shell: true
  });

  prismaProcess.on('close', (code) => {
    if (code !== 0) {
      console.error('Prisma generation failed with code', code);
    }
    
    // Start the main application
    const mainFile = path.join(__dirname, 'dist', 'server.js');
    
    // Check if server.js exists, otherwise try main.js
    const serverFile = fs.existsSync(mainFile) 
      ? mainFile 
      : path.join(__dirname, 'dist', 'main.js');
    
    console.log('Starting from:', serverFile);
    
    const appProcess = spawn('node', [serverFile], {
      stdio: 'inherit'
    });

    appProcess.on('close', (code) => {
      console.log('Application exited with code', code);
      process.exit(code || 0);
    });

    // Handle termination signals
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully...');
      appProcess.kill('SIGTERM');
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully...');
      appProcess.kill('SIGINT');
    });
  });
}
