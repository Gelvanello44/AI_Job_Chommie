#!/usr/bin/env node

import axios from 'axios';
import { spawn } from 'child_process';

const BASE_URL = 'http://localhost:5000';
const API_BASE = `${BASE_URL}/api/v1`;

// Color output for better readability
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Start the server
let serverProcess;

async function startServer() {
  return new Promise((resolve, reject) => {
    log('\n Starting backend server...', 'cyan');
    
    serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: process.cwd(),
      stdio: 'pipe',
      shell: true
    });

    let serverReady = false;

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server running on port') && !serverReady) {
        serverReady = true;
        log(' Server started successfully', 'green');
        setTimeout(resolve, 2000); // Give it 2 more seconds to fully initialize
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const error = data.toString();
      if (!error.includes('Prisma') && !error.includes('experimental')) {
        console.error('Server error:', error);
      }
    });

    serverProcess.on('error', reject);

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Server failed to start within 30 seconds'));
      }
    }, 30000);
  });
}

async function stopServer() {
  if (serverProcess) {
    log('\n Stopping server...', 'yellow');
    serverProcess.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function testHealthCheck() {
  log('\n Testing Health Check Endpoint...', 'blue');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    log(` Health check passed: ${response.data.status}`, 'green');
    log(`   Database: ${response.data.services.database}`, 'green');
    log(`   Redis: ${response.data.services.redis}`, 'green');
    return true;
  } catch (error) {
    log(` Health check failed: ${error.message}`, 'red');
    return false;
  }
}

async function testRateLimiting() {
  log('\n Testing Rate Limiting...', 'blue');
  
  // Test API endpoint rate limiting instead of auth to avoid conflicts
  log('  Testing API rate limiting (60 requests per minute)...', 'cyan');
  const endpoint = `${BASE_URL}/health`;
  const requests = [];
  
  // Send 65 requests to exceed the 60 per minute limit
  for (let i = 0; i < 65; i++) {
    requests.push(
      axios.get(endpoint).then(res => ({
        status: res.status,
        message: 'Success'
      })).catch(err => ({
        status: err.response?.status,
        message: err.response?.data?.error || err.message
      }))
    );
  }

  const results = await Promise.all(requests);
  
  let rateLimited = false;
  results.forEach((result, index) => {
    if (result.status === 429) {
      log(`   Request ${index + 1}: Rate limited (429)`, 'green');
      rateLimited = true;
    } else {
      log(`  ℹ  Request ${index + 1}: Status ${result.status || 'unknown'}`, 'yellow');
    }
  });

  if (rateLimited) {
    log(' Rate limiting is working correctly', 'green');
    return true;
  } else {
    log('  Rate limiting may not be configured properly', 'yellow');
    return false;
  }
}

async function testAuthentication() {
  log('\n Testing Authentication Flow...', 'blue');
  
  // Wait for rate limit to reset
  log('  Waiting 5 seconds for rate limit to reset...', 'yellow');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Test registration
  log('  Testing user registration...', 'cyan');
  const testUser = {
    email: `test_${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    role: 'JOB_SEEKER',
    acceptTerms: true
  };

  try {
    const registerResponse = await axios.post(`${API_BASE}/auth/register`, testUser);
    
    if (registerResponse.data.success) {
      log('   Registration successful', 'green');
      log(`     User ID: ${registerResponse.data.data.user.id}`, 'green');
      
      const { accessToken, refreshToken } = registerResponse.data.data.tokens;
      
      // Test protected endpoint with token
      log('  Testing protected endpoint with token...', 'cyan');
      const profileResponse = await axios.get(`${API_BASE}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (profileResponse.data.success) {
        log('   Protected endpoint access successful', 'green');
        log(`     User email: ${profileResponse.data.data.user.email}`, 'green');
      }
      
      // Test token refresh
      log('  Testing token refresh...', 'cyan');
      const refreshResponse = await axios.post(`${API_BASE}/auth/refresh-token`, {
        refreshToken
      });
      
      if (refreshResponse.data.success) {
        log('   Token refresh successful', 'green');
      }
      
      return true;
    }
  } catch (error) {
    log(`   Authentication test failed: ${error.response?.data?.error || error.message}`, 'red');
    if (error.response?.data?.details) {
      log(`     Details: ${JSON.stringify(error.response.data.details)}`, 'red');
    }
    return false;
  }
}

async function testCSRFProtection() {
  log('\n  Testing CSRF Protection...', 'blue');
  
  try {
    // Get CSRF token
    const tokenResponse = await axios.get(`${API_BASE}/security/csrf-token`);
    const csrfToken = tokenResponse.data.data.token;
    
    if (csrfToken) {
      log('   CSRF token generated successfully', 'green');
      log(`     Token: ${csrfToken.substring(0, 20)}...`, 'green');
      return true;
    }
  } catch (error) {
    log(`    CSRF endpoint not accessible: ${error.message}`, 'yellow');
    return false;
  }
}

async function runTests() {
  log('\n', 'cyan');
  log('     AI Job Chommie - Integration Test Suite', 'cyan');
  log('', 'cyan');

  let allTestsPassed = true;

  try {
    // Start the server
    await startServer();
    
    // Wait a bit for all services to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Run tests
    const healthPassed = await testHealthCheck();
    allTestsPassed = allTestsPassed && healthPassed;

    const rateLimitPassed = await testRateLimiting();
    allTestsPassed = allTestsPassed && rateLimitPassed;

    const authPassed = await testAuthentication();
    allTestsPassed = allTestsPassed && authPassed;

    const csrfPassed = await testCSRFProtection();
    allTestsPassed = allTestsPassed && csrfPassed;

    // Summary
    log('\n', 'cyan');
    log('                  TEST SUMMARY', 'cyan');
    log('', 'cyan');
    
    log(`Health Check:      ${healthPassed ? ' PASSED' : ' FAILED'}`, healthPassed ? 'green' : 'red');
    log(`Rate Limiting:     ${rateLimitPassed ? ' PASSED' : ' FAILED'}`, rateLimitPassed ? 'green' : 'red');
    log(`Authentication:    ${authPassed ? ' PASSED' : ' FAILED'}`, authPassed ? 'green' : 'red');
    log(`CSRF Protection:   ${csrfPassed ? ' PASSED' : ' FAILED'}`, csrfPassed ? 'green' : 'red');
    
    log('\n', 'cyan');
    
    if (allTestsPassed) {
      log('\n ALL TESTS PASSED! The integration is working correctly.', 'green');
    } else {
      log('\n  Some tests failed. Please review the output above.', 'yellow');
    }

  } catch (error) {
    log(`\n Test suite failed: ${error.message}`, 'red');
    allTestsPassed = false;
  } finally {
    await stopServer();
    process.exit(allTestsPassed ? 0 : 1);
  }
}

// Handle interruption
process.on('SIGINT', async () => {
  log('\n\n  Tests interrupted by user', 'yellow');
  await stopServer();
  process.exit(1);
});

// Run the tests
runTests().catch(error => {
  log(`\n Unexpected error: ${error.message}`, 'red');
  stopServer().then(() => process.exit(1));
});
