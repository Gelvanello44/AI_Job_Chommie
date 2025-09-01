import React, { useState, useEffect, Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Toaster } from './components/ui/sonner'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from './lib/queryClient'
import { Menu, X, Brain } from 'lucide-react'
import * as Sentry from '@sentry/react'
import ErrorFallback from './components/ErrorFallback'
import backgroundImage from './assets/background.png'

// Import ALL pages
import HomePage from './pages/HomePage'
import AboutPage from './pages/AboutPage'
import FounderPage from './pages/FounderPage'
import MissionPage from './pages/MissionPage'
import ContactPage from './pages/ContactPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import PricingPage from './PricingPage'

// Auth Pages
import { LoginPage, SignupPage } from './pages/Auth'
import AuthPages from './pages/AuthPages'
import ForgotPassword from './pages/backup/ForgotPassword'
import EmailVerification from './pages/backup/EmailVerification'

// Dashboard & Analytics
import Dashboard from './pages/Dashboard'
import EnhancedDashboard from './pages/EnhancedDashboard'
import Analytics from './pages/Analytics'
import PredictiveAnalytics from './pages/backup/PredictiveAnalytics'

// Jobs & Applications
import Jobs from './pages/Jobs'
import JobDetail from './pages/JobDetail'
import Applications from './pages/Applications'
import AdvancedMatching from './pages/backup/AdvancedMatching'

// Profile & Settings
import Profile from './pages/Profile'
import ProfilePage from './pages/ProfilePage'
import Settings from './pages/Settings'
import Preferences from './pages/Preferences'

// Tools & Features
import CvBuilder from './pages/CvBuilder'
import AIWriting from './pages/backup/AIWriting'
import SkillsAssessment from './pages/backup/SkillsAssessment'
import CompanyIntelligence from './pages/backup/CompanyIntelligence'
import NewsletterInsights from './pages/backup/NewsletterInsights'

// Notifications & Alerts
import Alerts from './pages/Alerts'
import Notifications from './pages/backup/Notifications'

// Onboarding & Flow
import Onboarding from './pages/backup/Onboarding'
import OnboardingFlow from './pages/OnboardingFlow'
import JobSeekerFlow from './pages/JobSeekerFlow'
import EmployerFlow from './pages/EmployerFlow'

// Payment & Billing
import Payment from './pages/Payment'
import PaymentSuccess from './pages/backup/PaymentSuccess'
import PaymentFailure from './pages/backup/PaymentFailure'
import PaymentCancelled from './pages/backup/PaymentCancelled'
import Billing from './pages/backup/Billing'

// Admin & Support
import Admin from './pages/backup/Admin'
import Support from './pages/backup/Support'
import Help from './pages/backup/Help'

// Content Pages
import Blog from './pages/backup/Blog'
import SuccessStories from './pages/backup/SuccessStories'
import Changelog from './pages/backup/Changelog'
import APIDocumentation from './pages/backup/APIDocumentation'

// Utility Pages
import NotFound from './pages/NotFound'
import ComingSoon from './pages/backup/ComingSoon'
import Maintenance from './pages/backup/Maintenance'
import DataPrivacy from './pages/backup/DataPrivacy'
import Integrations from './pages/backup/Integrations'

// Other Components
import ProtectedRoute from './components/ProtectedRoute'
import WidgetsDemo from './pages/WidgetsDemo'
import ManagerDashboard from './components/ManagerDashboard'

// Lazy loading heavy components
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
      <p className="text-white">Loading...</p>
    </div>
  </div>
)

