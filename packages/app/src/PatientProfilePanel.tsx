import { BridgeClientError, createBridgeClient, isInvalidBodySchemaMismatch } from "@microdent/bridge-client";
import type {
  LedgerEntryV1,
  PatientChartEntry,
  PatientMedicalSummaryResponse,
  PatientProfileResponse,
  PatientTreatmentItem,
  ScheduleAppointmentItem,
} from "@microdent/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState } from "@microdent/ui";
import type { BridgeDevStatusResponse } from "@microdent/contracts";
import type { BridgeHealthPhase } from "./bridge-health.js";
import { PatientDemographicsWritePanel } from "./PatientDemographicsWritePanel.js";
import { AppErrorBoundary } from "./AppErrorBoundary.js";
import {
  buildRoomLabelMap,
  filterPatientAppointments,
  formatAppointmentStatusMix,
  findCurrentAppointmentInRange,
  patientApptFormatDuration,
  patientApptProviderFilterOptions,
  patientApptRangeCountLabel,
  patientApptRowMeta,
  patientApptStatusBadgeVariant,
  patientApptStatusLabel,
  patientApptStatusSemanticLabel,
  patientApptUniqueRooms,
  roomDisplayLabel,
  PATIENT_APPT_FILTER_STATUS_CODES,
  type PatientApptTimeDirection,
  type RoomLabelMap,
} from "./patient-appointments-display.js";
import {
  defaultPatientApptRange,
  patientApptRangeForPreset,
  patientApptPresetWasRangeCapped,
  timelinePatientApptRange,
  type PatientApptRangePreset,
} from "./patient-appointments-range.js";
import { profileAssignedProviderLabel } from "./doctor-labels.js";
import { useDoctorLabels } from "./useDoctorLabels.js";
import { useProcedureReference } from "./useProcedureReference.js";
import {
  formatMedicalQuestionnaireDate,
  medicalConditionSectionsForDisplay,
  medicalFlaggedCountNeedsPartialNote,
} from "./patient-medical-summary-display.js";
import {
  chartSummaryStats,
  chartTreatedLabel,
  chartTypeLabel,
  chartTypesFromEntries,
  filterChartEntriesForDisplay,
  groupChartEntriesByTooth,
  type ChartTreatedFilter,
} from "./patient-chart-display.js";
import {
  filterLedgerEntriesByType,
  formatLedgerDate,
  formatLedgerMonthGroupHeading,
  formatLedgerTypeDistribution,
  groupLedgerEntriesByMonth,
  ledgerAdjustmentTypeLabel,
  ledgerCardPaymentLabel,
  ledgerChargeTypeLabel,
  ledgerPaymentTypeLabel,
  ledgerTypeDistributionCounts,
  ledgerTypeFilterActive,
  ledgerTypeFiltersPresent,
  sortLedgerEntriesForDisplay,
  type LedgerEntryTypeFilter,
} from "./patient-ledger-display.js";
import type { ProcedureReferenceMaps } from "./procedure-reference.js";
import { PatientSearchBar, type PatientSearchHit } from "./PatientSearchBar.js";
import {
  formatSessionRecentPatientMeta,
  type SessionRecentPatient,
} from "./session-recent-patients.js";
import {
  CLINIC_SERVICE_CHECKING,
  CLINIC_SERVICE_OFFLINE_PANEL,
  CLINIC_SERVICE_OFFLINE_SECTION,
  CLINIC_SERVICE_OFFLINE_TITLE,
  PATIENT_DEMOGRAPHICS_DOCTOR_ID_HINT,
  PATIENT_PROFILE_LOADING,
  PATIENT_PROFILE_WAITING_TITLE,
  PATIENT_SANDBOX_DEMOGRAPHICS_TITLE,
  PATIENT_TAB_LOADING_APPOINTMENTS,
  PATIENT_TAB_LOADING_CHART,
  PATIENT_TAB_LOADING_LEDGER,
  PATIENT_TAB_LOADING_MEDICAL,
  PATIENT_TAB_LOADING_TREATMENTS,
  PATIENT_TAB_OFFLINE_TREATMENTS,
  PATIENT_TAB_OFFLINE_MEDICAL,
  PATIENT_TAB_OFFLINE_CHART,
  PATIENT_TAB_OFFLINE_LEDGER,
  PATIENT_TAB_CHART_EXPLAINER,
  PATIENT_TAB_CHART_FILTER_ALL,
  PATIENT_TAB_CHART_FILTER_TREATED,
  PATIENT_TAB_FILTER_ALL,
  PATIENT_TAB_LEDGER_AMOUNTS_CHIP,
  PATIENT_TAB_LEDGER_FILTER_ADJUSTMENT,
  PATIENT_TAB_LEDGER_FILTER_CHARGE,
  PATIENT_TAB_LEDGER_FILTER_PAYMENT,
  MEDICAL_SENSITIVE_STILL_HIDDEN,
  MEDICAL_SENSITIVE_STILL_SHOWN,
  PATIENT_TAB_SECTION_ADDITIONAL_MARKERS,
  PATIENT_TAB_SECTION_GENERAL_SCREENING,
  PATIENT_TAB_QUESTIONNAIRE_DENTAL_VISIT,
  PATIENT_TAB_QUESTIONNAIRE_LAST_UPDATED,
  chartSummaryStripLabel,
  chartToolbarSummary,
  medicalToolbarSummary,
  PATIENT_SUMMARY_AT_GLANCE_TITLE,
  PATIENT_TAB_EMPTY_CHART,
  PATIENT_TAB_EMPTY_CHART_FILTERED,
  PATIENT_TAB_EMPTY_LEDGER,
  PATIENT_TAB_EMPTY_LEDGER_FILTERED,
  PATIENT_TAB_EMPTY_MEDICAL,
  PATIENT_TAB_EMPTY_TREATMENTS,
  PATIENT_TAB_EMPTY_TREATMENTS_FILTERED,
  PATIENT_TAB_HIDDEN_CHART,
  PATIENT_TAB_HIDDEN_LEDGER,
  PATIENT_TAB_HIDDEN_MEDICAL,
  PATIENT_TAB_HIDDEN_TREATMENTS,
  medicalFlaggedCountPartialNote,
  treatmentsProviderStatsLine,
  treatmentsToolbarSummary,
  ledgerToolbarSummary,
  PATIENT_CHANGE_PATIENT_LABEL,
  PATIENT_PAGE_SEARCH_EXAMPLE,
  PATIENT_PAGE_SEARCH_LEDE,
  PATIENT_MODULE_TABS_HINT,
  PATIENT_PAGE_SEARCH_TITLE,
  PATIENT_RECENT_SESSION_EMPTY,
  PATIENT_RECENT_SESSION_HINT,
  PATIENT_RECENT_SESSION_TITLE,
  PATIENT_PROFILE_READONLY_NOTE,
  PATIENT_TAB_APPOINTMENTS_LEDE,
  PATIENT_TAB_CHART_LEDE,
  PATIENT_TAB_DESC_APPOINTMENTS,
  PATIENT_TAB_DESC_CHART,
  PATIENT_TAB_DESC_LEDGER,
  PATIENT_TAB_DESC_MEDICAL,
  PATIENT_TAB_DESC_SUMMARY,
  PATIENT_TAB_DESC_TIMELINE,
  PATIENT_TAB_DESC_TREATMENTS,
  PATIENT_CHART_TOOTH_FILTER_CLEAR,
  PATIENT_CHART_TOOTH_FILTER_LABEL,
  PATIENT_TAB_LOADING_TIMELINE,
  PATIENT_TAB_OFFLINE_TIMELINE,
  PATIENT_TAB_TIMELINE_LEDE,
  FILTER_CLEAR_LABEL,
  PATIENT_APPT_RANGE_CAP_BANNER,
  PATIENT_APPT_STATUS_MIX_ARIA,
  PATIENT_TAB_HIDDEN_FIELDS_NOTE,
  PATIENT_TAB_LEDGER_LEDE,
  PATIENT_TAB_LEDGER_AMOUNTS_HIDDEN,
  PATIENT_TAB_MEDICAL_LEDE,
  PATIENT_TAB_SECTION_QUESTIONNAIRE,
  PATIENT_TAB_SUMMARY_LEDE,
  PATIENT_TAB_TREATMENTS_LEDE,
  PATIENT_APPT_FILTER_ALL_PROVIDERS,
  PATIENT_APPT_FILTER_ALL_ROOMS,
  PATIENT_APPT_FILTER_ALL_STATUSES,
  PATIENT_APPT_FILTER_PROVIDER_ARIA,
  PATIENT_APPT_FILTER_ROOM_ARIA,
  PATIENT_APPT_FILTER_STATUS_ARIA,
  PATIENT_APPT_OPEN_IN_SCHEDULE,
  PATIENT_APPT_PRESET_DEFAULT,
  PATIENT_APPT_TIME_ALL,
  PATIENT_APPT_TIME_PAST,
  PATIENT_APPT_TIME_UPCOMING,
  PATIENT_PROFILE_LAST_REFRESHED,
  READONLY_STATE_RETRY,
  SENSITIVE_MEDICAL_BANNER,
  TRUNCATED_LIST_BANNER,
} from "./read-only-ui-copy.js";
import {
  filterTreatmentsForDisplay,
  formatTreatmentDate,
  groupTreatmentsByMonth,
  treatmentProcedureCategoryLabel,
  treatmentProcedureCodesFromItems,
  treatmentProcedureLine,
  treatmentProviderLabel,
  treatmentProviderStats,
  treatmentProvidersFromItems,
  treatmentStatusLabel,
  treatmentTeethFromItems,
  treatmentToothLabel,
  treatmentYearsFromItems,
  treatmentsFiltersActive,
  type TreatmentDisplayFilters,
} from "./patient-treatments-display.js";
import { PatientSummaryMiniCards, type SummaryApptPrefetch, type SummaryCountPrefetch, type SummaryMedPrefetch } from "./patient-summary-mini-cards.js";
import { patientWorkspaceAtGlance } from "./patient-workspace-intelligence.js";
import { PatientTimeline } from "./patient-timeline.js";
import {
  buildTimelineDisplayModel,
  filterTimelineDisplayModel,
  timelineChartToothFilterLabel,
  type TimelineKindFilter,
  type TimelineNavigateHint,
  type TimelineSourceTab,
} from "./patient-timeline-display.js";

export type PatientProfilePanelProps = {
  /** When null, shows the embedded patient search/open area. */
  patientId: string | null;
  bridgePhase: BridgeHealthPhase;
  bridgeBaseUrl?: string;
  fetchImpl?: typeof fetch;
  /** When true with enabled sandbox, summary tab may show demographics write pilot. */
  sandboxWritePilot?: boolean;
  writeCapability?: BridgeDevStatusResponse | null;
  onBackToday: () => void;
  onClearPatient: () => void;
  /** When the user picks a row from page search (or change-patient search). */
  onPatientRecordSelect?: (hit: PatientSearchHit) => void;
  /** Session-only recent patients from the shell (safe fields). */
  recentPatients?: readonly SessionRecentPatient[];
  onRecentPatientSelect?: (entry: SessionRecentPatient) => void;
  /** Opens the schedule module focused on a visit date (YYYY-MM-DD). */
  onOpenScheduleAtDate?: (dateIso: string) => void;
};

type LoadState =
  | { phase: "idle" }
  | { phase: "offline" }
  | { phase: "loading" }
  | { phase: "loaded"; profile: PatientProfileResponse }
  | { phase: "not_found" }
  | { phase: "error"; message: string };

type ProfileTab = "summary" | "timeline" | "appointments" | "medical" | "treatments" | "chart" | "ledger";

export type { ProfileTab };

type ApptLoadState =
  | { phase: "idle" }
  | { phase: "offline" }
  | { phase: "loading" }
  | { phase: "loaded"; appointments: ScheduleAppointmentItem[] }
  | { phase: "empty" }
  | { phase: "error"; message: string };

type MedLoadState =
  | { phase: "idle" }
  | { phase: "offline" }
  | { phase: "loading" }
  | { phase: "no_record" }
  | { phase: "loaded"; summary: PatientMedicalSummaryResponse }
  | { phase: "error"; message: string };

type TxLoadState =
  | { phase: "idle" }
  | { phase: "offline" }
  | { phase: "loading" }
  | { phase: "loaded"; treatments: PatientTreatmentItem[]; truncated: boolean; privacyNote: string }
  | { phase: "empty" }
  | { phase: "error"; message: string };

type ChartLoadState =
  | { phase: "idle" }
  | { phase: "offline" }
  | { phase: "loading" }
  | { phase: "loaded"; entries: PatientChartEntry[]; truncated: boolean; privacyNote: string }
  | { phase: "empty" }
  | { phase: "error"; message: string };

type LedgerLoadState =
  | { phase: "idle" }
  | { phase: "offline" }
  | { phase: "loading" }
  | { phase: "loaded"; entries: LedgerEntryV1[]; truncated: boolean; privacyNote: string }
  | { phase: "empty" }
  | { phase: "error"; message: string };

