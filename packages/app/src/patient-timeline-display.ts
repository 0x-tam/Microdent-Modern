import type {
  LedgerEntryV1,
  PatientChartEntry,
  PatientMedicalSummaryResponse,
  PatientProfileResponse,
  PatientTreatmentItem,
  ScheduleAppointmentItem,
} from "@microdent/contracts";
import {
  patientApptRowMeta,
  patientApptStatusLabel,
  roomDisplayLabel,
  type RoomLabelMap,
} from "./patient-appointments-display.js";
import {
  ledgerAdjustmentTypeLabel,
  ledgerChargeTypeLabel,
  ledgerEntryKinds,
  ledgerPaymentTypeLabel,
  ledgerMonthKeyFromIso,
  formatLedgerMonthHeading,
} from "./patient-ledger-display.js";
import {
  formatTreatmentDate,
  treatmentMonthKeyFromIso,
  formatTreatmentMonthHeading,
  treatmentProcedureLine,
  treatmentProviderLabel,
  treatmentStatusLabel,
  treatmentToothLabel,
} from "./patient-treatments-display.js";
import { formatMedicalQuestionnaireDate } from "./patient-medical-summary-display.js";
import { chartToothLabel } from "./patient-chart-display.js";
import type { ProcedureReferenceMaps } from "./procedure-reference.js";
import {
  PATIENT_TAB_SECTION_UNDATED,
  PATIENT_TIMELINE_CHART_SNAPSHOT,
  PATIENT_TIMELINE_EVENT_APPOINTMENT,
  PATIENT_TIMELINE_EVENT_LEDGER,
  PATIENT_TIMELINE_EVENT_MEDICAL,
  PATIENT_TIMELINE_EVENT_PROFILE,
  PATIENT_TIMELINE_EVENT_TREATMENT,
  PATIENT_TIMELINE_RANGE_BANNER_PREFIX,
  TRUNCATED_LIST_BANNER,
} from "./read-only-ui-copy.js";

export type TimelineSourceTab = "summary" | "appointments" | "medical" | "treatments" | "chart" | "ledger";

export type TimelineEventKind =
  | "appointment"
  | "treatment"
  | "ledger"
  | "medicalSnapshot"
  | "profileAnchor"
  | "chartSnapshot";

export type TimelineNavigateHint = {
  chartToothFilter?: number | null;
};

export type TimelineEvent = {
  eventId: string;
  kind: TimelineEventKind;
  sortKey: string;
  dateIso: string | null;
  monthKey: string;
  dayKey: string | null;
  kindLabel: string;
  primaryLabel: string;
  secondaryLabel: string | null;
  sourceTab: TimelineSourceTab;
  navigateHint?: TimelineNavigateHint;
};

export type TimelineDayGroup = {
  dayKey: string;
  heading: string;
  events: TimelineEvent[];
};

export type TimelineMonthGroup = {
  monthKey: string;
  heading: string;
  dayGroups: TimelineDayGroup[];
};

export type TimelineDisplayModel = {
  monthGroups: TimelineMonthGroup[];
  snapshotEvents: TimelineEvent[];
  rangeBanner: string | null;
  truncatedBanner: string | null;
  eventCount: number;
};

export type BuildTimelineDisplayInput = {
  profile: PatientProfileResponse;
  appointments: readonly ScheduleAppointmentItem[];
  treatments: readonly PatientTreatmentItem[];
  ledgerEntries: readonly LedgerEntryV1[];
  chartEntries: readonly PatientChartEntry[];
  medicalSummary: PatientMedicalSummaryResponse | null;
  apptRange: { from: string; to: string };
  truncated: { treatments: boolean; ledger: boolean; chart: boolean };
  doctorLabels: ReadonlyMap<string, string>;
  procedureMaps?: ProcedureReferenceMaps;
  roomMap?: RoomLabelMap;
};

const UNDATED_MONTH_KEY = "undated";
const UNDATED_DAY_KEY = "undated";

