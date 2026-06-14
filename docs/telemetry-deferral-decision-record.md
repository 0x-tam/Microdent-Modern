# Telemetry deferral decision record

**Date:** 2026-06-06
**Status:** Deferred — telemetry and upload remain off by default and unimplemented

**Related:** [data-privacy-review.md](./data-privacy-review.md), [operator-manual.md](./operator-manual.md), [pilot-issue-template.md](./pilot-issue-template.md)

## Decision

Do not implement telemetry, crash upload, diagnostics upload, or automatic support upload in the pilot RC.

The product remains local-only by default. Operators manually export support material from Settings when support asks for it.

## Rationale

| Reason | Detail |
| --- | --- |
| PHI risk | Upload design must prove no patient data leaves the clinic machine |
| Trust boundary | Clinics need explicit opt-in and preview before any send action |
| Support process | Manual support export is simpler and auditable for field pilot |
| Scope control | Telemetry is not required to complete documentation/privacy readiness |

## Completion evidence required later

| Evidence | Required proof |
| --- | --- |
| Explicit opt-in design | Operator can review and consent before sending |
| Non-PHI schema | Metrics schema excludes patient identifiers, raw paths, records, notes, DBF rows, and screenshots |
| Local preview | Operator can inspect payload before send |
| Retention policy | Storage, access, and deletion process documented |
| Tests | Upload guardrails prove PHI-shaped fields are rejected |

## Current truth

Telemetry is not complete and should be considered out of scope for pilot RC. Support export is manual only.
