import { Button } from "@microdent/ui";
import type {
  TimelineDisplayModel,
  TimelineEvent,
  TimelineKindFilter,
  TimelineNavigateHint,
  TimelineSourceTab,
} from "./patient-timeline-display.js";
import {
  TIMELINE_KIND_FILTER_OPTIONS,
  timelineSourceTabLabel,
} from "./patient-timeline-display.js";
import {
  partitionTimelineEventsByTemporal,
  timelineSummaryBarLine,
  timelineTemporalCounts,
} from "./patient-workspace-intelligence.js";
import {
  FILTER_CLEAR_LABEL,
  PATIENT_TIMELINE_EMPTY_FILTER,
  PATIENT_TIMELINE_EMPTY_RANGE,
  PATIENT_TIMELINE_KIND_FILTER_ARIA,
  PATIENT_TIMELINE_LIMITATIONS,
  PATIENT_TIMELINE_ROW_ARIA,
  PATIENT_TIMELINE_UNDATED_ONLY,
  PATIENT_TIMELINE_VIEW_IN_TAB,
  TRUNCATED_LIST_BANNER,
} from "./read-only-ui-copy.js";

export type PatientTimelineProps = {
  model: TimelineDisplayModel;
  kindFilter: TimelineKindFilter;
  onKindFilterChange: (filter: TimelineKindFilter) => void;
  onRowClick: (sourceTab: TimelineSourceTab, hint?: TimelineNavigateHint) => void;
  /** When true, show exact temporal summary from loaded model. */
  showExactCounts?: boolean;
};

function timelineKindIcon(kind: TimelineEvent["kind"]): string {
  switch (kind) {
    case "appointment":
      return "◷";
    case "treatment":
      return "⚕";
    case "ledger":
      return "▤";
    case "medicalSnapshot":
      return "✚";
    case "profileAnchor":
      return "◎";
    case "chartSnapshot":
      return "▦";
    default:
      return "•";
  }
}

function TimelineRow({
  event,
  onRowClick,
}: {
  event: TimelineEvent;
  onRowClick: PatientTimelineProps["onRowClick"];
}) {
  const tabLabel = timelineSourceTabLabel(event.sourceTab);
  const ariaParts = [event.kindLabel, event.primaryLabel];
  if (event.secondaryLabel) ariaParts.push(event.secondaryLabel);

  return (
    <li>
      <button
        type="button"
        className="app-patient-profile__timeline-row ui-focusable"
        aria-label={`${ariaParts.join(". ")}. ${PATIENT_TIMELINE_ROW_ARIA}.`}
        onClick={() => onRowClick(event.sourceTab, event.navigateHint)}
        data-testid={`patient-timeline-row-${event.eventId}`}
      >
        <span className="app-patient-profile__timeline-row-icon" aria-hidden="true">
          {timelineKindIcon(event.kind)}
        </span>
        <span className="app-patient-profile__timeline-row-body">
          <span className="app-patient-profile__timeline-row-kind">{event.kindLabel}</span>
          <span className="app-patient-profile__timeline-row-primary">{event.primaryLabel}</span>
          {event.secondaryLabel ? (
            <span className="app-patient-profile__timeline-row-secondary">{event.secondaryLabel}</span>
          ) : null}
          <span className="app-patient-profile__timeline-row-action">{PATIENT_TIMELINE_VIEW_IN_TAB(tabLabel)}</span>
        </span>
      </button>
    </li>
  );
}