type TimelineLoadState =
  | { phase: "idle" }
  | { phase: "offline" }
  | { phase: "loading" }
  | {
      phase: "loaded";
      appointments: ScheduleAppointmentItem[];
      treatments: PatientTreatmentItem[];
      ledgerEntries: LedgerEntryV1[];
      chartEntries: PatientChartEntry[];
      medicalSummary: PatientMedicalSummaryResponse | null;
      apptRange: { from: string; to: string };
      truncated: { treatments: boolean; ledger: boolean; chart: boolean };
    }
  | { phase: "error"; message: string };

export const PROFILE_TAB_ORDER: readonly { id: ProfileTab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "timeline", label: "Timeline" },
  { id: "appointments", label: "Appointments" },
  { id: "medical", label: "Medical" },
  { id: "treatments", label: "Treatments" },
  { id: "chart", label: "Chart" },
  { id: "ledger", label: "Ledger preview" },
];

export const PROFILE_TAB_DESCRIPTIONS: Record<ProfileTab, string> = {
  summary: PATIENT_TAB_DESC_SUMMARY,
  timeline: PATIENT_TAB_DESC_TIMELINE,
  appointments: PATIENT_TAB_DESC_APPOINTMENTS,
  medical: PATIENT_TAB_DESC_MEDICAL,
  treatments: PATIENT_TAB_DESC_TREATMENTS,
  chart: PATIENT_TAB_DESC_CHART,
  ledger: PATIENT_TAB_DESC_LEDGER,
};

function formatApptDayHeading(dateIso: string): string {
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

function ProfileTabHiddenNote({
  variant = "default",
}: {
  variant?: "default" | "treatments" | "ledger" | "medical" | "chart" | "timeline";
}) {
  const note =
    variant === "treatments"
      ? PATIENT_TAB_HIDDEN_TREATMENTS
      : variant === "ledger"
        ? PATIENT_TAB_HIDDEN_LEDGER
        : variant === "medical"
          ? PATIENT_TAB_HIDDEN_MEDICAL
          : variant === "chart"
            ? PATIENT_TAB_HIDDEN_CHART
            : PATIENT_TAB_HIDDEN_FIELDS_NOTE;
  return (
    <p className="app-patient-profile__tab-hidden-note" role="note">
      {note}
    </p>
  );
}

function formatProfileLastRefreshed(ms: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { timeStyle: "medium" }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString();
  }
}

function ProfileReadonlyError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="app-readonly-state app-readonly-state--error app-patient-profile__error" role="alert">
      <p>{message}</p>
      <Button type="button" variant="secondary" className="ui-focusable" onClick={onRetry}>
        {READONLY_STATE_RETRY}
      </Button>
    </div>
  );
}

function ProfileHeaderStrip({
  profile,
  activeLabel,
  doctorLabels,
}: {
  profile: PatientProfileResponse;
  activeLabel: string | null;
  doctorLabels: ReadonlyMap<string, string>;
}) {
  const provider = profileAssignedProviderLabel(profile.doctorId, doctorLabels);

  return (
    <div className="app-patient-profile__header-strip" role="region" aria-label="Patient record context">
      <dl className="app-patient-profile__header-dl">
        <div className="app-patient-profile__header-row">
          <dt>Patient</dt>
          <dd className="app-patient-profile__header-name">{profile.displayName}</dd>
        </div>
        <div className="app-patient-profile__header-row">
          <dt>Chart</dt>
          <dd>{profile.chartNumber ?? "—"}</dd>
        </div>
        <div className="app-patient-profile__header-row">
          <dt>Provider</dt>
          <dd>{provider}</dd>
        </div>
        <div className="app-patient-profile__header-row">
          <dt>Status</dt>
          <dd>{activeLabel ?? "—"}</dd>
        </div>
        <div className="app-patient-profile__header-row">
          <dt>Record id</dt>
          <dd>{profile.patientId}</dd>
        </div>
      </dl>
    </div>
  );
}

export function safePatientProfileError(e: unknown): string {
  if (e instanceof BridgeClientError) {
    if (e.kind === "network") {
      return "Could not reach the clinic service. Check that the bridge is running.";
    }
    if (e.kind === "http") {
      const code = e.apiCode ?? "";
      if (code === "PATIENT_NOT_FOUND") {
        return "That patient record was not found. Try searching again.";
      }
      if (code === "DATA_ROOT_NOT_CONFIGURED" || code === "PATIENT_DBF_NOT_FOUND") {
        return "Patient profiles are not available on this bridge yet. Ask your administrator to check the data folder.";
      }
      if (code === "INVALID_PATIENT_ID") {
        return "This patient id is not valid for a profile request.";
      }
      return "The profile could not be loaded. Try again in a moment.";
    }
    if (e.kind === "invalid_body") {
      if (isInvalidBodySchemaMismatch(e)) {
        return "Patient profile needs a small data mapping fix. No clinic data was changed.";
      }
      return "The profile could not read the clinic response format. Try again.";
    }
  }
  return "The profile could not be loaded.";
}

export function safePatientAppointmentsError(e: unknown): string {
  if (e instanceof BridgeClientError) {
    if (e.kind === "network") {
      return "Could not reach the clinic service. Check that the bridge is running.";
    }
    if (e.kind === "http") {
      const code = e.apiCode ?? "";
      if (code === "INVALID_PATIENT_ID") {
        return "This patient id is not valid for an appointment history request.";
      }
      if (code === "INVALID_PATIENT_APPOINTMENTS_QUERY") {
        return "The date range is not valid. Try a shorter range.";
      }
      if (code === "DATA_ROOT_NOT_CONFIGURED" || code === "SCHEDULE_DBF_NOT_FOUND") {
        return "Appointment history is not available on this bridge yet. Ask your administrator to check the data folder.";
      }
      return "Appointment history could not be loaded. Try again in a moment.";
    }
    if (e.kind === "invalid_body") {
      if (isInvalidBodySchemaMismatch(e)) {
        return "Appointment history needs a small data mapping fix. No clinic data was changed.";
      }
      return "Appointment history could not read the clinic response format. Try again.";
    }
    if (e.kind === "invalid_argument") {
      return "The date range is not valid. Try a shorter range.";
    }
  }
  return "Appointment history could not be loaded.";
}

export function safePatientMedicalSummaryError(e: unknown): string {
  if (e instanceof BridgeClientError) {
    if (e.kind === "network") {
      return "Could not reach the clinic service. Check that the bridge is running.";
    }
    if (e.kind === "http") {
      const code = e.apiCode ?? "";
      if (code === "MEDICAL_DBF_NOT_FOUND") {
        return "Medical questionnaires are not available on this bridge yet. Ask your administrator to check the data folder.";
      }
      if (code === "DATA_ROOT_NOT_CONFIGURED") {
        return "Medical summary is not available on this bridge yet. Ask your administrator to check the data folder.";
      }
      if (code === "INVALID_PATIENT_ID") {
        return "This patient id is not valid for a medical summary request.";
      }
      if (code === "MEDICAL_SUMMARY_ERROR") {
        return "The medical summary could not be loaded. Try again in a moment.";
      }
      return "The medical summary could not be loaded. Try again in a moment.";
    }
    if (e.kind === "invalid_body") {
      if (isInvalidBodySchemaMismatch(e)) {
        return "Medical summary needs a small data mapping fix. No clinic data was changed.";
      }
      return "The medical summary could not read the clinic response format. Try again.";
    }
    if (e.kind === "invalid_argument") {
      return "This patient id is not valid for a medical summary request.";
    }
  }
  return "The medical summary could not be loaded.";
}

export function safePatientTreatmentsError(e: unknown): string {
  if (e instanceof BridgeClientError) {
    if (e.kind === "network") {
      return "Could not reach the clinic service. Check that the bridge is running.";
    }
    if (e.kind === "http") {
      const code = e.apiCode ?? "";
      if (code === "OPERTBL_DBF_NOT_FOUND") {
        return "Treatment history is not available on this bridge yet. Ask your administrator to check the data folder.";
      }
      if (code === "DATA_ROOT_NOT_CONFIGURED") {
        return "Treatment history is not available on this bridge yet. Ask your administrator to check the data folder.";
      }
      if (code === "INVALID_PATIENT_ID") {
        return "This patient id is not valid for a treatment history request.";
      }
      if (code === "PATIENT_TREATMENTS_ERROR") {
        return "Treatment history could not be loaded. Try again in a moment.";
      }
      return "Treatment history could not be loaded. Try again in a moment.";
    }
    if (e.kind === "invalid_body") {
      if (isInvalidBodySchemaMismatch(e)) {
        return "Treatment history needs a small data mapping fix. No clinic data was changed.";
      }
      return "Treatment history could not read the clinic response format. Try again.";
    }
    if (e.kind === "invalid_argument") {
      return "This patient id is not valid for a treatment history request.";
    }
  }
  return "Treatment history could not be loaded.";
}

export function safePatientChartError(e: unknown): string {
  if (e instanceof BridgeClientError) {
    if (e.kind === "network") {
      return "Could not reach the clinic service. Check that the bridge is running.";
    }
    if (e.kind === "http") {
      const code = e.apiCode ?? "";
      if (code === "CHARTDBF_NOT_FOUND") {
        return "Dental chart data is not available on this bridge yet. Ask your administrator to check the data folder.";
      }
      if (code === "DATA_ROOT_NOT_CONFIGURED") {
        return "Dental chart data is not available on this bridge yet. Ask your administrator to check the data folder.";
      }
      if (code === "INVALID_PATIENT_ID") {
        return "This patient id is not valid for a chart request.";
      }
      if (code === "PATIENT_CHART_ERROR") {
        return "Dental chart could not be loaded. Try again in a moment.";
      }
      return "Dental chart could not be loaded. Try again in a moment.";
    }
    if (e.kind === "invalid_body") {
      if (isInvalidBodySchemaMismatch(e)) {
        return "Dental chart needs a small data mapping fix. No clinic data was changed.";
      }
      return "Dental chart could not read the clinic response format. Try again.";
    }
    if (e.kind === "invalid_argument") {
      return "This patient id is not valid for a chart request.";
    }
  }
  return "Dental chart could not be loaded.";
}

export function safePatientLedgerError(e: unknown): string {
  if (e instanceof BridgeClientError) {
    if (e.kind === "network") {
      return "Could not reach the clinic service. Check that the bridge is running.";
    }
    if (e.kind === "http") {
      const code = e.apiCode ?? "";
      if (code === "TRANS_DBF_NOT_FOUND") {
        return "Ledger history is not available on this bridge yet. Ask your administrator to check the data folder.";
      }
      if (code === "DATA_ROOT_NOT_CONFIGURED") {
        return "Ledger history is not available on this bridge yet. Ask your administrator to check the data folder.";
      }
      if (code === "INVALID_PATIENT_ID") {
        return "This patient id is not valid for a ledger request.";
      }
      if (code === "PATIENT_LEDGER_ERROR") {
        return "Ledger history could not be loaded. Try again in a moment.";
      }
      return "Ledger history could not be loaded. Try again in a moment.";
    }
    if (e.kind === "invalid_body") {
      if (isInvalidBodySchemaMismatch(e)) {
        return "Ledger history needs a small data mapping fix. No clinic data was changed.";
      }
      return "Ledger history could not read the clinic response format. Try again.";
    }
    if (e.kind === "invalid_argument") {
      return "This patient id is not valid for a ledger request.";
    }
  }
  return "Ledger history could not be loaded.";
}

export function safePatientTimelineError(e: unknown): string {
  if (e instanceof BridgeClientError) {
    if (e.kind === "network") {
      return "Could not reach the clinic service. Check that the bridge is running.";
    }
    if (e.kind === "http") {
      return "The patient timeline could not be loaded. Try again in a moment.";
    }
    if (e.kind === "invalid_body") {
      if (isInvalidBodySchemaMismatch(e)) {
        return "The patient timeline needs a small data mapping fix. No clinic data was changed.";
      }
      return "The patient timeline could not read the clinic response format. Try again.";
    }
  }
  return "The patient timeline could not be loaded.";
}

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

