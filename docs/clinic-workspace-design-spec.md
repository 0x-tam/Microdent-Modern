# Clinic Workspace Design Spec

**Baseline:** `929b662` — prior elevation batch  
**Batch:** Clinic workspace UI restructure  
**Scope:** Layout, typography, CSS architecture, status presentation — **no business logic or write domains**

---

## Diagnosis (why restructure)

The prior batch improved classes and copy but kept a narrow centered column (`--app-main-inner-max: 1040–1240px`), a thin sidebar (172–220px), stacked status banners, and 13–15px body text. The product still reads as a prototype rather than a desktop clinic workspace.

This batch replaces the layout model entirely.

---

## Target: Clinic Workspace Shell

```
┌─────────────────────────────────────────────────────────────┐
│ app-workspace-shell (full viewport)                         │
├──────────────┬──────────────────────────────────────────────┤
│ app-rail     │ app-workspace                                │
│ 260px        │ ┌ app-workspace-header ────────────────────┐ │
│              │ │ search · connection pill · read-only pill│ │
│ brand        │ └──────────────────────────────────────────┘ │
│ nav+icons    │ ┌ app-status-strip (compact tiers) ────────┐ │
│ patient slot │ └──────────────────────────────────────────┘ │
│ status footer│ ┌ app-workspace-main (full width) ─────────┐ │
│              │ │ page content — no max-width cap           │ │
│              │ └──────────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────────┘
```

### Layout tokens

| Token | Value |
| --- | --- |
| `--app-rail-w` | `260px` (240px tablet) |
| `--app-workspace-pad` | `clamp(16px, 2vw, 24px)` |
| `--app-content-max` | `none` (full workspace width) |
| `--app-section-gap` | `20–24px` between major sections |
| `--app-gutter-x` | `clamp(12px, 2.2vw, 24px)` |

### Typography scale

| Role | Size |
| --- | --- |
| Body | **16px** (`--app-text-body`) |
| Meta / labels | **14px** (`--app-text-meta`) |
| Module titles | **1.5–2rem** (`--app-text-title`) |
| Buttons (default) | **40px** min-height |

---

## Status tier system

| Tier | Presentation |
| --- | --- |
| **Critical** | Single line in compact status strip; rail footer dot when applicable |
| **Warning** | Compact chip in status strip |
| **Info** | Muted inline text in strip |
| **Read-only** | Persistent pill in workspace header — not a full-width banner |

Safety copy is unchanged; **presentation only** changes.

---

## Page hierarchy

### Today
- **Primary:** appointment list (`.app-data-list` with time / patient / status columns)
- **Secondary:** Operations aside (now/next, readiness, recents, quick actions — one panel)
- **Tertiary:** dev-only fixture/catalog panels
- Hero: date + appointment count metric

### Patients (empty)
- **Primary:** centered search hero with large input
- **Secondary:** recent patients grid
- Profile open: handled by Profile page

### Profile (centerpiece)
- **Primary:** hero band (name, chart, provider chips)
- **Secondary:** tab bar + summary mini-cards grid
- **Tertiary:** tab bodies with `.app-workspace-section` spacing
- Timeline / clinical tabs use `.app-data-list` / `.app-toolbar`

### Schedule
- **Primary:** full-width column grid rows (time 72px · patient · meta · status · actions)
- **Secondary:** date hero + filter toolbar
- Day groups: sticky headers with count badge

### Settings
- **Primary:** next-action callout
- **Secondary:** 2-column status card grid on wide screens
- Danger cards: left-border accent; healthy cards calm white

### Write panels (sandbox)
- Two-column on wide: form left, preview/result right
- Amber left border; pilot banner always visible
- Stepped preview → confirm → result progression

---

## Shared patterns

| Class | Purpose |
| --- | --- |
| `.app-workspace-page` | Page root with consistent padding |
| `.app-page-hero` | Full-width page header band |
| `.app-data-list` / `.app-data-row` | Column grid for schedule, timeline, search results |
| `.app-toolbar` | Unified filter/action bar |
| `.app-surface` | Subtle bordered panel (1px border + light shadow) |
| `.app-state-panel` | Centered loading/empty/error states |

