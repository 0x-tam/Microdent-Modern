# Marketing readiness

**Purpose:** Prevent public or sponsor-facing claims from outrunning the actual release evidence.

**Status today:** Marketing/public website claims are not approved for commercial launch.

## Claim rules

| Allowed before commercial gate | Requires `COMMERCIAL READINESS: READY` |
| --- | --- |
| “Portable Windows pilot package” | “Production-ready” |
| “Local-first desktop modernization” | “Clinic go-live ready” |
| “No cloud dependency in pilot RC” | “Signed installer with auto-update” |
| “Sandbox write workflows under pilot controls” | “Safe live legacy writes” |

## Required evidence

| Evidence | Requirement |
| --- | --- |
| Claims match evidence | Every claim maps to field/signing/installer/update/pilot evidence |
| Unsupported features disclosed | Installer/update/write-domain limitations are visible |
| Privacy claims reviewed | Local-only and no-upload claims match implementation |
| Website or packet ready | Public page, PDF, or sales packet has sponsor approval |
| No premature clinic-ready claim | “Clinic-ready” waits for commercial gate |

## Machine-readable evidence

Create `qa-runs/YYYY-MM-DD-marketing-evidence.json` from [TEMPLATE-marketing-evidence.json](../qa-runs/TEMPLATE-marketing-evidence.json), then validate it:

```bash
pnpm pilot:marketing-evidence -- qa-runs/YYYY-MM-DD-marketing-evidence.json
```

The command must print `MARKETING EVIDENCE: READY` before `marketing.marketingEvidencePath` can be used in commercial readiness.

## Commercial evidence mapping

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

Create `qa-runs/YYYY-MM-DD-marketing-readiness.md` from [TEMPLATE-marketing-readiness.md](../qa-runs/TEMPLATE-marketing-readiness.md) for the human review record. The JSON evidence file is the machine-readable gate used by `pnpm pilot:commercial-readiness`.
