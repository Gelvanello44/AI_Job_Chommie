/**
 * Keyboard Navigation Utilities
 * Provides comprehensive keyboard navigation support
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Key codes and key names mapping
 */
export const KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
  DELETE: 'Delete',
  BACKSPACE: 'Backspace'
};

/**
 * Check if key event matches specific key
 */
export const isKey = (event, key) => {
  return event.key === key || event.code === key;
};

/**
 * Check if key event has modifier keys
 */
export const hasModifier = (event) => {
  return event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
};

/**
 * Hook for keyboard shortcuts
 */
export const useKeyboardShortcut = (shortcuts) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      shortcuts.forEach(({ key, ctrl, alt, shift, meta, handler, preventDefault = true }) => {
        const matchesKey = isKey(event, key);
        const matchesCtrl = ctrl ? event.ctrlKey : !event.ctrlKey;
        const matchesAlt = alt ? event.altKey : !event.altKey;
        const matchesShift = shift ? event.shiftKey : !event.shiftKey;
        const matchesMeta = meta ? event.metaKey : !event.metaKey;
        
        if (matchesKey && matchesCtrl && matchesAlt && matchesShift && matchesMeta) {
          if (preventDefault) {
            event.preventDefault();
          }
          handler(event);
        }
      });
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
};

/**
 * Hook for arrow key navigation
 */
export const useArrowKeyNavigation = (items, options = {}) => {
  const {
    orientation = 'vertical',
    loop = true,
    onSelect,
    onNavigate,
    initialIndex = 0
  } = options;
  
  const [focusedIndex, setFocusedIndex] = useState(initialIndex);
  const itemRefs = useRef([]);
  
  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, items.length);
  }, [items]);
  
  const handleKeyDown = useCallback((event) => {
    const isVertical = orientation === 'vertical';
    const nextKey = isVertical ? KEYS.ARROW_DOWN : KEYS.ARROW_RIGHT;
    const prevKey = isVertical ? KEYS.ARROW_UP : KEYS.ARROW_LEFT;
    
    let newIndex = focusedIndex;
    
    if (isKey(event, nextKey)) {
      event.preventDefault();
      newIndex = focusedIndex + 1;
      if (newIndex >= items.length) {
        newIndex = loop ? 0 : items.length - 1;
      }
    } else if (isKey(event, prevKey)) {
      event.preventDefault();
      newIndex = focusedIndex - 1;
      if (newIndex < 0) {
        newIndex = loop ? items.length - 1 : 0;
      }
    } else if (isKey(event, KEYS.HOME)) {
      event.preventDefault();
      newIndex = 0;
    } else if (isKey(event, KEYS.END)) {
      event.preventDefault();
      newIndex = items.length - 1;
    } else if (isKey(event, KEYS.ENTER) || isKey(event, KEYS.SPACE)) {
      event.preventDefault();
      if (onSelect) {
        onSelect(focusedIndex, items[focusedIndex]);
      }
      return;
    }
    
    if (newIndex !== focusedIndex) {
      setFocusedIndex(newIndex);
      itemRefs.current[newIndex]?.focus();
      
      if (onNavigate) {
        onNavigate(newIndex, items[newIndex]);
      }
    }
  }, [focusedIndex, items, orientation, loop, onSelect, onNavigate]);
  
  const registerItem = (index) => (el) => {
    itemRefs.current[index] = el;
  };
  
  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    registerItem,
    itemProps: (index) => ({
      ref: registerItem(index),
      tabIndex: focusedIndex === index ? 0 : -1,
      onKeyDown: handleKeyDown,
      'aria-selected': focusedIndex === index
    })
  };
};

/**
 * Hook for roving tabindex pattern
 */
export const useRovingTabIndex = (items, options = {}) => {
  const { initialIndex = 0, onFocus } = options;
  const [focusedIndex, setFocusedIndex] = useState(initialIndex);
  
  const handleItemFocus = useCallback((index) => {
    setFocusedIndex(index);
    if (onFocus) {
      onFocus(index, items[index]);
    }
  }, [items, onFocus]);
  
  const getRovingProps = (index) => ({
    tabIndex: focusedIndex === index ? 0 : -1,
    onFocus: () => handleItemFocus(index)
  });
  
  return {
    focusedIndex,
    setFocusedIndex,
    getRovingProps
  };
};

