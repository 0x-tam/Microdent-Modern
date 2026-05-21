import type { ReactNode } from "react";

export type ClinicEmptyStateVariant = "default" | "offline" | "blocked";

export type ClinicEmptyStateProps = {
  title: string;
  body: string;
  variant?: ClinicEmptyStateVariant;
  actions?: ReactNode;
  className?: string;
  testId?: string;
};

/** Accent empty panel — title, body, optional CTA row with tone variants. */
export function ClinicEmptyState({
  title,
  body,
  variant = "default",
  actions,
  className,
  testId,
}: ClinicEmptyStateProps) {
  const variantClass =
    variant === "default" ? null : `clinic-empty-state--${variant}`;

  return (
    <div
      className={["clinic-empty-state", variantClass, className].filter(Boolean).join(" ")}
      role="status"
      data-testid={testId}
    >
      <div className="clinic-empty-state__accent" aria-hidden="true" />
      <h3 className="clinic-empty-state__title">{title}</h3>
      <p className="clinic-empty-state__body">{body}</p>
      {actions ? <div className="clinic-empty-state__actions">{actions}</div> : null}
    </div>
  );
}
