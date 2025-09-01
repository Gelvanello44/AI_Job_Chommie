import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { X, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import './MobileModal.css';

const MobileModal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'default',
  showCloseButton = true,
  showDragHandle = true,
  allowDismiss = true,
  maxHeight = '90vh',
  className = '',
  headerActions = null,
  footer = null,
  overlayClassName = ''
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const modalRef = useRef(null);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 200], [1, 0.5]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && allowDismiss) {
        onClose();
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
  }, [isOpen, onClose, allowDismiss]);

  // Handle drag to dismiss
  const handleDragEnd = (event, info) => {
    const shouldClose = info.offset.y > 100 && info.velocity.y > 0;
    
    if (shouldClose && allowDismiss) {
      onClose();
    } else {
      y.set(0);
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && allowDismiss) {
      onClose();
    }
  };

  // Size variants
  const sizeVariants = {
    small: { maxHeight: '50vh' },
    default: { maxHeight: '75vh' },
    large: { maxHeight: '90vh' },
    full: { maxHeight: '100vh' }
  };

  const currentSize = isFullScreen ? 'full' : size;

  // Animation variants
  const backdropVariants = {
    closed: { opacity: 0 },
    open: { opacity: 1 }
  };

  const modalVariants = {
    closed: { 
      y: '100%',
      opacity: 0,
      scale: 0.95
    },
    open: { 
      y: 0,
      opacity: 1,
      scale: 1
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className={`mobile-modal-portal ${overlayClassName}`}>
          {/* Backdrop */}
          <motion.div
            className="mobile-modal__backdrop"
            variants={backdropVariants}
            initial="closed"
            animate="open"
            exit="closed"
            onClick={handleBackdropClick}
            transition={{ duration: 0.3 }}
          />

          {/* Modal */}
          <motion.div
            ref={modalRef}
            className={`mobile-modal ${className} mobile-modal--${currentSize}`}
            style={{ 
              y,
              opacity,
              ...sizeVariants[currentSize]
            }}
            variants={modalVariants}
            initial="closed"
            animate="open"
            exit="closed"
            drag="y"
            dragConstraints={{ top: 0, bottom: 300 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            transition={{ 
              type: 'spring', 
              damping: 25, 
              stiffness: 200,
              duration: 0.4
            }}
          >
            {/* Drag Handle */}
            {showDragHandle && (
              <div className="mobile-modal__drag-handle">
                <div className="mobile-modal__drag-indicator" />
              </div>
            )}

            {/* Header */}
            {(title || showCloseButton || headerActions) && (
              <div className="mobile-modal__header">
                <div className="mobile-modal__header-content">
                  {title && (
                    <h2 className="mobile-modal__title">{title}</h2>
                  )}
                  
                  <div className="mobile-modal__header-actions">
                    {headerActions}
                    
                    <button
                      className="mobile-modal__action-btn"
                      onClick={() => setIsFullScreen(!isFullScreen)}
                      aria-label={isFullScreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    >
                      {isFullScreen ? (
                        <Minimize2 size={20} />
                      ) : (
                        <Maximize2 size={20} />
                      )}
                    </button>
                    
                    {showCloseButton && (
                      <button
                        className="mobile-modal__close-btn"
                        onClick={onClose}
                        aria-label="Close modal"
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="mobile-modal__content">
              <div className="mobile-modal__body">
                {children}
              </div>
            </div>

            {/* Footer */}
            {footer && (
              <div className="mobile-modal__footer">
                {footer}
              </div>
            )}

            {/* Resize Indicator */}
            <div className="mobile-modal__resize-indicator">
              <ChevronDown size={16} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

// PropTypes validation
MobileModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  children: PropTypes.node.isRequired,
  size: PropTypes.oneOf(['small', 'default', 'large', 'full']),
  showCloseButton: PropTypes.bool,
  showDragHandle: PropTypes.bool,
  allowDismiss: PropTypes.bool,
  maxHeight: PropTypes.string,
  className: PropTypes.string,
  headerActions: PropTypes.node,
  footer: PropTypes.node,
  overlayClassName: PropTypes.string
};

// Mobile Modal Hook
export const useMobileModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [modalProps, setModalProps] = useState({});

  const openModal = (props = {}) => {
    setModalProps(props);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setModalProps({});
  };

  return {
    isOpen,
    openModal,
    closeModal,
    modalProps
  };
};

// Action Sheet Component (simplified mobile modal)
export const MobileActionSheet = ({
  isOpen,
  onClose,
  title,
  actions = [],
  destructiveActionIndex = null,
  cancelLabel = 'Cancel',
  className = ''
}) => {
  const handleActionClick = (action, index) => {
    if (action.onClick) {
      action.onClick();
    }
    onClose();
  };

  return (
    <MobileModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="small"
      showCloseButton={false}
      className={`mobile-action-sheet ${className}`}
    >
      <div className="mobile-action-sheet__actions">
        {actions.map((action, index) => (
          <button
            key={index}
            className={`mobile-action-sheet__action ${
              index === destructiveActionIndex 
                ? 'mobile-action-sheet__action--destructive' 
                : ''
            }`}
            onClick={() => handleActionClick(action, index)}
            disabled={action.disabled}
          >
            {action.icon && (
              <span className="mobile-action-sheet__action-icon">
                {action.icon}
              </span>
            )}
            <span className="mobile-action-sheet__action-label">
              {action.label}
            </span>
          </button>
        ))}
        
        <button
          className="mobile-action-sheet__cancel"
          onClick={onClose}
        >
          {cancelLabel}
        </button>
      </div>
    </MobileModal>
  );
};

MobileActionSheet.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func,
      icon: PropTypes.node,
      disabled: PropTypes.bool
    })
  ),
  destructiveActionIndex: PropTypes.number,
  cancelLabel: PropTypes.string,
  className: PropTypes.string
};

// Mobile Drawer Component
export const MobileDrawer = ({
  isOpen,
  onClose,
  position = 'bottom',
  children,
  className = ''
}) => {
  const directionMap = {
    bottom: { y: '100%' },
    top: { y: '-100%' },
    left: { x: '-100%' },
    right: { x: '100%' }
  };

  const drawerVariants = {
    closed: directionMap[position],
    open: { x: 0, y: 0 }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="mobile-drawer-portal">
          <motion.div
            className="mobile-modal__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          <motion.div
            className={`mobile-drawer mobile-drawer--${position} ${className}`}
            variants={drawerVariants}
            initial="closed"
            animate="open"
            exit="closed"
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

MobileDrawer.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  position: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

export default MobileModal;
