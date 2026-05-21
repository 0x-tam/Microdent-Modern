import type { ReactNode } from "react";

export type AppMetricTileTone = "neutral" | "emphasis" | "success" | "info" | "warning" | "danger";

export type AppMetricTileProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: AppMetricTileTone;
  className?: string;
};

/** v2 metric tile — bold value on elevated white surface with tone accent. */
export function AppMetricTile({ label, value, hint, tone = "neutral", className }: AppMetricTileProps) {
  const toneClass = tone === "neutral" ? null : `app-metric-tile--${tone}`;

  return (
    <div className={["app-metric-tile", toneClass, className].filter(Boolean).join(" ")}>
      <p className="app-metric-tile__label">{label}</p>
      <p className="app-metric-tile__value">{value}</p>
      {hint ? <p className="app-metric-tile__hint">{hint}</p> : null}
    </div>
  );
}
