# Clinic structure & workflow UX batch report — 2026-06-03

**Wave:** 4 (P + O) — browser structural QA, checkpoint, conditional commit  
**Baseline:** `bdb5a82` — pre-structure commit target  
**Branch:** `main` (pre-commit)

## Structural change summary

| Page | Removed (main UI) | New structure | Browser @ 1600 / 1200 |
|------|-------------------|---------------|------------------------|
| **Today** | `clinic-stat-grid--five`, 6-row glance, pilot notes | `clinic-workspace-grid` 8+4; schedule-first; `clinic-status-compact` (3 rows); continue strip | **PASS** |
| **Patients** | Long instruction blocks | `clinic-col-7` + `clinic-col-5`; search-led results; aside recent / opens-next / safety | **PASS** |
| **Schedule** | 5-up stat cards as hero | Hero controls + `clinic-schedule-summary-strip` + board | **PASS** |
| **Profile** | 6 diagnostic stat cards | `clinic-profile-workflow-strip` (5 metrics) + summary two-column grid | **PASS** (NASSER ISMAIL, record 158) |
| **Settings** | — (absorbs diagnostics) | `clinic-settings-readiness-grid` + grouped panels (technical terms OK) | **PASS** |

**`browser_structurally_changed: true`** — all five surfaces use workflow-first DOM; main pages no longer match prior diagnostics-first layout (5-card Today strip, 6-row glance, stat-card heroes on Schedule/Profile).

## Technical UI moved to Settings

- Mirror / write / backup / sandbox pilot detail rows removed from Today glance
- Pilot notes panel removed from Today (operator notes in Settings **Field test & pilot notes**)
- `resolveTodayClinicStatus()` — 3 friendly rows on Today; full diagnostics in Settings readiness + grouped sections

## Jargon replacements (main pages)

| Technical (internal) | Clinic-friendly (main UI) |
|----------------------|---------------------------|
| SQLite mirror | Local copy |
| DBF fallback | Using copied clinic files |
| write mode / writes off | Read-only / Editing |
| bridge offline | Clinic service offline |
| sandbox write pilot (chrome) | (absent on main header; Settings only) |

**DOM grep (main `main` regions):** zero hits for `SQLite`, `DBF fallback`, `mirror stale`, `write mode`, `sandbox write pilot`, `Clinic at a glance`, `Pilot notes`, `.clinic-stat-grid--five` on Today / Patients / Schedule / Profile with bridge connected.

## Browser proof (Workstream P)

**Environment:** `pnpm dev:web` @ `http://127.0.0.1:5173`; bridge `DATA_ROOT=/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA` @ `:17890` (after **Dev connection details** health probe).

**Viewports:** CDP `Emulation.setDeviceMetricsOverride` at **1600×900** and **1200×900**; structural selectors verified via `Runtime.evaluate` + accessibility snapshot.

| Check | 1600 | 1200 |
|-------|------|------|
| Today: `.clinic-workspace-grid`, `.clinic-col-8`/`.clinic-col-4`, no `.clinic-stat-grid--five`, 3 status rows | PASS | PASS |
| Patients: `.clinic-col-7`/`.clinic-col-5` | PASS | PASS |
| Schedule: `.clinic-schedule-summary-strip`, no stat-five | PASS | PASS |
| Profile: `.clinic-profile-workflow-strip` (5 items), no `.clinic-profile-stat-grid` | PASS | PASS |
| Settings: `.clinic-settings-readiness-grid` | PASS | PASS |
| Main-page jargon grep | PASS | PASS |

**Screenshots:** Browser MCP `browser_take_screenshot` timed out in this run; structural acceptance relies on DOM probes + snapshots above.

## Checkpoint table

| Step | Result |
|------|--------|
| `nvm use 22` | OK (v22.22.3) |
| `pnpm test` | OK |
| `pnpm test:pilot-artifacts` | OK (13) |
| `pnpm build:web` | OK |
| `pnpm --filter @microdent/bridge run build` | OK |
| `pnpm --filter @microdent/desktop run build` | OK |
| `pnpm --filter @microdent/desktop run test` | OK (67) |
| `pnpm --filter @microdent/desktop run release-smoke` | OK |
| `pnpm stage:pilot-release` | OK (244 files) |
| `pnpm pilot:verify-release` | OK |
| `pnpm pilot:verify-manifest` | OK (pre-commit `bdb5a82…`) |
| `pnpm qa:sandbox` | OK (4 workflows; port 17890 freed first) |
| `pnpm pilot:mac-release-status` | Tier 2 READY; Tier 3 Deferred |
| Gates 18–20 (structural browser + workflow-first + responsive) | **PASS** |

**Sandbox env (`qa:sandbox`):**

- `DATA_ROOT=/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA`
- `SQLITE_PATH=/Users/Tamam/Desktop/Microdent/MICRODENT_MIRROR_SANDBOX.sqlite`
- `BACKUP_DIR=/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/backups`

## Commit

**Message:** `feat: redesign clinic app structure and workflow UX`  
**Commit:** `feat: redesign clinic app structure and workflow UX` — verify with `git log -1 --oneline` (48 files; includes `PatientSearchBar` empty-state `body` fix for `pnpm build:web`)

## Deferred

- Windows field execution (Tier 3) — not run this batch
- Full screenshot archive — MCP capture timed out; DOM proof retained
