# Data privacy review

**Purpose:** Document local-only PHI handling and support boundaries before Windows field use.

**Status:** Pilot review — external Windows field execution is still deferred.

**Related:** [windows-pilot-data-locations.md](./windows-pilot-data-locations.md), [operator-manual.md](./operator-manual.md), [pilot-issue-template.md](./pilot-issue-template.md), [phase-8-log-redaction-review.md](./phase-8-log-redaction-review.md)

---

## Privacy posture

Microdent Modern is designed for **local-only clinic data handling** in the pilot. The staged package does not include clinic DBF files, SQLite local copies, backups, logs, `.env` secrets, or production legacy folders.

Telemetry, crash upload, and support upload are not implemented in this pilot. Operators manually choose what to send to support, and support material must stay PHI-safe.

---

## Data location table

| Data or artifact | Typical location | May contain PHI? | Support handling |
| --- | --- | --- | --- |
| Staged app package | `C:\Microdent\MicrodentModern\` | No | Safe to hash/verify; do not place clinic data here |
| Desktop config | `%AppData%\Microdent\config.json` | Paths may reveal clinic environment | Do not paste full paths in public tickets |
| Copied clinic DBF folder | Operator-selected copied data folder | Yes | Never attach |
| Local-copy SQLite | Operator-selected or derived local-copy path | Yes | Never attach |
| Sandbox backups | Operator-selected backup folder | Yes | Never attach |
| Operator logs | `%AppData%\Microdent\logs\` | Must not contain PHI by design | Export from Settings when requested |
| Crash dumps | `%AppData%\Microdent\crash-dumps\` | Treat as sensitive until reviewed | Do not attach externally unless support explicitly approves secure handling |
| Release manifest | Staged package root | No | Safe to attach |
| QA run notes | Repo `qa-runs/` or internal tracker | Must be PHI-safe | Use result forms and scrub screenshots |

Canonical location detail: [windows-pilot-data-locations.md](./windows-pilot-data-locations.md).

---

## What may contain PHI

Treat these as clinic-sensitive and do not attach to public or external support channels:

| Artifact | Reason |
| --- | --- |
| DBF, FPT, and CDX files | Source clinic records and related memo/index data |
| SQLite local copy | Search and schedule snapshot derived from clinic records |
| Backups | Copies of changed clinic files |
| Screenshots of patient views | May show identifying data |
| Crash dumps | May contain process memory or path context |
| Full config paths | May reveal clinic/user machine details |

---

## What must not contain PHI

These are designed to be support-safe. If a review finds PHI in any of them, treat it as a defect.

| Artifact | Expected content |
| --- | --- |
| Settings support log export | Operational events, status, counts, sanitized errors |
| Release manifest | File names, sizes, hashes, package metadata |
| Pilot issue template | Build, screen, status, operation id, no patient details |
| Field result form | Pass/fail evidence and PHI-safe observations |
| Readiness checklist | Status labels and non-patient diagnostics |

Support-safe does not mean casual. Review exports before sharing outside the clinic.

---

## Support-ticket rules

| Include | Do not include |
| --- | --- |
| Build or package version | Patient names |
| Screen or checklist section | Phone numbers |
| Operation id from write feedback | Appointment comments |
| Support log export from Settings | DBF, FPT, CDX, SQLite, backups |
| Error category or readiness status | Full local paths in public tickets |
| PHI-safe screenshot after review | Screenshots with patient context |

Use [pilot-issue-template.md](./pilot-issue-template.md) for all pilot feedback.

---

## Crash, log, and export behavior

| Behavior | Current state |
| --- | --- |
| Operator logs | PHI-safe rotating operational logs under `%AppData%\Microdent\logs\` |
| Support export | Manual export from Settings; no automatic upload |
| Crash dumps | Local Electron crash dumps; upload disabled |
| Crash metadata preview | Sanitized preview in Settings |
| Bridge stdout/stderr | Raw output is not copied into support logs |
| Release package | Artifact rules block DBF, SQLite, logs, `.env`, scripts, and live data folders |

If a support export fails, ask IT to review `%AppData%\Microdent\` permissions rather than attaching raw app folders.

---

## Backup and local-copy retention

| Artifact | Retention guidance |
| --- | --- |
| Copied clinic data folder | Keep only for the pilot window approved by clinic/IT |
| Local-copy SQLite | Refresh as needed; delete with pilot data when the pilot ends |
| Sandbox backups | Keep until sandbox QA sign-off and restore window close |
| Logs | Keep short operational window unless support asks otherwise |
| Crash dumps | Treat as sensitive; delete after secure review or support closure |

Keep all clinic data, local copy, backups, and logs outside the install folder so app replacement does not mix with clinic records.

---

## Cross-check against Windows data locations

This review aligns with [windows-pilot-data-locations.md](./windows-pilot-data-locations.md):

| Layer | Privacy rule |
| --- | --- |
| Install / staged package | No clinic DBF, SQLite, backups, logs, or secrets |
| `%AppData%\Microdent\` | Config, support logs, and local crash dumps; review before sharing |
| Operator clinic paths | May contain PHI; never attach externally |

Any future installer, telemetry, or upload design must preserve these boundaries and require explicit opt-in before data leaves the clinic machine.
