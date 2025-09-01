/**
 * Batch Update Script for All Pages
 * This script rapidly applies the PageWrapper component to all pages
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Template for updating pages with PageWrapper
const pageTemplate = (pageName, title, subtitle, category) => `import React from 'react';
import PageWrapper from '../components/PageWrapper';
import { motion } from 'framer-motion';
import { ${getIconsForCategory(category)} } from 'lucide-react';

const ${pageName} = () => {
  return (
    <PageWrapper
      title="${title}"
      subtitle="${subtitle}"
      showBreadcrumbs={true}
      containerSize="max-w-7xl"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-800">
          {/* Existing ${pageName} content goes here */}
          <div className="text-center py-12">
            <${getMainIcon(category)} className="h-16 w-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">${title}</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">${subtitle}</p>
          </div>
        </div>
      </motion.div>
    </PageWrapper>
  );
};

export default ${pageName};
`;

function getIconsForCategory(category) {
  const iconMap = {
    navigation: 'Globe, Home, Target, Award, Mail',
    auth: 'Lock, Shield, User, Key, Mail',
    dashboard: 'BarChart3, TrendingUp, Activity, PieChart, Users',
    jobs: 'Briefcase, Search, FileText, Target, Building',
    profile: 'User, Settings, Bell, Shield, Edit3',
    payment: 'CreditCard, DollarSign, CheckCircle, XCircle, AlertCircle',
    utility: 'Book, HelpCircle, Code, FileText, Globe'
  };
  return iconMap[category] || 'Brain, Sparkles, Zap';
}

function getMainIcon(category) {
  const iconMap = {
    navigation: 'Globe',
    auth: 'Shield',
    dashboard: 'BarChart3',
    jobs: 'Briefcase',
    profile: 'User',
    payment: 'CreditCard',
    utility: 'Book'
  };
  return iconMap[category] || 'Brain';
}

// Page configurations
const pageConfigs = [
  // Navigation Pages
  { name: 'AboutPage', title: 'About AI Job Chommie', subtitle: 'Transforming employment through artificial intelligence', category: 'navigation' },
  { name: 'FounderPage', title: 'Meet Our Founder', subtitle: 'The vision behind AI Job Chommie', category: 'navigation' },
  { name: 'MissionPage', title: 'Our Mission', subtitle: 'Democratizing employment opportunities across South Africa', category: 'navigation' },
  { name: 'ContactPage', title: 'Contact Us', subtitle: 'Get in touch with our team', category: 'navigation' },
  { name: 'HomePage', title: 'Welcome to AI Job Chommie', subtitle: 'Your intelligent career companion', category: 'navigation' },
  { name: 'PrivacyPage', title: 'Privacy Policy', subtitle: 'Your data protection is our priority', category: 'navigation' },
  { name: 'TermsPage', title: 'Terms of Service', subtitle: 'Understanding our service agreement', category: 'navigation' },
  { name: 'SuccessStories', title: 'Success Stories', subtitle: 'Real people, real transformations', category: 'navigation' },
  
  // Auth Pages
  { name: 'Auth', title: 'Authentication', subtitle: 'Secure access to your account', category: 'auth' },
  { name: 'ForgotPassword', title: 'Reset Password', subtitle: 'Recover access to your account', category: 'auth' },
  { name: 'EmailVerification', title: 'Verify Email', subtitle: 'Confirm your email address', category: 'auth' },
  
  // Dashboard Pages
  { name: 'Dashboard', title: 'Dashboard', subtitle: 'Your career command center', category: 'dashboard' },
  { name: 'Admin', title: 'Admin Dashboard', subtitle: 'Platform administration and management', category: 'dashboard' },
  { name: 'Analytics', title: 'Analytics & Insights', subtitle: 'Data-driven career intelligence', category: 'dashboard' },
  { name: 'PredictiveAnalytics', title: 'Predictive Analytics', subtitle: 'AI-powered career forecasting', category: 'dashboard' },
  
  // Job Pages
  { name: 'Jobs', title: 'Browse Jobs', subtitle: 'Discover your next opportunity', category: 'jobs' },
  { name: 'JobDetail', title: 'Job Details', subtitle: 'Everything you need to know', category: 'jobs' },
  { name: 'Applications', title: 'My Applications', subtitle: 'Track your job applications', category: 'jobs' },
  { name: 'AdvancedMatching', title: 'AI Job Matching', subtitle: 'Intelligent career matching powered by AI', category: 'jobs' },
  { name: 'CompanyIntelligence', title: 'Company Intelligence', subtitle: 'Deep insights into potential employers', category: 'jobs' },
  
  // Profile Pages
  { name: 'Profile', title: 'My Profile', subtitle: 'Manage your professional identity', category: 'profile' },
  { name: 'Settings', title: 'Settings', subtitle: 'Customize your experience', category: 'profile' },
  { name: 'Preferences', title: 'Preferences', subtitle: 'Tailor the platform to your needs', category: 'profile' },
  { name: 'Notifications', title: 'Notifications', subtitle: 'Stay updated on opportunities', category: 'profile' },
  { name: 'Alerts', title: 'Job Alerts', subtitle: 'Never miss the perfect opportunity', category: 'profile' },
  
  // Payment Pages
  { name: 'Payment', title: 'Payment', subtitle: 'Secure payment processing', category: 'payment' },
  { name: 'PaymentSuccess', title: 'Payment Successful', subtitle: 'Your transaction was completed', category: 'payment' },
  { name: 'PaymentFailure', title: 'Payment Failed', subtitle: 'Transaction could not be processed', category: 'payment' },
  { name: 'PaymentCancelled', title: 'Payment Cancelled', subtitle: 'Transaction was cancelled', category: 'payment' },
  { name: 'Billing', title: 'Billing & Subscriptions', subtitle: 'Manage your payment methods and plans', category: 'payment' },
  
  // Utility Pages
  { name: 'APIDocumentation', title: 'API Documentation', subtitle: 'Integrate with our platform', category: 'utility' },
  { name: 'Blog', title: 'Career Insights Blog', subtitle: 'Expert advice and industry trends', category: 'utility' },
  { name: 'Changelog', title: 'Platform Updates', subtitle: 'Latest features and improvements', category: 'utility' },
  { name: 'ComingSoon', title: 'Coming Soon', subtitle: 'Exciting features on the horizon', category: 'utility' },
  { name: 'CvBuilder', title: 'Professional CV Builder', subtitle: 'Create ATS-optimized resumes', category: 'utility' },
  { name: 'DataPrivacy', title: 'Data Privacy', subtitle: 'How we protect your information', category: 'utility' },
  { name: 'Help', title: 'Help Center', subtitle: 'Find answers to common questions', category: 'utility' },
  { name: 'Integrations', title: 'Integrations', subtitle: 'Connect your favorite tools', category: 'utility' },
  { name: 'Maintenance', title: 'System Maintenance', subtitle: 'We\'ll be back shortly', category: 'utility' },
  { name: 'NewsletterInsights', title: 'Newsletter Insights', subtitle: 'Career trends and tips delivered', category: 'utility' },
  { name: 'NotFound', title: 'Page Not Found', subtitle: 'The page you\'re looking for doesn\'t exist', category: 'utility' },
  { name: 'Onboarding', title: 'Get Started', subtitle: 'Set up your profile for success', category: 'utility' },
  { name: 'SkillsAssessment', title: 'Skills Assessment', subtitle: 'Validate and showcase your expertise', category: 'utility' },
  { name: 'Support', title: 'Support Center', subtitle: 'We\'re here to help', category: 'utility' },
  { name: 'WidgetsDemo', title: 'Platform Features', subtitle: 'Explore our capabilities', category: 'utility' },
  { name: 'AIWriting', title: 'AI Writing Assistant', subtitle: 'Craft perfect applications with AI', category: 'utility' }
];

// Generate update files
pageConfigs.forEach(config => {
  const content = pageTemplate(config.name, config.title, config.subtitle, config.category);
  const fileName = `${config.name}_updated.jsx`;
  
  console.log(`Creating updated version for ${config.name}...`);
  
  // Create the updated file
  fs.writeFileSync(
    path.join(__dirname, '..', 'pages', 'updated', fileName),
    content,
    'utf8'
  );
});

console.log(`
 Successfully created ${pageConfigs.length} updated page templates!

Next steps:
1. Review the updated files in frontend/src/pages/updated/
2. Back up existing pages
3. Replace with updated versions
4. Test navigation and functionality
`);
