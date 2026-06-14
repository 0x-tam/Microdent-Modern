# Phase 3 — Windows production readiness audit

**Date:** 2026-05-18  
**Scope:** Shell scripts, root `pnpm` wrappers, bridge/sqlite-mirror CLIs, desktop Electron MVP.  
**Out of scope this batch:** Rewriting `lsof`/`rsync`, NSIS installer.

This document classifies every operator-facing script so Windows deployers know what runs natively vs what needs Git Bash/WSL or manual Node steps.

See also: [phase-6-windows-mvp-operator-guide.md](./phase-6-windows-mvp-operator-guide.md) (**Windows MVP — end-to-end**), [phase-5-operator-qa-runbook.md](./phase-5-operator-qa-runbook.md) (**operator QA index** — read-only, mirror, sandbox, restore, Windows manual), [phase-4-windows-operator-quickstart.md](./phase-4-windows-operator-quickstart.md) (one-page deploy flow), [apps/desktop/README.md](../apps/desktop/README.md) (Windows checklist), [scripts/README.md](../scripts/README.md) (script index).

---

## Summary

| Layer | Windows posture |
| --- | --- |
| **Bridge / mirror / legacy CLIs** | **Cross-platform Node** — production/QA legacy scripts use **`node dist/cli/*.js`** after `pnpm build` (not `tsx`; see [phase-5-operator-qa-runbook.md](./phase-5-operator-qa-runbook.md)) |
| **Root `pnpm legacy:*` / `mirror:import-safe`** | **Cross-platform Node wrappers** — run directly from PowerShell/cmd after setting absolute env paths; bash fallbacks use explicit `:bash` suffixes |
| **`pnpm dev:*` port helpers** | **macOS dev-only** (`lsof`, `ps`) |
| **Sandbox QA** | **Cross-platform Node** (`pnpm qa:sandbox`) — builds bridge, starts `node dist/server.js`, runs four workflows with backup/restore and DBF readback; bash fallback remains `pnpm qa:sandbox:bash` |
| **Product UI batch** | Sandbox write pilot env, desktop first-run setup, Settings / mirror status — see table below |
| **Desktop app** | Electron + `node dist/server.js`; config under `%AppData%\Microdent\config.json` on Windows |

---

## Root `package.json` scripts

| `pnpm` script | Entry | Classification | Windows notes |
| --- | --- | --- | --- |
| `test` | npm workspaces test chain | **Cross-platform Node** | Primary read-only regression — run before MVP sign-off |
| `build:web` | `@microdent/web` build | **Cross-platform Node** | Required for desktop `file://` UI and deploy |
| `preview:web` | Vite dev | **Cross-platform Node** | Loopback dev; optional `VITE_SANDBOX_WRITE_PILOT` in `.env.local` |
| `dev:ports` | `scripts/dev-ports.sh` | **macOS dev-only** | Requires `lsof` via `dev-common.sh` |
| `dev:kill-ports` | `scripts/dev-kill-ports.sh` | **macOS dev-only** | `lsof` + `ps` + `kill` |
| `dev:bridge` | `scripts/dev-bridge.sh` | **macOS dev-only wrapper** | Bash env checks; runs `pnpm --filter @microdent/bridge dev` (Node works on Windows if run directly) |
| `dev:web` | `scripts/dev-web.sh` | **macOS dev-only wrapper** | Bash; underlying `pnpm --filter @microdent/web dev` is cross-platform |
| `mirror:import-safe` | `scripts/mirror-import-safe.mjs` | **Cross-platform Node** | Builds contracts/bridge, then runs `pnpm --filter @microdent/sqlite-mirror run import-safe`; bash fallback is `pnpm mirror:import-safe:bash` |
| `legacy:backup` | `scripts/legacy-command.mjs backup` | **Cross-platform Node wrapper** | Builds contracts/bridge, then runs `pnpm --filter @microdent/bridge run legacy-backup`; bash fallback: `pnpm legacy:backup:bash` |
| `legacy:create-sandbox` | `scripts/legacy-command.mjs create-sandbox` | **Cross-platform Node wrapper** | Builds contracts/bridge, then runs `pnpm --filter @microdent/bridge run legacy-create-sandbox`; bash fallback: `pnpm legacy:create-sandbox:bash` |
| `legacy:restore` | `scripts/legacy-command.mjs restore` | **Cross-platform Node wrapper** | Builds contracts/bridge, then runs `pnpm --filter @microdent/bridge run legacy-restore`; bash fallback: `pnpm legacy:restore:bash` |
| `legacy:backup-verify` | `scripts/legacy-command.mjs backup-verify` | **Cross-platform Node wrapper** | Builds contracts/bridge, then runs `pnpm --filter @microdent/bridge run legacy-backup-verify`; bash fallback: `pnpm legacy:backup-verify:bash` |
| `sandbox:validate` | Vitest in bridge | **Cross-platform Node** | No shell |
| `qa:sandbox` | `scripts/qa-sandbox-run.mjs` | **Cross-platform Node** | Native Windows/macOS/Linux sandbox proof; uses built `node dist/server.js` and direct `node dist/cli/*.js` backup/restore/readback |
| `qa:sandbox:bash` | `scripts/qa-sandbox-run.sh` | **Bash fallback** | Historical macOS/Git Bash runner for comparison |

### Workspace commands (no root `pnpm` alias)

