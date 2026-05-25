import { BridgeClientError, createBridgeClient, isInvalidBodySchemaMismatch } from "@microdent/bridge-client";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Badge, Button, Card, CardBody, EmptyState, Input, PatientQuickCard } from "@microdent/ui";
import type { BridgeHealthPhase } from "./bridge-health.js";
import { ClinicEmptyState } from "./clinic-empty-state.js";
import { ClinicPage, ClinicPageHero } from "./clinic-page.js";
import { ClinicPanel } from "./clinic-panel.js";
import {
  PATIENT_NO_SELECTION_DESCRIPTION,
  PATIENT_NO_SELECTION_TITLE,
  PATIENT_PAGE_SEARCH_EXAMPLE,
  PATIENT_PAGE_SEARCH_LEDE,
  PATIENT_PAGE_SEARCH_TITLE,
  PATIENT_RECENT_SESSION_EMPTY,
  PATIENT_RECENT_SESSION_HINT,
  PATIENT_RECENT_SESSION_TITLE,
  PATIENT_SEARCH_DROPDOWN_NO_MATCH,
  PATIENT_SEARCH_FIELD_LABEL,
  PATIENT_SEARCH_HINT_CONNECTED,
  PATIENT_SEARCH_HINT_OFFLINE,
  PATIENT_SEARCH_IDLE,
  PATIENT_SEARCH_OFFLINE_BANNER,
  PATIENT_SEARCH_OFFLINE_STATUS,
  PATIENT_SEARCH_NO_MATCH,
  PATIENT_SEARCH_OPEN_RECORD_PREFIX,
  PATIENT_SEARCH_SEARCHING,
  PATIENT_SEARCH_TOO_SHORT,
  PATIENTS_EMPTY_FOCUS_HINT,
  PATIENTS_OPEN_WORKSPACE_LABEL,
  PATIENTS_PAGE_RESULTS_TITLE,
  READ_ONLY_MODE_LABEL,
  CLINIC_SERVICE_CHECKING,
} from "./read-only-ui-copy.js";
import {
  formatSessionRecentPatientMeta,
  type SessionRecentPatient,
} from "./session-recent-patients.js";

const SEARCH_DEBOUNCE_MS = 300;
const PATIENTS_SAFETY_NOTE_TITLE = "Patient safety note";
const PATIENTS_OPENS_NEXT_TITLE = "What opens next";
const PATIENTS_PAGE_SEARCH_PRIVACY_SHORT =
  "Copied clinic data only — safe names, chart numbers, and masked phone hints.";
const PATIENTS_SAFETY_NOTE_LINE = "Read-only record — safe fields from your copied data only.";
const PATIENTS_OPENS_NEXT_BULLETS = [
  "Summary — demographics and at-a-glance cards.",
  "Chart and Treatments — read-only dental chart and procedures.",
  "Ledger preview — transaction metadata; amounts stay hidden.",
] as const;
const PATIENTS_RECENT_SESSION_HINT_SHORT =
  "Up to five opened this session — not saved after you close the app.";

export type PatientSearchHit = {
  patientId: string;
  chartNumber: string | null;
  displayName: string;
  phoneMask: string | null;
};

export type PatientSearchInstanceId = "topbar" | "page";

export type PatientSearchBarProps = {
  bridgePhase: BridgeHealthPhase;
  bridgeBaseUrl?: string;
  /** DOM id prefix — use `page` for the Patients module search (default `topbar`). */
  instanceId?: PatientSearchInstanceId;
  /** When `instanceId` is `page`, render hero + command grid (default true). Set false for inline change-patient search. */
  patientsWorkflowLayout?: boolean;
  /** Hero title when `patientsWorkflowLayout` is true (default Patients). */
  pageTitle?: string;
  /** Hero subtitle when `patientsWorkflowLayout` is true. */
  pageSubtitle?: string;
  /** Highlight the row that matches the profile currently shown (controlled from the shell). */
  selectedPatientId?: string | null;
  /** Display-only label for the open record (topbar chip; does not control the input value). */
  selectedDisplayName?: string | null;
  /** When the user picks a search row, the shell stores `patientId` and may navigate to Patients. */
  onPatientRecordSelect?: (hit: PatientSearchHit) => void;
  /** Session-only recent patients (safe fields; max 5). */
  recentPatients?: readonly SessionRecentPatient[];
  onRecentPatientSelect?: (entry: SessionRecentPatient) => void;
  /** When the user edits the query, the shell should clear the selected patient id. */
  onPatientSelectionClear?: () => void;
  /** When false, typing does not call `onPatientSelectionClear` (e.g. change-patient search while a profile is open). */
  clearSelectionOnQueryChange?: boolean;
  className?: string;
  /**
   * Optional fetch override (tests); production uses the bound global `fetch` from the bridge client.
   */
  fetchImpl?: typeof fetch;
};

