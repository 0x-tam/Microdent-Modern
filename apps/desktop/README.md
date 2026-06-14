# Microdent Desktop (Electron MVP)

Minimal desktop shell per [docs/phase-3-desktop-packaging-plan.md](../../docs/phase-3-desktop-packaging-plan.md).

## Bridge ownership

**The desktop app owns bridge lifecycle.** Users do not start or manage the bridge as a separate service.

- The packaged app starts the bridge automatically on launch (via `BridgeSupervisor` in `main.ts`).
- The bridge runs as a child process of the Electron app and is terminated cleanly on quit.
- If the bridge fails to start, the app shows a friendly error dialog and exits — it does not crash silently.
- Manual bridge startup (`node services/bridge/dist/server.js`) is for **development only**.
- The bridge binds to `127.0.0.1` only — it is not accessible from the network.
- Port conflicts are handled by the bridge itself (it will fail to bind, and the desktop app shows the error).

Operators only manage:
- **First-run setup** — choose the copied clinic data folder and let the app prepare the fast local copy
- **Local-copy refresh** — use **Settings → Refresh local copy** when copied files change or support asks
- **Write mode** — changed only for approved sandbox pilot work (default: `disabled`)

CLI mirror/import commands are for development and support fallback only. Normal
operators should not run `pnpm`, edit environment variables, or manage DBF/SQLite
paths by hand.

## Prerequisites

```bash
cd /path/to/Microdent-Modern
nvm use 22
pnpm --filter @microdent/bridge run build
pnpm build:web
pnpm --filter @microdent/desktop run build
```

## Run (dev checkout)

```bash
pnpm --filter @microdent/desktop run start
```

Default config: `%AppData%\Microdent\config.json` with `writeMode: "disabled"`.

Set `dataRoot` to a disposable sandbox `DATA` copy before enabling writes.

## Packaged pilot launch (staged `MicrodentModern/`)

After `pnpm stage:pilot-release`, IT delivers `dist/pilot-release/MicrodentModern/`:

| Item | Detail |
| --- | --- |
| **Install root** | Folder containing `app/`, `bridge/`, `web/` (example: `C:\Microdent\MicrodentModern\`) |
| **Desktop entry** | Packaged desktop shell via Electron + bundled/system Node 22 |
| **Bridge entry** | `bridge/server.js` — resolved relative to install root (not repo `services/`) |
| **Web UI** | Packaged desktop shell; double-click smoke fallback serves `web/` at `http://127.0.0.1:4173/` |
| **Operator index** | `docs/PILOT-HANDOFF-PACK.md` in the staged package |
| **Config** | `%AppData%\Microdent\config.json` after first-run setup |

The supervisor detects packaged layout when `bridge/server.js` exists at the install root (two levels above `app/dist/`). Dev checkout still uses `services/bridge/dist/server.js` and `apps/web/dist/index.html`.

**Spawn contract:** bridge child receives `WRITE_MODE=disabled` by default; `ALLOW_LEGACY_WRITES` is **never** passed from the desktop shell — operators set it on the bridge only for approved sandbox pilot work.

## Scope (MVP)

- Spawns bridge `server.js` (packaged or dev dist path)
- Polls `GET /health` before opening the window
- Loads packaged web dist in the desktop shell; smoke fallback uses a localhost static preview
- Stops bridge on quit

Not included: NSIS installer, code signing, auto-update.

## Data locations (Windows pilot)

| Layer | Example | Notes |
| --- | --- | --- |
| Install / staged package | `C:\Microdent\MicrodentModern\` | Shipped app only |
| Desktop config | `%AppData%\Microdent\config.json` | Path pointers |
| Clinic paths | Setup window examples | Outside install folder |

Full guide: [docs/windows-pilot-data-locations.md](../../docs/windows-pilot-data-locations.md). Index: [docs/PILOT-HANDOFF-PACK.md](../../docs/PILOT-HANDOFF-PACK.md).

## Release smoke

```bash
pnpm --filter @microdent/desktop run release-smoke
PILOT_STAGED_RELEASE=1 pnpm --filter @microdent/desktop run release-smoke   # after stage
```

Checks dist artifacts, config defaults (`writeMode: disabled`), supervisor spawn argv, no `ALLOW_LEGACY_WRITES` in spawn env, and staged layout including `RELEASE-MANIFEST.json`.

| Gate | Command |
| --- | --- |
| Quick | `pnpm pilot-checkpoint` |
| Distribution | `pnpm pilot:distribution-checkpoint` |
| Strict signoff | `pnpm pilot:release-signoff` (requires sandbox env) |

See [docs/PILOT-START-HERE.md](../../docs/PILOT-START-HERE.md) and [scripts/README.md](../../scripts/README.md).
