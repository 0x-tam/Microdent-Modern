import type { ScheduleAppointmentItem } from "@microdent/contracts";
import {
  comparePatientApptToNow,
  findNextUpcomingPatientAppointment,
  formatAppointmentStatusMix,
  patientApptStatusLabel,
} from "./patient-appointments-display.js";
import type { SummaryApptPrefetch, SummaryCountPrefetch, SummaryMedPrefetch } from "./patient-summary-mini-cards.js";
import type { TimelineDisplayModel, TimelineEvent } from "./patient-timeline-display.js";
import {
  PATIENT_SUMMARY_AT_GLANCE_APPT_NONE,
  PATIENT_SUMMARY_AT_GLANCE_APPT_RECENT,
  PATIENT_SUMMARY_AT_GLANCE_APPT_UPCOMING,
  PATIENT_SUMMARY_AT_GLANCE_CHART,
  PATIENT_SUMMARY_AT_GLANCE_LEDGER,
  PATIENT_SUMMARY_AT_GLANCE_MEDICAL,
  PATIENT_SUMMARY_AT_GLANCE_TREATMENTS,
  PATIENT_SUMMARY_TIMELINE_ABOUT_COUNT,
  PATIENT_SUMMARY_TIMELINE_EXACT_COUNT,
  PATIENT_TIMELINE_TEMPORAL_OLDER,
  PATIENT_TIMELINE_TEMPORAL_RECENT,
  PATIENT_TIMELINE_TEMPORAL_UPCOMING,
  PATIENT_TIMELINE_SUMMARY_BAR,
} from "./read-only-ui-copy.js";

export type PatientWorkspaceAtGlance = {
  upcomingStatus: string | null;
  recentStatus: string | null;
  treatmentCount: string | null;
  chartCount: string | null;
  ledgerCount: string | null;
  medicalScreening: string | null;
};

export type PatientWorkspacePrefetches = {
  appt: SummaryApptPrefetch;
  medical: SummaryMedPrefetch;
  treatments: SummaryCountPrefetch;
  chart: SummaryCountPrefetch;
  ledger: SummaryCountPrefetch;
};

/** Safe summary DTO for Summary at-a-glance strip — counts and status hints only. */
export function patientWorkspaceAtGlance(prefetches: PatientWorkspacePrefetches): PatientWorkspaceAtGlance {
  const { appt, medical, treatments, chart, ledger } = prefetches;

  let upcomingStatus: string | null = null;
  let recentStatus: string | null = null;

  if (appt.phase === "loaded" && appt.appointments.length > 0) {
    const next = findNextUpcomingPatientAppointment(appt.appointments);
    if (next) {
      upcomingStatus = `${PATIENT_SUMMARY_AT_GLANCE_APPT_UPCOMING}: ${patientApptStatusLabel(next.status)}`;
    }
    const ref = new Date();
    const past = appt.appointments.filter((a) => comparePatientApptToNow(a, ref) < 0);
    if (past.length > 0) {
      const latest = past.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))[0];
      recentStatus = `${PATIENT_SUMMARY_AT_GLANCE_APPT_RECENT}: ${patientApptStatusLabel(latest.status)}`;
    }
  } else if (appt.phase === "empty") {
    upcomingStatus = PATIENT_SUMMARY_AT_GLANCE_APPT_NONE;
  }

  let medicalScreening: string | null = null;
  if (medical.phase === "loaded") {
    if (!medical.hasMedicalRecord) {
      medicalScreening = PATIENT_SUMMARY_AT_GLANCE_MEDICAL("No record");
    } else if (medical.flaggedConditionCount === 0) {
      medicalScreening = PATIENT_SUMMARY_AT_GLANCE_MEDICAL("None flagged");
    } else {
      medicalScreening = PATIENT_SUMMARY_AT_GLANCE_MEDICAL(
        `${medical.flaggedConditionCount} flagged`,
      );
    }
  }

  const treatmentCount =
    treatments.phase === "loaded" && treatments.count > 0
      ? PATIENT_SUMMARY_AT_GLANCE_TREATMENTS(treatments.count)
      : treatments.phase === "empty"
        ? PATIENT_SUMMARY_AT_GLANCE_TREATMENTS(0)
        : null;

  const chartCount =
    chart.phase === "loaded" && chart.count > 0
      ? PATIENT_SUMMARY_AT_GLANCE_CHART(chart.count)
      : chart.phase === "empty"
        ? PATIENT_SUMMARY_AT_GLANCE_CHART(0)
        : null;

  const ledgerCount =
    ledger.phase === "loaded" && ledger.count > 0
      ? PATIENT_SUMMARY_AT_GLANCE_LEDGER(ledger.count)
      : ledger.phase === "empty"
        ? PATIENT_SUMMARY_AT_GLANCE_LEDGER(0)
        : null;

  return {
    upcomingStatus,
    recentStatus,
    treatmentCount,
    chartCount,
    ledgerCount,
    medicalScreening,
  };
}

export function summaryTimelineCountLabel(
  prefetch: SummaryCountPrefetch,
  exactCount: number | null,
): string {
  if (exactCount !== null) {
    return PATIENT_SUMMARY_TIMELINE_EXACT_COUNT(exactCount);
  }
  if (prefetch.phase === "loaded" && prefetch.count > 0) {
    return PATIENT_SUMMARY_TIMELINE_ABOUT_COUNT(prefetch.count);
  }
  if (prefetch.phase === "empty") {
    return "No merged events yet";
  }
  return "Loading…";
}

