import { BridgeClientError, createBridgeClient, isInvalidBodySchemaMismatch } from "@microdent/bridge-client";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@microdent/ui";
import type { BridgeHealthPhase } from "./bridge-health.js";
import {
  CLINIC_SERVICE_CHECKING,
  PATIENT_PAGE_SEARCH_PRIVACY,
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
  PATIENT_RECENT_SESSION_HINT,
  PATIENT_RECENT_SESSION_TITLE,
} from "./read-only-ui-copy.js";
import {
  formatSessionRecentPatientMeta,
  type SessionRecentPatient,
} from "./session-recent-patients.js";

const SEARCH_DEBOUNCE_MS = 300;

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

function formatHitSecondary(hit: PatientSearchHit): string | null {
  const parts: string[] = [];
  if (hit.chartNumber) {
    parts.push(`Chart ${hit.chartNumber}`);
  }
  if (hit.phoneMask) {
    parts.push(hit.phoneMask);
  }
  if (!hit.chartNumber && hit.patientId) {
    parts.push(`Record ${hit.patientId}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

export function safePatientSearchError(e: unknown): string {
  if (e instanceof BridgeClientError) {
    if (e.kind === "network") {
      return "Could not reach the clinic service. Check that the bridge is running.";
    }
    if (e.kind === "invalid_argument") {
      return "Enter at least 2 characters to search.";
    }
    if (e.kind === "http") {
      const code = e.apiCode ?? "";
      if (code === "DATA_ROOT_NOT_CONFIGURED" || code === "PATIENT_DBF_NOT_FOUND") {
        return "Patient list is not available on this bridge yet. Ask your administrator to check the data folder.";
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

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientSearchHit[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [devSchemaHint, setDevSchemaHint] = useState(false);
  const [searching, setSearching] = useState(false);
  const [lastFinishedQuery, setLastFinishedQuery] = useState<string | null>(null);
  const [isResultsPanelOpen, setIsResultsPanelOpen] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);

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
      setIsResultsPanelOpen(true);
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
    [base, canSearch, fetchImpl],
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
    if (!isResultsPanelOpen) {
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
  }, [isResultsPanelOpen]);

  const dismissResultsPanel = useCallback(() => {
    setIsResultsPanelOpen(false);
  }, []);

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
      setQuery(hit.displayName);
      setIsResultsPanelOpen(false);
      setActiveOptionIndex(-1);
    },
    [onPatientRecordSelect],
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

  const activeOptionId =
    activeOptionIndex >= 0 && activeOptionIndex < results.length
      ? `${domIds.listbox}-option-${results[activeOptionIndex]?.patientId}`
      : undefined;

  const hasDropdownContent =
    canSearch &&
    trimmed.length >= 2 &&
    (searching ||
      searchError !== null ||
      results.length > 0 ||
      (lastFinishedQuery === trimmed && !searching && results.length === 0));

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (isResultsPanelOpen) {
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
          if (!isResultsPanelOpen) {
            setIsResultsPanelOpen(true);
          }
          setActiveOptionIndex((i) => {
            if (i < 0) return 0;
            return Math.min(i + 1, results.length - 1);
          });
        } else if (hasDropdownContent) {
          setIsResultsPanelOpen(true);
        }
        return;
      }
      if (e.key === "ArrowUp") {
        if (canSelectFromList) {
          e.preventDefault();
          if (!isResultsPanelOpen) {
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
      selectPatientHit,
    ],
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

  const showDropdown = hasDropdownContent && isResultsPanelOpen;

  const cappedList = results.length >= 20;

  const showRecentSession =
    canSearch && trimmed.length < 2 && recentPatients.length > 0 && onRecentPatientSelect !== undefined;

  const rootClassName = ["app-patient-search", instanceId === "page" ? "app-patient-search--page" : null, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={rootRef} className={rootClassName}>
      {showOfflineBanner ? (
        <p className="app-patient-search__offline-banner" role="status">
          {PATIENT_SEARCH_OFFLINE_BANNER}
        </p>
      ) : null}
      <label className="app-patient-search__label" htmlFor={domIds.input}>
        {PATIENT_SEARCH_FIELD_LABEL}
      </label>
      {instanceId === "topbar" && selectedDisplayName?.trim() ? (
        <p className="app-patient-search__selected" role="status">
          {PATIENT_SEARCH_OPEN_RECORD_PREFIX}{" "}
          <span className="app-patient-search__selected-name">{selectedDisplayName.trim()}</span>
        </p>
      ) : null}
      <div className="app-patient-search__row">
        <input
          id={domIds.input}
          className={`app-topbar-search__input ui-focusable${instanceId === "page" ? " app-patient-search__input--page" : ""}`}
          type="search"
          disabled={!canSearch}
          autoComplete="off"
          spellCheck={false}
          placeholder="Name or chart number (2+ characters)"
          aria-describedby={`${domIds.hint} ${domIds.status}`}
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? domIds.listbox : undefined}
          aria-activedescendant={showDropdown && activeOptionId ? activeOptionId : undefined}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-busy={searching}
          role="combobox"
          value={query}
          onFocus={() => {
            if (hasDropdownContent) {
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
            } else if (canSearch) {
              setIsResultsPanelOpen(true);
            }
          }}
          onKeyDown={onKeyDown}
        />
        <Button
          type="button"
          variant="secondary"
          size="compact"
          className="ui-focusable app-patient-search__submit"
          disabled={!canSearch || trimmed.length < 2 || searching}
          onClick={() => flushAndSearch()}
        >
          Search
        </Button>
      </div>
      <p id={domIds.hint} className="app-patient-search__hint">
        {canSearch
          ? instanceId === "page"
            ? PATIENT_PAGE_SEARCH_PRIVACY
            : PATIENT_SEARCH_HINT_CONNECTED
          : PATIENT_SEARCH_HINT_OFFLINE}
      </p>
      {statusMeta ? (
        <p
          id={domIds.status}
          className={`app-patient-search__status app-patient-search__status--${statusMeta.tone}`}
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

      {showRecentSession ? (
        <div className="app-patient-search__recent" data-testid="patient-search-recent">
          <p className="app-patient-search__recent-title">{PATIENT_RECENT_SESSION_TITLE}</p>
          <p className="app-patient-search__recent-hint">{PATIENT_RECENT_SESSION_HINT}</p>
          <ul className="app-patient-search__recent-list" aria-label={PATIENT_RECENT_SESSION_TITLE}>
            {recentPatients.map((entry) => {
              const isProfileMatch = selectedPatientId !== null && selectedPatientId === entry.patientId;
              return (
                <li key={entry.patientId} className="app-patient-search__recent-wrap">
                  <button
                    type="button"
                    className={[
                      "app-patient-search__recent-btn",
                      "ui-focusable",
                      isProfileMatch ? "app-patient-search__recent-btn--selected" : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => onRecentPatientSelect(entry)}
                  >
                    <span className="app-patient-search__recent-name">{entry.displayName}</span>
                    <span className="app-patient-search__recent-meta">
                      {formatSessionRecentPatientMeta(entry)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {showDropdown ? (
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
                const secondary = formatHitSecondary(hit);
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
                      <span className="app-patient-search__hit-name">{hit.displayName}</span>
                      {secondary ? <span className="app-patient-search__hit-meta">{secondary}</span> : null}
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
      ) : null}
    </div>
  );
}
