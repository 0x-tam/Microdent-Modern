# Installer deferral decision record

**Date:** 2026-06-06
**Status:** Deferred — portable pilot package remains the current release path

**Related:** [windows-pilot-installer-decision-record.md](./windows-pilot-installer-decision-record.md), [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md), [external-field-blockers-decision-record.md](./external-field-blockers-decision-record.md), [installer-evidence.md](./installer-evidence.md)

## Decision

Do not add NSIS, MSI, `electron-builder`, installer scripts, or installer dependencies in this documentation/privacy slice.

The current pilot continues to ship as the staged portable `MicrodentModern/` tree produced by `pnpm stage:pilot-release` and verified by `pnpm pilot:verify-release` plus `pnpm pilot:verify-manifest`.

## Rationale

| Reason | Detail |
| --- | --- |
| Field proof is missing | Real Windows clinic PC execution remains deferred |
| Privacy boundaries are still being documented | Installer work must preserve install vs `%AppData%` vs clinic-data separation |
| Existing staging is safer for RC | Artifact rules already block clinic data, logs, sqlite, and secrets |
| Signing is unresolved | An unsigned installer is not the desired production outcome |

## Completion evidence required later

| Evidence | Required before reversing this decision |
| --- | --- |
| Windows package and field execution | Validated package verification evidence, completed PHI-safe field evidence referencing `packageVerification.evidencePath`, and go/no-go GO |
| Installer spike plan | Install/uninstall, shortcuts, data-location behavior, and upgrade behavior documented |
| Staged artifact parity | Installer output passes the same sensitive-artifact guardrails |
| Code signing plan | Authenticode certificate and verification process ready |

## Current truth

Installer work is not complete. Clinic go-live remains blocked until package verification evidence, external Windows execution, signing, installer validation, and support readiness are proven.

When a signed installer candidate exists, file PHI-safe evidence with:

```bash
pnpm pilot:installer-packet -- --date YYYY-MM-DD --target nsis
pnpm pilot:signed-artifacts -- qa-runs/YYYY-MM-DD-signed-artifact-evidence.json
pnpm pilot:installer-evidence -- qa-runs/YYYY-MM-DD-installer-evidence.json
```

`pnpm pilot:installer-packet` generates the signing/install/upgrade/uninstall checklist and target evidence paths. It does **not** build an installer, sign artifacts, or make the portable pilot commercially ready.
