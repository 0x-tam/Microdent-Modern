import { Button } from "@microdent/ui";
import type { ScheduleAppointmentItem } from "@microdent/contracts";
import {
  appointmentVisitMeta,
  formatPatientApptNextUpcoming,
  findNextUpcomingPatientAppointment,
  patientApptRangeCountLabel,
  roomDisplayLabel,
  type RoomLabelMap,
} from "./patient-appointments-display.js";
import type { ProcedureReferenceMaps } from "./procedure-reference.js";
import {
  PATIENT_SUMMARY_CROSS_TAB_ARIA,
  PATIENT_SUMMARY_MINI_CARD_APPOINTMENTS,
  PATIENT_SUMMARY_MINI_CARD_CHART,
  PATIENT_SUMMARY_MINI_CARD_LEDGER,
  PATIENT_SUMMARY_MINI_CARD_MEDICAL,
  PATIENT_SUMMARY_MINI_CARD_TREATMENTS,
  PATIENT_SUMMARY_MINI_CARD_TIMELINE,
  PATIENT_SUMMARY_MINI_EMPTY,
  PATIENT_SUMMARY_MINI_LOADING,
  PATIENT_SUMMARY_MINI_NO_RECORD,
  PATIENT_SUMMARY_MINI_SENSITIVE,
  PATIENT_SUMMARY_MINI_TRUNCATED,
  PATIENT_SUMMARY_MINI_UNAVAILABLE,
  patientSummaryViewTabLabel,
  patientSummaryCrossTabWithCount,
  PATIENT_SUMMARY_TIMELINE_ABOUT_COUNT,
  PATIENT_SUMMARY_TIMELINE_EXACT_COUNT,
} from "./read-only-ui-copy.js";

export type ProfileTab = "summary" | "timeline" | "appointments" | "medical" | "treatments" | "chart" | "ledger";

const SUMMARY_CROSS_TABS: readonly { id: Exclude<ProfileTab, "summary">; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "appointments", label: "Appointments" },
  { id: "medical", label: "Medical" },
  { id: "treatments", label: "Treatments" },
  { id: "chart", label: "Chart" },
  { id: "ledger", label: "Ledger preview" },
];

export type SummaryMiniCardPhase = "idle" | "loading" | "loaded" | "empty" | "error" | "offline";

export type SummaryApptPrefetch = {
  phase: SummaryMiniCardPhase;
  appointments: ScheduleAppointmentItem[];
};

export type SummaryMedPrefetch = {
  phase: SummaryMiniCardPhase;
  hasMedicalRecord: boolean;
  flaggedConditionCount: number;
  sensitive: boolean;
};

export type SummaryCountPrefetch = {
  phase: SummaryMiniCardPhase;
  count: number;
  truncated: boolean;
};

export type PatientSummaryMiniCardsProps = {
  appt: SummaryApptPrefetch;
  medical: SummaryMedPrefetch;
  treatments: SummaryCountPrefetch;
  chart: SummaryCountPrefetch;
  ledger: SummaryCountPrefetch;
  timeline?: SummaryCountPrefetch;
  /** Exact timeline count when Timeline tab has loaded; otherwise about-count from prefetches. */
  timelineExactCount?: number | null;
  doctorLabels?: ReadonlyMap<string, string>;
  procedureMaps?: ProcedureReferenceMaps;
  roomMap?: RoomLabelMap;
  onOpenTab: (tab: ProfileTab) => void;
};

function miniCardSkeleton(title: string) {
  return (
    <div className="app-patient-profile__summary-mini-card app-patient-profile__summary-mini-card--loading">
      <p className="app-patient-profile__summary-mini-card-title">{title}</p>
      <p className="app-patient-profile__summary-mini-card-muted" aria-busy="true">
        {PATIENT_SUMMARY_MINI_LOADING}
      </p>
    </div>
  );
}

function SummaryMiniCardButton({
  title,
  detail,
  tab,
  onOpenTab,
}: {
  title: string;
  detail: string;
  tab: ProfileTab;
  onOpenTab: (tab: ProfileTab) => void;
}) {
  return (
    <button
      type="button"
      className="app-patient-profile__summary-mini-card ui-focusable"
      onClick={() => onOpenTab(tab)}
      aria-label={`${title}. ${detail}. Open tab.`}
    >
      <p className="app-patient-profile__summary-mini-card-title">{title}</p>
      <p className="app-patient-profile__summary-mini-card-detail">{detail}</p>
    </button>
  );
}

