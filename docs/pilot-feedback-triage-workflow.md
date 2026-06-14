# Pilot feedback triage workflow

**Purpose:** Convert field feedback into prioritized, PHI-safe engineering work without losing safety context.

**Inputs:**

- [pilot-issue-template.md](./pilot-issue-template.md)
- [windows-pilot-field-result-form.md](./windows-pilot-field-result-form.md)
- [windows-field-evidence-report.md](./windows-field-evidence-report.md)
- [commercial-readiness-evidence.md](./commercial-readiness-evidence.md)

## Daily pilot triage loop

| Step | Owner | Output |
| --- | --- | --- |
| 1. Intake | Support coordinator | Issue logged from template, PHI scan complete |
| 2. Safety classification | IT + release lead | `P0 safety` / `P1 blocker` / `P2 workflow` / `P3 polish` / `Question` |
| 3. Reproduce path | Engineering | Repro notes with sandbox or synthetic data only |
| 4. Decision | Release lead | Fix now, document workaround, defer, or close as expected guardrail |
| 5. Verification | QA / IT | Command, Windows evidence, or doc review recorded |
| 6. Handoff update | Release lead | Runbook/KB/evidence template updated when needed |

## Status values

| Status | Meaning |
| --- | --- |
| `new` | Filed, not yet screened for PHI/scope |
| `needs-redaction` | Contains unsafe detail; do not share beyond IT until fixed |
| `triaged` | Severity/scope assigned |
| `in-progress` | Owner actively working |
| `waiting-field-evidence` | Needs Windows PC retest or screenshot/log summary |
| `waiting-external` | Signing, installer, AV, certificate, or clinic approval dependency |
| `fixed-awaiting-verify` | Patch exists; verifier not yet run |
| `closed-fixed` | Fixed and verified |
| `closed-expected` | Expected unsupported/guardrail behavior |
| `closed-deferred` | Accepted for later commercial phase |

## Safety stop rules

Stop the pilot branch and escalate immediately when:

- PHI appears in a shared ticket, log export, screenshot, or evidence JSON.
- A write is attempted against live `Microdent-Legacy`.
- Any unsupported write domain appears writable.
- A sandbox commit reports success without a backup line or audit id.
- Restore fails after a committed sandbox write.
- Installer/signing/update docs are used to claim a capability not present in the package.

## Fix / defer rubric

| Class | Fix before next field attempt | May defer with note |
| --- | --- | --- |
| Safety or PHI | Always | Never |
| App cannot launch | Always | Never for field-test package |
| Clinic service offline | If reproducible after IT steps | If single endpoint-policy incident with workaround |
| Local copy refresh | If core patients/appointments unavailable | If reference-only table partial and documented |
| Sandbox writes | If sandbox pilot is in scope | If read-only pilot only and sponsor approves |
| Installer/signing/update | Required for commercial launch | Deferred for portable pilot RC |
| Copy/docs confusion | If it caused wrong data path or safety risk | Otherwise next doc batch |

## Required evidence by close type

| Close type | Evidence |
| --- | --- |
| `closed-fixed` | Commit/PR, focused test command, release artifact check if staged docs/runtime affected |
| `closed-expected` | Link to guardrail, unsupported feature list, or deferral decision record |
| `closed-deferred` | Owner phase and blocker named; commercial-readiness template remains blocked |
| `waiting-field-evidence` | Exact `EXEC-*` step and Windows machine class required |

## Weekly pilot rollup

Create a PHI-safe rollup with:

- Count by severity and status.
- Open blockers.
- Repeated symptoms and docs updated.
- Commands run since last package.
- Field evidence JSON status.
- Commercial readiness status, expected `BLOCKED` until external artifacts exist.

Use [TEMPLATE-pilot-feedback-triage.md](../qa-runs/TEMPLATE-pilot-feedback-triage.md).
