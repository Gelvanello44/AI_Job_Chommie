/**
 * Accessible Modal Component
 * WCAG compliant modal with proper focus management and keyboard navigation
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useFocusTrap, KEYS, isKey } from '../utils/keyboardNavigation';
import { useAnnounce } from '../utils/screenReaderUtils';
import FocusLock from 'react-focus-lock';

/**
 * Modal Component with accessibility features
 */
const AccessibleModal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'medium',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  initialFocusRef = null,
  finalFocusRef = null,
  scrollBehavior = 'inside',
  preserveScrollBarGap = true,
  motionPreset = 'slideIn',
  className = '',
  overlayClassName = '',
  contentClassName = '',
  headerClassName = '',
  bodyClassName = '',
  footerClassName = '',
  ariaDescribedBy,
  ariaLabelledBy,
  role = 'dialog'
}) => {
  const modalRef = useRef(null);
  const overlayRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousActiveElement = useRef(null);
  const announce = useAnnounce();
  
  // Size classes
  const sizeClasses = {
    small: 'max-w-sm',
    medium: 'max-w-lg',
    large: 'max-w-2xl',
    xlarge: 'max-w-4xl',
    full: 'max-w-full mx-4'
  };
  
  // Motion variants
  const motionVariants = {
    slideIn: {
      hidden: { opacity: 0, y: 50 },
      visible: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 50 }
    },
    fadeIn: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
      exit: { opacity: 0 }
    },
    scaleIn: {
      hidden: { opacity: 0, scale: 0.9 },
      visible: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.9 }
    }
  };
  
  // Handle body scroll lock
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      
      if (preserveScrollBarGap) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      } else {
        document.body.style.overflow = 'hidden';
      }
      
      // Announce modal opening
      announce(`${title} dialog opened`, 'polite');
      
      // Set initial focus
      setTimeout(() => {
        if (initialFocusRef?.current) {
          initialFocusRef.current.focus();
        } else if (closeButtonRef.current) {
          closeButtonRef.current.focus();
        }
      }, 100);
    }
    
    return () => {
      if (isOpen) {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        
        // Restore focus
        if (finalFocusRef?.current) {
          finalFocusRef.current.focus();
        } else if (previousActiveElement.current) {
          previousActiveElement.current.focus();
        }
        
        // Announce modal closing
        announce(`${title} dialog closed`, 'polite');
      }
    };
  }, [isOpen, title, preserveScrollBarGap, initialFocusRef, finalFocusRef, announce]);
  
  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    
    const handleEscape = (event) => {
      if (isKey(event, KEYS.ESCAPE)) {
        event.preventDefault();
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);
  
  // Handle overlay click
  const handleOverlayClick = (event) => {
    if (closeOnOverlayClick && event.target === overlayRef.current) {
      onClose();
    }
  };
  
  // Prevent event propagation
  const handleModalClick = (event) => {
    event.stopPropagation();
  };
  
  if (!isOpen) return null;
  
  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`absolute inset-0 bg-black bg-opacity-50 ${overlayClassName}`}
            onClick={handleOverlayClick}
            aria-hidden="true"
          />
          
          {/* Modal Container */}
          <FocusLock returnFocus disabled={!isOpen}>
            <motion.div
              ref={modalRef}
              role={role}
              aria-modal="true"
              aria-labelledby={ariaLabelledBy || 'modal-title'}
              aria-describedby={ariaDescribedBy || 'modal-description'}
              variants={motionVariants[motionPreset]}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className={`
                relative w-full ${sizeClasses[size]}
                bg-white dark:bg-gray-800 rounded-lg shadow-xl
                ${scrollBehavior === 'inside' ? 'max-h-[90vh] flex flex-col' : ''}
                ${className}
              `}
              onClick={handleModalClick}
            >
              {/* Close Button */}
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className={`
                  absolute top-4 right-4 z-10
                  p-2 rounded-lg
                  text-gray-500 hover:text-gray-700
                  dark:text-gray-400 dark:hover:text-gray-200
                  hover:bg-gray-100 dark:hover:bg-gray-700
                  focus:outline-none focus:ring-2 focus:ring-cyan-500
                  transition-colors duration-200
                `}
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
              
              {/* Modal Content */}
              <div className={`${contentClassName}`}>
                {/* Header */}
                {title && (
                  <div className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 ${headerClassName}`}>
                    <h2
                      id="modal-title"
                      className="text-xl font-semibold text-gray-900 dark:text-white"
                    >
                      {title}
                    </h2>
                  </div>
                )}
                
                {/* Body */}
                <div
                  id="modal-description"
                  className={`
                    px-6 py-4
                    ${scrollBehavior === 'inside' ? 'flex-1 overflow-y-auto' : ''}
                    ${bodyClassName}
                  `}
                >
                  {children}
                </div>
              </div>
            </motion.div>
          </FocusLock>
        </div>
      )}
    </AnimatePresence>
  );
  
  // Render modal in portal
  return createPortal(modalContent, document.body);
};

/**
 * Modal Header Component
 */
export const ModalHeader = ({ children, className = '' }) => (
  <div className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 ${className}`}>
    {children}
  </div>
);

/**
 * Modal Body Component
 */
export const ModalBody = ({ children, className = '' }) => (
  <div className={`px-6 py-4 ${className}`}>
    {children}
  </div>
);

/**
 * Modal Footer Component
 */
export const ModalFooter = ({ children, className = '' }) => (
  <div className={`px-6 py-4 border-t border-gray-200 dark:border-gray-700 ${className}`}>
    {children}
  </div>
);

/**
 * Alert Dialog variant
 */
export const AlertDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning'
}) => {
  const confirmButtonRef = useRef(null);
  
  const typeStyles = {
    warning: 'bg-yellow-500 hover:bg-yellow-600',
    danger: 'bg-red-500 hover:bg-red-600',
    info: 'bg-blue-500 hover:bg-blue-600',
    success: 'bg-green-500 hover:bg-green-600'
  };
  
  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="small"
      role="alertdialog"
      initialFocusRef={confirmButtonRef}
    >
      <div className="py-4">
        <p className="text-gray-600 dark:text-gray-300">{message}</p>
      </div>
      
      <div className="flex justify-end gap-3 pt-4">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
        >
          {cancelText}
        </button>
        <button
          ref={confirmButtonRef}
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`px-4 py-2 rounded-lg text-white ${typeStyles[type]} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition-colors`}
        >
          {confirmText}
        </button>
      </div>
    </AccessibleModal>
  );
};

export default AccessibleModal;
