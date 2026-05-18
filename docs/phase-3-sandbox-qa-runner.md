# Phase 3 — Sandbox QA runner (`pnpm qa:sandbox`)

**Purpose:** One repeatable command that runs all **four** sandbox write workflows (status, time move, create, demographics) against a **disposable** write sandbox, using a **stable** bridge process (built `dist/server.js`, not `tsx watch`).

**Related:** [phase-3-write-safe-qa-checklist.md](./phase-3-write-safe-qa-checklist.md), [phase-3-sandbox-validation.md](./phase-3-sandbox-validation.md), [phase-3-backup-cli.md](./phase-3-backup-cli.md), [phase-3-restore-cli.md](./phase-3-restore-cli.md).

**Implementation:**

| Script | Role |
| --- | --- |
| [`scripts/qa-sandbox-run.sh`](../scripts/qa-sandbox-run.sh) | Build bridge, start `node services/bridge/dist/server.js`, poll readiness, invoke smoke, `trap` kill on exit |
| [`scripts/qa-sandbox-write-smoke.sh`](../scripts/qa-sandbox-write-smoke.sh) | Four workflows: dry-run → `pnpm legacy:backup` → commit → `pnpm legacy:restore` → hash revert |

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

The orchestrator exports write env to the bridge child process. Do not use `pnpm dev:bridge` for this run — hot reload can cause transient `curl` empty replies during backup/commit.

---

## Command

```bash
export DATA_ROOT="/absolute/path/to/Microdent-Write-Sandbox/DATA"
export SQLITE_PATH="/absolute/path/to/MICRODENT_MIRROR_SANDBOX.sqlite"
export BACKUP_DIR="/absolute/path/to/Microdent-Write-Sandbox/backups"   # optional

cd /path/to/Microdent-Modern
nvm use 22
pnpm qa:sandbox
```

**Pass:** exit code `0`; log ends with `qa:sandbox complete` and `qa-sandbox-write-smoke complete (4 workflows)`.

**Fail:** non-zero exit; check last `workflow=… phase=… http=…` line. HTTP **409** / **400** / **403** are **not** retried (only transient curl failures: empty reply, connection reset, exit 52).

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
2. **`pnpm legacy:backup`** — `WORKFLOW` set; log backup folder **basename** only
3. **Commit** — `X-Write-Intent: commit`; expect **200**, `committed: true`, hash changed
4. **`pnpm legacy:restore`** — hash reverts to baseline

Response bodies are filtered with:

```text
{operationId, workflow, mode, committed, fieldsChanged, warnings: [{code, severity}]}
```

---

## Readiness polling (orchestrator)

Before smoke:

1. `GET /health` until `ok: true` (up to ~45s)
2. `GET /v1/meta/write-capability` until `writableSandbox: true` and `writeMode: "enabled"`

`curl` GET retries (max 3, backoff) apply only to transient network errors, not HTTP error statuses.

---

## Audit check (smoke)

When `SQLITE_PATH` is set and the bridge can read it:

- Prefer `GET /v1/meta/write-audit-recent` — logs `operationId`, `workflow`, `terminalStatus` only
- Fallback: `sqlite3` on `write_audit_log` with `operation_id`, `workflow_type`, `status` columns only

---

## Windows

This runner is **bash + curl + jq** (macOS-oriented). On Windows, run the same steps manually or wait for a future Node orchestrator (see [phase-3-windows-readiness-audit.md](./phase-3-windows-readiness-audit.md) when available).

---

## Smoke only (bridge already running)

```bash
export DATA_ROOT=… SQLITE_PATH=… BRIDGE_URL=http://127.0.0.1:17890
bash scripts/qa-sandbox-write-smoke.sh
```

Bridge must already have `WRITE_MODE=enabled`, sandbox ack, and `BACKUP_DIR` configured.
