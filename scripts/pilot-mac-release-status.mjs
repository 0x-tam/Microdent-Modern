#!/usr/bin/env node
/**
 * Read-only pilot readiness tier summary (no signoff, no staging).
 * PHI-safe: prints status labels only.
 */
const lines = [
  "",
  "========== Pilot readiness status (3-tier) ==========",
  "Tier 1 — Mac-side release readiness:     Run pnpm pilot:release-signoff for READY",
  "Tier 2 — Windows-test readiness:         READY (field pack docs in staged copy list)",
  "Tier 3 — Windows execution status:       Deferred / Not yet run",
  "Clinic go-live:                          BLOCKED (until tier 3 complete + go/no-go)",
  "",
  "None of the pilot:* commands substitute for Windows field execution.",
  "Schedule clinic PC test: docs/FIELD-TEST-START-HERE.md",
  "Strict Mac gate:       pnpm pilot:release-signoff",
  "Dev iteration:         pnpm pilot:release-check",
  "",
];

for (const line of lines) {
  console.log(line);
}