function appointmentsDetail(
  appt: SummaryApptPrefetch,
  doctorLabels: ReadonlyMap<string, string>,
  procedureMaps: ProcedureReferenceMaps | undefined,
  roomMap: RoomLabelMap,
): string {
  if (appt.phase === "loading" || appt.phase === "idle") {
    return PATIENT_SUMMARY_MINI_LOADING;
  }
  if (appt.phase === "offline" || appt.phase === "error") {
    return PATIENT_SUMMARY_MINI_UNAVAILABLE;
  }
  const countLabel = patientApptRangeCountLabel(appt.appointments.length);
  if (appt.phase === "empty" || appt.appointments.length === 0) {
    return `${countLabel} · ${PATIENT_SUMMARY_MINI_EMPTY}`;
  }
  const next = findNextUpcomingPatientAppointment(appt.appointments);
  if (next) {
    const visitMeta = appointmentVisitMeta(next, doctorLabels, procedureMaps, {
      includeRoom: false,
      roomLabel: roomDisplayLabel(next.room, roomMap),
    });
    const nextLine = formatPatientApptNextUpcoming(next);
    if (visitMeta.length > 0) {
      return `${countLabel} · ${nextLine} · ${visitMeta}`;
    }
    return `${countLabel} · ${nextLine}`;
  }
  return countLabel;
}

function medicalDetail(med: SummaryMedPrefetch): string {
  if (med.phase === "loading" || med.phase === "idle") {
    return PATIENT_SUMMARY_MINI_LOADING;
  }
  if (med.phase === "offline" || med.phase === "error") {
    return PATIENT_SUMMARY_MINI_UNAVAILABLE;
  }
  if (!med.hasMedicalRecord) {
    return PATIENT_SUMMARY_MINI_NO_RECORD;
  }
  if (med.sensitive) {
    return `${med.flaggedConditionCount} flagged · ${PATIENT_SUMMARY_MINI_SENSITIVE}`;
  }
  if (med.flaggedConditionCount === 0) {
    return "Screening on file · no flags marked yes";
  }
  return `${med.flaggedConditionCount} screening flag${med.flaggedConditionCount === 1 ? "" : "s"} marked yes`;
}

function countDetail(prefetch: SummaryCountPrefetch, emptyLabel: string): string {
  if (prefetch.phase === "loading" || prefetch.phase === "idle") {
    return PATIENT_SUMMARY_MINI_LOADING;
  }
  if (prefetch.phase === "offline" || prefetch.phase === "error") {
    return PATIENT_SUMMARY_MINI_UNAVAILABLE;
  }
  if (prefetch.phase === "empty" || prefetch.count === 0) {
    return emptyLabel;
  }
  const suffix = prefetch.truncated ? ` · ${PATIENT_SUMMARY_MINI_TRUNCATED}` : "";
  return `${prefetch.count} entr${prefetch.count === 1 ? "y" : "ies"}${suffix}`;
}

function timelineDetail(timeline: SummaryCountPrefetch | undefined, exactCount: number | null | undefined): string {
  if (exactCount !== null && exactCount !== undefined) {
    return PATIENT_SUMMARY_TIMELINE_EXACT_COUNT(exactCount);
  }
  if (!timeline || timeline.phase === "loading" || timeline.phase === "idle") {
    return PATIENT_SUMMARY_MINI_LOADING;
  }
  if (timeline.phase === "offline" || timeline.phase === "error") {
    return PATIENT_SUMMARY_MINI_UNAVAILABLE;
  }
  if (timeline.phase === "empty" || timeline.count === 0) {
    return "No merged events yet";
  }
  const suffix = timeline.truncated ? ` · ${PATIENT_SUMMARY_MINI_TRUNCATED}` : "";
  return `${PATIENT_SUMMARY_TIMELINE_ABOUT_COUNT(timeline.count)}${suffix}`;
}

