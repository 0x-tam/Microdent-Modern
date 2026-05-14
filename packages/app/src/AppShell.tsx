import { useMemo, useState, type ReactNode } from "react";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ReadOnlyBanner,
} from "@microdent/ui";
import { AppErrorBoundary } from "./AppErrorBoundary.js";

export const APP_NAV_MODULES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "patients", label: "Patients" },
  { id: "schedule", label: "Schedule" },
  { id: "dental-chart", label: "Dental Chart" },
  { id: "treatment-plans", label: "Treatment Plans" },
  { id: "payments", label: "Payments" },
  { id: "reports", label: "Reports" },
  { id: "settings", label: "Settings" },
] as const;

export type AppNavModuleId = (typeof APP_NAV_MODULES)[number]["id"];

export type AppShellProps = {
  /** Shown in the top bar; use a clinic name in production. */
  clinicLabel?: string;
  /** Optional slot above the main landmark (e.g. future alerts). */
  topSlot?: ReactNode;
};

function moduleLabel(id: AppNavModuleId): string {
  const m = APP_NAV_MODULES.find((x) => x.id === id);
  return m?.label ?? id;
}

function PlaceholderPanel({ moduleId }: { moduleId: AppNavModuleId }) {
  return (
    <EmptyState
      title={`${moduleLabel(moduleId)} (placeholder)`}
      description="This module is not wired to data yet. The shell is read-only and uses sample copy only."
    />
  );
}

/**
 * Static first-run shell: top bar, global read-only banner, sidebar navigation (local state),
 * bridge-offline placeholder, and a main canvas with an error boundary.
 *
 * **Styles:** the host app must import `@microdent/ui/tokens.css`, `@microdent/ui/components.css`,
 * and `@microdent/app/app-shell.css` before rendering.
 */
export function AppShell({ clinicLabel = "Clinic workspace", topSlot }: AppShellProps) {
  const [active, setActive] = useState<AppNavModuleId>("dashboard");

  const mainHeadingId = "app-main-heading";

  const navButtons = useMemo(
    () =>
      APP_NAV_MODULES.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            className="app-sidebar__btn ui-focusable"
            aria-current={active === m.id ? "true" : undefined}
            aria-controls="app-main-region"
            onClick={() => setActive(m.id)}
          >
            {m.label}
          </button>
        </li>
      )),
    [active],
  );

  return (
    <div className="app-shell">
      <header className="app-topbar" role="banner">
        <div className="app-topbar__left">
          <h1 className="app-brand">Microdent</h1>
          <span className="app-topbar__subtitle">{clinicLabel}</span>
        </div>
        <div className="app-topbar__right">
          <div
            className="app-bridge-pill"
            role="status"
            aria-live="polite"
            aria-label="Local bridge status: offline placeholder"
          >
            <span className="app-bridge-pill__dot" aria-hidden>
              ●
            </span>
            <span>Bridge offline</span>
          </div>
          <Badge variant="neutral" semanticLabel="Build mode: sample data only">
            Sample UI
          </Badge>
        </div>
      </header>

      <div className="app-shell__banner">
        <ReadOnlyBanner>
          Legacy data access is read-only in this phase. No edits are applied to production DBFs from this
          interface.
        </ReadOnlyBanner>
      </div>

      {topSlot}

      <div className="app-shell__body">
        <aside className="app-sidebar" aria-labelledby="sidebar-nav-label">
          <p className="app-sidebar__label" id="sidebar-nav-label">
            Modules
          </p>
          <nav aria-labelledby="sidebar-nav-label">
            <ul className="app-sidebar__nav">{navButtons}</ul>
          </nav>
        </aside>

        <main className="app-main" id="app-main-region" role="main" aria-labelledby={mainHeadingId}>
          <h2 className="app-main__heading" id={mainHeadingId}>
            {moduleLabel(active)}
          </h2>

          <div className="app-main__grid">
            <Card>
              <CardHeader>
                <CardTitle>Local bridge</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="app-bridge-card-hint">
                  <span aria-hidden>⚠ </span>
                  The desktop bridge is not connected yet. When it is available, status will show here before
                  loading any tables. No network calls are made from this shell in Band A6.
                </p>
              </CardBody>
            </Card>

            <AppErrorBoundary>
              <PlaceholderPanel moduleId={active} />
            </AppErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
