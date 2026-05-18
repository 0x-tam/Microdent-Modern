# Microdent Desktop (Electron MVP)

Minimal desktop shell per [docs/phase-3-desktop-packaging-plan.md](../../docs/phase-3-desktop-packaging-plan.md).

Windows script and CLI posture: [docs/phase-3-windows-readiness-audit.md](../../docs/phase-3-windows-readiness-audit.md).

## Safety defaults

- **No FoxPro or legacy `.exe` launchers** — the shell only spawns the Node bridge (`services/bridge/dist/server.js`).
- **`WRITE_MODE` is `disabled` by default** in operator config until sandbox pilot writes are enabled.
- **`DATA_ROOT` and `SQLITE_PATH` are never hardcoded** — set them in config when pointing at a disposable sandbox copy you control.
- **First-run setup** — if `dataRoot` or `sqlitePath` is missing, a setup window collects absolute paths (and optional `backupDir`) before the main UI opens. Write mode cannot be enabled from setup.

## First-run flow

1. Launch the desktop app with no path fields in config (or delete path keys from `config.json`).
2. Enter absolute `DATA_ROOT` (existing folder), `SQLITE_PATH` (existing file), and optional `BACKUP_DIR` (created if missing).
3. Setup saves `config.json` with `writeMode: "disabled"`, starts the bridge, and opens the web UI.

macOS developers with a pre-filled `config.json` skip setup and behave as before.

## Config file locations

| OS | Path |
| --- | --- |
| **Windows** | `%AppData%\Microdent\config.json` |
| **macOS** | `~/Library/Application Support/Microdent/config.json` |
| **Linux** | `~/.config/microdent/config.json` |

Example Windows `config.json`:

```json
{
  "version": 1,
  "bridgePort": 17890,
  "writeMode": "disabled",
  "dataRoot": "D:\\MicrodentData\\Write-Sandbox\\DATA",
  "sqlitePath": "C:\\Users\\Operator\\AppData\\Local\\Microdent\\mirror\\MICRODENT_MIRROR.sqlite",
  "backupDir": "D:\\MicrodentData\\Write-Sandbox\\backups"
}
```

Use real absolute paths (expand `%LOCALAPPDATA%` before saving). The desktop app does not embed clinic paths.

## Prerequisites

```bash
cd /path/to/Microdent-Modern
nvm use 22   # or install Node 22 on Windows
pnpm --filter @microdent/bridge run build
pnpm build:web
pnpm --filter @microdent/desktop run build
```

## Run

```bash
pnpm --filter @microdent/desktop run start
```

On startup: load config → optional setup window → spawn bridge with `WRITE_MODE`, `DATA_ROOT`, `SQLITE_PATH`, and `BACKUP_DIR` (when set) → poll `GET /health` → open window (`file://` web dist when built, else bridge URL).

## Windows packaging checklist

Use this before treating the desktop MVP as production-ready on Windows:

- [ ] **Node 22** installed; `services/bridge/dist/server.js` exists (`pnpm --filter @microdent/bridge run build`).
- [ ] **`apps/web/dist/index.html`** exists (`pnpm build:web`) for offline UI.
- [ ] **Config** at `%AppData%\Microdent\config.json` with `writeMode: "disabled"` until sandbox pilot.
- [ ] **`dataRoot` / `sqlitePath`** point at operator-controlled copies only (never production `Microdent-Legacy`).
- [ ] **Bridge binds loopback** — default `127.0.0.1:17890` via supervisor env (`BRIDGE_HOST`, `BRIDGE_PORT`).
- [ ] **No FoxPro** — confirm Task Manager shows only `node.exe` + Electron for this app (see tests in `bridge-supervisor.test.ts`).
- [ ] **Write pilot** — enable `writeMode` only with disposable sandbox marker and bridge safety ack; follow [phase-3-write-safe-qa-checklist.md](../../docs/phase-3-write-safe-qa-checklist.md).
- [ ] **Legacy CLI on Windows** — use `pnpm --filter @microdent/bridge run legacy-*` with env vars, not bash wrappers (see [Windows audit](../../docs/phase-3-windows-readiness-audit.md#cross-platform-node-clis-preferred-on-windows)).
- [ ] **Not in MVP** — NSIS installer, code signing, auto-update (documented out of scope).

## Scope (MVP)

- Spawns `services/bridge/dist/server.js` (Node only; no FoxPro/EXE)
- Polls `GET /health` before opening the window
- Loads `apps/web/dist/index.html` when present
- Stops bridge on quit

Not included: NSIS installer, code signing, auto-update.

## Tests

```bash
pnpm --filter @microdent/desktop run test
```

Covers default `writeMode`, platform config dirs, path validation, setup payload, supervisor spawn env (`BACKUP_DIR` included when configured), and `uiUrl` resolution.
