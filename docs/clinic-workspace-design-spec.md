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

## Windows field execution

**Deferred / Not yet run.** Clinic go-live blocked until Tier 3 per `docs/FIELD-TEST-START-HERE.md`.