**Depth principle:** subtle border + light shadow — not stacked white card grids.

---

## Do-not-do list

- No command palette
- No collapsible mini-rail or right drawer
- No fake analytics or decorative gradients/icons
- No Tailwind
- No card soup (avoid 6+ stacked `.ui-card` panels where one surface suffices)
- No new write domains
- No new nav modules
- No screenshot artifacts in repo

---

## Before / after (prose)

**Before:** Top bar spans full width; read-only banner below; status chips row; sticky patient bar; narrow sidebar; main content capped at ~1040px with H2 + long lede above every page.

**After:** Rail + workspace column; patient context in rail; read-only as header pill; compact status strip; main content uses full workspace width; page heroes live inside page components; 16px body text throughout.

---

## CSS architecture

Monolithic `app-shell.css` becomes an `@import` hub:

```
styles/shell-layout.css
styles/shell-status.css
styles/shared/toolbar.css
styles/shared/data-list.css
styles/shared/surface.css
styles/pages/today.css
styles/pages/patients.css
styles/pages/profile.css
styles/pages/schedule.css
styles/pages/settings.css
styles/pages/write.css
```

Page agents own their partial; ShellFoundation owns layout and status.

---

## Command Center v2 (density + width completion)

**Batch:** Command center UX rebuild on baseline `13560fe`  
**Goal:** Full workspace width, command-center page hierarchy, no card soup for stats.

### Product model (enforced in layout)

1. **Today** = command center (stat strip hero + live schedule board + ops health panel)
2. **Schedule** = operational board (full-width column grid, sticky day headers)
3. **Patients** = lookup gateway (search-first, recents grid)
4. **Profile** = patient workspace (hero + stat strip + tabs)
5. **Settings** = operator control center (multi-column card grid)

### First-glance requirements (3 seconds)

| Page | Must see |
| --- | --- |
| Today | Appt count today, next/current appt, connection/mirror tone, primary CTA |
| Schedule | Date range, loaded count, filter state, scannable time column |
| Patients | Search field, recent patients, what happens on select |
| Profile | Name, chart, next visit hint, tab with most activity |

### Density rules

- Breathe at **page edges**; **dense inside data regions** (lists, boards, stat strips).
- **No generic card grids for stats** — use `.app-stat-strip`, `.app-board-panel`, `.app-ops-panel`.
- **No page-level max-width** on schedule/profile/patients roots (copy blocks may use `max-width: 72ch`).

### Command center layout (Today)

```
┌─ .app-stat-strip (full width) ────────────────────────────┐
│ Today count │ Status mix │ Mirror │ Write │ Bridge        │
├─ .app-command-grid ───────────────────────────────────────┤
│ .app-board-panel (2fr)     │ .app-ops-panel (1fr)        │
│  .app-data-list appts      │  Now/Next, actions, recents  │
│                            │  Clinic overview (dense dl) │
└───────────────────────────────────────────────────────────┘
```

### Status tier v2

| Tier | Placement |
| --- | --- |
| Read-only | Header pill only |
| Critical | Workspace header strip + rail footer dot |
| Warning | Page-specific (Today ops, Settings cards) — not global when duplicated |
| Info | Today stat strip chips / Settings only |

Use `resolveContextualStatusForModule(active)` so global `.app-status-strip` collapses when the active page owns the same signal.

### Shared command-center classes

| Class | Purpose |
| --- | --- |
| `.app-stat-strip` / `.app-stat` | First-glance metrics row |
| `.app-command-grid` | Board + ops two-column layout |
| `.app-board-panel` | Primary data surface (appointments, schedule board) |
| `.app-ops-panel` | Secondary ops (now/next, quick actions, overview) |
| `.app-board-day-header` | Sticky schedule day group header |

**CSS hygiene:** Shell root layout (`.app-shell`, `.app-workspace-shell` grid/flex) lives only in `shell-layout.css`. Hub `app-shell.css` must not reintroduce `960px`/`1040px` page caps.

**Typography floor:** No UI chrome below **13px** (sidebar sublabels, badges, meta).

---

## Windows field execution

**Deferred / Not yet run.** Clinic go-live blocked until Tier 3 per `docs/FIELD-TEST-START-HERE.md`.
