# Phase 5 — Operator QA runbook

**Purpose:** Single index for validating Microdent Modern on a clinic machine or CI host — read-only product smoke, mirror import, sandbox writes, backup/restore, and Windows-native steps. Use placeholder paths like `C:\Microdent\...` only; never paste real patient data, chart numbers, or production UNC paths into docs or tickets.

**Related:** [phase-3-windows-readiness-audit.md](./phase-3-windows-readiness-audit.md) (script classification source), [phase-3-sandbox-qa-runner.md](./phase-3-sandbox-qa-runner.md) (orchestrator detail), [phase-4-windows-operator-quickstart.md](./phase-4-windows-operator-quickstart.md), [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md), [scripts/README.md](../scripts/README.md).

---

## Quick path (recommended order)

| # | Track | Pass signal |
| --- | --- | --- |
| 1 | [Read-only smoke](#1-read-only-smoke) | `pnpm test` + `pnpm build:web` green; optional manual HTTP |
| 2 | [Mirror import QA](#2-mirror-import-qa) | `import-safe` exits 0; Settings mirror table shows recent run |
| 3 | [Sandbox write QA](#3-sandbox-write-qa) | `pnpm qa:sandbox` exit 0 (macOS/Git Bash) or [Windows manual](#5-windows-operator-qa) equivalent |
| 4 | [Restore QA](#4-restore-qa) | Covered inside sandbox smoke; optional standalone `legacy-restore` drill |
| 5 | [Windows operator QA](#5-windows-operator-qa) | Desktop config, Node CLIs, manual HTTP when bash unavailable |

**Legacy CLIs:** Always use compiled **`node dist/cli/*.js`** via `pnpm --filter @microdent/bridge run legacy-*` — not `tsx`. Root `pnpm legacy:*` bash wrappers call those scripts after `pnpm --filter @microdent/bridge run build`. Sandbox QA smoke invokes `pnpm legacy:backup` / `pnpm legacy:restore`, which resolve to **`node dist/cli/legacy-backup.js`** and **`node dist/cli/legacy-restore.js`** (see [services/bridge/package.json](../services/bridge/package.json)).

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

## 2. Mirror import QA

Mirror import is **CLI-only** (no HTTP trigger). Aligns with [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md).

### Environment (placeholders)

**PowerShell (Windows):**

```powershell
$env:DATA_ROOT = "C:\Microdent\Legacy-Copy\DATA"
$env:SQLITE_PATH = "C:\Microdent\mirror\MICRODENT_MIRROR.sqlite"
```

**bash (macOS / Git Bash):**

```bash
export DATA_ROOT="/path/to/Microdent-Legacy-Copy/DATA"
export SQLITE_PATH="/path/to/MICRODENT_MIRROR.sqlite"
```

Paths with spaces must be quoted in manual CLI invocations.

### Command

```powershell
cd C:\Microdent\Microdent-Modern
pnpm --filter @microdent/contracts run build
pnpm --filter @microdent/sqlite-mirror run import-safe
```

Equivalent root script on macOS: `pnpm mirror:import-safe` (bash wrapper → same Node CLI).

### Pass criteria

| Check | Expected |
| --- | --- |
| Exit code | `0` |
| Stdout | Table **counts** and status tokens only — no patient names or DBF row dumps |
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

**PowerShell (preflight only — full run needs bash or manual steps):**

```powershell
$env:DATA_ROOT = "C:\Microdent\Write-Sandbox\DATA"
$env:SQLITE_PATH = "C:\Microdent\mirror\MICRODENT_MIRROR.sqlite"
$env:BACKUP_DIR = "C:\Microdent\Write-Sandbox\backups"
$env:WRITE_MODE = "enabled"
$env:ALLOW_LEGACY_WRITES = "I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY"
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
| Smoke backup/restore | `pnpm legacy:backup` / `pnpm legacy:restore` → **`pnpm --filter @microdent/bridge run legacy-backup`** → **`node dist/cli/legacy-backup.js`** |
| Build | `qa-sandbox-run.sh` runs `pnpm --filter @microdent/bridge run build` before bridge + smoke |

If backup fails with `listen EPERM` under `tsx-*`, the bridge package is still invoking tsx — rebuild bridge and confirm [services/bridge/package.json](../services/bridge/package.json) scripts use `node dist/cli/...`.

### Preflight (before long run)

Confirm locally (or let `qa-sandbox-run.sh` enforce on macOS):

- `DATA_ROOT` resolves under `Microdent-Write-Sandbox`
- `${DATA_ROOT}/.microdent-write-sandbox.json` exists
- `services/bridge/dist/server.js` and `services/bridge/dist/cli/legacy-backup.js` exist after build

### Vitest band (fast, no HTTP)

```bash
pnpm sandbox:validate
```

Use for CI; use `pnpm qa:sandbox` for operator sign-off after mirror import.

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

Use when **bash**, `curl`, `jq`, or `sqlite3` are unavailable. Full deploy flow: [phase-4-windows-operator-quickstart.md](./phase-4-windows-operator-quickstart.md).

### Desktop and config

| Item | Location |
| --- | --- |
| Config | `%AppData%\Microdent\config.json` |
| Example `dataRoot` | `C:\Microdent\Write-Sandbox\DATA` |
| Example `sqlitePath` | `C:\Microdent\mirror\MICRODENT_MIRROR.sqlite` |
| Example `backupDir` | `C:\Microdent\Write-Sandbox\backups` |
| Bridge spawn | `node services\bridge\dist\server.js` only — no FoxPro `.exe` |

First-run setup appears when paths are missing. Default `writeMode` is `disabled`.

### Manual sandbox QA (native Windows)

| Step | Action |
| --- | --- |
| 1 | `pnpm --filter @microdent/contracts run build` and `pnpm --filter @microdent/bridge run build` |
| 2 | Set `DATA_ROOT`, `SQLITE_PATH`, `BACKUP_DIR`, `WRITE_MODE=enabled`, `ALLOW_LEGACY_WRITES=I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY` |
| 3 | Start `node services\bridge\dist\server.js` (stable — not `tsx watch`) |
| 4 | Poll `GET http://127.0.0.1:17890/health` until `ok: true` |
| 5 | Poll `GET /v1/meta/write-capability` until `writableSandbox: true` and `writeMode: "enabled"` |
| 6 | Four workflows: dry-run → `pnpm --filter @microdent/bridge run legacy-backup` → commit → `legacy-restore` per [phase-3-sandbox-qa-runner.md](./phase-3-sandbox-qa-runner.md) |
| 7 | Optional: `GET /v1/meta/write-audit-recent` — log `operationId`, `workflow`, `terminalStatus` only |

**Git Bash on Windows:** You may run `pnpm qa:sandbox` or `bash scripts/qa-sandbox-write-smoke.sh` if `curl`, `jq`, and `realpath` are installed.

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
| `pnpm mirror:import-safe` | `scripts/mirror-import-safe.sh` | **Bash wrapper → cross-platform Node** | `pnpm --filter @microdent/sqlite-mirror run import-safe` |
| `pnpm legacy:backup` | `scripts/legacy-backup.sh` | **Bash wrapper → cross-platform Node** | `pnpm --filter @microdent/bridge run legacy-backup` → `node dist/cli/legacy-backup.js` |
| `pnpm legacy:create-sandbox` | `scripts/legacy-create-sandbox.sh` | **Bash wrapper → cross-platform Node** | `pnpm --filter @microdent/bridge run legacy-create-sandbox` |
| `pnpm legacy:restore` | `scripts/legacy-restore.sh` | **Bash wrapper → cross-platform Node** | `pnpm --filter @microdent/bridge run legacy-restore` |
| `pnpm legacy:backup-verify` | `scripts/legacy-backup-verify.sh` | **Bash wrapper → cross-platform Node** | `pnpm --filter @microdent/bridge run legacy-backup-verify` |
| `pnpm sandbox:validate` | Vitest band | **Cross-platform Node** | Fast sandbox rules |
| `pnpm sandbox:validate:real` | Vitest + env | **Cross-platform Node** | Optional real-path band |
| `pnpm qa:sandbox` | `scripts/qa-sandbox-run.sh` | **macOS-oriented bash** (implemented) | **Needs replacement** on native Windows — manual checklist §5 or Git Bash |
| `bash scripts/qa-sandbox-write-smoke.sh` | smoke only | **macOS-oriented bash** | Bridge must already be up |
| `pnpm --filter @microdent/bridge run build` | tsc | **Cross-platform Node** | Required before `node dist/*` |
| `node services/bridge/dist/server.js` | production bridge | **Windows production-ready** | Set env in PowerShell first |
| `pnpm --filter @microdent/desktop run start` | Electron | **Cross-platform Node** | Windows checklist: [apps/desktop/README.md](../apps/desktop/README.md) |

### Deferred / needs replacement

| Item | Classification | Notes |
| --- | --- | --- |
| `scripts/qa-sandbox-run.mjs` | **Needs replacement** | Planned cross-platform orchestrator for Windows |
| `pnpm dev:ports` / `dev:kill-ports` | **Needs replacement** (for Windows dev ergonomics) | Optional; not required for production |
| NSIS / signed installer | **Out of scope** | Unpackaged desktop MVP |

---

## Safety reminders

- Never point `DATA_ROOT` at production legacy while FoxPro still writes.
- Never enable `WRITE_MODE=enabled` or sandbox pilot UI without disposable marker and operator ack.
- No PHI in stdout, UI plan panels, docs, or screenshots — use workflow codes and metadata only.
- Do not use **`tsx`** for legacy backup/restore in QA paths; use **`node dist/cli/*.js`** after bridge build.
