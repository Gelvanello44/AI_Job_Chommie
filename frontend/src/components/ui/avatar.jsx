"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import PropTypes from 'prop-types';
import { cn } from "@/lib/utils"
import './Avatar.css';

function Avatar({
  className,
  size = 'medium',
  variant = 'default',
  status = null,
  glow = false,
  animated = false,
  border = false,
  onClick,
  ...props
}) {
  const avatarClasses = [
    'avatar',
    `avatar--${size}`,
    `avatar--${variant}`,
    status && `avatar--status-${status}`,
    glow && 'avatar--glow',
    animated && 'avatar--animated',
    border && 'avatar--border',
    onClick && 'avatar--interactive',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className="avatar-wrapper">
      <AvatarPrimitive.Root
        data-slot="avatar"
        className={cn(avatarClasses)}
        onClick={onClick}
        {...props}
      >
        <div className="avatar__background"></div>
        <div className="avatar__content">
          {props.children}
        </div>
        {glow && <div className="avatar__glow"></div>}
      </AvatarPrimitive.Root>
      
      {status && (
        <div className={`avatar__status avatar__status--${status}`}>
          <div className="avatar__status-dot"></div>
          {animated && <div className="avatar__status-pulse"></div>}
        </div>
      )}
    </div>
  );
}

function AvatarImage({
  className,
  ...props
}) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props} />
  );
}

function AvatarFallback({
  className,
  ...props
}) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props} />
  );
}

Avatar.propTypes = {
  className: PropTypes.string,
  size: PropTypes.oneOf(['small', 'medium', 'large', 'xl']),
  variant: PropTypes.oneOf(['default', 'rounded', 'square']),
  status: PropTypes.oneOf(['online', 'offline', 'away', 'busy']),
  glow: PropTypes.bool,
  animated: PropTypes.bool,
  border: PropTypes.bool,
  onClick: PropTypes.func,
  children: PropTypes.node,
};

export { Avatar, AvatarImage, AvatarFallback }
