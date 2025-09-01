import React, { forwardRef, useState } from 'react';
import PropTypes from 'prop-types';
import './Input.css';

/**
 * Input Component
 * Advanced input field with glassmorphism effects and animations
 */
const Input = forwardRef(({ 
  className = '',
  type = 'text',
  label = '',
  placeholder = '',
  error = '',
  success = false,
  disabled = false,
  required = false,
  icon = null,
  iconPosition = 'left',
  clearable = false,
  glow = false,
  variant = 'default',
  size = 'medium',
  onClear,
  onChange,
  onFocus,
  onBlur,
  value,
  ...props 
}, ref) => {
  const [focused, setFocused] = useState(false);
  const [hasValue, setHasValue] = useState(!!value);

  const inputClasses = [
    'input-field',
    `input-field--${variant}`,
    `input-field--${size}`,
    focused && 'input-field--focused',
    hasValue && 'input-field--has-value',
    error && 'input-field--error',
    success && 'input-field--success',
    disabled && 'input-field--disabled',
    glow && 'input-field--glow',
    icon && 'input-field--with-icon',
    iconPosition && `input-field--icon-${iconPosition}`,
    className
  ].filter(Boolean).join(' ');

  const handleFocus = (e) => {
    setFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    setFocused(false);
    onBlur?.(e);
  };

  const handleChange = (e) => {
    setHasValue(!!e.target.value);
    onChange?.(e);
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else if (onChange) {
      onChange({ target: { value: '' } });
    }
    setHasValue(false);
  };

  return (
    <div className={inputClasses}>
      {label && (
        <label className="input-field__label">
          {label}
          {required && <span className="input-field__required">*</span>}
        </label>
      )}
      
      <div className="input-field__wrapper">
        {icon && iconPosition === 'left' && (
          <div className="input-field__icon input-field__icon--left">
            {icon}
          </div>
        )}
        
        <input
          ref={ref}
          type={type}
          className="input-field__input"
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        
        {clearable && hasValue && !disabled && (
          <button
            type="button"
            className="input-field__clear"
            onClick={handleClear}
            aria-label="Clear input"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
        
        {icon && iconPosition === 'right' && (
          <div className="input-field__icon input-field__icon--right">
            {icon}
          </div>
        )}
        
        <div className="input-field__border"></div>
        <div className="input-field__glow"></div>
      </div>
      
      {error && (
        <div className="input-field__error" role="alert">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 4v4M8 12h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {error}
        </div>
      )}
      
      {success && !error && (
        <div className="input-field__success">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="2"/>
            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Valid
        </div>
      )}
    </div>
  );
});

Input.displayName = 'Input';

Input.propTypes = {
  className: PropTypes.string,
  type: PropTypes.string,
  label: PropTypes.string,
  placeholder: PropTypes.string,
  error: PropTypes.string,
  success: PropTypes.bool,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  icon: PropTypes.node,
  iconPosition: PropTypes.oneOf(['left', 'right']),
  clearable: PropTypes.bool,
  glow: PropTypes.bool,
  variant: PropTypes.oneOf(['default', 'outlined', 'filled']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  onClear: PropTypes.func,
  onChange: PropTypes.func,
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
  value: PropTypes.string,
};

export default Input;
