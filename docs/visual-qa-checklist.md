# Visual QA Checklist — Command Center v2 + Visual Identity

Manual verification per page after the command center UX rebuild and visual identity batch. No screenshot artifacts in repo.

## Global shell

- [ ] Full viewport width used — no floating ~960px / ~1040px column
- [ ] Rail is 280px (260px tablet) with brand, nav icons, patient slot, status footer
- [ ] Teal identity visible at first glance (brand kicker, active nav, focus rings)
- [ ] Read-only mode shown as header pill, not full-width banner
- [ ] Status messages in compact strip (critical/warning/info tiers) with intentional semantic color
- [ ] Body text readable at arm's length (16px minimum)
- [ ] Focus rings visible on rail nav, search, filters, buttons (teal ring, not browser default only)
- [ ] Surfaces use clinical wash / raised tiers — not flat gray admin panels

## Today

- [ ] `.app-page-hero` band with date kicker — soft clinical wash, not plain white
- [ ] `.app-stat-strip` visible at first glance (count, status mix, mirror, readiness) with tone-colored tiles
- [ ] `.app-command-grid`: board panel + ops panel (not Card soup)
- [ ] Appointment rows use `.app-data-list` column grid with status-colored left accent
- [ ] Ops panel: next appointment uses `.app-ops-highlight` (teal left bar)
- [ ] Global status strip collapsed when Today owns mirror/write chips
- [ ] Empty / offline states use `.app-empty-panel` (wash + title + CTA) — not dead white
- [ ] No horizontal overflow at 1280px and 1920px
- [ ] `prefers-reduced-motion`: no panel hover lift animation

## Patients (empty)

- [ ] Search hero centered with large input and clinical wash background
- [ ] Recent patients as tinted mini-cards (not plain list rows)
- [ ] No-results dropdown uses `.app-empty-panel` pattern
- [ ] Rail shows "No patient selected" when none open

## Profile

- [ ] Hero band with name, chart, provider chips (display typography)
- [ ] Tab bar readable; active tab uses teal pill fill; `aria-selected` on tabs
- [ ] Summary mini-cards in surface grid with tone borders
- [ ] Timeline/schedule rows use data-list column grid
- [ ] Tab empty / offline states use `.app-empty-panel` — no raw error bodies
- [ ] Feels like the product centerpiece — not pale/gray admin

## Schedule

- [ ] Full workspace width; date hero in page header with teal accent
- [ ] Toolbar filters unified (room, provider, status) with active chip color
- [ ] Rows: time column ~72px, patient, meta, semantic status badge, actions
- [ ] Day headers sticky with count badge
- [ ] Empty day / filter-empty uses `.app-empty-panel` with refresh / clear CTAs
- [ ] Offline state uses `.app-empty-panel--offline`
- [ ] Write zone visually separated in row expansion (amber sandbox)

## Settings

- [ ] Status overview hero row — tone-colored stat tiles (connection / mirror / write / sandbox)
- [ ] Next-action callout prominent with concise operator copy
- [ ] Status cards in 2-column grid on wide screens
- [ ] Danger cards use left-border accent (green / amber / red by severity)

## Write panels

- [ ] Two-column layout on wide screens (form / preview)
- [ ] Amber left border on sandbox zone
- [ ] Preview → confirm → result progression clear

## Accessibility

- [ ] Rail nav roving focus works
- [ ] Profile tab arrow keys preserved; `aria-selected` on tab controls
- [ ] Schedule date keyboard shortcuts work
- [ ] Filter chips have `aria-pressed` where toggle filters apply
- [ ] New chips/cards show teal focus-visible ring
- [ ] Reduced motion disables panel hover lifts

## Color / life criteria (all pages)

- [ ] Not pale/gray admin — warm clinical canvas at first glance
- [ ] Teal-forward identity without gradient soup or random decoration
- [ ] Status colors intentional (success/info/warning/danger/neutral)
- [ ] Scanability: primary action obvious within 3 seconds
- [ ] No decorative clutter; hierarchy from surface tier + accent bars only
