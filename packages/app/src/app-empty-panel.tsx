import type { ReactNode } from "react";

export type AppEmptyPanelVariant =
  | "default"
  | "offline"
  | "empty-schedule"
  | "no-patient"
  | "blocked-write";

export type AppEmptyPanelProps = {
  title: string;
  body: string;
  /** Prefer {@link variant} `"offline"`. */
  offline?: boolean;
  variant?: AppEmptyPanelVariant;
  actions?: ReactNode;
  className?: string;
  testId?: string;
};

function resolveVariant(variant: AppEmptyPanelVariant | undefined, offline: boolean): AppEmptyPanelVariant {
  if (variant) return variant;
  return offline ? "offline" : "default";
}

/** Shared empty / offline / blocked panel — clinical wash + title + body (+ optional actions). */
export function AppEmptyPanel({
  title,
  body,
  offline = false,
  variant,
  actions,
  className,
  testId,
}: AppEmptyPanelProps) {
  const resolved = resolveVariant(variant, offline);
  const variantClass = resolved === "default" ? null : `app-empty-panel--${resolved}`;
  return (
    <div
      className={["app-empty-panel", variantClass, className].filter(Boolean).join(" ")}
      role="status"
      data-testid={testId}
    >
      <h3 className="app-empty-panel__title">{title}</h3>
      <p className="app-empty-panel__body">{body}</p>
      {actions ? <div className="app-empty-panel__actions">{actions}</div> : null}
    </div>
  );
}

export type AppLoadingSkeletonProps = {
  className?: string;
  /** Number of shimmer bars (default 3). */
  lines?: number;
  /** Accessible name for the loading region. */
  label?: string;
};

/** Lightweight loading placeholder — pairs with `.app-skeleton` in workspace-redesign.css. */
export function AppLoadingSkeleton({ className, lines = 3, label = "Loading" }: AppLoadingSkeletonProps) {
  return (
    <div
      className={["app-loading-skeleton", className].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="app-skeleton app-skeleton__line"
          style={{ width: i === lines - 1 ? "68%" : "100%" }}
        />
      ))}
    </div>
  );
}
