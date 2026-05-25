import { useState, useMemo } from "react";
import type { PatientTreatmentItem } from "@microdent/contracts";
import { Badge, Button } from "@microdent/ui";
import { ClinicEmptyState } from "./clinic-empty-state.js";
import { ClinicLoadingSkeleton } from "./clinic-loading-skeleton.js";
import type { ProcedureReferenceMaps } from "./procedure-reference.js";
import {
  CLINIC_SERVICE_OFFLINE_TITLE,
  PATIENT_TAB_LOADING_TREATMENTS,
  PATIENT_TAB_OFFLINE_TREATMENTS,
  PATIENT_TAB_EMPTY_TREATMENTS_TITLE,
  PATIENT_TAB_EMPTY_TREATMENTS,
  PATIENT_TAB_TREATMENTS_LEDE,
  PATIENT_TAB_HIDDEN_TREATMENTS,
  PATIENT_TAB_FILTER_ALL,
  TRUNCATED_LIST_BANNER,
  READONLY_STATE_RETRY,
  treatmentsToolbarSummary,
  treatmentsProviderStatsLine,
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

/* ── Types ─────────────────────────────────────────────────────────────── */

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

/* ── Shared helpers ────────────────────────────────────────────────────── */

function TabHiddenNote() {
  return (
    <p
      className="app-info-callout app-patient-profile__tab-hidden-note"
      role="note"
    >
      {PATIENT_TAB_HIDDEN_TREATMENTS}
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

/* ── Body ──────────────────────────────────────────────────────────────── */

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

      {/* Toolbar */}
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
      </div>

      {filtered.length === 0 ? (
        <p className="app-patient-profile__clinical-empty-filtered" role="status">
          No procedures match the current filters.
        </p>
      ) : (
        <div className="app-clinical-stack">
          {monthGroups.map((group) => (
            <section key={group.monthKey} className="app-patient-profile__clinical-month-group app-clinical-group-card">
              <h4 className="app-patient-profile__tab-section-title app-clinical-section-header app-clinical-section-header--treatments">
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
                            <Badge
                              variant="neutral"
                              semanticLabel="Procedure description hidden"
                              className="app-clinical-badge app-clinical-badge--description-hidden"
                            >
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
          ))}
        </div>
      )}
      <p className="app-patient-profile__treatments-privacy">{privacyNote}</p>
    </div>
  );
}

/* ── Tab root ──────────────────────────────────────────────────────────── */

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
      <TabHiddenNote />

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