/**
 * Hook for focus trap (for modals, dropdowns, etc.)
 */
export const useFocusTrap = (active = true) => {
  const containerRef = useRef(null);
  const previousFocusRef = useRef(null);
  
  useEffect(() => {
    if (!active || !containerRef.current) return;
    
    // Store previous focus
    previousFocusRef.current = document.activeElement;
    
    // Get all focusable elements
    const getFocusableElements = () => {
      const selector = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'textarea:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
      ].join(',');
      
      return Array.from(containerRef.current.querySelectorAll(selector));
    };
    
    // Focus first element
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
    
    // Handle tab key
    const handleKeyDown = (event) => {
      if (!isKey(event, KEYS.TAB)) return;
      
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;
      
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      
      // Restore previous focus
      if (previousFocusRef.current && previousFocusRef.current.focus) {
        previousFocusRef.current.focus();
      }
    };
  }, [active]);
  
  return containerRef;
};

/**
 * Hook for skip links
 */
export const useSkipLinks = () => {
  const [isVisible, setIsVisible] = useState(false);
  
  const handleFocus = () => setIsVisible(true);
  const handleBlur = () => setIsVisible(false);
  
  return {
    isVisible,
    skipLinkProps: {
      onFocus: handleFocus,
      onBlur: handleBlur,
      className: isVisible ? 'skip-link-visible' : 'skip-link-hidden'
    }
  };
};

/**
 * Hook for managing focus on mount/unmount
 */
export const useFocusOnMount = (shouldFocus = true, delay = 0) => {
  const elementRef = useRef(null);
  
  useEffect(() => {
    if (!shouldFocus || !elementRef.current) return;
    
    const timeoutId = setTimeout(() => {
      elementRef.current?.focus();
    }, delay);
    
    return () => clearTimeout(timeoutId);
  }, [shouldFocus, delay]);
  
  return elementRef;
};

/**
 * Hook for focus restoration
 */
export const useFocusRestoration = () => {
  const previousFocusRef = useRef(null);
  
  const saveFocus = () => {
    previousFocusRef.current = document.activeElement;
  };
  
  const restoreFocus = () => {
    if (previousFocusRef.current && previousFocusRef.current.focus) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  };
  
  return { saveFocus, restoreFocus };
};

/**
 * Hook for keyboard-only focus styles
 */
