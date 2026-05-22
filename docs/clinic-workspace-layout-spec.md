# Clinic Workspace Layout Spec

**Baseline:** `5cd3d13` — `feat: redesign clinic app into modern visual workspace`  
**Wave 0 scope:** Root-cause audit (A), `clinic-*` design system (C), cascade fix (O)  
**Goal:** Replace incremental `app-*` layering with a single last-import `clinic-*` system and restructured page DOM in Waves 1–4.

---

## A — Rendered UI root-cause audit

### CSS cascade trace (computed load order)

Host application loads styles in this order:

1. `@microdent/ui/tokens.css` — global design tokens (`--ui-*`)
2. `@microdent/ui/components.css` — shared UI primitives (`.ui-card`, `.ui-btn`, …)
3. `@microdent/app/app-shell.css` — clinic workspace import hub:
   - `shell-layout.css` — rail, topbar, workspace grid (`.app-workspace-shell`)
   - `shell-status.css` — header/status banners
   - `shared/*` — command-center, surface, visual-identity, toolbar, data-list
   - `pages/today.css`, `patients.css`, `profile.css`, `clinical.css`, `schedule.css`, `settings.css`, `write.css`
   - `pages/clinic-*.css` — Wave 2 page stubs (minimal placeholders)
   - `workspace-redesign.css` — v2 canvas/rail/hero/metric/status overrides
   - **`clinic-design-system.css` — MUST BE LAST** — spec tokens + `clinic-*` primitives

**Root cause (pre–Wave 0):** After `workspace-redesign.css` import, `app-shell.css` contained **~765 lines of inline hub rules** (former lines 22–786). Because they loaded after all `@import` sheets, hub selectors beat both page CSS and `workspace-redesign.css`. The UI stayed a pale admin panel despite v2 work.

**Wave 0 fix:** Hub block removed from `app-shell.css`. Needed rules migrated into `shell-layout.css` and `pages/today.css` (Wave 2 will further distribute into `clinic-*` page sheets). `clinic-design-system.css` is the sole post-import authority for canvas + shared clinic layout classes.

### Rendered classes vs styled classes (grep snapshot)

| Page | DOM classes rendered (TSX) | Primary style sheets | Gap |
|------|---------------------------|----------------------|-----|
| Today | `app-workspace-page`, `app-dashboard`, `app-hero-band`, `AppMetricTile` → `.app-metric-tile` | `today.css`, `workspace-redesign.css` | No `clinic-page` / `clinic-command-grid` yet (Wave 2) |
| Patients | `app-patients-search-hero`, `app-patient-search`, `.ui-card` | `patients.css` | Narrow `max-width: 720px` hero; no 2/3\|1/3 command grid |
| Schedule | `app-schedule`, `app-board-panel`, filter chips | `schedule.css` | Board uses legacy panel pattern, not `clinic-list-card` |
| Profile | `app-patient-profile`, `app-hero-band`, summary mini-grid | `profile.css` | Header still uses `.app-patient-profile__header-row` dl layout in places |
| Settings | `app-settings`, readiness cards | `settings.css` | Readiness grid not yet `clinic-stat-grid` |

Wave 2+ will swap rendered DOM to `ClinicPage`, `ClinicPageHero`, `ClinicStatCard`, `ClinicPanel`, `ClinicStatusGrid`, `ClinicEmptyState` and matching `clinic-*` classes.

### Conflicting hub rules (removed / migrated)

These hub patterns **overrode** redesign imports when inline in `app-shell.css`:

| Rule / selector | Conflict | Resolution (Wave 0) |
|-----------------|----------|---------------------|
| `.app-main__content .ui-card__body { padding: … }` | Flattened v2 card rhythm | Migrated → `shell-layout.css` |
| `.app-sidebar__btn { flex-direction: column }` | Fought v2 rail glyph layout | Migrated → `shell-layout.css`; clinic rail rebuild in Wave 1 |
| `.app-dashboard-status-strip` + legacy status cards | Competed with `AppMetricTile` / `AppStatusGrid` | Migrated → `shell-layout.css` (legacy compat until Wave 2 DOM swap) |
| `.app-patient-profile__header-row` dl grid (14–16px) | Narrow definition-list profile header | Migrated → `shell-layout.css` |
| `.app-patients-search-hero { max-width: 720px }` (in `patients.css`) | Caps patients workflow width | Wave 2: remove cap when adopting `clinic-command-grid` |
| 11–13px chip/meta overrides in hub | Below v2 14px chrome floor | Superseded by `clinic-design-system.css` `--clinic-text-meta: 0.875rem` |
| Filter chip `box-shadow` active states | Duplicated toolbar.css | Migrated tail → `pages/today.css` (Wave 2 → `shared/toolbar.css`) |
| `.app-workspace-shell` / `.app-shell` background in hub + redesign + clinic | Triple canvas declarations | **Winner:** `clinic-design-system.css` (`--clinic-bg: #f5fafb`) |

