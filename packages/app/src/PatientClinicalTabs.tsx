import type {
  LedgerEntryV1,
  PatientChartEntry,
  PatientMedicalSummaryResponse,
  PatientTreatmentItem,
} from "@microdent/contracts";
import { Button } from "@microdent/ui";
import { ClinicEmptyState } from "./clinic-empty-state.js";
import { ClinicLoadingSkeleton } from "./clinic-loading-skeleton.js";
import type { ProcedureReferenceMaps } from "./procedure-reference.js";
import {
  CLINIC_SERVICE_OFFLINE_TITLE,
  PATIENT_TAB_LOADING_MEDICAL,
  PATIENT_TAB_LOADING_TREATMENTS,
  PATIENT_TAB_LOADING_CHART,
  PATIENT_TAB_LOADING_LEDGER,
  PATIENT_TAB_OFFLINE_MEDICAL,
  PATIENT_TAB_OFFLINE_TREATMENTS,
  PATIENT_TAB_OFFLINE_CHART,
  PATIENT_TAB_OFFLINE_LEDGER,
  PATIENT_TAB_EMPTY_MEDICAL_TITLE,
  PATIENT_TAB_EMPTY_MEDICAL,
  PATIENT_TAB_EMPTY_TREATMENTS_TITLE,
  PATIENT_TAB_EMPTY_TREATMENTS,
  PATIENT_TAB_EMPTY_CHART_TITLE,
  PATIENT_TAB_EMPTY_CHART,
  PATIENT_TAB_EMPTY_LEDGER_TITLE,
  PATIENT_TAB_EMPTY_LEDGER,
  PATIENT_TAB_MEDICAL_LEDE,
  PATIENT_TAB_TREATMENTS_LEDE,
  PATIENT_TAB_CHART_LEDE,
  PATIENT_TAB_LEDGER_LEDE,
  PATIENT_TAB_HIDDEN_MEDICAL,
  PATIENT_TAB_HIDDEN_TREATMENTS,
  PATIENT_TAB_HIDDEN_CHART,
  PATIENT_TAB_HIDDEN_LEDGER,
  PATIENT_TAB_LEDGER_AMOUNTS_HIDDEN,
  PATIENT_CHART_TOOTH_FILTER_CLEAR,
  PATIENT_CHART_TOOTH_FILTER_LABEL,
  READONLY_STATE_RETRY,
} from "./read-only-ui-copy.js";
import { timelineChartToothFilterLabel } from "./patient-timeline-display.js";
import { filterChartEntriesForDisplay } from "./patient-chart-display.js";

/* ── shared helper ─────────────────────────────────────────────────────── */

function TabHiddenNote({
  variant,
}: {
  variant: "medical" | "treatments" | "chart" | "ledger";
}) {
  const note =
    variant === "treatments"
      ? PATIENT_TAB_HIDDEN_TREATMENTS
      : variant === "ledger"
        ? PATIENT_TAB_HIDDEN_LEDGER
        : variant === "medical"
          ? PATIENT_TAB_HIDDEN_MEDICAL
          : PATIENT_TAB_HIDDEN_CHART;
  return (
    <p
      className="app-info-callout app-patient-profile__tab-hidden-note"
      role="note"
    >
      {note}
    </p>
  );
}

function ReadonlyError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="app-readonly-state app-readonly-state--error app-patient-profile__error" role="alert">
      <p>{message}</p>
      <Button type="button" variant="secondary" className="ui-focusable" onClick={onRetry}>
        {READONLY_STATE_RETRY}
      </Button>
    </div>
  );
}

/* ── Medical Tab ───────────────────────────────────────────────────────── */

export type MedLoadState =
  | { phase: "idle" }
  | { phase: "offline" }
  | { phase: "loading" }
  | { phase: "no_record" }
  | { phase: "loaded"; summary: PatientMedicalSummaryResponse }
  | { phase: "error"; message: string };

export type PatientMedicalTabProps = {
  medState: MedLoadState;
  onRefresh: () => void;
  isOffline: boolean;
  /** Body component – defaults to inline rendering for back-compat. */
  BodyComponent?: React.ComponentType<{ summary: PatientMedicalSummaryResponse }>;
};

