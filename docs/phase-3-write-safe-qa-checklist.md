# Phase 3 — Write-safe QA checklist

**Purpose:** Pre-flight and sign-off checklist for the **first sandbox-only real write** — appointment `STATUS` on disposable `SCHEDULE.DBF`.

**Operator detail:** Step-by-step commands live in [phase-3-appointment-status-write-runbook.md](./phase-3-appointment-status-write-runbook.md).

**Status (2026-05-15):** Steps **1–10** and **13–15** are executable today (dry-run route, backup CLI, manual restore). Steps **11–12** are **blocked** until enabled commit ships (`writesPermitted`, DBF writer, audit-on-commit).

**Related:** [phase-3-disposable-write-sandbox.md](./phase-3-disposable-write-sandbox.md), [phase-3-sandbox-guard.md](./phase-3-sandbox-guard.md), [phase-3-write-mode-config.md](./phase-3-write-mode-config.md), [phase-3-backup-cli.md](./phase-3-backup-cli.md), [phase-3-appointment-status-dry-run.md](./phase-3-appointment-status-dry-run.md), [phase-3-audit-log-schema.md](./phase-3-audit-log-schema.md).

---

## Hard rules (every run)

| Rule | Requirement |
| --- | --- |
| **Never touch** | `/Users/Tamam/Desktop/Microdent/Microdent-Legacy` |
| **Read-only reference** | `/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy` — sandbox source only |
| **Writable target** | `/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA` |
| **Repo** | `/Users/Tamam/Desktop/Microdent/Microdent-Modern` |
| **Privacy** | Pass/fail, HTTP codes, `operationId`, numeric status codes only in shared artifacts |

---

## End-to-end flow (15 steps)

| # | Step | Runbook | Executable today? |
| --- | --- | --- | --- |
| 1 | `nvm use 22` (Node ≥ 22.5) | §1 | **Yes** |
| 2 | `pnpm test` | §2 | **Yes** |
| 3 | `pnpm build:web` | §3 | **Yes** |
| 4 | Create sandbox from Legacy-Copy + marker | §4 | **Yes** |
| 5 | `pnpm mirror:import-safe` if needed | §5 | **Yes** |
| 6 | Start bridge: `DATA_ROOT` = sandbox, `WRITE_MODE=dry-run` | §6 | **Yes** |
| 7 | Call dry-run status route | §7 | **Yes** |
| 8 | Confirm no file mtime/content change | §8 | **Yes** |
| 9 | Run `pnpm legacy:backup` | §9 | **Yes** |
| 10 | Start bridge: `WRITE_MODE=enabled`, `ALLOW_LEGACY_WRITES=I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY` | §10 | **Yes** (diagnostics only) |
| 11 | Call status write route (commit) | §11 | **No** — plan-only; `REAL_WRITE_NOT_IMPLEMENTED` |
| 12 | Verify backup, audit, STATUS, no other fields | §12 | **No** — depends on §11 |
| 13 | Restore from backup | §13 | **Yes** (manual copy) |
| 14 | Verify status reverted | §14 | **Yes** (after deliberate test or post–dry-run rehearsal) |
| 15 | Reset sandbox | §15 | **Yes** |

---

## Checklist detail

### 1–3. Toolchain **(today)**

| Step | Action | Pass |
| --- | --- | --- |
| 1 | `nvm use 22`; `node -v` ≥ 22.5; `pnpm install` | Engine OK |
| 2 | `pnpm test` | All workspace tests green |
| 3 | `pnpm build:web` | Web build succeeds |

### 4–5. Sandbox and mirror **(today)**

| Step | Action | Pass |
| --- | --- | --- |
| 4 | `rsync` Legacy-Copy → `Microdent-Write-Sandbox/DATA`; `.microdent-write-sandbox.json` with `disposable: true` | Marker valid; paths not under Legacy or Legacy-Copy |
| 5 | If mirror/UI needed: `DATA_ROOT` + `SQLITE_PATH` → `pnpm mirror:import-safe` | Counts only on stdout; optional `status_code` query for `APPT_ID` |

### 6–8. Dry-run bridge **(today)**

| Step | Action | Pass |
| --- | --- | --- |
| 6 | `pnpm dev:kill-ports`; `export DATA_ROOT=…/Write-Sandbox/DATA`; `export WRITE_MODE=dry-run`; `pnpm dev:bridge` | `/health` ok; `/debug/status` → `dry-run`, `writesPermitted: false` |
| 7 | `PATCH /v1/schedule/appointments/:id/status` with `{ "status": 0–5 }`, `X-Write-Intent: dry-run` | **200**; `committed: false`; `fieldsChanged` = `STATUS` only |
| 8 | `stat` + `shasum` on `SCHEDULE.DBF` (and sidecars); no new backup dir | Unchanged vs baseline |

### 9. Backup **(today)**

| Step | Action | Pass |
| --- | --- | --- |
| 9 | `BACKUP_DIR`, `WORKFLOW=appointment.statusUpdate`, `pnpm legacy:backup` | Manifest + `files/`; source mtime unchanged; privacy scan clean |

### 10–12. Enabled write **(blocked)**

