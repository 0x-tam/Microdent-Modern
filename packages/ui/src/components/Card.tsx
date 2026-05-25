import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "../util/classNames.js";

export type CardVariant = "default" | "elevated" | "metric" | "hero";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: CardVariant;
};

export function Card({ className, children, variant = "default", ...rest }: CardProps) {
  return (
    <div
      className={classNames(
        "ui-card",
        variant !== "default" && `ui-card--${variant}`,
        className,
      )}
      {...rest}
    >
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

/* ----- Metric display inside a metric card ----- */
export type CardMetricProps = HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: ReactNode;
};

export function CardMetric({ className, label, value, ...rest }: CardMetricProps) {
  return (
    <div className={classNames("ui-card__metric", className)} {...rest}>
      <span className="ui-card__metric-label">{label}</span>
      <span className="ui-card__metric-value">{value}</span>
    </div>
  );
}
