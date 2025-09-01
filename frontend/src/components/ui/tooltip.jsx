import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import PropTypes from 'prop-types';
import { cn } from "@/lib/utils"
import './Tooltip.css';

function TooltipProvider({
  delayDuration = 0,
  ...props
}) {
  return (<TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />);
}

function Tooltip({
  ...props
}) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger({
  ...props
}) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 8,
  children,
  variant = 'default',
  glow = false,
  animated = true,
  showArrow = true,
  ...props
}) {
  const tooltipClasses = [
    'tooltip-content',
    `tooltip-content--${variant}`,
    glow && 'tooltip-content--glow',
    animated && 'tooltip-content--animated',
    className
  ].filter(Boolean).join(' ');

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(tooltipClasses)}
        {...props}
      >
        <div className="tooltip-content__background"></div>
        <div className="tooltip-content__wrapper">
          {children}
        </div>
        
        {showArrow && (
          <TooltipPrimitive.Arrow className="tooltip-content__arrow" />
        )}
        
        {glow && <div className="tooltip-content__glow"></div>}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

TooltipContent.propTypes = {
  className: PropTypes.string,
  sideOffset: PropTypes.number,
  children: PropTypes.node,
  variant: PropTypes.oneOf(['default', 'dark', 'light', 'success', 'warning', 'error']),
  glow: PropTypes.bool,
  animated: PropTypes.bool,
  showArrow: PropTypes.bool,
};

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
