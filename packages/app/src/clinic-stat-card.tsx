import type { ReactNode } from "react";

export type ClinicStatCardTone =
  | "neutral"
  | "teal"
  | "cyan"
  | "green"
  | "amber"
  | "red"
  | "blue";

export type ClinicStatCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: ClinicStatCardTone;
  className?: string;
};

/** Metric card — label, bold value, optional hint on tone surface. */
export function ClinicStatCard({ label, value, hint, tone = "neutral", className }: ClinicStatCardProps) {
  const toneClass = tone === "neutral" ? null : `clinic-stat-card--${tone}`;

  return (
    <div className={["clinic-stat-card", toneClass, className].filter(Boolean).join(" ")}>
      <p className="clinic-stat-card__label">{label}</p>
      <p className="clinic-stat-card__value">{value}</p>
      {hint ? <p className="clinic-stat-card__hint">{hint}</p> : null}
    </div>
  );
}
