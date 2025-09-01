import { SubscriptionPlan } from '@prisma/client';

export interface ScrapingConfig {
  plan: SubscriptionPlan;
  features: {
    basicMatching: boolean;
    enhancedFiltering: boolean;
    companyResearch: boolean;
    executiveRoles: boolean;
    hiddenMarketAccess: boolean;
    networkingEvents: boolean;
    salaryBenchmarking: boolean;
    industryInsights: boolean;
  };
  limits: {
    jobsPerSearch: number;
    searchesPerDay: number;
    detailedCompanyInfo: boolean;
    premiumJobBoards: boolean;
    realTimeAlerts: boolean;
  };
  jobSources: string[];
  scrapeFrequency: 'daily' | 'hourly' | 'real-time';
}

export const SCRAPING_TIERS: Record<SubscriptionPlan, ScrapingConfig> = {
  [SubscriptionPlan.FREE]: {
    plan: SubscriptionPlan.FREE,
    features: {
      basicMatching: true,
      enhancedFiltering: false,
      companyResearch: false,
      executiveRoles: false,
      hiddenMarketAccess: false,
      networkingEvents: false,
      salaryBenchmarking: false,
      industryInsights: false
    },
    limits: {
      jobsPerSearch: 20,
      searchesPerDay: 10,
      detailedCompanyInfo: false,
      premiumJobBoards: false,
      realTimeAlerts: false
    },
    jobSources: [
      'careers24.com',
      'pnet.co.za',
      'indeed.co.za',
      'jobmail.co.za'
    ],
    scrapeFrequency: 'daily'
  },

  [SubscriptionPlan.PROFESSIONAL]: {
    plan: SubscriptionPlan.PROFESSIONAL,
    features: {
      basicMatching: true,
      enhancedFiltering: true,
      companyResearch: true,
      executiveRoles: false,
      hiddenMarketAccess: false,
      networkingEvents: true,
      salaryBenchmarking: true,
      industryInsights: true
    },
    limits: {
      jobsPerSearch: 50,
      searchesPerDay: 50,
      detailedCompanyInfo: true,
      premiumJobBoards: true,
      realTimeAlerts: true
    },
    jobSources: [
      'careers24.com',
      'pnet.co.za',
      'indeed.co.za',
      'jobmail.co.za',
      'linkedin.com',
      'glassdoor.com',
      'careerjet.co.za',
      'bizcommunity.com'
    ],
    scrapeFrequency: 'hourly'
  },

  [SubscriptionPlan.EXECUTIVE]: {
    plan: SubscriptionPlan.EXECUTIVE,
    features: {
      basicMatching: true,
      enhancedFiltering: true,
      companyResearch: true,
      executiveRoles: true,
      hiddenMarketAccess: true,
      networkingEvents: true,
      salaryBenchmarking: true,
      industryInsights: true
    },
    limits: {
      jobsPerSearch: 100,
      searchesPerDay: 200,
      detailedCompanyInfo: true,
      premiumJobBoards: true,
      realTimeAlerts: true
    },
    jobSources: [
      'careers24.com',
      'pnet.co.za',
      'indeed.co.za',
      'jobmail.co.za',
      'linkedin.com',
      'glassdoor.com',
      'careerjet.co.za',
      'bizcommunity.com',
      'executiveplacements.co.za',
      'topco.co.za',
      'boardroomexecutive.co.za',
      'privateequityjobs.com'
    ],
    scrapeFrequency: 'real-time'
  }
};

export interface JobScrapingRequest {
  userId: string;
  userPlan: SubscriptionPlan;
  searchCriteria: {
    keywords: string[];
    location?: string;
    salaryMin?: number;
    salaryMax?: number;
    jobType?: string;
    experienceLevel?: string;
    industry?: string;
    remote?: boolean;
  };
  includeCompanyResearch?: boolean;
  includeNetworkingEvents?: boolean;
  includeSalaryBenchmarks?: boolean;
}

