# Auto-update deferral decision record

**Date:** 2026-06-06
**Status:** Deferred — no auto-update feed in pilot RC

**Related:** [installer-deferral-decision-record.md](./installer-deferral-decision-record.md), [data-privacy-review.md](./data-privacy-review.md), [windows-pilot-release-notes.md](./windows-pilot-release-notes.md), [auto-update-evidence.md](./auto-update-evidence.md)

## Decision

Do not implement or enable auto-update for the pilot RC.

Updates remain an IT-controlled manual redeploy of a verified staged package.

## Rationale

| Reason | Detail |
| --- | --- |
| Local-only expectation | Update infrastructure would introduce network policy and trust decisions |
| Signing is unresolved | Auto-update requires signed packages and update integrity |
| Installer is deferred | Update behavior depends on final packaging target |
| Clinic support path is immature | Failed updates on clinic PCs require a proven rollback process |

## Completion evidence required later

| Evidence | Required proof |
| --- | --- |
| Channel decision | Manual, internal feed, or hosted feed explicitly chosen |
| Signing | Signed update payloads and verification |
| Rollback | Documented recovery from failed update |
| Windows test | Update install and restart tested on Windows 10 and 11 |
| Privacy review | No PHI or local paths uploaded by update checks |

## Current truth

Auto-update is not complete. The pilot package must not be described as self-updating.

When a signed update channel exists, file PHI-safe evidence with:

```bash
pnpm pilot:auto-update-packet -- --date YYYY-MM-DD --channel internal-signed-feed
pnpm pilot:signed-artifacts -- qa-runs/YYYY-MM-DD-signed-artifact-evidence.json
pnpm pilot:auto-update-evidence -- qa-runs/YYYY-MM-DD-auto-update-evidence.json
```

`pnpm pilot:auto-update-packet` generates the update-channel, signed-payload, update install, rollback, offline recovery, privacy, and operator-notice checklist. It does **not** implement update checks or make the portable pilot self-updating.
