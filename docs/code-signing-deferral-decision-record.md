# Code-signing deferral decision record

**Date:** 2026-06-06
**Status:** Deferred — no Authenticode certificate or signed binaries in pilot RC

**Related:** [windows-pilot-permission-and-path-risks.md](./windows-pilot-permission-and-path-risks.md), [windows-pilot-pre-installer-checklist.md](./windows-pilot-pre-installer-checklist.md), [installer-deferral-decision-record.md](./installer-deferral-decision-record.md), [signed-artifact-evidence.md](./signed-artifact-evidence.md)

## Decision

Do not claim code signing as complete and do not introduce signing automation in this slice.

Operators and IT should treat SmartScreen prompts as expected for the unsigned pilot RC. Production distribution requires Authenticode signing before commercial use.

## Rationale

| Reason | Detail |
| --- | --- |
| Certificate is external | Certificate purchase and identity validation happen outside the repo |
| Installer path is deferred | Signing scope depends on final packaging target |
| Field validation is missing | Real clinic Windows execution should inform endpoint and AV notes |
| False confidence risk | A signed-looking doc without signed artifacts would mislead IT |

## Completion evidence required later

| Evidence | Required proof |
| --- | --- |
| Certificate | Valid Authenticode certificate and custody process |
| Signed artifacts | Signed app executable and installer package when installer exists |
| Verification | `signtool verify` or equivalent Windows verification record |
| IT notes | SmartScreen and endpoint behavior documented from Windows hardware |

## Current truth

Code signing is not complete. SmartScreen and endpoint validation remain external blockers.

When signed artifacts exist, file PHI-safe evidence with:

```bash
pnpm pilot:signed-artifacts -- qa-runs/YYYY-MM-DD-signed-artifact-evidence.json
```
