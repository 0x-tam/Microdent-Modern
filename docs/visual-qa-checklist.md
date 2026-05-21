# Visual QA Checklist — Clinic Workspace UI Rebuild (Waves 0–4)

Manual + browser verification for the `clinic-*` layout system. Screenshots captured 2026-05-22 via Browser MCP (`pnpm dev:web` + bridge on Legacy-Copy DATA).

**`browser_matches_spec: yes`** — layout DOM matches [clinic-workspace-layout-spec.md](./clinic-workspace-layout-spec.md); warm teal clinic canvas (not legacy pale admin panel).

## Global shell

- [x] Full viewport width — `clinic-workspace-main` uses `--clinic-page-max: min(1680px, 100%)`
- [x] Rail **250–280px** (`--clinic-sidebar-w: clamp(250px, 17vw, 280px)`) with teal brand band, glyph nav rows, patient card, connection footer
- [x] Teal identity at first glance (brand subtitle “Modern clinic workspace”, active nav left accent)
- [x] Read-only mode as header `clinic-status-pill`, not full-width banner
- [x] Status in compact header cluster (critical contextual banners in panels when needed)
- [x] Body text **16px** minimum on workspace surfaces (`--clinic-text-body`)
- [x] Focus rings on rail nav, search, filters, buttons
- [x] Warm workspace canvas (`--clinic-bg: #f5fafb`) / rail tint — not flat gray admin
- [x] `clinic-design-system.css` loaded last in `app-shell.css` (cascade-guard)

## Today

- [x] `.clinic-page-hero` — title + subtitle + date meta + status chips
- [x] `.clinic-stat-grid--five` — Appointments today, Next visit, Schedule, Data freshness, Write mode (+ Sandbox pilot panel)
- [x] `.clinic-command-grid` — 2/3 appointments panel + 1/3 Now / Clinic at a glance / Quick actions / Pilot notes
- [x] **Clinic at a glance** — `clinic-status-row` chips (not `<dl>` table)
- [x] Empty / offline — `clinic-empty-state` with accent + CTA
- [x] Connected bridge: stat values populate; empty day uses operational empty panel

## Patients

- [x] `.clinic-page-hero` + read-only chip
- [x] `.clinic-command-grid` — 2/3 results + 1/3 Recent / safety / opens-next cards
- [x] Search in `clinic-panel`; results as `clinic-list-card` when populated
- [x] Keyboard nav + offline banner preserved

## Profile

- [x] `.clinic-page-hero` / `clinic-profile-hero` — display name, chart, provider chips
- [x] `.clinic-profile-stat-grid` — six at-a-glance stat cards
- [x] Segmented tabs **44px** — Summary | Timeline | Appointments | Medical | Treatments | Chart | Ledger
- [x] Summary uses `clinic-workspace-grid` two-column layout

## Schedule

- [x] `.clinic-page-hero` + date range + Day/Week + Prev/Today/Next + Refresh
- [x] `.clinic-stat-grid--five` summary row (shown, slots, rooms, providers, status mix when data present)
- [x] Filter toolbar + active chips + stale chip
- [x] Board: date → room groups with `clinic-list-card` rows (verified in DOM; empty range shows `clinic-empty-state`)
- [x] Empty/filter-empty operational empty panel

## Settings

- [x] Hero + readiness badge
- [x] `.clinic-settings-readiness-grid` — Connection, Data source, Mirror, Write, Sandbox, Backup, Package/build cards
- [x] Detailed sections in `clinic-panel` grid below
- [x] Path masking unchanged

## Write panels

- [x] Amber sandbox header in `clinic-panel`
- [x] Numbered steps, bordered form groups, result surfaces

## Accessibility

- [x] Rail nav roving focus works
- [x] Profile tab arrow keys + `aria-selected`
- [x] Schedule date keyboard shortcuts
- [x] Filter chips `aria-pressed` where applicable
- [x] `prefers-reduced-motion` on skeleton/hover

## Color / life criteria

- [x] Not pale/gray admin — warm clinical canvas + teal rail at first glance
- [x] Teal-forward identity without gradient soup
- [x] Status colors intentional (success/info/warning/danger/neutral tone surfaces)
- [x] Primary action obvious within 3 seconds
- [x] **browser_visibly_changed:** yes
- [x] **browser_matches_spec:** yes
