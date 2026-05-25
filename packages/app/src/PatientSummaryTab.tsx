import { Button, Card, CardBody, CardHeader } from "@microdent/ui";
import type { PatientProfileResponse, ScheduleAppointmentItem } from "@microdent/contracts";
import type { BridgeDevStatusResponse } from "@microdent/contracts";
import { AppMetricTile } from "./app-metric-tile.js";
import { ClinicPanel } from "./clinic-panel.js";
import { PatientDemographicsWritePanel } from "./PatientDemographicsWritePanel.js";
import { PatientSummaryMiniCards, type SummaryApptPrefetch, type SummaryCountPrefetch, type SummaryMedPrefetch, type ProfileTab } from "./patient-summary-mini-cards.js";
import { profileAssignedProviderLabel } from "./doctor-labels.js";
import type { ProcedureReferenceMaps } from "./procedure-reference.js";
import type { RoomLabelMap } from "./patient-appointments-display.js";
import { glancePrefetchLoading, type PatientWorkspacePrefetches } from "./patient-workspace-intelligence.js";
import {
  PATIENT_TAB_SUMMARY_LEDE,
  PATIENT_TAB_HIDDEN_FIELDS_NOTE,
  PATIENT_SANDBOX_DEMOGRAPHICS_TITLE,
  PATIENT_SUMMARY_AT_GLANCE_TITLE,
  PATIENT_SUMMARY_AT_GLANCE_APPT_UPCOMING,
  PATIENT_SUMMARY_AT_GLANCE_APPT_RECENT,
  PATIENT_SUMMARY_AT_GLANCE_APPT_NONE,
  PATIENT_SUMMARY_AT_GLANCE_TREATMENTS,
  PATIENT_SUMMARY_AT_GLANCE_CHART,
  PATIENT_SUMMARY_AT_GLANCE_LEDGER,
  PATIENT_SUMMARY_AT_GLANCE_MEDICAL,
  PATIENT_SUMMARY_CROSS_TAB_ARIA,
  patientSummaryCrossTabWithCount,
} from "./read-only-ui-copy.js";

/** Cross-tab navigation targets for the summary tab. */
const SUMMARY_CROSS_TABS: readonly { id: Exclude<ProfileTab, "summary">; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "appointments", label: "Appointments" },
  { id: "medical", label: "Medical" },
  { id: "treatments", label: "Treatments" },
  { id: "chart", label: "Chart" },
  { id: "ledger", label: "Ledger" },
];

/** Compute a count hint for a given cross-tab from prefetches. */
function summaryCrossTabCount(
  tabId: Exclude<ProfileTab, "summary">,
  props: PatientWorkspacePrefetches,
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
    case "medical":
      return props.medical.phase === "loaded" && props.medical.hasMedicalRecord ? 1 : null;
    default:
      return null;
  }
}

/** Compact hidden-fields note for the summary tab. */
function ProfileTabHiddenNote() {
  return (
    <p
      className="app-info-callout app-patient-profile__tab-hidden-note app-patient-profile__tab-hidden-note--compact clinic-profile-hidden-note"
      role="note"
    >
      {PATIENT_TAB_HIDDEN_FIELDS_NOTE}
    </p>
  );
}

/** Ledger meta line showing count of ledger entries in preview. */
function ProfileLedgerMetaLine({ prefetches }: { prefetches: PatientWorkspacePrefetches }) {
  const { ledger } = prefetches;
  const loading = glancePrefetchLoading(prefetches);
  let value: string;
  if (ledger.phase === "loaded" && ledger.count > 0) {
    value = `${PATIENT_SUMMARY_AT_GLANCE_LEDGER(ledger.count)} in preview`;
  } else if (ledger.phase === "empty") {
    value = `${PATIENT_SUMMARY_AT_GLANCE_LEDGER(0)} in preview`;
  } else if (loading) {
    value = "Loading…";
  } else {
    value = "—";
  }

  return (
    <p className="clinic-profile-ledger-meta app-patient-profile__summary-ledger-meta" role="status">
      <span className="clinic-profile-ledger-meta__label">Ledger</span>
      <span className="clinic-profile-ledger-meta__value">{value}</span>
    </p>
  );
}