export function PatientMedicalTab({
  medState,
  onRefresh,
  isOffline,
  BodyComponent,
}: PatientMedicalTabProps) {
  const effectiveOffline = isOffline || medState.phase === "offline";

  return (
    <section
      id="patient-panel-medical"
      role="tabpanel"
      aria-labelledby="patient-tab-medical"
      className="app-patient-profile__medical app-clinical-tab app-clinical-tab--medical"
    >
      <p className="app-patient-profile__medical-lede">{PATIENT_TAB_MEDICAL_LEDE}</p>
      <TabHiddenNote variant="medical" />

      {effectiveOffline ? (
        <ClinicEmptyState
          variant="offline"
          className="app-patient-profile__empty"
          title={CLINIC_SERVICE_OFFLINE_TITLE}
          body={PATIENT_TAB_OFFLINE_MEDICAL}
        />
      ) : medState.phase === "loading" ? (
        <ClinicLoadingSkeleton lines={4} label={PATIENT_TAB_LOADING_MEDICAL} />
      ) : medState.phase === "error" ? (
        <ReadonlyError message={medState.message} onRetry={onRefresh} />
      ) : medState.phase === "no_record" ? (
        <ClinicEmptyState
          className="app-patient-profile__empty"
          title={PATIENT_TAB_EMPTY_MEDICAL_TITLE}
          body={PATIENT_TAB_EMPTY_MEDICAL}
        />
      ) : medState.phase === "loaded" ? (
        BodyComponent ? (
          <BodyComponent summary={medState.summary} />
        ) : (
          <MedicalSummaryBody summary={medState.summary} />
        )
      ) : null}
    </section>
  );
}

/** Inline medical body – same as the one in PatientProfilePanel. */
function MedicalSummaryBody({ summary }: { summary: PatientMedicalSummaryResponse }) {
  // This is a passthrough – the real body lives in PatientProfilePanel.
  // When BodyComponent is not provided, the parent renders this section
  // with the body already present; this fallback satisfies the type.
  return (
    <div className="app-patient-profile__medical-body">
      <p>{summary.privacyNote}</p>
    </div>
  );
}

/* ── Treatments Tab ────────────────────────────────────────────────────── */

export type TxLoadState =
  | { phase: "idle" }
  | { phase: "offline" }
  | { phase: "loading" }
  | { phase: "loaded"; treatments: PatientTreatmentItem[]; truncated: boolean; privacyNote: string }
  | { phase: "empty" }
  | { phase: "error"; message: string };

export type PatientTreatmentsTabProps = {
  txState: TxLoadState;
  onRefresh: () => void;
  procedureMaps: ProcedureReferenceMaps;
  doctorLabels: ReadonlyMap<string, string>;
  isOffline: boolean;
  BodyComponent?: React.ComponentType<{
    treatments: PatientTreatmentItem[];
    truncated: boolean;
    privacyNote: string;
    doctorLabels: ReadonlyMap<string, string>;
    procedureMaps: ProcedureReferenceMaps;
  }>;
};

export function PatientTreatmentsTab({
  txState,
  onRefresh,
  procedureMaps,
  doctorLabels,
  isOffline,
  BodyComponent,
}: PatientTreatmentsTabProps) {
  const effectiveOffline = isOffline || txState.phase === "offline";

  return (
    <section
      id="patient-panel-treatments"
      role="tabpanel"
      aria-labelledby="patient-tab-treatments"
      className="app-patient-profile__treatments app-clinical-tab app-clinical-tab--treatments"
    >
      <p className="app-patient-profile__treatments-lede">{PATIENT_TAB_TREATMENTS_LEDE}</p>
      <TabHiddenNote variant="treatments" />

      <div className="app-patient-profile__treatments-controls">
        <Button
          type="button"
          variant="secondary"
          className="ui-focusable"
          onClick={onRefresh}
        >
          Refresh
        </Button>
      </div>

      {effectiveOffline ? (
        <ClinicEmptyState
          variant="offline"
          className="app-patient-profile__empty"
          title={CLINIC_SERVICE_OFFLINE_TITLE}
          body={PATIENT_TAB_OFFLINE_TREATMENTS}
        />
      ) : txState.phase === "loading" ? (
        <ClinicLoadingSkeleton lines={4} label={PATIENT_TAB_LOADING_TREATMENTS} />
      ) : txState.phase === "error" ? (
        <ReadonlyError message={txState.message} onRetry={onRefresh} />
      ) : txState.phase === "empty" ? (
        <ClinicEmptyState
          className="app-patient-profile__empty"
          title={PATIENT_TAB_EMPTY_TREATMENTS_TITLE}
          body={PATIENT_TAB_EMPTY_TREATMENTS}
        />
      ) : txState.phase === "loaded" ? (
        BodyComponent ? (
          <BodyComponent
            treatments={txState.treatments}
            truncated={txState.truncated}
            privacyNote={txState.privacyNote}
            doctorLabels={doctorLabels}
            procedureMaps={procedureMaps}
          />
        ) : (
          <TreatmentsBody
            treatments={txState.treatments}
            truncated={txState.truncated}
            privacyNote={txState.privacyNote}
            doctorLabels={doctorLabels}
            procedureMaps={procedureMaps}
          />
        )
      ) : null}
    </section>
  );
}