// Navigation Component with ALL pages
const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()
  const { isAuthenticated, logout } = useAuth()

  const publicPages = [
    { path: '/', label: 'Home' },
    { path: '/about', label: 'About' },
    { path: '/founder', label: 'Founder' },
    { path: '/mission', label: 'Mission' },
    { path: '/pricing', label: 'Pricing' },
    { path: '/blog', label: 'Blog' },
    { path: '/success-stories', label: 'Success Stories' },
    { path: '/contact', label: 'Contact' }
  ]

  const authPages = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/enhanced-dashboard', label: 'Enhanced Dashboard' },
    { path: '/jobs', label: 'Jobs' },
    { path: '/applications', label: 'Applications' },
    { path: '/cv-builder', label: 'CV Builder' },
    { path: '/analytics', label: 'Analytics' },
    { path: '/alerts', label: 'Job Alerts' },
    { path: '/profile', label: 'Profile' },
    { path: '/settings', label: 'Settings' }
  ]

  const toolsPages = [
    { path: '/ai-writing', label: 'AI Writing' },
    { path: '/skills-assessment', label: 'Skills Assessment' },
    { path: '/company-intelligence', label: 'Company Intel' },
    { path: '/advanced-matching', label: 'Smart Matching' },
    { path: '/predictive-analytics', label: 'Predictions' }
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <Brain className="h-8 w-8 text-cyan-400" />
            <span className="text-white font-bold text-xl">AI Job Chommie</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {publicPages.slice(0, 5).map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-white hover:text-cyan-400 transition-colors ${
                  location.pathname === item.path ? 'text-cyan-400' : ''
                }`}
              >
                {item.label}
              </Link>
            ))}
            
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="text-white hover:text-cyan-400">Dashboard</Link>
                <Link to="/jobs" className="text-white hover:text-cyan-400">Jobs</Link>
                <button onClick={logout} className="text-white hover:text-cyan-400">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-white hover:text-cyan-400">Login</Link>
                <Link to="/signup" className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg">
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-white"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden bg-black/40 backdrop-blur-md rounded-lg mt-2 p-4">
            {[...publicPages, ...(isAuthenticated ? authPages : [])].map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="block px-3 py-2 text-white hover:text-cyan-400"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}

// Footer Component
const Footer = () => (
  <footer className="border-t border-white/10 bg-black/30 mt-auto">
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between">
      <span className="text-gray-300">© 2024 AI Job Chommie - All Pages Active</span>
      <div className="flex gap-4">
        <Link to="/terms" className="text-cyan-400 hover:underline">Terms</Link>
        <Link to="/privacy" className="text-cyan-400 hover:underline">Privacy</Link>
        <Link to="/api-docs" className="text-cyan-400 hover:underline">API</Link>
      </div>
    </div>
  </footer>
)

// Main App Component with ALL routes
function AppComplete() {
  const queryClient = createQueryClient()
  
  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen relative flex flex-col">
          {/* Background */}
          <div
            className="fixed inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
          <div className="fixed inset-0 bg-black/60" />

          <AuthProvider>
            <Navigation />
            
            <div className="relative z-10 flex-1 pt-16">
              <Sentry.ErrorBoundary fallback={ErrorFallback}>
                <Routes>
                  {/* Public Pages */}
                  <Route path="/" element={<HomePage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/founder" element={<FounderPage />} />
                  <Route path="/mission" element={<MissionPage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/data-privacy" element={<DataPrivacy />} />
                  
                  {/* Auth Pages */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/auth" element={<AuthPages />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/email-verification" element={<EmailVerification />} />
                  
                  {/* Dashboard Pages */}
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/enhanced-dashboard" element={<ProtectedRoute><EnhancedDashboard /></ProtectedRoute>} />
                  <Route path="/manager" element={<ProtectedRoute><ManagerDashboard /></ProtectedRoute>} />
                  
                  {/* Jobs & Applications */}
                  <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
                  <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
                  <Route path="/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
                  <Route path="/advanced-matching" element={<ProtectedRoute><AdvancedMatching /></ProtectedRoute>} />
                  
                  {/* Tools & Features */}
                  <Route path="/cv-builder" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><CvBuilder /></Suspense></ProtectedRoute>} />
                  <Route path="/ai-writing" element={<ProtectedRoute><AIWriting /></ProtectedRoute>} />
                  <Route path="/skills-assessment" element={<ProtectedRoute><SkillsAssessment /></ProtectedRoute>} />
                  <Route path="/company-intelligence" element={<ProtectedRoute><CompanyIntelligence /></ProtectedRoute>} />
                  <Route path="/newsletter-insights" element={<ProtectedRoute><NewsletterInsights /></ProtectedRoute>} />
                  
                  {/* Analytics */}
                  <Route path="/analytics" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Analytics /></Suspense></ProtectedRoute>} />
                  <Route path="/predictive-analytics" element={<ProtectedRoute><PredictiveAnalytics /></ProtectedRoute>} />
                  
                  {/* Alerts & Notifications */}
                  <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
                  <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                  
                  {/* Profile & Settings */}
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/profile-page" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/preferences" element={<ProtectedRoute><Preferences /></ProtectedRoute>} />
                  
                  {/* Onboarding Flows */}
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/onboarding-flow" element={<OnboardingFlow />} />
                  <Route path="/job-seeker-flow" element={<JobSeekerFlow />} />
                  <Route path="/employer-flow" element={<EmployerFlow />} />
                  
                  {/* Payment */}
                  <Route path="/payment" element={<Payment />} />
                  <Route path="/payment-success" element={<PaymentSuccess />} />
                  <Route path="/payment-failure" element={<PaymentFailure />} />
                  <Route path="/payment-cancelled" element={<PaymentCancelled />} />
                  <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
                  
                  {/* Admin & Support */}
                  <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/help" element={<Help />} />
                  
                  {/* Content Pages */}
                  <Route path="/blog" element={<Blog />} />
                  <Route path="/success-stories" element={<SuccessStories />} />
                  <Route path="/changelog" element={<Changelog />} />
                  <Route path="/api-docs" element={<APIDocumentation />} />
                  <Route path="/integrations" element={<Integrations />} />
                  
                  {/* Utility Pages */}
                  <Route path="/widgets-demo" element={<WidgetsDemo />} />
                  <Route path="/coming-soon" element={<ComingSoon />} />
                  <Route path="/maintenance" element={<Maintenance />} />
                  
                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Sentry.ErrorBoundary>
              <Toaster richColors position="top-right" />
            </div>
            
            <Footer />
          </AuthProvider>
        </div>
      </QueryClientProvider>
    </Router>
  )
}

export default AppComplete