/** Cross-tab navigation buttons for switching to other clinical tabs. */
function ProfileSummaryCrossTabs({
  prefetches,
  onOpenTab,
}: {
  prefetches: PatientWorkspacePrefetches;
  onOpenTab: (tab: ProfileTab) => void;
}) {
  return (
    <div
      className="app-patient-profile__summary-cross-tabs clinic-profile-summary-cross-tabs"
      role="group"
      aria-label={PATIENT_SUMMARY_CROSS_TAB_ARIA}
    >
      {SUMMARY_CROSS_TABS.map((tab) => (
        <Button
          key={tab.id}
          type="button"
          variant="secondary"
          size="compact"
          className="ui-focusable app-patient-profile__summary-cross-tab"
          onClick={() => onOpenTab(tab.id)}
        >
          {patientSummaryCrossTabWithCount(tab.label, summaryCrossTabCount(tab.id, prefetches))}
        </Button>
      ))}
    </div>
  );
}

/** Metric grid showing key patient profile fields. */
function ProfileSummaryMetricGrid({
  profile,
  doctorLabels,
}: {
  profile: PatientProfileResponse;
  doctorLabels: ReadonlyMap<string, string>;
}) {
  const provider = profileAssignedProviderLabel(profile.doctorId, doctorLabels);

  return (
    <div className="app-metric-tile-grid app-patient-profile__summary-metrics" aria-label="Patient record summary">
      <AppMetricTile label="Record id" value={profile.patientId} />
      <AppMetricTile label="Phone (masked)" value={profile.phoneMask ?? "—"} tone="info" />
      <AppMetricTile label="Provider" value={provider} />
      <AppMetricTile label="Entry date" value={profile.entryDate ?? "—"} />
      <AppMetricTile
        label="Last visit"
        value={profile.lastVisit ?? "—"}
        tone={profile.lastVisit ? "emphasis" : "neutral"}
      />
      <AppMetricTile label="Chart number" value={profile.chartNumber ?? "—"} tone="success" />
    </div>
  );
}

/** Find the next upcoming appointment from a prefetch. */
function findNextUpcoming(appointments: ScheduleAppointmentItem[]): ScheduleAppointmentItem | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = appointments
    .filter((a) => {
      const d = new Date(a.date + "T00:00:00");
      return d >= today;
    })
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return upcoming.length > 0 ? upcoming[0] : null;
}

/** Find the most recent past appointment. */
function findMostRecent(appointments: ScheduleAppointmentItem[]): ScheduleAppointmentItem | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const past = appointments
    .filter((a) => {
      const d = new Date(a.date + "T00:00:00");
      return d < today;
    })
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return past.length > 0 ? past[0] : null;
}

