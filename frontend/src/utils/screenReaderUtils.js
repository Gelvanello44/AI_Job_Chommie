/**
 * Screen Reader Utilities
 * Provides comprehensive support for screen readers and assistive technologies
 */

import { useEffect, useRef, useState } from 'react';

/**
 * Live Region Manager for dynamic announcements
 */
class LiveRegionManager {
  constructor() {
    this.liveRegion = null;
    this.announcementQueue = [];
    this.isProcessing = false;
    this.initializeLiveRegion();
  }

  initializeLiveRegion() {
    if (typeof document === 'undefined') return;

    // Create live region container
    this.liveRegion = document.createElement('div');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.setAttribute('role', 'status');
    this.liveRegion.className = 'sr-only';
    
    // SR-only styles
    this.liveRegion.style.position = 'absolute';
    this.liveRegion.style.left = '-10000px';
    this.liveRegion.style.width = '1px';
    this.liveRegion.style.height = '1px';
    this.liveRegion.style.overflow = 'hidden';
    
    document.body.appendChild(this.liveRegion);

    // Create assertive region for urgent announcements
    this.assertiveRegion = document.createElement('div');
    this.assertiveRegion.setAttribute('aria-live', 'assertive');
    this.assertiveRegion.setAttribute('aria-atomic', 'true');
    this.assertiveRegion.setAttribute('role', 'alert');
    this.assertiveRegion.className = 'sr-only';
    Object.assign(this.assertiveRegion.style, this.liveRegion.style);
    
    document.body.appendChild(this.assertiveRegion);
  }

  announce(message, priority = 'polite', delay = 100) {
    if (!message) return;

    this.announcementQueue.push({ message, priority, delay });
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.announcementQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const { message, priority, delay } = this.announcementQueue.shift();
    
    const region = priority === 'assertive' ? this.assertiveRegion : this.liveRegion;
    
    // Clear previous message
    region.textContent = '';
    
    // Wait a tick for screen reader to detect change
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Announce new message
    region.textContent = message;
    
    // Clear after announcement
    setTimeout(() => {
      region.textContent = '';
      this.processQueue();
    }, 1000);
  }

  destroy() {
    if (this.liveRegion?.parentNode) {
      this.liveRegion.parentNode.removeChild(this.liveRegion);
    }
    if (this.assertiveRegion?.parentNode) {
      this.assertiveRegion.parentNode.removeChild(this.assertiveRegion);
    }
  }
}

// Singleton instance
let liveRegionManager = null;

/**
 * Get or create live region manager instance
 */
export const getLiveRegionManager = () => {
  if (!liveRegionManager) {
    liveRegionManager = new LiveRegionManager();
  }
  return liveRegionManager;
};

/**
 * Announce message to screen readers
 */
export const announce = (message, priority = 'polite', delay = 100) => {
  const manager = getLiveRegionManager();
  manager.announce(message, priority, delay);
};

/**
 * Hook for announcing dynamic content changes
 */
export const useAnnounce = () => {
  const announceRef = useRef(announce);
  
  useEffect(() => {
    return () => {
      // Cleanup if needed
    };
  }, []);
  
  return announceRef.current;
};

/**
 * Hook for announcing page changes
 */
export const usePageAnnounce = (title, loading = false) => {
  const announceMessage = useAnnounce();
  
  useEffect(() => {
    if (loading) {
      announceMessage(`Loading ${title}`, 'polite');
    } else {
      announceMessage(`${title} page loaded`, 'polite');
    }
  }, [title, loading, announceMessage]);
};

/**
 * Hook for announcing form validation errors
 */
export const useErrorAnnounce = (errors) => {
  const announceMessage = useAnnounce();
  const previousErrors = useRef([]);
  
  useEffect(() => {
    const newErrors = errors.filter(
      error => !previousErrors.current.includes(error)
    );
    
    if (newErrors.length > 0) {
      const message = `${newErrors.length} error${newErrors.length > 1 ? 's' : ''}: ${newErrors.join(', ')}`;
      announceMessage(message, 'assertive');
    }
    
    previousErrors.current = errors;
  }, [errors, announceMessage]);
};

/**
 * Hook for announcing loading states
 */
export const useLoadingAnnounce = (isLoading, loadingMessage = 'Loading', completeMessage = 'Loading complete') => {
  const announceMessage = useAnnounce();
  const wasLoading = useRef(false);
  
  useEffect(() => {
    if (isLoading && !wasLoading.current) {
      announceMessage(loadingMessage, 'polite');
    } else if (!isLoading && wasLoading.current) {
      announceMessage(completeMessage, 'polite');
    }
    
    wasLoading.current = isLoading;
  }, [isLoading, loadingMessage, completeMessage, announceMessage]);
};

/**
 * Hook for announcing notifications
 */
export const useNotificationAnnounce = (notification) => {
  const announceMessage = useAnnounce();
  
  useEffect(() => {
    if (notification) {
      const priority = notification.type === 'error' ? 'assertive' : 'polite';
      announceMessage(notification.message, priority);
    }
  }, [notification, announceMessage]);
};

/**
 * Generate descriptive label for interactive elements
 */
