"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import PropTypes from 'prop-types';
import { cn } from "@/lib/utils"
import './Tabs.css';

function Tabs({
  className,
  variant = 'default',
  orientation = 'horizontal',
  animated = true,
  ...props
}) {
  const tabsClasses = [
    'tabs',
    `tabs--${variant}`,
    `tabs--${orientation}`,
    animated && 'tabs--animated',
    className
  ].filter(Boolean).join(' ');

  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn(tabsClasses)}
      orientation={orientation}
      {...props} />
  );
}

function TabsList({
  className,
  variant = 'default',
  size = 'medium',
  glow = false,
  ...props
}) {
  const tabsListClasses = [
    'tabs-list',
    `tabs-list--${variant}`,
    `tabs-list--${size}`,
    glow && 'tabs-list--glow',
    className
  ].filter(Boolean).join(' ');

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(tabsListClasses)}
      {...props}
    >
      <div className="tabs-list__background"></div>
      <div className="tabs-list__content">
        {props.children}
      </div>
      {glow && <div className="tabs-list__glow"></div>}
    </TabsPrimitive.List>
  );
}

function TabsTrigger({
  className,
  icon = null,
  badge = null,
  disabled = false,
  ...props
}) {
  const triggerClasses = [
    'tabs-trigger',
    disabled && 'tabs-trigger--disabled',
    icon && 'tabs-trigger--with-icon',
    badge && 'tabs-trigger--with-badge',
    className
  ].filter(Boolean).join(' ');

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(triggerClasses)}
      disabled={disabled}
      {...props}
    >
      <div className="tabs-trigger__background"></div>
      <div className="tabs-trigger__content">
        {icon && <span className="tabs-trigger__icon">{icon}</span>}
        <span className="tabs-trigger__text">{props.children}</span>
        {badge && <span className="tabs-trigger__badge">{badge}</span>}
      </div>
      <div className="tabs-trigger__indicator"></div>
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({
  className,
  animated = true,
  ...props
}) {
  const contentClasses = [
    'tabs-content',
    animated && 'tabs-content--animated',
    className
  ].filter(Boolean).join(' ');

  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(contentClasses)}
      {...props} />
  );
}

Tabs.propTypes = {
  className: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'pills', 'underline', 'minimal']),
  orientation: PropTypes.oneOf(['horizontal', 'vertical']),
  animated: PropTypes.bool,
};

TabsList.propTypes = {
  className: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'outlined', 'filled']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  glow: PropTypes.bool,
  children: PropTypes.node,
};

TabsTrigger.propTypes = {
  className: PropTypes.string,
  icon: PropTypes.node,
  badge: PropTypes.node,
  disabled: PropTypes.bool,
  children: PropTypes.node,
};

TabsContent.propTypes = {
  className: PropTypes.string,
  animated: PropTypes.bool,
  children: PropTypes.node,
};

export { Tabs, TabsList, TabsTrigger, TabsContent }
