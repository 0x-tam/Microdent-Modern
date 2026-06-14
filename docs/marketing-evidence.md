# Marketing evidence

**Purpose:** Machine-readable evidence that sponsor/public-facing claims are approved, PHI-safe, privacy-reviewed, and do not claim commercial go-live readiness before the commercial gate passes.

**Schema:** `microdent-marketing-evidence/v1`

**Template:** [TEMPLATE-marketing-evidence.json](../qa-runs/TEMPLATE-marketing-evidence.json)

**Command:**

```bash
pnpm pilot:commercial-launch-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01
pnpm pilot:marketing-evidence -- qa-runs/YYYY-MM-DD-marketing-evidence.json
```

Use `--repo-root <path>` only when validating marketing evidence from an alternate checkout/evidence bundle.

The checked-in template is expected to return `MARKETING EVIDENCE: BLOCKED` until real marketing evidence is filed.

## Required proof

| Field | Requirement |
| --- | --- |
| `packet.type` | `website`, `pdf`, `sales-packet`, or `sponsor-deck` |
| `packet.evidencePath` | PHI-safe doc or QA record for the reviewed packet |
| `summary.claimsMatchEvidence` | Every claim maps to filed product evidence |
| `summary.unsupportedFeaturesDisclosed` | Installer/update/live-write limitations are visible |
| `summary.privacyClaimsReviewed` | Local-only/no-upload claims match implementation |
| `summary.websiteOrPacketReady` | Sponsor-facing packet is approved |
| `summary.noClinicReadyClaimBeforeGate` | No production/clinic-ready claim before commercial readiness |
| `summary.safeScreenshotsOnly` | Screenshots and demos contain no real patient data |
| `claims[]` | Every claim is approved and points to supporting evidence |
| `approvers` | Includes sponsor and privacy/security review |

## Commercial readiness mapping

`pnpm pilot:commercial-readiness` requires `marketing.marketingEvidencePath` to point at the completed marketing evidence JSON before commercial readiness can pass.

```json
"marketing": {
  "status": "pass",
  "marketingEvidencePath": "qa-runs/YYYY-MM-DD-marketing-evidence.json",
  "claimsMatchEvidence": true,
  "unsupportedFeaturesDisclosed": true,
  "privacyClaimsReviewed": true,
  "websiteOrPacketReady": true,
  "noClinicReadyClaimBeforeGate": true
}
```

## Safety rules

- Do not include real patient screenshots, patient names, chart numbers, phone numbers, clinic financials, local paths, or DBF snippets.
- Before `COMMERCIAL READINESS: READY`, allowed language is limited to pilot/package facts such as “portable Windows pilot package” and “local-first desktop modernization.”
- Claims such as “production-ready,” “clinic-ready,” “go-live ready,” and “safe live legacy writes” must wait for the commercial gate.
