#!/usr/bin/env node

/**
 *  QUICK: HuggingFace Model Deployment Test Script with Timeouts
 * 
 * This script tests the HuggingFace deployment with shorter timeouts
 * Run with: node scripts/test-deployment-quick.js
 */

import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config();

class QuickDeploymentTester {
  constructor() {
    this.testResults = {
      environment: false,
      imports: false,
      basicConnection: false,
      deployment: false
    };
  }

  /**
   *  QUICK: Run essential tests with timeouts
   */
  async runQuickTests() {
    console.log(chalk.blue.bold('\n QUICK DEPLOYMENT TEST\n'));
    console.log(chalk.yellow('=' .repeat(40)));

    try {
      // Step 1: Test environment
      await this.testEnvironment();
      
      // Step 2: Test imports
      await this.testImports();
      
      // Step 3: Test basic connectivity
      await this.testBasicConnectivity();
      
      // Step 4: Final report
      this.generateQuickReport();

    } catch (error) {
      console.error(chalk.red.bold(' CRITICAL ERROR:'), error.message);
      process.exit(1);
    }
  }

  /**
   *  Test environment configuration
   */
  async testEnvironment() {
    console.log(chalk.cyan.bold(' Testing Environment'));
    console.log(chalk.gray('-'.repeat(30)));

    const hasApiKey = Boolean(process.env.HUGGINGFACE_API_KEY);
    const nodeEnv = process.env.NODE_ENV || 'development';

    if (hasApiKey) {
      console.log(chalk.green(' HuggingFace API Key: Configured'));
      this.testResults.environment = true;
    } else {
      console.log(chalk.yellow(' HuggingFace API Key: Missing'));
      this.testResults.environment = false;
    }

    console.log(chalk.gray(`   Environment: ${nodeEnv}`));
  }

  /**
   *  Test service imports
   */
  async testImports() {
    console.log(chalk.cyan.bold('\n Testing Service Imports'));
    console.log(chalk.gray('-'.repeat(30)));

    try {
      // Test importing HuggingFace service
      console.log(chalk.yellow(' Importing HuggingFace service...'));
      const { HuggingFaceService } = await import('../src/services/huggingface.service.js');
      console.log(chalk.green(' HuggingFace service imported'));

      // Test importing model deployment service
      console.log(chalk.yellow(' Importing model deployment service...'));
      const { modelDeploymentService } = await import('../src/services/model-deployment.service.js');
      console.log(chalk.green(' Model deployment service imported'));

      // Test importing AI matching service
      console.log(chalk.yellow(' Importing AI matching service...'));
      const AiMatchingService = await import('../src/services/ai-matching.service.js');
      console.log(chalk.green(' AI matching service imported'));

      // Test importing Career DNA service
      console.log(chalk.yellow(' Importing Career DNA service...'));
      const CareerDnaService = await import('../src/services/career-dna.service.js');
      console.log(chalk.green(' Career DNA service imported'));

      // Test importing Skills Gap service
      console.log(chalk.yellow(' Importing Skills Gap service...'));
      const SkillsGapService = await import('../src/services/skills-gap-analysis.service.js');
      console.log(chalk.green(' Skills Gap service imported'));

      this.testResults.imports = true;

    } catch (error) {
      console.log(chalk.red(' Import failed:'), error.message);
      this.testResults.imports = false;
      throw error;
    }
  }

  /**
   *  Test basic connectivity with timeout
   */
  async testBasicConnectivity() {
    console.log(chalk.cyan.bold('\n Testing Basic Connectivity'));
    console.log(chalk.gray('-'.repeat(30)));

    try {
      // Test with 10 second timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection test timed out after 10 seconds')), 10000);
      });

      const { HuggingFaceService } = await import('../src/services/huggingface.service.js');
      const hfService = new HuggingFaceService();

      console.log(chalk.yellow(' Testing HuggingFace service creation...'));
      
      const healthCheckPromise = hfService.checkHealth();
      
      try {
        const isHealthy = await Promise.race([healthCheckPromise, timeoutPromise]);
        
        if (isHealthy) {
          console.log(chalk.green(' HuggingFace API: Connected'));
          this.testResults.basicConnection = true;
        } else {
          console.log(chalk.yellow(' HuggingFace API: Not connected (using mock)'));
          this.testResults.basicConnection = false;
        }
      } catch (error) {
        if (error.message.includes('timed out')) {
          console.log(chalk.yellow(' HuggingFace API: Connection timed out'));
        } else {
          console.log(chalk.red(' HuggingFace API: Connection failed'));
          console.log(chalk.red('   Error:'), error.message);
        }
        this.testResults.basicConnection = false;
      }

      // Test available models (should be quick)
      console.log(chalk.yellow(' Testing model configuration...'));
      const availableModels = hfService.getAvailableModels();
      console.log(chalk.green(' Model configuration loaded'));
      console.log(chalk.gray(`   Models configured: ${availableModels.modelsConfigured}`));

    } catch (error) {
      console.log(chalk.red(' Connectivity test failed:'), error.message);
      this.testResults.basicConnection = false;
    }
  }

  /**
   *  Generate quick test report
   */
  generateQuickReport() {
    console.log(chalk.blue.bold('\n QUICK TEST REPORT'));
    console.log(chalk.yellow('=' .repeat(40)));

    const tests = [
      { name: 'Environment Configuration', status: this.testResults.environment },
      { name: 'Service Imports', status: this.testResults.imports },
      { name: 'Basic Connectivity', status: this.testResults.basicConnection }
    ];

    tests.forEach(test => {
      const icon = test.status ? chalk.green('') : chalk.red('');
      console.log(`${icon} ${test.name}`);
    });

    const passedTests = tests.filter(t => t.status).length;
    const totalTests = tests.length;

    console.log('');
    if (passedTests === totalTests) {
      console.log(chalk.green.bold(' ALL TESTS PASSED - Deployment Ready!'));
    } else if (passedTests > 0) {
      console.log(chalk.yellow.bold(` PARTIAL SUCCESS - ${passedTests}/${totalTests} tests passed`));
    } else {
      console.log(chalk.red.bold(' TESTS FAILED - Deployment not ready'));
    }

    console.log('');
    console.log(chalk.gray('Note: If basic connectivity failed, the system will use mock responses for development.'));
  }
}

// Run the tests
const tester = new QuickDeploymentTester();
tester.runQuickTests().catch(error => {
  console.error(chalk.red.bold(' Test execution failed:'), error);
  process.exit(1);
});
