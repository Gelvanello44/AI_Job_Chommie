import React from 'react';
import PropTypes from 'prop-types';
import './StatusIndicator.css';

/**
 * StatusIndicator Component
 * Displays connection/status information with animations
 */
const StatusIndicator = ({ 
  className = '',
  status = 'connected',
  label = '',
  showDot = true,
  animated = true,
  size = 'medium',
  variant = 'default',
  ...props 
}) => {
  const indicatorClasses = [
    'status-indicator',
    `status-indicator--${status}`,
    `status-indicator--${size}`,
    `status-indicator--${variant}`,
    animated && 'status-indicator--animated',
    className
  ].filter(Boolean).join(' ');

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2"/>
            <circle cx="8" cy="8" r="2" fill="currentColor"/>
          </svg>
        );
      case 'disconnected':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2"/>
            <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" strokeWidth="2"/>
          </svg>
        );
      case 'loading':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="status-indicator__spinner">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="32"/>
          </svg>
        );
      case 'warning':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1l7 14H1L8 1z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M8 6v3M8 12h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      case 'error':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 4v4M8 12h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      case 'success':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="2"/>
            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={indicatorClasses} {...props}>
      {showDot && <div className="status-indicator__dot" />}
      
      <div className="status-indicator__content">
        {getStatusIcon()}
        {label && <span className="status-indicator__label">{label}</span>}
      </div>
      
      {animated && (
        <>
          <div className="status-indicator__pulse"></div>
          <div className="status-indicator__ripple"></div>
        </>
      )}
    </div>
  );
};

StatusIndicator.propTypes = {
  className: PropTypes.string,
  status: PropTypes.oneOf([
    'connected', 'disconnected', 'loading', 
    'warning', 'error', 'success', 'idle'
  ]),
  label: PropTypes.string,
  showDot: PropTypes.bool,
  animated: PropTypes.bool,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  variant: PropTypes.oneOf(['default', 'compact', 'detailed']),
};

export default StatusIndicator;