function patientSearchDomIds(instanceId: PatientSearchInstanceId) {
  const prefix = instanceId === "page" ? "app-patients-page-search" : "app-patient-search";
  return {
    input: `${prefix}-input`,
    hint: `${prefix}-hint`,
    status: `${prefix}-status`,
    listbox: `${prefix}-listbox`,
  };
}

function formatHitMetaLine(hit: PatientSearchHit): string | null {
  if (hit.patientId) {
    return `Record ${hit.patientId}`;
  }
  return null;
}

function formatHitPageMeta(hit: PatientSearchHit): string | null {
  const parts: string[] = [];
  if (hit.chartNumber) {
    parts.push(`Chart ${hit.chartNumber}`);
  }
  if (hit.patientId) {
    parts.push(`Record ${hit.patientId}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

export function safePatientSearchError(e: unknown): string {
  if (e instanceof BridgeClientError) {
    if (e.kind === "network") {
      return "Could not reach the clinic service. Check that the clinic service is running.";
    }
    if (e.kind === "invalid_argument") {
      return "Enter at least 2 characters to search.";
    }
    if (e.kind === "http") {
      const code = e.apiCode ?? "";
      if (code === "DATA_ROOT_NOT_CONFIGURED" || code === "PATIENT_DBF_NOT_FOUND") {
        return "Patient list is not available yet. Ask your administrator to check the data folder.";
      }
      return "Search could not be completed. Try again in a moment.";
    }
    if (e.kind === "invalid_body") {
      if (isInvalidBodySchemaMismatch(e)) {
        return "Patient search needs a small data mapping fix. No clinic data was changed.";
      }
      return "Patient search could not read the clinic response format. Try again.";
    }
  }
  return "Search could not be completed.";
}

export function PatientSearchBar({
  bridgePhase,
  bridgeBaseUrl,
  instanceId = "topbar",
  patientsWorkflowLayout = true,
  pageTitle = "Patients",
  pageSubtitle = PATIENT_PAGE_SEARCH_LEDE,
  selectedPatientId = null,
  selectedDisplayName = null,
  onPatientRecordSelect,
  recentPatients = [],
  onRecentPatientSelect,
  onPatientSelectionClear,
  clearSelectionOnQueryChange = true,
  className,
  fetchImpl,
}: PatientSearchBarProps) {
  const domIds = patientSearchDomIds(instanceId);
  const base = bridgeBaseUrl?.trim() ?? "";
  const canSearch = Boolean(base) && bridgePhase === "connected";
  const isPageWorkflow = instanceId === "page" && patientsWorkflowLayout;
  const useDropdown = !isPageWorkflow;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientSearchHit[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [devSchemaHint, setDevSchemaHint] = useState(false);
  const [searching, setSearching] = useState(false);
  const [lastFinishedQuery, setLastFinishedQuery] = useState<string | null>(null);
  const [isResultsPanelOpen, setIsResultsPanelOpen] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);
  const [activeRecentIndex, setActiveRecentIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const recentButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const showDevDiagnostics = (() => {
    const m = import.meta as { env?: { DEV?: boolean; MODE?: string } };
    return Boolean(m.env?.DEV || m.env?.MODE === "test");
  })();

  const trimmed = query.trim();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  const runSearch = useCallback(
    async (q: string) => {
      if (!canSearch || q.length < 2) {
        return;
      }
      const seq = ++requestSeq.current;
      if (useDropdown) {
        setIsResultsPanelOpen(true);
      }
      setSearching(true);
      setSearchError(null);
      setDevSchemaHint(false);
      setResults([]);
      const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });
      try {
        const res = await client.searchPatients(q);
        if (seq !== requestSeq.current) {
          return;
        }
        setResults(res.results.slice(0, 20));
        setLastFinishedQuery(q);
      } catch (e: unknown) {
        if (seq !== requestSeq.current) {
          return;
        }
        setResults([]);
        setLastFinishedQuery(q);
        setDevSchemaHint(showDevDiagnostics && isInvalidBodySchemaMismatch(e));
        setSearchError(safePatientSearchError(e));
      } finally {
        if (seq === requestSeq.current) {
          setSearching(false);
        }
      }
    },
    [base, canSearch, fetchImpl, useDropdown],
  );

  useEffect(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (!canSearch || trimmed.length < 2) {
      return;
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void runSearch(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [trimmed, canSearch, runSearch]);

  useEffect(() => {
    if (!canSearch) {
      requestSeq.current += 1;
      setSearching(false);
      setResults([]);
      setSearchError(null);
      setDevSchemaHint(false);
      setLastFinishedQuery(null);
      setIsResultsPanelOpen(false);
    }
  }, [canSearch]);

  useEffect(() => {
    if (!useDropdown || !isResultsPanelOpen) {
      return;
    }
    const onMouseDown = (e: MouseEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(e.target as Node)) {
        setIsResultsPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isResultsPanelOpen, useDropdown]);

  const clearSearch = useCallback(() => {
    requestSeq.current += 1;
    setSearching(false);
    setResults([]);
    setSearchError(null);
    setDevSchemaHint(false);
    setLastFinishedQuery(null);
    setQuery("");
    setIsResultsPanelOpen(false);
    setActiveOptionIndex(-1);
    onPatientSelectionClear?.();
  }, [onPatientSelectionClear]);

  const selectPatientHit = useCallback(
    (hit: PatientSearchHit) => {
      onPatientRecordSelect?.(hit);
      requestSeq.current += 1;
      setSearching(false);
      setResults([]);
      setSearchError(null);
      setDevSchemaHint(false);
      setLastFinishedQuery(null);
      setQuery(isPageWorkflow ? "" : hit.displayName);
      setIsResultsPanelOpen(false);
      setActiveOptionIndex(-1);
    },
    [isPageWorkflow, onPatientRecordSelect],
  );

  const flushAndSearch = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (!canSearch || trimmed.length < 2) {
      return;
    }
    void runSearch(trimmed);
  }, [canSearch, trimmed, runSearch]);

  const canSelectFromList =
    trimmed.length >= 2 &&
    !searching &&
    searchError === null &&
    lastFinishedQuery === trimmed &&
    results.length > 0;

  useEffect(() => {
    setActiveOptionIndex(-1);
  }, [trimmed, results, searchError, searching, lastFinishedQuery]);

  const hasDropdownContent =
    canSearch &&
    trimmed.length >= 2 &&
    (searching ||
      searchError !== null ||
      results.length > 0 ||
      (lastFinishedQuery === trimmed && !searching && results.length === 0));

  const hasPageSearchActivity = trimmed.length >= 2;

  const showRecentSession =
    instanceId === "topbar" &&
    canSearch &&
    trimmed.length < 2 &&
    recentPatients.length > 0 &&
    onRecentPatientSelect !== undefined;

  const activeOptionId =
    activeOptionIndex >= 0 && activeOptionIndex < results.length
      ? `${domIds.listbox}-option-${results[activeOptionIndex]?.patientId}`
      : undefined;

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (useDropdown && isResultsPanelOpen) {
          setIsResultsPanelOpen(false);
          setActiveOptionIndex(-1);
          return;
        }
        clearSearch();
        return;
      }
      if (e.key === "ArrowDown") {
        if (canSelectFromList) {
          e.preventDefault();
          if (useDropdown && !isResultsPanelOpen) {
            setIsResultsPanelOpen(true);
          }
          setActiveOptionIndex((i) => {
            if (i < 0) return 0;
            return Math.min(i + 1, results.length - 1);
          });
        } else if (showRecentSession && recentPatients.length > 0) {
          e.preventDefault();
          setActiveRecentIndex(0);
          recentButtonRefs.current[0]?.focus();
        } else if (useDropdown && hasDropdownContent) {
          setIsResultsPanelOpen(true);
        }
        return;
      }
      if (e.key === "ArrowUp") {
        if (canSelectFromList) {
          e.preventDefault();
          if (useDropdown && !isResultsPanelOpen) {
            setIsResultsPanelOpen(true);
          }
          setActiveOptionIndex((i) => {
            if (i < 0) return results.length - 1;
            return Math.max(i - 1, 0);
          });
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (canSelectFromList) {
          const idx = activeOptionIndex >= 0 ? activeOptionIndex : 0;
          const hit = results[idx];
          if (hit) {
            selectPatientHit(hit);
            return;
          }
        }
        flushAndSearch();
      }
    },
    [
      activeOptionIndex,
      canSelectFromList,
      clearSearch,
      flushAndSearch,
      hasDropdownContent,
      isResultsPanelOpen,
      results,
      recentPatients,
      selectPatientHit,
      showRecentSession,
      useDropdown,
    ],
  );

  const onRecentKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(index + 1, recentPatients.length - 1);
        setActiveRecentIndex(next);
        recentButtonRefs.current[next]?.focus();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(index - 1, 0);
        setActiveRecentIndex(prev);
        recentButtonRefs.current[prev]?.focus();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const entry = recentPatients[index];
        if (entry) onRecentPatientSelect?.(entry);
      }
    },
    [onRecentPatientSelect, recentPatients],
  );

  const showOfflineBanner = Boolean(base) && bridgePhase !== "connected";

  const statusMeta = useMemo((): { line: string; tone: "offline" | "checking" | "idle" | "short" | "searching" | "error" | "no-match" } | null => {
    if (!base || bridgePhase === "offline") {
      return { line: PATIENT_SEARCH_OFFLINE_STATUS, tone: "offline" };
    }
    if (bridgePhase === "checking") {
      return { line: CLINIC_SERVICE_CHECKING, tone: "checking" };
    }
    if (!canSearch) {
      return { line: PATIENT_SEARCH_OFFLINE_STATUS, tone: "offline" };
    }
    if (trimmed.length === 0) {
      return { line: PATIENT_SEARCH_IDLE, tone: "idle" };
    }
    if (trimmed.length < 2) {
      return { line: PATIENT_SEARCH_TOO_SHORT, tone: "short" };
    }
    if (searching) {
      return { line: PATIENT_SEARCH_SEARCHING, tone: "searching" };
    }
    if (searchError) {
      return { line: searchError, tone: "error" };
    }
    if (lastFinishedQuery === trimmed && results.length === 0) {
      return { line: PATIENT_SEARCH_NO_MATCH, tone: "no-match" };
    }
    return null;
  }, [base, bridgePhase, canSearch, trimmed, searching, searchError, lastFinishedQuery, results.length]);

  const showDropdown = useDropdown && hasDropdownContent && isResultsPanelOpen;
  const showResultsList = isPageWorkflow && hasPageSearchActivity;
  const cappedList = results.length >= 20;

  const rootClassName = [
    "app-patient-search",
    instanceId === "page"
      ? isPageWorkflow
        ? "app-patient-search--page clinic-patients-search"
        : "app-patient-search--page app-patient-search--hero"
      : "app-patient-search--header clinic-header-search",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // ---------- Shared search controls (used by both modes) ----------
  const searchControls = (
    <>
      {showOfflineBanner ? (
        <p className="app-patient-search__offline-banner clinic-patients-offline-inline" role="status">
          {PATIENT_SEARCH_OFFLINE_BANNER}
        </p>
      ) : null}
      {instanceId === "topbar" && selectedDisplayName?.trim() ? (
        <p className="app-patient-search__selected" role="status">
          {PATIENT_SEARCH_OPEN_RECORD_PREFIX}{" "}
          <span className="app-patient-search__selected-name">{selectedDisplayName.trim()}</span>
        </p>
      ) : null}
      <Input
        variant="search"
        inputId={domIds.input}
        label={PATIENT_SEARCH_FIELD_LABEL}
        hint={
          canSearch
            ? instanceId === "page"
              ? PATIENTS_PAGE_SEARCH_PRIVACY_SHORT
              : PATIENT_SEARCH_HINT_CONNECTED
            : PATIENT_SEARCH_HINT_OFFLINE
        }
        error={searchError ?? undefined}
        className={`clinic-patients-search__input${instanceId === "page" ? " app-patient-search__input--page" : ""}`}
        type="search"
        disabled={!canSearch}
        autoComplete="off"
        spellCheck={false}
        placeholder="Name or chart number (2+ characters)"
        aria-describedby={`${domIds.hint} ${domIds.status}`}
        aria-expanded={useDropdown ? showDropdown : showResultsList}
        aria-controls={showDropdown || showResultsList ? domIds.listbox : undefined}
        aria-activedescendant={(showDropdown || showResultsList) && activeOptionId ? activeOptionId : undefined}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-busy={searching}
        role="combobox"
        value={query}
        onFocus={() => {
          if (useDropdown && hasDropdownContent) {
            setIsResultsPanelOpen(true);
          }
        }}
        onChange={(e) => {
          if (clearSelectionOnQueryChange) {
            onPatientSelectionClear?.();
          }
          setQuery(e.target.value);
          if (e.target.value.trim().length < 2) {
            setIsResultsPanelOpen(false);
            setResults([]);
            setSearchError(null);
            setDevSchemaHint(false);
            setLastFinishedQuery(null);
            setActiveOptionIndex(-1);
          } else if (canSearch && useDropdown) {
            setIsResultsPanelOpen(true);
          }
        }}
        onKeyDown={onKeyDown}
      />
      {statusMeta && !searchError ? (
        <p
          id={domIds.status}
          className={`app-patient-search__status app-patient-search__status--${statusMeta.tone} clinic-patients-search__status`}
          role="status"
          aria-live="polite"
        >
          {statusMeta.line}
        </p>
      ) : (
        <p id={domIds.status} className="app-sr-only">
          Ready.
        </p>
      )}
    </>
  );

  // ---------- Dropdown results (topbar mode) ----------
  const renderDropdownResults = () =>
    showDropdown ? (
      <div id={domIds.listbox} className="app-patient-search__dropdown" role="listbox" aria-label="Patient search results">
        {searching ? (
          <p className="app-patient-search__dropdown-muted" role="status">
            Searching…
          </p>
        ) : searchError ? (
          <>
            <p className="app-patient-search__dropdown-error">{searchError}</p>
            {showDevDiagnostics && devSchemaHint ? (
              <p className="app-patient-search__dropdown-muted" role="note">
                Response shape mismatch. Check console/tests for safe schema paths.
              </p>
            ) : null}
          </>
        ) : results.length === 0 ? (
          <p className="app-patient-search__dropdown-muted">{PATIENT_SEARCH_DROPDOWN_NO_MATCH}</p>
        ) : (
          <ul className="app-patient-search__hits">
            {results.map((hit, index) => {
              const metaLine = formatHitMetaLine(hit);
              const isProfileMatch = selectedPatientId !== null && selectedPatientId === hit.patientId;
              const isKeyboardActive = index === activeOptionIndex;
              const optionId = `${domIds.listbox}-option-${hit.patientId}`;
              return (
                <li key={hit.patientId} className="app-patient-search__hit-wrap">
                  <button
                    id={optionId}
                    type="button"
                    role="option"
                    aria-selected={isProfileMatch || isKeyboardActive}
                    aria-posinset={index + 1}
                    aria-setsize={results.length}
                    className={[
                      "app-patient-search__hit",
                      "ui-focusable",
                      isProfileMatch ? "app-patient-search__hit--selected" : null,
                      isKeyboardActive ? "app-patient-search__hit--active" : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onMouseEnter={() => setActiveOptionIndex(index)}
                    onClick={() => selectPatientHit(hit)}
                  >
                    <span className="app-patient-search__hit-main">
                      {hit.chartNumber ? (
                        <span className="app-patient-search__hit-chart">Chart {hit.chartNumber}</span>
                      ) : null}
                      <span className="app-patient-search__hit-name">{hit.displayName}</span>
                    </span>
                    {metaLine ? <span className="app-patient-search__hit-meta">{metaLine}</span> : null}
                    <span className="app-patient-search__hit-chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {cappedList && !searching && !searchError ? (
          <p className="app-patient-search__cap">Showing the first 20 matches. Add more letters or numbers to narrow down.</p>
        ) : null}
      </div>
    ) : null;

  // ---------- Page-mode results panel (search-led workflow) ----------
  const renderPageResultsPanel = () => {
    if (!hasPageSearchActivity) {
      return (
        <ClinicEmptyState
          title={PATIENT_NO_SELECTION_TITLE}
          body={PATIENT_NO_SELECTION_DESCRIPTION}
          className="clinic-patients-results__empty-state"
          actions={
            <ul className="clinic-patients-results__empty-list">
              <li>{PATIENT_PAGE_SEARCH_EXAMPLE}</li>
              <li>{PATIENTS_EMPTY_FOCUS_HINT}</li>
            </ul>
          }
        />
      );
    }

    return (
      <div id={domIds.listbox} className="clinic-patients-results" role="listbox" aria-label="Patient search results">
        {searching ? (
          <EmptyState
            variant="loading"
            title={PATIENT_SEARCH_SEARCHING}
            description="Searching the clinic service…"
          />
        ) : searchError ? (
          <EmptyState
            variant="error"
            title="Search error"
            description={searchError}
            actions={
              showDevDiagnostics && devSchemaHint ? (
                <p className="clinic-patients-results__status" role="note">
                  Response shape mismatch. Check console/tests for safe schema paths.
                </p>
              ) : undefined
            }
          />
        ) : results.length === 0 && lastFinishedQuery === trimmed ? (
          <EmptyState
            variant="empty"
            icon="🔍"
            title="No matching patients"
            description={PATIENT_SEARCH_NO_MATCH}
          />
        ) : (
          <ul className="clinic-patients-results__list">
            {results.map((hit, index) => {
              const pageMeta = formatHitPageMeta(hit);
              const isProfileMatch = selectedPatientId !== null && selectedPatientId === hit.patientId;
              const isKeyboardActive = index === activeOptionIndex;
              const optionId = `${domIds.listbox}-option-${hit.patientId}`;
              return (
                <li key={hit.patientId}>
                  <Card
                    className={[
                      "clinic-list-card",
                      "clinic-patients-result-card",
                      isProfileMatch ? "clinic-patients-result-card--selected" : null,
                      isKeyboardActive ? "clinic-patients-result-card--active" : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <CardBody className="clinic-patients-result-card__body">
                      <div className="clinic-patients-result-card__info">
                        <p className="clinic-patients-result-card__name">{hit.displayName}</p>
                        <div className="clinic-patients-result-card__meta-row">
                          {hit.chartNumber ? (
                            <Badge variant="neutral" semanticLabel={`Chart number ${hit.chartNumber}`}>
                              {hit.chartNumber}
                            </Badge>
                          ) : null}
                          {hit.patientId ? (
                            <span className="clinic-patients-result-card__patient-id">
                              {pageMeta}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="clinic-patients-result-card__actions">
                        <Button
                          id={optionId}
                          type="button"
                          variant="primary"
                          className="ui-focusable clinic-patients-result-card__open"
                          role="option"
                          aria-selected={isProfileMatch || isKeyboardActive}
                          aria-posinset={index + 1}
                          aria-setsize={results.length}
                          onMouseEnter={() => setActiveOptionIndex(index)}
                          onClick={() => selectPatientHit(hit)}
                        >
                          {PATIENTS_OPEN_WORKSPACE_LABEL}
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
        {cappedList && !searching && !searchError && results.length > 0 ? (
          <p className="clinic-patients-results__cap" role="note">
            Showing the first 20 matches. Add more letters or numbers to narrow down.
          </p>
        ) : null}
      </div>
    );
  };

  // ---------- Recent patients aside (page mode) ----------
  const renderPageRecentPanel = () => (
    <ClinicPanel title={PATIENT_RECENT_SESSION_TITLE} testId="patients-page-recent">
      <p className="clinic-patients-aside-copy">{PATIENTS_RECENT_SESSION_HINT_SHORT}</p>
      {recentPatients.length > 0 && onRecentPatientSelect ? (
        <div className="clinic-patients-recent-quick-row">
          {recentPatients.map((entry) => {
            const isProfileMatch = selectedPatientId !== null && selectedPatientId === entry.patientId;
            return (
              <div
                key={entry.patientId}
                role="button"
                tabIndex={0}
                className={[
                  "clinic-patients-recent-quick-card",
                  isProfileMatch ? "clinic-patients-recent-quick-card--selected" : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onRecentPatientSelect(entry)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onRecentPatientSelect(entry);
                  }
                }}
              >
                <PatientQuickCard
                  name={entry.displayName}
                  chartNumber={entry.chartNumber ?? `ID ${entry.patientId}`}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="clinic-patients-aside-empty" role="status">
          {PATIENT_RECENT_SESSION_EMPTY}
        </p>
      )}
    </ClinicPanel>
  );

  // ========== PAGE WORKFLOW MODE ==========
  if (isPageWorkflow) {
    return (
      <ClinicPage className="clinic-patients-page" testId="patients-page">
        <ClinicPageHero
          title={pageTitle}
          subtitle={pageSubtitle}
          meta={<Badge variant="readonly" semanticLabel="Read-only mode">{READ_ONLY_MODE_LABEL}</Badge>}
        />
        <div className="clinic-workspace-grid clinic-patients-workspace">
          {/* Left column: search + results */}
          <div className="clinic-col-7 clinic-workspace-grid__stack">
            <ClinicPanel title={PATIENT_PAGE_SEARCH_TITLE} className="clinic-patients-search-panel">
              <div ref={rootRef} className={rootClassName}>
                {searchControls}
              </div>
            </ClinicPanel>
            <ClinicPanel title={PATIENTS_PAGE_RESULTS_TITLE} className="clinic-patients-results-panel">
              {renderPageResultsPanel()}
            </ClinicPanel>
          </div>
          {/* Right column: recent patients + what opens next + safety note */}
          <aside className="clinic-col-5 clinic-workspace-grid__stack clinic-patients-aside" aria-label="Patients workflow shortcuts">
            {renderPageRecentPanel()}
            <ClinicPanel title={PATIENTS_OPENS_NEXT_TITLE} className="clinic-patients-opens-panel">
              <ul className="clinic-patients-aside-list">
                {PATIENTS_OPENS_NEXT_BULLETS.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </ClinicPanel>
            <ClinicPanel title={PATIENTS_SAFETY_NOTE_TITLE} className="clinic-patients-safety-panel">
              <p className="clinic-patients-aside-copy clinic-patients-aside-copy--safety">{PATIENTS_SAFETY_NOTE_LINE}</p>
            </ClinicPanel>
          </aside>
        </div>
      </ClinicPage>
    );
  }

  // ========== TOPBAR / INLINE MODE ==========
  const searchBody = (
    <div ref={rootRef} className={rootClassName}>
      {searchControls}
      {showRecentSession ? (
        <div className="app-patient-search__recent" data-testid="patient-search-recent">
          <p className="app-patient-search__recent-title">{PATIENT_RECENT_SESSION_TITLE}</p>
          <p className="app-patient-search__recent-hint">{PATIENT_RECENT_SESSION_HINT}</p>
          <ul className="app-patient-search__recent-list" aria-label={PATIENT_RECENT_SESSION_TITLE}>
            {recentPatients.map((entry) => {
              const isProfileMatch = selectedPatientId !== null && selectedPatientId === entry.patientId;
              const recentIndex = recentPatients.indexOf(entry);
              return (
                <li key={entry.patientId} className="app-patient-search__recent-wrap">
                  <button
                    type="button"
                    ref={(el) => {
                      recentButtonRefs.current[recentIndex] = el;
                    }}
                    className={[
                      "app-patient-search__recent-btn",
                      "app-patient-search__recent-card",
                      "ui-focusable",
                      isProfileMatch ? "app-patient-search__recent-btn--selected" : null,
                      activeRecentIndex === recentIndex ? "app-patient-search__recent-btn--focused" : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => onRecentPatientSelect?.(entry)}
                    onKeyDown={(e) => onRecentKeyDown(e, recentIndex)}
                  >
                    {entry.chartNumber?.trim() ? (
                      <span className="app-patient-search__recent-chart">Chart {entry.chartNumber.trim()}</span>
                    ) : (
                      <span className="app-patient-search__recent-chart app-patient-search__recent-chart--record">
                        Record
                      </span>
                    )}
                    <span className="app-patient-search__recent-name">{entry.displayName}</span>
                    {!entry.chartNumber?.trim() ? (
                      <span className="app-patient-search__recent-meta">{formatSessionRecentPatientMeta(entry)}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {renderDropdownResults()}
    </div>
  );

  if (instanceId === "page") {
    return <div className="app-patients-search-hero">{searchBody}</div>;
  }

  return searchBody;
}
