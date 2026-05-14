import { useMemo, useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
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

const SIDEBAR_GROUPS: readonly { label: string; modules: readonly AppNavModuleId[] }[] = [
  { label: "Today", modules: ["dashboard", "schedule"] },
  { label: "Patients & clinical", modules: ["patients", "dental-chart"] },
  { label: "Plans & finance", modules: ["treatment-plans", "payments"] },
  { label: "Office", modules: ["reports", "settings"] },
] as const;

const NAV_GLYPH: Record<AppNavModuleId, string> = {
  dashboard: "Db",
  patients: "Pt",
  schedule: "Sc",
  "dental-chart": "Ch",
  "treatment-plans": "Tx",
  payments: "Py",
  reports: "Rp",
  settings: "St",
};

const MODULE_PREVIEW: Record<
  AppNavModuleId,
  { summary: string; bullets: readonly string[]; chip: string }
> = {
  dashboard: {
    summary: "Your morning control room: who is in the clinic, what is next, and what needs a nudge.",
    bullets: [
      "At-a-glance counts for visits, chairs, and follow-ups",
      "Queues that deep-link into Schedule and Patients when data is on",
      "Calm alerts when something needs attention",
    ],
    chip: "Home",
  },
  patients: {
    summary: "Fast lookup and a trustworthy profile for every person you care for.",
    bullets: [
      "Forgiving search with disambiguation fields",
      "Sticky patient header with alerts and balances",
      "Jump straight into charting or booking",
    ],
    chip: "Front desk",
  },
  schedule: {
    summary: "The operational truth for chair time — built for drag efficiency without hiding risk.",
    bullets: [
      "Week-first calendar with resource columns",
      "Clear status story from scheduled to completed",
      "Conflict and overlap warnings before they become surprises",
    ],
    chip: "Operations",
  },
  "dental-chart": {
    summary: "Structured clinical truth with FDI-first notation and audit-friendly history.",
    bullets: [
      "Tooth and surface targets sized for chairside use",
      "Patterns and labels so color is never the only signal",
      "Visit timeline when historical snapshots are available",
    ],
    chip: "Clinical",
  },
  "treatment-plans": {
    summary: "Proposed care pathways patients can understand — phased, priced, and consent-aware.",
    bullets: [
      "Phases that connect to scheduling and ledger",
      "Insurance estimate disclaimers kept visible",
      "Presentation-ready summaries when you are ready to share",
    ],
    chip: "Treatment",
  },
  payments: {
    summary: "A readable ledger so the front desk never has to be an accountant.",
    bullets: [
      "Running balance with insurance vs patient responsibility",
      "Claim status surfaced next to charges",
      "Read-only import tags when data is bridged from legacy",
    ],
    chip: "Finance",
  },
  reports: {
    summary: "Operational and compliance outputs you can trust — with filters that respect roles.",
    bullets: [
      "Catalog grouped by clinical, scheduling, and finance",
      "As-of timestamps and migration footnotes",
      "Exports when policy allows",
    ],
    chip: "Insights",
  },
  settings: {
    summary: "People, places, templates, and integrations — shallow in early phases, deeper when you are ready.",
    bullets: [
      "Role capability visibility so disabled controls make sense",
      "Schedule templates and operatory hours",
      "Integration cards with clear setup steps",
    ],
    chip: "Admin",
  },
};

function moduleLabel(id: AppNavModuleId): string {
  const m = APP_NAV_MODULES.find((x) => x.id === id);
  return m?.label ?? id;
}

function formatTodayLine(): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    }).format(new Date());
  } catch {
    return "Today";
  }
}

