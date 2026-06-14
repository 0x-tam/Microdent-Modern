# Phase 3 — Sandbox QA runner (`pnpm qa:sandbox`)

**Purpose:** One repeatable command that runs all **four** sandbox write workflows (status, time move, create, demographics) against a **disposable** write sandbox, using a **stable** bridge process (built `dist/server.js`, not `tsx watch`).

**Related:** [phase-3-write-safe-qa-checklist.md](./phase-3-write-safe-qa-checklist.md), [phase-3-sandbox-validation.md](./phase-3-sandbox-validation.md), [phase-3-backup-cli.md](./phase-3-backup-cli.md), [phase-3-restore-cli.md](./phase-3-restore-cli.md).

**Implementation:**

| Script | Role |
| --- | --- |
| [`scripts/qa-sandbox-run.mjs`](../scripts/qa-sandbox-run.mjs) | Cross-platform Node orchestrator: build bridge, start `node services/bridge/dist/server.js`, poll readiness, run four workflows, restore, and stop bridge |
| [`scripts/qa-sandbox-run.sh`](../scripts/qa-sandbox-run.sh) | Bash fallback for macOS/Git Bash comparison runs |
| [`scripts/qa-sandbox-write-smoke.sh`](../scripts/qa-sandbox-write-smoke.sh) | Manual bash smoke fallback: dry-run → **`node dist/cli/legacy-backup.js`** → commit → **`node dist/cli/legacy-restore.js`** → hash revert |
| [`scripts/qa-sandbox-preflight.sh`](../scripts/qa-sandbox-preflight.sh) | Bash preflight fallback; the Node orchestrator performs equivalent checks internally |

Vitest band (`pnpm sandbox:validate`) remains the fast, synthetic CI check; this runner is for **operator sandbox** sign-off after mirror import.

---

## Hard rules

| Rule | Requirement |
| --- | --- |
| **Never touch** | Production `Microdent-Legacy` |
| **Writable target only** | `Microdent-Write-Sandbox/DATA` with `.microdent-write-sandbox.json` |
| **No PHI in stdout** | HTTP codes, `workflow`, `operationId`, `committed`, hash **prefixes**, backup **basenames** only |
| **No new write routes** | Uses existing four HTTP workflows only |

---

## Prerequisites

1. **Node 22.5+** — `nvm use 22`
2. **Disposable sandbox** — `DATA_ROOT` under `Microdent-Write-Sandbox/DATA`, marker present
3. **Mirror sqlite** — `SQLITE_PATH` pointing at a mirror with at least one `appointments` and `patients` row (run `pnpm mirror:import-safe` if needed)
4. **Backup dir** — `BACKUP_DIR` (default: `…/Microdent-Write-Sandbox/backups`)

---

## Environment

| Variable | Required | Default |
| --- | --- | --- |
| `DATA_ROOT` | Yes | — |
| `SQLITE_PATH` | Yes | — |
| `BRIDGE_URL` | No | `http://127.0.0.1:17890` |
| `BACKUP_DIR` | No | Parent of `DATA_ROOT` + `/backups` |
| `WRITE_MODE` | No (orchestrator) | `enabled` |
| `ALLOW_LEGACY_WRITES` | No (orchestrator) | `I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY` |
| `BRIDGE_PORT` | No | `17890` |

The orchestrator exports write env to the bridge child process. Do not use `pnpm dev:bridge` for this run — hot reload can interrupt backup/commit proof.

---

## Command

```bash
export DATA_ROOT="/absolute/path/to/Microdent-Write-Sandbox/DATA"
export SQLITE_PATH="/absolute/path/to/MICRODENT_MIRROR_SANDBOX.sqlite"
export BACKUP_DIR="/absolute/path/to/Microdent-Write-Sandbox/backups"   # optional
export QA_SANDBOX_EVIDENCE_SUMMARY="qa-runs/YYYY-MM-DD-sandbox-write-summary-CLINIC-PC-01.json"   # optional, PHI-safe

cd /path/to/Microdent-Modern
nvm use 22
pnpm qa:sandbox
```

**Pass:** exit code `0`; log ends with `qa:sandbox complete` and `qa-sandbox-write-smoke complete (4 workflows)`.

When `QA_SANDBOX_EVIDENCE_SUMMARY` is set, the Node runner writes a PHI-safe JSON summary containing only runtime metadata, workflow names, HTTP statuses, operation IDs, backup basenames, and DBF readback/restore booleans. It intentionally excludes raw paths, DBF rows, patient names, chart numbers, phone numbers, and screenshots. Use it to transcribe `EXEC-12` and `EXEC-13` evidence later; it does not replace real Windows package verification or sandbox-signoff field evidence.

**Fail:** non-zero exit; check last `workflow=… phase=… http=…` line. HTTP **409** / **400** / **403** are **not** retried as successes.

### Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `listen EPERM` under `tsx-*/` when smoke runs `pnpm legacy:backup` | **tsx** uses a Unix domain socket (IPC) for its runner; some CI/agent sandboxes block that | Legacy CLIs now run **`node dist/cli/*.js`** after `pnpm --filter @microdent/bridge run build`. Re-run `pnpm qa:sandbox` in a normal terminal (not a restricted sandbox). |
| `Cannot find module` / missing `dist/cli` | Bridge not built | `pnpm qa:sandbox` builds contracts and bridge before starting the smoke; if running CLIs manually, run `pnpm --filter @microdent/bridge run build` first. |
| Cursor agent / sandbox QA fails on backup | Environment limitation, not write logic | Run the **local command block** above on your Mac with Node 22; requires writable `BACKUP_DIR` under `Microdent-Write-Sandbox`. |

---

## What each workflow does

| # | Workflow | Route | Hash target |
| --- | --- | --- | --- |
| 1 | `appointment.statusUpdate` | `PATCH /v1/schedule/appointments/:id/status` | `SCHEDULE.DBF` |
| 2 | `appointment.timeMove` | `PATCH …/time` (conflict-free slot via dry-run discovery) | `SCHEDULE.DBF` |
| 3 | `appointment.create` | `POST /v1/schedule/appointments` | `SCHEDULE.DBF` |
| 4 | `patient.demographics.update` | `PATCH /v1/patients/:id/demographics` | `PATIENT.DBF` |

Per workflow:

1. **Dry-run** — `X-Write-Intent: dry-run`; expect **200**, `committed: false`, hash unchanged
2. **Backup CLI** — `WORKFLOW` set; log backup folder **basename** only
3. **Commit** — `X-Write-Intent: commit`; expect **200**, `committed: true`, hash changed
4. **Restore CLI** — hash reverts to baseline
5. **DBF readback** — `node dist/cli/qa-sandbox-readback.js` reads **`SCHEDULE.DBF` / `PATIENT.DBF`** under `DATA_ROOT` (source of truth for committed writes)

### DBF readback vs SQLite mirror

| Layer | Role in sandbox QA |
| --- | --- |
| **DBF under `DATA_ROOT`** | **Write proof** — post-commit fields are read directly from `SCHEDULE.DBF` / `PATIENT.DBF` via the readback CLI |
| **`SQLITE_PATH` mirror** | Fixture ids, sparse dates, optional **audit** SQL (`write_audit_log`) — **not** refreshed on commit |
| **Settings mirror card** | Search/schedule freshness — stale mirror does **not** mean DBF writes failed |

Do **not** use mirror `appointments` / `patients` tables to verify sandbox commits; mirror import is a separate operator step (`pnpm mirror:import-safe`).

Response bodies are filtered with:

```text
{operationId, workflow, mode, committed, fieldsChanged, warnings: [{code, severity}]}
```

---

## Readiness polling (orchestrator)

Before smoke:

1. `GET /health` until `ok: true` (up to ~45s)
2. `GET /v1/meta/write-capability` until `writableSandbox: true` and `writeMode: "enabled"`

HTTP retries (max 3, backoff) apply only to transient network errors, not HTTP error statuses.

---

## Audit check (smoke)

When `SQLITE_PATH` is set and the bridge can read it:

- Prefer `GET /v1/meta/write-audit-recent` — logs `operationId`, `workflow`, `terminalStatus` only
- Fallback: `sqlite3` on `write_audit_log` with `operation_id`, `workflow_type`, `status` columns only

---

## Windows

`pnpm qa:sandbox` now uses the cross-platform Node runner. In PowerShell:

```powershell
$env:DATA_ROOT = "C:\Microdent\Write-Sandbox\DATA"
$env:SQLITE_PATH = "C:\Microdent\mirror\MICRODENT_MIRROR.sqlite"
$env:BACKUP_DIR = "C:\Microdent\Write-Sandbox\backups"
$env:WRITE_MODE = "enabled"
$env:ALLOW_LEGACY_WRITES = "I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY"
pnpm qa:sandbox
```

Git Bash is optional for the fallback scripts only.

---

## Bash smoke only (bridge already running)

```bash
export DATA_ROOT=… SQLITE_PATH=… BRIDGE_URL=http://127.0.0.1:17890
bash scripts/qa-sandbox-write-smoke.sh
```

Bridge must already have `WRITE_MODE=enabled`, sandbox ack, and `BACKUP_DIR` configured.

---

## Node runner completion record

**Status:** Implemented. `pnpm qa:sandbox` delegates to [`scripts/qa-sandbox-run.mjs`](../scripts/qa-sandbox-run.mjs) on all platforms.

The historical bash flow remains available as `pnpm qa:sandbox:bash` and `bash scripts/qa-sandbox-write-smoke.sh` for comparison/manual fallback. Non-goals remain unchanged: no new write routes, no live legacy `DATA_ROOT`, no in-app mirror import, no NSIS installer.
