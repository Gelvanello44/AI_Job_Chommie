import * as React from "react"
import PropTypes from 'prop-types';
import { cn } from "@/lib/utils"
import './Card.css';

function Card({
  className,
  variant = 'default',
  glow = false,
  animated = false,
  gradient = false,
  hover = true,
  ...props
}) {
  const cardClasses = [
    'card',
    `card--${variant}`,
    glow && 'card--glow',
    animated && 'card--animated',
    gradient && 'card--gradient',
    hover && 'card--hover',
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      data-slot="card"
      className={cn(cardClasses)}
      {...props}
    >
      <div className="card__background"></div>
      <div className="card__content">
        {props.children}
      </div>
      {glow && <div className="card__glow"></div>}
    </div>
  );
}

function CardHeader({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props} />
  );
}

function CardTitle({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props} />
  );
}

function CardDescription({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props} />
  );
}

function CardAction({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props} />
  );
}

function CardContent({
  className,
  ...props
}) {
  return (<div data-slot="card-content" className={cn("px-6", className)} {...props} />);
}

function CardFooter({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props} />
  );
}

Card.propTypes = {
  className: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'elevated', 'outlined', 'filled']),
  glow: PropTypes.bool,
  animated: PropTypes.bool,
  gradient: PropTypes.bool,
  hover: PropTypes.bool,
  children: PropTypes.node,
};

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
