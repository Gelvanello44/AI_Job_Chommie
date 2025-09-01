import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import PropTypes from 'prop-types';
import { cn } from "@/lib/utils"
import './Progress.css';

function Progress({
  className,
  value = 0,
  variant = 'default',
  size = 'medium',
  animated = false,
  glow = false,
  showLabel = false,
  label = '',
  showPercentage = false,
  color = 'cyan',
  gradient = false,
  striped = false,
  ...props
}) {
  const progressClasses = [
    'progress',
    `progress--${variant}`,
    `progress--${size}`,
    `progress--${color}`,
    animated && 'progress--animated',
    glow && 'progress--glow',
    gradient && 'progress--gradient',
    striped && 'progress--striped',
    className
  ].filter(Boolean).join(' ');

  const percentage = Math.min(Math.max(value || 0, 0), 100);

  return (
    <div className="progress-wrapper">
      {(showLabel || showPercentage) && (
        <div className="progress__header">
          {showLabel && label && (
            <span className="progress__label">{label}</span>
          )}
          {showPercentage && (
            <span className="progress__percentage">{Math.round(percentage)}%</span>
          )}
        </div>
      )}
      
      <ProgressPrimitive.Root
        data-slot="progress"
        className={cn(progressClasses)}
        value={percentage}
        {...props}
      >
        <div className="progress__background"></div>
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className="progress__indicator"
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        >
          <div className="progress__fill"></div>
          {striped && <div className="progress__stripes"></div>}
          {animated && <div className="progress__shimmer"></div>}
        </ProgressPrimitive.Indicator>
        
        {glow && <div className="progress__glow"></div>}
      </ProgressPrimitive.Root>
    </div>
  );
}

Progress.propTypes = {
  className: PropTypes.string,
  value: PropTypes.number,
  variant: PropTypes.oneOf(['default', 'subtle', 'bold']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  animated: PropTypes.bool,
  glow: PropTypes.bool,
  showLabel: PropTypes.bool,
  label: PropTypes.string,
  showPercentage: PropTypes.bool,
  color: PropTypes.oneOf(['cyan', 'purple', 'green', 'yellow', 'pink']),
  gradient: PropTypes.bool,
  striped: PropTypes.bool,
};

export { Progress }
