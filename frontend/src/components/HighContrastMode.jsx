/**
 * High Contrast Mode Provider
 * Provides high contrast themes for better accessibility
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Contrast } from 'lucide-react';

/**
 * High Contrast Context
 */
const HighContrastContext = createContext();

/**
 * High contrast theme definitions
 */
const themes = {
  normal: {
    name: 'Normal',
    colors: {
      background: 'bg-white dark:bg-gray-900',
      foreground: 'text-gray-900 dark:text-gray-100',
      primary: 'text-cyan-600 dark:text-cyan-400',
      secondary: 'text-gray-600 dark:text-gray-400',
      border: 'border-gray-200 dark:border-gray-700',
      hover: 'hover:bg-gray-100 dark:hover:bg-gray-800',
      focus: 'focus:ring-cyan-500',
      button: 'bg-cyan-500 hover:bg-cyan-600',
      buttonText: 'text-white',
      link: 'text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300'
    }
  },
  highContrast: {
    name: 'High Contrast',
    colors: {
      background: 'bg-white dark:bg-black',
      foreground: 'text-black dark:text-white',
      primary: 'text-blue-800 dark:text-yellow-300',
      secondary: 'text-gray-800 dark:text-gray-200',
      border: 'border-black dark:border-white border-2',
      hover: 'hover:bg-yellow-200 dark:hover:bg-blue-900',
      focus: 'focus:ring-4 focus:ring-yellow-400 dark:focus:ring-blue-400',
      button: 'bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200',
      buttonText: 'text-white dark:text-black font-bold',
      link: 'text-blue-800 hover:text-blue-900 underline dark:text-yellow-300 dark:hover:text-yellow-200'
    }
  },
  blackOnWhite: {
    name: 'Black on White',
    colors: {
      background: 'bg-white',
      foreground: 'text-black',
      primary: 'text-black font-bold',
      secondary: 'text-gray-900',
      border: 'border-black border-2',
      hover: 'hover:bg-gray-200',
      focus: 'focus:ring-4 focus:ring-black',
      button: 'bg-black hover:bg-gray-800',
      buttonText: 'text-white font-bold',
      link: 'text-black underline hover:text-gray-800 font-semibold'
    }
  },
  whiteOnBlack: {
    name: 'White on Black',
    colors: {
      background: 'bg-black',
      foreground: 'text-white',
      primary: 'text-white font-bold',
      secondary: 'text-gray-100',
      border: 'border-white border-2',
      hover: 'hover:bg-gray-800',
      focus: 'focus:ring-4 focus:ring-white',
      button: 'bg-white hover:bg-gray-200',
      buttonText: 'text-black font-bold',
      link: 'text-white underline hover:text-gray-200 font-semibold'
    }
  },
  yellowOnBlack: {
    name: 'Yellow on Black',
    colors: {
      background: 'bg-black',
      foreground: 'text-yellow-300',
      primary: 'text-yellow-300 font-bold',
      secondary: 'text-yellow-200',
      border: 'border-yellow-300 border-2',
      hover: 'hover:bg-gray-900',
      focus: 'focus:ring-4 focus:ring-yellow-400',
      button: 'bg-yellow-300 hover:bg-yellow-400',
      buttonText: 'text-black font-bold',
      link: 'text-yellow-300 underline hover:text-yellow-200 font-semibold'
    }
  }
};

/**
 * High Contrast Provider Component
 */
