# Windows clinic pilot — tester guide

**Audience:** Clinic staff and IT running the pilot without dev context.

**Start here:** [PILOT-START-HERE.md](./PILOT-START-HERE.md) · **Checklist:** [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md)

**Synthetic examples only** — replace placeholders with your disposable sandbox paths. Never use live `Microdent-Legacy` as `DATA_ROOT`.

---

## Before Day 1 — IT verifies the staged package

On the build or handoff machine (developer or IT — not required for clinic staff daily use):

| # | Task | Pass when |
| --- | --- | --- |
| 1 | Build web, bridge, desktop; run `pnpm stage:pilot-release` | `dist/pilot-release/MicrodentModern/` exists |
| 2 | Run `pnpm pilot:verify-release` | Exit 0; no sensitive files in staged tree |
| 3 | Read `MicrodentModern/HANDOFF-README.txt` | Node 22 requirement and install steps understood |
| 4 | Extract `MicrodentModern/` to a writable local folder (e.g. `C:\Microdent\MicrodentModern\`) | Package folder has `app/`, `bridge/`, `web/`, `docs/`, and `DOUBLE-CLICK-WINDOWS-TEST.cmd` |

Details: [windows-pilot-release-layout.md](./windows-pilot-release-layout.md)

---

## Day 1 — Launch, folders, mirror, read-only

| # | Task | Pass when |
| --- | --- | --- |
| 1 | Install Node 22 on clinic PC if not already present | `node -v` shows v22.x |
| 2 | Double-click `DOUBLE-CLICK-WINDOWS-TEST.cmd` from the package root | App or local web preview opens on first run |
| 3 | Complete **folder selection** in setup | Example paths saved (synthetic): |
| | | `DATA_ROOT` → `C:\ClinicData\Microdent-Write-Sandbox\DATA` |
| | | `SQLITE_PATH` → `C:\Users\Public\MicrodentModern\mirror\clinic.sqlite` |
| | | `BACKUP_DIR` → `C:\Users\Public\MicrodentModern\backups` |
| 4 | Main UI opens; open **Settings** | Pilot readiness shows **Connected** |
| 5 | Refresh the local copy from **Settings** | Settings local-copy/import table shows a recent run |
| 6 | Open **Today** | Day list loads from copied data |
| 7 | Open **Patients** → search | Type synthetic id `DEMO-001` or a test name fragment; matches appear; no notes/phones in list |
| 8 | Open **Schedule** | Week/day views load; navigation works |
| 9 | Open a **patient profile** from search | Profile header loads |
| 10 | Click each profile tab | Summary, Appointments, Medical, Treatments, Chart, Ledger preview — each loads or shows clear read-only empty state |
| 11 | Confirm **Settings** checklist | Bridge OK; mirror status understood; `writeMode` = **disabled** |

`writeMode` stays **disabled** on Day 1 — no commit buttons in production build.

**Local-copy refresh (synthetic example):**

Open **Settings → Local copy & import**, click **Refresh local copy**, then click
**Refresh status**. CLI import is support/developer fallback only.

Full steps: [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md)

---

## Day 2 — Sandbox writes (optional, IT present)

Only on a **disposable Write-Sandbox** copy. Four workflows only.

| # | Task | Pass when |
| --- | --- | --- |
| 1 | Confirm `BACKUP_DIR` in setup / Settings | Backup row OK before any commit |
| 2 | Enable write mode + sandbox ack per runbook | Settings shows sandbox ready |
| 3 | Rebuild web with write pilot flag if needed | Schedule/patient write panels visible |
| 4 | **Status update** — change appointment status on a test row | Preview → confirm → feedback shows `operationId` + backup line |
| 5 | **Time move** — move a test appointment slot | Commit succeeds; feedback metadata only (no PHI) |
| 6 | **Create** — add a test appointment row | Commit succeeds; DBF readback OK if running `pnpm qa:sandbox` |
| 7 | **Demographics** — edit allowlisted name fields on test patient | Commit succeeds; blocked fields rejected if attempted |
| 8 | Optional: `pnpm qa:sandbox` with sandbox env | Exit 0; log ends with four workflows complete |

Workflow names: `appointment.statusUpdate`, `appointment.timeMove`, `appointment.create`, `patient.demographics.update`

See [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) — no payments, memos, chart, or ledger writes.

---

## Day 3 — Backup, restore, unsupported features

| # | Task | Pass when |
| --- | --- | --- |
| 1 | Note `operationId` from a Day 2 test commit | Recorded in issue template (synthetic id only) |
| 2 | Confirm write feedback **backup** line | Shows created / not applicable for dry-run |
| 3 | Restore from backup (CLI) on sandbox copy | `pnpm legacy:restore` — sandbox DATA returns to pre-commit state |
| 4 | Re-import mirror if needed | Settings mirror metadata refreshed |
| 5 | Try an **unsupported** action (e.g. payment or memo field in write panel if exposed) | Clear “not available” or blocked-field error — no silent write |
| 6 | Review ledger/chart/medical tabs in profile | Read-only only — no edit controls |

Restore details: [pilot-backup-restore-audit.md](./pilot-backup-restore-audit.md)

---

## Issue report template

Copy into your ticket (**no PHI**):

```text
Pilot build: distribution RC (commit hash from HANDOFF or dev handoff)
Machine: Windows version / Node version
Desktop config: writeMode value only (not full paths in email)

Symptom:
Screen: Today / Patients / Schedule / Profile tab / Settings / write panel

Settings pilot checklist: which rows warn (screenshot OK — no patient names)

Staged package (IT):
- pnpm pilot:verify-release: pass / fail / n/a
- HANDOFF-README.txt reviewed: yes / no

Checkpoint:
- pnpm pilot-checkpoint or release-smoke: pass / fail
- pnpm qa:sandbox: pass / fail / skipped
- operationId (if write): ___________
- audit terminal status: ___________
- workflow: statusUpdate / timeMove / create / demographics

Mirror: stale / partial / failed / OK
Profile tab (if relevant): Summary / Appointments / Medical / Treatments / Chart / Ledger preview
```

Do **not** attach DBF files, patient names, or full `%AppData%` config with real paths in public tickets.

---

## Out of scope (unsupported in this pilot)

| Feature | Status |
| --- | --- |
| Payments / ledger writes | Not available |
| Chart / odontogram writes | Not available |
| Medical summary edits | Not available |
| Memo / comment / free-text writes | Blocked on all routes |
| Local-copy refresh | Settings-first; CLI support fallback only |
| NSIS / MSI installer / code signing | Not in this RC |

Full list: [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) · packaging gaps: [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md)

---

## Quick reference

| Doc | Use when |
| --- | --- |
| [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md) | IT sign-off before clinic handoff |
| [PILOT-START-HERE.md](./PILOT-START-HERE.md) | First link for operators |
| [windows-pilot-data-locations.md](./windows-pilot-data-locations.md) | Where folders live on disk |
| `MicrodentModern/HANDOFF-README.txt` | Staged package install + validation |
