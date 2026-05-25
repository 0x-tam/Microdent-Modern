import { Button, EmptyState } from "@microdent/ui";
import { PatientTimeline } from "./patient-timeline.js";
import type {
  TimelineDisplayModel,
  TimelineKindFilter,
  TimelineNavigateHint,
  TimelineSourceTab,
} from "./patient-timeline-display.js";
import { TIMELINE_KIND_FILTER_OPTIONS } from "./patient-timeline-display.js";

/** Timeline tab state passed from the parent panel. */
export type TimelineTabLoadPhase = "idle" | "offline" | "loading" | "loaded" | "error";

export type PatientTimelineTabProps = {
  /** Built timeline display model (null when not loaded or filtered out). */
  timelineModel: TimelineDisplayModel | null;
  /** Current kind filter selection. */
  timelineKindFilter: TimelineKindFilter;
  /** Callback when user changes the kind filter. */
  onKindFilterChange: (filter: TimelineKindFilter) => void;
  /** Callback when a timeline row is clicked (navigates to source tab). */
  onTimelineRowClick: (sourceTab: TimelineSourceTab, hint?: TimelineNavigateHint) => void;
  /** Callback to refresh timeline data. */
  onRefresh: () => void;
  /** Current load phase of the timeline data. */
  timelinePhase: TimelineTabLoadPhase;
  /** Error message when phase is 'error'. */
  timelineError: string | null;
  /** Whether the clinic service is offline (overrides other states). */
  isOffline: boolean;
  /** Copy constants (from read-only-ui-copy for decoupling). */
  ledeText: string;
  loadingLabel: string;
  offlineTitle: string;
  offlineBody: string;
  retryLabel: string;
};

/* ------------------------------------------------------------------ */
/* Kind-filter segmented control (pill buttons)                       */
/* ------------------------------------------------------------------ */

/** Accent color per kind for the segmented control active state. */
function kindAccentClass(kind: TimelineKindFilter): string {
  switch (kind) {
    case "appointments":
      return "app-timeline-kind-pill--teal";
    case "treatments":
      return "app-timeline-kind-pill--cyan";
    case "chartMetadata":
      return "app-timeline-kind-pill--blue";
    case "medicalStatus":
      return "app-timeline-kind-pill--green";
    case "ledgerMetadata":
      return "app-timeline-kind-pill--amber";
    default:
      return "app-timeline-kind-pill--all";
  }
}

function KindFilterSegmented({
  filter,
  onChange,
}: {
  filter: TimelineKindFilter;
  onChange: (f: TimelineKindFilter) => void;
}) {
  return (
    <div
      className="app-timeline-kind-segmented"
      role="group"
      aria-label="Filter timeline events by kind"
    >
      {TIMELINE_KIND_FILTER_OPTIONS.map((option) => {
        const active = filter === option.id;
        return (
          <button
            key={option.id}
            type="button"
            className={[
              "app-timeline-kind-pill ui-focusable",
              active ? `app-timeline-kind-pill--active ${kindAccentClass(option.id)}` : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={active}
            data-kind={option.id}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
      {filter !== "all" ? (
        <button
          type="button"
          className="app-timeline-kind-pill app-timeline-kind-pill--clear ui-focusable"
          onClick={() => onChange("all")}
        >
          ✕ Clear
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Truncated banner (compact)                                         */
/* ------------------------------------------------------------------ */

function TruncatedBanner({ model }: { model: TimelineDisplayModel }) {
  if (!model.truncatedBanner) return null;
  return (
    <div className="app-timeline-truncated-banner" role="note">
      <span className="app-timeline-truncated-banner__icon" aria-hidden>
        ⋯
      </span>
      <span className="app-timeline-truncated-banner__text">{model.truncatedBanner}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export function PatientTimelineTab({
  timelineModel,
  timelineKindFilter,
  onKindFilterChange,
  onTimelineRowClick,
  onRefresh,
  timelinePhase,
  timelineError,
  isOffline,
  ledeText,
  loadingLabel,
  offlineTitle,
  offlineBody,
  retryLabel,
}: PatientTimelineTabProps) {
  /* ---- Loading state ---- */
  if (timelinePhase === "loading") {
    return (
      <section
        id="patient-panel-timeline"
        role="tabpanel"
        aria-labelledby="patient-tab-timeline"
        className="app-patient-profile__timeline"
        data-testid="patient-panel-timeline"
      >
        <EmptyState
          variant="loading"
          title={loadingLabel}
          description="Building your patient timeline…"
        />
      </section>
    );
  }

  /* ---- Offline state ---- */
  if (isOffline) {
    return (
      <section
        id="patient-panel-timeline"
        role="tabpanel"
        aria-labelledby="patient-tab-timeline"
        className="app-patient-profile__timeline"
        data-testid="patient-panel-timeline"
      >
        <EmptyState
          variant="offline"
          title={offlineTitle}
          description={offlineBody}
          actions={
            <Button
              type="button"
              variant="secondary"
              className="ui-focusable"
              onClick={onRefresh}
            >
              {retryLabel}
            </Button>
          }
        />
      </section>
    );
  }

  /* ---- Error state ---- */
  if (timelinePhase === "error") {
    return (
      <section
        id="patient-panel-timeline"
        role="tabpanel"
        aria-labelledby="patient-tab-timeline"
        className="app-patient-profile__timeline"
        data-testid="patient-panel-timeline"
      >
        <EmptyState
          variant="error"
          title="Timeline unavailable"
          description={timelineError ?? "An unknown error occurred while loading the timeline."}
          actions={
            <Button
              type="button"
              variant="secondary"
              className="ui-focusable"
              onClick={onRefresh}
            >
              {retryLabel}
            </Button>
          }
        />
      </section>
    );
  }

  /* ---- Loaded / idle with data ---- */
  return (
    <section
      id="patient-panel-timeline"
      role="tabpanel"
      aria-labelledby="patient-tab-timeline"
      className="app-patient-profile__timeline"
      data-testid="patient-panel-timeline"
    >
      {/* Header */}
      <header className="app-timeline-header">
        <h2 className="app-timeline-header__title">Patient Timeline</h2>
        <p className="app-timeline-header__subtitle">{ledeText}</p>
      </header>

      {/* Kind filters — segmented control */}
      <KindFilterSegmented filter={timelineKindFilter} onChange={onKindFilterChange} />

      {/* Toolbar (refresh) */}
      <div className="app-patient-profile__timeline-controls">
        <Button
          type="button"
          variant="ghost"
          size="compact"
          className="ui-focusable app-timeline-refresh-btn"
          onClick={onRefresh}
        >
          ↻ Refresh
        </Button>
      </div>

      {/* Truncated banner */}
      {timelineModel ? <TruncatedBanner model={timelineModel} /> : null}

      {/* Timeline body — delegate to existing PatientTimeline */}
      {timelinePhase === "loaded" && timelineModel ? (
        <PatientTimeline
          model={timelineModel}
          kindFilter={timelineKindFilter}
          onKindFilterChange={onKindFilterChange}
          onRowClick={onTimelineRowClick}
        />
      ) : (
        <EmptyState
          variant="empty"
          title="No timeline data"
          description="Timeline data is not available yet. Try refreshing."
          actions={
            <Button
              type="button"
              variant="secondary"
              className="ui-focusable"
              onClick={onRefresh}
            >
              {retryLabel}
            </Button>
          }
        />
      )}
    </section>
  );
}
