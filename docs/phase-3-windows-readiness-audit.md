# Phase 3 — Windows production readiness audit

**Date:** 2026-05-18  
**Scope:** Shell scripts, root `pnpm` wrappers, bridge/sqlite-mirror CLIs, desktop Electron MVP.  
**Out of scope this batch:** Rewriting `lsof`/`rsync`, NSIS installer, Node-based QA orchestrator.

This document classifies every operator-facing script so Windows deployers know what runs natively vs what needs Git Bash/WSL or manual Node steps.

See also: [apps/desktop/README.md](../apps/desktop/README.md) (Windows checklist), [scripts/README.md](../scripts/README.md) (script index).

---

## Summary

| Layer | Windows posture |
| --- | --- |
| **Bridge / mirror / legacy CLIs** | **Cross-platform Node** (`tsx` or `node` after `pnpm build`) |
| **Root `pnpm legacy:*` / `mirror:import-safe`** | Bash wrappers — use **WSL/Git Bash** or invoke the underlying workspace script directly |
| **`pnpm dev:*` port helpers** | **macOS dev-only** (`lsof`, `ps`) |
| **Sandbox QA bash** | **macOS-oriented** — on Windows run equivalent steps manually or wait for a Node orchestrator (next batch) |
| **Desktop app** | Electron + `node dist/server.js`; config under `%AppData%\Microdent\config.json` on Windows |

---

## Root `package.json` scripts

| `pnpm` script | Entry | Classification | Windows notes |
| --- | --- | --- | --- |
| `dev:ports` | `scripts/dev-ports.sh` | **macOS dev-only** | Requires `lsof` via `dev-common.sh` |
| `dev:kill-ports` | `scripts/dev-kill-ports.sh` | **macOS dev-only** | `lsof` + `ps` + `kill` |
| `dev:bridge` | `scripts/dev-bridge.sh` | **macOS dev-only wrapper** | Bash env checks; runs `pnpm --filter @microdent/bridge dev` (Node works on Windows if run directly) |
| `dev:web` | `scripts/dev-web.sh` | **macOS dev-only wrapper** | Bash; underlying `pnpm --filter @microdent/web dev` is cross-platform |
| `mirror:import-safe` | `scripts/mirror-import-safe.sh` | **Bash wrapper → cross-platform Node** | `pnpm --filter @microdent/sqlite-mirror run import-safe` |
| `legacy:backup` | `scripts/legacy-backup.sh` | **Bash wrapper → cross-platform Node** | `pnpm --filter @microdent/bridge run legacy-backup` |
| `legacy:create-sandbox` | `scripts/legacy-create-sandbox.sh` | **Bash wrapper → cross-platform Node** | `pnpm --filter @microdent/bridge run legacy-create-sandbox` |
| `legacy:restore` | `scripts/legacy-restore.sh` | **Bash wrapper → cross-platform Node** | `pnpm --filter @microdent/bridge run legacy-restore` |
| `legacy:backup-verify` | `scripts/legacy-backup-verify.sh` | **Bash wrapper → cross-platform Node** | `pnpm --filter @microdent/bridge run legacy-backup-verify` |
| `sandbox:validate` | Vitest in bridge | **Cross-platform Node** | No shell |
| `qa:sandbox` | *(planned)* `scripts/qa-sandbox-run.sh` | **macOS-oriented bash** | `curl`, `jq`, `sqlite3`, `realpath`, `bash` — document **manual steps on Windows** until `qa-sandbox-run.mjs` exists |

---

## `scripts/` files

| File | `pnpm` / usage | Classification | Dependencies / notes |
| --- | --- | --- | --- |
| `dev-common.sh` | Sourced by dev/legacy/mirror scripts | **macOS dev infrastructure** | `lsof`; documents macOS-first posture |
| `dev-ports.sh` | `pnpm dev:ports` | **macOS dev-only** | Lists listeners on 17890, 5173, 4173 |
| `dev-kill-ports.sh` | `pnpm dev:kill-ports` | **macOS dev-only** | SIGTERM/SIGKILL listeners on dev ports only |
| `dev-bridge.sh` | `pnpm dev:bridge` | **macOS dev-only wrapper** | Validates `DATA_ROOT`; exec bridge `dev` (tsx watch) |
| `dev-web.sh` | `pnpm dev:web` | **macOS dev-only wrapper** | Copies `.env.local.example`; exec Vite |
| `mirror-import-safe.sh` | `pnpm mirror:import-safe` | **Bash wrapper → cross-platform Node** | Requires absolute `DATA_ROOT` / `SQLITE_PATH` (`/*` check is Unix-style; on Windows prefer calling Node CLI with `C:\...` paths) |
| `legacy-backup.sh` | `pnpm legacy:backup` | **Bash wrapper → cross-platform Node** | `DATA_ROOT`, `BACKUP_DIR`, `WORKFLOW` |
| `legacy-create-sandbox.sh` | `pnpm legacy:create-sandbox` | **Bash wrapper → cross-platform Node** | `SOURCE_DATA_ROOT`, `SANDBOX_ROOT` |
| `legacy-restore.sh` | `pnpm legacy:restore` | **Bash wrapper → cross-platform Node** | `BACKUP_MANIFEST`, `DATA_ROOT` |
| `legacy-backup-verify.sh` | `pnpm legacy:backup-verify` | **Bash wrapper → cross-platform Node** | `BACKUP_MANIFEST`; optional `DATA_ROOT` |
| `qa-sandbox-write-smoke.sh` | Manual / orchestrator | **macOS-oriented bash** | `curl`, `jq`, `sqlite3`, `realpath`, grep sandbox path |
| `qa-sandbox-run.sh` | `pnpm qa:sandbox` *(when added)* | **macOS-oriented bash** | Orchestrates stable bridge + smoke; **Windows: run steps manually** |