function crossTabCount(
  tabId: Exclude<ProfileTab, "summary">,
  props: Pick<
    PatientSummaryMiniCardsProps,
    "appt" | "medical" | "treatments" | "chart" | "ledger" | "timeline" | "timelineExactCount"
  >,
): number | null {
  switch (tabId) {
    case "appointments":
      return props.appt.phase === "loaded" ? props.appt.appointments.length : null;
    case "treatments":
      return props.treatments.phase === "loaded" ? props.treatments.count : null;
    case "chart":
      return props.chart.phase === "loaded" ? props.chart.count : null;
    case "ledger":
      return props.ledger.phase === "loaded" ? props.ledger.count : null;
    case "timeline":
      if (props.timelineExactCount !== null && props.timelineExactCount !== undefined) {
        return props.timelineExactCount;
      }
      return props.timeline?.phase === "loaded" ? props.timeline.count : null;
    case "medical":
      return props.medical.phase === "loaded" && props.medical.hasMedicalRecord ? 1 : null;
    default:
      return null;
  }
}

export function PatientSummaryMiniCards({
  appt,
  medical,
  treatments,
  chart,
  ledger,
  timeline,
  timelineExactCount = null,
  doctorLabels = new Map(),
  procedureMaps,
  roomMap = new Map(),
  onOpenTab,
}: PatientSummaryMiniCardsProps) {
  const crossTabs = SUMMARY_CROSS_TABS;
  const crossTabProps = { appt, medical, treatments, chart, ledger, timeline, timelineExactCount };

  return (
    <div className="app-patient-profile__summary-workspace">
      <div className="app-patient-profile__summary-mini-grid" aria-label="Patient record overview">
        {appt.phase === "loading" || appt.phase === "idle" ? (
          miniCardSkeleton(PATIENT_SUMMARY_MINI_CARD_APPOINTMENTS)
        ) : (
          <SummaryMiniCardButton
            title={PATIENT_SUMMARY_MINI_CARD_APPOINTMENTS}
            detail={appointmentsDetail(appt, doctorLabels, procedureMaps, roomMap)}
            tab="appointments"
            onOpenTab={onOpenTab}
          />
        )}

        {medical.phase === "loading" || medical.phase === "idle" ? (
          miniCardSkeleton(PATIENT_SUMMARY_MINI_CARD_MEDICAL)
        ) : (
          <SummaryMiniCardButton
            title={PATIENT_SUMMARY_MINI_CARD_MEDICAL}
            detail={medicalDetail(medical)}
            tab="medical"
            onOpenTab={onOpenTab}
          />
        )}

        {treatments.phase === "loading" || treatments.phase === "idle" ? (
          miniCardSkeleton(PATIENT_SUMMARY_MINI_CARD_TREATMENTS)
        ) : (
          <SummaryMiniCardButton
            title={PATIENT_SUMMARY_MINI_CARD_TREATMENTS}
            detail={countDetail(treatments, "No procedures in preview")}
            tab="treatments"
            onOpenTab={onOpenTab}
          />
        )}

        {chart.phase === "loading" || chart.phase === "idle" ? (
          miniCardSkeleton(PATIENT_SUMMARY_MINI_CARD_CHART)
        ) : (
          <SummaryMiniCardButton
            title={PATIENT_SUMMARY_MINI_CARD_CHART}
            detail={countDetail(chart, "No chart rows in preview")}
            tab="chart"
            onOpenTab={onOpenTab}
          />
        )}

        {ledger.phase === "loading" || ledger.phase === "idle" ? (
          miniCardSkeleton(PATIENT_SUMMARY_MINI_CARD_LEDGER)
        ) : (
          <SummaryMiniCardButton
            title={PATIENT_SUMMARY_MINI_CARD_LEDGER}
            detail={countDetail(ledger, "No ledger lines in preview")}
            tab="ledger"
            onOpenTab={onOpenTab}
          />
        )}

        {!timeline || timeline.phase === "loading" || timeline.phase === "idle" ? (
          miniCardSkeleton(PATIENT_SUMMARY_MINI_CARD_TIMELINE)
        ) : (
          <SummaryMiniCardButton
            title={PATIENT_SUMMARY_MINI_CARD_TIMELINE}
            detail={timelineDetail(timeline, timelineExactCount)}
            tab="timeline"
            onOpenTab={onOpenTab}
          />
        )}
      </div>

      <div className="app-patient-profile__summary-cross-tabs" role="group" aria-label={PATIENT_SUMMARY_CROSS_TAB_ARIA}>
        {crossTabs.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            variant="secondary"
            size="compact"
            className="ui-focusable app-patient-profile__summary-cross-tab"
            onClick={() => onOpenTab(tab.id)}
          >
            {patientSummaryCrossTabWithCount(tab.label, crossTabCount(tab.id, crossTabProps))}
          </Button>
        ))}
      </div>
    </div>
  );
}
