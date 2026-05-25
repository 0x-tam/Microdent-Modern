import { useState, useMemo } from "react";
import type { LedgerEntryV1 } from "@microdent/contracts";
import { Badge, Button } from "@microdent/ui";
import { ClinicEmptyState } from "./clinic-empty-state.js";
import { ClinicLoadingSkeleton } from "./clinic-loading-skeleton.js";
import {
  CLINIC_SERVICE_OFFLINE_TITLE,
  PATIENT_TAB_LOADING_LEDGER,
  PATIENT_TAB_OFFLINE_LEDGER,
  PATIENT_TAB_EMPTY_LEDGER_TITLE,
  PATIENT_TAB_EMPTY_LEDGER,
  PATIENT_TAB_LEDGER_LEDE,
  PATIENT_TAB_HIDDEN_LEDGER,
  PATIENT_TAB_LEDGER_AMOUNTS_HIDDEN,
  PATIENT_TAB_LEDGER_AMOUNTS_CHIP,
  PATIENT_TAB_FILTER_ALL,
  PATIENT_TAB_LEDGER_FILTER_CHARGE,
  PATIENT_TAB_LEDGER_FILTER_ADJUSTMENT,
  PATIENT_TAB_LEDGER_FILTER_PAYMENT,
  TRUNCATED_LIST_BANNER,
  READONLY_STATE_RETRY,
  ledgerToolbarSummary,
} from "./read-only-ui-copy.js";
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
  type LedgerEntryTypeFilter,
} from "./patient-ledger-display.js";

/* ── Types ─────────────────────────────────────────────────────────────── */

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

/* ── Shared helpers ────────────────────────────────────────────────────── */

function TabHiddenNote() {
  return (
    <p
      className="app-info-callout app-patient-profile__tab-hidden-note"
      role="note"
    >
      {PATIENT_TAB_HIDDEN_LEDGER}
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

      <p className="app-patient-profile__ledger-amounts-note app-clinical-amount-callout" role="note">
        {PATIENT_TAB_LEDGER_AMOUNTS_HIDDEN}
      </p>

      {/* Toolbar */}
      <div className="app-patient-profile__clinical-toolbar">
        <div className="app-patient-profile__clinical-toolbar-head">
          <p className="app-patient-profile__clinical-toolbar-summary" aria-live="polite">
            {toolbarSummary}
            {typeDistribution ? (
              <span className="app-patient-profile__clinical-toolbar-stats"> · {typeDistribution}</span>
            ) : null}
          </p>
          <Badge
            variant="neutral"
            semanticLabel={PATIENT_TAB_LEDGER_AMOUNTS_CHIP}
            className="app-clinical-badge app-clinical-badge--amount-hidden"
          >
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
      </div>

      {filtered.length === 0 ? (
        <p className="app-patient-profile__clinical-empty-filtered" role="status">
          No ledger lines match the current filter.
        </p>
      ) : (
        <div className="app-clinical-stack">
          {monthGroups.map((group) => (
            <section key={group.monthKey} className="app-patient-profile__clinical-month-group app-clinical-group-card">
              <h4 className="app-patient-profile__tab-section-title app-clinical-section-header app-clinical-section-header--ledger">
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
                            <Badge
                              variant="neutral"
                              semanticLabel="Ledger description hidden"
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
      <p className="app-patient-profile__ledger-privacy">{privacyNote}</p>
    </div>
  );
}

/* ── Tab root ──────────────────────────────────────────────────────────── */

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
      <TabHiddenNote />
      <p className="app-patient-profile__ledger-amounts-note app-clinical-amount-callout" role="note">
        {PATIENT_TAB_LEDGER_AMOUNTS_HIDDEN}
      </p>

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
