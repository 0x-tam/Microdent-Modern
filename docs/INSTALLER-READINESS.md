# Installer Readiness — Microdent-Modern

**Date:** 2026-05-29  
**Status:** Planning only — no installer, no new packaging dependencies  
**Supersedes / consolidates:** windows-pilot-installer-decision-record, windows-pilot-packaging-gap-report, windows-pilot-pre-installer-checklist, windows-pilot-release-layout, phase-3-desktop-packaging-plan

---

## 1. Current packaging state

### What exists

| Component | Status | Details |
| --- | --- | --- |
| **Electron desktop shell** | ✅ Implemented | `apps/desktop/` — spawns Node bridge child, loads `file://` web dist |
| **Portable pilot release** | ✅ Implemented | `pnpm stage:pilot-release` → `dist/pilot-release/MicrodentModern/` |
| **Release verification** | ✅ Implemented | `pnpm pilot:verify-release`, `pnpm pilot:verify-manifest` |
| **Sandbox QA** | ✅ Implemented | `pnpm qa:sandbox` — DBF readback, 4 workflows |
| **First-run setup UI** | ✅ Implemented | Path validation, `writeMode: disabled` default, `%AppData%\Microdent\config.json` |
| **Bridge production mode** | ✅ Implemented | `node services/bridge/dist/server.js` on `127.0.0.1:17890` |
| **Artifact safety rules** | ✅ Implemented | `scripts/pilot-release-artifact-rules.mjs` — forbids DBF, sqlite, env, exe, legacy paths |

### What is NOT configured

| Component | Status |
| --- | --- |
| **electron-builder** | ❌ Not in `package.json` (any workspace) |
| **electron-builder config** | ❌ No config file exists |
| **NSIS / MSI scripts** | ❌ Not implemented |
| **Code signing (Authenticode)** | ❌ Not purchased or configured |
| **Auto-update** | ❌ Not implemented |
| **Bundled Node 22** | ❌ Uses system `node.exe` |
| **Packaging scripts** | ⚠️ `build` in desktop only — no `build:desktop` root script |

### Current build scripts (root `package.json`)

| Script | What it does |
| --- | --- |
| `build:web` | Builds `@microdent/web` (with prebuild of contracts, bridge-client, ui, app) |
| `desktop:release-smoke` | Builds desktop, runs tests, runs release-smoke check |
| `stage:pilot-release` | Stages portable `MicrodentModern/` tree |
| `pilot:verify-release` | Validates staged tree layout + manifest hashes |

**Gap:** No single root script that builds **web → desktop** in order. (Bridge is built separately via `npm run build --workspace=@microdent/bridge`.)

---

## 2. Recommended Windows packaging path

### Decision: Electron + NSIS via electron-builder (deferred)

| Phase | Choice | Justification |
| --- | --- | --- |
| **Now (pilot handoff)** | Portable zip | `stage:pilot-release` + `RELEASE-MANIFEST.json` + `pilot:verify-release` give IT tamper checks; no new deps |
| **After Windows field test (tier 3 GO)** | NSIS via electron-builder spike | Proven runtime on real PCs; document script paths, signing cert, `%AppData%` vs install dir before adding electron-builder |
| **Later** | MSI only if IT requires GPO/SCCM | Higher cost; portable + NSIS may suffice |
| **Out of this batch** | Authenticode cert, auto-update feed | See out-of-scope guardrails |

**Why Electron (not Tauri / Service):**

- Bridge is already Node/Express — Electron's main process spawns the same `server.js` with identical env vars
- Mirror import needs Node ≥ 22.5 — Electron packaging solves "ship a known Node"
- Fastest path to "no terminals" for clinic staff
- electron-builder supports NSIS, code signing, and auto-update in one toolchain

**Why deferred:** Clinic go-live is **BLOCKED** until tier 3 (real Windows PC field test) completes with a PHI-safe field log and go/no-go GO. See §12 for prerequisites.

---

## 3. Code signing requirements

| Requirement | Status | Notes |
| --- | --- | --- |
| **Authenticode certificate** | Not purchased | Required for SmartScreen confidence; purchase out-of-band |
| **EV certificate** | Optional | Eliminates SmartScreen reputation building period; higher cost |
| **What gets signed** | Documented | Electron `.exe`, NSIS setup `.exe`, optionally bundled `node.exe` |
| **SmartScreen behavior** | Documented | Unsigned: "Unrecognized app" → "More info → Run anyway". Signed: better narrative; may still prompt once |
| **Signing pipeline** | Not implemented | Will integrate with electron-builder `win.certificateSubjectName` or `sign` option |

**Note:** Signing cert purchase is explicitly out of the pilot RC batch. Document the plan; purchase after tier 3 GO.

---

## 4. AppData config path (Windows)

