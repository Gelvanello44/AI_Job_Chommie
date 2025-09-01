#!/usr/bin/env node

/**
 *  MAGIC: HuggingFace Model Deployment Test Script
 * 
 * This script tests the complete HuggingFace deployment pipeline
 * Run with: node scripts/test-huggingface-deployment.js
 */

import dotenv from 'dotenv';
import chalk from 'chalk';
import { modelDeploymentService } from '../src/services/model-deployment.service.js';
import { HuggingFaceService } from '../src/services/huggingface.service.js';

// Load environment variables
dotenv.config();

class HuggingFaceDeploymentTester {
  constructor() {
    this.hfService = new HuggingFaceService();
    this.testResults = {
      connection: false,
      authentication: false,
      models: [],
      services: {},
      deployment: false,
      overallHealth: false
    };
  }

  /**
   *  MAGIC: Run complete deployment test suite
   */
  async runAllTests() {
    console.log(chalk.blue.bold('\n HUGGINGFACE MODEL DEPLOYMENT TEST SUITE\n'));
    console.log(chalk.yellow('=' .repeat(60)));

    try {
      // Step 1: Test environment configuration
      await this.testEnvironmentConfiguration();
      console.log('');

      // Step 2: Test HuggingFace API connection
      await this.testHuggingFaceConnection();
      console.log('');

      // Step 3: Test individual models
      await this.testIndividualModels();
      console.log('');

      // Step 4: Test deployment service
      await this.testDeploymentService();
      console.log('');

      // Step 5: Test all AI services
      await this.testAllAIServices();
      console.log('');

      // Step 6: Generate final report
      this.generateFinalReport();

    } catch (error) {
      console.error(chalk.red.bold(' CRITICAL ERROR:'), error.message);
      process.exit(1);
    }
  }

  /**
   *  MAGIC: Test environment configuration
   */
  async testEnvironmentConfiguration() {
    console.log(chalk.cyan.bold(' Testing Environment Configuration'));
    console.log(chalk.gray('-'.repeat(40)));

    const config = {
      huggingFaceApiKey: Boolean(process.env.HUGGINGFACE_API_KEY),
      textModel: process.env.HF_TEXT_MODEL || 'distilgpt2',
      classificationModel: process.env.HF_CLASSIFICATION_MODEL || 'cardiffnlp/twitter-roberta-base-sentiment-latest',
      embeddingModel: process.env.HF_RESUME_ANALYSIS_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
      maxTokens: process.env.HF_MAX_TOKENS || '1000',
      nodeEnv: process.env.NODE_ENV || 'development'
    };

    // Check API key
    if (config.huggingFaceApiKey) {
      console.log(chalk.green(' HuggingFace API Key: Configured'));
    } else {
      console.log(chalk.yellow(' HuggingFace API Key: Missing (will use fallback responses)'));
    }

    // Check model configuration
    console.log(chalk.blue(' Model Configuration:'));
    console.log(chalk.gray(`   Text Generation: ${config.textModel}`));
    console.log(chalk.gray(`   Classification: ${config.classificationModel}`));
    console.log(chalk.gray(`   Embeddings: ${config.embeddingModel}`));
    console.log(chalk.gray(`   Max Tokens: ${config.maxTokens}`));
    console.log(chalk.gray(`   Environment: ${config.nodeEnv}`));

    return config;
  }

  /**
   *  MAGIC: Test HuggingFace API connection
   */
  async testHuggingFaceConnection() {
    console.log(chalk.cyan.bold(' Testing HuggingFace API Connection'));
    console.log(chalk.gray('-'.repeat(40)));

    try {
      // Test health check
      const isHealthy = await this.hfService.checkHealth();
      
      if (isHealthy) {
        console.log(chalk.green(' HuggingFace API: Connected and healthy'));
        this.testResults.connection = true;
        this.testResults.authentication = true;
      } else {
        console.log(chalk.yellow(' HuggingFace API: Connection failed (using fallback)'));
        this.testResults.connection = false;
      }

      // Get service health details
      const serviceHealth = this.hfService.getServiceHealth();
      console.log(chalk.blue(' Service Health:'), JSON.stringify(serviceHealth, null, 2));

      // Get available models
      const availableModels = this.hfService.getAvailableModels();
      console.log(chalk.blue(' Available Models:'), JSON.stringify(availableModels, null, 2));

    } catch (error) {
      console.log(chalk.red(' HuggingFace API: Connection failed'));
      console.log(chalk.red('   Error:'), error.message);
      this.testResults.connection = false;
    }
  }