function formatApptRangeHeading(from: string, to: string): string {
  try {
    const fmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
    if (from === to) {
      return fmt.format(new Date(from + "T12:00:00"));
    }
    return `${fmt.format(new Date(from + "T12:00:00"))} – ${fmt.format(new Date(to + "T12:00:00"))}`;
  } catch {
    return `${from} – ${to}`;
  }
}

function timelineMonthKeyFromIso(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return UNDATED_MONTH_KEY;
  return iso.slice(0, 7);
}

function formatTimelineMonthHeading(monthKey: string): string {
  if (monthKey === UNDATED_MONTH_KEY) return PATIENT_TAB_SECTION_UNDATED;
  return formatTreatmentMonthHeading(monthKey);
}

function formatTimelineDayHeading(dayKey: string, dateIso: string | null): string {
  if (dayKey === UNDATED_DAY_KEY || !dateIso) return PATIENT_TAB_SECTION_UNDATED;
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateIso + "T12:00:00"));
  } catch {
    return dateIso;
  }
}

function ledgerTimelinePrimaryLabel(entry: LedgerEntryV1): string {
  const kinds = ledgerEntryKinds(entry);
  if (kinds.length === 0) return PATIENT_TIMELINE_EVENT_LEDGER;
  const parts: string[] = [];
  for (const kind of kinds) {
    if (kind === "charge") {
      const label = ledgerChargeTypeLabel(entry.chargeTypeCode);
      parts.push(label ?? "Charge");
    } else if (kind === "adjustment") {
      const label = ledgerAdjustmentTypeLabel(entry.adjustmentTypeCode);
      parts.push(label ?? "Adjustment");
    } else if (kind === "payment") {
      const label = ledgerPaymentTypeLabel(entry.paymentTypeCode);
      parts.push(label ?? "Payment");
    }
  }
  return parts.join(" · ");
}

function appointmentEvents(
  appointments: readonly ScheduleAppointmentItem[],
  doctorLabels: ReadonlyMap<string, string>,
  procedureMaps?: ProcedureReferenceMaps,
  roomMap: RoomLabelMap = new Map(),
): TimelineEvent[] {
  return appointments.map((appt) => {
    const status = patientApptStatusLabel(appt.status);
    const meta = patientApptRowMeta(appt, doctorLabels, procedureMaps, roomMap);
    return {
      eventId: `appt-${appt.id}`,
      kind: "appointment",
      sortKey: `${appt.date}T${appt.time}:${appt.id}`,
      dateIso: appt.date,
      monthKey: timelineMonthKeyFromIso(appt.date),
      dayKey: appt.date,
      kindLabel: PATIENT_TIMELINE_EVENT_APPOINTMENT,
      primaryLabel: `${appt.time} · ${status}`,
      secondaryLabel: meta,
      sourceTab: "appointments",
    };
  });
}

function treatmentEvents(
  treatments: readonly PatientTreatmentItem[],
  doctorLabels: ReadonlyMap<string, string>,
): TimelineEvent[] {
  return treatments.map((t) => {
    const procedure = treatmentProcedureLine(t) ?? PATIENT_TIMELINE_EVENT_TREATMENT;
    const metaParts: string[] = [];
    const tooth = treatmentToothLabel(t.tooth);
    if (tooth) metaParts.push(tooth);
    const provider = treatmentProviderLabel(t, doctorLabels);
    if (provider) metaParts.push(provider);
    const status = treatmentStatusLabel(t.status);
    if (status) metaParts.push(status);
    const navigateHint: TimelineNavigateHint | undefined =
      t.tooth !== null ? { chartToothFilter: t.tooth } : undefined;
    return {
      eventId: `tx-${t.treatmentId}`,
      kind: "treatment",
      sortKey: t.date ? `${t.date}T00:00:${t.treatmentId}` : `undated:${t.treatmentId}`,
      dateIso: t.date,
      monthKey: treatmentMonthKeyFromIso(t.date),
      dayKey: t.date ?? UNDATED_DAY_KEY,
      kindLabel: PATIENT_TIMELINE_EVENT_TREATMENT,
      primaryLabel: procedure,
      secondaryLabel: metaParts.length > 0 ? metaParts.join(" · ") : null,
      sourceTab: t.tooth !== null ? "chart" : "treatments",
      navigateHint,
    };
  });
}

