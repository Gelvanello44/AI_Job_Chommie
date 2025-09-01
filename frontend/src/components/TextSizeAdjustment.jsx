/**
 * Text Size Adjustment Component
 * Provides dynamic font sizing for better accessibility
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Type, Plus, Minus, RotateCcw } from 'lucide-react';
import { useAnnounce } from '../utils/screenReaderUtils';

/**
 * Text Size Context
 */
const TextSizeContext = createContext();

/**
 * Font size scale definitions
 */
const fontScales = {
  xs: {
    name: 'Extra Small',
    scale: 0.85,
    lineHeight: 1.4,
    letterSpacing: '-0.01em'
  },
  sm: {
    name: 'Small',
    scale: 0.9,
    lineHeight: 1.5,
    letterSpacing: '0'
  },
  base: {
    name: 'Default',
    scale: 1,
    lineHeight: 1.6,
    letterSpacing: '0'
  },
  lg: {
    name: 'Large',
    scale: 1.125,
    lineHeight: 1.7,
    letterSpacing: '0.01em'
  },
  xl: {
    name: 'Extra Large',
    scale: 1.25,
    lineHeight: 1.8,
    letterSpacing: '0.02em'
  },
  '2xl': {
    name: 'Huge',
    scale: 1.5,
    lineHeight: 1.9,
    letterSpacing: '0.03em'
  },
  '3xl': {
    name: 'Maximum',
    scale: 1.75,
    lineHeight: 2,
    letterSpacing: '0.04em'
  }
};

/**
 * Element-specific scale multipliers
 */
const elementMultipliers = {
  h1: 2.5,
  h2: 2,
  h3: 1.75,
  h4: 1.5,
  h5: 1.25,
  h6: 1.1,
  p: 1,
  span: 1,
  div: 1,
  small: 0.875,
  button: 1,
  input: 1,
  label: 1,
  a: 1,
  li: 1,
  td: 1,
  th: 1.1
};

/**
 * Text Size Provider Component
 */