---

## Cross-platform Node CLIs (preferred on Windows)

Run from repo root after `pnpm --filter @microdent/contracts run build` and target package `build`:

| Task | Command |
| --- | --- |
| Mirror import (safe tables) | `set DATA_ROOT=...` / `set SQLITE_PATH=...` then `pnpm --filter @microdent/sqlite-mirror run import-safe` |
| Legacy backup | `pnpm --filter @microdent/bridge run legacy-backup` (with env vars) |
| Create write sandbox | `pnpm --filter @microdent/bridge run legacy-create-sandbox` |
| Restore from backup | `pnpm --filter @microdent/bridge run legacy-restore` |
| Verify backup manifest | `pnpm --filter @microdent/bridge run legacy-backup-verify` |
| Production bridge | `pnpm --filter @microdent/bridge run build` then `node services/bridge/dist/server.js` |

Bridge CLIs use `path.join` / `path.normalize` internally; no FoxPro `.exe` is spawned.

---

## Desktop Electron MVP

| Check | Status |
| --- | --- |
| Spawns only `node` + `services/bridge/dist/server.js` | Yes — see `BridgeSupervisor` |
| Default `WRITE_MODE=disabled` | Yes — `defaultDesktopConfig()` and supervisor env |
| No hardcoded `DATA_ROOT` / `SQLITE_PATH` | Yes — operator `config.json` only |
| Windows config path | `%AppData%\Microdent\config.json` via `desktopConfigDir()` |
| macOS dev config path | `~/Library/Application Support/Microdent/config.json` |
| Linux config path | `~/.config/microdent/config.json` |

Details: [apps/desktop/README.md](../apps/desktop/README.md).

---

## Production TypeScript path notes

| Location | Finding | Action this batch |
| --- | --- | --- |
| `services/bridge/src/write-safety/constants.ts` | Clinic-specific **forbidden roots** (`FORBIDDEN_LEGACY_*`) use fixed `/Users/...` paths for this deployment’s safety band | **Intentional** — not a path-join bug; configure via env on other machines |
| `services/bridge/src/cli/legacy-create-sandbox.ts` | Help text shows `/Users/...` examples | **Doc examples only** — OK |
| `apps/desktop/src/config.ts` | Config dir now uses `platform()`-aware `desktopConfigDir()` | **Fixed** — Windows `%AppData%`, macOS Application Support, Linux XDG-style |
| Bash wrappers `[[ path != /* ]]` | Unix absolute-path guard | On Windows, call Node CLIs with drive-letter paths instead of bash wrappers |

No `lsof`/`rsync` rewrites in this batch.

---

## Windows operator quick start

1. Install **Node 22 LTS** (64-bit).
2. Clone repo; `pnpm install`; `pnpm --filter @microdent/bridge run build`; `pnpm build:web`.
3. Point read-only legacy copy: set `DATA_ROOT` to a **local copy** of `DATA\` (not live FoxPro share while legacy writes).
4. Optional mirror: `pnpm --filter @microdent/sqlite-mirror run import-safe` with `DATA_ROOT` and `SQLITE_PATH` under `%LocalAppData%\Microdent\mirror\`.
5. Run bridge: `node services\bridge\dist\server.js` with `BRIDGE_HOST=127.0.0.1`, `WRITE_MODE=disabled` until sandbox pilot.
6. Desktop: build `@microdent/desktop`, edit `%AppData%\Microdent\config.json`, then `pnpm --filter @microdent/desktop run start`.
7. Sandbox writes: use disposable sandbox marker; enable writes only on sandbox copy with `ALLOW_LEGACY_WRITES_ACK` per bridge docs — never on production legacy tree.

---

## Recommended next batch

- `scripts/qa-sandbox-run.mjs` — cross-platform QA without bash/curl/jq
- Windows port inspection/kill without `lsof`
- NSIS / signed desktop installer
- Env-driven `FORBIDDEN_LEGACY_*` overrides for non-macOS clinic paths
