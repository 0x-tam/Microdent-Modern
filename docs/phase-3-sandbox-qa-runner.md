# Phase 3 — Sandbox QA runner (`pnpm qa:sandbox`)

**Purpose:** One repeatable command that runs all **four** sandbox write workflows (status, time move, create, demographics) against a **disposable** write sandbox, using a **stable** bridge process (built `dist/server.js`, not `tsx watch`).

**Related:** [phase-3-write-safe-qa-checklist.md](./phase-3-write-safe-qa-checklist.md), [phase-3-sandbox-validation.md](./phase-3-sandbox-validation.md), [phase-3-backup-cli.md](./phase-3-backup-cli.md), [phase-3-restore-cli.md](./phase-3-restore-cli.md).

**Implementation:**

| Script | Role |
| --- | --- |
| [`scripts/qa-sandbox-run.sh`](../scripts/qa-sandbox-run.sh) | Build bridge, start `node services/bridge/dist/server.js`, poll readiness, invoke smoke, `trap` kill on exit |
| [`scripts/qa-sandbox-write-smoke.sh`](../scripts/qa-sandbox-write-smoke.sh) | Four workflows: dry-run → **`node dist/cli/legacy-backup.js`** → commit → **`node dist/cli/legacy-restore.js`** → hash revert (not `pnpm legacy:*` mid-run) |
| [`scripts/qa-sandbox-preflight.sh`](../scripts/qa-sandbox-preflight.sh) | Env + marker + built `dist/` check (invoked by run script) |

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

### Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `listen EPERM` under `tsx-*/` when smoke runs `pnpm legacy:backup` | **tsx** uses a Unix domain socket (IPC) for its runner; some CI/agent sandboxes block that | Legacy CLIs now run **`node dist/cli/*.js`** after `pnpm --filter @microdent/bridge run build`. Re-run `pnpm qa:sandbox` in a normal terminal (not a restricted sandbox). |
| `Cannot find module` / missing `dist/cli` | Bridge not built | `pnpm --filter @microdent/bridge run build` then retry. `legacy-backup.sh` builds automatically; `qa-sandbox-run.sh` builds before starting the bridge. |
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
2. **`pnpm legacy:backup`** — `WORKFLOW` set; log backup folder **basename** only
3. **Commit** — `X-Write-Intent: commit`; expect **200**, `committed: true`, hash changed
4. **`pnpm legacy:restore`** — hash reverts to baseline
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

---

## Spike — cross-platform `qa-sandbox-run.mjs` (plan only)

**Status:** Not implemented in this batch. Bash runner [`scripts/qa-sandbox-run.sh`](../scripts/qa-sandbox-run.sh) remains the Mac signoff path inside `pnpm pilot:release-signoff`.

**Goal:** A Node orchestrator (`scripts/qa-sandbox-run.mjs`) that replaces bash+curl+jq for Windows field-adjacent QA without changing write semantics.

| Phase | Deliverable | Notes |
| --- | --- | --- |
| **P0 — contract** | Same env as bash runner (`DATA_ROOT`, `SQLITE_PATH`, `BACKUP_DIR`, `BRIDGE_URL`) | Exit codes match today: `0` = pass, non-zero = fail |
| **P1 — lifecycle** | `child_process.spawn` bridge `node services/bridge/dist/server.js`, health poll, invoke smoke subprocess | Reuse [`qa-sandbox-write-smoke.sh`](../scripts/qa-sandbox-write-smoke.sh) initially — no duplicate workflow HTTP |
| **P2 — smoke in Node** | Port curl/jq steps from smoke script to `fetch` + JSON parse | PHI-safe logging only (workflow, http, operationId prefix) |
| **P3 — Windows** | Document PowerShell entry: `node scripts/qa-sandbox-run.mjs` after `pnpm --filter @microdent/bridge run build` | Git Bash optional; aligns with [mac-pilot-qa-runbook.md](./mac-pilot-qa-runbook.md) tier 1 vs tier 3 split |

**Non-goals:** New write routes, live legacy DATA_ROOT, in-app mirror import, NSIS installer.

**Acceptance (when implemented):** `pnpm qa:sandbox` delegates to `.mjs` on all platforms; `pnpm pilot:release-signoff` unchanged behavior; Vitest `sandbox:validate` band still separate fast CI check.

**Tracking:** Listed as “Needs replacement” in [scripts/README.md](../scripts/README.md) until P1 ships.
