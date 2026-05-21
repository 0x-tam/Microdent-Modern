# Pilot backup and restore — operator audit

**Purpose:** Confirm recoverability after sandbox writes without exposing PHI or raw DBF rows.

**Related:** [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md), [write-operation-feedback.ts](../packages/app/src/write-operation-feedback.ts), [scripts/README.md](../scripts/README.md).

---

## Distribution handoff (IT / build machine)

Before clinic PCs receive the staged tree:

1. Run `pnpm pilot:distribution-checkpoint` on the build machine (or `pnpm pilot:release-signoff` when sandbox env is configured).
2. Deliver `dist/pilot-release/MicrodentModern/` with `HANDOFF-README.txt` and `RELEASE-MANIFEST.json` — no `.sqlite`, live DBF, or backups inside the package.
3. Operators start at **`docs/PILOT-HANDOFF-PACK.md`** in the staged package.
4. Operators configure `%AppData%\Microdent\config.json` and disposable clinic paths on the target PC.

Recovery copy in the app (after commits) points to **legacy-restore CLI** on Write-Sandbox only — not production legacy folders.

---

## Packaged pilot — operator recovery

On clinic Windows PCs (after sandbox writes):

| Step | Action | Windows command |
| --- | --- | --- |
| 1 | Note **operation id** and backup line from write feedback (Settings / write panels) | UI metadata only — no paths |
| 2 | Verify backup manifest | `pnpm --filter @microdent/bridge run legacy-backup-verify` |
| 3 | Restore disposable DATA copy | `pnpm --filter @microdent/bridge run legacy-restore` |
| 4 | Re-import mirror if search/schedule must match DBF | `pnpm --filter @microdent/sqlite-mirror run import-safe` |

**Audit scope:** `appointment.statusUpdate` shows the fullest audit detail in write feedback today. Other workflows (`appointment.timeMove`, `appointment.create`, `patient.demographics.update`) show operation id, backup line, restore hint, and terminal status when available — never paths or row bodies.

**PHI-safe feedback lines** (from `write-operation-feedback.ts`): operation id, backup created/not created/skipped, audit entry count and terminal status, restore CLI hint, failed-commit guidance. No `DATA_ROOT`, patient names, phones, or `before`/`after` payloads.

---

## What the UI shows after a commit

After a successful sandbox commit (appointment or demographics), the write panel lists **metadata only**:

| Line | Meaning |
| --- | --- |
| Operation id | Bridge `operationId` for the workflow |
| Backup | Whether a backup was created for this change |
| Audit | Whether the operation appears in recent audit entries and terminal status |
| Restore hint | CLI restore on sandbox only (no paths in UI) |
| Failed commit | Guidance to keep operation id and restore if DBF may have changed |

No paths, patient names, phones, or row bodies appear in these lines. **Status-update** workflows have the fullest audit detail today; other workflows show operation id, backup, and restore hints.

---

## Backup creation

| When | What happens |
| --- | --- |
| Dry-run | Backup line shows not applicable |
| Commit with `BACKUP_DIR` set | Bridge may create a timestamped backup before writing DBF |
| Commit without backup folder | Write blocked when `writeMode=enabled` |

Configure **BACKUP_DIR** in desktop setup or bridge env before enabling commits.

### Backup manifest (basename only)

Backup verify lists **backup ids and table basenames only** — never full filesystem paths or row payloads.

| Field in verify output | Safe to capture in tickets |
| --- | --- |
| Backup id / timestamp label | Yes |
| Table basename (e.g. `SCHEDULE`) | Yes |
| Full `BACKUP_DIR` path | No — use “configured” / “missing” only |
| DBF row contents | Never |

Command: `pnpm --filter @microdent/bridge run legacy-backup-verify` (or root `pnpm legacy:backup-verify` on bash hosts).

---

## Restore (sandbox pilot only)

| Step | Command |
| --- | --- |
| List backups | `pnpm --filter @microdent/bridge run legacy-backup-verify` |
| Restore disposable copy | `pnpm --filter @microdent/bridge run legacy-restore` |

Restore targets **Write-Sandbox DATA only** — never production legacy trees. The in-app restore hint repeats this; UI never shows paths.

After restore, re-run mirror import if search/schedule must match DBF again.

---

## Failed-write playbook (sandbox)

| Symptom | Operator action |
| --- | --- |
| Commit failed / HTTP error | Keep **operation id** from write feedback; note audit terminal status |
| Uncertain whether DBF changed | Run **legacy-restore** on sandbox DATA only, then re-import mirror |
| Backup line said “not created” | Do not assume rollback — verify with backup-verify before restore |
| Restore CLI unavailable | Stop writes; escalate with operation id — no DBF attachments |

---

## QA proof

### Mac sandbox QA (build machine — tier 1 proof)

`pnpm qa:sandbox` on a Mac (or bash host) with a disposable Write-Sandbox runs backup → commit → restore → hash revert per workflow. DBF readback (`source=dbf`) is the write proof — not mirror SQLite queries.

**What this proves:** sandbox write safety, backup/restore CLI, and bridge commit paths on a developer-controlled disposable environment.

**What this does not prove:** real Windows clinic PC paths, desktop first-run setup on Windows, `%AppData%` config, or operator field workflow. Mac sandbox QA is **not** a substitute for Windows field execution.

### Windows field execution (clinic PC — tier 3 proof, deferred until scheduled)

When IT schedules a clinic Windows PC run, operators follow **`docs/FIELD-TEST-START-HERE.md`** in the staged package → execution script → result form → go/no-go checklist.

**What this proves:** packaged portable layout, Windows paths, desktop supervision, and PHI-safe field logging on the target OS.

Until tier 3 is completed with a PHI-safe field log, clinic go-live stays **blocked** — even when Mac signoff and `pnpm qa:sandbox` are green.

| Proof | Command / entry | Tier | Substitutes for Windows field? |
| --- | --- | --- | --- |
| Mac sandbox QA | `pnpm qa:sandbox` | Mac-side release readiness | **No** |
| Mac release signoff | `pnpm pilot:release-signoff` | Mac-side release readiness | **No** |
| Windows field test | `docs/FIELD-TEST-START-HERE.md` on clinic PC | Windows execution | **Yes** (required for go-live) |

---

## Issue report fields (no PHI)

When reporting backup/restore problems, capture:

- Workflow name (`appointment.statusUpdate`, etc.)
- `operationId` from the UI feedback lines
- Audit terminal status (e.g. `committed`, `failed`)
- Whether backup line said created / not created
- HTTP status from bridge (if visible in dev tools)
- Checkpoint script exit code — not raw DBF contents
