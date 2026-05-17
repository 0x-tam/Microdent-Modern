# Microdent Desktop (Electron MVP)

Minimal desktop shell per [docs/phase-3-desktop-packaging-plan.md](../../docs/phase-3-desktop-packaging-plan.md).

## Safety defaults

- **No FoxPro or legacy `.exe` launchers** — the shell only spawns the Node bridge (`services/bridge/dist/server.js`).
- **`WRITE_MODE` is `disabled` by default** in `%AppData%\Microdent\config.json` until an operator enables sandbox pilot writes.
- **`DATA_ROOT` and `SQLITE_PATH` are never hardcoded** — set them in config when pointing at a disposable sandbox copy you control.

## Prerequisites

```bash
cd /Users/Tamam/Desktop/Microdent/Microdent-Modern
nvm use 22
pnpm --filter @microdent/bridge run build
pnpm build:web
pnpm --filter @microdent/desktop run build
```

## Run

```bash
pnpm --filter @microdent/desktop run start
```

Default config: `%AppData%\Microdent\config.json` with `writeMode: "disabled"` (maps to bridge `WRITE_MODE=disabled`).

Set `dataRoot` / `sqlitePath` in that file to your sandbox paths before enabling writes — the desktop app does not embed clinic paths.

## Scope (MVP)

- Spawns `services/bridge/dist/server.js` (Node only; no FoxPro/EXE)
- Polls `GET /health` before opening the window
- Loads `apps/web/dist/index.html` when present
- Stops bridge on quit

Not included: NSIS installer, code signing, auto-update.
