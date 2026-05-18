import { BridgeClientError, createBridgeClient, isInvalidBodySchemaMismatch } from "@microdent/bridge-client";
import type {
  LedgerEntryV1,
  PatientChartEntry,
  PatientMedicalSummaryResponse,
  PatientProfileResponse,
  PatientTreatmentItem,
  ScheduleAppointmentItem,
} from "@microdent/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState } from "@microdent/ui";
import type { BridgeDevStatusResponse } from "@microdent/contracts";
import type { BridgeHealthPhase } from "./bridge-health.js";
import { PatientDemographicsWritePanel } from "./PatientDemographicsWritePanel.js";
import { AppErrorBoundary } from "./AppErrorBoundary.js";
import {
  patientApptFormatDuration,
  patientApptRowMeta,
  patientApptStatusBadgeVariant,
  patientApptStatusLabel,
} from "./patient-appointments-display.js";
import {
  defaultPatientApptRange,
  patientApptRangeForPreset,
  type PatientApptRangePreset,
} from "./patient-appointments-range.js";
import { doctorDisplayLabel } from "./doctor-labels.js";
import { useDoctorLabels } from "./useDoctorLabels.js";
import { useProcedureReference } from "./useProcedureReference.js";
import { medicalConditionItemsForDisplay } from "./patient-medical-summary-display.js";
import {
  chartToothLabel,
  chartTreatedLabel,
  chartTypeLabel,
  sortChartEntriesForDisplay,
} from "./patient-chart-display.js";
import {
  formatLedgerDate,
  ledgerAdjustmentTypeLabel,
  ledgerCardPaymentLabel,
  ledgerChargeTypeLabel,
  ledgerPaymentTypeLabel,
  sortLedgerEntriesForDisplay,
} from "./patient-ledger-display.js";
import { PatientSearchBar, type PatientSearchHit } from "./PatientSearchBar.js";
import {
  CLINIC_SERVICE_OFFLINE_PANEL,
  CLINIC_SERVICE_OFFLINE_SECTION,
  CLINIC_SERVICE_OFFLINE_TITLE,
  PATIENT_CHANGE_PATIENT_LABEL,
  PATIENT_PAGE_SEARCH_LEDE,
  PATIENT_MODULE_TABS_HINT,
  PATIENT_PAGE_SEARCH_TITLE,
  PATIENT_PROFILE_READONLY_NOTE,
  PATIENT_TAB_APPOINTMENTS_LEDE,
  PATIENT_TAB_CHART_LEDE,
  PATIENT_TAB_LEDGER_LEDE,
  PATIENT_TAB_MEDICAL_LEDE,
  PATIENT_TAB_SUMMARY_LEDE,
  PATIENT_TAB_TREATMENTS_LEDE,
  SENSITIVE_MEDICAL_BANNER,
  TRUNCATED_LIST_BANNER,
} from "./read-only-ui-copy.js";
import {
  formatTreatmentDate,
  sortTreatmentsForDisplay,
  treatmentProcedureLine,
  treatmentProviderLabel,
  treatmentStatusLabel,
  treatmentToothLabel,
} from "./patient-treatments-display.js";

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
};

type LoadState =
  | { phase: "idle" }
  | { phase: "offline" }
  | { phase: "loading" }
  | { phase: "loaded"; profile: PatientProfileResponse }
  | { phase: "not_found" }
  | { phase: "error"; message: string };

type ProfileTab = "summary" | "appointments" | "medical" | "treatments" | "chart" | "ledger";

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