function ledgerEvents(entries: readonly LedgerEntryV1[]): TimelineEvent[] {
  return entries.map((entry) => ({
    eventId: `ledger-${entry.ledgerEntryId}`,
    kind: "ledger",
    sortKey: entry.date ? `${entry.date}T00:00:${entry.ledgerEntryId}` : `undated:${entry.ledgerEntryId}`,
    dateIso: entry.date,
    monthKey: ledgerMonthKeyFromIso(entry.date),
    dayKey: entry.date ?? UNDATED_DAY_KEY,
    kindLabel: PATIENT_TIMELINE_EVENT_LEDGER,
    primaryLabel: ledgerTimelinePrimaryLabel(entry),
    secondaryLabel: entry.hasDescription ? "Memo hidden" : null,
    sourceTab: "ledger",
  }));
}

function medicalSnapshotEvents(summary: PatientMedicalSummaryResponse | null): TimelineEvent[] {
  if (!summary?.hasMedicalRecord) return [];
  const events: TimelineEvent[] = [];
  if (summary.lastUpdated) {
    const dateLabel = formatMedicalQuestionnaireDate(summary.lastUpdated);
    events.push({
      eventId: "medical-updated",
      kind: "medicalSnapshot",
      sortKey: `${summary.lastUpdated}T00:00:medical-updated`,
      dateIso: summary.lastUpdated,
      monthKey: timelineMonthKeyFromIso(summary.lastUpdated),
      dayKey: summary.lastUpdated,
      kindLabel: PATIENT_TIMELINE_EVENT_MEDICAL,
      primaryLabel: "Questionnaire updated",
      secondaryLabel: dateLabel ? `Updated ${dateLabel}` : null,
      sourceTab: "medical",
    });
  }
  if (summary.lastDentalVisit && summary.lastDentalVisit !== summary.lastUpdated) {
    const dateLabel = formatMedicalQuestionnaireDate(summary.lastDentalVisit);
    events.push({
      eventId: "medical-last-dental",
      kind: "medicalSnapshot",
      sortKey: `${summary.lastDentalVisit}T00:00:medical-last-dental`,
      dateIso: summary.lastDentalVisit,
      monthKey: timelineMonthKeyFromIso(summary.lastDentalVisit),
      dayKey: summary.lastDentalVisit,
      kindLabel: PATIENT_TIMELINE_EVENT_MEDICAL,
      primaryLabel: "Last dental visit on file",
      secondaryLabel: dateLabel ?? null,
      sourceTab: "medical",
    });
  }
  if (events.length === 0) {
    events.push({
      eventId: "medical-on-file",
      kind: "medicalSnapshot",
      sortKey: "undated:medical-on-file",
      dateIso: null,
      monthKey: UNDATED_MONTH_KEY,
      dayKey: UNDATED_DAY_KEY,
      kindLabel: PATIENT_TIMELINE_EVENT_MEDICAL,
      primaryLabel: "Medical screening on file",
      secondaryLabel:
        summary.flaggedConditionCount > 0
          ? `${summary.flaggedConditionCount} screening flag${summary.flaggedConditionCount === 1 ? "" : "s"} marked yes`
          : "No screening flags marked yes",
      sourceTab: "medical",
    });
  }
  return events;
}

