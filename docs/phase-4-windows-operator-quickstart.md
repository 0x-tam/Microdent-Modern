# Phase 4 — Windows operator quickstart

**Purpose:** One-page flow for deploying and validating Microdent Modern on Windows without bash wrappers. Use placeholder paths like `C:\Microdent\...` only — never commit real clinic paths.

**Related:** [phase-3-windows-readiness-audit.md](./phase-3-windows-readiness-audit.md), [phase-3-sandbox-qa-runner.md](./phase-3-sandbox-qa-runner.md), [apps/desktop/README.md](../apps/desktop/README.md), [scripts/README.md](../scripts/README.md).

---

## 1. Confirm Node runtime

- Preferred: the staged package includes `node\RUNTIME-MANIFEST.json` for a validated Node 22.5+ runtime.
- Build machine check before staging: `pnpm pilot:node-runtime-check -- --runtime-dir <Node22 folder>`, then set `MICRODENT_NODE_RUNTIME_DIR`.
- Fallback: install **Node 22.5+** (64-bit) from your org package manager and verify `node -v`.

---

## 2. Clone and build

From an elevated or normal `cmd` / PowerShell session:

```powershell
cd C:\Microdent\Microdent-Modern
pnpm install
pnpm --filter @microdent/contracts run build
pnpm --filter @microdent/bridge run build
pnpm build:web
pnpm --filter @microdent/desktop run build
```

Fast synthetic check (no sandbox HTTP):

```powershell
pnpm sandbox:validate
```

---

## 3. Paths (placeholders)

Define operator-controlled copies — **not** live FoxPro shares while legacy still writes:

| Variable | Example placeholder |
| --- | --- |
| Read-only legacy `DATA\` | `C:\Microdent\Legacy-Copy\DATA` |
| Disposable write sandbox | `C:\Microdent\Write-Sandbox\DATA` (requires `.microdent-write-sandbox.json`) |
| Mirror SQLite | `C:\Microdent\mirror\MICRODENT_MIRROR.sqlite` |
| Sandbox backups | `C:\Microdent\Write-Sandbox\backups` |

---

## 4. Local copy import (automatic)

First-run desktop setup prepares the fast local copy automatically from the copied clinic data folder. No PowerShell import is required for the normal operator flow.

**Refresh in UI:** Settings → Local copy & import → **Refresh local copy**, then **Refresh status**. The CLI import docs remain support fallback only: [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md).

---

## 5. Desktop config and first-run

| Item | Location |
| --- | --- |
| Config file | `%AppData%\Microdent\config.json` |
| First-run setup | If clinic data/local-copy paths are missing, the desktop app opens setup before the main UI and prepares the local copy |

Example `config.json` (placeholders):

```json
{
  "version": 1,
  "bridgePort": 17890,
  "writeMode": "disabled",
  "dataRoot": "C:\\Microdent\\Write-Sandbox\\DATA",
  "sqlitePath": "C:\\Microdent\\Write-Sandbox\\mirror\\clinic.sqlite",
  "backupDir": "C:\\Microdent\\Write-Sandbox\\microdent-backups"
}
```

Start desktop:

```powershell
pnpm --filter @microdent/desktop run start
```

The shell spawns only the local clinic service on loopback. It prefers packaged `node\` when present. Default `writeMode` is `disabled` until sandbox pilot.

---

## 6. Run bridge without desktop (optional)

```powershell
$env:DATA_ROOT = "C:\Microdent\Write-Sandbox\DATA"
$env:SQLITE_PATH = "C:\Microdent\mirror\MICRODENT_MIRROR.sqlite"
$env:BACKUP_DIR = "C:\Microdent\Write-Sandbox\backups"
$env:BRIDGE_HOST = "127.0.0.1"
$env:BRIDGE_PORT = "17890"
$env:WRITE_MODE = "disabled"
node services\bridge\dist\server.js
```

Enable writes only on the disposable sandbox with bridge safety acks per [phase-3-write-safe-qa-checklist.md](./phase-3-write-safe-qa-checklist.md).

---

## 7. Sandbox write pilot (web / desktop UI)

Controlled write UI (status, time move, create, demographics) is **opt-in**:

| Env | Effect |
| --- | --- |
| `VITE_SANDBOX_WRITE_PILOT=true` | Enables all four sandbox write panels when write-capability allows |
| `VITE_APPOINTMENT_STATUS_WRITE_PILOT=true` | Legacy flag — status write only |

For local Vite dev, set in `apps/web/.env.local` and restart dev server. Production builds remain read-only unless the operator deliberately sets pilot env at build time.

Also required on the bridge: disposable sandbox marker, `WRITE_MODE` / ack per bridge docs, mirror sqlite with schedule/patient rows.

Open **Settings** in the app to confirm clinic service, local copy, editing mode, sandbox validity, and backup configured (no full paths in production UI). Use **Restart clinic service**, **Check service port**, **Refresh local copy**, and **Export support log** for desktop-supported quick fixes.

---

## 8. Sandbox QA: macOS vs Windows

### macOS (or Git Bash on Windows with Unix tools)

```bash
export DATA_ROOT="/path/to/Microdent-Write-Sandbox/DATA"
export SQLITE_PATH="/path/to/MICRODENT_MIRROR.sqlite"
export BACKUP_DIR="/path/to/Microdent-Write-Sandbox/backups"
cd /path/to/Microdent-Modern
nvm use 22
pnpm qa:sandbox
```

**Pass:** exit `0`; log ends with `qa:sandbox complete` and four workflows in smoke. Details: [phase-3-sandbox-qa-runner.md](./phase-3-sandbox-qa-runner.md).

### Windows manual checklist

`pnpm qa:sandbox` is **implemented** but **bash-oriented** (`curl`, `jq`, `sqlite3`, `realpath`). On native Windows without Git Bash, run equivalent steps:

| Step | Action |
| --- | --- |
| 1 | `pnpm --filter @microdent/contracts run build` and `pnpm --filter @microdent/bridge run build` |
| 2 | Set `DATA_ROOT`, `SQLITE_PATH`, `BACKUP_DIR`, `WRITE_MODE=enabled`, `ALLOW_LEGACY_WRITES=I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY` |
| 3 | Start stable bridge: `node services\bridge\dist\server.js` (not `tsx watch`) |
| 4 | Poll `GET http://127.0.0.1:17890/health` until `ok: true` |
| 5 | Poll `GET /v1/meta/write-capability` until `writableSandbox: true` and `writeMode: "enabled"` |
| 6 | Run four workflows (dry-run → backup → commit → restore) per [phase-3-sandbox-qa-runner.md](./phase-3-sandbox-qa-runner.md) — or use Git Bash: `bash scripts/qa-sandbox-write-smoke.sh` with bridge already up |
| 7 | Optional audit: `GET /v1/meta/write-audit-recent` — log `operationId`, `workflow`, `terminalStatus` only |

