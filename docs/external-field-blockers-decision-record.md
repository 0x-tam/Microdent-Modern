# External field blockers decision record

**Date:** 2026-06-06
**Status:** Deferred — external blockers are recorded, not completed

**Related:** [ROADMAP-CONTINUATION-PLAN.md](./ROADMAP-CONTINUATION-PLAN.md), [windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md), [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md), [windows-pilot-go-no-go-checklist.md](./windows-pilot-go-no-go-checklist.md)

## Decision

Do not mark external field blockers complete from the Mac/dev environment.

The documentation/privacy slice records the blockers and preserves the current roadmap truth: clinic go-live remains blocked until real Windows clinic-machine evidence exists.

## Deferred blockers

| Blocker | Current state | Evidence required |
| --- | --- | --- |
| Windows package verification | Deferred / not yet run | Filed [windows-package-verify-evidence.md](./windows-package-verify-evidence.md) report validated with `pnpm pilot:package-verify-evidence` |
| Windows field execution `EXEC-01` through `EXEC-16` | Deferred / not yet run | Completed field script, screenshots/logs without PHI, signed result form, and field evidence referencing package proof through `packageVerification.evidencePath` |
| Windows 10 and 11 validation | Deferred / not yet run | Test matrix results on Windows 10 and Windows 11 |
| Antivirus and endpoint validation | Deferred / not yet run | IT notes, allowed exclusions, and failure/remediation records |
| Code signing | Deferred | Authenticode certificate and signed artifact verification |
| Signed installer | Deferred | Signed NSIS/MSI or approved installer target with install/uninstall proof |
| Auto-update feed | Deferred | Update-channel decision and working signed update test |
| Real clinic pilot | Deferred | One to three clinic pilot reports and issue triage |

## Rationale

| Reason | Detail |
| --- | --- |
| Evidence must come from clinic-like Windows hardware | macOS build success cannot prove SmartScreen, AV, `%AppData%`, installer, or endpoint behavior |
| PHI-safe field evidence is required | Field notes and attachments must avoid patient data while supporting filed Windows field evidence JSON |
| Commercial readiness is broader than staging | Sellable status requires install, signing, support, and pilot feedback |

## Current truth

Tier 1 Mac-side readiness and tier 2 field-pack readiness can be green while tier 3 Windows execution remains deferred. Do not describe the product as clinic go-live ready until package verification evidence is filed, tier 3 Windows field evidence references it through `packageVerification.evidencePath`, and the filed go/no-go checklist is GO.

Final commercial readiness is checked separately with:

```bash
pnpm pilot:commercial-readiness -- qa-runs/YYYY-MM-DD-commercial-readiness-evidence.json
```

Expected current result: `COMMERCIAL READINESS: BLOCKED` until Windows 10/11, antivirus, signing, installer, auto-update, support, distribution, pricing, marketing, license, go-live, and real pilot evidence are filed.
