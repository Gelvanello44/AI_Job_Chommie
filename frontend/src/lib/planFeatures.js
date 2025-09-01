// Centralized plan features configuration
// This ensures consistency between pricing page displays and actual feature availability

export const PLAN_FEATURES = {
  free: {
    name: 'Career Starter',
    price: 'Free',
    quotas: {
      autoApplicationsLimit: 2,
    },
    features: {
      // Auto Job Applications
      autoApplications: {
        enabled: true,
        monthlyLimit: 2,
        aiMatching: 'basic',
        features: [
          'jobPreferencesSetup',
          'autoApplySettings',
          'confirmationModals',
          'monthlyQuotaMeter',
          'upcomingApplicationsWidget',
          'usageThisMonthWidget'
        ]
      },
      
      // CV Builder & Templates
      cvBuilder: {
        enabled: true,
        templates: ['standard'],
        features: [
          'atsOptimization',
          'cvEditor',
          'templateSelection',
          'pdfExport',
          'atsGuidanceHints',
          'atsScoring'
        ]
      },
      
      // Skills Assessment
      skillsAssessment: {
        enabled: true,
        features: [
          'skillsQuiz',
          'top3Strengths',
          'resultsDashboard',
          'shareableBadges',
          'retakeWithCadence'
        ]
      },
      
      // Application Tracking
      applicationTracking: {
        enabled: true,
        features: [
          'listView',
          'kanbanView',
          'statusTracking',
          'applicationTimeline',
          'notesSystem',
          'nextActionPrompts',
          'followUpReminders'
        ]
      },
      
      // Job Market Insights
      jobMarketInsights: {
        enabled: true,
        newsletterFrequency: 'monthly',
        features: [
          'emailOptIn',
          'newsletterArchive',
          'saFocusedInsights'
        ]
      },
      
      // Features NOT included in Free plan
      coverLetters: {
        enabled: false
      },
      weeklyJobAlerts: {
        enabled: false
      },
      companyResearch: {
        enabled: false
      },
      analytics: {
        enabled: false
      },
      salaryBenchmarking: {
        enabled: false
      },
      interviewScheduling: {
        enabled: false
      },
      followUpTemplates: {
        enabled: false
      },
      linkedInOptimization: {
        enabled: false
      },
      referenceManagement: {
        enabled: false
      },
      executiveFeatures: {
        enabled: false
      }
    }
  },
  
  pro: {
    name: 'The Career Accelerator',
    price: 'R8',
    quotas: {
      autoApplicationsLimit: 5,
    },
    features: {
      // Auto Job Applications - Enhanced
      autoApplications: {
        enabled: true,
        monthlyLimit: 5,
        aiMatching: 'advanced',
        features: [
          'jobPreferencesSetup',
          'autoApplySettings',
          'confirmationModals',
          'monthlyQuotaMeter',
          'upcomingApplicationsWidget',
          'usageThisMonthWidget',
          'jobMatchExplanations',
          'adjustableFrequency',
          'enhancedQuotaMeter'
        ]
      },
      
      // Professional CV & Cover Letters
      cvBuilder: {
        enabled: true,
        templates: ['standard', 'professional'],
        features: [
          'atsOptimization',
          'cvEditor',
          'templateSelection',
          'pdfExport',
          'atsGuidanceHints',
          'atsScoring',
          'industryKeywords',
          'keywordRecommendations',
          'diffView',
          'acceptRejectSuggestions'
        ]
      },
      
      coverLetters: {
        enabled: true,
        features: [
          'customGeneration',
          'perApplicationCustomization',
          'coverLetterEditor',
          'toneControls',
          'variants',
          'attachToApplication'
        ]
      },
      
      // Weekly Job Alerts & Research
      weeklyJobAlerts: {
        enabled: true,
        features: [
          'weeklyDigest',
          'alertsSetup',
          'roleFilters',
          'provinceFilters',
          'salaryRangeFilters',
          'digestPreview',
          'deliveryChannels'
        ]
      },
      
      companyResearch: {
        enabled: true,
        features: [
          'researchBriefings',
          'researchDrawer',
          'jobDetailPanel',
          'companyPages',
          'saveBrief'
        ]
      },
      
      // Analytics & Benchmarking
      analytics: {
        enabled: true,
        features: [
          'performanceDashboard',
          'applicationsVsInterviews',
          'responseRates',
          'timeToInterview',
          'conversionTracking'
        ]
      },
      
      salaryBenchmarking: {
        enabled: true,
        features: [
          'roleBasedBenchmarks',
          'experienceFilters',
          'provinceFilters',
          'jobDetailWidget'
        ]
      },
      
      // Professional Tools
      interviewScheduling: {
        enabled: true,
        features: [
          'calendarSync',
          'availabilityPicker',
          'outlookIntegration',
          'googleCalendarIntegration',
          'timezoneHandling'
        ]
      },
      
      followUpTemplates: {
        enabled: true,
        features: [
          'templateLibrary',
          'oneClickCopy',
          'contextualSuggestions',
          'statusBasedTemplates'
        ]
      },
      
      linkedInOptimization: {
        enabled: true,
        features: [
          'optimizationGuide',
          'optimizationChecklist',
          'profileParser',
          'progressTracker'
        ]
      },
      
      referenceManagement: {
        enabled: true,
        features: [
          'referencesList',
          'requestWorkflows',
          'visibilityControls'
        ]
      },
      
      // Features NOT included in Pro plan
      executiveFeatures: {
        enabled: false
      }
    }
  },
  
  executive: {
    name: 'The Leadership Advantage',
    price: 'R17',
    quotas: {
      autoApplicationsLimit: 8,
    },
    features: {
      // Executive Auto Job Applications
      autoApplications: {
        enabled: true,
        monthlyLimit: 8,
        aiMatching: 'executive',
        features: [
          'jobPreferencesSetup',
          'autoApplySettings',
          'confirmationModals',
          'monthlyQuotaMeter',
          'upcomingApplicationsWidget',
          'usageThisMonthWidget',
          'jobMatchExplanations',
          'adjustableFrequency',
          'enhancedQuotaMeter',
          'executiveRoleFilters',
          'headhunterVisibility'
        ]
      },
      
      // Executive CV Crafting
      cvBuilder: {
        enabled: true,
        templates: ['standard', 'professional', 'executive'],
        features: [
          'atsOptimization',
          'cvEditor',
          'templateSelection',
          'pdfExport',
          'atsGuidanceHints',
          'atsScoring',
          'industryKeywords',
          'keywordRecommendations',
          'diffView',
          'acceptRejectSuggestions',
          'leadershipPositioning',
          'executiveTemplate',
          'leadershipAchievements',
          'executiveReviewFlow'
        ]
      },
      
      // Skills Assessment - same as pro
      skillsAssessment: {
        enabled: true,
        features: [
          'skillsQuiz',
          'top3Strengths',
          'resultsDashboard',
          'shareableBadges',
          'retakeWithCadence'
        ]
      },
      
      // Application Tracking - same as pro
      applicationTracking: {
        enabled: true,
        features: [
          'listView',
          'kanbanView',
          'statusTracking',
          'applicationTimeline',
          'notesSystem',
          'nextActionPrompts',
          'followUpReminders'
        ]
      },
      
      // Job Market Insights - same as pro
      jobMarketInsights: {
        enabled: true,
        newsletterFrequency: 'monthly',
        features: [
          'emailOptIn',
          'newsletterArchive',
          'saFocusedInsights'
        ]
      },
      
      // Cover Letters - same as pro
      coverLetters: {
        enabled: true,
        features: [
          'customGeneration',
          'perApplicationCustomization',
          'coverLetterEditor',
          'toneControls',
          'variants',
          'attachToApplication'
        ]
      },
      
      // Weekly Job Alerts - same as pro
      weeklyJobAlerts: {
        enabled: true,
        features: [
          'weeklyDigest',
          'alertsSetup',
          'roleFilters',
          'provinceFilters',
          'salaryRangeFilters',
          'digestPreview',
          'deliveryChannels'
        ]
      },
      
      // Company Research - same as pro
      companyResearch: {
        enabled: true,
        features: [
          'researchBriefings',
          'researchDrawer',
          'jobDetailPanel',
          'companyPages',
          'saveBrief'
        ]
      },
      
      // Analytics - same as pro
      analytics: {
        enabled: true,
        features: [
          'performanceDashboard',
          'applicationsVsInterviews',
          'responseRates',
          'timeToInterview',
          'conversionTracking'
        ]
      },
      
      // Salary Benchmarking - same as pro
      salaryBenchmarking: {
        enabled: true,
        features: [
          'roleBasedBenchmarks',
          'experienceFilters',
          'provinceFilters',
          'jobDetailWidget'
        ]
      },
      
      // Interview Scheduling - same as pro
      interviewScheduling: {
        enabled: true,
        features: [
          'calendarSync',
          'availabilityPicker',
          'outlookIntegration',
          'googleCalendarIntegration',
          'timezoneHandling'
        ]
      },
      
      // Follow-up Templates - same as pro
      followUpTemplates: {
        enabled: true,
        features: [
          'templateLibrary',
          'oneClickCopy',
          'contextualSuggestions',
          'statusBasedTemplates'
        ]
      },
      
      // LinkedIn Optimization - same as pro
      linkedInOptimization: {
        enabled: true,
        features: [
          'optimizationGuide',
          'optimizationChecklist',
          'profileParser',
          'progressTracker'
        ]
      },
      
      // Reference Management - same as pro
      referenceManagement: {
        enabled: true,
        features: [
          'referencesList',
          'requestWorkflows',
          'visibilityControls'
        ]
      },
      
      // Executive-Only Features
      executiveFeatures: {
        enabled: true,
        
        personalBrand: {
          enabled: true,
          features: [
            'brandAudit',
            'brandScorecard',
            'actionPlan',
            'contentCalendarSuggestions'
          ]
        },
        
        networking: {
          enabled: true,
          features: [
            'executiveEventNotifications',
            'eventsList',
            'rsvpSystem',
            'calendarSync'
          ]
        },
        
        careerPlanning: {
          enabled: true,
          features: [
            'trajectoryPlanning',
            'careerRoadmap',
            'okrs',
            'milestoneTracking',
            'milestoneReminders'
          ]
        },
        
        headhunterPositioning: {
          enabled: true,
          features: [
            'visibilityToggles',
            'preferenceControls',
            'recruiterViewPreview'
          ]
        },
        
        leadershipAssessment: {
          enabled: true,
          features: [
            'assessmentFlow',
            'resultsDashboard',
            'developmentRecommendations',
            'actionsFeed'
          ]
        },
        
        additionalSupport: {
          enabled: true,
          features: [
            'prioritySupport24h',
            'executiveCommunicationStyle',
            'industryIntelligenceReports',
            'marketTrends',
            'mockInterviewSessions',
            'seniorLevelScenarios'
          ]
        }
      }
    }
  }
};

