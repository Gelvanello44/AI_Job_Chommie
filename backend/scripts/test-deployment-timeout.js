#!/usr/bin/env node

/**
 *  MAGIC: HuggingFace Model Deployment Test Script with Timeout
 * 
 * This script wraps the full deployment test with a timeout to prevent hanging
 * Run with: node scripts/test-deployment-timeout.js
 */

import { spawn } from 'child_process';
import chalk from 'chalk';

const TIMEOUT_MS = 120000; // 2 minutes timeout

async function runDeploymentTestWithTimeout() {
  console.log(chalk.blue.bold('\n DEPLOYMENT TEST WITH TIMEOUT'));
  console.log(chalk.yellow('=' .repeat(50)));
  console.log(chalk.gray(`Timeout: ${TIMEOUT_MS / 1000} seconds\n`));

  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'test:deployment'], {
      stdio: 'inherit',
      shell: true
    });

    // Set up timeout
    const timeout = setTimeout(() => {
      console.log(chalk.yellow('\n⏰ Test timed out - terminating...'));
      child.kill('SIGTERM');
      
      setTimeout(() => {
        if (!child.killed) {
          console.log(chalk.red(' Force killing test process...'));
          child.kill('SIGKILL');
        }
      }, 5000);
      
      resolve({
        status: 'timeout',
        message: `Test timed out after ${TIMEOUT_MS / 1000} seconds`
      });
    }, TIMEOUT_MS);

    child.on('close', (code) => {
      clearTimeout(timeout);
      
      if (code === 0) {
        console.log(chalk.green('\n Deployment test completed successfully'));
        resolve({ status: 'success', code });
      } else {
        console.log(chalk.yellow(`\n Deployment test exited with code ${code}`));
        resolve({ status: 'completed', code });
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      console.error(chalk.red('\n Error running deployment test:'), error.message);
      reject(error);
    });
  });
}

async function main() {
  try {
    const result = await runDeploymentTestWithTimeout();
    
    console.log(chalk.blue.bold('\n TIMEOUT TEST RESULTS'));
    console.log(chalk.yellow('-'.repeat(30)));
    
    switch (result.status) {
      case 'success':
        console.log(chalk.green(' Status: Test completed successfully'));
        process.exit(0);
        break;
      case 'timeout':
        console.log(chalk.yellow('⏰ Status: Test timed out'));
        console.log(chalk.gray('   This suggests the HuggingFace API is slow/unresponsive'));
        console.log(chalk.gray('   The application should still work with fallback responses'));
        process.exit(2);
        break;
      case 'completed':
        console.log(chalk.yellow(` Status: Test completed with exit code ${result.code}`));
        console.log(chalk.gray('   Check the output above for specific issues'));
        process.exit(result.code);
        break;
      default:
        console.log(chalk.red(' Status: Unknown result'));
        process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red.bold(' Fatal error:'), error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
