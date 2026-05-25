import { Button } from "@microdent/ui";
import { ClinicEmptyState } from "./clinic-empty-state.js";
import { ClinicLoadingSkeleton } from "./clinic-loading-skeleton.js";
import { PatientTimeline } from "./patient-timeline.js";
import type {
  TimelineDisplayModel,
  TimelineKindFilter,
  TimelineNavigateHint,
  TimelineSourceTab,
} from "./patient-timeline-display.js";

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

function ProfileTabHiddenNote({
  variant = "default",
}: {
  variant?: "default" | "treatments" | "ledger" | "medical" | "chart" | "timeline";
}) {
  return (
    <p className="app-info-callout app-patient-profile__tab-hidden-note" role="note">
      {variant === "treatments"
        ? "Treatments and procedures are hidden from this view."
        : variant === "ledger"
          ? "Ledger entries are hidden from this view."
          : variant === "medical"
            ? "Medical history is hidden from this view."
            : variant === "chart"
              ? "Chart data is hidden from this view."
              : "Some fields are hidden in read-only mode."}
    </p>
  );
}

function ProfileReadonlyError({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry: () => void;
  retryLabel: string;
}) {
  return (
    <div className="app-readonly-state app-readonly-state--error app-patient-profile__error" role="alert">
      <p>{message}</p>
      <Button type="button" variant="secondary" className="ui-focusable" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}

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
  return (
    <section
      id="patient-panel-timeline"
      role="tabpanel"
      aria-labelledby="patient-tab-timeline"
      className="app-patient-profile__timeline"
      data-testid="patient-panel-timeline"
    >
      <p className="app-patient-profile__timeline-lede">{ledeText}</p>
      <ProfileTabHiddenNote variant="timeline" />

      <div className="app-patient-profile__timeline-controls">
        <Button
          type="button"
          variant="secondary"
          className="ui-focusable"
          onClick={onRefresh}
        >
          Refresh
        </Button>
      </div>

      {isOffline ? (
        <ClinicEmptyState
          variant="offline"
          className="app-patient-profile__empty"
          title={offlineTitle}
          body={offlineBody}
        />
      ) : timelinePhase === "loading" ? (
        <ClinicLoadingSkeleton lines={5} label={loadingLabel} />
      ) : timelinePhase === "error" ? (
        <ProfileReadonlyError
          message={timelineError ?? "An unknown error occurred."}
          onRetry={onRefresh}
          retryLabel={retryLabel}
        />
      ) : timelinePhase === "loaded" && timelineModel ? (
        <PatientTimeline
          model={timelineModel}
          kindFilter={timelineKindFilter}
          onKindFilterChange={onKindFilterChange}
          onRowClick={onTimelineRowClick}
        />
      ) : null}
    </section>
  );
}
