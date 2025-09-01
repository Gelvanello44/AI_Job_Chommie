import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import PropTypes from 'prop-types';
import { cn } from "@/lib/utils"
import './Select.css';

function Select({
  ...props
}) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({
  ...props
}) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({
  ...props
}) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = "medium",
  variant = "default",
  glow = false,
  children,
  ...props
}) {
  const triggerClasses = [
    'select-trigger',
    `select-trigger--${size}`,
    `select-trigger--${variant}`,
    glow && 'select-trigger--glow',
    className
  ].filter(Boolean).join(' ');

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(triggerClasses)}
      {...props}
    >
      <div className="select-trigger__background"></div>
      <div className="select-trigger__content">
        {children}
      </div>
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="select-trigger__icon" />
      </SelectPrimitive.Icon>
      {glow && <div className="select-trigger__glow"></div>}
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = "popper",
  variant = "default",
  glow = false,
  animated = true,
  ...props
}) {
  const contentClasses = [
    'select-content',
    `select-content--${variant}`,
    glow && 'select-content--glow',
    animated && 'select-content--animated',
    className
  ].filter(Boolean).join(' ');

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(contentClasses)}
        position={position}
        {...props}
      >
        <div className="select-content__background"></div>
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className="select-content__viewport">
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
        {glow && <div className="select-content__glow"></div>}
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props} />
  );
}

function SelectItem({
  className,
  children,
  icon = null,
  ...props
}) {
  const itemClasses = [
    'select-item',
    icon && 'select-item--with-icon',
    className
  ].filter(Boolean).join(' ');

  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(itemClasses)}
      {...props}
    >
      <div className="select-item__content">
        {icon && <span className="select-item__icon">{icon}</span>}
        <SelectPrimitive.ItemText className="select-item__text">
          {children}
        </SelectPrimitive.ItemText>
      </div>
      <span className="select-item__indicator">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="select-item__check" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props} />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}>
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}>
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

SelectTrigger.propTypes = {
  className: PropTypes.string,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  variant: PropTypes.oneOf(['default', 'outlined', 'filled']),
  glow: PropTypes.bool,
  children: PropTypes.node,
};

SelectContent.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  position: PropTypes.oneOf(['item-aligned', 'popper']),
  variant: PropTypes.oneOf(['default', 'elevated']),
  glow: PropTypes.bool,
  animated: PropTypes.bool,
};

SelectItem.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  icon: PropTypes.node,
};

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
