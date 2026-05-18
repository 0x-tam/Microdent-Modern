import { BridgeClientError, createBridgeClient, isInvalidBodySchemaMismatch } from "@microdent/bridge-client";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@microdent/ui";
import type { BridgeHealthPhase } from "./bridge-health.js";
import { PATIENT_PAGE_SEARCH_PRIVACY } from "./read-only-ui-copy.js";

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
  /** When the user picks a search row, the shell stores `patientId` and may navigate to Patients. */
  onPatientRecordSelect?: (hit: PatientSearchHit) => void;
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
  onPatientRecordSelect,
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

  const canSelectFirstResult =
    trimmed.length >= 2 &&
    !searching &&
    searchError === null &&
    lastFinishedQuery === trimmed &&
    results.length > 0;

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        clearSearch();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (canSelectFirstResult) {
          selectPatientHit(results[0]);
          return;
        }
        flushAndSearch();
      }
    },
    [canSelectFirstResult, clearSearch, flushAndSearch, results, selectPatientHit],
  );

  const statusLine = useMemo(() => {
    if (!base || bridgePhase === "offline") {
      return "Connect the clinic service to search patients.";
    }
    if (bridgePhase === "checking") {
      return "Waiting for the clinic service…";
    }
    if (!canSearch) {
      return "Connect the clinic service to search patients.";
    }
    if (trimmed.length === 0) {
      return "Type a name or chart number (at least 2 characters).";
    }
    if (trimmed.length < 2) {
      return "Enter at least 2 letters or numbers.";
    }
    if (searching) {
      return "Searching…";
    }
    if (searchError) {
      return searchError;
    }
    if (lastFinishedQuery === trimmed && results.length === 0) {
      return "No patients matched. Try a different spelling or chart number.";
    }
    return null;
  }, [base, bridgePhase, canSearch, trimmed, searching, searchError, lastFinishedQuery, results.length]);

  const hasDropdownContent =
    canSearch &&
    trimmed.length >= 2 &&
    (searching || searchError !== null || results.length > 0 || (lastFinishedQuery === trimmed && !searching && results.length === 0));

  const showDropdown = hasDropdownContent && isResultsPanelOpen;

  const cappedList = results.length >= 20;

  const rootClassName = ["app-patient-search", instanceId === "page" ? "app-patient-search--page" : null, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={rootRef} className={rootClassName}>
      <label className="app-sr-only" htmlFor={domIds.input}>
        Find a patient
      </label>
      <div className="app-patient-search__row">
        <input
          id={domIds.input}
          className={`app-topbar-search__input ui-focusable${instanceId === "page" ? " app-patient-search__input--page" : ""}`}
          type="search"
          disabled={!canSearch}
          autoComplete="off"
          spellCheck={false}
          placeholder="Find a patient by name or chart number"
          aria-describedby={`${domIds.hint} ${domIds.status}`}
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? domIds.listbox : undefined}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-busy={searching}
          role="combobox"
          value={query}
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
            : "Uses your copied clinic data. Names and safe hints only."
          : "Search is off until the clinic service is connected."}
      </p>
      {statusLine ? (
        <p id={domIds.status} className="app-patient-search__status" role="status" aria-live="polite">
          {statusLine}
        </p>
      ) : (
        <p id={domIds.status} className="app-sr-only">
          Ready.
        </p>
      )}

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
            <p className="app-patient-search__dropdown-muted">No matches.</p>
          ) : (
            <ul className="app-patient-search__hits">
              {results.map((hit, index) => {
                const secondary = formatHitSecondary(hit);
                const isSelected = selectedPatientId !== null && selectedPatientId === hit.patientId;
                const optionId = `${domIds.listbox}-option-${hit.patientId}`;
                return (
                  <li key={hit.patientId} className="app-patient-search__hit-wrap">
                    <button
                      id={optionId}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      aria-posinset={index + 1}
                      aria-setsize={results.length}
                      className={`app-patient-search__hit ui-focusable${isSelected ? " app-patient-search__hit--selected" : ""}`}
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
