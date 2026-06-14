# Pricing evidence

**Purpose:** Machine-readable evidence that the commercial pricing model is approved, matches licensing scope, includes support terms, and does not depend on PHI or usage telemetry.

**Schema:** `microdent-pricing-evidence/v1`

**Template:** [TEMPLATE-pricing-evidence.json](../qa-runs/TEMPLATE-pricing-evidence.json)

**Command:**

```bash
pnpm pilot:commercial-launch-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01
pnpm pilot:pricing-evidence -- qa-runs/YYYY-MM-DD-pricing-evidence.json
```

Use `--repo-root <path>` only when validating pricing evidence from an alternate checkout/evidence bundle.

The checked-in template is expected to return `PRICING EVIDENCE: BLOCKED` until real commercial pricing evidence is filed.

## Required proof

| Field | Requirement |
| --- | --- |
| `model` | `per-clinic`, `subscription`, or `tiered` |
| `licenseModel` | Must match the approved offline license model |
| `licenseEvidencePath` | Points to the matching signed offline license evidence |
| `summary.scopeMatchesLicense` | Pricing scope matches license scope |
| `summary.supportTermsDefined` | Support terms are written and approved |
| `summary.noUsageTelemetryDependency` | Pricing does not depend on app usage telemetry |
| `summary.noPhiPricingInputs` | Pricing does not use patient, appointment, schedule, or chart data |
| `summary.renewalTermsDocumented` | Renewal, expiry, and support continuation terms are written |
| `approvers` | Includes sponsor and finance/business owner approval |
| `rows` | Includes all required row IDs with `pass: true` and PHI-safe evidence text |

## Commercial readiness mapping

`pnpm pilot:commercial-readiness` requires `pricing.pricingEvidencePath` to point at the completed pricing evidence JSON before commercial readiness can pass.

```json
"pricing": {
  "status": "pass",
  "model": "per-clinic",
  "pricingEvidencePath": "qa-runs/YYYY-MM-DD-pricing-evidence.json",
  "scopeMatchesLicense": true,
  "supportTermsDefined": true,
  "noUsageTelemetryDependency": true,
  "sponsorApproved": true
}
```

## Safety rules

- Do not include real clinic pricing, patient counts, appointment volume, patient identifiers, DBF paths, local user paths, or screenshots.
- Evidence should reference approved internal records by safe ticket/document ID, not by local filesystem path.
- If a future subscription or tiered model is introduced, file a fresh pricing evidence JSON and re-run commercial readiness.