| Step | Action | Pass (target) |
| --- | --- | --- |
| 10 | `WRITE_MODE=enabled`, `ALLOW_LEGACY_WRITES=I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY`, restart bridge | **Target:** `writesPermitted: true`. **Today:** still `false` |
| 11 | `PATCH` same URL, `X-Write-Intent: commit` | **Target:** **200**, `committed: true`, no `REAL_WRITE_NOT_IMPLEMENTED` |
| 12 | Backup exists; audit row if wired; `STATUS` = `STATUS_AFTER`; `.FPT`/`.CDX` hashes unchanged | All sub-checks pass |

**Do not sign off** steps 11–12 until implementation removes `REAL_WRITE_NOT_IMPLEMENTED` and persists only `SCHEDULE.STATUS`.

### 13–15. Restore and reset **(today)**

| Step | Action | Pass |
| --- | --- | --- |
| 13 | Stop bridge; copy `files/*` from backup folder → `DATA_ROOT` | Live `sha256` matches manifest |
| 14 | Mirror re-import if used; `status_code` = `STATUS_BEFORE` | Reverted |
| 15 | `rm -rf` sandbox DATA/backups/sqlite; re-rsync from Legacy-Copy; recreate marker | Fresh disposable tree |

---

## Privacy checks (all artifacts)

Apply to backup stdout, `manifest.json`, curl/`jq` captures, audit SQL output, and screenshots.

| Check | Pass criterion |
| --- | --- |
| **No `PAT_NAME`** | Absent from shared artifacts |
| **No `TELEPHONE`** | Absent |
| **No `COMMENT`** | Absent |
| **No raw row** | No DBF row maps or `rawRow` |
| **No before/after row values** | No `before`/`after` in plans or audit payloads |
| **No notes** | No memo/clinical note text |

Use runbook `jq` filter; do not paste full `GET /v1/schedule/appointments` responses (may include display names).

---

## Automated regression (before sign-off)

On Node 22.5+, from repo root:

```bash
pnpm test
pnpm --filter @microdent/bridge test src/write-safety/write-safety.test.ts
pnpm --filter @microdent/bridge test src/backup/legacy-backup.test.ts
pnpm --filter @microdent/bridge test src/appointment-status-dry-run.test.ts
pnpm --filter @microdent/bridge test src/config.test.ts
pnpm --filter @microdent/sqlite-mirror test src/write-audit.test.ts
```

| Suite | Covers |
| --- | --- |
| `appointment-status-dry-run` | Dry-run plan, mtime unchanged, no PHI tokens in JSON |
| `write-safety` | Forbidden paths; marker; ack for enabled |
| `legacy-backup` | Synthetic SCHEDULE; manifest hashes |
| `write-audit` | PHI-safe audit payloads |

---

## Sign-off table

Complete after runbook steps. **Pass / Fail / N/A** and initials only — no PHI.

| # | Gate | Pass | Initials | Date |
| --- | --- | --- | --- | --- |
| 1 | Node 22.5+ | | | |
| 2 | `pnpm test` | | | |
| 3 | `pnpm build:web` | | | |
| 4 | Sandbox + marker | | | |
| 5 | Mirror import (or N/A) | | | |
| 6 | Bridge dry-run | | | |
| 7 | Dry-run route | | | |
| 8 | No file change (dry-run) | | | |
| 9 | `legacy:backup` | | | |
| 10 | Enabled env + bridge | | | |
| 11 | Enabled commit | | | |
| 12 | Post-write verification | | | |
| 13 | Restore | | | |
| 14 | Status reverted | | | |
| 15 | Sandbox reset | | | |
| — | Privacy scan | | | |

**Approver (first real write):** __________________ **Date:** __________

**Blockers:** Any **Fail**; steps **11–12** **N/A** without approved follow-up.

---

## Known gaps (coverage)

| Area | Gap | Checklist impact |
| --- | --- | --- |
| **Enabled DBF write** | `writesPermitted()` always `false`; route returns plan with `REAL_WRITE_NOT_IMPLEMENTED` | §11–12 blocked |
| **Audit on commit** | SQLite writers tested; bridge does not append on HTTP commit yet | §12.2 often **N/A** |
| **`legacy:restore`** | Manual `cp` only | §13 documented |
| **`legacy:backup-verify`** | Not shipped | §9 manual `shasum` |
| **Field-level DBF diff** | No operator CLI for row diff without PHI | §12.4 uses sidecar hashes + workflow allowlist |
| **Schedule GET for verify** | Returns patient display fields | Use mirror `status_code` or hashes only |
| **SafeWritePlan envelope** | Route returns plan object directly (not `{ plan }` wrapper) | Runbook `jq` matches wire today |
| **Sandbox PHI on disk** | Copy from Legacy-Copy may contain real PHI | Treat backups as confidential; never export off-machine |

---

## Definition of done (this document)

- [x] `docs/phase-3-write-safe-qa-checklist.md` updated for 15-step flow
- [x] `docs/phase-3-appointment-status-write-runbook.md` created
- [x] No application code changed
- [x] No PHI in document bodies
- [x] No files modified under `Microdent-Legacy` or `Microdent-Legacy-Copy`
