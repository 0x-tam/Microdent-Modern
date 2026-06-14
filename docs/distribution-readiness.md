# Distribution readiness

**Purpose:** Evidence requirements for publishing Microdent Modern as a sellable product.

**Status today:** Not ready for public/commercial distribution. Current output is a verified portable pilot package for scheduled Windows field testing.

## Distribution channels

| Channel | When acceptable | Required guardrails |
| --- | --- | --- |
| Direct signed download | First commercial release candidate | Signed installer, manifest/integrity check, release notes, support path |
| Partner/IT handoff | Clinic-specific deployments | Same signed installer and verification evidence |
| Public website | After pilot proof | Marketing claims review, support readiness, security/privacy review |

## Required evidence

| Evidence | Requirement |
| --- | --- |
| Download integrity | Hash manifest or signed installer verification documented |
| Release notes | Scope, unsupported features, known issues, update path |
| Marketing claims review | Claims match real evidence; no “clinic-ready” claim before commercial gate passes |
| Support path | Support KB, triage workflow, and escalation channel published |
| Privacy review | No PHI upload, telemetry, or licensing data flow beyond approved scope |

## Commercial evidence mapping

Set these fields in [TEMPLATE-commercial-readiness-evidence.json](../qa-runs/TEMPLATE-commercial-readiness-evidence.json) only after the matching evidence is complete:

```json
"distribution": {
  "status": "pass",
  "channel": "direct-signed-download",
  "downloadIntegrity": true,
  "releaseNotesReady": true,
  "marketingClaimsReviewed": true,
  "supportPathPublished": true
}
```

## Marketing claim rules

| Allowed before commercial gate | Not allowed before commercial gate |
| --- | --- |
| “Portable Windows pilot package” | “Production-ready” |
| “Local-first modernization app” | “Ready for live clinic deployment” |
| “Sandbox write workflows under controlled pilot” | “Safe live legacy writes” |
| “No cloud dependency in pilot RC” | “Self-updating signed installer” |

## Distribution checklist

Create `qa-runs/YYYY-MM-DD-distribution-readiness.md` from [TEMPLATE-distribution-readiness.md](../qa-runs/TEMPLATE-distribution-readiness.md), then file machine-readable evidence from [distribution-evidence.md](./distribution-evidence.md):

```bash
pnpm pilot:distribution-evidence -- qa-runs/YYYY-MM-DD-distribution-evidence.json
```
