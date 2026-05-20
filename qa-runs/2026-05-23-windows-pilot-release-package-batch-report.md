# Windows pilot release package batch report — A–M (2026-05-23)

**Repo:** `/Users/Tamam/Desktop/Microdent/Microdent-Modern`  
**Plan:** `windows_pilot_release_package_756c0d87.plan.md`  
**Branch:** `main` (uncommitted working tree)  
**HEAD:** `3fc31c4acf078ce8a3117bbe813c982fea971bf7`  
**Coordinator:** Agent_FinalReport (WORKSTREAM M)  
**Checkpoint host:** macOS (darwin), Node **v22.22.3** (`nvm use 22`)  
**Commit policy:** User requested **no commit** — none performed.

---

## Executive summary

| Gate | Result |
| --- | --- |
| **Mandatory checkpoint (M)** | **PASS** (after M-scope fixes) |
| `pnpm test` | **PASS** |
| `pnpm test:pilot-artifacts` | **PASS** (7 tests) |
| `pnpm build:web` | **PASS** |
| Bridge + desktop `build` | **PASS** |
| `pnpm stage:pilot-release` | **PASS** (231 files, 24 directories) |
| `pnpm pilot:verify-release` | **PASS** (after supervisor bundle check fix) |
| `pnpm pilot:verify-manifest` | **PASS** (230 files, commit pinned in manifest) |
| Desktop `test` + `release-smoke` (dev + staged) | **PASS** |
| `pnpm qa:sandbox` (explicit env) | **PASS** — sandbox paths present; 4 write workflows + restore |
| `pnpm pilot:release-signoff` | **FAIL** on coordinator re-run — `EPERM` creating backup dir under Write-Sandbox (see § Signoff) |
| **Safe to commit?** | **Conditional yes** — automated gates green; re-run strict signoff on host with backup write access before IT handoff |

Waves 1–2 were reported complete by parent agents. WORKSTREAM M ran the full mandatory checkpoint, repaired regressions from Wave 2 UI copy (missing `read-only-ui-copy` exports + test expectations), and aligned `verify-pilot-release` with `runtime-install-root.js` (bridge entry resolution moved out of `bridge-supervisor.js`).

---

## Mandatory checkpoint (command log)

| Step | Result | Notes |
| --- | --- | --- |
| `nvm use 22` | **PASS** | v22.22.3 |
| `pnpm test` | **PASS** | Initial fail: `@microdent/app` `tsc` missing exports + 2 copy tests; fixed in M |
| `pnpm test:pilot-artifacts` | **PASS** | `scripts/pilot-release-artifacts.test.mjs` — 7/7 |
| `pnpm build:web` | **PASS** | Vite production build |
| `pnpm --filter @microdent/bridge run build` | **PASS** | |
| `pnpm --filter @microdent/desktop run build` | **PASS** | |
| `pnpm stage:pilot-release` | **PASS** | `[stage-pilot-release] OK — staged 231 files in 24 directories` |
| `pnpm pilot:verify-release` | **PASS** | First attempt failed: staged `bridge-supervisor.js` no longer contains literal `server.js`; fixed verifier to include `runtime-install-root.js` |
| `pnpm pilot:verify-manifest` | **PASS** | `[verify-pilot-manifest] OK — 230 files verified` |
| `pnpm --filter @microdent/desktop run test` | **PASS** | 65 tests |
| `pnpm --filter @microdent/desktop run release-smoke` | **PASS** | Dev tree |
| `PILOT_STAGED_RELEASE=1` … `release-smoke` | **PASS** | Staged `dist/pilot-release/MicrodentModern/` |
| `pnpm qa:sandbox` | **PASS** | Env: `DATA_ROOT`, `SQLITE_PATH`, `BACKUP_DIR` under Write-Sandbox; mirror advisory warns partial/failed table imports (non-fatal) |
| `pnpm pilot:release-signoff` | **FAIL** | Without env: `DATA_ROOT unset`. With env: `EPERM` on `mkdir` under `…/Microdent-Write-Sandbox/backups/` during signoff’s embedded `qa:sandbox` (isolated `pnpm qa:sandbox` succeeded earlier on same paths) |

### Sandbox QA (signoff narrative)

| Check | Result |
| --- | --- |
| `DATA_ROOT` exists | **Yes** — `Microdent-Write-Sandbox/DATA` |
| `SQLITE_PATH` exists | **Yes** — `MICRODENT_MIRROR_SANDBOX.sqlite` |
| `BACKUP_DIR` exists | **Yes** — `Microdent-Write-Sandbox/backups` |
| **Sandbox signoff-ready?** | **Yes** (paths present; write smoke passed via `pnpm qa:sandbox`) |

---

## WORKSTREAM M fixes (no new write domains)