export const HighContrastProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState('normal');
  const [isEnabled, setIsEnabled] = useState(false);
  
  // Check system preference for high contrast
  useEffect(() => {
    // Check for prefers-contrast media query
    const checkHighContrast = () => {
      if (window.matchMedia('(prefers-contrast: high)').matches) {
        setIsEnabled(true);
        setCurrentTheme('highContrast');
      } else if (window.matchMedia('(prefers-contrast: low)').matches) {
        setIsEnabled(false);
        setCurrentTheme('normal');
      }
    };
    
    // Check for Windows high contrast mode
    const checkWindowsHighContrast = () => {
      const testElement = document.createElement('div');
      testElement.style.backgroundColor = 'rgb(255, 0, 0)';
      document.body.appendChild(testElement);
      const computedStyle = window.getComputedStyle(testElement);
      const isHighContrast = computedStyle.backgroundColor !== 'rgb(255, 0, 0)';
      document.body.removeChild(testElement);
      
      if (isHighContrast) {
        setIsEnabled(true);
        setCurrentTheme('highContrast');
      }
    };
    
    // Check local storage for user preference
    const savedTheme = localStorage.getItem('highContrastTheme');
    const savedEnabled = localStorage.getItem('highContrastEnabled');
    
    if (savedTheme && savedEnabled) {
      setCurrentTheme(savedTheme);
      setIsEnabled(savedEnabled === 'true');
    } else {
      checkHighContrast();
      checkWindowsHighContrast();
    }
    
    // Listen for changes in system preference
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    const handleChange = (e) => {
      if (e.matches) {
        setIsEnabled(true);
        setCurrentTheme('highContrast');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);
  
  // Apply theme to document
  useEffect(() => {
    const theme = isEnabled ? themes[currentTheme] : themes.normal;
    
    // Apply CSS variables for the theme
    const root = document.documentElement;
    
    if (isEnabled) {
      root.classList.add('high-contrast');
      root.setAttribute('data-contrast-theme', currentTheme);
      
      // Apply custom CSS properties
      root.style.setProperty('--hc-border-width', currentTheme === 'normal' ? '1px' : '2px');
      root.style.setProperty('--hc-focus-width', currentTheme === 'normal' ? '2px' : '4px');
      root.style.setProperty('--hc-font-weight', currentTheme === 'normal' ? '400' : '600');
    } else {
      root.classList.remove('high-contrast');
      root.removeAttribute('data-contrast-theme');
      
      // Reset CSS properties
      root.style.removeProperty('--hc-border-width');
      root.style.removeProperty('--hc-focus-width');
      root.style.removeProperty('--hc-font-weight');
    }
    
    // Save preference to local storage
    localStorage.setItem('highContrastTheme', currentTheme);
    localStorage.setItem('highContrastEnabled', isEnabled.toString());
  }, [currentTheme, isEnabled]);
  
  const toggleHighContrast = () => {
    setIsEnabled(!isEnabled);
    if (!isEnabled) {
      setCurrentTheme('highContrast');
    }
  };
  
  const selectTheme = (themeName) => {
    setCurrentTheme(themeName);
    setIsEnabled(true);
  };
  
  const getThemeClasses = (elementType) => {
    const theme = isEnabled ? themes[currentTheme] : themes.normal;
    return theme.colors[elementType] || '';
  };
  
  const value = {
    isEnabled,
    currentTheme,
    themes,
    toggleHighContrast,
    selectTheme,
    getThemeClasses,
    theme: isEnabled ? themes[currentTheme] : themes.normal
  };
  
  return (
    <HighContrastContext.Provider value={value}>
      {children}
    </HighContrastContext.Provider>
  );
};

/**
 * Hook to use high contrast context
 */
export const useHighContrast = () => {
  const context = useContext(HighContrastContext);
  if (!context) {
    throw new Error('useHighContrast must be used within HighContrastProvider');
  }
  return context;
};

/**
 * High Contrast Toggle Component
 */
export const HighContrastToggle = ({ showLabel = true, position = 'fixed' }) => {
  const { isEnabled, toggleHighContrast, getThemeClasses } = useHighContrast();
  
  const positionClasses = {
    fixed: 'fixed bottom-4 right-4 z-40',
    relative: 'relative',
    absolute: 'absolute bottom-4 right-4'
  };
  
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleHighContrast}
      className={`
        ${positionClasses[position]}
        flex items-center gap-2 px-4 py-2 rounded-lg
        ${getThemeClasses('button')}
        ${getThemeClasses('buttonText')}
        ${getThemeClasses('focus')}
        shadow-lg transition-all duration-200
        focus:outline-none
      `}
      aria-label={`${isEnabled ? 'Disable' : 'Enable'} high contrast mode`}
      aria-pressed={isEnabled}
    >
      {isEnabled ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      {showLabel && (
        <span className="font-medium">
          {isEnabled ? 'Normal View' : 'High Contrast'}
        </span>
      )}
    </motion.button>
  );
};

/**
 * High Contrast Theme Selector
 */
export const HighContrastThemeSelector = ({ className = '' }) => {
  const { currentTheme, selectTheme, isEnabled, getThemeClasses } = useHighContrast();
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg
          ${getThemeClasses('border')}
          ${getThemeClasses('background')}
          ${getThemeClasses('foreground')}
          ${getThemeClasses('hover')}
          ${getThemeClasses('focus')}
          transition-all duration-200
          focus:outline-none
        `}
        aria-label="Select high contrast theme"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Contrast className="w-5 h-5" />
        <span className="font-medium">
          {themes[currentTheme].name}
        </span>
      </button>
      
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`
            absolute top-full mt-2 w-full min-w-[200px]
            rounded-lg shadow-lg overflow-hidden
            ${getThemeClasses('background')}
            ${getThemeClasses('border')}
            z-50
          `}
          role="listbox"
          aria-label="High contrast themes"
        >
          {Object.entries(themes).map(([key, theme]) => (
            <button
              key={key}
              onClick={() => {
                selectTheme(key);
                setIsOpen(false);
              }}
              className={`
                w-full px-4 py-3 text-left
                ${getThemeClasses('foreground')}
                ${getThemeClasses('hover')}
                ${currentTheme === key ? getThemeClasses('primary') : ''}
                transition-colors duration-200
                focus:outline-none
                ${getThemeClasses('focus')}
              `}
              role="option"
              aria-selected={currentTheme === key}
            >
              <div className="font-medium">{theme.name}</div>
              {currentTheme === key && (
                <div className="text-sm mt-1">Currently selected</div>
              )}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
};

/**
 * High Contrast Wrapper Component
 * Wraps content with appropriate high contrast classes
 */
export const HighContrastWrapper = ({ children, elementType = 'background' }) => {
  const { getThemeClasses } = useHighContrast();
  
  return (
    <div className={getThemeClasses(elementType)}>
      {children}
    </div>
  );
};

export default HighContrastProvider;
