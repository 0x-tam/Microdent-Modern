# Pilot backup and restore — operator audit

**Purpose:** Confirm recoverability after sandbox writes without exposing PHI or raw DBF rows.

**Related:** [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md), [write-operation-feedback.ts](../packages/app/src/write-operation-feedback.ts), [scripts/README.md](../scripts/README.md).

---

## Distribution handoff (IT / build machine)

Before clinic PCs receive the staged tree:

1. Run `pnpm pilot:distribution-checkpoint` on the build machine (or equivalent manual steps in [PILOT-START-HERE.md](./PILOT-START-HERE.md)).
2. Deliver `dist/pilot-release/MicrodentModern/` with `HANDOFF-README.txt` — no `.sqlite`, live DBF, or backups inside the package.
3. Operators configure `%AppData%\Microdent\config.json` and disposable clinic paths on the target PC.

Recovery copy in the app (after commits) points to **legacy-restore CLI** on Write-Sandbox only — not production legacy folders.

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

---

## Restore (sandbox only)

| Step | Command |
| --- | --- |
| List backups | `pnpm legacy:backup-verify` or bridge `legacy-backup-verify` |
| Restore disposable copy | `pnpm legacy:restore` with backup id env |

Restore targets **Write-Sandbox DATA only** — never production legacy trees.

After restore, re-run mirror import if search/schedule must match DBF again.

---

## QA proof

`pnpm qa:sandbox` runs backup → commit → restore → hash revert per workflow. DBF readback (`source=dbf`) is the write proof — not mirror SQLite queries.

---

## Issue report fields (no PHI)

When reporting backup/restore problems, capture:

- Workflow name (`appointment.statusUpdate`, etc.)
- `operationId` from the UI feedback lines
- Audit terminal status (e.g. `committed`, `failed`)
- Whether backup line said created / not created
- HTTP status from bridge (if visible in dev tools)
- Checkpoint script exit code — not raw DBF contents
