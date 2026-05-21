/**
 * Valid empty/synthetic responses for Summary-tab prefetch endpoints.
 * Use as fetch fallback so tests that only mock profile do not trigger bridge-client schema warnings.
 */

const DEFAULT_PRIVACY_NOTE =
  "Problem description, allergy free text, and medical notes remain hidden until field mapping is reviewed." as const;

const DEFAULT_TREATMENTS_PRIVACY =
  "Procedure memos, per-line descriptions, fee columns, and raw OPERTBL rows are never exposed by this route." as const;

const DEFAULT_CHART_PRIVACY =
  "Chart memos, layer code legends, clinical labels, and raw CHARTDBF rows are never exposed by this route." as const;

const DEFAULT_LEDGER_PRIVACY =
  "Ledger amounts, memo text, insurance identifiers, plan numbers, and raw TRANS rows are never exposed by this route." as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Paths requested when the Summary tab prefetches domain counts. */
export function isSummaryPrefetchPatientUrl(url: string, patientId = "42"): boolean {
  const base = `/v1/patients/${patientId}/`;
  if (!url.includes(base)) return false;
  return (
    url.includes(`${base}appointments`) ||
    url.includes(`${base}medical-summary`) ||
    url.includes(`${base}treatments`) ||
    url.includes(`${base}chart`) ||
    url.includes(`${base}ledger`)
  );
}

/** Schema-valid fallback body for a summary prefetch URL, or null if not a prefetch path. */
export function summaryPrefetchFallbackResponse(
  url: string,
  patientId = "42",
): Response | null {
  if (!isSummaryPrefetchPatientUrl(url, patientId)) return null;

  if (url.includes(`/v1/patients/${patientId}/appointments`)) {
    return jsonResponse({ appointments: [] });
  }

  if (url.includes(`/v1/patients/${patientId}/medical-summary`)) {
    return jsonResponse({
      patientId,
      hasMedicalRecord: false,
      hasSensitiveMedicalDetails: false,
      lastUpdated: null,
      lastDentalVisit: null,
      flaggedConditionCount: 0,
      conditions: null,
      privacyNote: DEFAULT_PRIVACY_NOTE,
    });
  }

  if (url.includes(`/v1/patients/${patientId}/treatments`)) {
    return jsonResponse({
      patientId,
      treatments: [],
      truncated: false,
      privacyNote: DEFAULT_TREATMENTS_PRIVACY,
    });
  }

  if (url.includes(`/v1/patients/${patientId}/chart`)) {
    return jsonResponse({
      patientId,
      entries: [],
      truncated: false,
      privacyNote: DEFAULT_CHART_PRIVACY,
    });
  }

  if (url.includes(`/v1/patients/${patientId}/ledger`)) {
    return jsonResponse({
      patientId,
      entries: [],
      truncated: false,
      privacyNote: DEFAULT_LEDGER_PRIVACY,
    });
  }

  return null;
}

/**
 * Wraps a test fetch: delegates to inner; on rejection, serves valid summary-prefetch fallbacks.
 */
export function wrapFetchWithSummaryPrefetchFallback(
  inner: (input: RequestInfo | URL) => Promise<Response>,
  patientId = "42",
): (input: RequestInfo | URL) => Promise<Response> {
  return (input) => {
    const url = String(input);
    return inner(input).catch((err: unknown) => {
      const fallback = summaryPrefetchFallbackResponse(url, patientId);
      if (fallback) return Promise.resolve(fallback);
      return Promise.reject(err);
    });
  };
}
