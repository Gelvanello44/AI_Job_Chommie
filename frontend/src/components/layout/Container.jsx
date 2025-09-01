import React from 'react';
import PropTypes from 'prop-types';
import './Container.css';

/**
 * Container Component
 * Provides consistent layout structure with max-width and padding
 */
const Container = ({ 
  children, 
  className = '', 
  fluid = false,
  centered = true,
  padding = true,
  ...props 
}) => {
  const containerClasses = [
    'container',
    fluid && 'container--fluid',
    centered && 'container--centered',
    !padding && 'container--no-padding',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses} {...props}>
      {children}
    </div>
  );
};

Container.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  fluid: PropTypes.bool,
  centered: PropTypes.bool,
  padding: PropTypes.bool,
};

export default Container;
