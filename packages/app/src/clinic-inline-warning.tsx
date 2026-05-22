import type { ReactNode } from "react";

export type ClinicInlineWarningTone = "info" | "warning" | "danger";

export type ClinicInlineWarningProps = {
  /** Optional short heading (clinic-friendly). */
  label?: string;
  children: ReactNode;
  tone?: ClinicInlineWarningTone;
  className?: string;
};

/**
 * Panel-internal warning (stale local copy, schedule unavailable, etc.).
 * Not a full-width shell status strip — use inside `ClinicPanel` bodies.
 */
export function ClinicInlineWarning({
  label,
  children,
  tone = "warning",
  className,
}: ClinicInlineWarningProps) {
  const rootClass = ["clinic-inline-warning", `clinic-inline-warning--${tone}`, className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={rootClass} role="status">
      {label ? <span className="clinic-inline-warning__label">{label}</span> : null}
      <span className="clinic-inline-warning__body">{children}</span>
    </div>
  );
}
