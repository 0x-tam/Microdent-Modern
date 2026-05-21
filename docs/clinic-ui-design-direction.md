# Clinic App UI Design Direction

**Baseline:** `5a46479` — visual/UX elevation batch  
**Scope:** Hierarchy, cohesion, empty states, write-panel polish, accessibility — no new write domains or nav modules.

---

## Principles

1. **Calm clinical workspace** — neutral surfaces, teal brand accents only where they signal navigation or primary action.
2. **Strong hierarchy** — one page title row, one lede, content below; patient context is secondary, never competing with the module H2.
3. **Fast scanning** — fixed-width time columns, metric chips for counts, muted meta for visit details.
4. **Minimal status indicators** — one primary read-only banner; secondary mirror/write/sandbox signals in a compact row.
5. **Safe action separation** — read-only content and sandbox write zones are visually distinct (`.app-sandbox-write-zone`).
6. **Modern but not flashy** — no decorative gradients, icon soup, card grids for their own sake, or motion for delight.

---

## Page inventory

| Module | Hierarchy goal |
| --- | --- |
| **Shell** | Topbar → primary banner → compact status row → sidebar + main with `.app-page-header` |
| **Today** | Date kicker → metric row → dominant appointment list; aside = Now card + compact clinic overview |
| **Patients (empty)** | Search-first hero, recent list below |
| **Profile** | `.app-patient-hero` → tab bar → tab content; summary uses `.app-metric-row` |
| **Timeline** | Sticky kind filters → metric summary → temporal sections |
| **Schedule** | `.app-filter-bar` → metric summary → day groups with scannable rows |
| **Settings** | Readiness strip → next-action callout → card grid |
| **Write panels** | Sandbox banner → fields → preview panel → confirm (blocked state prominent) |

---

## Known problems (this batch addresses)

- Banner stack fatigue — multiple full-width `ReadOnlyBanner` rows
- Today aside clutter — redundant Next + Selected patient cards, full Reminders card for unavailable feature
- Inconsistent empty states — plain `<p>` in timeline and next-appointment aside
- Dual post-commit nudges — `WRITE_REFRESH_NUDGE` + `WRITE_POST_COMMIT_MIRROR_NUDGE` on every success
- Tab keyboard gaps — profile and write tablists lack arrow-key roving
- Token drift — `--ui-bg-muted`, `--ui-bg-surface-raised`, warning/danger subtle backgrounds used with hex fallbacks

---

## Shared class tokens (all workstreams)

| Class | Usage |
| --- | --- |
| `.app-page-header` | Module title + lede row in main head |
| `.app-metric-row` | Count/status chips (Today, summary, timeline, schedule) |
| `.app-filter-bar` | Consolidated filters (schedule, clinical tabs) |
| `.app-recent-list` | Session recent patients (Today + Patients) |
| `.app-readonly-state` | Offline / loading / error shells |
| `.app-readonly-state--offline` | Bridge disconnected |
| `.app-sandbox-write-zone` | All sandbox write flows |
| `.app-sandbox-write-blocked` | Write blocked notice |
| `.app-info-callout` | Hidden-fields / limitations notes |
| `.app-patient-hero` | Profile header chips |
| `.app-patient-context-bar` | Sticky shell patient strip |

Reuse from `@microdent/ui`: `.ui-empty`, `.ui-loading`, `.ui-error`, `EmptyState`, `LoadingState`, `ErrorState`, `ReadOnlyBanner`.

Typography tokens: `--app-text-title`, `--app-text-lede`, `--app-text-meta`.

---

## Do-not-do list

- Gradients as decoration (existing shell wash in tokens is the only exception)
- Fake reminders, payments, revenue, or clinical risk scores
- Hiding read-only or sandbox safety copy
- New sidebar modules, command palette, collapsible rail, right drawer
- Tailwind or a second component library
- Re-implementing timeline logic, operational summaries, or write routes from prior batches
- Exposing COMMENT, NOTE, DESCRIPT, AMOUNT, TELEPHONE, or raw row values in UI

---

## Import order

```
@microdent/ui/tokens.css → @microdent/ui/components.css → @microdent/app/app-shell.css
```
