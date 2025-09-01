"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"
import PropTypes from 'prop-types';
import { cn } from "@/lib/utils"
import './Switch.css';

function Switch({
  className,
  size = 'medium',
  variant = 'default',
  glow = false,
  animated = true,
  color = 'cyan',
  ...props
}) {
  const switchClasses = [
    'switch',
    `switch--${size}`,
    `switch--${variant}`,
    `switch--${color}`,
    glow && 'switch--glow',
    animated && 'switch--animated',
    className
  ].filter(Boolean).join(' ');

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(switchClasses)}
      {...props}
    >
      <div className="switch__background"></div>
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="switch__thumb"
      >
        <div className="switch__thumb-inner"></div>
        {glow && <div className="switch__thumb-glow"></div>}
      </SwitchPrimitive.Thumb>
      {glow && <div className="switch__glow"></div>}
    </SwitchPrimitive.Root>
  );
}

Switch.propTypes = {
  className: PropTypes.string,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  variant: PropTypes.oneOf(['default', 'outline', 'solid']),
  glow: PropTypes.bool,
  animated: PropTypes.bool,
  color: PropTypes.oneOf(['cyan', 'purple', 'green', 'yellow', 'pink']),
};

export { Switch }
