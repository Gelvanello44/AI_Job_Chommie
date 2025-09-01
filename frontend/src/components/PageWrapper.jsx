import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Menu, X, Search, Bell, User, Settings, LogOut,
  Home, Briefcase, Users, FileText, BarChart3, CreditCard,
  MessageSquare, HelpCircle, ChevronDown, ChevronRight,
  Shield, Globe, Book, Zap, Target, TrendingUp, Award,
  Building, Calendar, Mail, Phone, MapPin, Clock,
  ArrowLeft, ArrowRight, Sun, Moon, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * PageWrapper Component
 * 
 * This sophisticated wrapper component provides a consistent, premium UI structure
 * for all pages within the AI Job Chommie platform. It implements a cohesive design
 * language with advanced navigation, responsive layouts, and accessibility features.
 */

const PageWrapper = ({ 
  children, 
  title, 
  subtitle, 
  showBreadcrumbs = true,
  showSidebar = true,
  sidebarContent = null,
  className = '',
  containerSize = 'max-w-7xl' // 'max-w-7xl', 'max-w-6xl', 'max-w-5xl', 'full'
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [notifications, setNotifications] = useState([]);

  // Navigation Configuration
  const navigationItems = {
    main: [
      { path: '/', label: 'Home', icon: Home, public: true },
      { path: '/about', label: 'About', icon: Globe, public: true },
      { path: '/mission', label: 'Mission', icon: Target, public: true },
      { path: '/founder', label: 'Founder', icon: User, public: true },
      { path: '/success-stories', label: 'Success Stories', icon: Award, public: true },
      { path: '/blog', label: 'Blog', icon: Book, public: true },
      { path: '/contact', label: 'Contact', icon: Mail, public: true }
    ],
    authenticated: [
      { path: '/dashboard', label: 'Dashboard', icon: BarChart3, roles: ['job_seeker', 'employer'] },
      { path: '/jobs', label: 'Jobs', icon: Briefcase, roles: ['job_seeker'] },
      { path: '/applications', label: 'Applications', icon: FileText, roles: ['job_seeker'] },
      { path: '/job-seeker-flow', label: 'Job Search', icon: Search, roles: ['job_seeker'] },
      { path: '/employer-flow', label: 'Recruitment', icon: Users, roles: ['employer'] },
      { path: '/advanced-matching', label: 'AI Matching', icon: Zap, roles: ['job_seeker', 'employer'] },
      { path: '/cv-builder', label: 'CV Builder', icon: FileText, roles: ['job_seeker'] },
      { path: '/skills-assessment', label: 'Skills Test', icon: Award, roles: ['job_seeker'] },
      { path: '/company-intelligence', label: 'Company Intel', icon: Building, roles: ['job_seeker', 'employer'] },
      { path: '/predictive-analytics', label: 'Analytics', icon: TrendingUp, roles: ['job_seeker', 'employer'] }
    ],
    utility: [
      { path: '/profile', label: 'Profile', icon: User, authenticated: true },
      { path: '/settings', label: 'Settings', icon: Settings, authenticated: true },
      { path: '/preferences', label: 'Preferences', icon: Settings, authenticated: true },
      { path: '/notifications', label: 'Notifications', icon: Bell, authenticated: true },
      { path: '/billing', label: 'Billing', icon: CreditCard, authenticated: true },
      { path: '/integrations', label: 'Integrations', icon: Globe, authenticated: true },
      { path: '/help', label: 'Help Center', icon: HelpCircle, public: true },
      { path: '/support', label: 'Support', icon: MessageSquare, public: true },
      { path: '/api-documentation', label: 'API Docs', icon: Book, public: true },
      { path: '/changelog', label: 'Changelog', icon: FileText, public: true },
      { path: '/privacy', label: 'Privacy Policy', icon: Shield, public: true },
      { path: '/terms', label: 'Terms of Service', icon: FileText, public: true },
      { path: '/data-privacy', label: 'Data Privacy', icon: Shield, public: true }
    ],
    admin: [
      { path: '/admin', label: 'Admin Panel', icon: Shield, roles: ['admin'] },
      { path: '/admin/users', label: 'User Management', icon: Users, roles: ['admin'] },
      { path: '/admin/analytics', label: 'Platform Analytics', icon: BarChart3, roles: ['admin'] },
      { path: '/admin/content', label: 'Content Management', icon: FileText, roles: ['admin'] }
    ]
  };

  // Filter navigation items based on authentication and user role
  const getVisibleNavItems = (items) => {
    return items.filter(item => {
      if (item.public) return true;
      if (!isAuthenticated) return false;
      if (item.authenticated) return true;
      if (item.roles && user?.role) {
        return item.roles.includes(user.role);
      }
      return false;
    });
  };

  // Breadcrumb generation
  const generateBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ label: 'Home', path: '/' }];
    
    let currentPath = '';
    paths.forEach(segment => {
      currentPath += `/${segment}`;
      const formattedLabel = segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      breadcrumbs.push({ label: formattedLabel, path: currentPath });
    });
    
    return breadcrumbs;
  };

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  useEffect(() => {
    // Close menus on route change
    setIsSidebarOpen(false);
    setIsProfileMenuOpen(false);
    setIsSearchOpen(false);
  }, [location]);

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 ${isDarkMode ? 'dark' : ''}`}>
      {/* Premium Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                {isSidebarOpen ? <X className="h-5 w-5 text-white" /> : <Menu className="h-5 w-5 text-white" />}
              </button>
              
              <Link to="/" className="flex items-center gap-2 group">
                <div className="relative">
                  <Brain className="h-8 w-8 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <Sparkles className="h-4 w-4 text-purple-400 absolute -top-1 -right-1" />
                </div>
                <span className="text-xl font-bold text-white hidden sm:block">AI Job Chommie</span>
              </Link>
            </div>

            {/* Center Navigation (Desktop) */}
            <nav className="hidden lg:flex items-center gap-1">
              {getVisibleNavItems(navigationItems.main.slice(0, 5)).map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                      location.pathname === item.path
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Search */}
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <Search className="h-5 w-5 text-gray-400" />
              </button>

              {/* Notifications (Authenticated) */}
              {isAuthenticated && (
                <button
                  onClick={() => navigate('/notifications')}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors relative"
                >
                  <Bell className="h-5 w-5 text-gray-400" />
                  {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </button>
              )}

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                {isDarkMode ? <Sun className="h-5 w-5 text-gray-400" /> : <Moon className="h-5 w-5 text-gray-400" />}
              </button>

              {/* Profile Menu */}
              {isAuthenticated ? (
                <div className="relative">
                  <button
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">
                        {user?.firstName?.charAt(0) || 'U'}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>

                  <AnimatePresence>
                    {isProfileMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 mt-2 w-64 bg-gray-900 border border-gray-800 rounded-xl shadow-xl overflow-hidden"
                      >
                        <div className="p-4 border-b border-gray-800">
                          <p className="text-white font-medium">{user?.firstName} {user?.lastName}</p>
                          <p className="text-gray-400 text-sm">{user?.email}</p>
                        </div>
                        <div className="p-2">
                          {getVisibleNavItems(navigationItems.utility.slice(0, 4)).map((item) => {
                            const Icon = item.icon;
                            return (
                              <Link
                                key={item.path}
                                to={item.path}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                              >
                                <Icon className="h-4 w-4" />
                                {item.label}
                              </Link>
                            );
                          })}
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <LogOut className="h-4 w-4" />
                            Sign Out
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-gray-800"
            >
              <div className="max-w-3xl mx-auto p-4">
                <form onSubmit={handleSearch} className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search jobs, companies, or resources..."
                    className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                    autoFocus
                  />
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-gray-900 border-r border-gray-800 z-40 lg:hidden overflow-y-auto"
            >
              <div className="p-4">
                <div className="flex items-center gap-2 mb-8">
                  <Brain className="h-8 w-8 text-cyan-400" />
                  <span className="text-xl font-bold text-white">AI Job Chommie</span>
                </div>

                <nav className="space-y-6">
                  {Object.entries(navigationItems).map(([section, items]) => (
                    <div key={section}>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        {section.replace('_', ' ')}
                      </h3>
                      <div className="space-y-1">
                        {getVisibleNavItems(items).map((item) => {
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                                location.pathname === item.path
                                  ? 'bg-cyan-500/20 text-cyan-400'
                                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </nav>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="pt-16 min-h-screen">
        {/* Breadcrumbs */}
        {showBreadcrumbs && location.pathname !== '/' && (
          <div className="bg-black/30 border-b border-white/10">
            <div className={`${containerSize === 'full' ? 'w-full' : containerSize} mx-auto px-4 sm:px-6 lg:px-8 py-3`}>
              <nav className="flex items-center gap-2 text-sm">
                {generateBreadcrumbs().map((crumb, index, array) => (
                  <React.Fragment key={crumb.path}>
                    {index > 0 && <ChevronRight className="h-4 w-4 text-gray-600" />}
                    {index === array.length - 1 ? (
                      <span className="text-gray-400">{crumb.label}</span>
                    ) : (
                      <Link to={crumb.path} className="text-gray-500 hover:text-cyan-400 transition-colors">
                        {crumb.label}
                      </Link>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* Page Header */}
        {(title || subtitle) && (
          <div className="bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-cyan-500/10 border-b border-white/10">
            <div className={`${containerSize === 'full' ? 'w-full' : containerSize} mx-auto px-4 sm:px-6 lg:px-8 py-12`}>
              {title && (
                <h1 className="text-4xl font-bold text-white mb-2">{title}</h1>
              )}
              {subtitle && (
                <p className="text-xl text-gray-400">{subtitle}</p>
              )}
            </div>
          </div>
        )}

        {/* Content Layout */}
        <div className={`${containerSize === 'full' ? 'w-full' : containerSize} mx-auto px-4 sm:px-6 lg:px-8 py-8`}>
          <div className={`${showSidebar && sidebarContent ? 'lg:grid lg:grid-cols-4 lg:gap-8' : ''}`}>
            {/* Sidebar Content */}
            {showSidebar && sidebarContent && (
              <aside className="hidden lg:block lg:col-span-1">
                <div className="sticky top-24">
                  {sidebarContent}
                </div>
              </aside>
            )}

            {/* Main Content */}
            <div className={`${showSidebar && sidebarContent ? 'lg:col-span-3' : ''} ${className}`}>
              {children}
            </div>
          </div>
        </div>
      </main>

      {/* Premium Footer */}
      <footer className="bg-black/30 border-t border-white/10 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-8 w-8 text-cyan-400" />
                <span className="text-xl font-bold text-white">AI Job Chommie</span>
              </div>
              <p className="text-gray-400 text-sm">
                Transforming South African employment through artificial intelligence.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-white font-semibold mb-4">Platform</h3>
              <ul className="space-y-2">
                {navigationItems.main.slice(0, 5).map((item) => (
                  <li key={item.path}>
                    <Link to={item.path} className="text-gray-400 hover:text-cyan-400 text-sm transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="text-white font-semibold mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><Link to="/help" className="text-gray-400 hover:text-cyan-400 text-sm transition-colors">Help Center</Link></li>
                <li><Link to="/api-documentation" className="text-gray-400 hover:text-cyan-400 text-sm transition-colors">API Documentation</Link></li>
                <li><Link to="/blog" className="text-gray-400 hover:text-cyan-400 text-sm transition-colors">Blog</Link></li>
                <li><Link to="/changelog" className="text-gray-400 hover:text-cyan-400 text-sm transition-colors">Changelog</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-white font-semibold mb-4">Contact</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  info@aijobchommie.co.za
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  +27 10 123 4567
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Port Elizabeth, South Africa
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between">
            <p className="text-gray-500 text-sm">
              © 2024 AI Job Chommie (Pty) Ltd. All rights reserved.
            </p>
            <div className="flex items-center gap-6 mt-4 md:mt-0">
              <Link to="/privacy" className="text-gray-500 hover:text-cyan-400 text-sm transition-colors">Privacy</Link>
              <Link to="/terms" className="text-gray-500 hover:text-cyan-400 text-sm transition-colors">Terms</Link>
              <Link to="/data-privacy" className="text-gray-500 hover:text-cyan-400 text-sm transition-colors">Data Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PageWrapper;
