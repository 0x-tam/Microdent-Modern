import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "../util/classNames.js";

export type BadgeVariant =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "readonly"
  | "stale";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  /** Full accessible name, e.g. "Status: Confirmed" — avoids color-only meaning. */
  semanticLabel: string;
  children: ReactNode;
};

const variantClass: Record<BadgeVariant, string> = {
  neutral: "ui-badge--neutral",
  success: "ui-badge--success",
  warning: "ui-badge--warning",
  danger: "ui-badge--danger",
  info: "ui-badge--info",
  readonly: "ui-badge--readonly",
  stale: "ui-badge--stale",
};

export function Badge({ variant = "neutral", semanticLabel, className, children, ...rest }: BadgeProps) {
  return (
    <span
      role="status"
      aria-label={semanticLabel}
      className={classNames("ui-badge", variantClass[variant], className)}
      {...rest}
    >
      <span className="ui-badge__dot" aria-hidden>
        ●
      </span>
      <span>{children}</span>
    </span>
  );
}
