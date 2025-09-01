import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import './Button.css';

/**
 * Button Component
 * Advanced button with glassmorphism effects, multiple variants, and animations
 */
const Button = forwardRef(({ 
  children, 
  className = '', 
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon = null,
  iconPosition = 'left',
  glow = false,
  gradient = false,
  ripple = true,
  fullWidth = false,
  onClick,
  type = 'button',
  ...props 
}, ref) => {
  const buttonClasses = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    disabled && 'btn--disabled',
    loading && 'btn--loading',
    glow && 'btn--glow',
    gradient && 'btn--gradient',
    fullWidth && 'btn--full-width',
    className
  ].filter(Boolean).join(' ');

  const handleClick = (e) => {
    if (disabled || loading) return;
    
    // Ripple effect
    if (ripple) {
      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      const rippleElement = document.createElement('span');
      rippleElement.className = 'btn__ripple';
      rippleElement.style.width = rippleElement.style.height = size + 'px';
      rippleElement.style.left = x + 'px';
      rippleElement.style.top = y + 'px';
      
      button.appendChild(rippleElement);
      
      setTimeout(() => {
        if (button.contains(rippleElement)) {
          button.removeChild(rippleElement);
        }
      }, 600);
    }
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    
    onClick?.(e);
  };

  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled || loading}
      {...props}
    >
      <div className="btn__content">
        {loading && (
          <div className="btn__spinner">
            <div className="btn__spinner-ring"></div>
          </div>
        )}
        
        {icon && iconPosition === 'left' && !loading && (
          <span className="btn__icon btn__icon--left">{icon}</span>
        )}
        
        <span className="btn__text">{children}</span>
        
        {icon && iconPosition === 'right' && !loading && (
          <span className="btn__icon btn__icon--right">{icon}</span>
        )}
      </div>
      
      <div className="btn__background"></div>
      <div className="btn__glow"></div>
    </button>
  );
});

Button.displayName = 'Button';

Button.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  variant: PropTypes.oneOf([
    'primary', 'secondary', 'tertiary', 'ghost', 
    'danger', 'success', 'warning', 'info'
  ]),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  icon: PropTypes.node,
  iconPosition: PropTypes.oneOf(['left', 'right']),
  glow: PropTypes.bool,
  gradient: PropTypes.bool,
  ripple: PropTypes.bool,
  fullWidth: PropTypes.bool,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
};

export default Button;