| Layer | Path | Rule |
| --- | --- | --- |
| **Operator config** | `%AppData%\Microdent\config.json` | Created on first save; contains `DATA_ROOT`, `SQLITE_PATH`, `BRIDGE_PORT`, `writeMode: "disabled"` default |
| **Logs** | `%AppData%\Microdent\logs\` | Optional; bridge stdout/stderr, import summaries; PHI-safe only |
| **Backups** | `%AppData%\Microdent\backups\` (or operator-chosen) | Mirror pre-import copies; not in install tree |
| **SQLite mirror** | `%LocalAppData%\Microdent\mirror\MICRODENT_MIRROR.sqlite` | Writable; not beside read-only copy; forbid UNC paths |

**Installer rule:** Installer must **never** copy sandbox DATA, sqlite, or backups into Program Files or the install tree. Config lives in `%AppData%`; data lives outside.

---

## 5. Local service packaging (bridge/runtime in installer)

| Component | Current | Installer plan |
| --- | --- | --- |
| **Bridge** | `services/bridge/dist/server.js` — Node child | Copy to `extraResources` or app asar unpacked; spawn as child |
| **Node runtime** | System `node.exe` on PATH | Bundle portable Node 22.5+ as sidecar (`extraResources/node/`) or use Electron's embedded Node |
| **Mirror import** | `pnpm mirror:import-safe` CLI | Bundle same `sqlite-mirror` import entry; invoke via main-process menu action |
| **Web UI** | `apps/web/dist/` static | Load via `file://` or serve from bridge on loopback |

**Bridge spawn invariant:** `spawn(node, [bridgeEntry])` only — no `.bat`/`.cmd`/foxpro/legacy argv.

---

## 6. Local copy path

| Artifact | Location | Rule |
| --- | --- | --- |
| **DATA_ROOT** (DBF sandbox) | Operator-chosen, e.g. `D:\MicrodentData\DATA` or `C:\ClinicData\Microdent\DATA` | **Local SSD strongly preferred**; never `Microdent-Legacy`; must be read-only copy |
| **Import source** | `Microdent-Legacy-Copy/DATA/*.DBF` (+ `.CDX`, `.FPT`) | Read-only; refreshed by operator copy job |
| **Legacy (untouched)** | `Microdent-Legacy/` | Never read or modify |

**First-run wizard:** Folder picker → validate `DATA_ROOT` (absolute, exists, contains DBF) → test `GET /health` → confirm Connected.

---

## 7. Backups and logs path

| Item | Location | Priority |
| --- | --- | --- |
| **Legacy DATA copy** (`DATA_ROOT`) | Bit-for-bit copy including `.CDX`, `.FPT`, `.DBC`; store off-machine | Critical |
| **SQLite mirror** | File copy while bridge stopped or after import; auto pre-import copy to `%AppData%\Microdent\backups\mirror-YYYYMMDD-HHMMSS.sqlite` | Medium |
| **config.json** | `%AppData%\Microdent\config.json` — small; include in clinic backup policy | High |
| **Logs** | `%AppData%\Microdent\logs\` — rotate; no PHI by design | Low |

**Packaged behavior (MVP):** No automatic legacy backup from Modern. Optional pre-import mirror backup.

---

## 8. Update strategy

| Channel | Audience | Mechanism |
| --- | --- | --- |
| **Stable** | Production clinics | Signed NSIS installer via electron-builder |
| **Beta** | Pilot site | Optional second feed |

**Mechanics:**
- `electron-updater` checking HTTPS release manifest
- Download in background; prompt restart
- Bridge stops cleanly before swap
- Config migration: version field in `config.json`; preserve `DATA_ROOT` / `SQLITE_PATH` across upgrades
- Keep previous installer offline for IT rollback

**Out of pilot scope:** Auto-update feed implementation.

---

## 9. Support/debug package

| Component | Purpose |
| --- | --- |
| **RELEASE-MANIFEST.json** | SHA-256 per-file hash; `packageVersion`, `releaseChannel`, `gitCommit`, `unsupportedFeatures[]` |
| **web/pilot-build.json** | Safe build metadata subset for Settings UI — no paths |
| **PILOT-START-HERE.md** | First-click pointer for operators |
| **HANDOFF-README.txt** | IT install + validation steps (PHI-safe) |
| **docs/** | Pilot handoff copies (no PHI) |
| **verify scripts** | `pnpm pilot:verify-release` (layout + hashes), `pnpm pilot:verify-manifest` (hashes only) |
| **Windows spot-check** | `docs/windows-pilot-package-verify-on-windows.md` — manual IT verification without pnpm |

**Support hygiene:** Logs use `maskOperatorPath`; no patient names, DBF files, full config paths, or `.env` contents in tickets.

---

## 10. First-run flow in installer context

1. **App launches** → reads `%AppData%\Microdent\config.json` (or detects missing)
2. **Setup wizard** (if no config):
   - Explain: Modern reads a **copy**, not live FoxPro
   - Folder picker → set `DATA_ROOT` → validate presence of DBF files
   - Optional: enable mirror → set `SQLITE_PATH` (default under `%LocalAppData%`)
   - Test `GET /health` → show Connected status
3. **Bridge spawns** with injected env (`DATA_ROOT`, `SQLITE_PATH`, `BRIDGE_HOST=127.0.0.1`, `BRIDGE_PORT`)
4. **Main polls** `GET /health` with backoff (2–15 s) before showing UI window
5. **Window opens** → loads `file://` web dist or loopback UI
6. **Settings** shows mirror status via `GET /v1/mirror/status`
7. **writeMode** defaults to `"disabled"` (intentional — no toggle in UI)

