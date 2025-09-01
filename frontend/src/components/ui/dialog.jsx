import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"
import PropTypes from 'prop-types';
import { cn } from "@/lib/utils"
import './Dialog.css';

function Dialog({
  ...props
}) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  variant = 'default',
  blur = true,
  ...props
}) {
  const overlayClasses = [
    'dialog-overlay',
    `dialog-overlay--${variant}`,
    blur && 'dialog-overlay--blur',
    className
  ].filter(Boolean).join(' ');

  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(overlayClasses)}
      {...props} />
  );
}

function DialogContent({
  className,
  children,
  variant = 'default',
  size = 'medium',
  glow = false,
  animated = true,
  showClose = true,
  ...props
}) {
  const contentClasses = [
    'dialog-content',
    `dialog-content--${variant}`,
    `dialog-content--${size}`,
    glow && 'dialog-content--glow',
    animated && 'dialog-content--animated',
    className
  ].filter(Boolean).join(' ');

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(contentClasses)}
        {...props}
      >
        <div className="dialog-content__background"></div>
        <div className="dialog-content__wrapper">
          {children}
        </div>
        
        {showClose && (
          <DialogPrimitive.Close className="dialog-content__close">
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
        
        {glow && <div className="dialog-content__glow"></div>}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({
  className,
  ...props
}) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props} />
  );
}

function DialogFooter({
  className,
  ...props
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props} />
  );
}

function DialogTitle({
  className,
  ...props
}) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props} />
  );
}

function DialogDescription({
  className,
  ...props
}) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props} />
  );
}

DialogOverlay.propTypes = {
  className: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'dark', 'light']),
  blur: PropTypes.bool,
};

DialogContent.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  variant: PropTypes.oneOf(['default', 'elevated', 'minimal']),
  size: PropTypes.oneOf(['small', 'medium', 'large', 'xl']),
  glow: PropTypes.bool,
  animated: PropTypes.bool,
  showClose: PropTypes.bool,
};

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
