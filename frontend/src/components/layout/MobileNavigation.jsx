import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import {
  Menu,
  X,
  Home,
  Search,
  FileText,
  User,
  Building2,
  Mic,
  Settings,
  LogOut,
  ChevronRight,
  Bell,
  Heart,
  Bookmark,
  Calendar,
  HelpCircle,
  Shield
} from 'lucide-react';
import './MobileNavigation.css';

const MobileNavigation = ({ 
  isOpen, 
  onToggle, 
  currentPath = '/',
  user = null,
  notifications = 0,
  onNavigate = () => {},
  onLogout = () => {},
  className = ''
}) => {
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const navRef = useRef(null);

  // Navigation items configuration
  const navigationItems = [
    {
      id: 'dashboard',
      icon: Home,
      label: 'Dashboard',
      path: '/dashboard',
      color: '#22c55e'
    },
    {
      id: 'jobs',
      icon: Search,
      label: 'Find Jobs',
      path: '/jobs',
      color: '#3b82f6',
      submenu: [
        { label: 'Search Jobs', path: '/jobs/search' },
        { label: 'Saved Jobs', path: '/jobs/saved' },
        { label: 'Applied Jobs', path: '/jobs/applied' },
        { label: 'Job Alerts', path: '/jobs/alerts' }
      ]
    },
    {
      id: 'cv',
      icon: FileText,
      label: 'CV Builder',
      path: '/cv-builder',
      color: '#8b5cf6'
    },
    {
      id: 'profile',
      icon: User,
      label: 'Profile',
      path: '/profile',
      color: '#f59e0b'
    },
    {
      id: 'employer',
      icon: Building2,
      label: 'For Employers',
      path: '/employer',
      color: '#ef4444',
      submenu: [
        { label: 'Post Jobs', path: '/employer/post' },
        { label: 'Applications', path: '/employer/applications' },
        { label: 'Analytics', path: '/employer/analytics' },
        { label: 'Company Profile', path: '/employer/profile' }
      ]
    }
  ];

  const utilityItems = [
    {
      id: 'notifications',
      icon: Bell,
      label: 'Notifications',
      path: '/notifications',
      badge: notifications > 0 ? notifications : null
    },
    {
      id: 'saved',
      icon: Heart,
      label: 'Saved Items',
      path: '/saved'
    },
    {
      id: 'bookmarks',
      icon: Bookmark,
      label: 'Bookmarks',
      path: '/bookmarks'
    },
    {
      id: 'calendar',
      icon: Calendar,
      label: 'Calendar',
      path: '/calendar'
    }
  ];

  const bottomItems = [
    {
      id: 'voice',
      icon: Mic,
      label: 'Voice Commands',
      path: '/voice'
    },
    {
      id: 'settings',
      icon: Settings,
      label: 'Settings',
      path: '/settings'
    },
    {
      id: 'help',
      icon: HelpCircle,
      label: 'Help & Support',
      path: '/help'
    },
    {
      id: 'privacy',
      icon: Shield,
      label: 'Privacy',
      path: '/privacy'
    }
  ];

  // Handle swipe to close
  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    
    if (isLeftSwipe && isOpen) {
      onToggle();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onToggle();
        setActiveSubmenu(null);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onToggle]);

  // Handle navigation
  const handleNavigation = (path) => {
    onNavigate(path);
    onToggle();
    setActiveSubmenu(null);
  };

  // Handle submenu toggle
  const handleSubmenuToggle = (itemId) => {
    setActiveSubmenu(activeSubmenu === itemId ? null : itemId);
  };

  // Mobile Navigation Toggle Button
  const MobileNavToggle = () => (
    <motion.button
      className="mobile-nav__toggle touch-target"
      onClick={onToggle}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
      aria-expanded={isOpen}
    >
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="close"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <X size={24} />
          </motion.div>
        ) : (
          <motion.div
            key="menu"
            initial={{ rotate: 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: -90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Menu size={24} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );

  // Navigation Item Component
  const NavItem = ({ item, isActive, hasSubmenu, onSubmenuToggle }) => {
    const Icon = item.icon;
    const isSubmenuOpen = activeSubmenu === item.id;
    
    return (
      <div className="mobile-nav__item-wrapper">
        <motion.button
          className={`mobile-nav__item ${isActive ? 'mobile-nav__item--active' : ''}`}
          onClick={() => {
            if (hasSubmenu) {
              onSubmenuToggle(item.id);
            } else {
              handleNavigation(item.path);
            }
          }}
          whileTap={{ scale: 0.98 }}
          style={{ '--item-color': item.color }}
        >
          <div className="mobile-nav__item-icon">
            <Icon size={20} />
          </div>
          <span className="mobile-nav__item-label">{item.label}</span>
          {item.badge && (
            <span className="mobile-nav__item-badge">{item.badge}</span>
          )}
          {hasSubmenu && (
            <motion.div
              className="mobile-nav__item-chevron"
              animate={{ rotate: isSubmenuOpen ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight size={16} />
            </motion.div>
          )}
        </motion.button>

        {hasSubmenu && (
          <AnimatePresence>
            {isSubmenuOpen && (
              <motion.div
                className="mobile-nav__submenu"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                {item.submenu.map((subItem, index) => (
                  <motion.button
                    key={subItem.path}
                    className={`mobile-nav__submenu-item ${
                      currentPath === subItem.path ? 'mobile-nav__submenu-item--active' : ''
                    }`}
                    onClick={() => handleNavigation(subItem.path)}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {subItem.label}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Navigation Toggle */}
      <MobileNavToggle />

      {/* Navigation Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="mobile-nav__backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onToggle}
              transition={{ duration: 0.3 }}
            />

            {/* Navigation Panel */}
            <motion.nav
              ref={navRef}
              className={`mobile-nav ${className}`}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Header */}
              <div className="mobile-nav__header">
                <div className="mobile-nav__logo">
                  <div className="mobile-nav__logo-icon">
                    <span></span>
                  </div>
                  <span className="mobile-nav__logo-text">Job Chommie</span>
                </div>
                
                {user && (
                  <div className="mobile-nav__user">
                    <div className="mobile-nav__avatar">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} />
                      ) : (
                        <User size={20} />
                      )}
                    </div>
                    <div className="mobile-nav__user-info">
                      <div className="mobile-nav__user-name">{user.name}</div>
                      <div className="mobile-nav__user-email">{user.email}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Main Navigation */}
              <div className="mobile-nav__content">
                <div className="mobile-nav__section">
                  <div className="mobile-nav__section-title">Main</div>
                  <div className="mobile-nav__items">
                    {navigationItems.map((item) => (
                      <NavItem
                        key={item.id}
                        item={item}
                        isActive={currentPath === item.path}
                        hasSubmenu={!!item.submenu}
                        onSubmenuToggle={handleSubmenuToggle}
                      />
                    ))}
                  </div>
                </div>

                <div className="mobile-nav__section">
                  <div className="mobile-nav__section-title">Quick Access</div>
                  <div className="mobile-nav__items">
                    {utilityItems.map((item) => (
                      <NavItem
                        key={item.id}
                        item={item}
                        isActive={currentPath === item.path}
                        hasSubmenu={false}
                        onSubmenuToggle={handleSubmenuToggle}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mobile-nav__footer">
                <div className="mobile-nav__bottom-items">
                  {bottomItems.map((item) => (
                    <NavItem
                      key={item.id}
                      item={item}
                      isActive={currentPath === item.path}
                      hasSubmenu={false}
                      onSubmenuToggle={handleSubmenuToggle}
                    />
                  ))}
                </div>

                {user && (
                  <motion.button
                    className="mobile-nav__logout"
                    onClick={onLogout}
                    whileTap={{ scale: 0.98 }}
                  >
                    <LogOut size={18} />
                    <span>Sign Out</span>
                  </motion.button>
                )}
              </div>

              {/* Swipe Indicator */}
              <div className="mobile-nav__swipe-indicator">
                <div className="mobile-nav__swipe-line" />
                <span className="mobile-nav__swipe-text">Swipe left to close</span>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

// PropTypes validation
MobileNavigation.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  currentPath: PropTypes.string,
  user: PropTypes.shape({
    name: PropTypes.string,
    email: PropTypes.string,
    avatar: PropTypes.string
  }),
  notifications: PropTypes.number,
  onNavigate: PropTypes.func,
  onLogout: PropTypes.func,
  className: PropTypes.string
};

// Hook for mobile navigation state
export const useMobileNavigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggle = () => setIsOpen(!isOpen);
  const close = () => setIsOpen(false);
  const open = () => setIsOpen(true);

  return {
    isOpen,
    isMobile,
    toggle,
    close,
    open,
    setIsOpen
  };
};

// Responsive Navigation Wrapper
export const ResponsiveNavigation = ({ 
  children, 
  mobileProps = {},
  desktopProps = {},
  ...props 
}) => {
  const { isMobile } = useMobileNavigation();

  if (isMobile) {
    return <MobileNavigation {...mobileProps} {...props} />;
  }

  return React.cloneElement(children, { ...desktopProps, ...props });
};

ResponsiveNavigation.propTypes = {
  children: PropTypes.node.isRequired,
  mobileProps: PropTypes.object,
  desktopProps: PropTypes.object
};

export default MobileNavigation;
