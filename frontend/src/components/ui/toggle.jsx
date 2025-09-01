import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import PropTypes from 'prop-types';
import { cn } from "@/lib/utils"
import './Toggle.css';

function Toggle({
  className,
  variant = 'default',
  size = 'medium',
  glow = false,
  animated = true,
  icon = null,
  ...props
}) {
  const toggleClasses = [
    'toggle',
    `toggle--${variant}`,
    `toggle--${size}`,
    glow && 'toggle--glow',
    animated && 'toggle--animated',
    icon && 'toggle--with-icon',
    className
  ].filter(Boolean).join(' ');

  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleClasses)}
      {...props}
    >
      <div className="toggle__background"></div>
      <div className="toggle__content">
        {icon && <span className="toggle__icon">{icon}</span>}
        <span className="toggle__text">{props.children}</span>
      </div>
      {glow && <div className="toggle__glow"></div>}
    </TogglePrimitive.Root>
  );
}

Toggle.propTypes = {
  className: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'outline', 'ghost']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  glow: PropTypes.bool,
  animated: PropTypes.bool,
  icon: PropTypes.node,
  children: PropTypes.node,
};

export { Toggle }
