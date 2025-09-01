import React from 'react';
import PropTypes from 'prop-types';
import './Grid.css';

/**
 * Grid Component
 * Flexible grid system for responsive layouts
 */
const Grid = ({ 
  children, 
  className = '',
  cols = 1,
  colsSm = null,
  colsMd = null,
  colsLg = null,
  colsXl = null,
  gap = 'md',
  alignItems = 'stretch',
  justifyItems = 'stretch',
  ...props 
}) => {
  const gridClasses = [
    'grid',
    `grid--cols-${cols}`,
    colsSm && `grid--cols-sm-${colsSm}`,
    colsMd && `grid--cols-md-${colsMd}`,
    colsLg && `grid--cols-lg-${colsLg}`,
    colsXl && `grid--cols-xl-${colsXl}`,
    gap && `grid--gap-${gap}`,
    alignItems && `grid--align-${alignItems}`,
    justifyItems && `grid--justify-${justifyItems}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={gridClasses} {...props}>
      {children}
    </div>
  );
};

Grid.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  cols: PropTypes.oneOf([1, 2, 3, 4, 5, 6, 12]),
  colsSm: PropTypes.oneOf([1, 2, 3, 4, 5, 6, 12]),
  colsMd: PropTypes.oneOf([1, 2, 3, 4, 5, 6, 12]),
  colsLg: PropTypes.oneOf([1, 2, 3, 4, 5, 6, 12]),
  colsXl: PropTypes.oneOf([1, 2, 3, 4, 5, 6, 12]),
  gap: PropTypes.oneOf(['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl']),
  alignItems: PropTypes.oneOf(['start', 'center', 'end', 'stretch']),
  justifyItems: PropTypes.oneOf(['start', 'center', 'end', 'stretch']),
};

/**
 * GridItem Component
 * Individual grid item with span control
 */
export const GridItem = ({ 
  children, 
  className = '',
  span = 1,
  spanSm = null,
  spanMd = null,
  spanLg = null,
  spanXl = null,
  ...props 
}) => {
  const itemClasses = [
    'grid-item',
    `grid-item--span-${span}`,
    spanSm && `grid-item--span-sm-${spanSm}`,
    spanMd && `grid-item--span-md-${spanMd}`,
    spanLg && `grid-item--span-lg-${spanLg}`,
    spanXl && `grid-item--span-xl-${spanXl}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={itemClasses} {...props}>
      {children}
    </div>
  );
};

GridItem.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  span: PropTypes.oneOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  spanSm: PropTypes.oneOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  spanMd: PropTypes.oneOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  spanLg: PropTypes.oneOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  spanXl: PropTypes.oneOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
};

export default Grid;
