/**
 * Comprehensive Routing Configuration
 * 
 * This configuration establishes the complete navigation architecture
 * for the AI Job Chommie platform, ensuring all pages are properly
 * connected and accessible through a sophisticated routing system.
 */

import { lazy } from 'react';

// Lazy load pages for optimal performance
const AboutPage = lazy(() => import('../pages/AboutPage'));
const Admin = lazy(() => import('../pages/Admin'));
const AdvancedMatching = lazy(() => import('../pages/AdvancedMatching'));
const AIWriting = lazy(() => import('../pages/AIWriting'));
const Alerts = lazy(() => import('../pages/Alerts'));
const Analytics = lazy(() => import('../pages/Analytics'));
const APIDocumentation = lazy(() => import('../pages/APIDocumentation'));
const Applications = lazy(() => import('../pages/Applications'));
const Auth = lazy(() => import('../pages/Auth'));
const AuthPages = lazy(() => import('../pages/AuthPages'));
const Billing = lazy(() => import('../pages/Billing'));
const Blog = lazy(() => import('../pages/Blog'));
const Changelog = lazy(() => import('../pages/Changelog'));
const ComingSoon = lazy(() => import('../pages/ComingSoon'));
const CompanyIntelligence = lazy(() => import('../pages/CompanyIntelligence'));
const ContactPage = lazy(() => import('../pages/ContactPage'));
const CvBuilder = lazy(() => import('../pages/CvBuilder'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const DataPrivacy = lazy(() => import('../pages/DataPrivacy'));
const EmailVerification = lazy(() => import('../pages/EmailVerification'));
const EnhancedDashboard = lazy(() => import('../pages/EnhancedDashboard'));
const EmployerFlow = lazy(() => import('../pages/EmployerFlow'));
const ForgotPassword = lazy(() => import('../pages/ForgotPassword'));
const FounderPage = lazy(() => import('../pages/FounderPage'));
const Help = lazy(() => import('../pages/Help'));
const HomePage = lazy(() => import('../pages/HomePage'));
const Integrations = lazy(() => import('../pages/Integrations'));
const JobDetail = lazy(() => import('../pages/JobDetail'));
const Jobs = lazy(() => import('../pages/Jobs'));
const JobSeekerFlow = lazy(() => import('../pages/JobSeekerFlow'));
const Maintenance = lazy(() => import('../pages/Maintenance'));
const MissionPage = lazy(() => import('../pages/MissionPage'));
const NewsletterInsights = lazy(() => import('../pages/NewsletterInsights'));
const NotFound = lazy(() => import('../pages/NotFound'));
const Notifications = lazy(() => import('../pages/Notifications'));
const Onboarding = lazy(() => import('../pages/Onboarding'));
const OnboardingFlow = lazy(() => import('../pages/OnboardingFlow'));
const Payment = lazy(() => import('../pages/Payment'));
const PaymentCancelled = lazy(() => import('../pages/PaymentCancelled'));
const PaymentFailure = lazy(() => import('../pages/PaymentFailure'));
const PaymentSuccess = lazy(() => import('../pages/PaymentSuccess'));
const PredictiveAnalytics = lazy(() => import('../pages/PredictiveAnalytics'));
const Preferences = lazy(() => import('../pages/Preferences'));
const PrivacyPage = lazy(() => import('../pages/PrivacyPage'));
const Profile = lazy(() => import('../pages/Profile'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const Settings = lazy(() => import('../pages/Settings'));
const SkillsAssessment = lazy(() => import('../pages/SkillsAssessment'));
const SuccessStories = lazy(() => import('../pages/SuccessStories'));
const Support = lazy(() => import('../pages/Support'));
const TermsPage = lazy(() => import('../pages/TermsPage'));
const WidgetsDemo = lazy(() => import('../pages/WidgetsDemo'));

/**
 * Route Categories
 * 
 * Routes are organized into logical categories for maintainability
 * and clear access control patterns.
 */

export const routeCategories = {
  // Public routes accessible without authentication
  public: [
    { path: '/', component: HomePage, exact: true },
    { path: '/about', component: AboutPage },
    { path: '/mission', component: MissionPage },
    { path: '/founder', component: FounderPage },
    { path: '/contact', component: ContactPage },
    { path: '/blog', component: Blog },
    { path: '/blog/:slug', component: Blog }, // Individual blog posts
    { path: '/success-stories', component: SuccessStories },
    { path: '/help', component: Help },
    { path: '/support', component: Support },
    { path: '/api-documentation', component: APIDocumentation },
    { path: '/changelog', component: Changelog },
    { path: '/privacy', component: PrivacyPage },
    { path: '/terms', component: TermsPage },
    { path: '/data-privacy', component: DataPrivacy },
    { path: '/coming-soon', component: ComingSoon },
    { path: '/maintenance', component: Maintenance },
    { path: '/widgets-demo', component: WidgetsDemo }
  ],

  // Authentication routes
  auth: [
    { path: '/login', component: AuthPages, props: { mode: 'login' } },
    { path: '/signup', component: AuthPages, props: { mode: 'signup' } },
    { path: '/auth', component: Auth }, // Legacy auth route
    { path: '/forgot-password', component: ForgotPassword },
    { path: '/reset-password/:token', component: ForgotPassword },
    { path: '/email-verification', component: EmailVerification },
    { path: '/email-verification/:token', component: EmailVerification }
  ],

  // Protected routes requiring authentication
  protected: [
    { path: '/dashboard', component: EnhancedDashboard },
    { path: '/dashboard-classic', component: Dashboard }, // Legacy dashboard
    { path: '/onboarding', component: OnboardingFlow },
    { path: '/onboarding-classic', component: Onboarding }, // Legacy onboarding
    { path: '/profile', component: ProfilePage },
    { path: '/profile-classic', component: Profile }, // Legacy profile
    { path: '/settings', component: Settings },
    { path: '/preferences', component: Preferences },
    { path: '/notifications', component: Notifications },
    { path: '/alerts', component: Alerts },
    { path: '/billing', component: Billing },
    { path: '/integrations', component: Integrations },
    { path: '/newsletter-insights', component: NewsletterInsights }
  ],

  // Job seeker specific routes
  jobSeeker: [
    { path: '/jobs', component: Jobs },
    { path: '/jobs/:id', component: JobDetail },
    { path: '/applications', component: Applications },
    { path: '/job-seeker-flow', component: JobSeekerFlow },
    { path: '/cv-builder', component: CvBuilder },
    { path: '/skills-assessment', component: SkillsAssessment },
    { path: '/advanced-matching', component: AdvancedMatching },
    { path: '/ai-writing', component: AIWriting },
    { path: '/company-intelligence', component: CompanyIntelligence },
    { path: '/predictive-analytics', component: PredictiveAnalytics }
  ],

  // Employer specific routes
  employer: [
    { path: '/employer-flow', component: EmployerFlow },
    { path: '/employer/jobs', component: Jobs, props: { mode: 'employer' } },
    { path: '/employer/candidates', component: Applications, props: { mode: 'employer' } },
    { path: '/employer/advanced-matching', component: AdvancedMatching, props: { mode: 'employer' } },
    { path: '/employer/company-intelligence', component: CompanyIntelligence, props: { mode: 'employer' } },
    { path: '/employer/predictive-analytics', component: PredictiveAnalytics, props: { mode: 'employer' } },
    { path: '/employer/analytics', component: Analytics }
  ],

  // Payment related routes
  payment: [
    { path: '/payment', component: Payment },
    { path: '/payment/success', component: PaymentSuccess },
    { path: '/payment/failure', component: PaymentFailure },
    { path: '/payment/cancelled', component: PaymentCancelled }
  ],

  // Admin routes
  admin: [
    { path: '/admin', component: Admin, exact: true },
    { path: '/admin/users', component: Admin, props: { section: 'users' } },
    { path: '/admin/jobs', component: Admin, props: { section: 'jobs' } },
    { path: '/admin/companies', component: Admin, props: { section: 'companies' } },
    { path: '/admin/analytics', component: Analytics, props: { mode: 'admin' } },
    { path: '/admin/content', component: Admin, props: { section: 'content' } },
    { path: '/admin/settings', component: Admin, props: { section: 'settings' } }
  ],

  // Error and fallback routes
  error: [
    { path: '/404', component: NotFound },
    { path: '*', component: NotFound } // Catch-all route
  ]
};

/**
 * Route Guards
 * 
 * Define access control rules for different route categories
 */
export const routeGuards = {
  public: {
    requireAuth: false,
    requiredRoles: []
  },
  auth: {
    requireAuth: false,
    redirectIfAuthenticated: true,
    redirectTo: '/dashboard'
  },
  protected: {
    requireAuth: true,
    redirectTo: '/login'
  },
  jobSeeker: {
    requireAuth: true,
    requiredRoles: ['job_seeker'],
    redirectTo: '/dashboard'
  },
  employer: {
    requireAuth: true,
    requiredRoles: ['employer'],
    redirectTo: '/dashboard'
  },
  admin: {
    requireAuth: true,
    requiredRoles: ['admin'],
    redirectTo: '/dashboard'
  },
  payment: {
    requireAuth: true,
    redirectTo: '/login'
  },
  error: {
    requireAuth: false,
    requiredRoles: []
  }
};

/**
 * Navigation Menu Structure
 * 
 * Defines the hierarchical navigation structure for the application
 */
export const navigationStructure = {
  mainMenu: [
    {
      label: 'Home',
      path: '/',
      icon: 'Home',
      public: true
    },
    {
      label: 'About',
      path: '/about',
      icon: 'Globe',
      public: true,
      submenu: [
        { label: 'Our Mission', path: '/mission' },
        { label: 'Meet the Founder', path: '/founder' },
        { label: 'Success Stories', path: '/success-stories' }
      ]
    },
    {
      label: 'Jobs',
      path: '/jobs',
      icon: 'Briefcase',
      requireAuth: true,
      roles: ['job_seeker']
    },
    {
      label: 'Recruitment',
      path: '/employer-flow',
      icon: 'Users',
      requireAuth: true,
      roles: ['employer']
    },
    {
      label: 'Resources',
      path: '#',
      icon: 'Book',
      public: true,
      submenu: [
        { label: 'Blog', path: '/blog' },
        { label: 'Help Center', path: '/help' },
        { label: 'API Documentation', path: '/api-documentation' },
        { label: 'Newsletter Insights', path: '/newsletter-insights' }
      ]
    },
    {
      label: 'Contact',
      path: '/contact',
      icon: 'Mail',
      public: true
    }
  ],

  userMenu: [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: 'BarChart3'
    },
    {
      label: 'Profile',
      path: '/profile',
      icon: 'User'
    },
    {
      label: 'Settings',
      path: '/settings',
      icon: 'Settings'
    },
    {
      label: 'Notifications',
      path: '/notifications',
      icon: 'Bell'
    },
    {
      label: 'Billing',
      path: '/billing',
      icon: 'CreditCard'
    }
  ],

  footerMenu: {
    platform: [
      { label: 'About Us', path: '/about' },
      { label: 'Our Mission', path: '/mission' },
      { label: 'Success Stories', path: '/success-stories' },
      { label: 'Blog', path: '/blog' },
      { label: 'Contact', path: '/contact' }
    ],
    resources: [
      { label: 'Help Center', path: '/help' },
      { label: 'Support', path: '/support' },
      { label: 'API Documentation', path: '/api-documentation' },
      { label: 'Changelog', path: '/changelog' },
      { label: 'System Status', path: '/maintenance' }
    ],
    legal: [
      { label: 'Privacy Policy', path: '/privacy' },
      { label: 'Terms of Service', path: '/terms' },
      { label: 'Data Privacy', path: '/data-privacy' }
    ],
    features: [
      { label: 'Job Search', path: '/jobs' },
      { label: 'CV Builder', path: '/cv-builder' },
      { label: 'Skills Assessment', path: '/skills-assessment' },
      { label: 'AI Matching', path: '/advanced-matching' },
      { label: 'Company Intelligence', path: '/company-intelligence' }
    ]
  }
};

/**
 * Route Metadata
 * 
 * SEO and metadata configuration for routes
 */
export const routeMetadata = {
  '/': {
    title: 'AI Job Chommie - Intelligent Recruitment Platform',
    description: 'Transform your career with AI-powered job matching and automated applications in South Africa',
    keywords: 'AI jobs, recruitment, South Africa, job search, career'
  },
  '/about': {
    title: 'About AI Job Chommie - Our Story',
    description: 'Learn about our mission to revolutionize employment in South Africa through artificial intelligence',
    keywords: 'about us, mission, AI recruitment, South Africa'
  },
  '/jobs': {
    title: 'Browse Jobs - AI Job Chommie',
    description: 'Discover thousands of job opportunities matched to your skills and preferences',
    keywords: 'jobs, careers, employment, opportunities'
  },
  '/cv-builder': {
    title: 'Professional CV Builder - AI Job Chommie',
    description: 'Create ATS-optimized CVs with our AI-powered CV builder',
    keywords: 'CV builder, resume, professional CV, ATS optimization'
  },
  '/admin': {
    title: 'Admin Dashboard - AI Job Chommie',
    description: 'Platform administration and management',
    keywords: 'admin, dashboard, management',
    robots: 'noindex, nofollow'
  }
};

/**
 * Feature Flags
 * 
 * Control feature availability across routes
 */
export const featureFlags = {
  enableAIWriting: true,
  enablePredictiveAnalytics: true,
  enableCompanyIntelligence: true,
  enableAdvancedMatching: true,
  enableNewDashboard: true,
  enableNewOnboarding: true,
  enablePayments: true,
  enableAdmin: true,
  enableBlog: true,
  enableNewsletterInsights: true
};

/**
 * Route Transitions
 * 
 * Animation configurations for route transitions
 */
export const routeTransitions = {
  default: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3 }
  },
  slide: {
    initial: { opacity: 0, x: 100 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -100 },
    transition: { duration: 0.3 }
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 }
  }
};

export default {
  routeCategories,
  routeGuards,
  navigationStructure,
  routeMetadata,
  featureFlags,
  routeTransitions
};