| Command | Classification | Windows notes |
| --- | --- | --- |
| `pnpm --filter @microdent/desktop run build` | **Cross-platform Node** | Electron shell |
| `pnpm --filter @microdent/desktop run start` | **Cross-platform Node** | First-run setup → `%AppData%\Microdent\config.json` |
| `pnpm --filter @microdent/contracts run build` | **Cross-platform Node** | Prerequisite for bridge/mirror CLIs |
| `pnpm --filter @microdent/bridge run build` | **Cross-platform Node** | Produces `dist/server.js` and `dist/cli/*.js` |
| `pnpm --filter @microdent/bridge run dev` | **Cross-platform Node** | `tsx watch` — dev only, not QA |
| `node services/bridge/dist/server.js` | **Windows production-ready** | Set `DATA_ROOT`, `SQLITE_PATH`, `WRITE_MODE` in PowerShell first |

---

## `scripts/` files

| File | `pnpm` / usage | Classification | Dependencies / notes |
| --- | --- | --- | --- |
| `dev-common.sh` | Sourced by dev and historical fallback scripts | **macOS dev infrastructure** | `lsof`; production/operator root commands now use Node wrappers |
| `dev-ports.sh` | `pnpm dev:ports` | **macOS dev-only** | Lists listeners on 17890, 5173, 4173 |
| `dev-kill-ports.sh` | `pnpm dev:kill-ports` | **macOS dev-only** | SIGTERM/SIGKILL listeners on dev ports only |
| `dev-bridge.sh` | `pnpm dev:bridge` | **macOS dev-only wrapper** | Validates `DATA_ROOT`; exec bridge `dev` (tsx watch) |
| `dev-web.sh` | `pnpm dev:web` | **macOS dev-only wrapper** | Copies `.env.local.example`; exec Vite |
| `mirror-import-safe.mjs` | `pnpm mirror:import-safe` | **Cross-platform Node** | Requires absolute `DATA_ROOT` / `SQLITE_PATH`; use `pnpm mirror:import-safe:bash` only as the historical fallback |
| `legacy-command.mjs backup` | `pnpm legacy:backup` | **Cross-platform Node wrapper** | `DATA_ROOT`, `BACKUP_DIR`, `WORKFLOW` |
| `legacy-command.mjs create-sandbox` | `pnpm legacy:create-sandbox` | **Cross-platform Node wrapper** | `SOURCE_DATA_ROOT`, `SANDBOX_ROOT` |
| `legacy-command.mjs restore` | `pnpm legacy:restore` | **Cross-platform Node wrapper** | `BACKUP_MANIFEST`, `DATA_ROOT` |
| `legacy-command.mjs backup-verify` | `pnpm legacy:backup-verify` | **Cross-platform Node wrapper** | `BACKUP_MANIFEST`; optional `DATA_ROOT` |
| `legacy-*.sh` | `pnpm legacy:*:bash` | **Bash fallback** | Historical shell wrappers for comparison |
| `qa-sandbox-write-smoke.sh` | Manual / orchestrator | **macOS-oriented bash** | `curl`, `jq`, `sqlite3`, `realpath`; backup/restore via **direct** `node dist/cli/*.js` from `services/bridge` |
| `qa-sandbox-run.mjs` | `pnpm qa:sandbox` | **Cross-platform Node** | Builds bridge, `node services/bridge/dist/server.js`, four workflows, backup/restore, DBF readback |
| `qa-sandbox-run.sh` | `pnpm qa:sandbox:bash` | **Bash fallback** | Builds bridge, `node services/bridge/dist/server.js`, then bash smoke |

---

## Cross-platform Node CLIs (preferred on Windows)

Run from repo root after setting absolute PowerShell/cmd environment variables. The root `pnpm` commands build prerequisites before invoking the underlying workspace CLIs.

| Task | Command |
| --- | --- |
| Mirror import (safe tables) | `pnpm mirror:import-safe` |
| Legacy backup | `pnpm legacy:backup` |
| Create write sandbox | `pnpm legacy:create-sandbox` |
| Restore from backup | `pnpm legacy:restore` |
| Verify backup manifest | `pnpm legacy:backup-verify` |
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
| Bash fallbacks `[[ path != /* ]]` | Unix absolute-path guard in historical shell wrappers | On Windows, use root Node wrappers (`pnpm mirror:import-safe`, `pnpm legacy:*`) with drive-letter paths |

No `lsof`/`rsync` rewrites in this batch.

---

## Hard rules (operator)

| Rule | Requirement |
| --- | --- |
| Never live legacy as `DATA_ROOT` | Not `C:\Microdent\Microdent-Legacy` — use **`C:\Microdent\Legacy-Copy\DATA`** for read-only mirror import |
| Writes sandbox-only | `C:\Microdent\Write-Sandbox\DATA` + `.microdent-write-sandbox.json` |
| No new write domains | Four sandbox workflows; no payments, memos, ledger writes in MVP |
| QA bridge/CLI | `node dist/server.js` and `node dist/cli/*.js` — not `tsx` in smoke/orchestrator |

---

## Windows operator quick start

See **[phase-6-windows-mvp-operator-guide.md](./phase-6-windows-mvp-operator-guide.md)** for the full Windows MVP path (Node 22 → build → desktop → mirror → read-only smoke → pilot → `pnpm qa:sandbox`). Compact deploy: **[phase-4-windows-operator-quickstart.md](./phase-4-windows-operator-quickstart.md)**. Detailed QA tracks: **[phase-5-operator-qa-runbook.md](./phase-5-operator-qa-runbook.md)**.

---

## Deferred (explicit non-goals)

| Item | Status |
| --- | --- |
| **`lsof` / port-kill replacement** | Deferred — `dev:ports` / `dev:kill-ports` remain macOS dev-only |
| **NSIS / signed desktop installer** | Deferred — desktop MVP is unpackaged Electron + config file |
| **Env-driven `FORBIDDEN_LEGACY_*` overrides** | Future — clinic-specific forbidden roots remain deployment-specific |

Other follow-ups (non-blocking): env-driven forbidden-root overrides for non-macOS clinic paths.