export type TimelineTemporalSection = "upcoming" | "recent" | "older";

export type TimelineTemporalGroup = {
  section: TimelineTemporalSection;
  heading: string;
  events: TimelineEvent[];
};

const RECENT_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function eventTemporalSection(event: TimelineEvent, nowMs: number): TimelineTemporalSection {
  if (!event.dateIso) return "older";
  const eventMs = new Date(`${event.dateIso}T12:00:00`).getTime();
  const todayMs = new Date(nowMs).setHours(12, 0, 0, 0);
  if (eventMs > todayMs) return "upcoming";
  if (todayMs - eventMs <= RECENT_DAYS_MS) return "recent";
  return "older";
}

function sectionHeading(section: TimelineTemporalSection): string {
  switch (section) {
    case "upcoming":
      return PATIENT_TIMELINE_TEMPORAL_UPCOMING;
    case "recent":
      return PATIENT_TIMELINE_TEMPORAL_RECENT;
    default:
      return PATIENT_TIMELINE_TEMPORAL_OLDER;
  }
}

/** Flatten dated timeline events into Upcoming / Recent / Older sections. */
export function partitionTimelineEventsByTemporal(
  model: TimelineDisplayModel,
  nowMs: number = Date.now(),
): TimelineTemporalGroup[] {
  const allEvents: TimelineEvent[] = [];
  for (const month of model.monthGroups) {
    for (const day of month.dayGroups) {
      allEvents.push(...day.events);
    }
  }

  const buckets: Record<TimelineTemporalSection, TimelineEvent[]> = {
    upcoming: [],
    recent: [],
    older: [],
  };

  for (const event of allEvents) {
    buckets[eventTemporalSection(event, nowMs)].push(event);
  }

  const order: TimelineTemporalSection[] = ["upcoming", "recent", "older"];
  return order
    .filter((section) => buckets[section].length > 0)
    .map((section) => ({
      section,
      heading: sectionHeading(section),
      events: buckets[section],
    }));
}

export type TimelineTemporalCounts = {
  total: number;
  upcoming: number;
  recent: number;
  older: number;
};

export function timelineTemporalCounts(
  model: TimelineDisplayModel,
  nowMs: number = Date.now(),
): TimelineTemporalCounts {
  const groups = partitionTimelineEventsByTemporal(model, nowMs);
  const upcoming = groups.find((g) => g.section === "upcoming")?.events.length ?? 0;
  const recent = groups.find((g) => g.section === "recent")?.events.length ?? 0;
  const older = groups.find((g) => g.section === "older")?.events.length ?? 0;
  return {
    total: model.eventCount,
    upcoming,
    recent,
    older,
  };
}

export function timelineSummaryBarLine(counts: TimelineTemporalCounts): string {
  return PATIENT_TIMELINE_SUMMARY_BAR(counts.total, counts.upcoming, counts.recent);
}

export type ScheduleOperationalFilters = {
  statusFilter: number | null;
  providerFilter: number | null;
  roomFilter: number | "";
};

export type ScheduleOperationalSummary = {
  shownLabel: string;
  statusMix: string | null;
  providerMix: string | null;
  roomMix: string | null;
  filterActiveLabel: string | null;
};

/** Safe schedule operational summary — counts and mix strings only. */
export function scheduleOperationalSummary(
  allAppointments: readonly ScheduleAppointmentItem[],
  shownAppointments: readonly ScheduleAppointmentItem[],
  filters: ScheduleOperationalFilters,
  doctorLabels: ReadonlyMap<string, string>,
): ScheduleOperationalSummary {
  const shown = shownAppointments.length;
  const total = allAppointments.length;
  const shownLabel =
    shown === total
      ? total === 1
        ? "1 appointment shown"
        : `${total} appointments shown`
      : `${shown} of ${total} appointments shown`;

  const statusMix =
    allAppointments.length > 0 ? formatAppointmentStatusMix(allAppointments) : null;

  let providerMix: string | null = null;
  const providerIds = new Set(
    allAppointments.map((a) => a.docId).filter((id) => id !== null && id !== undefined && id !== 0),
  );
  if (providerIds.size > 1 && filters.providerFilter === null) {
    providerMix = `${providerIds.size} providers in range`;
  }

  let roomMix: string | null = null;
  if (filters.roomFilter === "") {
    const rooms = new Set(allAppointments.map((a) => a.room));
    if (rooms.size > 1) {
      roomMix = `${rooms.size} rooms in range`;
    }
  }

  const filterParts: string[] = [];
  if (filters.statusFilter !== null) {
    filterParts.push(`status: ${patientApptStatusLabel(filters.statusFilter)}`);
  }
  if (filters.providerFilter !== null) {
    const label = doctorLabels.get(String(filters.providerFilter)) ?? `Provider ${filters.providerFilter}`;
    filterParts.push(`provider: ${label}`);
  }
  if (filters.roomFilter !== "") {
    filterParts.push(`room: ${filters.roomFilter}`);
  }
  const filterActiveLabel = filterParts.length > 0 ? `Filters: ${filterParts.join(" · ")}` : null;

  return { shownLabel, statusMix, providerMix, roomMix, filterActiveLabel };
}