export interface JobScrapingResponse {
  jobs: Array<{
    id: string;
    title: string;
    company: string;
    location: string;
    salary?: string;
    description: string;
    requirements: string[];
    postedDate: string;
    source: string;
    url: string;
    isExecutiveRole?: boolean;
    isHiddenMarket?: boolean;
  }>;
  companyResearch?: Array<{
    companyName: string;
    industry: string;
    size: string;
    culture: string;
    benefits: string[];
    recentNews: string[];
  }>;
  networkingEvents?: Array<{
    title: string;
    date: string;
    location: string;
    industry: string;
    type: string;
  }>;
  salaryBenchmarks?: Array<{
    jobTitle: string;
    averageSalary: number;
    salaryRange: { min: number; max: number };
    location: string;
  }>;
  metadata: {
    totalFound: number;
    processed: number;
    plan: SubscriptionPlan;
    featuresUsed: string[];
    nextScrapeTime?: string;
  };
}

export class TierBasedJobScrapingService {
  
  static getConfigForPlan(plan: SubscriptionPlan): ScrapingConfig {
    return SCRAPING_TIERS[plan];
  }

  static validateScrapingRequest(request: JobScrapingRequest): boolean {
    const config = this.getConfigForPlan(request.userPlan);
    
    // Validate feature access
    if (request.includeCompanyResearch && !config.features.companyResearch) {
      return false;
    }
    
    if (request.includeNetworkingEvents && !config.features.networkingEvents) {
      return false;
    }
    
    if (request.includeSalaryBenchmarks && !config.features.salaryBenchmarking) {
      return false;
    }

    return true;
  }

  static getJobSources(plan: SubscriptionPlan): string[] {
    return SCRAPING_TIERS[plan].jobSources;
  }

  static getSearchLimits(plan: SubscriptionPlan) {
    return SCRAPING_TIERS[plan].limits;
  }

  static shouldIncludeExecutiveJobs(plan: SubscriptionPlan, jobTitle: string): boolean {
    const config = SCRAPING_TIERS[plan];
    
    if (!config.features.executiveRoles) {
      return false;
    }

    // Check if job title indicates executive level
    const executiveKeywords = [
      'ceo', 'cto', 'cfo', 'coo', 'chief', 'president', 'vice president', 'vp',
      'director', 'head of', 'general manager', 'gm', 'managing director',
      'executive', 'senior executive', 'c-suite', 'board member'
    ];

    const titleLower = jobTitle.toLowerCase();
    return executiveKeywords.some(keyword => titleLower.includes(keyword));
  }

  static shouldIncludeHiddenMarketJob(plan: SubscriptionPlan, source: string): boolean {
    const config = SCRAPING_TIERS[plan];
    
    if (!config.features.hiddenMarketAccess) {
      return false;
    }

    // Hidden market jobs are from executive recruiters, private networks, etc.
    const hiddenMarketSources = [
      'executiveplacements.co.za',
      'topco.co.za',
      'boardroomexecutive.co.za',
      'privateequityjobs.com'
    ];

    return hiddenMarketSources.includes(source);
  }

  static getScrapingFrequency(plan: SubscriptionPlan): string {
    return SCRAPING_TIERS[plan].scrapeFrequency;
  }

  static generateScrapingInstructions(request: JobScrapingRequest): any {
    const config = this.getConfigForPlan(request.userPlan);
    
    return {
      sources: config.jobSources,
      limits: config.limits,
      searchCriteria: request.searchCriteria,
      features: {
        includeCompanyResearch: request.includeCompanyResearch && config.features.companyResearch,
        includeNetworkingEvents: request.includeNetworkingEvents && config.features.networkingEvents,
        includeSalaryBenchmarks: request.includeSalaryBenchmarks && config.features.salaryBenchmarking,
        includeExecutiveRoles: config.features.executiveRoles,
        includeHiddenMarket: config.features.hiddenMarketAccess,
        enhancedFiltering: config.features.enhancedFiltering
      },
      frequency: config.scrapeFrequency,
      plan: request.userPlan
    };
  }
}

export default TierBasedJobScrapingService;