function TreatmentsBody({
  treatments: _t,
  truncated: _tr,
  privacyNote: _pn,
  doctorLabels: _dl,
  procedureMaps: _pm,
}: {
  treatments: PatientTreatmentItem[];
  truncated: boolean;
  privacyNote: string;
  doctorLabels: ReadonlyMap<string, string>;
  procedureMaps: ProcedureReferenceMaps;
}) {
  // Fallback body – real implementation lives in PatientProfilePanel.
  return <div className="app-patient-profile__treatments-body" />;
}

/* ── Chart Tab ─────────────────────────────────────────────────────────── */

export type ChartLoadState =
  | { phase: "idle" }
  | { phase: "offline" }
  | { phase: "loading" }
  | { phase: "loaded"; entries: PatientChartEntry[]; truncated: boolean; privacyNote: string }
  | { phase: "empty" }
  | { phase: "error"; message: string };

export type PatientChartTabProps = {
  chartState: ChartLoadState;
  chartToothFilter: number | null;
  onChartToothFilterChange: (tooth: number | null) => void;
  onRefresh: () => void;
  isOffline: boolean;
  /** Pre-computed filtered entries from the parent (handles tooth filtering). */
  chartEntriesForDisplay?: PatientChartEntry[];
  BodyComponent?: React.ComponentType<{
    entries: PatientChartEntry[];
    truncated: boolean;
    privacyNote: string;
  }>;
};

export function PatientChartTab({
  chartState,
  chartToothFilter,
  onChartToothFilterChange,
  onRefresh,
  isOffline,
  chartEntriesForDisplay,
  BodyComponent,
}: PatientChartTabProps) {
  const effectiveOffline = isOffline || chartState.phase === "offline";

  const displayEntries: PatientChartEntry[] =
    chartEntriesForDisplay !== undefined
      ? chartEntriesForDisplay
      : chartState.phase !== "loaded"
        ? []
        : chartToothFilter === null
          ? chartState.entries
          : chartState.entries.filter((entry) => entry.toothNumber === chartToothFilter);

  return (
    <section
      id="patient-panel-chart"
      role="tabpanel"
      aria-labelledby="patient-tab-chart"
      className="app-patient-profile__chart app-clinical-tab app-clinical-tab--chart"
    >
      <p className="app-patient-profile__chart-lede">{PATIENT_TAB_CHART_LEDE}</p>
      <TabHiddenNote variant="chart" />

      <div className="app-patient-profile__chart-controls">
        <Button
          type="button"
          variant="secondary"
          className="ui-focusable"
          onClick={onRefresh}
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
            onClick={() => onChartToothFilterChange(null)}
          >
            {PATIENT_CHART_TOOTH_FILTER_CLEAR}
          </Button>
        </div>
      ) : null}

      {effectiveOffline ? (
        <ClinicEmptyState
          variant="offline"
          className="app-patient-profile__empty"
          title={CLINIC_SERVICE_OFFLINE_TITLE}
          body={PATIENT_TAB_OFFLINE_CHART}
        />
      ) : chartState.phase === "loading" ? (
        <ClinicLoadingSkeleton lines={4} label={PATIENT_TAB_LOADING_CHART} />
      ) : chartState.phase === "error" ? (
        <ReadonlyError message={chartState.message} onRetry={onRefresh} />
      ) : chartState.phase === "empty" ? (
        <ClinicEmptyState
          className="app-patient-profile__empty"
          title={PATIENT_TAB_EMPTY_CHART_TITLE}
          body={PATIENT_TAB_EMPTY_CHART}
        />
      ) : chartState.phase === "loaded" ? (
        displayEntries.length === 0 && chartToothFilter !== null ? (
          <p className="app-patient-profile__clinical-empty-filtered" role="status">
            No chart entries match tooth {chartToothFilter}.
          </p>
        ) : BodyComponent ? (
          <BodyComponent
            entries={displayEntries}
            truncated={chartState.truncated}
            privacyNote={chartState.privacyNote}
          />
        ) : (
          <ChartBody
            entries={displayEntries}
            truncated={chartState.truncated}
            privacyNote={chartState.privacyNote}
          />
        )
      ) : null}
    </section>
  );
}

