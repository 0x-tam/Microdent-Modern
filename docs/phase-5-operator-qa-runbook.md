# Phase 5 — Operator QA runbook

**Purpose:** Single index for validating Microdent Modern on a clinic machine or CI host — read-only product smoke, Settings-first local-copy refresh, sandbox writes, backup/restore, and Windows-native steps. Use placeholder paths like `C:\Microdent\...` only; never paste real patient data, chart numbers, or production UNC paths into docs or tickets.

**Related:** [phase-6-windows-mvp-operator-guide.md](./phase-6-windows-mvp-operator-guide.md) (**Windows MVP — start here**), [phase-3-windows-readiness-audit.md](./phase-3-windows-readiness-audit.md) (script classification source), [phase-3-sandbox-qa-runner.md](./phase-3-sandbox-qa-runner.md) (orchestrator detail), [phase-4-windows-operator-quickstart.md](./phase-4-windows-operator-quickstart.md), [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md), [scripts/README.md](../scripts/README.md).

---

## Quick path (recommended order)

| # | Track | Pass signal |
| --- | --- | --- |
| 1 | [Read-only smoke](#1-read-only-smoke) | `pnpm test` + `pnpm build:web` green; optional manual HTTP |
| 2 | [Local-copy refresh QA](#2-local-copy-refresh-qa) | Settings local-copy/import table shows a recent successful run |
| 3 | [Sandbox write QA](#3-sandbox-write-qa) | `pnpm qa:sandbox` exit 0 on Node 22; manual fallback available in [Windows operator QA](#5-windows-operator-qa) |
| 4 | [Restore QA](#4-restore-qa) | Covered inside sandbox smoke; optional standalone `legacy-restore` drill |
| 5 | [Windows operator QA](#5-windows-operator-qa) | Desktop config, Node CLIs, manual HTTP when bash unavailable |

**Legacy CLIs:** Always use compiled **`node dist/cli/*.js`** — not `tsx`. Manual operator steps: `pnpm --filter @microdent/bridge run legacy-*` (see [services/bridge/package.json](../services/bridge/package.json)). Root `pnpm legacy:*` bash wrappers are convenience aliases on macOS only.

**Sandbox smoke (important):** [`qa-sandbox-run.mjs`](../scripts/qa-sandbox-run.mjs) calls backup/restore **directly** as `node dist/cli/legacy-backup.js` and `node dist/cli/legacy-restore.js` — it does **not** invoke `pnpm legacy:backup` or `pnpm legacy:restore` mid-run (avoids extra shell/build churn and `tsx` IPC). The bash fallback remains available as `pnpm qa:sandbox:bash`.

---

## 1. Read-only smoke

### Automated (CI / developer)

From repo root with **Node 22** recommended:

```bash
cd C:\Microdent\Microdent-Modern   # or your clone path
nvm use 22                          # macOS/Linux; on Windows use installed Node 22
pnpm test
pnpm build:web
```

| Band | Command | What it proves |
| --- | --- | --- |
| Full monorepo | `pnpm test` | Contracts, bridge, mirror, bridge-client, ui, app Vitest bands |
| Web production bundle | `pnpm build:web` | Vite build for `@microdent/web` |
| Fast sandbox rules only | `pnpm sandbox:validate` | Synthetic sandbox guard band (no live HTTP) |
| App read-only flow only | `pnpm --filter @microdent/app exec vitest run read-only-flow-smoke` | Mocked fetch smoke — bridge → search → profile tabs → schedule |

Details: [phase-1b-read-only-smoke-tests.md](./phase-1b-read-only-smoke-tests.md).

### Manual HTTP checklist (live bridge, read-only)

Use a **read-only** `DATA_ROOT` copy or fixtures — not the disposable write sandbox unless you intend write QA later.

| Step | Request | Pass |
| --- | --- | --- |
| Health | `GET http://127.0.0.1:17890/health` | `"ok": true` |
| Write capability (read-only) | `GET /v1/meta/write-capability` | `writeMode` matches config; `writableSandbox: false` when writes disabled |
| Mirror status | `GET /v1/mirror/status` | JSON with `sqliteConfigured` / import metadata — no row payloads |
| Patient search | `GET /v1/patients/search?q=…` | Safe list fields only in UI when exercised via app |
| Schedule | `GET /v1/schedule/...` (via app) | Rooms/appointments load; no forbidden field labels in DOM |

Full browser steps: [phase-1b-manual-qa-checklist.md](./phase-1b-manual-qa-checklist.md). Log **pass/fail** and HTTP status codes only — not response bodies with names or phones.

---

## 2. Local-copy refresh QA

Local-copy refresh is Settings-first. The CLI import flow in
[phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md) is
support/developer fallback only.

### Operator path

Use **Settings → Local copy & import → Refresh local copy**, then **Refresh
status**. Keep `pnpm mirror:import-safe` documented only as a clearly labeled
support/developer fallback.

### Pass criteria

| Check | Expected |
| --- | --- |
| Settings result | Recent successful local-copy/import run |
| Output | Table **counts** and status tokens only — no patient names or DBF row dumps |
| UI (optional) | Settings → Mirror → **Refresh status** shows recent `finishedAt` and `sqliteUsable` |
| Stale warning | Imports older than ~48h may warn — re-run CLI when schedule/search must be fresh |

**UNC paths:** Prefer drive-letter paths (`C:\Microdent\...`). If you must use UNC, test import and bridge read separately; quote paths in PowerShell.

---

## 3. Sandbox write QA

Full orchestrator: [phase-3-sandbox-qa-runner.md](./phase-3-sandbox-qa-runner.md).

### Prerequisites

| Item | Requirement |
| --- | --- |
| Node | 22.x |
| `DATA_ROOT` | `C:\Microdent\Write-Sandbox\DATA` (or equivalent) with `.microdent-write-sandbox.json` (`disposable: true`) |
| `SQLITE_PATH` | Mirror sqlite with at least one `appointments` and `patients` row |
| `BACKUP_DIR` | e.g. `C:\Microdent\Write-Sandbox\backups` |
| Never | Production `Microdent-Legacy` or live FoxPro share |

### Environment block

**macOS / Git Bash:**

```bash
export DATA_ROOT="/path/to/Microdent-Write-Sandbox/DATA"
export SQLITE_PATH="/path/to/MICRODENT_MIRROR.sqlite"
export BACKUP_DIR="/path/to/Microdent-Write-Sandbox/backups"
export WRITE_MODE="enabled"
export ALLOW_LEGACY_WRITES="I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY"
cd /path/to/Microdent-Modern
nvm use 22
pnpm qa:sandbox
```

**PowerShell (native full run):**

```powershell
$env:DATA_ROOT = "C:\Microdent\Write-Sandbox\DATA"
$env:SQLITE_PATH = "C:\Microdent\mirror\MICRODENT_MIRROR.sqlite"
$env:BACKUP_DIR = "C:\Microdent\Write-Sandbox\backups"
$env:WRITE_MODE = "enabled"
$env:ALLOW_LEGACY_WRITES = "I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY"
pnpm qa:sandbox
```

### Pass criteria

| Signal | Meaning |
| --- | --- |
| Exit code `0` | Success |
| Log tail | `qa:sandbox complete` and `qa-sandbox-write-smoke complete (4 workflows)` |
| Workflows | `appointment.statusUpdate`, `appointment.timeMove`, `appointment.create`, `patient.demographics.update` — each: dry-run → backup → commit → restore |
| Logs | `operationId`, `workflow`, `committed`, hash **prefixes**, backup **basenames** only — no PHI |

### Legacy CLI path (no tsx in QA)

| Step | Implementation |
| --- | --- |
| Orchestrator starts bridge | `node services/bridge/dist/server.js` (not `tsx watch`) |
| Orchestrator build | `qa-sandbox-run.mjs` runs contracts + bridge build once before bridge + smoke |
| Smoke backup/restore | **Direct:** `node dist/cli/legacy-backup.js` and `node dist/cli/legacy-restore.js` with env inherited — **not** `pnpm legacy:backup` mid-smoke |
| Manual / Windows steps | `pnpm --filter @microdent/bridge run legacy-backup` / `legacy-restore` → same **`node dist/cli/*.js`** entrypoints |

If backup fails with `listen EPERM` under `tsx-*`, a path is still invoking **tsx** — rebuild bridge and confirm smoke/orchestrator use **`node dist/*`** only ([services/bridge/package.json](../services/bridge/package.json)).

### Preflight (before long run)

`qa-sandbox-run.mjs` performs preflight internally. The bash fallback calls [`qa-sandbox-preflight.sh`](../scripts/qa-sandbox-preflight.sh). To check manually:

```bash
export DATA_ROOT="…/Microdent-Write-Sandbox/DATA"
export SQLITE_PATH="…/MICRODENT_MIRROR.sqlite"
bash scripts/qa-sandbox-preflight.sh
```

Confirms sandbox marker, mirror sqlite file, and `dist/server.js` + `dist/cli/legacy-*.js` after build.

### Vitest band (fast, no HTTP)

```bash
pnpm sandbox:validate
```

Use for CI; use `pnpm qa:sandbox` for operator sign-off after local-copy refresh.

---

## 4. Restore QA

Restore is exercised **inside** sandbox write smoke (per-workflow hash revert). Standalone drill documents: [phase-3-restore-cli.md](./phase-3-restore-cli.md), [phase-3-backup-cli.md](./phase-3-backup-cli.md).

### Standalone restore (Windows-native)

After a backup folder exists (from smoke or manual backup):

```powershell
$env:DATA_ROOT = "C:\Microdent\Write-Sandbox\DATA"
$env:BACKUP_MANIFEST = "C:\Microdent\Write-Sandbox\backups\20260518T120000Z__appointment.statusUpdate__example"
pnpm --filter @microdent/contracts run build
pnpm --filter @microdent/bridge run build
pnpm --filter @microdent/bridge run legacy-restore
```

Runs **`node dist/cli/legacy-restore.js`**. Stdout: file `status`, `size`, `sha256` only.

### Pass criteria

| Check | Expected |
| --- | --- |
| Preflight failure | No partial copy — sandbox unchanged |
| Success | All manifest files restored; hashes match manifest |
| `DATA_ROOT` | Disposable sandbox with marker only |

Optional verify: `pnpm --filter @microdent/bridge run legacy-backup-verify` with `BACKUP_MANIFEST` set.

---

## 5. Windows operator QA

Use when you need to inspect or reproduce the automated Node flow step by step. Full deploy flow: [phase-4-windows-operator-quickstart.md](./phase-4-windows-operator-quickstart.md).

### Desktop and config

| Item | Location |
| --- | --- |
| Config | `%AppData%\Microdent\config.json` |
| Example `dataRoot` | `C:\Microdent\Write-Sandbox\DATA` |
| Example `sqlitePath` | `C:\Microdent\mirror\MICRODENT_MIRROR.sqlite` |
| Example `backupDir` | `C:\Microdent\Write-Sandbox\backups` |
| Bridge spawn | `node services\bridge\dist\server.js` only — no FoxPro `.exe` |

First-run setup appears when paths are missing. Default `writeMode` is `disabled`.

### Manual sandbox QA fallback

| Step | Action |
| --- | --- |
| 1 | `pnpm --filter @microdent/contracts run build` and `pnpm --filter @microdent/bridge run build` |
| 2 | Set `DATA_ROOT`, `SQLITE_PATH`, `BACKUP_DIR`, `WRITE_MODE=enabled`, `ALLOW_LEGACY_WRITES=I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY` |
| 3 | Start `node services\bridge\dist\server.js` (stable — not `tsx watch`) |
| 4 | Poll `GET http://127.0.0.1:17890/health` until `ok: true` |
| 5 | Poll `GET /v1/meta/write-capability` until `writableSandbox: true` and `writeMode: "enabled"` |
| 6 | Four workflows: dry-run → `pnpm --filter @microdent/bridge run legacy-backup` → commit → `legacy-restore` per [phase-3-sandbox-qa-runner.md](./phase-3-sandbox-qa-runner.md) |
| 7 | Optional: `GET /v1/meta/write-audit-recent` — log `operationId`, `workflow`, `terminalStatus` only |

**Git Bash fallback:** You may run `pnpm qa:sandbox:bash` or `bash scripts/qa-sandbox-write-smoke.sh` if `curl`, `jq`, and `realpath` are installed.

### UI pilot check (optional)

Set `VITE_SANDBOX_WRITE_PILOT=true` for dev/preview builds; confirm Settings cards (bridge, mirror, write mode, sandbox, backup) without raw paths in production UI. Writes remain gated by bridge sandbox marker and ack.

---

## 6. Command classification table

All root **`package.json`** scripts and common operator commands.

| Command | Entry | Classification | Windows production notes |
| --- | --- | --- | --- |
| `pnpm test` | npm workspaces test chain | **Cross-platform Node** | Primary read-only regression |
| `pnpm build:web` | `@microdent/web` build | **Cross-platform Node** | Required before desktop/web deploy |
| `pnpm preview:web` | Vite dev | **Cross-platform Node** | Loopback dev |
| `pnpm dev:ports` | `scripts/dev-ports.sh` | **macOS dev-only** | `lsof` — use Task Manager / `netstat` on Windows |
| `pnpm dev:kill-ports` | `scripts/dev-kill-ports.sh` | **macOS dev-only** | Same |
| `pnpm dev:bridge` | `scripts/dev-bridge.sh` | **macOS dev-only wrapper** | Run `pnpm --filter @microdent/bridge dev` or built `node dist/server.js` |
| `pnpm dev:web` | `scripts/dev-web.sh` | **macOS dev-only wrapper** | Run `pnpm --filter @microdent/web dev` directly |
| `pnpm mirror:import-safe` | `scripts/mirror-import-safe.mjs` | **Support/developer fallback** | Builds contracts/bridge, then runs `pnpm --filter @microdent/sqlite-mirror run import-safe`; normal operators use Settings refresh |
| `pnpm legacy:backup` | `scripts/legacy-command.mjs backup` | **Cross-platform Node wrapper** | Builds contracts/bridge, then `pnpm --filter @microdent/bridge run legacy-backup` → `node dist/cli/legacy-backup.js`; bash fallback: `pnpm legacy:backup:bash` |
| `pnpm legacy:create-sandbox` | `scripts/legacy-command.mjs create-sandbox` | **Cross-platform Node wrapper** | Builds contracts/bridge, then `pnpm --filter @microdent/bridge run legacy-create-sandbox`; bash fallback: `pnpm legacy:create-sandbox:bash` |
| `pnpm legacy:restore` | `scripts/legacy-command.mjs restore` | **Cross-platform Node wrapper** | Builds contracts/bridge, then `pnpm --filter @microdent/bridge run legacy-restore`; bash fallback: `pnpm legacy:restore:bash` |
| `pnpm legacy:backup-verify` | `scripts/legacy-command.mjs backup-verify` | **Cross-platform Node wrapper** | Builds contracts/bridge, then `pnpm --filter @microdent/bridge run legacy-backup-verify`; bash fallback: `pnpm legacy:backup-verify:bash` |
| `pnpm sandbox:validate` | Vitest band | **Cross-platform Node** | Fast sandbox rules |
| `pnpm sandbox:validate:real` | Vitest + env | **Cross-platform Node** | Optional real-path band |
| `pnpm qa:sandbox` | `scripts/qa-sandbox-run.mjs` | **Cross-platform Node** | Native Windows/macOS/Linux sandbox proof |
| `pnpm qa:sandbox:bash` | `scripts/qa-sandbox-run.sh` | **Bash fallback** | Historical macOS/Git Bash orchestrator |
| `bash scripts/qa-sandbox-write-smoke.sh` | smoke only | **Bash fallback** | Bridge must already be up |
| `pnpm --filter @microdent/bridge run build` | tsc | **Cross-platform Node** | Required before `node dist/*` |
| `node services/bridge/dist/server.js` | production bridge | **Windows production-ready** | Set env in PowerShell first |
| `pnpm --filter @microdent/desktop run start` | Electron | **Cross-platform Node** | Windows checklist: [apps/desktop/README.md](../apps/desktop/README.md) |

### Deferred / needs replacement

| Item | Classification | Notes |
| --- | --- | --- |
| `pnpm dev:ports` / `dev:kill-ports` | **Needs replacement** (for Windows dev ergonomics) | Optional; not required for production |
| NSIS / signed installer | **Out of scope** | Unpackaged desktop MVP |

---

## Safety reminders

- Never point `DATA_ROOT` at **`C:\Microdent\Microdent-Legacy`** (or any live FoxPro tree) while legacy still writes — use a copied clinic data folder for read-only local-copy refresh only.
- Writable pilot and `pnpm qa:sandbox` require **`C:\Microdent\Write-Sandbox\DATA`** with `.microdent-write-sandbox.json`.
- Never enable `WRITE_MODE=enabled` or sandbox pilot UI without disposable marker and operator ack.
- **No** payment, ledger, memo, or chart write domains in this MVP — four sandbox workflows only.
- No PHI in stdout, UI plan panels, docs, or screenshots — use workflow codes and metadata only.
- Do not use **`tsx`** for legacy backup/restore in QA paths; use **`node dist/cli/*.js`** after bridge build.