function TreatmentsBody({
  treatments,
  truncated,
  privacyNote,
  doctorLabels,
  procedureMaps,
}: {
  treatments: PatientTreatmentItem[];
  truncated: boolean;
  privacyNote: string;
  doctorLabels: ReadonlyMap<string, string>;
  procedureMaps: ProcedureReferenceMaps;
}) {
  const [filters, setFilters] = useState<TreatmentDisplayFilters>({
    year: null,
    provider: null,
    procedureCode: null,
    tooth: null,
  });

  const yearOptions = useMemo(() => treatmentYearsFromItems(treatments), [treatments]);
  const providerOptions = useMemo(
    () => treatmentProvidersFromItems(treatments, doctorLabels),
    [treatments, doctorLabels],
  );
  const codeOptions = useMemo(() => treatmentProcedureCodesFromItems(treatments), [treatments]);
  const toothOptions = useMemo(() => treatmentTeethFromItems(treatments), [treatments]);
  const filtered = useMemo(
    () => filterTreatmentsForDisplay(treatments, filters, doctorLabels),
    [treatments, filters, doctorLabels],
  );
  const monthGroups = useMemo(() => groupTreatmentsByMonth(filtered), [filtered]);
  const filterActive = treatmentsFiltersActive(filters);
  const toolbarSummary = treatmentsToolbarSummary(filtered.length, treatments.length, filterActive);
  const providerStatsLine = useMemo(
    () => treatmentsProviderStatsLine(treatmentProviderStats(filtered, doctorLabels, 3)),
    [filtered, doctorLabels],
  );

  return (
    <div className="app-patient-profile__treatments-body">
      {truncated ? (
        <p className="app-patient-profile__treatments-banner" role="note">
          {TRUNCATED_LIST_BANNER}
        </p>
      ) : null}

      <div className="app-patient-profile__clinical-toolbar">
        <p className="app-patient-profile__clinical-toolbar-summary" aria-live="polite">
          {toolbarSummary}
          {providerStatsLine ? (
            <span className="app-patient-profile__clinical-toolbar-stats"> · {providerStatsLine}</span>
          ) : null}
        </p>
        <div className="app-patient-profile__clinical-filters" role="group" aria-label="Procedure filters">
          {yearOptions.length > 1 ? (
            <div className="app-patient-profile__clinical-filter-row" role="group" aria-label="Year">
              <Button
                type="button"
                variant={filters.year === null ? "primary" : "secondary"}
                className="ui-focusable"
                onClick={() => setFilters((f) => ({ ...f, year: null }))}
              >
                {PATIENT_TAB_FILTER_ALL}
              </Button>
              {yearOptions.map((year) => (
                <Button
                  key={year}
                  type="button"
                  variant={filters.year === year ? "primary" : "secondary"}
                  className="ui-focusable"
                  onClick={() => setFilters((f) => ({ ...f, year }))}
                >
                  {year}
                </Button>
              ))}
            </div>
          ) : null}
          {providerOptions.length > 1 ? (
            <div className="app-patient-profile__clinical-filter-row" role="group" aria-label="Provider">
              <Button
                type="button"
                variant={filters.provider === null ? "primary" : "secondary"}
                className="ui-focusable"
                onClick={() => setFilters((f) => ({ ...f, provider: null }))}
              >
                {PATIENT_TAB_FILTER_ALL}
              </Button>
              {providerOptions.map((provider) => (
                <Button
                  key={provider}
                  type="button"
                  variant={filters.provider === provider ? "primary" : "secondary"}
                  className="ui-focusable"
                  onClick={() => setFilters((f) => ({ ...f, provider }))}
                >
                  {provider}
                </Button>
              ))}
            </div>
          ) : null}
          {codeOptions.length > 1 ? (
            <div className="app-patient-profile__clinical-filter-row" role="group" aria-label="Procedure code">
              <Button
                type="button"
                variant={filters.procedureCode === null ? "primary" : "secondary"}
                className="ui-focusable"
                onClick={() => setFilters((f) => ({ ...f, procedureCode: null }))}
              >
                {PATIENT_TAB_FILTER_ALL}
              </Button>
              {codeOptions.map((code) => (
                <Button
                  key={code}
                  type="button"
                  variant={filters.procedureCode === code ? "primary" : "secondary"}
                  className="ui-focusable"
                  onClick={() => setFilters((f) => ({ ...f, procedureCode: code }))}
                >
                  {code}
                </Button>
              ))}
            </div>
          ) : null}
          {toothOptions.length > 1 ? (
            <div className="app-patient-profile__clinical-filter-row" role="group" aria-label="Tooth">
              <Button
                type="button"
                variant={filters.tooth === null ? "primary" : "secondary"}
                className="ui-focusable"
                onClick={() => setFilters((f) => ({ ...f, tooth: null }))}
              >
                {PATIENT_TAB_FILTER_ALL}
              </Button>
              {toothOptions.map((toothNum) => (
                <Button
                  key={toothNum}
                  type="button"
                  variant={filters.tooth === toothNum ? "primary" : "secondary"}
                  className="ui-focusable"
                  onClick={() => setFilters((f) => ({ ...f, tooth: toothNum }))}
                >
                  {treatmentToothLabel(toothNum)}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
        {filterActive ? (
          <Button
            type="button"
            size="compact"
            variant="ghost"
            className="ui-focusable app-patient-profile__clinical-clear-filters"
            onClick={() =>
              setFilters({ year: null, provider: null, procedureCode: null, tooth: null })
            }
          >
            {FILTER_CLEAR_LABEL}
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="app-patient-profile__clinical-empty-filtered" role="status">
          {filterActive ? PATIENT_TAB_EMPTY_TREATMENTS_FILTERED : PATIENT_TAB_EMPTY_TREATMENTS}
        </p>
      ) : (
        monthGroups.map((group) => (
          <section key={group.monthKey} className="app-patient-profile__clinical-month-group">
            <h4 className="app-patient-profile__tab-section-title">
              {group.heading}
              <span className="app-patient-profile__clinical-group-count"> ({group.items.length})</span>
            </h4>
            <ul className="app-patient-profile__treatment-list" aria-label={`Procedure history for ${group.heading}`}>
              {group.items.map((t) => {
                const dateLabel = formatTreatmentDate(t.date);
                const procedure = treatmentProcedureLine(t, procedureMaps);
                const category = treatmentProcedureCategoryLabel(t, procedureMaps);
                const tooth = treatmentToothLabel(t.tooth);
                const provider = treatmentProviderLabel(t, doctorLabels);
                const status = treatmentStatusLabel(t.status);

                return (
                  <li key={t.treatmentId} className="app-patient-profile__treatment-row">
                    <div className="app-patient-profile__treatment-date">{dateLabel ?? "—"}</div>
                    <div className="app-patient-profile__treatment-main">
                      {procedure ? <p className="app-patient-profile__treatment-procedure">{procedure}</p> : null}
                      {category ? (
                        <p className="app-patient-profile__treatment-category">{category}</p>
                      ) : null}
                      <div className="app-patient-profile__treatment-meta">
                        {tooth ? <span>{tooth}</span> : null}
                        {provider ? <span>{provider}</span> : null}
                        {status ? <span>{status}</span> : null}
                      </div>
                      <div className="app-patient-profile__treatment-badges">
                        {t.hasDescription ? (
                          <Badge variant="neutral" semanticLabel="Procedure description hidden">
                            Description hidden
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      <p className="app-patient-profile__treatments-privacy">{privacyNote}</p>
    </div>
  );
}

function ChartBody({
  entries,
  truncated,
  privacyNote,
}: {
  entries: PatientChartEntry[];
  truncated: boolean;
  privacyNote: string;
}) {
  const [treatedFilter, setTreatedFilter] = useState<ChartTreatedFilter>("all");
  const [chartTypeFilter, setChartTypeFilter] = useState<number | null>(null);
  const summary = useMemo(() => chartSummaryStats(entries), [entries]);
  const typeOptions = useMemo(() => chartTypesFromEntries(entries), [entries]);
  const filtered = useMemo(
    () => filterChartEntriesForDisplay(entries, treatedFilter, chartTypeFilter),
    [entries, treatedFilter, chartTypeFilter],
  );
  const toothGroups = useMemo(() => groupChartEntriesByTooth(filtered), [filtered]);
  const hasUntreated = useMemo(() => entries.some((e) => !e.treated), [entries]);
  const showTreatedFilter = hasUntreated;
  const showTypeFilter = typeOptions.length > 1;
  const showFilterToolbar = showTreatedFilter || showTypeFilter;
  const chartFiltersActive = treatedFilter !== "all" || chartTypeFilter !== null;
  const statsLine = chartSummaryStripLabel(summary);
  const toolbarLine = chartToolbarSummary(filtered.length, entries.length, chartFiltersActive, statsLine);

  return (
    <div className="app-patient-profile__chart-body">
      {truncated ? (
        <p className="app-patient-profile__chart-banner" role="note">
          {TRUNCATED_LIST_BANNER}
        </p>
      ) : null}

      <p className="app-patient-profile__chart-explainer" role="note">
        {PATIENT_TAB_CHART_EXPLAINER}
      </p>

      <p className="app-patient-profile__chart-summary-strip" aria-live="polite">
        {chartSummaryStripLabel(summary)}
      </p>

      <div className="app-patient-profile__clinical-toolbar">
        <p className="app-patient-profile__clinical-toolbar-summary" aria-live="polite">
          {toolbarLine}
        </p>
        {showFilterToolbar ? (
          <>
          <div className="app-patient-profile__clinical-filters" role="group" aria-label="Chart entry filters">
            {showTreatedFilter ? (
              <div className="app-patient-profile__clinical-filter-row" role="group" aria-label="Treated status">
                <Button
                  type="button"
                  variant={treatedFilter === "all" ? "primary" : "secondary"}
                  className="ui-focusable"
                  onClick={() => setTreatedFilter("all")}
                >
                  {PATIENT_TAB_CHART_FILTER_ALL}
                </Button>
                <Button
                  type="button"
                  variant={treatedFilter === "treated" ? "primary" : "secondary"}
                  className="ui-focusable"
                  onClick={() => setTreatedFilter("treated")}
                >
                  {PATIENT_TAB_CHART_FILTER_TREATED}
                </Button>
              </div>
            ) : null}
            {showTypeFilter ? (
              <div className="app-patient-profile__clinical-filter-row" role="group" aria-label="Chart type">
                <Button
                  type="button"
                  variant={chartTypeFilter === null ? "primary" : "secondary"}
                  className="ui-focusable"
                  onClick={() => setChartTypeFilter(null)}
                >
                  {PATIENT_TAB_FILTER_ALL}
                </Button>
                {typeOptions.map((typeCode) => (
                  <Button
                    key={typeCode}
                    type="button"
                    variant={chartTypeFilter === typeCode ? "primary" : "secondary"}
                    className="ui-focusable"
                    onClick={() => setChartTypeFilter(typeCode)}
                  >
                    {chartTypeLabel(typeCode)}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
          {chartFiltersActive ? (
            <Button
              type="button"
              size="compact"
              variant="ghost"
              className="ui-focusable app-patient-profile__clinical-clear-filters"
              onClick={() => {
                setTreatedFilter("all");
                setChartTypeFilter(null);
              }}
            >
              {FILTER_CLEAR_LABEL}
            </Button>
          ) : null}
          </>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="app-patient-profile__clinical-empty-filtered" role="status">
          {chartFiltersActive ? PATIENT_TAB_EMPTY_CHART_FILTERED : PATIENT_TAB_EMPTY_CHART}
        </p>
      ) : (
        toothGroups.map((group) => (
          <section key={group.toothKey} className="app-patient-profile__clinical-tooth-group">
            <h4 className="app-patient-profile__tab-section-title">
              {group.toothLabel}
              <span className="app-patient-profile__clinical-group-count"> ({group.entries.length})</span>
            </h4>
            <ul className="app-patient-profile__chart-list" aria-label={`Chart entries for ${group.toothLabel}`}>
              {group.entries.map((row) => (
                <li key={row.chartEntryId} className="app-patient-profile__chart-row">
                  <div className="app-patient-profile__chart-main">
                    <div className="app-patient-profile__chart-meta">
                      <span>{chartTypeLabel(row.chartType)}</span>
                      <span>{chartTreatedLabel(row.treated)}</span>
                    </div>
                    <div className="app-patient-profile__chart-badges">
                      {row.hasNote ? (
                        <Badge variant="neutral" semanticLabel="Chart note hidden">
                          Note hidden
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <p className="app-patient-profile__chart-privacy">{privacyNote}</p>
    </div>
  );
}

function ProfileSummaryCard({
  profile,
  activeLabel,
  doctorLabels,
}: {
  profile: PatientProfileResponse;
  activeLabel: string | null;
  doctorLabels: ReadonlyMap<string, string>;
}) {
  return (
    <Card className="app-patient-profile__card">
      <CardHeader>
        <div className="app-patient-profile__card-head">
          <div>
            <p className="app-patient-profile__name">{profile.displayName}</p>
            {profile.reverseName ? <p className="app-patient-profile__rev">{profile.reverseName}</p> : null}
          </div>
          {activeLabel ? (
            <Badge variant={profile.active ? "success" : "neutral"} semanticLabel={`Account status: ${activeLabel}`}>
              {activeLabel}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardBody>
        <dl className="app-patient-profile__dl">
          <div className="app-patient-profile__row">
            <dt>Chart number</dt>
            <dd>{profile.chartNumber ?? "—"}</dd>
          </div>
          <div className="app-patient-profile__row">
            <dt>Record id</dt>
            <dd>{profile.patientId}</dd>
          </div>
          <div className="app-patient-profile__row">
            <dt>Phone (masked)</dt>
            <dd>{profile.phoneMask ?? "—"}</dd>
          </div>
          <div className="app-patient-profile__row">
            <dt>Provider</dt>
            <dd>{profileAssignedProviderLabel(profile.doctorId, doctorLabels)}</dd>
          </div>
          <div className="app-patient-profile__row">
            <dt>Entry date</dt>
            <dd>{profile.entryDate ?? "—"}</dd>
          </div>
          <div className="app-patient-profile__row">
            <dt>Last visit</dt>
            <dd>{profile.lastVisit ?? "—"}</dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}

function LedgerBody({
  entries,
  truncated,
  privacyNote,
}: {
  entries: LedgerEntryV1[];
  truncated: boolean;
  privacyNote: string;
}) {
  const [typeFilter, setTypeFilter] = useState<LedgerEntryTypeFilter>(null);
  const typeOptions = useMemo(() => ledgerTypeFiltersPresent(entries), [entries]);
  const filtered = useMemo(
    () => filterLedgerEntriesByType(entries, typeFilter),
    [entries, typeFilter],
  );
  const monthGroups = useMemo(() => groupLedgerEntriesByMonth(filtered), [filtered]);
  const filterActive = ledgerTypeFilterActive(typeFilter);
  const toolbarSummary = ledgerToolbarSummary(filtered.length, entries.length, filterActive);
  const typeDistribution = useMemo(
    () => formatLedgerTypeDistribution(ledgerTypeDistributionCounts(filtered)),
    [filtered],
  );

  return (
    <div className="app-patient-profile__ledger-body">
      {truncated ? (
        <p className="app-patient-profile__ledger-banner" role="note">
          {TRUNCATED_LIST_BANNER}
        </p>
      ) : null}

      <div className="app-patient-profile__clinical-toolbar">
        <div className="app-patient-profile__clinical-toolbar-head">
          <p className="app-patient-profile__clinical-toolbar-summary" aria-live="polite">
            {toolbarSummary}
            {typeDistribution ? (
              <span className="app-patient-profile__clinical-toolbar-stats"> · {typeDistribution}</span>
            ) : null}
          </p>
          <Badge variant="neutral" semanticLabel={PATIENT_TAB_LEDGER_AMOUNTS_CHIP}>
            {PATIENT_TAB_LEDGER_AMOUNTS_CHIP}
          </Badge>
        </div>
        {typeOptions.length > 1 ? (
          <div className="app-patient-profile__clinical-filters" role="group" aria-label="Entry type">
            <Button
              type="button"
              variant={typeFilter === null ? "primary" : "secondary"}
              className="ui-focusable"
              onClick={() => setTypeFilter(null)}
            >
              {PATIENT_TAB_FILTER_ALL}
            </Button>
            {typeOptions.includes("charge") ? (
              <Button
                type="button"
                variant={typeFilter === "charge" ? "primary" : "secondary"}
                className="ui-focusable"
                onClick={() => setTypeFilter("charge")}
              >
                {PATIENT_TAB_LEDGER_FILTER_CHARGE}
              </Button>
            ) : null}
            {typeOptions.includes("adjustment") ? (
              <Button
                type="button"
                variant={typeFilter === "adjustment" ? "primary" : "secondary"}
                className="ui-focusable"
                onClick={() => setTypeFilter("adjustment")}
              >
                {PATIENT_TAB_LEDGER_FILTER_ADJUSTMENT}
              </Button>
            ) : null}
            {typeOptions.includes("payment") ? (
              <Button
                type="button"
                variant={typeFilter === "payment" ? "primary" : "secondary"}
                className="ui-focusable"
                onClick={() => setTypeFilter("payment")}
              >
                {PATIENT_TAB_LEDGER_FILTER_PAYMENT}
              </Button>
            ) : null}
          </div>
        ) : null}
        {filterActive ? (
          <Button
            type="button"
            size="compact"
            variant="ghost"
            className="ui-focusable app-patient-profile__clinical-clear-filters"
            onClick={() => setTypeFilter(null)}
          >
            {FILTER_CLEAR_LABEL}
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="app-patient-profile__clinical-empty-filtered" role="status">
          {filterActive ? PATIENT_TAB_EMPTY_LEDGER_FILTERED : PATIENT_TAB_EMPTY_LEDGER}
        </p>
      ) : (
        monthGroups.map((group) => (
          <section key={group.monthKey} className="app-patient-profile__clinical-month-group">
            <h4 className="app-patient-profile__tab-section-title">
              {formatLedgerMonthGroupHeading(group.monthKey, group.items.length)}
            </h4>
            <ul className="app-patient-profile__ledger-list" aria-label={`Ledger entries for ${group.heading}`}>
              {group.items.map((row) => {
                const dateLabel = formatLedgerDate(row.date);
                const charge = ledgerChargeTypeLabel(row.chargeTypeCode);
                const adjustment = ledgerAdjustmentTypeLabel(row.adjustmentTypeCode);
                const payment = ledgerPaymentTypeLabel(row.paymentTypeCode);
                const card = ledgerCardPaymentLabel(row.isCardPayment);

                return (
                  <li key={row.ledgerEntryId} className="app-patient-profile__ledger-row">
                    <div className="app-patient-profile__ledger-date">{dateLabel ?? "—"}</div>
                    <div className="app-patient-profile__ledger-main">
                      <div className="app-patient-profile__ledger-meta">
                        {charge ? <span>{charge}</span> : null}
                        {adjustment ? <span>{adjustment}</span> : null}
                        {payment ? <span>{payment}</span> : null}
                        {card ? <span>{card}</span> : null}
                      </div>
                      <div className="app-patient-profile__ledger-badges">
                        {row.hasDescription ? (
                          <Badge variant="neutral" semanticLabel="Ledger description hidden">
                            Description hidden
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      <p className="app-patient-profile__ledger-privacy">{privacyNote}</p>
    </div>
  );
}

function MedicalSummaryBody({ summary }: { summary: PatientMedicalSummaryResponse }) {
  const sensitive = summary.hasSensitiveMedicalDetails;
  const conditionSections = sensitive
    ? { general: [], additional: [] }
    : medicalConditionSectionsForDisplay(summary.conditions);
  const visibleNamedCount = conditionSections.general.length + conditionSections.additional.length;
  const lastUpdatedLabel = formatMedicalQuestionnaireDate(summary.lastUpdated) ?? "—";
  const lastDentalLabel = formatMedicalQuestionnaireDate(summary.lastDentalVisit) ?? "—";
  const partialFlagNote = medicalFlaggedCountNeedsPartialNote(
    summary.flaggedConditionCount,
    visibleNamedCount,
  );
  const sectionCount =
    (conditionSections.general.length > 0 ? 1 : 0) +
    (conditionSections.additional.length > 0 ? 1 : 0) +
    1;
  const toolbarLine = medicalToolbarSummary(summary.flaggedConditionCount, sectionCount);

  return (
    <div className="app-patient-profile__medical-body">
      <div className="app-patient-profile__clinical-toolbar">
        <p className="app-patient-profile__clinical-toolbar-summary" aria-live="polite">
          {toolbarLine}
        </p>
      </div>
      {sensitive ? (
        <>
          <p className="app-patient-profile__medical-banner" role="note">
            {SENSITIVE_MEDICAL_BANNER}
          </p>
          <div className="app-patient-profile__medical-sensitive-detail" role="note">
            <p className="app-patient-profile__medical-sensitive-heading">Hidden in this preview</p>
            <ul className="app-patient-profile__medical-sensitive-list">
              {MEDICAL_SENSITIVE_STILL_HIDDEN.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="app-patient-profile__medical-sensitive-heading">Still shown</p>
            <ul className="app-patient-profile__medical-sensitive-list">
              {MEDICAL_SENSITIVE_STILL_SHOWN.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      <h4 className="app-patient-profile__tab-section-title">{PATIENT_TAB_SECTION_QUESTIONNAIRE}</h4>
      <dl className="app-patient-profile__dl app-patient-profile__medical-questionnaire">
        <div className="app-patient-profile__row app-patient-profile__medical-questionnaire-primary">
          <dt>{PATIENT_TAB_QUESTIONNAIRE_LAST_UPDATED}</dt>
          <dd>
            <strong>{lastUpdatedLabel}</strong>
          </dd>
        </div>
        <div className="app-patient-profile__row">
          <dt>{PATIENT_TAB_QUESTIONNAIRE_DENTAL_VISIT}</dt>
          <dd>{lastDentalLabel}</dd>
        </div>
        <div className="app-patient-profile__row">
          <dt>Flagged screening items</dt>
          <dd>
            {summary.flaggedConditionCount}
            {partialFlagNote ? (
              <span className="app-patient-profile__medical-flag-note">
                {" "}
                — {medicalFlaggedCountPartialNote(summary.flaggedConditionCount)}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      {!sensitive && conditionSections.general.length > 0 ? (
        <>
          <h4 className="app-patient-profile__tab-section-title">{PATIENT_TAB_SECTION_GENERAL_SCREENING}</h4>
          <ul className="app-patient-profile__medical-flags" aria-label={PATIENT_TAB_SECTION_GENERAL_SCREENING}>
            {conditionSections.general.map((item) => (
              <li key={item.key}>{item.label}</li>
            ))}
          </ul>
        </>
      ) : null}

      {!sensitive && conditionSections.additional.length > 0 ? (
        <>
          <h4 className="app-patient-profile__tab-section-title">{PATIENT_TAB_SECTION_ADDITIONAL_MARKERS}</h4>
          <ul className="app-patient-profile__medical-flags" aria-label={PATIENT_TAB_SECTION_ADDITIONAL_MARKERS}>
            {conditionSections.additional.map((item) => (
              <li key={item.key}>{item.label}</li>
            ))}
          </ul>
        </>
      ) : null}

      {!sensitive && visibleNamedCount === 0 && summary.flaggedConditionCount === 0 ? (
        <p className="app-patient-profile__medical-muted">No screening flags marked yes.</p>
      ) : null}

      {sensitive && summary.flaggedConditionCount > 0 ? (
        <p className="app-patient-profile__medical-muted" role="note">
          {medicalFlaggedCountPartialNote(summary.flaggedConditionCount)}
        </p>
      ) : null}

      <p className="app-patient-profile__medical-privacy">{summary.privacyNote}</p>
    </div>
  );
}

function groupAppointmentsByDate(
  list: ScheduleAppointmentItem[],
): Map<string, ScheduleAppointmentItem[]> {
  const map = new Map<string, ScheduleAppointmentItem[]>();
  for (const a of list) {
    const bucket = map.get(a.date) ?? [];
    bucket.push(a);
    map.set(a.date, bucket);
  }
  for (const [, rows] of map) {
    rows.sort((x, y) => x.time.localeCompare(y.time) || x.id.localeCompare(y.id));
  }
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function PatientPageSearchBlock({
  patientId,
  bridgePhase,
  bridgeBaseUrl,
  fetchImpl,
  onPatientRecordSelect,
  onPatientSelectionClear,
  recentPatients,
  onRecentPatientSelect,
  clearSelectionOnQueryChange,
  title,
}: {
  patientId: string | null;
  bridgePhase: BridgeHealthPhase;
  bridgeBaseUrl?: string;
  fetchImpl?: typeof fetch;
  onPatientRecordSelect?: (hit: PatientSearchHit) => void;
  onPatientSelectionClear?: () => void;
  recentPatients?: readonly SessionRecentPatient[];
  onRecentPatientSelect?: (entry: SessionRecentPatient) => void;
  clearSelectionOnQueryChange: boolean;
  title?: string;
}) {
  return (
    <section className="app-patient-profile__search" aria-labelledby={title ? "app-patients-page-search-heading" : undefined}>
      {title ? (
        <h3 id="app-patients-page-search-heading" className="app-patient-profile__search-title">
          {title}
        </h3>
      ) : null}
      <PatientSearchBar
        instanceId="page"
        bridgePhase={bridgePhase}
        bridgeBaseUrl={bridgeBaseUrl}
        selectedPatientId={patientId}
        recentPatients={recentPatients}
        fetchImpl={fetchImpl}
        clearSelectionOnQueryChange={clearSelectionOnQueryChange}
        onPatientRecordSelect={onPatientRecordSelect}
        onRecentPatientSelect={onRecentPatientSelect}
        onPatientSelectionClear={onPatientSelectionClear}
      />
    </section>
  );
}

export function PatientProfilePanel({
  patientId,
  bridgePhase,
  bridgeBaseUrl,
  fetchImpl,
  sandboxWritePilot = false,
  writeCapability = null,
  onBackToday,
  onClearPatient,
  onPatientRecordSelect,
  recentPatients = [],
  onRecentPatientSelect,
  onOpenScheduleAtDate,
}: PatientProfilePanelProps) {
  const base = bridgeBaseUrl?.trim() ?? "";
  const { labels: doctorLabels } = useDoctorLabels({
    bridgePhase,
    bridgeBaseUrl,
    fetchImpl,
    enabled: patientId !== null,
  });
  const { maps: procedureMaps } = useProcedureReference({
    bridgePhase,
    bridgeBaseUrl,
    fetchImpl,
    enabled: patientId !== null,
  });
  const [roomMap, setRoomMap] = useState<RoomLabelMap>(() => new Map());

  useEffect(() => {
    if (!base || bridgePhase !== "connected" || patientId === null) {
      setRoomMap(new Map());
      return;
    }

    let cancelled = false;
    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });

    void (async () => {
      try {
        const res = await client.getScheduleRooms();
        if (!cancelled) {
          setRoomMap(buildRoomLabelMap(res.rooms));
        }
      } catch {
        if (!cancelled) {
          setRoomMap(new Map());
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [base, bridgePhase, fetchImpl]);

  const [state, setState] = useState<LoadState>({ phase: "idle" });
  const [retryNonce, setRetryNonce] = useState(0);
  const requestSeq = useRef(0);

  const [activeTab, setActiveTab] = useState<ProfileTab | null>(null);
  const [rangePreset, setRangePreset] = useState<PatientApptRangePreset>("default");
  const [apptRange, setApptRange] = useState(() => defaultPatientApptRange());
  const [apptState, setApptState] = useState<ApptLoadState>({ phase: "idle" });
  const [apptRefreshNonce, setApptRefreshNonce] = useState(0);
  const apptRequestSeq = useRef(0);

  const [medState, setMedState] = useState<MedLoadState>({ phase: "idle" });
  const [medRefreshNonce, setMedRefreshNonce] = useState(0);
  const medRequestSeq = useRef(0);

  const [txState, setTxState] = useState<TxLoadState>({ phase: "idle" });
  const [txRefreshNonce, setTxRefreshNonce] = useState(0);
  const txRequestSeq = useRef(0);

  const [chartState, setChartState] = useState<ChartLoadState>({ phase: "idle" });
  const [chartRefreshNonce, setChartRefreshNonce] = useState(0);
  const chartRequestSeq = useRef(0);

  const [ledgerState, setLedgerState] = useState<LedgerLoadState>({ phase: "idle" });
  const [ledgerRefreshNonce, setLedgerRefreshNonce] = useState(0);
  const ledgerRequestSeq = useRef(0);

  const [timelineState, setTimelineState] = useState<TimelineLoadState>({ phase: "idle" });
  const [timelineRefreshNonce, setTimelineRefreshNonce] = useState(0);
  const [timelineKindFilter, setTimelineKindFilter] = useState<TimelineKindFilter>("all");
  const timelineRequestSeq = useRef(0);
  const [chartToothFilter, setChartToothFilter] = useState<number | null>(null);

  const [changePatientSearchOpen, setChangePatientSearchOpen] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);
  const touchLastLoadedAt = useCallback(() => {
    setLastLoadedAt(Date.now());
  }, []);

  const [apptTimeDirection, setApptTimeDirection] = useState<PatientApptTimeDirection>("all");
  const [apptStatusFilter, setApptStatusFilter] = useState<number | null>(null);
  const [apptRoomFilter, setApptRoomFilter] = useState<number | null>(null);
  const [apptProviderFilter, setApptProviderFilter] = useState<number | null>(null);

  const [summaryAppt, setSummaryAppt] = useState<SummaryApptPrefetch>({ phase: "idle", appointments: [] });
  const [summaryMed, setSummaryMed] = useState<SummaryMedPrefetch>({
    phase: "idle",
    hasMedicalRecord: false,
    flaggedConditionCount: 0,
    sensitive: false,
  });
  const [summaryTx, setSummaryTx] = useState<SummaryCountPrefetch>({ phase: "idle", count: 0, truncated: false });
  const [summaryChart, setSummaryChart] = useState<SummaryCountPrefetch>({ phase: "idle", count: 0, truncated: false });
  const [summaryLedger, setSummaryLedger] = useState<SummaryCountPrefetch>({ phase: "idle", count: 0, truncated: false });
  const [summaryRefreshNonce, setSummaryRefreshNonce] = useState(0);
  const summaryRequestSeq = useRef(0);

  useEffect(() => {
    if (patientId === null) {
      setChangePatientSearchOpen(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (patientId === null) {
      setState({ phase: "idle" });
      return;
    }
    if (!base) {
      setState({ phase: "offline" });
      return;
    }
    if (bridgePhase !== "connected") {
      setState({ phase: "offline" });
      return;
    }

    const seq = ++requestSeq.current;
    setState({ phase: "loading" });

    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });
    let cancelled = false;

    void (async () => {
      try {
        const profile = await client.getPatientProfile(patientId);
        if (cancelled || seq !== requestSeq.current) return;
        setState({ phase: "loaded", profile });
        touchLastLoadedAt();
      } catch (e: unknown) {
        if (cancelled || seq !== requestSeq.current) return;
        if (e instanceof BridgeClientError && e.kind === "http" && e.status === 404 && e.apiCode === "PATIENT_NOT_FOUND") {
          setState({ phase: "not_found" });
          return;
        }
        setState({ phase: "error", message: safePatientProfileError(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, base, bridgePhase, fetchImpl, retryNonce, touchLastLoadedAt]);

  useEffect(() => {
    if (patientId === null || activeTab !== "summary") {
      setSummaryAppt({ phase: "idle", appointments: [] });
      setSummaryMed({ phase: "idle", hasMedicalRecord: false, flaggedConditionCount: 0, sensitive: false });
      setSummaryTx({ phase: "idle", count: 0, truncated: false });
      setSummaryChart({ phase: "idle", count: 0, truncated: false });
      setSummaryLedger({ phase: "idle", count: 0, truncated: false });
      return;
    }
    if (!base || bridgePhase !== "connected") {
      setSummaryAppt({ phase: "offline", appointments: [] });
      setSummaryMed({ phase: "offline", hasMedicalRecord: false, flaggedConditionCount: 0, sensitive: false });
      setSummaryTx({ phase: "offline", count: 0, truncated: false });
      setSummaryChart({ phase: "offline", count: 0, truncated: false });
      setSummaryLedger({ phase: "offline", count: 0, truncated: false });
      return;
    }

    const seq = ++summaryRequestSeq.current;
    setSummaryAppt({ phase: "loading", appointments: [] });
    setSummaryMed({ phase: "loading", hasMedicalRecord: false, flaggedConditionCount: 0, sensitive: false });
    setSummaryTx({ phase: "loading", count: 0, truncated: false });
    setSummaryChart({ phase: "loading", count: 0, truncated: false });
    setSummaryLedger({ phase: "loading", count: 0, truncated: false });

    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });
    const summaryRange = defaultPatientApptRange();
    let cancelled = false;

    void (async () => {
      await Promise.all([
        (async () => {
          try {
            const data = await client.getPatientAppointments(patientId, summaryRange);
            if (cancelled || seq !== summaryRequestSeq.current) return;
            if (data.appointments.length === 0) {
              setSummaryAppt({ phase: "empty", appointments: [] });
            } else {
              setSummaryAppt({ phase: "loaded", appointments: data.appointments });
            }
            touchLastLoadedAt();
          } catch {
            if (cancelled || seq !== summaryRequestSeq.current) return;
            setSummaryAppt({ phase: "error", appointments: [] });
          }
        })(),
        (async () => {
          try {
            const summary = await client.getPatientMedicalSummary(patientId);
            if (cancelled || seq !== summaryRequestSeq.current) return;
            if (!summary.hasMedicalRecord) {
              setSummaryMed({
                phase: "empty",
                hasMedicalRecord: false,
                flaggedConditionCount: 0,
                sensitive: false,
              });
            } else {
              setSummaryMed({
                phase: "loaded",
                hasMedicalRecord: true,
                flaggedConditionCount: summary.flaggedConditionCount,
                sensitive: summary.hasSensitiveMedicalDetails,
              });
            }
            touchLastLoadedAt();
          } catch {
            if (cancelled || seq !== summaryRequestSeq.current) return;
            setSummaryMed({ phase: "error", hasMedicalRecord: false, flaggedConditionCount: 0, sensitive: false });
          }
        })(),
        (async () => {
          try {
            const data = await client.getPatientTreatments(patientId);
            if (cancelled || seq !== summaryRequestSeq.current) return;
            if (data.treatments.length === 0) {
              setSummaryTx({ phase: "empty", count: 0, truncated: data.truncated });
            } else {
              setSummaryTx({ phase: "loaded", count: data.treatments.length, truncated: data.truncated });
            }
            touchLastLoadedAt();
          } catch {
            if (cancelled || seq !== summaryRequestSeq.current) return;
            setSummaryTx({ phase: "error", count: 0, truncated: false });
          }
        })(),
        (async () => {
          try {
            const data = await client.getPatientChart(patientId);
            if (cancelled || seq !== summaryRequestSeq.current) return;
            if (data.entries.length === 0) {
              setSummaryChart({ phase: "empty", count: 0, truncated: data.truncated });
            } else {
              setSummaryChart({ phase: "loaded", count: data.entries.length, truncated: data.truncated });
            }
            touchLastLoadedAt();
          } catch {
            if (cancelled || seq !== summaryRequestSeq.current) return;
            setSummaryChart({ phase: "error", count: 0, truncated: false });
          }
        })(),
        (async () => {
          try {
            const data = await client.getPatientLedger(patientId);
            if (cancelled || seq !== summaryRequestSeq.current) return;
            if (data.entries.length === 0) {
              setSummaryLedger({ phase: "empty", count: 0, truncated: data.truncated });
            } else {
              setSummaryLedger({ phase: "loaded", count: data.entries.length, truncated: data.truncated });
            }
            touchLastLoadedAt();
          } catch {
            if (cancelled || seq !== summaryRequestSeq.current) return;
            setSummaryLedger({ phase: "error", count: 0, truncated: false });
          }
        })(),
      ]);
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, base, bridgePhase, fetchImpl, activeTab, summaryRefreshNonce, touchLastLoadedAt]);

  useEffect(() => {
    if (patientId === null) {
      setApptState({ phase: "idle" });
      return;
    }
    if (activeTab !== "appointments") {
      setApptState({ phase: "idle" });
      return;
    }
    if (!base || bridgePhase !== "connected") {
      setApptState({ phase: "offline" });
      return;
    }

    const seq = ++apptRequestSeq.current;
    setApptState({ phase: "loading" });

    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });
    let cancelled = false;

    void (async () => {
      try {
        const data = await client.getPatientAppointments(patientId, apptRange);
        if (cancelled || seq !== apptRequestSeq.current) return;
        if (data.appointments.length === 0) {
          setApptState({ phase: "empty" });
        } else {
          setApptState({ phase: "loaded", appointments: data.appointments });
        }
        touchLastLoadedAt();
      } catch (e: unknown) {
        if (cancelled || seq !== apptRequestSeq.current) return;
        setApptState({ phase: "error", message: safePatientAppointmentsError(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, base, bridgePhase, fetchImpl, activeTab, apptRange, apptRefreshNonce, touchLastLoadedAt]);

  useEffect(() => {
    if (patientId === null) {
      setMedState({ phase: "idle" });
      return;
    }
    if (activeTab !== "medical") {
      setMedState({ phase: "idle" });
      return;
    }
    if (!base || bridgePhase !== "connected") {
      setMedState({ phase: "offline" });
      return;
    }

    const seq = ++medRequestSeq.current;
    setMedState({ phase: "loading" });

    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });
    let cancelled = false;

    void (async () => {
      try {
        const summary = await client.getPatientMedicalSummary(patientId);
        if (cancelled || seq !== medRequestSeq.current) return;
        if (!summary.hasMedicalRecord) {
          setMedState({ phase: "no_record" });
        } else {
          setMedState({ phase: "loaded", summary });
        }
        touchLastLoadedAt();
      } catch (e: unknown) {
        if (cancelled || seq !== medRequestSeq.current) return;
        setMedState({ phase: "error", message: safePatientMedicalSummaryError(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, base, bridgePhase, fetchImpl, activeTab, medRefreshNonce, touchLastLoadedAt]);

  useEffect(() => {
    if (patientId === null) {
      setTxState({ phase: "idle" });
      return;
    }
    if (activeTab !== "treatments") {
      setTxState({ phase: "idle" });
      return;
    }
    if (!base || bridgePhase !== "connected") {
      setTxState({ phase: "offline" });
      return;
    }

    const seq = ++txRequestSeq.current;
    setTxState({ phase: "loading" });

    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });
    let cancelled = false;

    void (async () => {
      try {
        const data = await client.getPatientTreatments(patientId);
        if (cancelled || seq !== txRequestSeq.current) return;
        if (data.treatments.length === 0) {
          setTxState({ phase: "empty" });
        } else {
          setTxState({
            phase: "loaded",
            treatments: data.treatments,
            truncated: data.truncated,
            privacyNote: data.privacyNote,
          });
        }
        touchLastLoadedAt();
      } catch (e: unknown) {
        if (cancelled || seq !== txRequestSeq.current) return;
        setTxState({ phase: "error", message: safePatientTreatmentsError(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, base, bridgePhase, fetchImpl, activeTab, txRefreshNonce, touchLastLoadedAt]);

  useEffect(() => {
    if (patientId === null) {
      setChartState({ phase: "idle" });
      return;
    }
    if (activeTab !== "chart") {
      setChartState({ phase: "idle" });
      return;
    }
    if (!base || bridgePhase !== "connected") {
      setChartState({ phase: "offline" });
      return;
    }

    const seq = ++chartRequestSeq.current;
    setChartState({ phase: "loading" });

    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });
    let cancelled = false;

    void (async () => {
      try {
        const data = await client.getPatientChart(patientId);
        if (cancelled || seq !== chartRequestSeq.current) return;
        if (data.entries.length === 0) {
          setChartState({ phase: "empty" });
        } else {
          setChartState({
            phase: "loaded",
            entries: data.entries,
            truncated: data.truncated,
            privacyNote: data.privacyNote,
          });
        }
        touchLastLoadedAt();
      } catch (e: unknown) {
        if (cancelled || seq !== chartRequestSeq.current) return;
        setChartState({ phase: "error", message: safePatientChartError(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, base, bridgePhase, fetchImpl, activeTab, chartRefreshNonce, touchLastLoadedAt]);

  useEffect(() => {
    if (patientId === null) {
      setLedgerState({ phase: "idle" });
      return;
    }
    if (activeTab !== "ledger") {
      setLedgerState({ phase: "idle" });
      return;
    }
    if (!base || bridgePhase !== "connected") {
      setLedgerState({ phase: "offline" });
      return;
    }

    const seq = ++ledgerRequestSeq.current;
    setLedgerState({ phase: "loading" });

    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });
    let cancelled = false;

    void (async () => {
      try {
        const data = await client.getPatientLedger(patientId);
        if (cancelled || seq !== ledgerRequestSeq.current) return;
        if (data.entries.length === 0) {
          setLedgerState({ phase: "empty" });
        } else {
          setLedgerState({
            phase: "loaded",
            entries: data.entries,
            truncated: data.truncated,
            privacyNote: data.privacyNote,
          });
        }
        touchLastLoadedAt();
      } catch (e: unknown) {
        if (cancelled || seq !== ledgerRequestSeq.current) return;
        setLedgerState({ phase: "error", message: safePatientLedgerError(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, base, bridgePhase, fetchImpl, activeTab, ledgerRefreshNonce, touchLastLoadedAt]);

  useEffect(() => {
    if (patientId === null) {
      setTimelineState({ phase: "idle" });
      return;
    }
    if (activeTab !== "timeline") {
      setTimelineState({ phase: "idle" });
      return;
    }
    if (!base || bridgePhase !== "connected") {
      setTimelineState({ phase: "offline" });
      return;
    }

    const seq = ++timelineRequestSeq.current;
    setTimelineState({ phase: "loading" });

    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });
    const apptRange = timelinePatientApptRange();
    let cancelled = false;

    void (async () => {
      try {
        const [apptData, txData, chartData, ledgerData, medSummary] = await Promise.all([
          client.getPatientAppointments(patientId, apptRange),
          client.getPatientTreatments(patientId),
          client.getPatientChart(patientId),
          client.getPatientLedger(patientId),
          client.getPatientMedicalSummary(patientId).catch(() => null),
        ]);
        if (cancelled || seq !== timelineRequestSeq.current) return;
        setTimelineState({
          phase: "loaded",
          appointments: apptData.appointments,
          treatments: txData.treatments,
          ledgerEntries: ledgerData.entries,
          chartEntries: chartData.entries,
          medicalSummary: medSummary,
          apptRange,
          truncated: {
            treatments: txData.truncated,
            ledger: ledgerData.truncated,
            chart: chartData.truncated,
          },
        });
        touchLastLoadedAt();
      } catch (e: unknown) {
        if (cancelled || seq !== timelineRequestSeq.current) return;
        setTimelineState({ phase: "error", message: safePatientTimelineError(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, base, bridgePhase, fetchImpl, activeTab, timelineRefreshNonce, touchLastLoadedAt]);

  useEffect(() => {
    if (patientId === null) {
      setActiveTab(null);
      setRangePreset("default");
      setApptRange(defaultPatientApptRange());
      setApptTimeDirection("all");
      setApptStatusFilter(null);
      setApptRoomFilter(null);
      setApptProviderFilter(null);
      setChartToothFilter(null);
      setLastLoadedAt(null);
      setApptState({ phase: "idle" });
      setMedState({ phase: "idle" });
      setTxState({ phase: "idle" });
      setChartState({ phase: "idle" });
      setLedgerState({ phase: "idle" });
      setTimelineState({ phase: "idle" });
      setTimelineKindFilter("all");
    }
  }, [patientId]);

  useEffect(() => {
    if (state.phase === "loaded" && activeTab === null) {
      setActiveTab("summary");
    }
  }, [state.phase, activeTab]);

  const activeLabel = useMemo(() => {
    if (state.phase === "loaded") {
      if (state.profile.active === true) return "Active";
      if (state.profile.active === false) return "Inactive";
    }
    return null;
  }, [state]);

  const filteredAppts = useMemo(() => {
    if (apptState.phase !== "loaded") return [];
    return filterPatientAppointments(apptState.appointments, {
      timeDirection: apptTimeDirection,
      statusFilter: apptStatusFilter,
      roomFilter: apptRoomFilter,
      providerFilter: apptProviderFilter,
    });
  }, [apptState, apptTimeDirection, apptStatusFilter, apptRoomFilter, apptProviderFilter]);

  const apptRoomsInRange = useMemo(() => {
    if (apptState.phase !== "loaded") return [];
    return patientApptUniqueRooms(apptState.appointments);
  }, [apptState]);

  const apptProviderOptions = useMemo(() => {
    if (apptState.phase !== "loaded") return [];
    return patientApptProviderFilterOptions(apptState.appointments, doctorLabels);
  }, [apptState, doctorLabels]);

  const groupedAppts = useMemo(() => groupAppointmentsByDate(filteredAppts), [filteredAppts]);

  const rangeHeading = formatApptRangeHeading(apptRange.from, apptRange.to);

  const timelineModel = useMemo(() => {
    if (timelineState.phase !== "loaded" || state.phase !== "loaded") return null;
    const built = buildTimelineDisplayModel({
      profile: state.profile,
      appointments: timelineState.appointments,
      treatments: timelineState.treatments,
      ledgerEntries: timelineState.ledgerEntries,
      chartEntries: timelineState.chartEntries,
      medicalSummary: timelineState.medicalSummary,
      apptRange: timelineState.apptRange,
      truncated: timelineState.truncated,
      doctorLabels,
      procedureMaps,
      roomMap,
    });
    return filterTimelineDisplayModel(built, timelineKindFilter);
  }, [timelineState, state, doctorLabels, procedureMaps, roomMap, timelineKindFilter]);

  const summaryTimeline = useMemo((): SummaryCountPrefetch => {
    if (state.phase !== "loaded") {
      return { phase: "idle", count: 0, truncated: false };
    }
    const phases = [summaryAppt.phase, summaryMed.phase, summaryTx.phase, summaryChart.phase, summaryLedger.phase];
    if (phases.some((p) => p === "loading" || p === "idle")) {
      return { phase: "loading", count: 0, truncated: false };
    }
    if (phases.some((p) => p === "offline")) {
      return { phase: "offline", count: 0, truncated: false };
    }
    if (phases.some((p) => p === "error")) {
      return { phase: "error", count: 0, truncated: false };
    }
    const model = buildTimelineDisplayModel({
      profile: state.profile,
      appointments: summaryAppt.phase === "loaded" ? summaryAppt.appointments : [],
      treatments: [],
      ledgerEntries: [],
      chartEntries: [],
      medicalSummary: null,
      apptRange: defaultPatientApptRange(),
      truncated: {
        treatments: summaryTx.truncated,
        ledger: summaryLedger.truncated,
        chart: summaryChart.truncated,
      },
      doctorLabels,
      procedureMaps,
      roomMap,
    });
    const medBonus = summaryMed.phase === "loaded" && summaryMed.hasMedicalRecord ? 1 : 0;
    const relatedCount =
      model.eventCount +
      medBonus +
      (summaryTx.phase === "loaded" ? summaryTx.count : 0) +
      (summaryChart.phase === "loaded" ? summaryChart.count : 0) +
      (summaryLedger.phase === "loaded" ? summaryLedger.count : 0);
    const truncated = summaryTx.truncated || summaryChart.truncated || summaryLedger.truncated;
    if (relatedCount === 0) {
      return { phase: "empty", count: 0, truncated };
    }
    return { phase: "loaded", count: relatedCount, truncated };
  }, [
    state,
    summaryAppt,
    summaryMed,
    summaryTx,
    summaryChart,
    summaryLedger,
    doctorLabels,
    procedureMaps,
    roomMap,
  ]);

  const summaryAtGlance = useMemo(
    () =>
      patientWorkspaceAtGlance({
        appt: summaryAppt,
        medical: summaryMed,
        treatments: summaryTx,
        chart: summaryChart,
        ledger: summaryLedger,
      }),
    [summaryAppt, summaryMed, summaryTx, summaryChart, summaryLedger],
  );

  const timelineExactCount =
    timelineState.phase === "loaded" && timelineModel ? timelineModel.eventCount : null;

  const apptClientFiltersActive =
    apptStatusFilter !== null ||
    apptRoomFilter !== null ||
    apptProviderFilter !== null ||
    apptTimeDirection !== "all";

  const apptStatusMixLine = useMemo(() => {
    if (apptState.phase !== "loaded" || apptState.appointments.length === 0) return null;
    return formatAppointmentStatusMix(apptState.appointments);
  }, [apptState]);

  const currentPatientAppt = useMemo(() => {
    if (apptState.phase !== "loaded") return null;
    return findCurrentAppointmentInRange(apptState.appointments);
  }, [apptState]);

  const apptRangeCapBanner =
    rangePreset === "thisYear" && patientApptPresetWasRangeCapped("thisYear")
      ? PATIENT_APPT_RANGE_CAP_BANNER
      : null;

  const chartEntriesForDisplay = useMemo(() => {
    if (chartState.phase !== "loaded") return [];
    if (chartToothFilter === null) return chartState.entries;
    return chartState.entries.filter((entry) => entry.toothNumber === chartToothFilter);
  }, [chartState, chartToothFilter]);

  const handleTimelineRowClick = useCallback(
    (sourceTab: TimelineSourceTab, hint?: TimelineNavigateHint) => {
      if (hint?.chartToothFilter !== undefined && hint.chartToothFilter !== null) {
        setChartToothFilter(hint.chartToothFilter);
      } else if (sourceTab !== "chart") {
        setChartToothFilter(null);
      }
      setActiveTab(sourceTab);
    },
    [],
  );

  const refreshOpenRecord = useCallback(() => {
    setRetryNonce((n) => n + 1);
    if (activeTab === "summary") {
      setSummaryRefreshNonce((n) => n + 1);
    } else if (activeTab === "timeline") {
      setTimelineRefreshNonce((n) => n + 1);
    } else if (activeTab === "appointments") {
      setApptRefreshNonce((n) => n + 1);
    } else if (activeTab === "medical") {
      setMedRefreshNonce((n) => n + 1);
    } else if (activeTab === "treatments") {
      setTxRefreshNonce((n) => n + 1);
    } else if (activeTab === "chart") {
      setChartRefreshNonce((n) => n + 1);
    } else if (activeTab === "ledger") {
      setLedgerRefreshNonce((n) => n + 1);
    }
  }, [activeTab]);

  const applyRangePreset = (preset: PatientApptRangePreset) => {
    setRangePreset(preset);
    setApptRange(patientApptRangeForPreset(preset));
  };

  return (
    <div className="app-patient-profile">
      <div className="app-patient-profile__toolbar">
        <Button type="button" variant="secondary" className="ui-focusable" onClick={onBackToday}>
          Back to Today
        </Button>
        {patientId !== null ? (
          <>
            {state.phase === "loaded" ? (
              <Button type="button" variant="secondary" className="ui-focusable" onClick={refreshOpenRecord}>
                Refresh
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="ui-focusable"
              onClick={() => {
                setChangePatientSearchOpen((open) => !open);
              }}
              aria-expanded={changePatientSearchOpen}
            >
              {PATIENT_CHANGE_PATIENT_LABEL}
            </Button>
          </>
        ) : null}
        {patientId !== null && lastLoadedAt !== null ? (
          <p className="app-patient-profile__toolbar-refreshed" role="status" aria-live="polite">
            {PATIENT_PROFILE_LAST_REFRESHED}: {formatProfileLastRefreshed(lastLoadedAt)}
          </p>
        ) : null}
      </div>

      <p className="app-patient-profile__readonly-note" role="note">
        {PATIENT_PROFILE_READONLY_NOTE}
      </p>

      <AppErrorBoundary>
        {patientId === null ? (
          <div className="app-patient-profile__open">
            <p className="app-patient-profile__open-lede">{PATIENT_PAGE_SEARCH_LEDE}</p>
            <p className="app-patient-profile__open-example">{PATIENT_PAGE_SEARCH_EXAMPLE}</p>
            <p className="app-patient-profile__open-hint">{PATIENT_MODULE_TABS_HINT}</p>
            <section
              className="app-patient-profile__recent"
              aria-labelledby="app-patients-recent-heading"
              data-testid="patients-page-recent"
            >
              <h3 id="app-patients-recent-heading" className="app-patient-profile__recent-title">
                {PATIENT_RECENT_SESSION_TITLE}
              </h3>
              <p className="app-patient-profile__recent-hint">{PATIENT_RECENT_SESSION_HINT}</p>
              {recentPatients.length > 0 && onRecentPatientSelect ? (
                <ul className="app-patient-profile__recent-list" aria-label={PATIENT_RECENT_SESSION_TITLE}>
                  {recentPatients.map((entry) => (
                    <li key={entry.patientId}>
                      <button
                        type="button"
                        className="app-patient-profile__recent-btn ui-focusable"
                        onClick={() => onRecentPatientSelect(entry)}
                      >
                        <span className="app-patient-profile__recent-name">{entry.displayName}</span>
                        <span className="app-patient-profile__recent-meta">
                          {formatSessionRecentPatientMeta(entry)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="app-patient-profile__recent-empty" role="status">
                  {PATIENT_RECENT_SESSION_EMPTY}
                </p>
              )}
            </section>
            <PatientPageSearchBlock
              patientId={null}
              bridgePhase={bridgePhase}
              bridgeBaseUrl={bridgeBaseUrl}
              fetchImpl={fetchImpl}
              clearSelectionOnQueryChange
              title={PATIENT_PAGE_SEARCH_TITLE}
              recentPatients={recentPatients}
              onPatientRecordSelect={onPatientRecordSelect}
              onRecentPatientSelect={onRecentPatientSelect}
              onPatientSelectionClear={onClearPatient}
            />
          </div>
        ) : state.phase === "offline" ? (
          <EmptyState
            className="ui-empty--start app-patient-profile__empty"
            title={bridgePhase === "checking" ? PATIENT_PROFILE_WAITING_TITLE : CLINIC_SERVICE_OFFLINE_TITLE}
            description={bridgePhase === "checking" ? CLINIC_SERVICE_CHECKING : CLINIC_SERVICE_OFFLINE_PANEL}
          />
        ) : state.phase === "loading" ? (
          <p className="app-patient-profile__status app-readonly-state app-readonly-state--loading" role="status" aria-live="polite" aria-busy="true">
            {PATIENT_PROFILE_LOADING}
          </p>
        ) : state.phase === "not_found" ? (
          <EmptyState
            className="ui-empty--start app-patient-profile__empty"
            title="Patient not found"
            description="That record may have been removed from the copy, or the list was out of date. Search again."
          />
        ) : state.phase === "error" ? (
          <ProfileReadonlyError message={state.message} onRetry={() => setRetryNonce((n) => n + 1)} />
        ) : state.phase === "loaded" ? (
          <>
            <ProfileHeaderStrip
              profile={state.profile}
              activeLabel={activeLabel}
              doctorLabels={doctorLabels}
            />

            {changePatientSearchOpen ? (
              <PatientPageSearchBlock
                patientId={patientId}
                bridgePhase={bridgePhase}
                bridgeBaseUrl={bridgeBaseUrl}
                fetchImpl={fetchImpl}
                recentPatients={recentPatients}
                onRecentPatientSelect={onRecentPatientSelect}
                clearSelectionOnQueryChange={false}
                title={PATIENT_CHANGE_PATIENT_LABEL}
                onPatientRecordSelect={(hit) => {
                  onPatientRecordSelect?.(hit);
                  setChangePatientSearchOpen(false);
                }}
              />
            ) : null}

            <nav className="app-patient-profile__tabs" aria-label="Patient sections">
              <ul className="app-patient-profile__tablist" role="tablist">
                {PROFILE_TAB_ORDER.map((tab) => (
                  <li key={tab.id} role="presentation">
                    <button
                      type="button"
                      role="tab"
                      id={`patient-tab-${tab.id}`}
                      aria-selected={activeTab === tab.id}
                      aria-controls={`patient-panel-${tab.id}`}
                      className={`app-patient-profile__tab ui-focusable${activeTab === tab.id ? " app-patient-profile__tab--active" : ""}`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  </li>
                ))}
              </ul>
              {activeTab ? (
                <p id={`patient-tab-desc-${activeTab}`} className="app-patient-profile__tab-desc">
                  {PROFILE_TAB_DESCRIPTIONS[activeTab]}
                </p>
              ) : null}
            </nav>

            {activeTab === "summary" ? (
              <section
                id="patient-panel-summary"
                role="tabpanel"
                aria-labelledby="patient-tab-summary"
                className="app-patient-profile__summary"
              >
                <p className="app-patient-profile__summary-lede">{PATIENT_TAB_SUMMARY_LEDE}</p>
                <ProfileSummaryCard profile={state.profile} activeLabel={activeLabel} doctorLabels={doctorLabels} />
                <PatientSummaryMiniCards
                  appt={summaryAppt}
                  medical={summaryMed}
                  treatments={summaryTx}
                  chart={summaryChart}
                  ledger={summaryLedger}
                  timeline={summaryTimeline}
                  timelineExactCount={timelineExactCount}
                  doctorLabels={doctorLabels}
                  procedureMaps={procedureMaps}
                  roomMap={roomMap}
                  onOpenTab={setActiveTab}
                />
                <div
                  className="app-patient-profile__summary-at-glance"
                  role="region"
                  aria-label={PATIENT_SUMMARY_AT_GLANCE_TITLE}
                  data-testid="patient-summary-at-glance"
                >
                  <p className="app-patient-profile__summary-at-glance-title">{PATIENT_SUMMARY_AT_GLANCE_TITLE}</p>
                  <ul className="app-patient-profile__summary-at-glance-list">
                    {summaryAtGlance.upcomingStatus ? (
                      <li>{summaryAtGlance.upcomingStatus}</li>
                    ) : null}
                    {summaryAtGlance.recentStatus ? (
                      <li>{summaryAtGlance.recentStatus}</li>
                    ) : null}
                    {summaryAtGlance.treatmentCount ? (
                      <li>{summaryAtGlance.treatmentCount}</li>
                    ) : null}
                    {summaryAtGlance.chartCount ? (
                      <li>{summaryAtGlance.chartCount}</li>
                    ) : null}
                    {summaryAtGlance.ledgerCount ? (
                      <li>{summaryAtGlance.ledgerCount}</li>
                    ) : null}
                    {summaryAtGlance.medicalScreening ? (
                      <li>{summaryAtGlance.medicalScreening}</li>
                    ) : null}
                  </ul>
                </div>
                {base && patientId && sandboxWritePilot ? (
                  <section
                    className="app-patient-profile__sandbox-demographics"
                    aria-labelledby="patient-sandbox-demographics-heading"
                    data-testid="patient-sandbox-demographics-section"
                  >
                    <h3
                      id="patient-sandbox-demographics-heading"
                      className="app-patient-profile__sandbox-demographics-heading"
                    >
                      {PATIENT_SANDBOX_DEMOGRAPHICS_TITLE}
                    </h3>
                    <PatientDemographicsWritePanel
                      patientId={patientId}
                      profile={state.profile}
                      bridgeBaseUrl={base}
                      fetchImpl={fetchImpl}
                      writePilotEnabled={sandboxWritePilot}
                      writeCapability={writeCapability}
                      onCommitted={() => setRetryNonce((n) => n + 1)}
                    />
                  </section>
                ) : null}
              </section>
            ) : null}

            {activeTab === "timeline" ? (
              <section
                id="patient-panel-timeline"
                role="tabpanel"
                aria-labelledby="patient-tab-timeline"
                className="app-patient-profile__timeline"
                data-testid="patient-panel-timeline"
              >
                <p className="app-patient-profile__timeline-lede">{PATIENT_TAB_TIMELINE_LEDE}</p>
                <ProfileTabHiddenNote variant="default" />

                <div className="app-patient-profile__timeline-controls">
                  <Button
                    type="button"
                    variant="secondary"
                    className="ui-focusable"
                    onClick={() => setTimelineRefreshNonce((n) => n + 1)}
                  >
                    Refresh
                  </Button>
                </div>

                {timelineState.phase === "offline" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title={CLINIC_SERVICE_OFFLINE_TITLE}
                    description={PATIENT_TAB_OFFLINE_TIMELINE}
                  />
                ) : timelineState.phase === "loading" ? (
                  <p
                    className="app-patient-profile__status app-readonly-state app-readonly-state--loading"
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                  >
                    {PATIENT_TAB_LOADING_TIMELINE}
                  </p>
                ) : timelineState.phase === "error" ? (
                  <ProfileReadonlyError
                    message={timelineState.message}
                    onRetry={() => setTimelineRefreshNonce((n) => n + 1)}
                  />
                ) : timelineState.phase === "loaded" && timelineModel ? (
                  <PatientTimeline
                    model={timelineModel}
                    kindFilter={timelineKindFilter}
                    onKindFilterChange={setTimelineKindFilter}
                    onRowClick={handleTimelineRowClick}
                  />
                ) : null}
              </section>
            ) : null}

            {activeTab === "appointments" ? (
              <section
                id="patient-panel-appointments"
                role="tabpanel"
                aria-labelledby="patient-tab-appointments"
                className="app-patient-profile__appts"
              >
                <p className="app-patient-profile__appts-lede">{PATIENT_TAB_APPOINTMENTS_LEDE}</p>

                <div className="app-patient-profile__appts-controls">
                  <div className="app-patient-profile__appts-presets" role="group" aria-label="Date range">
                    <Button
                      type="button"
                      variant={rangePreset === "default" ? "primary" : "secondary"}
                      className="ui-focusable"
                      onClick={() => applyRangePreset("default")}
                    >
                      {PATIENT_APPT_PRESET_DEFAULT}
                    </Button>
                    <Button
                      type="button"
                      variant={rangePreset === "past90" ? "primary" : "secondary"}
                      className="ui-focusable"
                      onClick={() => applyRangePreset("past90")}
                    >
                      Past 90 days
                    </Button>
                    <Button
                      type="button"
                      variant={rangePreset === "upcoming90" ? "primary" : "secondary"}
                      className="ui-focusable"
                      onClick={() => applyRangePreset("upcoming90")}
                    >
                      Upcoming 90 days
                    </Button>
                    <Button
                      type="button"
                      variant={rangePreset === "thisYear" ? "primary" : "secondary"}
                      className="ui-focusable"
                      onClick={() => applyRangePreset("thisYear")}
                    >
                      This year
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="ui-focusable"
                      onClick={() => {
                        setApptRefreshNonce((n) => n + 1);
                      }}
                    >
                      Refresh
                    </Button>
                  </div>

                  {apptRangeCapBanner ? (
                    <p className="app-patient-profile__appts-cap-banner" role="note">
                      {apptRangeCapBanner}
                    </p>
                  ) : null}

                  {apptStatusMixLine ? (
                    <p className="app-patient-profile__appts-status-mix" role="status" aria-label={PATIENT_APPT_STATUS_MIX_ARIA}>
                      {apptStatusMixLine}
                    </p>
                  ) : null}

                  <div className="app-patient-profile__appts-filters">
                    <div className="app-patient-profile__appts-filter-group" role="group" aria-label="Past or upcoming">
                      <Button
                        type="button"
                        size="compact"
                        variant={apptTimeDirection === "all" ? "primary" : "secondary"}
                        className="ui-focusable app-patient-profile__appts-filter-chip"
                        onClick={() => setApptTimeDirection("all")}
                      >
                        {PATIENT_APPT_TIME_ALL}
                      </Button>
                      <Button
                        type="button"
                        size="compact"
                        variant={apptTimeDirection === "past" ? "primary" : "secondary"}
                        className="ui-focusable app-patient-profile__appts-filter-chip"
                        onClick={() => setApptTimeDirection("past")}
                      >
                        {PATIENT_APPT_TIME_PAST}
                      </Button>
                      <Button
                        type="button"
                        size="compact"
                        variant={apptTimeDirection === "upcoming" ? "primary" : "secondary"}
                        className="ui-focusable app-patient-profile__appts-filter-chip"
                        onClick={() => setApptTimeDirection("upcoming")}
                      >
                        {PATIENT_APPT_TIME_UPCOMING}
                      </Button>
                    </div>

                    <div
                      className="app-patient-profile__appts-filter-group"
                      role="group"
                      aria-label={PATIENT_APPT_FILTER_STATUS_ARIA}
                    >
                      <Button
                        type="button"
                        size="compact"
                        variant={apptStatusFilter === null ? "primary" : "secondary"}
                        className="ui-focusable app-patient-profile__appts-filter-chip"
                        onClick={() => setApptStatusFilter(null)}
                      >
                        {PATIENT_APPT_FILTER_ALL_STATUSES}
                      </Button>
                      {PATIENT_APPT_FILTER_STATUS_CODES.map((code) => (
                        <Button
                          key={code}
                          type="button"
                          size="compact"
                          variant={apptStatusFilter === code ? "primary" : "secondary"}
                          className="ui-focusable app-patient-profile__appts-filter-chip"
                          onClick={() => setApptStatusFilter(code)}
                        >
                          {patientApptStatusLabel(code)}
                        </Button>
                      ))}
                    </div>

                    {apptRoomsInRange.length > 0 ? (
                      <div
                        className="app-patient-profile__appts-filter-group"
                        role="group"
                        aria-label={PATIENT_APPT_FILTER_ROOM_ARIA}
                      >
                        <Button
                          type="button"
                          size="compact"
                          variant={apptRoomFilter === null ? "primary" : "secondary"}
                          className="ui-focusable app-patient-profile__appts-filter-chip"
                          onClick={() => setApptRoomFilter(null)}
                        >
                          {PATIENT_APPT_FILTER_ALL_ROOMS}
                        </Button>
                        {apptRoomsInRange.map((room) => (
                          <Button
                            key={room}
                            type="button"
                            size="compact"
                            variant={apptRoomFilter === room ? "primary" : "secondary"}
                            className="ui-focusable app-patient-profile__appts-filter-chip"
                            onClick={() => setApptRoomFilter(room)}
                          >
                            {roomDisplayLabel(room, roomMap)}
                          </Button>
                        ))}
                      </div>
                    ) : null}

                    {apptProviderOptions.length > 1 ? (
                      <div
                        className="app-patient-profile__appts-filter-group"
                        role="group"
                        aria-label={PATIENT_APPT_FILTER_PROVIDER_ARIA}
                      >
                        <Button
                          type="button"
                          size="compact"
                          variant={apptProviderFilter === null ? "primary" : "secondary"}
                          className="ui-focusable app-patient-profile__appts-filter-chip"
                          onClick={() => setApptProviderFilter(null)}
                        >
                          {PATIENT_APPT_FILTER_ALL_PROVIDERS}
                        </Button>
                        {apptProviderOptions.map(({ docId, label }) => (
                          <Button
                            key={docId}
                            type="button"
                            size="compact"
                            variant={apptProviderFilter === docId ? "primary" : "secondary"}
                            className="ui-focusable app-patient-profile__appts-filter-chip"
                            onClick={() => setApptProviderFilter(docId)}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    ) : null}

                    {apptClientFiltersActive ? (
                      <Button
                        type="button"
                        size="compact"
                        variant="ghost"
                        className="ui-focusable app-patient-profile__appts-clear-filters"
                        onClick={() => {
                          setApptStatusFilter(null);
                          setApptRoomFilter(null);
                          setApptProviderFilter(null);
                          setApptTimeDirection("all");
                        }}
                      >
                        {FILTER_CLEAR_LABEL}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <p className="app-patient-profile__appts-range" aria-live="polite">
                  {rangeHeading}
                  {apptState.phase === "loaded" ? (
                    <span className="app-patient-profile__appts-range-count">
                      {" · "}
                      {patientApptRangeCountLabel(filteredAppts.length)}
                    </span>
                  ) : null}
                </p>

                {apptState.phase === "offline" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title={CLINIC_SERVICE_OFFLINE_TITLE}
                    description={CLINIC_SERVICE_OFFLINE_SECTION}
                  />
                ) : apptState.phase === "loading" ? (
                  <p className="app-patient-profile__status app-readonly-state app-readonly-state--loading" role="status" aria-live="polite" aria-busy="true">
                    {PATIENT_TAB_LOADING_APPOINTMENTS}
                  </p>
                ) : apptState.phase === "error" ? (
                  <ProfileReadonlyError
                    message={apptState.message}
                    onRetry={() => setApptRefreshNonce((n) => n + 1)}
                  />
                ) : apptState.phase === "empty" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title="No appointments found"
                    description="Nothing is scheduled in this date range. Try another preset or refresh after the bridge loads data."
                  />
                ) : apptState.phase === "loaded" ? (
                  filteredAppts.length === 0 ? (
                    <EmptyState
                      className="ui-empty--start app-patient-profile__empty"
                      title="No appointments match"
                      description="Try clearing filters or choosing a wider date preset."
                    />
                  ) : (
                  <div className="app-patient-profile__appt-days">
                    {[...groupedAppts.entries()].map(([dateIso, list]) => (
                      <Card key={dateIso} className="app-patient-profile__appt-day">
                        <CardHeader>
                          <p className="ui-card__title app-card-title-lg app-patient-profile__appt-day-title">
                            <time dateTime={dateIso}>{formatApptDayHeading(dateIso)}</time>
                          </p>
                        </CardHeader>
                        <CardBody>
                          <ul className="app-patient-profile__appt-list" aria-label={`Appointments on ${dateIso}`}>
                            {list.map((appt) => (
                              <li
                                key={appt.id}
                                className={`app-patient-profile__appt-row${currentPatientAppt?.id === appt.id ? " app-patient-profile__appt-row--current" : ""}`}
                              >
                                <div className="app-patient-profile__appt-time">{appt.time}</div>
                                <div className="app-patient-profile__appt-main">
                                  <div className="app-patient-profile__appt-line1">
                                    <span className="app-patient-profile__appt-duration">
                                      {patientApptFormatDuration(appt)}
                                    </span>
                                    <span className="app-patient-profile__appt-meta">
                                      {patientApptRowMeta(appt, doctorLabels, procedureMaps, roomMap)}
                                    </span>
                                  </div>
                                  <div className="app-patient-profile__appt-badges">
                                    <Badge
                                      variant={patientApptStatusBadgeVariant(appt.status)}
                                      semanticLabel={patientApptStatusSemanticLabel(appt.status)}
                                    >
                                      {patientApptStatusLabel(appt.status)}
                                    </Badge>
                                    {appt.missed ? (
                                      <Badge variant="danger" semanticLabel="Missed appointment">
                                        Missed
                                      </Badge>
                                    ) : null}
                                    {appt.hasComment ? (
                                      <Badge variant="neutral" semanticLabel="Internal note hidden">
                                        Note hidden
                                      </Badge>
                                    ) : null}
                                  </div>
                                  {onOpenScheduleAtDate ? (
                                    <div className="app-patient-profile__appt-actions">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="compact"
                                        className="ui-focusable"
                                        onClick={() => onOpenScheduleAtDate(appt.date)}
                                      >
                                        {PATIENT_APPT_OPEN_IN_SCHEDULE}
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                  )
                ) : null}
              </section>
            ) : null}

            {activeTab === "medical" ? (
              <section
                id="patient-panel-medical"
                role="tabpanel"
                aria-labelledby="patient-tab-medical"
                className="app-patient-profile__medical"
              >
                <p className="app-patient-profile__medical-lede">{PATIENT_TAB_MEDICAL_LEDE}</p>
                <ProfileTabHiddenNote variant="medical" />

                <div className="app-patient-profile__medical-controls">
                  <Button
                    type="button"
                    variant="secondary"
                    className="ui-focusable"
                    onClick={() => setMedRefreshNonce((n) => n + 1)}
                  >
                    Refresh
                  </Button>
                </div>

                {medState.phase === "offline" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title={CLINIC_SERVICE_OFFLINE_TITLE}
                    description={PATIENT_TAB_OFFLINE_MEDICAL}
                  />
                ) : medState.phase === "loading" ? (
                  <p className="app-patient-profile__status app-readonly-state app-readonly-state--loading" role="status" aria-live="polite" aria-busy="true">
                    {PATIENT_TAB_LOADING_MEDICAL}
                  </p>
                ) : medState.phase === "error" ? (
                  <ProfileReadonlyError
                    message={medState.message}
                    onRetry={() => setMedRefreshNonce((n) => n + 1)}
                  />
                ) : medState.phase === "no_record" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title="No medical record found for this patient."
                    description={PATIENT_TAB_EMPTY_MEDICAL}
                  />
                ) : medState.phase === "loaded" ? (
                  <MedicalSummaryBody summary={medState.summary} />
                ) : null}
              </section>
            ) : null}

            {activeTab === "treatments" ? (
              <section
                id="patient-panel-treatments"
                role="tabpanel"
                aria-labelledby="patient-tab-treatments"
                className="app-patient-profile__treatments"
              >
                <p className="app-patient-profile__treatments-lede">{PATIENT_TAB_TREATMENTS_LEDE}</p>
                <ProfileTabHiddenNote variant="treatments" />

                <div className="app-patient-profile__treatments-controls">
                  <Button
                    type="button"
                    variant="secondary"
                    className="ui-focusable"
                    onClick={() => setTxRefreshNonce((n) => n + 1)}
                  >
                    Refresh
                  </Button>
                </div>

                {txState.phase === "offline" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title={CLINIC_SERVICE_OFFLINE_TITLE}
                    description={PATIENT_TAB_OFFLINE_TREATMENTS}
                  />
                ) : txState.phase === "loading" ? (
                  <p className="app-patient-profile__status app-readonly-state app-readonly-state--loading" role="status" aria-live="polite" aria-busy="true">
                    {PATIENT_TAB_LOADING_TREATMENTS}
                  </p>
                ) : txState.phase === "error" ? (
                  <ProfileReadonlyError
                    message={txState.message}
                    onRetry={() => setTxRefreshNonce((n) => n + 1)}
                  />
                ) : txState.phase === "empty" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title="No treatments found"
                    description={PATIENT_TAB_EMPTY_TREATMENTS}
                  />
                ) : txState.phase === "loaded" ? (
                  <TreatmentsBody
                    treatments={txState.treatments}
                    truncated={txState.truncated}
                    privacyNote={txState.privacyNote}
                    doctorLabels={doctorLabels}
                    procedureMaps={procedureMaps}
                  />
                ) : null}
              </section>
            ) : null}

            {activeTab === "chart" ? (
              <section
                id="patient-panel-chart"
                role="tabpanel"
                aria-labelledby="patient-tab-chart"
                className="app-patient-profile__chart"
              >
                <p className="app-patient-profile__chart-lede">{PATIENT_TAB_CHART_LEDE}</p>
                <ProfileTabHiddenNote variant="chart" />

                <div className="app-patient-profile__chart-controls">
                  <Button
                    type="button"
                    variant="secondary"
                    className="ui-focusable"
                    onClick={() => setChartRefreshNonce((n) => n + 1)}
                  >
                    Refresh
                  </Button>
                </div>

                {chartToothFilter !== null ? (
                  <div
                    className="app-patient-profile__chart-tooth-filter"
                    role="status"
                    data-testid="patient-chart-tooth-filter"
                  >
                    <p>
                      {PATIENT_CHART_TOOTH_FILTER_LABEL} {timelineChartToothFilterLabel(chartToothFilter)}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="compact"
                      className="ui-focusable"
                      onClick={() => setChartToothFilter(null)}
                    >
                      {PATIENT_CHART_TOOTH_FILTER_CLEAR}
                    </Button>
                  </div>
                ) : null}

                {chartState.phase === "offline" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title={CLINIC_SERVICE_OFFLINE_TITLE}
                    description={PATIENT_TAB_OFFLINE_CHART}
                  />
                ) : chartState.phase === "loading" ? (
                  <p className="app-patient-profile__status app-readonly-state app-readonly-state--loading" role="status" aria-live="polite" aria-busy="true">
                    {PATIENT_TAB_LOADING_CHART}
                  </p>
                ) : chartState.phase === "error" ? (
                  <ProfileReadonlyError
                    message={chartState.message}
                    onRetry={() => setChartRefreshNonce((n) => n + 1)}
                  />
                ) : chartState.phase === "empty" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title="No chart entries found"
                    description={PATIENT_TAB_EMPTY_CHART}
                  />
                ) : chartState.phase === "loaded" ? (
                  chartEntriesForDisplay.length === 0 && chartToothFilter !== null ? (
                    <p className="app-patient-profile__clinical-empty-filtered" role="status">
                      No chart entries match tooth {chartToothFilter}.
                    </p>
                  ) : (
                    <ChartBody
                      entries={chartEntriesForDisplay}
                      truncated={chartState.truncated}
                      privacyNote={chartState.privacyNote}
                    />
                  )
                ) : null}
              </section>
            ) : null}

            {activeTab === "ledger" ? (
              <section
                id="patient-panel-ledger"
                role="tabpanel"
                aria-labelledby="patient-tab-ledger"
                className="app-patient-profile__ledger"
              >
                <p className="app-patient-profile__ledger-lede">{PATIENT_TAB_LEDGER_LEDE}</p>
                <ProfileTabHiddenNote variant="ledger" />
                <p className="app-patient-profile__ledger-amounts-note" role="note">
                  {PATIENT_TAB_LEDGER_AMOUNTS_HIDDEN}
                </p>

                <div className="app-patient-profile__ledger-controls">
                  <Button
                    type="button"
                    variant="secondary"
                    className="ui-focusable"
                    onClick={() => setLedgerRefreshNonce((n) => n + 1)}
                  >
                    Refresh
                  </Button>
                </div>

                {ledgerState.phase === "offline" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title={CLINIC_SERVICE_OFFLINE_TITLE}
                    description={PATIENT_TAB_OFFLINE_LEDGER}
                  />
                ) : ledgerState.phase === "loading" ? (
                  <p className="app-patient-profile__status app-readonly-state app-readonly-state--loading" role="status" aria-live="polite" aria-busy="true">
                    {PATIENT_TAB_LOADING_LEDGER}
                  </p>
                ) : ledgerState.phase === "error" ? (
                  <ProfileReadonlyError
                    message={ledgerState.message}
                    onRetry={() => setLedgerRefreshNonce((n) => n + 1)}
                  />
                ) : ledgerState.phase === "empty" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title="No ledger entries found"
                    description={PATIENT_TAB_EMPTY_LEDGER}
                  />
                ) : ledgerState.phase === "loaded" ? (
                  <LedgerBody
                    entries={ledgerState.entries}
                    truncated={ledgerState.truncated}
                    privacyNote={ledgerState.privacyNote}
                  />
                ) : null}
              </section>
            ) : null}
          </>
        ) : (
          <EmptyState className="ui-empty--start" title="Nothing to show" description="Unexpected state." />
        )}
      </AppErrorBoundary>
    </div>
  );
}