function ChartBody({
  entries: _e,
  truncated: _t,
  privacyNote: _p,
}: {
  entries: PatientChartEntry[];
  truncated: boolean;
  privacyNote: string;
}) {
  // Fallback body – real implementation lives in PatientProfilePanel.
  return <div className="app-patient-profile__chart-body" />;
}

/* ── Ledger Tab ────────────────────────────────────────────────────────── */

export type LedgerLoadState =
  | { phase: "idle" }
  | { phase: "offline" }
  | { phase: "loading" }
  | { phase: "loaded"; entries: LedgerEntryV1[]; truncated: boolean; privacyNote: string }
  | { phase: "empty" }
  | { phase: "error"; message: string };

export type PatientLedgerTabProps = {
  ledgerState: LedgerLoadState;
  onRefresh: () => void;
  isOffline: boolean;
  BodyComponent?: React.ComponentType<{
    entries: LedgerEntryV1[];
    truncated: boolean;
    privacyNote: string;
  }>;
};

export function PatientLedgerTab({
  ledgerState,
  onRefresh,
  isOffline,
  BodyComponent,
}: PatientLedgerTabProps) {
  const effectiveOffline = isOffline || ledgerState.phase === "offline";

  return (
    <section
      id="patient-panel-ledger"
      role="tabpanel"
      aria-labelledby="patient-tab-ledger"
      className="app-patient-profile__ledger app-clinical-tab app-clinical-tab--ledger"
    >
      <p className="app-patient-profile__ledger-lede">{PATIENT_TAB_LEDGER_LEDE}</p>
      <TabHiddenNote variant="ledger" />
      <p className="app-patient-profile__ledger-amounts-note app-clinical-amount-callout" role="note">
        {PATIENT_TAB_LEDGER_AMOUNTS_HIDDEN}
      </p>

      <div className="app-patient-profile__ledger-controls">
        <Button
          type="button"
          variant="secondary"
          className="ui-focusable"
          onClick={onRefresh}
        >
          Refresh
        </Button>
      </div>

      {effectiveOffline ? (
        <ClinicEmptyState
          variant="offline"
          className="app-patient-profile__empty"
          title={CLINIC_SERVICE_OFFLINE_TITLE}
          body={PATIENT_TAB_OFFLINE_LEDGER}
        />
      ) : ledgerState.phase === "loading" ? (
        <ClinicLoadingSkeleton lines={4} label={PATIENT_TAB_LOADING_LEDGER} />
      ) : ledgerState.phase === "error" ? (
        <ReadonlyError message={ledgerState.message} onRetry={onRefresh} />
      ) : ledgerState.phase === "empty" ? (
        <ClinicEmptyState
          className="app-patient-profile__empty"
          title={PATIENT_TAB_EMPTY_LEDGER_TITLE}
          body={PATIENT_TAB_EMPTY_LEDGER}
        />
      ) : ledgerState.phase === "loaded" ? (
        BodyComponent ? (
          <BodyComponent
            entries={ledgerState.entries}
            truncated={ledgerState.truncated}
            privacyNote={ledgerState.privacyNote}
          />
        ) : (
          <LedgerBody
            entries={ledgerState.entries}
            truncated={ledgerState.truncated}
            privacyNote={ledgerState.privacyNote}
          />
        )
      ) : null}
    </section>
  );
}

function LedgerBody({
  entries: _e,
  truncated: _t,
  privacyNote: _p,
}: {
  entries: LedgerEntryV1[];
  truncated: boolean;
  privacyNote: string;
}) {
  // Fallback body – real implementation lives in PatientProfilePanel.
  return <div className="app-patient-profile__ledger-body" />;
}
