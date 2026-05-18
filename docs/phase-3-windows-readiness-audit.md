# Phase 3 — Windows production readiness audit

**Date:** 2026-05-18  
**Scope:** Shell scripts, root `pnpm` wrappers, bridge/sqlite-mirror CLIs, desktop Electron MVP.  
**Out of scope this batch:** Rewriting `lsof`/`rsync`, NSIS installer, Node-based QA orchestrator.

This document classifies every operator-facing script so Windows deployers know what runs natively vs what needs Git Bash/WSL or manual Node steps.

See also: [phase-4-windows-operator-quickstart.md](./phase-4-windows-operator-quickstart.md) (one-page operator flow), [apps/desktop/README.md](../apps/desktop/README.md) (Windows checklist), [scripts/README.md](../scripts/README.md) (script index).

---

## Summary

| Layer | Windows posture |
| --- | --- |
| **Bridge / mirror / legacy CLIs** | **Cross-platform Node** (`tsx` or `node` after `pnpm build`) |
| **Root `pnpm legacy:*` / `mirror:import-safe`** | Bash wrappers — use **WSL/Git Bash** or invoke the underlying workspace script directly |
| **`pnpm dev:*` port helpers** | **macOS dev-only** (`lsof`, `ps`) |
| **Sandbox QA bash** | **Implemented** (`pnpm qa:sandbox`) — **macOS-oriented**; on Windows run equivalent steps manually or wait for a Node orchestrator (deferred) |
| **Product UI batch** | Sandbox write pilot env, desktop first-run setup, Settings / mirror status — see table below |
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
| `qa:sandbox` | `scripts/qa-sandbox-run.sh` | **Implemented — macOS-oriented bash** | `curl`, `jq`, `sqlite3`, `realpath`, `bash` — on Windows use [phase-4-windows-operator-quickstart.md](./phase-4-windows-operator-quickstart.md) manual checklist until `qa-sandbox-run.mjs` exists |

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
| `qa-sandbox-run.sh` | `pnpm qa:sandbox` | **Implemented — macOS-oriented bash** | Orchestrates stable bridge + smoke; **Windows: run steps manually** (see phase-4 quickstart) |

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

## Product UI batch (2026-05-18)

Operator-facing UI and desktop flows added after sandbox hardening (`59bb02a`). No new write routes; four sandbox-gated workflows only.

| Area | What shipped | Windows notes |
| --- | --- | --- |
| **Sandbox write pilot env** | `VITE_SANDBOX_WRITE_PILOT=true` (or legacy `VITE_APPOINTMENT_STATUS_WRITE_PILOT` for status-only) in web/desktop build env | Set in `apps/web/.env.local` for Vite dev/preview; production builds stay read-only unless operator opts in. Requires bridge `WRITE_MODE` + disposable sandbox marker. |
| **Schedule / patient write UI** | Status, time move, create (Schedule); demographics (patient profile) under sandbox banners | Same bridge on loopback; no PHI in plan/feedback panels. |
| **Desktop first-run setup** | Setup window when `dataRoot` / `sqlitePath` missing; saves `%AppData%\Microdent\config.json` | Use `C:\Microdent\Write-Sandbox\DATA` and `C:\Microdent\mirror\MICRODENT_MIRROR.sqlite` placeholders in docs only — operator supplies real paths. Optional `backupDir`. |
| **Settings module** | Sidebar **Settings**: bridge health, mirror freshness, write mode, sandbox validity, backup configured | Mirror **Refresh status** re-fetches `GET /v1/mirror/status` only — CLI import per [phase-2-mirror-import-command.md](./phase-2-mirror-import-command.md). |

Full Windows flow: [phase-4-windows-operator-quickstart.md](./phase-4-windows-operator-quickstart.md).

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

See **[phase-4-windows-operator-quickstart.md](./phase-4-windows-operator-quickstart.md)** for the full one-page flow (Node 22 → build → desktop config → mirror CLI → sandbox pilot env → `pnpm qa:sandbox` on macOS vs Windows manual QA).

---

## Deferred (explicit non-goals)

| Item | Status |
| --- | --- |
| **Node QA orchestrator** (`scripts/qa-sandbox-run.mjs`) | Deferred — use bash `pnpm qa:sandbox` on macOS/Git Bash or manual checklist on Windows |
| **`lsof` / port-kill replacement** | Deferred — `dev:ports` / `dev:kill-ports` remain macOS dev-only |
| **NSIS / signed desktop installer** | Deferred — desktop MVP is unpackaged Electron + config file |
| **Env-driven `FORBIDDEN_LEGACY_*` overrides** | Future — clinic-specific forbidden roots remain deployment-specific |

Other follow-ups (non-blocking): env-driven forbidden-root overrides for non-macOS clinic paths.
