/**
 * Accessibility Audit Component
 * Provides real-time accessibility checking and reporting
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Info,
  Eye,
  Image,
  Type,
  Keyboard,
  Monitor,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { useAnnounce } from '../utils/screenReaderUtils';

/**
 * WCAG Success Criteria
 */
const wcagCriteria = {
  perceivable: {
    name: 'Perceivable',
    icon: Eye,
    checks: [
      { id: 'alt-text', name: 'Images have alt text', level: 'A' },
      { id: 'color-contrast', name: 'Sufficient color contrast', level: 'AA' },
      { id: 'text-resize', name: 'Text can be resized', level: 'AA' },
      { id: 'media-captions', name: 'Media has captions', level: 'A' }
    ]
  },
  operable: {
    name: 'Operable',
    icon: Keyboard,
    checks: [
      { id: 'keyboard-accessible', name: 'Keyboard accessible', level: 'A' },
      { id: 'focus-visible', name: 'Focus indicators visible', level: 'AA' },
      { id: 'skip-links', name: 'Skip navigation links', level: 'A' },
      { id: 'no-keyboard-trap', name: 'No keyboard traps', level: 'A' }
    ]
  },
  understandable: {
    name: 'Understandable',
    icon: Type,
    checks: [
      { id: 'labels-present', name: 'Form labels present', level: 'A' },
      { id: 'error-messages', name: 'Clear error messages', level: 'A' },
      { id: 'language-defined', name: 'Page language defined', level: 'A' },
      { id: 'consistent-navigation', name: 'Consistent navigation', level: 'AA' }
    ]
  },
  robust: {
    name: 'Robust',
    icon: Monitor,
    checks: [
      { id: 'valid-html', name: 'Valid HTML markup', level: 'A' },
      { id: 'aria-valid', name: 'Valid ARIA attributes', level: 'A' },
      { id: 'unique-ids', name: 'Unique element IDs', level: 'A' },
      { id: 'landmark-regions', name: 'Landmark regions present', level: 'A' }
    ]
  }
};

/**
 * Accessibility Audit Class
 */
