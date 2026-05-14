import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "../util/classNames.js";

export type CardProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div className={classNames("ui-card", className)} {...rest}>
      {children}
    </div>
  );
}

export type CardHeaderProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

export function CardHeader({ className, children, ...rest }: CardHeaderProps) {
  return (
    <div className={classNames("ui-card__header", className)} {...rest}>
      {children}
    </div>
  );
}

export type CardTitleProps = HTMLAttributes<HTMLHeadingElement> & { children: ReactNode };

export function CardTitle({ className, children, ...rest }: CardTitleProps) {
  return (
    <h2 className={classNames("ui-card__title", className)} {...rest}>
      {children}
    </h2>
  );
}

export type CardBodyProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  flush?: boolean;
};

export function CardBody({ className, children, flush, ...rest }: CardBodyProps) {
  return (
    <div className={classNames("ui-card__body", flush && "ui-card__body--flush", className)} {...rest}>
      {children}
    </div>
  );
}

export type CardFooterProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

export function CardFooter({ className, children, ...rest }: CardFooterProps) {
  return (
    <div className={classNames("ui-card__footer", className)} {...rest}>
      {children}
    </div>
  );
}
