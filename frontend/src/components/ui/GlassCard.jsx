import React from 'react';
import PropTypes from 'prop-types';
import './GlassCard.css';

/**
 * GlassCard Component
 * A card component with glassmorphism effects and advanced animations
 * Based on the futuristic design system
 */
const GlassCard = ({ 
  children, 
  className = '', 
  variant = 'default',
  glow = false,
  animated = true,
  onClick,
  hoverable = true,
  padding = 'default',
  borderGradient = false,
  dataStream = false,
  ...props 
}) => {
  const cardClasses = [
    'glass-card',
    variant && `glass-card--${variant}`,
    glow && 'glass-card--glow',
    animated && 'glass-card--animated',
    hoverable && 'glass-card--hoverable',
    padding && `glass-card--padding-${padding}`,
    borderGradient && 'glass-card--border-gradient',
    className
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={cardClasses} 
      onClick={onClick}
      {...props}
    >
      {dataStream && <div className="glass-card__data-stream" />}
      {borderGradient && (
        <>
          <div className="glass-card__border-shimmer" />
          <div className="glass-card__border-glow" />
        </>
      )}
      <div className="glass-card__content">
        {children}
      </div>
    </div>
  );
};

GlassCard.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'elevated', 'outlined', 'filled']),
  glow: PropTypes.bool,
  animated: PropTypes.bool,
  onClick: PropTypes.func,
  hoverable: PropTypes.bool,
  padding: PropTypes.oneOf(['none', 'small', 'default', 'large']),
  borderGradient: PropTypes.bool,
  dataStream: PropTypes.bool,
};

export default GlassCard;
