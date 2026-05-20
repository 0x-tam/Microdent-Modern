# Microdent Desktop (Electron MVP)

Minimal desktop shell per [docs/phase-3-desktop-packaging-plan.md](../../docs/phase-3-desktop-packaging-plan.md).

Windows script and CLI posture: [docs/phase-3-windows-readiness-audit.md](../../docs/phase-3-windows-readiness-audit.md).

## Windows MVP flow (operator)

1. Install **Node 22** and clone Microdent-Modern.
2. Build artifacts (once per machine):

   ```powershell
   pnpm --filter @microdent/bridge run build
   pnpm build:web
   pnpm --filter @microdent/desktop run build
   ```

3. Launch: `pnpm --filter @microdent/desktop run start`.
4. **First-run setup** opens when `dataRoot` or `sqlitePath` is missing. Enter absolute sandbox paths; write mode stays **disabled** in the UI.
5. Config is saved to **`%AppData%\Microdent\config.json`** (Run → `%AppData%\Microdent`).
6. The shell spawns **only** `node services\bridge\dist\server.js` with `WRITE_MODE=disabled` until you change config manually for sandbox pilot work.

**UNC paths** (`\\server\share\…`) are accepted in setup with an inline reminder to prefer local drive letters when possible. Network shares can be slow or unreliable for SQLite and DBF access.

## Safety defaults

- **No FoxPro or legacy `.exe` launchers** — the shell only spawns the Node bridge (`services/bridge/dist/server.js`).
- **`WRITE_MODE` is `disabled` by default** in operator config until sandbox pilot writes are enabled.
- **`DATA_ROOT` and `SQLITE_PATH` are never hardcoded** — set them in config when pointing at a disposable sandbox copy you control.
- **First-run setup** — if `dataRoot` or `sqlitePath` is missing, a setup window collects absolute paths (and optional `backupDir`) before the main UI opens. Write mode cannot be enabled from setup.

## First-run flow

1. Build bridge and web dist (see Prerequisites).
2. Launch the desktop app with no path fields in config (or delete `dataRoot` / `sqlitePath` from `config.json`).
3. When the setup window opens, enter absolute paths:
   - **DATA_ROOT** — existing sandbox folder (Windows example: `C:\Microdent\Write-Sandbox\DATA`).
   - **SQLITE_PATH** — existing mirror SQLite file (example: `C:\Microdent\mirror.sqlite`).
   - **BACKUP_DIR** (optional) — folder for backups (example: `C:\Microdent\backups`; created if missing).
4. If any path contains spaces, quote it in manual CLI commands (PowerShell: `"C:\Microdent\My Sandbox\DATA"`).
5. Setup saves config with `writeMode: "disabled"`, starts the Node bridge, and opens the web UI.

macOS developers with a pre-filled `config.json` skip setup and behave as before. No screenshots are required for first-run—only valid paths on disk.

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

On startup: load config → optional setup window → validate required paths → spawn bridge with `WRITE_MODE`, `DATA_ROOT`, `SQLITE_PATH`, and `BACKUP_DIR` (when set) → poll `GET /health` (15s timeout) → open window (`file://` web dist when built, else bridge URL). If startup fails, an **error dialog** explains the masked failure before the app exits (console log only is not enough for operators).

## Windows operator checklist

Use this before treating the desktop MVP as production-ready on Windows:

- [ ] **Node 22** installed (`nvm` or official installer); `node -v` shows v22.x.
- [ ] **Bridge built** — `services\bridge\dist\server.js` exists (`pnpm --filter @microdent/bridge run build`).
- [ ] **Web UI built** — `apps\web\dist\index.html` exists (`pnpm build:web`) for offline `file://` loading.
- [ ] **Config file** — `%AppData%\Microdent\config.json` (open via Run → `%AppData%\Microdent`) with `writeMode: "disabled"` until sandbox pilot.
- [ ] **First-run paths** — `dataRoot` and `sqlitePath` aim at disposable copies under your control (e.g. `C:\Microdent\Write-Sandbox\DATA`); never point at production legacy trees.
- [ ] **Spaces in paths** — quote paths in PowerShell/CMD when running bridge CLIs manually.
- [ ] **UNC shares** — allowed by setup with a warning; prefer local drive letters when possible.
- [ ] **Loopback only** — bridge listens on `127.0.0.1` (default port `17890` via `BRIDGE_HOST` / `BRIDGE_PORT`).
- [ ] **No FoxPro / legacy EXE / BAT** — Task Manager should show only `node.exe` (bridge) and Electron; the supervisor spawns `node …\dist\server.js` only (see `bridge-supervisor.test.ts`).
- [ ] **Write pilot** — change `writeMode` only with sandbox marker and bridge safety ack; follow [phase-3-write-safe-qa-checklist.md](../../docs/phase-3-write-safe-qa-checklist.md).
- [ ] **Legacy CLI on Windows** — `pnpm --filter @microdent/bridge run legacy-*` with env vars set in PowerShell, not bash-only wrappers ([Windows audit](../../docs/phase-3-windows-readiness-audit.md#cross-platform-node-clis-preferred-on-windows)).
- [ ] **Out of MVP scope** — NSIS installer, code signing, auto-update.

## Scope (MVP)

- Spawns `services/bridge/dist/server.js` (Node only; no FoxPro/EXE)
- Polls `GET /health` before opening the window
- Loads `apps/web/dist/index.html` when present
- Stops bridge on quit

Not included: NSIS installer, code signing, auto-update.

## Tests

```bash
pnpm --filter @microdent/desktop run test
pnpm --filter @microdent/desktop run release-smoke
```

`release-smoke` builds dist, runs vitest, verifies dist artifacts, default `writeMode: disabled`, and that the supervisor targets `services/bridge/dist/server.js` only (no EXE/BAT).

Covers default `writeMode`, platform config dirs, path validation (including `not_absolute`), setup payload, supervisor spawn argv (`server.js` only; no EXE/BAT), env (`WRITE_MODE=disabled`, `BACKUP_DIR` when set), and `uiUrl` resolution.
