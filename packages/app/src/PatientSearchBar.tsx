import { BridgeClientError, createBridgeClient } from "@microdent/bridge-client";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@microdent/ui";
import type { BridgeHealthPhase } from "./bridge-health.js";

const SEARCH_DEBOUNCE_MS = 300;

export type PatientSearchHit = {
  patientId: string;
  chartNumber: string | null;
  displayName: string;
  phoneMask: string | null;
};

export type PatientSearchBarProps = {
  bridgePhase: BridgeHealthPhase;
  bridgeBaseUrl?: string;
  /** Highlight the row that matches the profile currently shown (controlled from the shell). */
  selectedPatientId?: string | null;
  /** When the user picks a search row, the shell stores `patientId` and may navigate to Patients. */
  onPatientRecordSelect?: (hit: PatientSearchHit) => void;
  /** When the user edits the query, the shell should clear the selected patient id. */
  onPatientSelectionClear?: () => void;
  /**
   * Optional fetch override (tests); production uses the bound global `fetch` from the bridge client.
   */
  fetchImpl?: typeof fetch;
};

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
      return "The clinic service returned data this screen could not read.";
    }
  }
  return "Search could not be completed.";
}

export function PatientSearchBar({
  bridgePhase,
  bridgeBaseUrl,
  selectedPatientId = null,
  onPatientRecordSelect,
  onPatientSelectionClear,
  fetchImpl,
}: PatientSearchBarProps) {
  const base = bridgeBaseUrl?.trim() ?? "";
  const canSearch = Boolean(base) && bridgePhase === "connected";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientSearchHit[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [lastFinishedQuery, setLastFinishedQuery] = useState<string | null>(null);

  const trimmed = query.trim();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  const runSearch = useCallback(
    async (q: string) => {
      if (!canSearch || q.length < 2) {
        return;
      }
      const seq = ++requestSeq.current;
      setSearching(true);
      setSearchError(null);
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
      setLastFinishedQuery(null);
    }
  }, [canSearch]);

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

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        flushAndSearch();
      }
    },
    [flushAndSearch],
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

  const showDropdown =
    canSearch &&
    trimmed.length >= 2 &&
    (searching || searchError !== null || results.length > 0 || (lastFinishedQuery === trimmed && !searching && results.length === 0));

  const cappedList = results.length >= 20;

  return (
    <div className="app-patient-search">
      <label className="app-sr-only" htmlFor="app-patient-search-input">
        Find a patient
      </label>
      <div className="app-patient-search__row">
        <input
          id="app-patient-search-input"
          className="app-topbar-search__input ui-focusable"
          type="search"
          disabled={!canSearch}
          autoComplete="off"
          spellCheck={false}
          placeholder="Find a patient by name or chart number"
          aria-describedby="app-patient-search-hint app-patient-search-status"
          aria-expanded={showDropdown}
          aria-controls="app-patient-search-listbox"
          aria-autocomplete="list"
          role="combobox"
          value={query}
          onChange={(e) => {
            onPatientSelectionClear?.();
            setQuery(e.target.value);
            if (e.target.value.trim().length < 2) {
              setResults([]);
              setSearchError(null);
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
      <p id="app-patient-search-hint" className="app-patient-search__hint">
        {canSearch ? "Uses your copied clinic data. Names and safe hints only." : "Search is off until the clinic service is connected."}
      </p>
      {statusLine ? (
        <p id="app-patient-search-status" className="app-patient-search__status" role="status" aria-live="polite">
          {statusLine}
        </p>
      ) : (
        <p id="app-patient-search-status" className="app-sr-only">
          Ready.
        </p>
      )}

      {showDropdown ? (
        <div id="app-patient-search-listbox" className="app-patient-search__dropdown" role="listbox" aria-label="Patient search results">
          {searching ? (
            <p className="app-patient-search__dropdown-muted" role="status">
              Searching…
            </p>
          ) : searchError ? (
            <p className="app-patient-search__dropdown-error">{searchError}</p>
          ) : results.length === 0 ? (
            <p className="app-patient-search__dropdown-muted">No matches.</p>
          ) : (
            <ul className="app-patient-search__hits">
              {results.map((hit) => {
                const secondary = formatHitSecondary(hit);
                const isSelected = selectedPatientId !== null && selectedPatientId === hit.patientId;
                return (
                  <li key={hit.patientId} className="app-patient-search__hit-wrap">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`app-patient-search__hit ui-focusable${isSelected ? " app-patient-search__hit--selected" : ""}`}
                      onClick={() => onPatientRecordSelect?.(hit)}
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