### Before screenshots

Capture at Wave 4 proof (`pnpm dev:web` + browser MCP): Today, Patients, Schedule, Profile, Settings — store in `qa-runs/` for before/after comparison. Not required for Wave 0 commit gate.

---

## C — `clinic-*` design system (Wave 0 deliverables)

### Tokens (`clinic-design-system.css`)

| Token | Value | Role |
|-------|-------|------|
| `--clinic-bg` | `#f5fafb` | Workspace canvas |
| `--clinic-bg-soft` | `#eef8fa` | Rail / hero wash |
| `--surface` | `#ffffff` | Elevated panels |
| `--surface-teal` | `#e6f7f8` | Teal tone cards |
| `--surface-cyan` | `#e8f9fc` | Info / next-visit |
| `--surface-green` | `#ecf8f0` | Healthy / schedule OK |
| `--surface-amber` | `#fff8eb` | Stale / caution |
| `--surface-red` | `#fef2f2` | Critical / blocked |
| `--shadow-card` | `0 12px 34px rgba(16,42,45,0.08)` | Card elevation |
| `--clinic-page-max` | `min(1680px, 100%)` | Wide desktop grid |

### Shared classes

| Class | Role |
|-------|------|
| `.clinic-page` | Page root, max-width grid |
| `.clinic-page-hero` | 32–40px title band + meta |
| `.clinic-stat-grid` / `.clinic-stat-card` | Metric row (5-up on Today/Settings) |
| `.clinic-command-grid` | 2/3 + 1/3 main layout |
| `.clinic-panel` / `.clinic-panel-header` | Elevated white card |
| `.clinic-toolbar` | Filter/control row |
| `.clinic-chip` / `.clinic-status-pill` | Status indicators |
| `.clinic-list-card` | Schedule/appointment rows |
| `.clinic-empty-state` | Accent empty block + CTAs |
| `.clinic-workspace-grid` | 12-column page grid; `.clinic-col-*` spans for Today/Patients/Profile |
| `.clinic-summary-strip` | Schedule horizontal metrics (not stat cards) |
| `.clinic-status-compact` | Today 3-row side status list |
| `.clinic-continue-strip` | Today recent-patient chips |

### React primitives (exported from `@microdent/app`)

| Component | File |
|-----------|------|
| `ClinicPage`, `ClinicPageHero` | `clinic-page.tsx` |
| `ClinicStatCard` | `clinic-stat-card.tsx` |
| `ClinicPanel` | `clinic-panel.tsx` |
| `ClinicStatusRow`, `ClinicStatusGrid` | `clinic-status-row.tsx` |
| `ClinicEmptyState` | `clinic-empty-state.tsx` |

Legacy exports retained: `AppMetricTile`, `AppStatusGrid`, `AppEmptyPanel`.

---

## O — Cascade fix checklist

- [x] Inline hub block removed from `app-shell.css` (no rules after imports)
- [x] Hub rules migrated to `shell-layout.css` + `pages/today.css`
- [x] `clinic-design-system.css` imported **last** (after `workspace-redesign.css`)
- [x] Page stubs: `clinic-today.css`, `clinic-patients.css`, `clinic-schedule.css`, `clinic-profile.css`, `clinic-settings.css`
- [x] `cascade-guard.test.mjs` asserts last import + no post-import `.app-shell` overrides
- [ ] Wave 2: adopt `clinic-*` DOM on all five key pages
- [ ] Wave 4: browser layout proof vs this spec

---

## Spec → files mapping (implementation checklist)