function ModuleHome({
  moduleId,
  onOpenModule,
  onBackHome,
}: {
  moduleId: AppNavModuleId;
  onOpenModule: (id: AppNavModuleId) => void;
  onBackHome: () => void;
}) {
  const copy = MODULE_PREVIEW[moduleId];
  return (
    <div className="app-module-home">
      <div className="app-module-home__header">
        <Badge variant="info" semanticLabel={`Module area: ${copy.chip}`}>
          {copy.chip}
        </Badge>
        <p className="app-module-home__summary">
          <strong>{moduleLabel(moduleId)}</strong> — {copy.summary}
        </p>
      </div>

      <ul className="app-module-home__bullets" aria-label="Planned capabilities for this module">
        {copy.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>

      <div className="app-module-home__actions">
        <Button type="button" variant="secondary" className="ui-focusable" onClick={onBackHome}>
          Back to dashboard
        </Button>
        <Button type="button" variant="ghost" className="ui-focusable" onClick={() => onOpenModule("schedule")}>
          Peek at Schedule copy
        </Button>
      </div>

      <AppErrorBoundary>
        <EmptyState
          className="ui-empty--start"
          title="Preview workspace"
          description="This screen is layout-only. No charts, schedules, or ledgers are loaded yet — we are polishing the experience before wiring the bridge."
          actions={
            <Badge variant="neutral" semanticLabel="Build mode: interface sample only">
              Sample UI · no PHI
            </Badge>
          }
        />
      </AppErrorBoundary>
    </div>
  );
}

function DashboardHome({ onOpenModule }: { onOpenModule: (id: AppNavModuleId) => void }) {
  return (
    <div className="app-dashboard">
      <p className="app-dashboard__kicker">
        <span className="app-dashboard__date">{formatTodayLine()}</span>
        <span className="app-dashboard__dot" aria-hidden>
          ·
        </span>
        <span>Preview counts are placeholders only.</span>
      </p>

      <ul className="app-dashboard__stats" aria-label="Sample summary tiles">
        <li>
          <Card className="app-stat-card ui-card--accent">
            <CardBody>
              <p className="app-stat-card__label">Visits on the book</p>
              <p className="app-stat-card__value" aria-label="Not connected">
                —
              </p>
              <p className="app-stat-card__hint">Live total when the schedule is linked</p>
            </CardBody>
          </Card>
        </li>
        <li>
          <Card className="app-stat-card ui-card--accent">
            <CardBody>
              <p className="app-stat-card__label">Chairs in motion</p>
              <p className="app-stat-card__value" aria-label="Not connected">
                —
              </p>
              <p className="app-stat-card__hint">Checked-in visits appear here first</p>
            </CardBody>
          </Card>
        </li>
        <li>
          <Card className="app-stat-card ui-card--accent">
            <CardBody>
              <p className="app-stat-card__label">Follow-ups due</p>
              <p className="app-stat-card__value" aria-label="Not connected">
                —
              </p>
              <p className="app-stat-card__hint">Recare and billing nudges stack here</p>
            </CardBody>
          </Card>
        </li>
        <li>
          <Card className="app-stat-card ui-card--accent">
            <CardBody>
              <p className="app-stat-card__label">New patients (30d)</p>
              <p className="app-stat-card__value" aria-label="Not connected">
                —
              </p>
              <p className="app-stat-card__hint">Marketing-friendly snapshot</p>
            </CardBody>
          </Card>
        </li>
      </ul>

      <div className="app-dashboard__split">
        <Card className="app-next-card">
          <CardHeader>
            <p className="ui-card__title">Next on the floor</p>
            <Badge variant="neutral" semanticLabel="Sample queue rows">
              Sample queue
            </Badge>
          </CardHeader>
          <CardBody>
            <ol className="app-next-list">
              <li>
                <span className="app-next-list__time">10:30</span>
                <span className="app-next-list__body">
                  <span className="app-next-list__title">Recall visit · Chair 2</span>
                  <span className="app-next-list__meta">Preview row · no real patient</span>
                </span>
                <Badge variant="info" semanticLabel="Visit status: scheduled (sample)">
                  Scheduled
                </Badge>
              </li>
              <li>
                <span className="app-next-list__time">11:15</span>
                <span className="app-next-list__body">
                  <span className="app-next-list__title">New patient exam · Chair 1</span>
                  <span className="app-next-list__meta">Preview row · generic copy</span>
                </span>
                <Badge variant="success" semanticLabel="Visit status: confirmed (sample)">
                  Confirmed
                </Badge>
              </li>
              <li>
                <span className="app-next-list__time">1:00 PM</span>
                <span className="app-next-list__body">
                  <span className="app-next-list__title">Restorative block · Chair 3</span>
                  <span className="app-next-list__meta">Preview row · placeholder</span>
                </span>
                <Badge variant="warning" semanticLabel="Visit status: needs insurance check (sample)">
                  Verify benefits
                </Badge>
              </li>
            </ol>
            <div className="app-next-card__footer">
              <Button type="button" variant="primary" className="ui-focusable" onClick={() => onOpenModule("schedule")}>
                Open Schedule module
              </Button>
              <Button type="button" variant="ghost" className="ui-focusable" onClick={() => onOpenModule("patients")}>
                Review Patients copy
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card className="app-bridge-card">
          <CardHeader>
            <p className="ui-card__title">Local desktop bridge</p>
            <Badge variant="warning" semanticLabel="Bridge status: not connected">
              Waiting
            </Badge>
          </CardHeader>
          <CardBody>
            <p className="app-bridge-card__lead">
              The bridge is the narrow door between this workspace and your on-prem data. It is not running in this
              preview, so everything you see is intentionally static.
            </p>
            <ol className="app-bridge-card__steps">
              <li>Start the bridge service on the clinic workstation.</li>
              <li>Confirm it listens on the loopback address your IT team assigns.</li>
              <li>Watch this card flip to “Connected” before any live tables load.</li>
            </ol>
            <p className="app-bridge-card__note">
              <strong>No network calls</strong> are made from this shell in the preview build — safe for demos and
              screenshots.
            </p>
          </CardBody>
        </Card>
      </div>

      <section className="app-dashboard__modules" aria-labelledby="app-module-tiles-heading">
        <div className="app-dashboard__modules-head">
          <h3 className="app-dashboard__modules-title" id="app-module-tiles-heading">
            Jump to a workspace area
          </h3>
          <p className="app-dashboard__modules-desc">
            Each tile opens the same polished placeholder with context for that team — pick what you want to critique
            first.
          </p>
        </div>
        <div className="app-module-tiles">
          {APP_NAV_MODULES.filter((m) => m.id !== "dashboard").map((m) => (
            <button
              key={m.id}
              type="button"
              className={`app-module-tile ui-focusable app-module-tile--${m.id}`}
              onClick={() => onOpenModule(m.id)}
            >
              <span className="app-module-tile__glyph" aria-hidden>
                {NAV_GLYPH[m.id]}
              </span>
              <span className="app-module-tile__text">
                <span className="app-module-tile__label">{m.label}</span>
                <span className="app-module-tile__hint">{MODULE_PREVIEW[m.id].chip}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
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

  const sidebar = useMemo(
    () =>
      SIDEBAR_GROUPS.map((group) => (
        <div key={group.label} className="app-sidebar__group">
          <p className="app-sidebar__group-label">{group.label}</p>
          <ul className="app-sidebar__nav">
            {group.modules.map((id) => {
              const m = APP_NAV_MODULES.find((x) => x.id === id);
              if (!m) return null;
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={`app-sidebar__btn ui-focusable app-sidebar__btn--${id}`}
                    aria-current={active === id ? "true" : undefined}
                    aria-controls="app-main-region"
                    onClick={() => setActive(id)}
                  >
                    <span className="app-sidebar__glyph" aria-hidden>
                      {NAV_GLYPH[id]}
                    </span>
                    <span className="app-sidebar__label-text">{m.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )),
    [active],
  );

  return (
    <div className="app-shell">
      <header className="app-topbar" role="banner">
        <div className="app-topbar__left">
          <div className="app-brand-block">
            <p className="app-brand-kicker">Dental clinic workspace</p>
            <div className="app-brand-row">
              <h1 className="app-brand">Microdent</h1>
              <span className="app-topbar__subtitle">{clinicLabel}</span>
            </div>
          </div>
        </div>

        <div className="app-topbar__mid" role="note" aria-label="Patient search preview (not interactive yet)">
          <span className="app-search-teaser__glyph" aria-hidden>
            ⌕
          </span>
          <span className="app-search-teaser__text">Search patients, visits, and ledger lines…</span>
          <Badge variant="neutral" semanticLabel="Feature status: not available in this preview">
            Soon
          </Badge>
        </div>

        <div className="app-topbar__right">
          <div
            className="app-bridge-pill"
            role="status"
            aria-live="polite"
            aria-label="Local bridge status: idle, not connected to clinic data"
          >
            <span className="app-bridge-pill__dot" aria-hidden>
              ●
            </span>
            <span className="app-bridge-pill__text">
              <span className="app-bridge-pill__main">Local bridge idle</span>
              <span className="app-bridge-pill__sub">No clinic link yet</span>
            </span>
          </div>
          <Badge variant="info" semanticLabel="Build mode: sample interface only">
            Preview UI
          </Badge>
        </div>
      </header>

      <div className="app-shell__banner">
        <ReadOnlyBanner>
          You are in an interface that stays <em>read-first</em> until write paths are approved. Legacy DBFs are not
          edited from here, and nothing in this preview is patient-identifiable.
        </ReadOnlyBanner>
      </div>

      {topSlot}

      <div className="app-shell__body">
        <aside className="app-sidebar" aria-labelledby="sidebar-nav-label">
          <div className="app-sidebar__head">
            <p className="app-sidebar__label" id="sidebar-nav-label">
              Navigate
            </p>
            <p className="app-sidebar__hint">Keyboard-friendly · same order as production rail</p>
          </div>
          <nav aria-labelledby="sidebar-nav-label">{sidebar}</nav>
        </aside>

        <main className="app-main" id="app-main-region" role="main" aria-labelledby={mainHeadingId}>
          <div className="app-main__head">
            <h2 className="app-main__heading" id={mainHeadingId}>
              {moduleLabel(active)}
            </h2>
            {active === "dashboard" ? (
              <p className="app-main__lede">A calmer morning view for the whole team — tuned for front desk speed.</p>
            ) : (
              <p className="app-main__lede">Context for {moduleLabel(active)} while data wiring lands.</p>
            )}
          </div>

          <div className="app-main__content">
            {active === "dashboard" ? (
              <DashboardHome onOpenModule={setActive} />
            ) : (
              <ModuleHome moduleId={active} onOpenModule={setActive} onBackHome={() => setActive("dashboard")} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