  /**
   *  MAGIC: Test individual model functionality
   */
  async testIndividualModels() {
    console.log(chalk.cyan.bold(' Testing Individual Model Functionality'));
    console.log(chalk.gray('-'.repeat(40)));

    const testCases = [
      {
        name: 'Sentiment Analysis',
        test: () => this.hfService.performSentimentAnalysis('I love working with AI technology!'),
        model: 'Classification Model'
      },
      {
        name: 'Text Generation',
        test: () => this.hfService.generateText('The future of AI in job matching is'),
        model: 'Text Generation Model'
      },
      {
        name: 'Personality Analysis',
        test: () => this.hfService.analyzePersonality('I am a creative person who enjoys solving complex problems and working in teams.'),
        model: 'Classification Model'
      },
      {
        name: 'Culture Analysis',
        test: () => this.hfService.analyzeCulture('We value innovation, collaboration, and continuous learning in our fast-paced startup environment.'),
        model: 'Classification Model'
      },
      {
        name: 'Embedding Generation',
        test: () => this.hfService.generateEmbeddings(['Software Engineer', 'Python Developer', 'Machine Learning']),
        model: 'Embedding Model'
      }
    ];

    for (const testCase of testCases) {
      try {
        console.log(chalk.yellow(` Testing ${testCase.name}...`));
        
        const startTime = Date.now();
        const result = await testCase.test();
        const duration = Date.now() - startTime;

        if (result) {
          console.log(chalk.green(` ${testCase.name}: Success (${duration}ms)`));
          console.log(chalk.gray(`   Model: ${testCase.model}`));
          
          // Log sample result (truncated)
          const resultStr = JSON.stringify(result).substring(0, 100);
          console.log(chalk.gray(`   Result: ${resultStr}...`));
          
          this.testResults.models.push({
            name: testCase.name,
            success: true,
            duration,
            model: testCase.model
          });
        } else {
          console.log(chalk.yellow(` ${testCase.name}: Fallback response`));
          this.testResults.models.push({
            name: testCase.name,
            success: false,
            duration,
            model: testCase.model,
            fallback: true
          });
        }

      } catch (error) {
        console.log(chalk.red(` ${testCase.name}: Failed`));
        console.log(chalk.red(`   Error: ${error.message}`));
        
        this.testResults.models.push({
          name: testCase.name,
          success: false,
          error: error.message,
          model: testCase.model
        });
      }
    }
  }

  /**
   *  MAGIC: Test deployment service
   */
  async testDeploymentService() {
    console.log(chalk.cyan.bold(' Testing Model Deployment Service'));
    console.log(chalk.gray('-'.repeat(40)));

    try {
      // Test deployment
      console.log(chalk.yellow(' Testing model deployment...'));
      const deploymentResult = await modelDeploymentService.deployModels();

      if (deploymentResult.deployment.status === 'ready') {
        console.log(chalk.green(' Deployment Service: Fully operational'));
        this.testResults.deployment = true;
      } else if (deploymentResult.deployment.status === 'partial') {
        console.log(chalk.yellow(' Deployment Service: Partially operational'));
        this.testResults.deployment = true;
      } else {
        console.log(chalk.red(' Deployment Service: Failed'));
        this.testResults.deployment = false;
      }

      // Get deployment metrics
      const metrics = modelDeploymentService.getDeploymentMetrics();
      console.log(chalk.blue(' Deployment Metrics:'));
      console.log(chalk.gray(`   Services Ready: ${metrics.servicesReady}`));
      console.log(chalk.gray(`   Models Loaded: ${metrics.modelsLoaded}`));
      console.log(chalk.gray(`   Errors: ${metrics.errorsCount}`));
      console.log(chalk.gray(`   Deployment Duration: ${metrics.deploymentDuration}ms`));

      // Get deployment status
      const status = modelDeploymentService.getDeploymentStatus();
      console.log(chalk.blue(' Deployment Status:'));
      console.log(chalk.gray(`   Overall Status: ${status.deployment.status}`));
      console.log(chalk.gray(`   HuggingFace Connected: ${status.huggingFace.apiConnected}`));
      console.log(chalk.gray(`   Models Loaded: ${status.huggingFace.modelsLoaded.join(', ')}`));

    } catch (error) {
      console.log(chalk.red(' Deployment Service: Failed to test'));
      console.log(chalk.red('   Error:'), error.message);
      this.testResults.deployment = false;
    }
  }

  /**
   *  MAGIC: Test all AI services integration
   */
  async testAllAIServices() {
    console.log(chalk.cyan.bold(' Testing All AI Services Integration'));
    console.log(chalk.gray('-'.repeat(40)));

    try {
      const serviceResults = await modelDeploymentService.testAllServices();

      for (const [serviceName, result] of Object.entries(serviceResults)) {
        if (result.status) {
          console.log(chalk.green(` ${serviceName}: Operational`));
        } else {
          console.log(chalk.red(` ${serviceName}: Failed`));
          if (result.error) {
            console.log(chalk.red(`   Error: ${result.error}`));
          }
        }
        
        this.testResults.services[serviceName] = result.status;
      }

      // Calculate overall health
      const healthyServices = Object.values(serviceResults).filter(result => result.status).length;
      const totalServices = Object.keys(serviceResults).length;
      
      console.log(chalk.blue(` Service Health: ${healthyServices}/${totalServices} services operational`));

      this.testResults.overallHealth = healthyServices >= (totalServices / 2); // At least 50% healthy

    } catch (error) {
      console.log(chalk.red(' Failed to test AI services integration'));
      console.log(chalk.red('   Error:'), error.message);
      this.testResults.overallHealth = false;
    }
  }