Use `pnpm --filter @microdent/bridge run legacy-backup` / `legacy-restore` with env vars instead of `pnpm legacy:*` bash wrappers.

---

## Windows quick-reference (pnpm --filter)

| Task | Command |
| --- | --- |
| Local copy refresh | Settings → Local copy & import → **Refresh local copy** |
| Mirror import support fallback | `pnpm --filter @microdent/sqlite-mirror run import-safe` |
| Legacy backup | `pnpm --filter @microdent/bridge run legacy-backup` |
| Create write sandbox | `pnpm --filter @microdent/bridge run legacy-create-sandbox` |
| Restore from backup | `pnpm --filter @microdent/bridge run legacy-restore` |
| Verify backup manifest | `pnpm --filter @microdent/bridge run legacy-backup-verify` |
| Bridge production | `pnpm --filter @microdent/bridge run build` then `node services\bridge\dist\server.js` |

Set `DATA_ROOT`, `SQLITE_PATH`, `BACKUP_DIR`, and workflow-specific vars in PowerShell before each command. Full table: [scripts/README.md](../scripts/README.md).

---

## Deferred (explicit non-goals)

| Item | Notes |
| --- | --- |
| **Node QA orchestrator** (`qa-sandbox-run.mjs`) | Cross-platform replacement for bash `pnpm qa:sandbox` — not in this batch |
| **`lsof` replacement** | `pnpm dev:ports` / `dev:kill-ports` stay macOS dev-only |
| **NSIS installer** | Desktop MVP is unpackaged; no signed installer or auto-update |

---

## Safety reminders

- Never point `DATA_ROOT` at production legacy while FoxPro still writes.
- Never enable pilot UI or `WRITE_MODE=enabled` without disposable sandbox marker and operator ack.
- No PHI, phones, addresses, or raw DBF rows in logs, docs, or UI feedback panels.
