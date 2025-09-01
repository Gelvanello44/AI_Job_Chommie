import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import PropTypes from 'prop-types';
import { cn } from "@/lib/utils"
import './Badge.css';

function Badge({
  className,
  variant = 'default',
  size = 'medium',
  glow = false,
  animated = false,
  pulse = false,
  dot = false,
  removable = false,
  icon = null,
  onRemove,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "span"

  const badgeClasses = [
    'badge',
    `badge--${variant}`,
    `badge--${size}`,
    glow && 'badge--glow',
    animated && 'badge--animated',
    pulse && 'badge--pulse',
    dot && 'badge--dot',
    removable && 'badge--removable',
    icon && 'badge--with-icon',
    className
  ].filter(Boolean).join(' ');

  const handleRemove = (e) => {
    e.stopPropagation();
    onRemove?.();
  };

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeClasses)}
      {...props}
    >
      <div className="badge__background"></div>
      <div className="badge__content">
        {dot && <div className="badge__dot"></div>}
        {icon && <span className="badge__icon">{icon}</span>}
        <span className="badge__text">{props.children}</span>
        {removable && (
          <button
            type="button"
            className="badge__remove"
            onClick={handleRemove}
            aria-label="Remove badge"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M9 3L3 9M3 3L9 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
      {glow && <div className="badge__glow"></div>}
    </Comp>
  );
}

Badge.propTypes = {
  className: PropTypes.string,
  variant: PropTypes.oneOf([
    'default', 'secondary', 'success', 'warning', 
    'error', 'info', 'outline', 'ghost'
  ]),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  glow: PropTypes.bool,
  animated: PropTypes.bool,
  pulse: PropTypes.bool,
  dot: PropTypes.bool,
  removable: PropTypes.bool,
  icon: PropTypes.node,
  onRemove: PropTypes.func,
  asChild: PropTypes.bool,
  children: PropTypes.node,
};

export { Badge }