/** At-a-glance metric strip — compact card row across the top. */
function SummaryAtAGlanceStrip({
  prefetches,
}: {
  prefetches: PatientWorkspacePrefetches;
}) {
  const { appt, treatments, chart, ledger, medical } = prefetches;
  const loading = glancePrefetchLoading(prefetches);

  // Next appointment
  let apptValue = PATIENT_SUMMARY_AT_GLANCE_APPT_NONE;
  let apptTone: "default" | "success" | "info" = "default";
  if (appt.phase === "loaded" && appt.appointments.length > 0) {
    const next = findNextUpcoming(appt.appointments);
    if (next) {
      apptValue = `${PATIENT_SUMMARY_AT_GLANCE_APPT_UPCOMING}: ${next.date} ${next.time}`;
      apptTone = "success";
    } else {
      const recent = findMostRecent(appt.appointments);
      if (recent) {
        apptValue = `${PATIENT_SUMMARY_AT_GLANCE_APPT_RECENT}: ${recent.date}`;
        apptTone = "info";
      }
    }
  } else if (appt.phase === "empty") {
    apptValue = PATIENT_SUMMARY_AT_GLANCE_APPT_NONE;
  } else if (loading) {
    apptValue = "Loading…";
  }

  // Treatments
  const txValue =
    treatments.phase === "loaded"
      ? PATIENT_SUMMARY_AT_GLANCE_TREATMENTS(treatments.count)
      : treatments.phase === "empty"
        ? PATIENT_SUMMARY_AT_GLANCE_TREATMENTS(0)
        : loading
          ? "Loading…"
          : "—";

  // Chart
  const chartValue =
    chart.phase === "loaded"
      ? PATIENT_SUMMARY_AT_GLANCE_CHART(chart.count)
      : chart.phase === "empty"
        ? PATIENT_SUMMARY_AT_GLANCE_CHART(0)
        : loading
          ? "Loading…"
          : "—";

  // Ledger
  const ledgerValue =
    ledger.phase === "loaded"
      ? PATIENT_SUMMARY_AT_GLANCE_LEDGER(ledger.count)
      : ledger.phase === "empty"
        ? PATIENT_SUMMARY_AT_GLANCE_LEDGER(0)
        : loading
          ? "Loading…"
          : "—";

  // Medical
  let medicalState = "—";
  if (medical.phase === "loaded") {
    if (!medical.hasMedicalRecord) {
      medicalState = "No record";
    } else if (medical.sensitive) {
      medicalState = "Sensitive";
    } else {
      medicalState = medical.flaggedConditionCount > 0 ? `${medical.flaggedConditionCount} flags` : "Clear";
    }
  } else if (medical.phase === "empty") {
    medicalState = "No record";
  } else if (loading) {
    medicalState = "Loading…";
  }
  const medicalValue = PATIENT_SUMMARY_AT_GLANCE_MEDICAL(medicalState);

  return (
    <div
      className="app-patient-profile__summary-at-a-glance clinic-profile-summary-at-a-glance"
      role="region"
      aria-label={PATIENT_SUMMARY_AT_GLANCE_TITLE}
    >
      <div className="clinic-profile-summary-glance-grid">
        <Card variant="metric" className="app-patient-profile__summary-glance-card clinic-glance-card">
          <CardBody className="clinic-glance-card__body">
            <span className="clinic-glance-card__label">{PATIENT_SUMMARY_AT_GLANCE_APPT_UPCOMING}</span>
            <span className={`clinic-glance-card__value${apptTone === "success" ? " clinic-glance-card__value--ok" : apptTone === "info" ? " clinic-glance-card__value--info" : ""}`}>
              {apptValue}
            </span>
          </CardBody>
        </Card>
        <Card variant="metric" className="app-patient-profile__summary-glance-card clinic-glance-card">
          <CardBody className="clinic-glance-card__body">
            <span className="clinic-glance-card__label">Treatments</span>
            <span className="clinic-glance-card__value">{txValue}</span>
          </CardBody>
        </Card>
        <Card variant="metric" className="app-patient-profile__summary-glance-card clinic-glance-card">
          <CardBody className="clinic-glance-card__body">
            <span className="clinic-glance-card__label">Chart</span>
            <span className="clinic-glance-card__value">{chartValue}</span>
          </CardBody>
        </Card>
        <Card variant="metric" className="app-patient-profile__summary-glance-card clinic-glance-card">
          <CardBody className="clinic-glance-card__body">
            <span className="clinic-glance-card__label">Ledger</span>
            <span className="clinic-glance-card__value">{ledgerValue}</span>
          </CardBody>
        </Card>
        <Card variant="metric" className="app-patient-profile__summary-glance-card clinic-glance-card">
          <CardBody className="clinic-glance-card__body">
            <span className="clinic-glance-card__label">Medical</span>
            <span className="clinic-glance-card__value">{medicalValue}</span>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export type PatientSummaryTabProps = {
  /** Appointment summary prefetch data. */
  summaryAppt: SummaryApptPrefetch;
  /** Medical summary prefetch data. */
  summaryMed: SummaryMedPrefetch;
  /** Treatments summary prefetch data. */
  summaryTx: SummaryCountPrefetch;
  /** Chart summary prefetch data. */
  summaryChart: SummaryCountPrefetch;
  /** Ledger summary prefetch data. */
  summaryLedger: SummaryCountPrefetch;
  /** Full patient profile response. */
  profile: PatientProfileResponse;
  /** Doctor id → label map. */
  doctorLabels: ReadonlyMap<string, string>;
  /** Procedure reference maps for display formatting. */
  procedureMaps: ProcedureReferenceMaps;
  /** Room id → display label map. */
  roomMap: RoomLabelMap;
  /** Whether sandbox write pilot is enabled. */
  sandboxWritePilot: boolean;
  /** Callback to open a specific tab. */
  onOpenTab: (tab: ProfileTab) => void;
  /** Callback to refresh data (e.g. after sandbox commit). */
  onRefresh: () => void;
  /** Bridge base URL for sandbox components. */
  bridgeBaseUrl: string;
  /** Current patient id. */
  patientId: string;
  /** Bridge write capability status. */
  writeCapability: BridgeDevStatusResponse | null;
  /** Fetch implementation for sandbox panel. */
  fetchImpl?: typeof fetch;
};

/** Summary tab content for the patient profile panel. */
export function PatientSummaryTab({
  summaryAppt,
  summaryMed,
  summaryTx,
  summaryChart,
  summaryLedger,
  profile,
  doctorLabels,
  procedureMaps,
  roomMap,
  sandboxWritePilot,
  onOpenTab,
  onRefresh,
  bridgeBaseUrl,
  patientId,
  writeCapability,
  fetchImpl,
}: PatientSummaryTabProps) {
  const summaryPrefetches: PatientWorkspacePrefetches = {
    appt: summaryAppt,
    medical: summaryMed,
    treatments: summaryTx,
    chart: summaryChart,
    ledger: summaryLedger,
  };

  return (
    <section
      id="patient-panel-summary"
      role="tabpanel"
      aria-labelledby="patient-tab-summary"
      className="app-patient-profile__summary clinic-profile-summary"
    >
      <p className="app-patient-profile__summary-lede">{PATIENT_TAB_SUMMARY_LEDE}</p>
      <ProfileTabHiddenNote />

      {/* At-a-glance metric strip */}
      <SummaryAtAGlanceStrip prefetches={summaryPrefetches} />

      {/* Two-column main area: Activity preview + Clinical read-only panel */}
      <div className="clinic-workspace-grid clinic-profile-summary-grid">
        {/* Left: Activity preview */}
        <ClinicPanel
          title="Activity preview"
          className="clinic-profile-summary-activity-panel"
          bodyClassName="clinic-profile-summary-activity-body"
        >
          <PatientSummaryMiniCards
            appt={summaryAppt}
            medical={summaryMed}
            treatments={summaryTx}
            chart={summaryChart}
            ledger={summaryLedger}
            doctorLabels={doctorLabels}
            procedureMaps={procedureMaps}
            roomMap={roomMap}
            onOpenTab={onOpenTab}
          />
        </ClinicPanel>

        {/* Right: Clinical read-only status panel */}
        <div className="clinic-profile-summary-clinical">
          <Card variant="elevated" className="app-patient-profile__summary-clinical-card clinic-profile-summary-clinical-panel">
            <CardHeader>
              <h3 className="clinic-profile-summary-clinical-heading">Clinical status</h3>
            </CardHeader>
            <CardBody>
              <ProfileSummaryMetricGrid profile={profile} doctorLabels={doctorLabels} />
              <ProfileLedgerMetaLine prefetches={summaryPrefetches} />
            </CardBody>
          </Card>
        </div>
      </div>

      {/* CTA row: Navigate to source tabs */}
      <ProfileSummaryCrossTabs prefetches={summaryPrefetches} onOpenTab={onOpenTab} />

      {/* Sandbox demographics panel (conditional) */}
      {bridgeBaseUrl && patientId && sandboxWritePilot ? (
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
            profile={profile}
            bridgeBaseUrl={bridgeBaseUrl}
            fetchImpl={fetchImpl}
            writePilotEnabled={sandboxWritePilot}
            writeCapability={writeCapability}
            onCommitted={onRefresh}
          />
        </section>
      ) : null}
    </section>
  );
}