export function PatientTimeline({
  model,
  kindFilter,
  onKindFilterChange,
  onRowClick,
  showExactCounts = true,
}: PatientTimelineProps) {
  const hasDatedEvents = model.monthGroups.some((g) => g.dayGroups.some((d) => d.events.length > 0));
  const hasFilteredContent = hasDatedEvents || model.snapshotEvents.length > 0;
  const kindFilterActive = kindFilter !== "all";
  const temporalGroups = hasDatedEvents ? partitionTimelineEventsByTemporal(model) : [];
  const temporalCounts = showExactCounts ? timelineTemporalCounts(model) : null;

  return (
    <div className="app-patient-profile__timeline-body" data-testid="patient-timeline-body">
      <div
        className="app-patient-profile__timeline-kind-filters"
        role="group"
        aria-label={PATIENT_TIMELINE_KIND_FILTER_ARIA}
      >
        {TIMELINE_KIND_FILTER_OPTIONS.map((option) => (
          <Button
            key={option.id}
            type="button"
            size="compact"
            variant={kindFilter === option.id ? "primary" : "secondary"}
            className="ui-focusable app-patient-profile__timeline-kind-chip"
            aria-pressed={kindFilter === option.id}
            onClick={() => onKindFilterChange(option.id)}
          >
            {option.label}
          </Button>
        ))}
        {kindFilterActive ? (
          <Button
            type="button"
            size="compact"
            variant="ghost"
            className="ui-focusable app-patient-profile__timeline-clear-filters"
            onClick={() => onKindFilterChange("all")}
          >
            {FILTER_CLEAR_LABEL}
          </Button>
        ) : null}
      </div>

      {temporalCounts ? (
        <p className="app-patient-profile__timeline-summary-bar" role="status" data-testid="patient-timeline-summary-bar">
          {timelineSummaryBarLine(temporalCounts)}
        </p>
      ) : null}

      {model.rangeBanner ? (
        <p className="app-patient-profile__timeline-banner" role="note">
          {model.rangeBanner}
        </p>
      ) : null}
      <p className="app-patient-profile__timeline-limitations" role="note">
        {PATIENT_TIMELINE_LIMITATIONS}
      </p>
      {model.truncatedBanner ? (
        <p className="app-patient-profile__timeline-banner app-patient-profile__timeline-banner--truncated" role="note">
          {model.truncatedBanner}
        </p>
      ) : null}

      {model.snapshotEvents.length > 0 ? (
        <section className="app-patient-profile__timeline-snapshots" aria-label="Undated snapshots">
          <h4 className="app-patient-profile__tab-section-title">Snapshots</h4>
          <ul className="app-patient-profile__timeline-list">
            {model.snapshotEvents.map((event) => (
              <TimelineRow key={event.eventId} event={event} onRowClick={onRowClick} />
            ))}
          </ul>
        </section>
      ) : null}

      {temporalGroups.length > 0
        ? temporalGroups.map((group) => (
            <section
              key={group.section}
              className="app-patient-profile__timeline-temporal-section"
              aria-label={group.heading}
              data-testid={`patient-timeline-section-${group.section}`}
            >
              <h4 className="app-patient-profile__tab-section-title">{group.heading}</h4>
              <ul className="app-patient-profile__timeline-list">
                {group.events.map((event) => (
                  <TimelineRow key={event.eventId} event={event} onRowClick={onRowClick} />
                ))}
              </ul>
            </section>
          ))
        : hasDatedEvents
          ? model.monthGroups.map((monthGroup) => (
              <section
                key={monthGroup.monthKey}
                className="app-patient-profile__timeline-month-group"
                aria-label={monthGroup.heading}
              >
                <h4 className="app-patient-profile__tab-section-title">{monthGroup.heading}</h4>
                {monthGroup.dayGroups.map((dayGroup) => (
                  <div key={`${monthGroup.monthKey}-${dayGroup.dayKey}`} className="app-patient-profile__timeline-day-group">
                    <h5 className="app-patient-profile__timeline-day-heading">{dayGroup.heading}</h5>
                    <ul className="app-patient-profile__timeline-list">
                      {dayGroup.events.map((event) => (
                        <TimelineRow key={event.eventId} event={event} onRowClick={onRowClick} />
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))
          : model.eventCount === 0 ? (
              <p className="app-patient-profile__timeline-empty" role="status">
                {PATIENT_TIMELINE_EMPTY_RANGE}
              </p>
            ) : !hasFilteredContent && kindFilterActive ? (
              <p className="app-patient-profile__timeline-empty" role="status">
                {PATIENT_TIMELINE_EMPTY_FILTER}
              </p>
            ) : !hasDatedEvents && model.snapshotEvents.length === 0 && model.eventCount > 0 ? (
              <p className="app-patient-profile__timeline-empty" role="status">
                {PATIENT_TIMELINE_UNDATED_ONLY}
              </p>
            ) : null}
    </div>
  );
}

/** Exported for tests — ensure truncated copy stays aligned with shared banner. */
export const TIMELINE_TRUNCATED_BANNER_PREFIX = TRUNCATED_LIST_BANNER;
