import React, { useState, useEffect } from 'react';
import { X, Menu, Home, Search, Briefcase, User, Settings, LogOut, Bell, BookmarkIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTouchGestures } from '../hooks/useTouchGestures';

const MobileNavigation = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  const gestures = useTouchGestures({
    onSwipeLeft: () => setIsOpen(false),
    onSwipeRight: () => setIsOpen(true),
    swipeThreshold: 75
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const menuItems = [
    { id: 'home', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'search', label: 'Search Jobs', icon: Search, path: '/jobs' },
    { id: 'applications', label: 'Applications', icon: Briefcase, path: '/applications' },
    { id: 'saved', label: 'Saved Jobs', icon: BookmarkIcon, path: '/saved' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
    { id: 'notifications', label: 'Notifications', icon: Bell, path: '/notifications', badge: 3 },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' }
  ];

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-50 p-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 h-full w-80 bg-gradient-to-b from-[#1a1f3a] to-[#131829] z-50 shadow-2xl md:hidden"
              {...gestures.gestureProps}
            >
              {/* Header */}
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Menu</h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                {user && (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center">
                      <span className="text-white font-semibold">
                        {user.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-medium">{user.name}</p>
                      <p className="text-gray-400 text-sm">{user.email}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Items */}
              <nav className="p-4">
                {menuItems.map((item) => (
                  <motion.a
                    key={item.id}
                    href={item.path}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setActiveSection(item.id);
                      setIsOpen(false);
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-all ${
                      activeSection === item.id
                        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-white'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="px-2 py-1 rounded-full bg-red-500 text-white text-xs">
                        {item.badge}
                      </span>
                    )}
                  </motion.a>
                ))}
              </nav>

              {/* Logout Button */}
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
                <button
                  onClick={onLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Logout</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Tab Bar for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1a1f3a] border-t border-white/10 px-2 py-2 z-40 md:hidden">
        <div className="flex justify-around">
          {menuItems.slice(0, 5).map((item) => (
            <a
              key={item.id}
              href={item.path}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                activeSection === item.id
                  ? 'text-cyan-400'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setActiveSection(item.id)}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </a>
          ))}
        </div>
      </div>
    </>
  );
};

export default MobileNavigation;
