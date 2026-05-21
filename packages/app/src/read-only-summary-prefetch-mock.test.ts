import { describe, expect, it } from "vitest";
import {
  isSummaryPrefetchPatientUrl,
  summaryPrefetchFallbackResponse,
  wrapFetchWithSummaryPrefetchFallback,
} from "./read-only-summary-prefetch-mock.js";

describe("read-only-summary-prefetch-mock", () => {
  it("detects summary prefetch patient URLs", () => {
    expect(isSummaryPrefetchPatientUrl("http://127.0.0.1:17890/v1/patients/42/treatments")).toBe(true);
    expect(isSummaryPrefetchPatientUrl("http://127.0.0.1:17890/v1/patients/42/profile")).toBe(false);
  });

  it("returns schema-valid fallback bodies for prefetch endpoints", async () => {
    const treatments = summaryPrefetchFallbackResponse(
      "http://127.0.0.1:17890/v1/patients/42/treatments",
    );
    expect(treatments?.ok).toBe(true);
    const body = await treatments!.json();
    expect(body).toMatchObject({ patientId: "42", treatments: [], truncated: false });
    expect(body.privacyNote).toBeTruthy();
  });

  it("wrapFetchWithSummaryPrefetchFallback serves fallbacks when inner rejects", async () => {
    const fetch = wrapFetchWithSummaryPrefetchFallback(() =>
      Promise.reject(new Error("unhandled")),
    );
    const res = await fetch("http://127.0.0.1:17890/v1/patients/42/chart");
    const body = await res.json();
    expect(body).toMatchObject({ patientId: "42", entries: [] });
  });
});