| Spec section | Target files | Wave |
|--------------|--------------|------|
| Shell sidebar 250–280px, glyphs | `AppShell.tsx`, `shell-layout.css` | 1 |
| Header search + status pills | `PatientSearchBar.tsx`, `shell-layout.css`, `shell-status.css` | 1 |
| Today hero + 5 stats + command grid | `today-dashboard.tsx`, `clinic-today.css` | 2 |
| Patients 2/3\|1/3 workflow | `PatientSearchBar.tsx`, `clinic-patients.css` | 2 |
| Schedule board + list cards | `SchedulePanel.tsx`, `clinic-schedule.css` | 2 |
| Profile hero + tabs + summary grid | `PatientProfilePanel.tsx`, `clinic-profile.css` | 2 |
| Timeline / clinical panels | `patient-timeline.tsx`, `clinical.css` | 2 |
| Settings readiness grid | `SettingsPanel.tsx`, `clinic-settings.css` | 2 |
| Write panel styling | write action components, `write.css` | 2 |
| Empty / loading / microcopy | `ClinicEmptyState`, `read-only-ui-copy.ts` | 3 |
| Visual QA + commit gate | `docs/visual-qa-checklist.md`, browser MCP | 4 |

---

## Wave: Structure (IA audit — before page DOM rebuild)

**Baseline for this wave:** `bdb5a82`  
**Goal:** Workflow-first layouts on main pages; technical diagnostics consolidated in Settings only.

### Remove from main UI → new primary structure

| Page | Remove from main UI | New primary structure |
|------|---------------------|------------------------|
| **Today** | 5-card stat strip; 6-row glance; pilot notes panel; mirror/write/backup/sandbox rows | 8+4 grid: schedule panel + continue-working strip \| next-up + quick actions + 3-row clinic status |
| **Patients** | Long instruction blocks; duplicate search | 7+5 grid: search+results \| recent + what-opens + safety |
| **Schedule** | Generic stat-card row as hero | Hero controls + summary **strip** (not cards) + filter toolbar + board |
| **Profile** | 6 diagnostic stat cards at top | Header + **5 workflow metrics** + tabs; summary two-column |
| **Settings** | (keep) | Absorb all technical diagnostics moved off other pages |

### Components / resolvers to replace (not restyle)

| Area | Retire on main pages | Replacement |
|------|----------------------|-------------|
| Today | `clinic-stat-grid--five`, full `ClinicStatusGrid` glance (6 rows), pilot notes panel | `clinic-workspace-grid` 8+4; `clinic-status-compact` (3 rows); `resolveTodayClinicStatus()` |
| Today | `resolveFrontDeskOverview()` | `resolveTodayClinicStatus()` — Service, Local copy, Editing only |
| Profile | 6-card `ProfileAtGlanceRow` diagnostic grid | Workflow strip (5 metrics) |
| Schedule | 5× `ClinicStatCard` hero row | `clinic-summary-strip` inline metrics |
| Copy | SQLite mirror, DBF fallback, bridge, write mode on main pages | `clinic-friendly-copy.ts` mappers; Settings keeps `SETTINGS_*` technical strings |

### CSS foundation (Wave 0 L)

| Class | Role |
|-------|------|
| `.clinic-workspace-grid` | 12-column page grid (`repeat(12, 1fr)`) |
| `.clinic-col-8` / `.clinic-col-4` | Today desktop columns |
| `.clinic-col-7` / `.clinic-col-5` | Patients desktop columns |
| `.clinic-col-6` | Profile summary halves (via `.clinic-profile-summary-grid` spans) |
| `.clinic-summary-strip` | Schedule horizontal metrics (not stat cards) |
| `.clinic-status-compact` | 3-row side status list |
| `.clinic-continue-strip` | Recent-patient chips under primary panel |
| `.clinic-header-search` | Search cap `max-width: min(720px, 100%)` |

**Responsive:** `≥1440px` full 12-col; `1100–1439px` tighter gutters; `800–1099px` aside stacks (`grid-column: 1 / -1`); `<800px` single column + compact sidebar rail (`shell-layout.css`).

### Before screenshots

Capture at Wave 4 browser proof for before/after in `qa-runs/`. Not required for Wave 0 test gate.

---

## Acceptance (Wave 4 — not Wave 0)

1. `.clinic-page-hero`, `.clinic-stat-card`, `.clinic-command-grid` visible on Today, Patients, Schedule, Profile, Settings in browser
2. Rail 250–280px teal-tinted; no ~700px narrow column traps
3. `pnpm test` + checkpoint green; `browser_matches_spec: true` in batch report before commit