export const useKeyboardFocus = () => {
  const [isKeyboardFocus, setIsKeyboardFocus] = useState(false);
  const lastInteractionRef = useRef('mouse');
  
  useEffect(() => {
    const handleMouseDown = () => {
      lastInteractionRef.current = 'mouse';
    };
    
    const handleKeyDown = (event) => {
      if (isKey(event, KEYS.TAB)) {
        lastInteractionRef.current = 'keyboard';
      }
    };
    
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  const handleFocus = () => {
    setIsKeyboardFocus(lastInteractionRef.current === 'keyboard');
  };
  
  const handleBlur = () => {
    setIsKeyboardFocus(false);
  };
  
  return {
    isKeyboardFocus,
    keyboardFocusProps: {
      onFocus: handleFocus,
      onBlur: handleBlur,
      'data-keyboard-focus': isKeyboardFocus
    }
  };
};

/**
 * Hook for grid navigation (2D arrow key navigation)
 */
export const useGridNavigation = (rows, cols, options = {}) => {
  const { loop = true, onNavigate, onSelect, initialPosition = [0, 0] } = options;
  const [position, setPosition] = useState(initialPosition);
  const [row, col] = position;
  
  const handleKeyDown = useCallback((event) => {
    let newRow = row;
    let newCol = col;
    
    if (isKey(event, KEYS.ARROW_UP)) {
      event.preventDefault();
      newRow = row - 1;
      if (newRow < 0) {
        newRow = loop ? rows - 1 : 0;
      }
    } else if (isKey(event, KEYS.ARROW_DOWN)) {
      event.preventDefault();
      newRow = row + 1;
      if (newRow >= rows) {
        newRow = loop ? 0 : rows - 1;
      }
    } else if (isKey(event, KEYS.ARROW_LEFT)) {
      event.preventDefault();
      newCol = col - 1;
      if (newCol < 0) {
        newCol = loop ? cols - 1 : 0;
      }
    } else if (isKey(event, KEYS.ARROW_RIGHT)) {
      event.preventDefault();
      newCol = col + 1;
      if (newCol >= cols) {
        newCol = loop ? 0 : cols - 1;
      }
    } else if (isKey(event, KEYS.HOME)) {
      event.preventDefault();
      if (event.ctrlKey) {
        newRow = 0;
        newCol = 0;
      } else {
        newCol = 0;
      }
    } else if (isKey(event, KEYS.END)) {
      event.preventDefault();
      if (event.ctrlKey) {
        newRow = rows - 1;
        newCol = cols - 1;
      } else {
        newCol = cols - 1;
      }
    } else if (isKey(event, KEYS.ENTER) || isKey(event, KEYS.SPACE)) {
      event.preventDefault();
      if (onSelect) {
        onSelect([row, col]);
      }
      return;
    }
    
    if (newRow !== row || newCol !== col) {
      setPosition([newRow, newCol]);
      if (onNavigate) {
        onNavigate([newRow, newCol]);
      }
    }
  }, [row, col, rows, cols, loop, onNavigate, onSelect]);
  
  return {
    position,
    setPosition,
    handleKeyDown,
    getCellProps: (cellRow, cellCol) => ({
      tabIndex: row === cellRow && col === cellCol ? 0 : -1,
      'aria-selected': row === cellRow && col === cellCol,
      onKeyDown: handleKeyDown
    })
  };
};

/**
 * Hook for combobox keyboard navigation
 */
export const useComboboxKeyboard = (items, options = {}) => {
  const {
    isOpen,
    onSelect,
    onOpen,
    onClose,
    onNavigate,
    initialIndex = -1
  } = options;
  
  const [highlightedIndex, setHighlightedIndex] = useState(initialIndex);
  
  const handleKeyDown = useCallback((event) => {
    if (!isOpen && (isKey(event, KEYS.ARROW_DOWN) || isKey(event, KEYS.ARROW_UP))) {
      event.preventDefault();
      if (onOpen) onOpen();
      setHighlightedIndex(0);
      return;
    }
    
    if (!isOpen) return;
    
    if (isKey(event, KEYS.ESCAPE)) {
      event.preventDefault();
      if (onClose) onClose();
      setHighlightedIndex(-1);
    } else if (isKey(event, KEYS.ARROW_DOWN)) {
      event.preventDefault();
      const newIndex = highlightedIndex + 1;
      if (newIndex < items.length) {
        setHighlightedIndex(newIndex);
        if (onNavigate) onNavigate(newIndex);
      }
    } else if (isKey(event, KEYS.ARROW_UP)) {
      event.preventDefault();
      const newIndex = highlightedIndex - 1;
      if (newIndex >= 0) {
        setHighlightedIndex(newIndex);
        if (onNavigate) onNavigate(newIndex);
      }
    } else if (isKey(event, KEYS.ENTER)) {
      event.preventDefault();
      if (highlightedIndex >= 0 && onSelect) {
        onSelect(items[highlightedIndex], highlightedIndex);
      }
    } else if (isKey(event, KEYS.HOME)) {
      event.preventDefault();
      setHighlightedIndex(0);
      if (onNavigate) onNavigate(0);
    } else if (isKey(event, KEYS.END)) {
      event.preventDefault();
      const lastIndex = items.length - 1;
      setHighlightedIndex(lastIndex);
      if (onNavigate) onNavigate(lastIndex);
    }
  }, [isOpen, items, highlightedIndex, onSelect, onOpen, onClose, onNavigate]);
  
  return {
    highlightedIndex,
    setHighlightedIndex,
    handleKeyDown,
    getItemProps: (index) => ({
      'aria-selected': highlightedIndex === index,
      'data-highlighted': highlightedIndex === index
    })
  };
};

export default {
  KEYS,
  isKey,
  hasModifier,
  useKeyboardShortcut,
  useArrowKeyNavigation,
  useRovingTabIndex,
  useFocusTrap,
  useSkipLinks,
  useFocusOnMount,
  useFocusRestoration,
  useKeyboardFocus,
  useGridNavigation,
  useComboboxKeyboard
};
