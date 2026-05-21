export type ClinicStatusTone = "neutral" | "ok" | "warn" | "danger" | "info";

export type ClinicStatusRowItem = {
  key: string;
  label: string;
  value: string;
  tone?: ClinicStatusTone;
  actionLabel?: string;
  onAction?: () => void;
};

export type ClinicStatusGridProps = {
  items: ClinicStatusRowItem[];
  className?: string;
  "aria-label"?: string;
};

function resolvePillTone(tone: ClinicStatusTone): string {
  return tone === "neutral" ? "clinic-status-pill--neutral" : `clinic-status-pill--${tone}`;
}

/** Compact status row — label + colored pill (+ optional action). */
export function ClinicStatusRow({
  label,
  value,
  tone = "neutral",
  actionLabel,
  onAction,
}: Omit<ClinicStatusRowItem, "key">) {
  const hasAction = Boolean(actionLabel && onAction);

  return (
    <div
      className={[
        "clinic-status-row",
        hasAction ? "clinic-status-row--action" : null,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="clinic-status-row__label">{label}</span>
      <span className={["clinic-status-pill", resolvePillTone(tone)].join(" ")}>{value}</span>
      {hasAction ? (
        <button type="button" className="ui-focusable" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

/** Grid of {@link ClinicStatusRow} items — replaces dense status tables. */
export function ClinicStatusGrid({ items, className, "aria-label": ariaLabel }: ClinicStatusGridProps) {
  return (
    <div
      className={["clinic-status-grid", className].filter(Boolean).join(" ")}
      role="region"
      aria-label={ariaLabel}
    >
      {items.map(({ key, ...item }) => (
        <ClinicStatusRow key={key} {...item} />
      ))}
    </div>
  );
}