class AccessibilityAuditor {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.passes = [];
  }

  /**
   * Run full accessibility audit
   */
  async runAudit() {
    this.issues = [];
    this.warnings = [];
    this.passes = [];

    // Check images for alt text
    this.checkImages();
    
    // Check color contrast
    this.checkColorContrast();
    
    // Check keyboard accessibility
    this.checkKeyboardAccess();
    
    // Check ARIA attributes
    this.checkAriaAttributes();
    
    // Check form labels
    this.checkFormLabels();
    
    // Check headings structure
    this.checkHeadingStructure();
    
    // Check focus indicators
    this.checkFocusIndicators();
    
    // Check language attribute
    this.checkLanguageAttribute();
    
    // Check landmark regions
    this.checkLandmarkRegions();
    
    // Check duplicate IDs
    this.checkDuplicateIds();

    return {
      issues: this.issues,
      warnings: this.warnings,
      passes: this.passes,
      score: this.calculateScore()
    };
  }

  /**
   * Check images for alt text
   */
  checkImages() {
    const images = document.querySelectorAll('img');
    let hasIssue = false;
    
    images.forEach(img => {
      if (!img.hasAttribute('alt')) {
        this.issues.push({
          type: 'error',
          category: 'perceivable',
          element: img,
          message: 'Image missing alt text',
          wcag: '1.1.1',
          level: 'A',
          fix: 'Add alt="" for decorative images or descriptive alt text for informative images'
        });
        hasIssue = true;
      } else if (img.alt === '' && img.getAttribute('role') !== 'presentation') {
        this.warnings.push({
          type: 'warning',
          category: 'perceivable',
          element: img,
          message: 'Empty alt text without presentation role',
          wcag: '1.1.1',
          level: 'A',
          fix: 'Add role="presentation" for decorative images'
        });
      }
    });
    
    if (!hasIssue && images.length > 0) {
      this.passes.push({
        category: 'perceivable',
        message: 'All images have appropriate alt text',
        wcag: '1.1.1'
      });
    }
  }

  /**
   * Check color contrast
   */
  checkColorContrast() {
    // This is a simplified check - real implementation would calculate actual contrast ratios
    const textElements = document.querySelectorAll('p, span, div, a, button, h1, h2, h3, h4, h5, h6');
    let lowContrastCount = 0;
    
    textElements.forEach(el => {
      const styles = window.getComputedStyle(el);
      const color = styles.color;
      const bgColor = styles.backgroundColor;
      
      // Check if element has very light text on white or very dark text on black
      if ((color === 'rgb(255, 255, 255)' && bgColor === 'rgb(255, 255, 255)') ||
          (color === 'rgb(0, 0, 0)' && bgColor === 'rgb(0, 0, 0)')) {
        lowContrastCount++;
      }
    });
    
    if (lowContrastCount > 0) {
      this.warnings.push({
        type: 'warning',
        category: 'perceivable',
        message: `${lowContrastCount} elements may have insufficient color contrast`,
        wcag: '1.4.3',
        level: 'AA',
        fix: 'Ensure text has a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text'
      });
    } else {
      this.passes.push({
        category: 'perceivable',
        message: 'Color contrast appears sufficient',
        wcag: '1.4.3'
      });
    }
  }

  /**
   * Check keyboard accessibility
   */
  checkKeyboardAccess() {
    const interactiveElements = document.querySelectorAll(
      'a, button, input, select, textarea, [tabindex], [role="button"], [role="link"]'
    );
    
    let inaccessibleCount = 0;
    
    interactiveElements.forEach(el => {
      const tabindex = el.getAttribute('tabindex');
      
      if (tabindex && parseInt(tabindex) > 0) {
        this.warnings.push({
          type: 'warning',
          category: 'operable',
          element: el,
          message: 'Positive tabindex values should be avoided',
          wcag: '2.4.3',
          level: 'A',
          fix: 'Use tabindex="0" or "-1" instead of positive values'
        });
      }
      
      if (el.tagName === 'DIV' && el.getAttribute('onclick') && !el.getAttribute('role')) {
        this.issues.push({
          type: 'error',
          category: 'operable',
          element: el,
          message: 'Clickable div without proper role',
          wcag: '2.1.1',
          level: 'A',
          fix: 'Add role="button" and tabindex="0" to make it keyboard accessible'
        });
        inaccessibleCount++;
      }
    });
    
    if (inaccessibleCount === 0) {
      this.passes.push({
        category: 'operable',
        message: 'All interactive elements are keyboard accessible',
        wcag: '2.1.1'
      });
    }
  }

  /**
   * Check ARIA attributes
   */
  checkAriaAttributes() {
    const ariaElements = document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby], [role]');
    let invalidCount = 0;
    
    ariaElements.forEach(el => {
      // Check for invalid ARIA roles
      const role = el.getAttribute('role');
      const validRoles = ['button', 'link', 'navigation', 'main', 'search', 'form', 'img', 'presentation', 'alert', 'dialog', 'menu', 'menuitem', 'tab', 'tabpanel'];
      
      if (role && !validRoles.includes(role)) {
        this.warnings.push({
          type: 'warning',
          category: 'robust',
          element: el,
          message: `Potentially invalid ARIA role: ${role}`,
          wcag: '4.1.2',
          level: 'A',
          fix: 'Use valid ARIA roles'
        });
        invalidCount++;
      }
      
      // Check for aria-labelledby pointing to non-existent elements
      const labelledby = el.getAttribute('aria-labelledby');
      if (labelledby && !document.getElementById(labelledby)) {
        this.issues.push({
          type: 'error',
          category: 'robust',
          element: el,
          message: `aria-labelledby references non-existent element: ${labelledby}`,
          wcag: '1.3.1',
          level: 'A',
          fix: 'Ensure aria-labelledby points to existing element IDs'
        });
        invalidCount++;
      }
    });
    
    if (invalidCount === 0 && ariaElements.length > 0) {
      this.passes.push({
        category: 'robust',
        message: 'ARIA attributes are properly implemented',
        wcag: '4.1.2'
      });
    }
  }

  /**
   * Check form labels
   */
  checkFormLabels() {
    const formInputs = document.querySelectorAll('input, select, textarea');
    let unlabeledCount = 0;
    
    formInputs.forEach(input => {
      if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') return;
      
      const id = input.id;
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const hasAriaLabel = input.hasAttribute('aria-label');
      const hasAriaLabelledby = input.hasAttribute('aria-labelledby');
      const hasPlaceholder = input.hasAttribute('placeholder');
      
      if (!hasLabel && !hasAriaLabel && !hasAriaLabelledby) {
        this.issues.push({
          type: 'error',
          category: 'understandable',
          element: input,
          message: 'Form input missing label',
          wcag: '3.3.2',
          level: 'A',
          fix: 'Add a <label> element or aria-label attribute'
        });
        unlabeledCount++;
      } else if (!hasLabel && !hasAriaLabel && hasPlaceholder) {
        this.warnings.push({
          type: 'warning',
          category: 'understandable',
          element: input,
          message: 'Placeholder text should not be used as the only label',
          wcag: '3.3.2',
          level: 'A',
          fix: 'Add a proper label in addition to placeholder text'
        });
      }
    });
    
    if (unlabeledCount === 0 && formInputs.length > 0) {
      this.passes.push({
        category: 'understandable',
        message: 'All form inputs have proper labels',
        wcag: '3.3.2'
      });
    }
  }

  /**
   * Check heading structure
   */
  checkHeadingStructure() {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const headingLevels = Array.from(headings).map(h => parseInt(h.tagName[1]));
    
    // Check for multiple h1s
    const h1Count = headingLevels.filter(level => level === 1).length;
    if (h1Count > 1) {
      this.warnings.push({
        type: 'warning',
        category: 'perceivable',
        message: `Multiple H1 headings found (${h1Count})`,
        wcag: '1.3.1',
        level: 'A',
        fix: 'Use only one H1 per page'
      });
    } else if (h1Count === 0) {
      this.issues.push({
        type: 'error',
        category: 'perceivable',
        message: 'No H1 heading found',
        wcag: '1.3.1',
        level: 'A',
        fix: 'Add an H1 heading to identify the main content'
      });
    }
    
    // Check for skipped heading levels
    for (let i = 1; i < headingLevels.length; i++) {
      if (headingLevels[i] - headingLevels[i - 1] > 1) {
        this.warnings.push({
          type: 'warning',
          category: 'perceivable',
          message: `Heading level skipped: H${headingLevels[i - 1]} to H${headingLevels[i]}`,
          wcag: '1.3.1',
          level: 'A',
          fix: 'Use heading levels in sequential order'
        });
        break;
      }
    }
  }

  /**
   * Check focus indicators
   */
  checkFocusIndicators() {
    // Check if focus styles are removed
    const styleSheets = Array.from(document.styleSheets);
    let hasOutlineNone = false;
    
    try {
      styleSheets.forEach(sheet => {
        if (sheet.cssRules) {
          Array.from(sheet.cssRules).forEach(rule => {
            if (rule.style && rule.style.outline === 'none' && !rule.selectorText?.includes(':focus-visible')) {
              hasOutlineNone = true;
            }
          });
        }
      });
    } catch (e) {
      // Cross-origin stylesheets can't be accessed
    }
    
    if (hasOutlineNone) {
      this.warnings.push({
        type: 'warning',
        category: 'operable',
        message: 'Focus indicators may be removed with outline:none',
        wcag: '2.4.7',
        level: 'AA',
        fix: 'Provide visible focus indicators for all interactive elements'
      });
    } else {
      this.passes.push({
        category: 'operable',
        message: 'Focus indicators appear to be present',
        wcag: '2.4.7'
      });
    }
  }

  /**
   * Check language attribute
   */
  checkLanguageAttribute() {
    const html = document.documentElement;
    const lang = html.getAttribute('lang');
    
    if (!lang) {
      this.issues.push({
        type: 'error',
        category: 'understandable',
        message: 'Page language not specified',
        wcag: '3.1.1',
        level: 'A',
        fix: 'Add lang attribute to <html> element'
      });
    } else {
      this.passes.push({
        category: 'understandable',
        message: `Page language specified: ${lang}`,
        wcag: '3.1.1'
      });
    }
  }

  /**
   * Check landmark regions
   */
  checkLandmarkRegions() {
    const landmarks = {
      main: document.querySelector('main, [role="main"]'),
      nav: document.querySelector('nav, [role="navigation"]'),
      banner: document.querySelector('header, [role="banner"]'),
      contentinfo: document.querySelector('footer, [role="contentinfo"]')
    };
    
    const missingLandmarks = [];
    
    Object.entries(landmarks).forEach(([name, element]) => {
      if (!element) {
        missingLandmarks.push(name);
      }
    });
    
    if (missingLandmarks.length > 0) {
      this.warnings.push({
        type: 'warning',
        category: 'robust',
        message: `Missing landmark regions: ${missingLandmarks.join(', ')}`,
        wcag: '1.3.1',
        level: 'A',
        fix: 'Add appropriate landmark regions to improve navigation'
      });
    } else {
      this.passes.push({
        category: 'robust',
        message: 'All major landmark regions present',
        wcag: '1.3.1'
      });
    }
  }

  /**
   * Check for duplicate IDs
   */
  checkDuplicateIds() {
    const allElements = document.querySelectorAll('[id]');
    const ids = {};
    const duplicates = [];
    
    allElements.forEach(el => {
      const id = el.getAttribute('id');
      if (ids[id]) {
        duplicates.push(id);
      } else {
        ids[id] = true;
      }
    });
    
    if (duplicates.length > 0) {
      this.issues.push({
        type: 'error',
        category: 'robust',
        message: `Duplicate IDs found: ${duplicates.join(', ')}`,
        wcag: '4.1.1',
        level: 'A',
        fix: 'Ensure all ID attributes are unique'
      });
    } else {
      this.passes.push({
        category: 'robust',
        message: 'All element IDs are unique',
        wcag: '4.1.1'
      });
    }
  }

  /**
   * Calculate accessibility score
   */
  calculateScore() {
    const total = this.issues.length + this.warnings.length + this.passes.length;
    if (total === 0) return 100;
    
    const score = Math.round((this.passes.length / total) * 100);
    return Math.max(0, Math.min(100, score));
  }
}

