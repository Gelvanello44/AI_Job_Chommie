import { Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';

/**
 * Model Performance Monitoring Controller
 * Tracks and analyzes AI model performance metrics
 */
export class ModelMonitoringController {
  private readonly METRICS_CACHE_TTL = 300; // 5 minutes
  private readonly ALERT_THRESHOLD = {
    accuracy: 0.85,
    precision: 0.80,
    recall: 0.75,
    f1Score: 0.78,
    latency: 2000, // milliseconds
    errorRate: 0.05
  };

  /**
   * Get overall model performance metrics
   */
  async getPerformanceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { period = '24h', modelType = 'all' } = req.query;
      
      logger.info(' Fetching model performance metrics', { period, modelType });

      // Check cache first
      const cacheKey = `model:metrics:${modelType}:${period}`;
      const cachedMetrics = await redis.get(cacheKey);
      
      if (cachedMetrics) {
        res.json({
          success: true,
          data: JSON.parse(cachedMetrics),
          cached: true
        });
        return;
      }

      // Calculate metrics
      const metrics = await this.calculatePerformanceMetrics(period as string, modelType as string);

      // Cache the results
      await redis.setex(cacheKey, this.METRICS_CACHE_TTL, JSON.stringify(metrics));

      res.json({
        success: true,
        data: metrics,
        cached: false
      });

    } catch (error) {
      logger.error('Error fetching performance metrics', { error });
      throw new AppError(500, 'Failed to fetch performance metrics');
    }
  }

  /**
   * Get model accuracy metrics
   */
  async getAccuracyMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { modelType = 'matching', startDate, endDate } = req.query;
      
      logger.info(' Fetching accuracy metrics', { modelType, startDate, endDate });

      const accuracyData = await this.calculateAccuracyMetrics(
        modelType as string,
        startDate as string,
        endDate as string
      );

      res.json({
        success: true,
        data: accuracyData
      });

    } catch (error) {
      logger.error('Error fetching accuracy metrics', { error });
      throw new AppError(500, 'Failed to fetch accuracy metrics');
    }
  }

  /**
   * Get prediction analytics
   */
  async getPredictionAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { userId, limit = 100 } = req.query;
      
      logger.info(' Fetching prediction analytics', { userId, limit });

      const predictions = await this.analyzePredictions(
        userId as string,
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: predictions
      });

    } catch (error) {
      logger.error('Error fetching prediction analytics', { error });
      throw new AppError(500, 'Failed to fetch prediction analytics');
    }
  }

  /**
   * Get model drift detection results
   */
  async getDriftAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { modelType = 'all', sensitivity = 'medium' } = req.query;
      
      logger.info(' Analyzing model drift', { modelType, sensitivity });

      const driftAnalysis = await this.detectModelDrift(
        modelType as string,
        sensitivity as string
      );

      res.json({
        success: true,
        data: driftAnalysis
      });

    } catch (error) {
      logger.error('Error analyzing model drift', { error });
      throw new AppError(500, 'Failed to analyze model drift');
    }
  }

  /**
   * Get performance alerts
   */
  async getPerformanceAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { severity = 'all', resolved = false } = req.query;
      
      logger.info(' Fetching performance alerts', { severity, resolved });

      const alerts = await this.fetchPerformanceAlerts(
        severity as string,
        resolved === 'true'
      );

      res.json({
        success: true,
        data: alerts
      });

    } catch (error) {
      logger.error('Error fetching performance alerts', { error });
      throw new AppError(500, 'Failed to fetch performance alerts');
    }
  }

  /**
   * Get model comparison metrics
   */
  async getModelComparison(req: Request, res: Response): Promise<void> {
    try {
      const { models, metric = 'accuracy' } = req.query;
      
      if (!models || !Array.isArray(models)) {
        throw new AppError(400, 'Models array is required');
      }

      logger.info(' Comparing model performance', { models, metric });

      const comparison = await this.compareModels(
        models as string[],
        metric as string
      );

      res.json({
        success: true,
        data: comparison
      });

    } catch (error) {
      logger.error('Error comparing models', { error });
      throw new AppError(500, 'Failed to compare models');
    }
  }

  /**
   * Get feature importance analysis
   */
  async getFeatureImportance(req: Request, res: Response): Promise<void> {
    try {
      const { modelType = 'matching', topN = 10 } = req.query;
      
      logger.info(' Analyzing feature importance', { modelType, topN });

      const featureImportance = await this.analyzeFeatureImportance(
        modelType as string,
        parseInt(topN as string)
      );

      res.json({
        success: true,
        data: featureImportance
      });

    } catch (error) {
      logger.error('Error analyzing feature importance', { error });
      throw new AppError(500, 'Failed to analyze feature importance');
    }
  }

  /**
   * Get training metrics history
   */
  async getTrainingHistory(req: Request, res: Response): Promise<void> {
    try {
      const { modelType, limit = 10 } = req.query;
      
      logger.info(' Fetching training history', { modelType, limit });

      const history = await this.fetchTrainingHistory(
        modelType as string,
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: history
      });

    } catch (error) {
      logger.error('Error fetching training history', { error });
      throw new AppError(500, 'Failed to fetch training history');
    }
  }

  /**
   * Get real-time performance dashboard data
   */
  async getDashboardData(req: Request, res: Response): Promise<void> {
    try {
      logger.info(' Fetching dashboard data');

      const dashboardData = await this.compileDashboardData();

      res.json({
        success: true,
        data: dashboardData
      });

    } catch (error) {
      logger.error('Error fetching dashboard data', { error });
      throw new AppError(500, 'Failed to fetch dashboard data');
    }
  }

  /**
   * Log model prediction for monitoring
   */
  async logPrediction(req: Request, res: Response): Promise<void> {
    try {
      const { 
        modelType, 
        prediction, 
        actual, 
        confidence, 
        features,
        userId 
      } = req.body;

      logger.info(' Logging model prediction', { modelType, userId });

      await this.storePrediction({
        modelType,
        prediction,
        actual,
        confidence,
        features,
        userId,
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Prediction logged successfully'
      });

    } catch (error) {
      logger.error('Error logging prediction', { error });
      throw new AppError(500, 'Failed to log prediction');
    }
  }

  // Helper methods

  private async calculatePerformanceMetrics(period: string, modelType: string): Promise<any> {
    const endTime = new Date();
    const startTime = this.getStartTime(period);

    // Simulate metric calculation (would query actual model logs in production)
    const metrics = {
      period,
      modelType,
      accuracy: 0.89 + Math.random() * 0.05,
      precision: 0.87 + Math.random() * 0.05,
      recall: 0.85 + Math.random() * 0.05,
      f1Score: 0.86 + Math.random() * 0.05,
      auc: 0.91 + Math.random() * 0.03,
      predictions: {
        total: Math.floor(1000 + Math.random() * 500),
        correct: Math.floor(850 + Math.random() * 100),
        incorrect: Math.floor(100 + Math.random() * 50)
      },
      latency: {
        p50: 45 + Math.random() * 10,
        p95: 120 + Math.random() * 30,
        p99: 250 + Math.random() * 50,
        average: 65 + Math.random() * 15
      },
      throughput: {
        requestsPerSecond: 50 + Math.random() * 20,
        successRate: 0.98 + Math.random() * 0.01
      },
      errors: {
        total: Math.floor(Math.random() * 20),
        rate: Math.random() * 0.02,
        types: {
          timeout: Math.floor(Math.random() * 5),
          validation: Math.floor(Math.random() * 10),
          system: Math.floor(Math.random() * 5)
        }
      },
      dataQuality: {
        missingFeatures: Math.random() * 0.05,
        outliers: Math.random() * 0.02,
        dataCompleteness: 0.95 + Math.random() * 0.04
      },
      timestamp: new Date().toISOString()
    };

    // Check for alerts
    metrics['alerts'] = this.checkMetricThresholds(metrics);

    return metrics;
  }

  private async calculateAccuracyMetrics(modelType: string, startDate?: string, endDate?: string): Promise<any> {
    // Simulate accuracy calculation
    const confusionMatrix = {
      truePositive: Math.floor(800 + Math.random() * 100),
      trueNegative: Math.floor(750 + Math.random() * 100),
      falsePositive: Math.floor(50 + Math.random() * 30),
      falseNegative: Math.floor(40 + Math.random() * 30)
    };

    const total = Object.values(confusionMatrix).reduce((a, b) => a + b, 0);
    const accuracy = (confusionMatrix.truePositive + confusionMatrix.trueNegative) / total;
    const precision = confusionMatrix.truePositive / (confusionMatrix.truePositive + confusionMatrix.falsePositive);
    const recall = confusionMatrix.truePositive / (confusionMatrix.truePositive + confusionMatrix.falseNegative);
    const f1Score = 2 * (precision * recall) / (precision + recall);

    return {
      modelType,
      dateRange: {
        start: startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: endDate || new Date().toISOString()
      },
      confusionMatrix,
      metrics: {
        accuracy,
        precision,
        recall,
        f1Score,
        specificity: confusionMatrix.trueNegative / (confusionMatrix.trueNegative + confusionMatrix.falsePositive),
        sensitivity: recall,
        matthewsCorrelation: this.calculateMCC(confusionMatrix)
      },
      classDistribution: {
        positive: confusionMatrix.truePositive + confusionMatrix.falseNegative,
        negative: confusionMatrix.trueNegative + confusionMatrix.falsePositive
      },
      performanceByClass: this.getPerformanceByClass(confusionMatrix)
    };
  }

  private async analyzePredictions(userId?: string, limit: number = 100): Promise<any> {
    // Simulate prediction analysis
    const predictions = [];
    
    for (let i = 0; i < Math.min(limit, 20); i++) {
      predictions.push({
        id: `pred_${i}`,
        timestamp: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
        modelType: ['matching', 'scoring', 'ranking'][Math.floor(Math.random() * 3)],
        prediction: Math.random(),
        actual: Math.random() > 0.7 ? Math.random() : null,
        confidence: 0.7 + Math.random() * 0.3,
        features: {
          skillsMatch: Math.random(),
          experienceMatch: Math.random(),
          personalityMatch: Math.random()
        },
        accuracy: Math.random() > 0.5 ? 'correct' : 'incorrect',
        processingTime: 50 + Math.random() * 100
      });
    }

    const analysis = {
      predictions,
      summary: {
        total: predictions.length,
        correct: predictions.filter(p => p.accuracy === 'correct').length,
        averageConfidence: predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length,
        averageProcessingTime: predictions.reduce((sum, p) => sum + p.processingTime, 0) / predictions.length
      },
      trends: {
        accuracyOverTime: this.calculateTrend(predictions, 'accuracy'),
        confidenceOverTime: this.calculateTrend(predictions, 'confidence'),
        volumeOverTime: this.calculateVolumeTrend(predictions)
      },
      insights: this.generatePredictionInsights(predictions)
    };

    return analysis;
  }

  private async detectModelDrift(modelType: string, sensitivity: string): Promise<any> {
    // Simulate drift detection
    const driftScore = Math.random() * 0.3;
    const isDrift = driftScore > this.getDriftThreshold(sensitivity);

    return {
      modelType,
      sensitivity,
      analysis: {
        driftScore,
        isDrift,
        severity: isDrift ? (driftScore > 0.25 ? 'high' : 'medium') : 'low',
        features: {
          'skillsMatch': { drift: Math.random() * 0.2, significant: Math.random() > 0.7 },
          'experienceMatch': { drift: Math.random() * 0.2, significant: Math.random() > 0.7 },
          'personalityMatch': { drift: Math.random() * 0.2, significant: Math.random() > 0.7 },
          'culturalFit': { drift: Math.random() * 0.2, significant: Math.random() > 0.7 }
        },
        distributionShift: {
          detected: isDrift,
          pValue: Math.random(),
          testStatistic: Math.random() * 10
        },
        performanceImpact: {
          accuracyChange: -Math.random() * 0.1,
          latencyChange: Math.random() * 50,
          errorRateChange: Math.random() * 0.02
        }
      },
      recommendations: this.generateDriftRecommendations(isDrift, driftScore),
      lastCheck: new Date().toISOString(),
      nextCheck: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
  }

  private async fetchPerformanceAlerts(severity: string, resolved: boolean): Promise<any[]> {
    // Simulate alerts
    const alerts = [
      {
        id: 'alert_1',
        type: 'accuracy_degradation',
        severity: 'high',
        message: 'Model accuracy dropped below threshold (85%)',
        metric: 'accuracy',
        currentValue: 0.82,
        threshold: 0.85,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        resolved: false,
        actions: ['Investigate training data quality', 'Check for feature drift', 'Consider model retraining']
      },
      {
        id: 'alert_2',
        type: 'latency_spike',
        severity: 'medium',
        message: 'P95 latency exceeded 200ms',
        metric: 'latency_p95',
        currentValue: 245,
        threshold: 200,
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        resolved: true,
        resolvedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        actions: ['Scale up compute resources', 'Optimize model inference']
      },
      {
        id: 'alert_3',
        type: 'error_rate',
        severity: 'low',
        message: 'Error rate slightly elevated',
        metric: 'error_rate',
        currentValue: 0.03,
        threshold: 0.02,
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        resolved: false,
        actions: ['Monitor for patterns', 'Review recent deployments']
      }
    ];

    // Filter based on parameters
    let filteredAlerts = alerts;
    
    if (severity !== 'all') {
      filteredAlerts = filteredAlerts.filter(a => a.severity === severity);
    }
    
    if (!resolved) {
      filteredAlerts = filteredAlerts.filter(a => !a.resolved);
    }

    return filteredAlerts;
  }

  private async compareModels(models: string[], metric: string): Promise<any> {
    const comparison = {
      metric,
      models: models.map(model => ({
        name: model,
        value: 0.8 + Math.random() * 0.15,
        trend: Math.random() > 0.5 ? 'improving' : 'stable',
        lastUpdated: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      })),
      winner: null as any,
      analysis: {
        statisticalSignificance: Math.random() > 0.3,
        pValue: Math.random() * 0.1,
        confidenceInterval: [0.02, 0.08]
      }
    };

    // Determine winner
    comparison.winner = comparison.models.reduce((best, current) => 
      current.value > best.value ? current : best
    );

    return comparison;
  }

  private async analyzeFeatureImportance(modelType: string, topN: number): Promise<any> {
    const features = [
      { name: 'skills_match_score', importance: 0.25, category: 'skills' },
      { name: 'years_experience', importance: 0.20, category: 'experience' },
      { name: 'education_level', importance: 0.15, category: 'education' },
      { name: 'personality_fit', importance: 0.12, category: 'personality' },
      { name: 'salary_expectations', importance: 0.10, category: 'compensation' },
      { name: 'location_match', importance: 0.08, category: 'location' },
      { name: 'industry_experience', importance: 0.05, category: 'experience' },
      { name: 'language_skills', importance: 0.03, category: 'skills' },
      { name: 'availability', importance: 0.02, category: 'logistics' }
    ];

    // Sort by importance and take top N
    const topFeatures = features
      .sort((a, b) => b.importance - a.importance)
      .slice(0, topN);

    // Group by category
    const byCategory: { [key: string]: number } = {};
    topFeatures.forEach(f => {
      byCategory[f.category] = (byCategory[f.category] || 0) + f.importance;
    });

    return {
      modelType,
      topFeatures,
      byCategory,
      insights: [
        'Skills-related features have the highest impact on predictions',
        'Experience factors are crucial for match quality',
        'Consider feature engineering for underrepresented categories'
      ],
      recommendations: [
        'Focus on improving skills extraction accuracy',
        'Enhance experience matching algorithms',
        'Consider adding more personality assessment features'
      ]
    };
  }

  private async fetchTrainingHistory(modelType: string, limit: number): Promise<any[]> {
    const history = [];
    
    for (let i = 0; i < Math.min(limit, 5); i++) {
      history.push({
        version: `v1.${5 - i}`,
        trainedAt: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000).toISOString(),
        modelType,
        metrics: {
          trainAccuracy: 0.92 + Math.random() * 0.05,
          valAccuracy: 0.88 + Math.random() * 0.05,
          testAccuracy: 0.86 + Math.random() * 0.05,
          loss: 0.2 + Math.random() * 0.1
        },
        datasetSize: {
          train: 50000 + Math.floor(Math.random() * 10000),
          validation: 10000 + Math.floor(Math.random() * 2000),
          test: 10000 + Math.floor(Math.random() * 2000)
        },
        hyperparameters: {
          learningRate: 0.001,
          batchSize: 32,
          epochs: 100,
          optimizer: 'adam'
        },
        duration: `${2 + Math.random() * 2}h`,
        deployed: i === 0
      });
    }

    return history;
  }

  private async compileDashboardData(): Promise<any> {
    const [
      currentMetrics,
      recentAlerts,
      modelComparison,
      predictions
    ] = await Promise.all([
      this.calculatePerformanceMetrics('24h', 'all'),
      this.fetchPerformanceAlerts('all', false),
      this.compareModels(['matching', 'scoring', 'ranking'], 'accuracy'),
      this.analyzePredictions(undefined, 10)
    ]);

    return {
      overview: {
        status: recentAlerts.filter(a => a.severity === 'high').length > 0 ? 'warning' : 'healthy',
        modelsActive: 3,
        totalPredictions24h: currentMetrics.predictions.total,
        averageAccuracy: currentMetrics.accuracy,
        averageLatency: currentMetrics.latency.average
      },
      metrics: currentMetrics,
      alerts: recentAlerts.slice(0, 5),
      modelPerformance: modelComparison,
      recentPredictions: predictions.predictions.slice(0, 5),
      trends: {
        accuracy: this.generateTrendData('accuracy', 7),
        latency: this.generateTrendData('latency', 7),
        volume: this.generateTrendData('volume', 7)
      },
      lastUpdated: new Date().toISOString()
    };
  }

  private async storePrediction(predictionData: any): Promise<void> {
    // Store in database (simulated)
    const key = `prediction:${predictionData.modelType}:${Date.now()}`;
    await redis.setex(key, 86400, JSON.stringify(predictionData)); // Store for 24 hours
    
    // Update metrics
    await this.updateMetrics(predictionData);
  }

  private async updateMetrics(predictionData: any): Promise<void> {
    // Update running metrics (simulated)
    const metricsKey = `metrics:${predictionData.modelType}:current`;
    const currentMetrics = await redis.get(metricsKey);
    
    if (currentMetrics) {
      const metrics = JSON.parse(currentMetrics);
      metrics.totalPredictions++;
      if (predictionData.actual !== null && predictionData.prediction === predictionData.actual) {
        metrics.correctPredictions++;
      }
      await redis.setex(metricsKey, 3600, JSON.stringify(metrics));
    }
  }

  // Utility methods

  private getStartTime(period: string): Date {
    const now = new Date();
    switch (period) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private checkMetricThresholds(metrics: any): any[] {
    const alerts = [];
    
    if (metrics.accuracy < this.ALERT_THRESHOLD.accuracy) {
      alerts.push({
        type: 'accuracy',
        severity: 'high',
        message: `Accuracy ${metrics.accuracy.toFixed(2)} below threshold ${this.ALERT_THRESHOLD.accuracy}`
      });
    }
    
    if (metrics.latency.p95 > this.ALERT_THRESHOLD.latency) {
      alerts.push({
        type: 'latency',
        severity: 'medium',
        message: `P95 latency ${metrics.latency.p95}ms exceeds threshold ${this.ALERT_THRESHOLD.latency}ms`
      });
    }
    
    if (metrics.errors.rate > this.ALERT_THRESHOLD.errorRate) {
      alerts.push({
        type: 'error_rate',
        severity: 'medium',
        message: `Error rate ${(metrics.errors.rate * 100).toFixed(1)}% exceeds threshold ${(this.ALERT_THRESHOLD.errorRate * 100)}%`
      });
    }
    
    return alerts;
  }

  private calculateMCC(cm: any): number {
    const { truePositive: tp, trueNegative: tn, falsePositive: fp, falseNegative: fn } = cm;
    const numerator = (tp * tn) - (fp * fn);
    const denominator = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private getPerformanceByClass(cm: any): any {
    return {
      positive: {
        precision: cm.truePositive / (cm.truePositive + cm.falsePositive),
        recall: cm.truePositive / (cm.truePositive + cm.falseNegative),
        f1Score: 2 * cm.truePositive / (2 * cm.truePositive + cm.falsePositive + cm.falseNegative)
      },
      negative: {
        precision: cm.trueNegative / (cm.trueNegative + cm.falseNegative),
        recall: cm.trueNegative / (cm.trueNegative + cm.falsePositive),
        f1Score: 2 * cm.trueNegative / (2 * cm.trueNegative + cm.falseNegative + cm.falsePositive)
      }
    };
  }

  private calculateTrend(predictions: any[], metric: string): string {
    // Simplified trend calculation
    if (predictions.length < 2) return 'stable';
    
    const recent = predictions.slice(0, Math.floor(predictions.length / 2));
    const older = predictions.slice(Math.floor(predictions.length / 2));
    
    const recentAvg = recent.reduce((sum, p) => sum + (metric === 'accuracy' ? (p.accuracy === 'correct' ? 1 : 0) : p[metric]), 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + (metric === 'accuracy' ? (p.accuracy === 'correct' ? 1 : 0) : p[metric]), 0) / older.length;
    
    if (recentAvg > olderAvg * 1.05) return 'improving';
    if (recentAvg < olderAvg * 0.95) return 'declining';
    return 'stable';
  }

  private calculateVolumeTrend(predictions: any[]): any {
    // Group by hour
    const byHour: { [key: string]: number } = {};
    predictions.forEach(p => {
      const hour = new Date(p.timestamp).getHours();
      byHour[hour] = (byHour[hour] || 0) + 1;
    });
    
    return {
      pattern: 'normal',
      peakHours: Object.entries(byHour)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([hour]) => parseInt(hour))
    };
  }

  private generatePredictionInsights(predictions: any[]): string[] {
    const insights = [];
    
    const accuracy = predictions.filter(p => p.accuracy === 'correct').length / predictions.length;
    if (accuracy > 0.9) {
      insights.push('Model is performing exceptionally well with >90% accuracy');
    } else if (accuracy < 0.8) {
      insights.push('Model accuracy is below optimal levels, consider investigation');
    }
    
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
    if (avgConfidence > 0.85) {
      insights.push('Model confidence levels are high, indicating reliable predictions');
    }
    
    const avgProcessingTime = predictions.reduce((sum, p) => sum + p.processingTime, 0) / predictions.length;
    if (avgProcessingTime > 100) {
      insights.push('Processing times are elevated, consider optimization');
    }
    
    return insights;
  }

  private getDriftThreshold(sensitivity: string): number {
    switch (sensitivity) {
      case 'high':
        return 0.1;
      case 'low':
        return 0.3;
      default:
        return 0.2;
    }
  }

  private generateDriftRecommendations(isDrift: boolean, driftScore: number): string[] {
    const recommendations = [];
    
    if (isDrift) {
      recommendations.push('Consider retraining the model with recent data');
      recommendations.push('Review feature distributions for significant changes');
      recommendations.push('Validate model performance on recent predictions');
      
      if (driftScore > 0.25) {
        recommendations.push('URGENT: Significant drift detected, immediate action required');
        recommendations.push('Consider rolling back to previous model version');
      }
    } else {
      recommendations.push('Continue monitoring for early drift detection');
      recommendations.push('Schedule regular model evaluation');
    }
    
    return recommendations;
  }

  private generateTrendData(metric: string, days: number): any[] {
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      let value;
      
      switch (metric) {
        case 'accuracy':
          value = 0.85 + Math.random() * 0.1 - i * 0.005;
          break;
        case 'latency':
          value = 60 + Math.random() * 20 - i * 2;
          break;
        case 'volume':
          value = 1000 + Math.random() * 200 + i * 50;
          break;
        default:
          value = Math.random() * 100;
      }
      
      data.push({
        date: date.toISOString().split('T')[0],
        value
      });
    }
    
    return data;
  }
}

export const modelMonitoringController = new ModelMonitoringController();