// Helper function to get features for a specific plan
export function getPlanFeatures(planName) {
  return PLAN_FEATURES[planName] || PLAN_FEATURES.free;
}

// Helper function to check if a feature is available for a plan
export function hasFeature(planName, featurePath) {
  const plan = getPlanFeatures(planName);
  const pathParts = featurePath.split('.');
  
  let current = plan.features;
  for (const part of pathParts) {
    if (!current || typeof current !== 'object') return false;
    current = current[part];
  }
  
  return current?.enabled === true || (Array.isArray(current?.features) && current.features.length > 0);
}

// Helper function to get quota limits
export function getQuotaLimit(planName, quotaType) {
  const plan = getPlanFeatures(planName);
  return plan.quotas?.[quotaType] || 0;
}

// Plan upgrade paths
export const UPGRADE_PATHS = {
  free: ['pro', 'executive'],
  pro: ['executive'],
  executive: []
};

// Plan comparison helper
export function comparePlans(currentPlan, targetPlan) {
  const current = getPlanFeatures(currentPlan);
  const target = getPlanFeatures(targetPlan);
  
  const differences = {
    quotas: {},
    newFeatures: []
  };
  
  // Compare quotas
  Object.keys(target.quotas).forEach(key => {
    if (target.quotas[key] > (current.quotas[key] || 0)) {
      differences.quotas[key] = {
        current: current.quotas[key] || 0,
        target: target.quotas[key]
      };
    }
  });
  
  // Find new features
  const findNewFeatures = (targetFeatures, currentFeatures, path = '') => {
    Object.keys(targetFeatures).forEach(key => {
      const fullPath = path ? `${path}.${key}` : key;
      
      if (targetFeatures[key]?.enabled === true && currentFeatures[key]?.enabled !== true) {
        differences.newFeatures.push(fullPath);
      }
      
      if (typeof targetFeatures[key] === 'object' && !Array.isArray(targetFeatures[key]) && key !== 'features') {
        findNewFeatures(
          targetFeatures[key],
          currentFeatures[key] || {},
          fullPath
        );
      }
    });
  };
  
  findNewFeatures(target.features, current.features);
  
  return differences;
}