export const PROFILE_TAB_ORDER: readonly { id: ProfileTab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "appointments", label: "Appointments" },
  { id: "medical", label: "Medical" },
  { id: "treatments", label: "Treatments" },
  { id: "chart", label: "Chart" },
  { id: "ledger", label: "Ledger preview" },
];

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
}: {
  treatments: PatientTreatmentItem[];
  truncated: boolean;
  privacyNote: string;
  doctorLabels: ReadonlyMap<string, string>;
}) {
  const sorted = sortTreatmentsForDisplay(treatments);

  return (
    <div className="app-patient-profile__treatments-body">
      {truncated ? (
        <p className="app-patient-profile__treatments-banner" role="note">
          {TRUNCATED_LIST_BANNER}
        </p>
      ) : null}
      <ul className="app-patient-profile__treatment-list" aria-label="Procedure history">
        {sorted.map((t) => {
          const dateLabel = formatTreatmentDate(t.date);
          const procedure = treatmentProcedureLine(t);
          const tooth = treatmentToothLabel(t.tooth);
          const provider = treatmentProviderLabel(t, doctorLabels);
          const status = treatmentStatusLabel(t.status);

          return (
            <li key={t.treatmentId} className="app-patient-profile__treatment-row">
              <div className="app-patient-profile__treatment-date">{dateLabel ?? "—"}</div>
              <div className="app-patient-profile__treatment-main">
                {procedure ? <p className="app-patient-profile__treatment-procedure">{procedure}</p> : null}
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
  const sorted = sortChartEntriesForDisplay(entries);

  return (
    <div className="app-patient-profile__chart-body">
      {truncated ? (
        <p className="app-patient-profile__chart-banner" role="note">
          Showing a capped set of chart rows only. Additional lines are omitted in this read-only preview.
        </p>
      ) : null}
      <ul className="app-patient-profile__chart-list" aria-label="Dental chart entries">
        {sorted.map((row) => (
          <li key={row.chartEntryId} className="app-patient-profile__chart-row">
            <div className="app-patient-profile__chart-tooth">{chartToothLabel(row.toothNumber)}</div>
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
            <dd>
              {profile.doctorId !== null
                ? (doctorDisplayLabel(profile.doctorId, doctorLabels) ?? "—")
                : "—"}
            </dd>
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
  const sorted = sortLedgerEntriesForDisplay(entries);

  return (
    <div className="app-patient-profile__ledger-body">
      {truncated ? (
        <p className="app-patient-profile__ledger-banner" role="note">
          {TRUNCATED_LIST_BANNER}
        </p>
      ) : null}
      <ul className="app-patient-profile__ledger-list" aria-label="Ledger entries">
        {sorted.map((row) => {
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
      <p className="app-patient-profile__ledger-privacy">{privacyNote}</p>
    </div>
  );
}

function MedicalSummaryBody({ summary }: { summary: PatientMedicalSummaryResponse }) {
  const sensitive = summary.hasSensitiveMedicalDetails;
  const conditionItems = sensitive ? [] : medicalConditionItemsForDisplay(summary.conditions);

  return (
    <div className="app-patient-profile__medical-body">
      {sensitive ? (
        <p className="app-patient-profile__medical-banner" role="note">
          {SENSITIVE_MEDICAL_BANNER}
        </p>
      ) : null}

      <dl className="app-patient-profile__dl">
        <div className="app-patient-profile__row">
          <dt>Questionnaire date</dt>
          <dd>{summary.lastUpdated ?? "—"}</dd>
        </div>
        <div className="app-patient-profile__row">
          <dt>Last dental visit (questionnaire)</dt>
          <dd>{summary.lastDentalVisit ?? "—"}</dd>
        </div>
        <div className="app-patient-profile__row">
          <dt>Flagged screening items</dt>
          <dd>{summary.flaggedConditionCount}</dd>
        </div>
      </dl>

      {!sensitive && conditionItems.length > 0 ? (
        <ul className="app-patient-profile__medical-flags" aria-label="Screening flags marked yes">
          {conditionItems.map((item) => (
            <li key={item.key}>{item.label}</li>
          ))}
        </ul>
      ) : null}

      {!sensitive && conditionItems.length === 0 && summary.flaggedConditionCount === 0 ? (
        <p className="app-patient-profile__medical-muted">No screening flags marked yes.</p>
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
  clearSelectionOnQueryChange,
  title,
}: {
  patientId: string | null;
  bridgePhase: BridgeHealthPhase;
  bridgeBaseUrl?: string;
  fetchImpl?: typeof fetch;
  onPatientRecordSelect?: (hit: PatientSearchHit) => void;
  onPatientSelectionClear?: () => void;
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
        fetchImpl={fetchImpl}
        clearSelectionOnQueryChange={clearSelectionOnQueryChange}
        onPatientRecordSelect={onPatientRecordSelect}
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

  const [changePatientSearchOpen, setChangePatientSearchOpen] = useState(false);

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
  }, [patientId, base, bridgePhase, fetchImpl, retryNonce]);

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
      } catch (e: unknown) {
        if (cancelled || seq !== apptRequestSeq.current) return;
        setApptState({ phase: "error", message: safePatientAppointmentsError(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, base, bridgePhase, fetchImpl, activeTab, apptRange, apptRefreshNonce]);

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
      } catch (e: unknown) {
        if (cancelled || seq !== medRequestSeq.current) return;
        setMedState({ phase: "error", message: safePatientMedicalSummaryError(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, base, bridgePhase, fetchImpl, activeTab, medRefreshNonce]);

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
      } catch (e: unknown) {
        if (cancelled || seq !== txRequestSeq.current) return;
        setTxState({ phase: "error", message: safePatientTreatmentsError(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, base, bridgePhase, fetchImpl, activeTab, txRefreshNonce]);

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
      } catch (e: unknown) {
        if (cancelled || seq !== chartRequestSeq.current) return;
        setChartState({ phase: "error", message: safePatientChartError(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, base, bridgePhase, fetchImpl, activeTab, chartRefreshNonce]);

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
      } catch (e: unknown) {
        if (cancelled || seq !== ledgerRequestSeq.current) return;
        setLedgerState({ phase: "error", message: safePatientLedgerError(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, base, bridgePhase, fetchImpl, activeTab, ledgerRefreshNonce]);

  useEffect(() => {
    if (patientId === null) {
      setActiveTab(null);
      setRangePreset("default");
      setApptRange(defaultPatientApptRange());
      setApptState({ phase: "idle" });
      setMedState({ phase: "idle" });
      setTxState({ phase: "idle" });
      setChartState({ phase: "idle" });
      setLedgerState({ phase: "idle" });
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

  const groupedAppts = useMemo(() => {
    if (apptState.phase !== "loaded") return new Map<string, ScheduleAppointmentItem[]>();
    return groupAppointmentsByDate(apptState.appointments);
  }, [apptState]);

  const rangeHeading = formatApptRangeHeading(apptRange.from, apptRange.to);

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
        ) : null}
      </div>

      <p className="app-patient-profile__readonly-note" role="note">
        {PATIENT_PROFILE_READONLY_NOTE}
      </p>

      <AppErrorBoundary>
        {patientId === null ? (
          <div className="app-patient-profile__open">
            <p className="app-patient-profile__open-lede">{PATIENT_PAGE_SEARCH_LEDE}</p>
            <p className="app-patient-profile__open-hint">{PATIENT_MODULE_TABS_HINT}</p>
            <PatientPageSearchBlock
              patientId={null}
              bridgePhase={bridgePhase}
              bridgeBaseUrl={bridgeBaseUrl}
              fetchImpl={fetchImpl}
              clearSelectionOnQueryChange
              title={PATIENT_PAGE_SEARCH_TITLE}
              onPatientRecordSelect={onPatientRecordSelect}
              onPatientSelectionClear={onClearPatient}
            />
          </div>
        ) : state.phase === "offline" ? (
          <EmptyState
            className="ui-empty--start app-patient-profile__empty"
            title={CLINIC_SERVICE_OFFLINE_TITLE}
            description={CLINIC_SERVICE_OFFLINE_PANEL}
          />
        ) : state.phase === "loading" ? (
          <p className="app-patient-profile__status" role="status" aria-live="polite">
            Loading profile…
          </p>
        ) : state.phase === "not_found" ? (
          <EmptyState
            className="ui-empty--start app-patient-profile__empty"
            title="Patient not found"
            description="That record may have been removed from the copy, or the list was out of date. Search again."
          />
        ) : state.phase === "error" ? (
          <div className="app-patient-profile__error" role="alert">
            <p>{state.message}</p>
            <Button type="button" variant="secondary" className="ui-focusable" onClick={() => setRetryNonce((n) => n + 1)}>
              Retry
            </Button>
          </div>
        ) : state.phase === "loaded" ? (
          <>
            <p className="app-patient-profile__identity" role="status">
              <span className="app-patient-profile__identity-name">{state.profile.displayName}</span>
              {state.profile.chartNumber ? (
                <span className="app-patient-profile__identity-chart"> · Chart {state.profile.chartNumber}</span>
              ) : null}
            </p>

            {changePatientSearchOpen ? (
              <PatientPageSearchBlock
                patientId={patientId}
                bridgePhase={bridgePhase}
                bridgeBaseUrl={bridgeBaseUrl}
                fetchImpl={fetchImpl}
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
                {base && patientId ? (
                  <PatientDemographicsWritePanel
                    patientId={patientId}
                    profile={state.profile}
                    bridgeBaseUrl={base}
                    fetchImpl={fetchImpl}
                    writePilotEnabled={sandboxWritePilot}
                    writeCapability={writeCapability}
                    onCommitted={() => setRetryNonce((n) => n + 1)}
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
                </div>

                <p className="app-patient-profile__appts-range" aria-live="polite">
                  {rangeHeading}
                </p>

                {apptState.phase === "offline" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title={CLINIC_SERVICE_OFFLINE_TITLE}
                    description={CLINIC_SERVICE_OFFLINE_SECTION}
                  />
                ) : apptState.phase === "loading" ? (
                  <p className="app-patient-profile__status" role="status" aria-live="polite">
                    Loading appointments…
                  </p>
                ) : apptState.phase === "error" ? (
                  <div className="app-patient-profile__error" role="alert">
                    <p>{apptState.message}</p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="ui-focusable"
                      onClick={() => setApptRefreshNonce((n) => n + 1)}
                    >
                      Retry
                    </Button>
                  </div>
                ) : apptState.phase === "empty" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title="No appointments found"
                    description="Nothing is scheduled in this date range. Try another preset or refresh after the bridge loads data."
                  />
                ) : apptState.phase === "loaded" ? (
                  <div className="app-patient-profile__appt-days">
                    {[...groupedAppts.entries()].map(([dateIso, list]) => (
                      <Card key={dateIso} className="app-patient-profile__appt-day">
                        <CardHeader>
                          <p className="ui-card__title app-card-title-lg app-patient-profile__appt-day-title">
                            {dateIso}
                          </p>
                        </CardHeader>
                        <CardBody>
                          <ul className="app-patient-profile__appt-list" aria-label={`Appointments on ${dateIso}`}>
                            {list.map((appt) => (
                              <li key={appt.id} className="app-patient-profile__appt-row">
                                <div className="app-patient-profile__appt-time">{appt.time}</div>
                                <div className="app-patient-profile__appt-main">
                                  <div className="app-patient-profile__appt-line1">
                                    <span className="app-patient-profile__appt-duration">
                                      {patientApptFormatDuration(appt)}
                                    </span>
                                    <span className="app-patient-profile__appt-meta">
                                      {patientApptRowMeta(appt, doctorLabels, procedureMaps)}
                                    </span>
                                  </div>
                                  <div className="app-patient-profile__appt-badges">
                                    <Badge
                                      variant={patientApptStatusBadgeVariant(appt.status)}
                                      semanticLabel={`Visit status code ${appt.status}`}
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
                                </div>
                              </li>
                            ))}
                          </ul>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
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

                {medState.phase === "offline" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title={CLINIC_SERVICE_OFFLINE_TITLE}
                    description={CLINIC_SERVICE_OFFLINE_SECTION}
                  />
                ) : medState.phase === "loading" ? (
                  <p className="app-patient-profile__status" role="status" aria-live="polite">
                    Loading medical summary…
                  </p>
                ) : medState.phase === "error" ? (
                  <div className="app-patient-profile__error" role="alert">
                    <p>{medState.message}</p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="ui-focusable"
                      onClick={() => setMedRefreshNonce((n) => n + 1)}
                    >
                      Retry
                    </Button>
                  </div>
                ) : medState.phase === "no_record" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title="No medical record found for this patient."
                    description="The read-only copy has no medical questionnaire on file for this patient."
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
                    title="Clinic service offline"
                    description="Connect the bridge to load treatment history."
                  />
                ) : txState.phase === "loading" ? (
                  <p className="app-patient-profile__status" role="status" aria-live="polite">
                    Loading treatments…
                  </p>
                ) : txState.phase === "error" ? (
                  <div className="app-patient-profile__error" role="alert">
                    <p>{txState.message}</p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="ui-focusable"
                      onClick={() => setTxRefreshNonce((n) => n + 1)}
                    >
                      Retry
                    </Button>
                  </div>
                ) : txState.phase === "empty" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title="No treatments found"
                    description="This patient has no procedure lines in the read-only copy, or none match the current bridge scan."
                  />
                ) : txState.phase === "loaded" ? (
                  <TreatmentsBody
                    treatments={txState.treatments}
                    truncated={txState.truncated}
                    privacyNote={txState.privacyNote}
                    doctorLabels={doctorLabels}
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

                {chartState.phase === "offline" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title={CLINIC_SERVICE_OFFLINE_TITLE}
                    description={CLINIC_SERVICE_OFFLINE_SECTION}
                  />
                ) : chartState.phase === "loading" ? (
                  <p className="app-patient-profile__status" role="status" aria-live="polite">
                    Loading chart…
                  </p>
                ) : chartState.phase === "error" ? (
                  <div className="app-patient-profile__error" role="alert">
                    <p>{chartState.message}</p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="ui-focusable"
                      onClick={() => setChartRefreshNonce((n) => n + 1)}
                    >
                      Retry
                    </Button>
                  </div>
                ) : chartState.phase === "empty" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title="No chart entries found"
                    description="This patient has no chart rows in the read-only copy, or none match the current bridge scan."
                  />
                ) : chartState.phase === "loaded" ? (
                  <ChartBody
                    entries={chartState.entries}
                    truncated={chartState.truncated}
                    privacyNote={chartState.privacyNote}
                  />
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
                <p className="app-patient-profile__ledger-amounts-note" role="note">
                  Payment amounts are intentionally hidden in this preview.
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
                    description={CLINIC_SERVICE_OFFLINE_SECTION}
                  />
                ) : ledgerState.phase === "loading" ? (
                  <p className="app-patient-profile__status" role="status" aria-live="polite">
                    Loading ledger…
                  </p>
                ) : ledgerState.phase === "error" ? (
                  <div className="app-patient-profile__error" role="alert">
                    <p>{ledgerState.message}</p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="ui-focusable"
                      onClick={() => setLedgerRefreshNonce((n) => n + 1)}
                    >
                      Retry
                    </Button>
                  </div>
                ) : ledgerState.phase === "empty" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title="No ledger entries found"
                    description="This patient has no billing lines in the read-only copy, or none match the current bridge scan."
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