  /**
   *  MAGIC: Generate final test report
   */
  generateFinalReport() {
    console.log(chalk.blue.bold('\n FINAL DEPLOYMENT TEST REPORT'));
    console.log(chalk.yellow('=' .repeat(60)));

    // Overall Status
    const overallSuccess = this.testResults.connection && this.testResults.deployment && this.testResults.overallHealth;
    
    if (overallSuccess) {
      console.log(chalk.green.bold(' DEPLOYMENT STATUS: FULLY OPERATIONAL'));
    } else if (this.testResults.deployment || Object.values(this.testResults.services).some(Boolean)) {
      console.log(chalk.yellow.bold(' DEPLOYMENT STATUS: PARTIALLY OPERATIONAL'));
    } else {
      console.log(chalk.red.bold(' DEPLOYMENT STATUS: FAILED'));
    }

    console.log('');

    // Connection Summary
    console.log(chalk.cyan.bold(' CONNECTION SUMMARY:'));
    console.log(`   HuggingFace API: ${this.testResults.connection ? chalk.green('Connected') : chalk.red('Failed')}`);
    console.log(`   Authentication: ${this.testResults.authentication ? chalk.green('Valid') : chalk.red('Invalid')}`);
    console.log('');

    // Model Summary
    console.log(chalk.cyan.bold(' MODEL SUMMARY:'));
    const successfulModels = this.testResults.models.filter(m => m.success).length;
    const totalModels = this.testResults.models.length;
    console.log(`   Models Tested: ${successfulModels}/${totalModels} successful`);
    
    this.testResults.models.forEach(model => {
      const status = model.success ? chalk.green('') : chalk.red('');
      const fallback = model.fallback ? chalk.yellow(' (fallback)') : '';
      console.log(`   ${status} ${model.name}${fallback}`);
    });
    console.log('');

    // Services Summary
    console.log(chalk.cyan.bold(' SERVICES SUMMARY:'));
    const healthyServices = Object.values(this.testResults.services).filter(Boolean).length;
    const totalServicesCount = Object.keys(this.testResults.services).length;
    console.log(`   Services Ready: ${healthyServices}/${totalServicesCount} operational`);
    
    Object.entries(this.testResults.services).forEach(([service, status]) => {
      const icon = status ? chalk.green('') : chalk.red('');
      console.log(`   ${icon} ${service}`);
    });
    console.log('');

    // Deployment Summary
    console.log(chalk.cyan.bold(' DEPLOYMENT SUMMARY:'));
    console.log(`   Deployment Service: ${this.testResults.deployment ? chalk.green('Ready') : chalk.red('Failed')}`);
    console.log(`   Overall Health: ${this.testResults.overallHealth ? chalk.green('Healthy') : chalk.red('Unhealthy')}`);
    console.log('');

    // Recommendations
    this.generateRecommendations();

    console.log(chalk.yellow('=' .repeat(60)));
    console.log(chalk.blue.bold(' TEST SUITE COMPLETED\n'));
  }

  /**
   *  MAGIC: Generate recommendations based on test results
   */
  generateRecommendations() {
    console.log(chalk.cyan.bold(' RECOMMENDATIONS:'));

    if (!this.testResults.connection) {
      console.log(chalk.yellow('   • Check HuggingFace API key in .env file'));
      console.log(chalk.yellow('   • Verify network connectivity to HuggingFace API'));
      console.log(chalk.yellow('   • Check HuggingFace API quota and rate limits'));
    }

    if (!this.testResults.deployment) {
      console.log(chalk.yellow('   • Review deployment service logs for errors'));
      console.log(chalk.yellow('   • Check model configuration in environment variables'));
    }

    if (!this.testResults.overallHealth) {
      console.log(chalk.yellow('   • Some AI services may need troubleshooting'));
      console.log(chalk.yellow('   • Check individual service logs for specific errors'));
    }

    const failedModels = this.testResults.models.filter(m => !m.success && !m.fallback);
    if (failedModels.length > 0) {
      console.log(chalk.yellow('   • Failed models may need different configurations'));
      console.log(chalk.yellow('   • Consider using alternative model endpoints'));
    }

    if (this.testResults.connection && this.testResults.deployment) {
      console.log(chalk.green('   • System is ready for production deployment!'));
      console.log(chalk.green('   • Consider setting up monitoring and alerting'));
    }

    console.log('');
  }
}

/**
 *  MAGIC: Main execution
 */
async function main() {
  const tester = new HuggingFaceDeploymentTester();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error(chalk.red.bold(' Test suite failed:'), error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(chalk.red.bold(' Fatal error:'), error);
    process.exit(1);
  });
}