export const generateAriaLabel = (action, target, context = '') => {
  const contextStr = context ? `, ${context}` : '';
  return `${action} ${target}${contextStr}`;
};

/**
 * Create skip navigation links
 */
export const SkipNavigation = ({ links = [] }) => {
  const defaultLinks = [
    { href: '#main-content', label: 'Skip to main content' },
    { href: '#navigation', label: 'Skip to navigation' },
    { href: '#search', label: 'Skip to search' }
  ];
  
  const skipLinks = links.length > 0 ? links : defaultLinks;
  
  return (
    <div className="skip-navigation">
      {skipLinks.map((link, index) => (
        <a
          key={index}
          href={link.href}
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-cyan-500 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
};

/**
 * Screen reader only text component
 */
export const ScreenReaderOnly = ({ children, as: Component = 'span' }) => {
  return (
    <Component className="sr-only">
      {children}
    </Component>
  );
};

/**
 * Visually hidden but accessible component
 */
export const VisuallyHidden = ({ children, focusable = false }) => {
  const className = focusable 
    ? 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4'
    : 'sr-only';
  
  return (
    <span className={className}>
      {children}
    </span>
  );
};

/**
 * ARIA label generator for complex components
 */
export const generateComplexLabel = (component, state = {}) => {
  const labels = {
    jobCard: (job) => `Job listing: ${job.title} at ${job.company}. ${job.location}. ${job.salary}. ${state.saved ? 'Saved' : 'Not saved'}`,
    
    notification: (notif) => `${notif.type} notification: ${notif.message}`,
    
    modal: (title, isOpen) => `${title} dialog ${isOpen ? 'opened' : 'closed'}`,
    
    accordion: (title, isExpanded) => `${title} section ${isExpanded ? 'expanded' : 'collapsed'}. Press Enter to ${isExpanded ? 'collapse' : 'expand'}`,
    
    progressBar: (value, max) => `Progress: ${Math.round((value / max) * 100)}% complete`,
    
    pagination: (current, total) => `Page ${current} of ${total}`,
    
    sortButton: (field, direction) => `Sort by ${field} ${direction === 'asc' ? 'ascending' : 'descending'}. Press Enter to change sort order`,
    
    filterCheckbox: (label, checked, count) => `${label} filter ${checked ? 'selected' : 'not selected'}. ${count} items match`,
    
    searchResults: (count, query) => count === 0 
      ? `No results found for "${query}"`
      : `${count} result${count !== 1 ? 's' : ''} found for "${query}"`
  };
  
  const labelFunction = labels[component];
  return labelFunction ? labelFunction(...arguments.slice(1)) : '';
};

/**
 * Hook for managing ARIA descriptions
 */
export const useAriaDescriptions = () => {
  const [descriptions, setDescriptions] = useState({});
  
  const addDescription = (id, text) => {
    setDescriptions(prev => ({ ...prev, [id]: text }));
  };
  
  const removeDescription = (id) => {
    setDescriptions(prev => {
      const newDesc = { ...prev };
      delete newDesc[id];
      return newDesc;
    });
  };
  
  const getDescriptionProps = (id) => {
    return descriptions[id] 
      ? { 'aria-describedby': `desc-${id}` }
      : {};
  };
  
  return { descriptions, addDescription, removeDescription, getDescriptionProps };
};

/**
 * Create landmark regions
 */
export const createLandmarkProps = (role, label) => {
  const props = { role };
  
  if (label) {
    props['aria-label'] = label;
  }
  
  return props;
};

/**
 * Landmark region components
 */
export const landmarks = {
  main: (label) => createLandmarkProps('main', label),
  navigation: (label) => createLandmarkProps('navigation', label),
  search: (label) => createLandmarkProps('search', label),
  banner: (label) => createLandmarkProps('banner', label),
  contentinfo: (label) => createLandmarkProps('contentinfo', label),
  complementary: (label) => createLandmarkProps('complementary', label),
  region: (label) => createLandmarkProps('region', label)
};

/**
 * Generate table accessibility attributes
 */
export const generateTableA11y = (caption, summary) => {
  const props = {};
  
  if (caption) {
    props['aria-label'] = caption;
  }
  
  if (summary) {
    props['aria-describedby'] = 'table-summary';
  }
  
  return props;
};

/**
 * Format time for screen readers
 */
export const formatTimeForScreenReader = (date, relative = true) => {
  const absoluteTime = new Date(date).toLocaleString();
  
  if (!relative) return absoluteTime;
  
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  let relativeTime;
  if (days > 0) {
    relativeTime = `${days} day${days !== 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    relativeTime = `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    relativeTime = `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else {
    relativeTime = 'just now';
  }
  
  return `${relativeTime}, ${absoluteTime}`;
};

export default {
  announce,
  useAnnounce,
  usePageAnnounce,
  useErrorAnnounce,
  useLoadingAnnounce,
  useNotificationAnnounce,
  generateAriaLabel,
  generateComplexLabel,
  SkipNavigation,
  ScreenReaderOnly,
  VisuallyHidden,
  useAriaDescriptions,
  landmarks,
  generateTableA11y,
  formatTimeForScreenReader
};