export const TextSizeProvider = ({ children, defaultSize = 'base' }) => {
  const [currentSize, setCurrentSize] = useState(defaultSize);
  const [isAutoAdjust, setIsAutoAdjust] = useState(true);
  const announce = useAnnounce();
  
  // Check system and browser preferences
  useEffect(() => {
    // Check local storage for saved preference
    const savedSize = localStorage.getItem('textSize');
    const savedAutoAdjust = localStorage.getItem('textSizeAutoAdjust');
    
    if (savedSize && fontScales[savedSize]) {
      setCurrentSize(savedSize);
    }
    
    if (savedAutoAdjust !== null) {
      setIsAutoAdjust(savedAutoAdjust === 'true');
    }
    
    // Check browser zoom level (approximate)
    const checkZoomLevel = () => {
      const zoom = Math.round((window.devicePixelRatio * 100));
      
      if (zoom >= 150) {
        return 'xl';
      } else if (zoom >= 125) {
        return 'lg';
      } else if (zoom <= 75) {
        return 'sm';
      }
      return 'base';
    };
    
    // Check system font size preference
    const checkSystemFontSize = () => {
      const baseFontSize = parseFloat(
        window.getComputedStyle(document.documentElement).fontSize
      );
      
      if (baseFontSize > 20) {
        return 'xl';
      } else if (baseFontSize > 18) {
        return 'lg';
      } else if (baseFontSize < 14) {
        return 'sm';
      }
      return 'base';
    };
    
    if (isAutoAdjust && !savedSize) {
      const zoomSize = checkZoomLevel();
      const systemSize = checkSystemFontSize();
      
      // Use the larger of the two
      const sizes = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'];
      const zoomIndex = sizes.indexOf(zoomSize);
      const systemIndex = sizes.indexOf(systemSize);
      
      setCurrentSize(sizes[Math.max(zoomIndex, systemIndex)]);
    }
    
    // Listen for zoom changes
    const handleResize = () => {
      if (isAutoAdjust) {
        const newSize = checkZoomLevel();
        if (newSize !== currentSize) {
          setCurrentSize(newSize);
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isAutoAdjust]);
  
  // Apply font size to document
  useEffect(() => {
    const scale = fontScales[currentSize];
    const root = document.documentElement;
    
    // Set CSS variables
    root.style.setProperty('--text-scale', scale.scale.toString());
    root.style.setProperty('--text-line-height', scale.lineHeight.toString());
    root.style.setProperty('--text-letter-spacing', scale.letterSpacing);
    
    // Apply base font size
    root.style.fontSize = `${16 * scale.scale}px`;
    
    // Apply to specific elements
    Object.entries(elementMultipliers).forEach(([element, multiplier]) => {
      const elements = document.querySelectorAll(element);
      elements.forEach(el => {
        if (!el.hasAttribute('data-no-resize')) {
          const baseSize = 16 * scale.scale * multiplier;
          el.style.fontSize = `${baseSize}px`;
          el.style.lineHeight = scale.lineHeight.toString();
          el.style.letterSpacing = scale.letterSpacing;
        }
      });
    });
    
    // Save preference
    localStorage.setItem('textSize', currentSize);
    localStorage.setItem('textSizeAutoAdjust', isAutoAdjust.toString());
    
    // Announce change
    announce(`Text size changed to ${fontScales[currentSize].name}`, 'polite');
  }, [currentSize, announce]);
  
  const increaseSize = () => {
    const sizes = Object.keys(fontScales);
    const currentIndex = sizes.indexOf(currentSize);
    if (currentIndex < sizes.length - 1) {
      setCurrentSize(sizes[currentIndex + 1]);
    }
  };
  
  const decreaseSize = () => {
    const sizes = Object.keys(fontScales);
    const currentIndex = sizes.indexOf(currentSize);
    if (currentIndex > 0) {
      setCurrentSize(sizes[currentIndex - 1]);
    }
  };
  
  const resetSize = () => {
    setCurrentSize('base');
  };
  
  const setSize = (size) => {
    if (fontScales[size]) {
      setCurrentSize(size);
      setIsAutoAdjust(false);
    }
  };
  
  const toggleAutoAdjust = () => {
    setIsAutoAdjust(!isAutoAdjust);
  };
  
  const getFontSizeClass = (element = 'p') => {
    const scale = fontScales[currentSize].scale;
    const multiplier = elementMultipliers[element] || 1;
    const size = scale * multiplier;
    
    // Return Tailwind-like class based on calculated size
    if (size <= 0.875) return 'text-sm';
    if (size <= 1) return 'text-base';
    if (size <= 1.125) return 'text-lg';
    if (size <= 1.25) return 'text-xl';
    if (size <= 1.5) return 'text-2xl';
    if (size <= 1.875) return 'text-3xl';
    if (size <= 2.25) return 'text-4xl';
    return 'text-5xl';
  };
  
  const value = {
    currentSize,
    fontScale: fontScales[currentSize],
    isAutoAdjust,
    increaseSize,
    decreaseSize,
    resetSize,
    setSize,
    toggleAutoAdjust,
    getFontSizeClass,
    canIncrease: Object.keys(fontScales).indexOf(currentSize) < Object.keys(fontScales).length - 1,
    canDecrease: Object.keys(fontScales).indexOf(currentSize) > 0
  };
  
  return (
    <TextSizeContext.Provider value={value}>
      {children}
    </TextSizeContext.Provider>
  );
};

/**
 * Hook to use text size context
 */
export const useTextSize = () => {
  const context = useContext(TextSizeContext);
  if (!context) {
    throw new Error('useTextSize must be used within TextSizeProvider');
  }
  return context;
};

/**
 * Text Size Controls Component
 */
export const TextSizeControls = ({ 
  showLabel = true, 
  position = 'inline',
  compact = false 
}) => {
  const {
    currentSize,
    increaseSize,
    decreaseSize,
    resetSize,
    canIncrease,
    canDecrease,
    fontScale
  } = useTextSize();
  
  const positionClasses = {
    fixed: 'fixed bottom-20 right-4 z-40',
    inline: 'inline-flex',
    absolute: 'absolute bottom-4 left-4'
  };
  
  if (compact) {
    return (
      <div className={`${positionClasses[position]} flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-1`}>
        <button
          onClick={decreaseSize}
          disabled={!canDecrease}
          className={`
            p-2 rounded transition-colors
            ${canDecrease 
              ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300' 
              : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }
            focus:outline-none focus:ring-2 focus:ring-cyan-500
          `}
          aria-label="Decrease text size"
          aria-disabled={!canDecrease}
        >
          <Minus className="w-4 h-4" />
        </button>
        
        <button
          onClick={resetSize}
          className="px-2 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
          aria-label="Reset text size to default"
        >
          {Math.round(fontScale.scale * 100)}%
        </button>
        
        <button
          onClick={increaseSize}
          disabled={!canIncrease}
          className={`
            p-2 rounded transition-colors
            ${canIncrease 
              ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300' 
              : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }
            focus:outline-none focus:ring-2 focus:ring-cyan-500
          `}
          aria-label="Increase text size"
          aria-disabled={!canIncrease}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`
        ${positionClasses[position]}
        flex items-center gap-3 px-4 py-3
        bg-white dark:bg-gray-800 rounded-lg shadow-lg
      `}
    >
      {showLabel && (
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <Type className="w-5 h-5" />
          <span className="font-medium">Text Size:</span>
        </div>
      )}
      
      <div className="flex items-center gap-2">
        <button
          onClick={decreaseSize}
          disabled={!canDecrease}
          className={`
            p-2 rounded-lg transition-all duration-200
            ${canDecrease 
              ? 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300' 
              : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }
            focus:outline-none focus:ring-2 focus:ring-cyan-500
          `}
          aria-label="Decrease text size"
          aria-disabled={!canDecrease}
        >
          <Minus className="w-5 h-5" />
        </button>
        
        <div className="min-w-[100px] text-center">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {fontScale.name}
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {Math.round(fontScale.scale * 100)}%
          </div>
        </div>
        
        <button
          onClick={increaseSize}
          disabled={!canIncrease}
          className={`
            p-2 rounded-lg transition-all duration-200
            ${canIncrease 
              ? 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300' 
              : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }
            focus:outline-none focus:ring-2 focus:ring-cyan-500
          `}
          aria-label="Increase text size"
          aria-disabled={!canIncrease}
        >
          <Plus className="w-5 h-5" />
        </button>
        
        <button
          onClick={resetSize}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 ml-2"
          aria-label="Reset text size to default"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
};

/**
 * Text Size Selector Component
 */
export const TextSizeSelector = ({ className = '' }) => {
  const { currentSize, setSize } = useTextSize();
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
        aria-label="Select text size"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Type className="w-5 h-5" />
        <span className="font-medium">{fontScales[currentSize].name}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          ({Math.round(fontScales[currentSize].scale * 100)}%)
        </span>
      </button>
      
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-full mt-2 w-full min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
          role="listbox"
          aria-label="Text size options"
        >
          {Object.entries(fontScales).map(([key, scale]) => (
            <button
              key={key}
              onClick={() => {
                setSize(key);
                setIsOpen(false);
              }}
              className={`
                w-full px-4 py-3 text-left transition-colors
                ${currentSize === key 
                  ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }
                focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500
              `}
              role="option"
              aria-selected={currentSize === key}
              style={{ fontSize: `${16 * scale.scale}px` }}
            >
              <div className="font-medium">{scale.name}</div>
              <div className="text-sm opacity-75">
                {Math.round(scale.scale * 100)}% scale
              </div>
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
};

/**
 * Responsive Text Component
 * Automatically adjusts based on text size settings
 */
export const ResponsiveText = ({ 
  as: Component = 'p', 
  children, 
  className = '',
  noResize = false 
}) => {
  const { getFontSizeClass } = useTextSize();
  
  return (
    <Component 
      className={`${!noResize ? getFontSizeClass(Component) : ''} ${className}`}
      data-no-resize={noResize}
    >
      {children}
    </Component>
  );
};

export default TextSizeProvider;
