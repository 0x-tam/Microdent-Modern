# Microdent Desktop (Electron MVP)

Minimal desktop shell per [docs/phase-3-desktop-packaging-plan.md](../../docs/phase-3-desktop-packaging-plan.md).

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

Default config: `%AppData%\Microdent\config.json` with `writeMode: "disabled"`.

Set `dataRoot` to a disposable sandbox `DATA` copy before enabling writes.

## Scope (MVP)

- Spawns `services/bridge/dist/server.js`
- Polls `GET /health` before opening the window
- Loads `apps/web/dist/index.html` when present
- Stops bridge on quit

Not included: NSIS installer, code signing, auto-update.