function profileAnchorEvents(profile: PatientProfileResponse): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (profile.entryDate) {
    events.push({
      eventId: "profile-entry",
      kind: "profileAnchor",
      sortKey: `${profile.entryDate}T00:00:profile-entry`,
      dateIso: profile.entryDate,
      monthKey: timelineMonthKeyFromIso(profile.entryDate),
      dayKey: profile.entryDate,
      kindLabel: PATIENT_TIMELINE_EVENT_PROFILE,
      primaryLabel: "Record entry date",
      secondaryLabel: formatTreatmentDate(profile.entryDate),
      sourceTab: "summary",
    });
  }
  if (profile.lastVisit && profile.lastVisit !== profile.entryDate) {
    events.push({
      eventId: "profile-last-visit",
      kind: "profileAnchor",
      sortKey: `${profile.lastVisit}T00:00:profile-last-visit`,
      dateIso: profile.lastVisit,
      monthKey: timelineMonthKeyFromIso(profile.lastVisit),
      dayKey: profile.lastVisit,
      kindLabel: PATIENT_TIMELINE_EVENT_PROFILE,
      primaryLabel: "Last visit on profile",
      secondaryLabel: formatTreatmentDate(profile.lastVisit),
      sourceTab: "summary",
    });
  }
  return events;
}

function chartSnapshotEvent(chartEntries: readonly PatientChartEntry[]): TimelineEvent | null {
  if (chartEntries.length === 0) return null;
  const countLabel = chartEntries.length === 1 ? "1 entry" : `${chartEntries.length} entries`;
  return {
    eventId: "chart-snapshot",
    kind: "chartSnapshot",
    sortKey: "snapshot:chart",
    dateIso: null,
    monthKey: UNDATED_MONTH_KEY,
    dayKey: UNDATED_DAY_KEY,
    kindLabel: PATIENT_TIMELINE_CHART_SNAPSHOT,
    primaryLabel: `${PATIENT_TIMELINE_CHART_SNAPSHOT} · ${countLabel}`,
    secondaryLabel: "Open chart tab for tooth-level rows",
    sourceTab: "chart",
  };
}

function groupTimelineEvents(events: TimelineEvent[]): TimelineMonthGroup[] {
  const sorted = [...events].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  const monthMap = new Map<string, Map<string, TimelineEvent[]>>();

  for (const event of sorted) {
    const monthBucket = monthMap.get(event.monthKey) ?? new Map<string, TimelineEvent[]>();
    const dayKey = event.dayKey ?? UNDATED_DAY_KEY;
    const dayBucket = monthBucket.get(dayKey) ?? [];
    dayBucket.push(event);
    monthBucket.set(dayKey, dayBucket);
    monthMap.set(event.monthKey, monthBucket);
  }

  const monthKeys = [...monthMap.keys()].sort((a, b) => {
    if (a === UNDATED_MONTH_KEY) return 1;
    if (b === UNDATED_MONTH_KEY) return -1;
    return b.localeCompare(a);
  });

  return monthKeys.map((monthKey) => {
    const dayMap = monthMap.get(monthKey)!;
    const dayKeys = [...dayMap.keys()].sort((a, b) => {
      if (a === UNDATED_DAY_KEY) return 1;
      if (b === UNDATED_DAY_KEY) return -1;
      return b.localeCompare(a);
    });
    const dayGroups: TimelineDayGroup[] = dayKeys.map((dayKey) => {
      const dayEvents = dayMap.get(dayKey) ?? [];
      const sampleDate = dayEvents.find((e) => e.dateIso)?.dateIso ?? null;
      return {
        dayKey,
        heading: formatTimelineDayHeading(dayKey, sampleDate),
        events: dayEvents,
      };
    });
    return {
      monthKey,
      heading: formatTimelineMonthHeading(monthKey),
      dayGroups,
    };
  });
}

