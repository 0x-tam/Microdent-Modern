import type {
  TimelineDisplayModel,
  TimelineEvent,
  TimelineNavigateHint,
  TimelineSourceTab,
} from "./patient-timeline-display.js";
import {
  PATIENT_TIMELINE_ROW_ARIA,
  TRUNCATED_LIST_BANNER,
} from "./read-only-ui-copy.js";

export type PatientTimelineProps = {
  model: TimelineDisplayModel;
  onRowClick: (sourceTab: TimelineSourceTab, hint?: TimelineNavigateHint) => void;
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
        </span>
      </button>
    </li>
  );
}

export function PatientTimeline({ model, onRowClick }: PatientTimelineProps) {
  const hasDatedEvents = model.monthGroups.some((g) => g.dayGroups.some((d) => d.events.length > 0));

  return (
    <div className="app-patient-profile__timeline-body" data-testid="patient-timeline-body">
      {model.rangeBanner ? (
        <p className="app-patient-profile__timeline-banner" role="note">
          {model.rangeBanner}
        </p>
      ) : null}
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

      {hasDatedEvents ? (
        model.monthGroups.map((monthGroup) => (
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
      ) : model.eventCount === 0 ? (
        <p className="app-patient-profile__timeline-empty" role="status">
          No dated events in this read-only timeline yet.
        </p>
      ) : null}
    </div>
  );
}

/** Exported for tests — ensure truncated copy stays aligned with shared banner. */
export const TIMELINE_TRUNCATED_BANNER_PREFIX = TRUNCATED_LIST_BANNER;
