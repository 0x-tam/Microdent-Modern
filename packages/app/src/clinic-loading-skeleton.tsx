export type ClinicLoadingSkeletonProps = {
  /** Number of shimmer bars to render. */
  lines?: number;
  className?: string;
  /** Accessible name when no visible loading text is shown. */
  label?: string;
};

/** Shimmer placeholder rows — pairs with `.clinic-loading-skeleton` / `.clinic-skeleton` in clinic-design-system.css. */
export function ClinicLoadingSkeleton({
  lines = 3,
  className,
  label = "Loading",
}: ClinicLoadingSkeletonProps) {
  return (
    <div
      className={["clinic-loading-skeleton", className].filter(Boolean).join(" ")}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className="clinic-skeleton"
          style={index === lines - 1 ? { width: "58%" } : undefined}
        />
      ))}
    </div>
  );
}