---

## 11. No manual bridge requirement

**Goal:** Clinic staff never see `pnpm`, PowerShell, or terminal windows.

| Current | Installer target |
| --- | --- |
| Operator runs `pnpm dev:bridge` + `pnpm preview:web` | Single `.exe` launches Electron main |
| Bridge started manually in terminal | Main spawns bridge as supervised child process |
| Operator sets env vars in shell | Main reads `config.json` → injects env into bridge child |
| Bridge crashes → orphan process | Main detects crash → shows Offline banner → auto-restart once with backoff |
| User closes terminal → bridge dies | Tray: Open / Health / Import / Quit; minimize-to-tray default on clinic desktops |

**Bridge lifecycle:**
- **Start:** Main → spawn `node [bridgeEntry]` → poll `/health` → show UI
- **Quit:** SIGTERM bridge → wait ≤5 s → SIGKILL if needed → exit app
- **Window close:** Default minimize to tray (avoid accidental stop); optional "Quit on close" setting
- **Crash:** Show Offline → auto-restart once → log to `%AppData%\Microdent\logs\`

---

## 12. What needs to happen next

### Immediate (Mac-first — current batch)

| Priority | Action | Tier |
| --- | --- | --- |
| **1** | Portable zip handoff; Mac signoff via `pnpm pilot:release-signoff` | Tier 1 |
| **2** | Field pack docs committed to git (`FIELD-TEST-START-HERE.md`, execution script, result form, go/no-go, verify-on-Windows) | Tier 2 |
| **3** | Add `build:desktop` root script (safe, no new deps — see §13) | Mac dev |

### Blocked until Windows field test completes

| Priority | Action | Blocked until |
| --- | --- | --- |
| **1** | Execute field script on clinic PC; file PHI-safe log; complete go/no-go | Tier 3 — **blocks clinic go-live** |
| **2** | Mac-first completion checklist M1–M7 (installer decision record) | Tier 3 GO |
| **3** | NSIS spike (document acceptance criteria N1–N8 — no `electron-builder` dep until approved) | M1–M7 green |
| **4** | Authenticode cert purchase | Post-spike approval |
| **5** | Add `electron-builder` dependency + `build:installer` script | After spike plan approved |
| **6** | Bundled Node 22 decision (sidecar vs Electron embedded) | Post-spike |

### Mac-first completion gates (M1–M7) before NSIS spike

| Gate | Requirement |
| --- | --- |
| M1 | `pnpm pilot:release-signoff` prints `PILOT RELEASE SIGNOFF: READY` |
| M2 | Field pack docs present in staged `MicrodentModern/docs/` |
| M3 | Field pack committed to git |
| M4 | One real clinic PC run logged (PHI-safe `qa-runs/` field log) |
| M5 | Go/no-go checklist completed with **GO** |
| M6 | All `Requires Windows PC` rows executed on clinic hardware |
| M7 | No open Fail rows on field result form |

---

## 13. Package script improvements (implemented)

### Added: `build:desktop` root script

A new root script chains web + desktop build in the correct order:

```json
"build:desktop": "pnpm build:web && pnpm --filter @microdent/desktop run build"
```

This is a **safe, dependency-free** addition that:
- Builds the web app first (so `apps/web/dist/` exists for Electron to load)
- Then builds the desktop Electron shell (TypeScript compile + copy preload/setup files)
- Does not install any new dependencies
- Does not touch bridge build (that remains separate; bridge is built via workspace build)

### Current script chain for full release

```
pnpm build:web          → apps/web/dist/
(pnpm --filter @microdent/bridge run build)  → services/bridge/dist/ (separate)
pnpm build:desktop      → apps/desktop/dist/ (includes build:web)
pnpm stage:pilot-release → dist/pilot-release/MicrodentModern/
pnpm pilot:verify-release → validates layout + hashes
```

---

## Related docs

| Doc | Use when |
| --- | --- |
| [windows-pilot-installer-decision-record.md](./windows-pilot-installer-decision-record.md) | Detailed option comparison, decision log, Mac-first checklist |
| [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md) | Honest gap assessment, risk summary, test matrix |
| [windows-pilot-pre-installer-checklist.md](./windows-pilot-pre-installer-checklist.md) | Manual IT/operator steps until installer exists |
| [windows-pilot-release-layout.md](./windows-pilot-release-layout.md) | Staged tree reference, artifact rules |
| [windows-pilot-package-verify-on-windows.md](./windows-pilot-package-verify-on-windows.md) | Manual Windows spot-check without pnpm |
| [phase-3-desktop-packaging-plan.md](./phase-3-desktop-packaging-plan.md) | Full packaging architecture, bridge lifecycle, security model |
| [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) | What is explicitly out of pilot scope |
| [PILOT-START-HERE.md](./PILOT-START-HERE.md) | Three-tier pilot status overview |
