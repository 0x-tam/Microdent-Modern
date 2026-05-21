export type AppStatusGridTone = "neutral" | "ok" | "warn" | "danger" | "info" | "healthy" | "critical" | "warning";

export type AppStatusGridItem = {
  key: string;
  label: string;
  value: string;
  tone?: AppStatusGridTone;
  actionLabel?: string;
  onAction?: () => void;
};

export type AppStatusGridProps = {
  items: AppStatusGridItem[];
  className?: string;
  "aria-label"?: string;
};

/** v2 status grid — label + colored chip (+ optional action); replaces dense dl tables. */
export function AppStatusGrid({ items, className, "aria-label": ariaLabel }: AppStatusGridProps) {
  return (
    <div
      className={["app-status-grid", className].filter(Boolean).join(" ")}
      role="region"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const tone = item.tone ?? "neutral";
        const hasAction = Boolean(item.actionLabel && item.onAction);

        return (
          <div
            key={item.key}
            className={[
              "app-status-grid__row",
              `app-status-grid__row--${tone}`,
              hasAction ? "app-status-grid__row--action" : null,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="app-status-grid__label">{item.label}</span>
            <span className={`app-status-grid__chip app-status-grid__chip--${tone}`}>{item.value}</span>
            {hasAction ? (
              <button type="button" className="app-status-grid__action ui-focusable" onClick={item.onAction}>
                {item.actionLabel}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
