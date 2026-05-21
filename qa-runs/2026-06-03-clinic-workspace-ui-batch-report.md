# Clinic workspace UI batch report — 2026-06-03

**Wave:** 4 (P + Q + R + S) — proof, safety, checkpoint, commit gate  
**Baseline:** `5cd3d13` — prior redesign commit  
**Branch:** `main` (pre-commit)

## Root cause (why prior batches looked like a pale admin panel)

| Issue | Fix (Waves 0–3) |
|-------|------------------|
| ~765 lines inline hub CSS in `app-shell.css` beat imported redesign sheets | Hub block removed; rules migrated to `shell-layout.css` / page sheets |
| Incremental `app-*` layering on same DOM | New `clinic-*` primitives + restructured page DOM on all five key pages |
| `workspace-redesign.css` competed with hub overrides | `clinic-design-system.css` imported **last**; cascade-guard enforces order |
| Generic `.app-board-panel` everywhere | `ClinicPanel`, `clinic-command-grid`, `clinic-list-card`, `clinic-empty-state` |

## Layout-by-page verification (Browser MCP)

**Environment:** `pnpm dev:web` @ `http://127.0.0.1:5173`, bridge @ `http://127.0.0.1:17890`, `DATA_ROOT=Microdent-Legacy-Copy/DATA`.

| Page | Spec elements | Browser result |
|------|---------------|----------------|
| **Today** | `clinic-page-hero`, `clinic-stat-grid--five`, `clinic-command-grid`, glance status rows | Pass — hero + 5 stat cards + 2/3\|1/3 grid; chips not `<dl>`; connected state shows live metrics |
| **Patients** | Hero, `clinic-command-grid` 2/3\|1/3, list cards | Pass — workflow layout in DOM; search panel + aside cards (Recent, safety, opens-next) |
| **Schedule** | Hero, stat summary, toolbar, board groups / list cards | Pass — hero + 5-up stat row + filters; empty range shows `clinic-empty-state` (no appts in test week) |
| **Profile** | Hero, 6 stat cards, pill tabs, summary grid | Pass — NASSER ISMAIL record: hero, tabs (Summary active), at-a-glance row |
| **Settings** | Readiness grid (7 cards) | Pass — `clinic-settings-readiness-grid` + detailed `clinic-panel` sections |
| **Shell** | Sidebar 250–280px teal-tinted | Pass — `clinic-sidebar`, brand band, glyph nav with subtitles |

**`browser_matches_spec: true`** — rendered UI uses the clinic layout system on all five pages; warm `#f5fafb` canvas and teal rail are visible (not legacy flat gray admin).

Screenshots (local temp): `wave4-today.png`, `wave4-patients.png`, `wave4-schedule.png`, `wave4-settings.png`, `wave4-profile.png`, `wave4-today-1440.png`.

## Workstream Q — Safety

- Forbidden-token coverage: `clinic-page.test.tsx`, `clinic-stat-card.test.tsx`, `clinic-components.test.tsx`, existing page tests (`read-only-flow-smoke`, `patient-profile-panel`, etc.)
- Fixed stale `app-shell.test.tsx` expectations for sidebar hint + Today hero subtitle
- Fixed CSS build blocker: unclosed rule at end of `today.css` (migrated hub chip block)

## Checkpoint table

| Step | Result |
|------|--------|
| `nvm use 22` | OK (v22.22.3) |
| `pnpm test` | OK (458 app tests after shell test fix) |
| `pnpm test:pilot-artifacts` | OK (13) |
| `pnpm build:web` | OK (after `today.css` brace fix) |
| `pnpm --filter @microdent/bridge run build` | OK |
| `pnpm --filter @microdent/desktop run build` | OK |
| `pnpm --filter @microdent/desktop run test` | OK (67) |
| `pnpm --filter @microdent/desktop run release-smoke` | OK |
| `pnpm stage:pilot-release` | OK (244 files) |
| `pnpm pilot:verify-release` | OK |
| `pnpm pilot:verify-manifest` | OK (commit `5cd3d13…` in manifest) |
| `pnpm qa:sandbox` | OK (4 write workflows) |
| `pnpm pilot:mac-release-status` | Tier 2 READY; Tier 3 Deferred |
| Commit gate 18–19 (browser layout) | **PASS** |

## Commit

**Message:** `feat: implement modern clinic workspace UI redesign`  
**Commit hash:** _(filled after commit)_

## Deferred

- Windows field execution (Tier 3) — not run this batch
- Schedule board group screenshot with dense appointment data (structure verified; test week had 0 appointments)
