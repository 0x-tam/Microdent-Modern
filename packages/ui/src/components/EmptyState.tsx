import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "../util/classNames.js";

export type EmptyStateVariant = "empty" | "offline" | "error" | "loading";

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  variant?: EmptyStateVariant;
  /** Icon (emoji) displayed above the title. */
  icon?: ReactNode;
  title: string;
  description: string;
  /** Primary / secondary actions (e.g. `<Button>`). */
  actions?: ReactNode;
};

const defaultIcons: Record<EmptyStateVariant, string> = {
  empty: "📋",
  offline: "📡",
  error: "⚠️",
  loading: "⏳",
};

const variantClass: Record<EmptyStateVariant, string> = {
  empty: "ui-empty",
  offline: "ui-empty ui-empty--offline",
  error: "ui-empty ui-empty--error",
  loading: "ui-empty ui-empty--loading",
};

export function EmptyState({
  variant = "empty",
  icon,
  title,
  description,
  actions,
  className,
  ...rest
}: EmptyStateProps) {
  const displayIcon = icon ?? defaultIcons[variant];

  return (
    <div
      className={classNames(variantClass[variant], className)}
      role="region"
      aria-label={title}
      {...rest}
    >
      {displayIcon && (
        <div className="ui-empty__icon" aria-hidden>
          {displayIcon}
        </div>
      )}
      <p className="ui-empty__title">{title}</p>
      <p className="ui-empty__desc">{description}</p>
      {actions ? <div className="ui-empty__actions">{actions}</div> : null}
    </div>
  );
}