/**
 * Accessibility Audit Component
 */
const AccessibilityAudit = ({ 
  autoRun = false, 
  showDetails = true,
  position = 'fixed',
  compact = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [auditResults, setAuditResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const announce = useAnnounce();
  
  const runAudit = useCallback(async () => {
    setIsRunning(true);
    announce('Running accessibility audit', 'polite');
    
    const auditor = new AccessibilityAuditor();
    const results = await auditor.runAudit();
    
    setAuditResults(results);
    setIsRunning(false);
    
    announce(
      `Audit complete. Score: ${results.score}%. ${results.issues.length} issues, ${results.warnings.length} warnings, ${results.passes.length} passes`,
      'polite'
    );
  }, [announce]);
  
  useEffect(() => {
    if (autoRun) {
      runAudit();
    }
  }, [autoRun, runAudit]);
  
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };
  
  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };
  
  const getScoreIcon = (score) => {
    if (score >= 90) return <CheckCircle className="w-6 h-6" />;
    if (score >= 70) return <AlertTriangle className="w-6 h-6" />;
    return <XCircle className="w-6 h-6" />;
  };
  
  const positionClasses = {
    fixed: 'fixed bottom-4 left-4 z-50',
    absolute: 'absolute bottom-4 left-4',
    relative: 'relative'
  };
  
  if (compact) {
    return (
      <div className={`${positionClasses[position]}`}>
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className={`
            p-3 rounded-full shadow-lg
            ${auditResults 
              ? auditResults.score >= 90 
                ? 'bg-green-500 hover:bg-green-600' 
                : auditResults.score >= 70
                ? 'bg-yellow-500 hover:bg-yellow-600'
                : 'bg-red-500 hover:bg-red-600'
              : 'bg-gray-500 hover:bg-gray-600'
            }
            text-white transition-colors
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500
          `}
          aria-label={`Accessibility audit. ${auditResults ? `Score: ${auditResults.score}%` : 'Not run yet'}`}
        >
          <Shield className="w-6 h-6" />
        </motion.button>
        
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="absolute bottom-16 left-0 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700"
            >
              <AccessibilityAuditPanel
                auditResults={auditResults}
                isRunning={isRunning}
                runAudit={runAudit}
                showDetails={showDetails}
                expandedCategories={expandedCategories}
                toggleCategory={toggleCategory}
                getScoreColor={getScoreColor}
                getScoreIcon={getScoreIcon}
                onClose={() => setIsOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
  
  return (
    <div className={`${positionClasses[position]} w-96`}>
      <AccessibilityAuditPanel
        auditResults={auditResults}
        isRunning={isRunning}
        runAudit={runAudit}
        showDetails={showDetails}
        expandedCategories={expandedCategories}
        toggleCategory={toggleCategory}
        getScoreColor={getScoreColor}
        getScoreIcon={getScoreIcon}
      />
    </div>
  );
};

/**
 * Audit Panel Component
 */
const AccessibilityAuditPanel = ({
  auditResults,
  isRunning,
  runAudit,
  showDetails,
  expandedCategories,
  toggleCategory,
  getScoreColor,
  getScoreIcon,
  onClose
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Accessibility Audit
          </h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label="Close audit panel"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>
        
        {auditResults && (
          <div className="flex items-center gap-3">
            <div className={`${getScoreColor(auditResults.score)}`}>
              {getScoreIcon(auditResults.score)}
            </div>
            <div>
              <div className={`text-2xl font-bold ${getScoreColor(auditResults.score)}`}>
                {auditResults.score}%
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Accessibility Score
              </div>
            </div>
          </div>
        )}
        
        <button
          onClick={runAudit}
          disabled={isRunning}
          className="mt-3 w-full px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 flex items-center justify-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Running Audit...' : 'Run Audit'}
        </button>
      </div>
      
      {auditResults && showDetails && (
        <div className="max-h-96 overflow-y-auto">
          {/* Issues */}
          {auditResults.issues.length > 0 && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium mb-2">
                <XCircle className="w-5 h-5" />
                Issues ({auditResults.issues.length})
              </div>
              <div className="space-y-2">
                {auditResults.issues.slice(0, 3).map((issue, index) => (
                  <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                    <div className="font-medium">{issue.message}</div>
                    <div className="text-xs opacity-75">WCAG {issue.wcag} Level {issue.level}</div>
                  </div>
                ))}
                {auditResults.issues.length > 3 && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    +{auditResults.issues.length - 3} more issues
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Warnings */}
          {auditResults.warnings.length > 0 && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 font-medium mb-2">
                <AlertTriangle className="w-5 h-5" />
                Warnings ({auditResults.warnings.length})
              </div>
              <div className="space-y-2">
                {auditResults.warnings.slice(0, 3).map((warning, index) => (
                  <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                    <div className="font-medium">{warning.message}</div>
                    <div className="text-xs opacity-75">WCAG {warning.wcag} Level {warning.level}</div>
                  </div>
                ))}
                {auditResults.warnings.length > 3 && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    +{auditResults.warnings.length - 3} more warnings
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Passes */}
          {auditResults.passes.length > 0 && (
            <div className="p-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium mb-2">
                <CheckCircle className="w-5 h-5" />
                Passes ({auditResults.passes.length})
              </div>
              <div className="space-y-2">
                {auditResults.passes.slice(0, 3).map((pass, index) => (
                  <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                    <div className="font-medium">{pass.message}</div>
                    <div className="text-xs opacity-75">WCAG {pass.wcag}</div>
                  </div>
                ))}
                {auditResults.passes.length > 3 && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    +{auditResults.passes.length - 3} more passes
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AccessibilityAudit;