export function buildTimelineDisplayModel(input: BuildTimelineDisplayInput): TimelineDisplayModel {
  const datedEvents: TimelineEvent[] = [
    ...appointmentEvents(input.appointments, input.doctorLabels, input.procedureMaps, input.roomMap),
    ...treatmentEvents(input.treatments, input.doctorLabels),
    ...ledgerEvents(input.ledgerEntries),
    ...medicalSnapshotEvents(input.medicalSummary),
    ...profileAnchorEvents(input.profile),
  ];

  const snapshot = chartSnapshotEvent(input.chartEntries);
  const snapshotEvents = snapshot ? [snapshot] : [];
  const monthGroups = groupTimelineEvents(datedEvents);
  const eventCount = datedEvents.length + snapshotEvents.length;

  const truncatedParts: string[] = [];
  if (input.truncated.treatments) truncatedParts.push("procedures");
  if (input.truncated.ledger) truncatedParts.push("ledger lines");
  if (input.truncated.chart) truncatedParts.push("chart rows");

  const truncatedBanner =
    truncatedParts.length > 0
      ? `${TRUNCATED_LIST_BANNER} Affected: ${truncatedParts.join(", ")}.`
      : null;

  const rangeHeading = formatApptRangeHeading(input.apptRange.from, input.apptRange.to);
  const rangeBanner = `${PATIENT_TIMELINE_RANGE_BANNER_PREFIX}: ${rangeHeading}.`;

  return {
    monthGroups,
    snapshotEvents,
    rangeBanner,
    truncatedBanner,
    eventCount,
  };
}

export function timelineChartToothFilterLabel(tooth: number): string {
  return chartToothLabel(tooth);
}

/** Client-side kind filter groups for timeline toolbar chips. */
export type TimelineKindFilter =
  | "all"
  | "appointments"
  | "treatments"
  | "chartMetadata"
  | "ledgerMetadata"
  | "medicalStatus";

export const TIMELINE_KIND_FILTER_OPTIONS: readonly { id: TimelineKindFilter; label: string }[] = [
  { id: "all", label: "All events" },
  { id: "appointments", label: "Appointments" },
  { id: "treatments", label: "Procedures" },
  { id: "chartMetadata", label: "Chart metadata" },
  { id: "ledgerMetadata", label: "Ledger metadata" },
  { id: "medicalStatus", label: "Medical status" },
];

function eventMatchesKindFilter(event: TimelineEvent, filter: TimelineKindFilter): boolean {
  if (filter === "all") return true;
  switch (filter) {
    case "appointments":
      return event.kind === "appointment";
    case "treatments":
      return event.kind === "treatment";
    case "chartMetadata":
      return event.kind === "chartSnapshot" || event.kind === "profileAnchor";
    case "ledgerMetadata":
      return event.kind === "ledger";
    case "medicalStatus":
      return event.kind === "medicalSnapshot";
    default:
      return true;
  }
}

/** Filter a built timeline model by kind — preserves banners; recomputes eventCount. */
export function filterTimelineDisplayModel(
  model: TimelineDisplayModel,
  kindFilter: TimelineKindFilter,
): TimelineDisplayModel {
  if (kindFilter === "all") return model;

  const snapshotEvents = model.snapshotEvents.filter((e) => eventMatchesKindFilter(e, kindFilter));
  const monthGroups: TimelineMonthGroup[] = model.monthGroups
    .map((month) => ({
      ...month,
      dayGroups: month.dayGroups
        .map((day) => ({
          ...day,
          events: day.events.filter((e) => eventMatchesKindFilter(e, kindFilter)),
        }))
        .filter((day) => day.events.length > 0),
    }))
    .filter((month) => month.dayGroups.length > 0);

  const eventCount =
    snapshotEvents.length +
    monthGroups.reduce(
      (sum, month) => sum + month.dayGroups.reduce((daySum, day) => daySum + day.events.length, 0),
      0,
    );

  return {
    ...model,
    monthGroups,
    snapshotEvents,
    eventCount,
  };
}

export function timelineSourceTabLabel(sourceTab: TimelineSourceTab): string {
  const labels: Record<TimelineSourceTab, string> = {
    summary: "Summary",
    appointments: "Appointments",
    medical: "Medical",
    treatments: "Treatments",
    chart: "Chart",
    ledger: "Ledger",
  };
  return labels[sourceTab];
}

/** Re-export month heading helper for tests comparing ledger/treatment parity. */
export { formatLedgerMonthHeading };
