# Go-live evidence

**Purpose:** Machine-readable final go/no-go evidence for a limited commercial launch after Windows field, commercial readiness, clinic pilot, and support evidence are filed.

**Schema:** `microdent-go-live-evidence/v1`

**Template:** [TEMPLATE-go-live-evidence.json](../qa-runs/TEMPLATE-go-live-evidence.json)

**Command:**

```bash
pnpm pilot:go-live-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01
pnpm pilot:go-live-evidence -- qa-runs/YYYY-MM-DD-go-live-evidence.json
```

Use `--repo-root <path>` only when validating a go-live report and referenced evidence files from an alternate checkout/evidence bundle.

The checked-in template is expected to return `GO-LIVE EVIDENCE: BLOCKED` until real approval evidence is filed.

The validator loads and checks the referenced package verification, Windows field, clinic pilot, support readiness, and commercial readiness evidence files before it can report `GO-LIVE EVIDENCE: READY`. Use `pnpm pilot:commercial-readiness -- ... --public-key keys/microdent-license-public.pem` and `pnpm pilot:commercial-evidence-status -- --public-key keys/microdent-license-public.pem` for offline license signature verification before the final go-live review.

Run the packet command before final approval review. It prints the field, clinic pilot, support, commercial readiness, and go-live evidence targets, plus the required validator and audit commands. The packet does **not** approve launch. The referenced field evidence must already point to validated package verification evidence through `packageVerification.evidencePath`.

## Required proof

| Field | Requirement |
| --- | --- |
| `outcome` | `go` or `go-limited-sandbox` |
| `evidencePaths.fieldEvidencePath` | Completed Windows field evidence JSON that references validated package proof with `packageVerification.evidencePath` |
| `evidencePaths.commercialReadinessPath` | Completed commercial readiness JSON |
| `evidencePaths.clinicPilotReportPath` | Completed clinic pilot report JSON |
| `evidencePaths.supportEvidencePath` | Completed support readiness evidence JSON |
| `summary.noP0P1Issues` | No unresolved P0/P1 issues |
| `summary.phiObserved` | Must be `false` |
| `approvers` | IT lead, pilot sponsor, and support lead |

## Commercial readiness mapping

`pnpm pilot:commercial-readiness` requires `goLive.goLiveEvidencePath` to point at the completed go-live evidence JSON before commercial readiness can pass.

```json
"goLive": {
  "outcome": "go",
  "goLiveEvidencePath": "qa-runs/YYYY-MM-DD-go-live-evidence.json",
  "approvers": [
    { "role": "IT lead", "name": "Alex Chen", "date": "2026-06-06" },
    { "role": "Pilot sponsor", "name": "Sam Rivera", "date": "2026-06-06" }
  ]
}
```

## Safety rules

- Do not include patient names, screenshots with real patients, DBF rows, raw logs, local paths, or clinic financials.
- This evidence does not replace the Windows field evidence or commercial readiness evidence; it ties their completed non-template reports to the final approval decision.