1. **`packages/app/src/read-only-ui-copy.ts`** — Restored exports removed during copy polish but still imported by Today/Patients/Schedule/Profile/Settings (`TODAY_*`, `PATIENT_*`, `READONLY_STATE_RETRY`, `SETTINGS_SQLITE_MIRROR_UNKNOWN`, etc.). Pilot banner copy from Wave 2 retained.
2. **`packages/app/src/app-shell.test.tsx`** — Privacy banner assertion updated to match `READ_ONLY_BANNER_BODY` (“payment amounts stay hidden”).
3. **`packages/app/src/appointment-status-write.test.tsx`** — Expectations updated for `SANDBOX_WRITE_PILOT_PANEL_BANNER` (“Sandbox write pilot” / “disposable DATA”).
4. **`scripts/verify-pilot-release.mjs`** — `server.js` invariant now checks `bridge-supervisor.js` + `runtime-install-root.js` (packaged entry resolution).

---

## Pass / fail table (user-facing)

| Command | Pass/Fail |
| --- | --- |
| `pnpm test` | **PASS** |
| `pnpm test:pilot-artifacts` | **PASS** |
| `pnpm build:web` | **PASS** |
| `pnpm --filter @microdent/bridge run build` | **PASS** |
| `pnpm --filter @microdent/desktop run build` | **PASS** |
| `pnpm stage:pilot-release` | **PASS** |
| `pnpm pilot:verify-release` | **PASS** |
| `pnpm pilot:verify-manifest` | **PASS** |
| `pnpm --filter @microdent/desktop run test` | **PASS** |
| `pnpm --filter @microdent/desktop run release-smoke` | **PASS** |
| `PILOT_STAGED_RELEASE=1` desktop `release-smoke` | **PASS** |
| `pnpm qa:sandbox` (explicit env) | **PASS** |
| `pnpm pilot:release-signoff` | **FAIL** (EPERM on backup mkdir during coordinator re-run) |

---

## Safe to commit?

| Question | Answer |
| --- | --- |
| Tests / builds / stage / verify / manifest / desktop smoke | **Yes** |
| Sandbox write proof (`qa:sandbox`) | **Yes** on disposable sandbox with env set |
| Strict `pilot:release-signoff` | **No** — re-run on operator machine: `export DATA_ROOT SQLITE_PATH BACKUP_DIR` then `pnpm pilot:release-signoff` |
| PHI / runtime data in git tree | **No tracked `.sqlite`, DATA, backups, or `dist/pilot-release/`** (verify before `git add`) |
| Review focus | Staging/manifest scripts (untracked), `read-only-ui-copy.ts` churn, desktop `runtime-install-root` + supervisor split, new docs (`PILOT-HANDOFF-PACK.md`, `windows-pilot-real-machine-checklist.md`) |

---

## Blockers / follow-ups

1. **`pnpm pilot:release-signoff`** — Run locally with full filesystem permission to Write-Sandbox `backups/` (coordinator hit `EPERM` on re-run after successful standalone `pnpm qa:sandbox`).
2. **Real Windows field matrix** — Fill [`docs/windows-pilot-real-machine-checklist.md`](docs/windows-pilot-real-machine-checklist.md) on a Windows PC (Workstream L).
3. **Mirror import advisory** — Sandbox mirror reports partial/failed table imports; DBF remains write source of truth; refresh mirror before pilot if search/schedule freshness matters.
4. **Packaging gap** — Installer/NSIS and bundled Node for bridge child remain documented gaps (see `windows-pilot-packaging-gap-report.md`).

---

## Git status (end of M)

- **Modified:** 30 files (+712 / −549 lines) — desktop packaging/runtime, app copy/tests, stage/verify scripts, docs, `package.json`, bridge inventory test.
- **Untracked:** `runtime-install-root.{ts,test.ts}`, `vitest.config.mjs`, `apps/desktop/vitest.config.ts`, `docs/PILOT-HANDOFF-PACK.md`, `docs/windows-pilot-real-machine-checklist.md`, `scripts/pilot-release-{artifact-rules,artifacts.test,manifest,signoff}.mjs`, `scripts/verify-pilot-manifest.mjs`.
- **Generated (ignored):** `dist/pilot-release/MicrodentModern/` including `MANIFEST.json` / `HANDOFF-README.txt`.
- **This report:** `qa-runs/2026-05-23-windows-pilot-release-package-batch-report.md` (untracked unless `qa-runs/` is committed by policy).

---

## Recommended next batch (from plan)

1. Real Windows execution log from real-machine checklist  
2. electron-builder / NSIS spike with written justification  
3. Cross-platform `qa-sandbox-run.mjs` for Windows without Git Bash  
4. Bundled Node 22 for bridge child process  
5. CI: `pilot:release-signoff` on release tag with sandbox secrets/paths  
