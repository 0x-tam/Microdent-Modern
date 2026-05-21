import type { ReactNode } from "react";

export type ClinicPanelProps = {
  title?: string;
  headerActions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  testId?: string;
};

/** Elevated white panel with optional header, body, and footer regions. */
export function ClinicPanel({
  title,
  headerActions,
  children,
  footer,
  className,
  bodyClassName,
  testId,
}: ClinicPanelProps) {
  const hasHeader = Boolean(title || headerActions);

  return (
    <section className={["clinic-panel", className].filter(Boolean).join(" ")} data-testid={testId}>
      {hasHeader ? (
        <header className="clinic-panel-header">
          {title ? <h2 className="clinic-panel-header__title">{title}</h2> : null}
          {headerActions ? <div className="clinic-panel-header__actions">{headerActions}</div> : null}
        </header>
      ) : null}
      <div className={["clinic-panel__body", bodyClassName].filter(Boolean).join(" ")}>{children}</div>
      {footer ? <footer className="clinic-panel__footer">{footer}</footer> : null}
    </section>
  );
}
