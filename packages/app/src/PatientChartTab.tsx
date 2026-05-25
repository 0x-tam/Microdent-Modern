import { useState, useMemo } from "react";
import type { PatientChartEntry } from "@microdent/contracts";
import { Badge, Button } from "@microdent/ui";
import { ClinicEmptyState } from "./clinic-empty-state.js";
import { ClinicLoadingSkeleton } from "./clinic-loading-skeleton.js";
import {
  CLINIC_SERVICE_OFFLINE_TITLE,
  PATIENT_TAB_LOADING_CHART,
  PATIENT_TAB_OFFLINE_CHART,
  PATIENT_TAB_EMPTY_CHART_TITLE,
  PATIENT_TAB_EMPTY_CHART,
  PATIENT_TAB_CHART_LEDE,
  PATIENT_TAB_HIDDEN_CHART,
  PATIENT_TAB_CHART_EXPLAINER,
  PATIENT_TAB_FILTER_ALL,
  PATIENT_TAB_CHART_FILTER_ALL,
  PATIENT_TAB_CHART_FILTER_TREATED,
  PATIENT_CHART_TOOTH_FILTER_CLEAR,
  PATIENT_CHART_TOOTH_FILTER_LABEL,
  TRUNCATED_LIST_BANNER,
  READONLY_STATE_RETRY,
  chartSummaryStripLabel,
} from "./read-only-ui-copy.js";
import { timelineChartToothFilterLabel } from "./patient-timeline-display.js";
import {
  chartSummaryStats,
  chartTreatedLabel,
  chartTypeLabel,
  chartTypesFromEntries,
  filterChartEntriesForDisplay,
  groupChartEntriesByTooth,
  type ChartTreatedFilter,
} from "./patient-chart-display.js";

/* ── Types ─────────────────────────────────────────────────────────────── */

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

/* ── Shared helpers ────────────────────────────────────────────────────── */

function TabHiddenNote() {
  return (
    <p
      className="app-info-callout app-patient-profile__tab-hidden-note"
      role="note"
    >
      {PATIENT_TAB_HIDDEN_CHART}
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

      <p className="app-patient-profile__chart-summary-strip app-clinical-chart-summary-strip" aria-live="polite">
        {chartSummaryStripLabel(summary)}
      </p>

      {showFilterToolbar ? (
        <div className="app-patient-profile__clinical-toolbar">
          <p className="app-patient-profile__clinical-toolbar-summary" aria-live="polite">
            {filtered.length === 1 ? "1 chart entry" : `${filtered.length} chart entries`}
          </p>
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
        </div>
      ) : (
        <p className="app-patient-profile__clinical-toolbar-summary" aria-live="polite">
          {filtered.length === 1 ? "1 chart entry" : `${filtered.length} chart entries`}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="app-patient-profile__clinical-empty-filtered" role="status">
          No chart entries match the current filter.
        </p>
      ) : (
        <div className="app-clinical-stack">
          {toothGroups.map((group) => (
            <section key={group.toothKey} className="app-patient-profile__clinical-tooth-group app-clinical-group-card">
              <h4 className="app-patient-profile__tab-section-title app-clinical-section-header app-clinical-section-header--chart">
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
                          <Badge
                            variant="neutral"
                            semanticLabel="Chart note hidden"
                            className="app-clinical-badge app-clinical-badge--description-hidden"
                          >
                            Note hidden
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p className="app-patient-profile__chart-privacy">{privacyNote}</p>
    </div>
  );
}

/* ── Tab root ──────────────────────────────────────────────────────────── */

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
      <TabHiddenNote />

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
