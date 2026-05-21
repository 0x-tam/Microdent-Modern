# Visual QA Checklist — Command Center v2

Manual verification per page after the command center UX rebuild batch. No screenshot artifacts in repo.

## Global shell

- [ ] Full viewport width used — no floating ~960px / ~1040px column
- [ ] Rail is 280px (260px tablet) with brand, nav icons, patient slot, status footer
- [ ] Read-only mode shown as header pill, not full-width banner
- [ ] Status messages in compact strip (critical/warning/info tiers)
- [ ] Body text readable at arm's length (16px minimum)
- [ ] Focus rings visible on rail nav, search, filters, buttons

## Today

- [ ] `.app-stat-strip` visible at first glance (count, status mix, mirror, readiness)
- [ ] `.app-command-grid`: board panel + ops panel (not Card soup)
- [ ] Appointment rows use `.app-data-list` column grid
- [ ] Global status strip collapsed when Today owns mirror/write chips
- [ ] Empty state centered with primary CTA
- [ ] No horizontal overflow at 1280px and 1920px

## Patients (empty)

- [ ] Search hero centered with large input
- [ ] Recent patients grid below search
- [ ] Rail shows "No patient selected" when none open

## Profile

- [ ] Hero band with name, chart, provider chips
- [ ] Tab bar readable; active tab underlined
- [ ] Summary mini-cards in surface grid
- [ ] Timeline/schedule rows use data-list column grid
- [ ] Feels like the product centerpiece

## Schedule

- [ ] Full workspace width; date hero in page header
- [ ] Toolbar filters unified (room, provider, status)
- [ ] Rows: time column ~72px, patient, meta, badge, actions
- [ ] Day headers sticky with count badge
- [ ] Write zone visually separated in row expansion

## Settings

- [ ] Next-action callout prominent
- [ ] Status cards in 2-column grid on wide screens
- [ ] Danger cards use left-border accent

## Write panels

- [ ] Two-column layout on wide screens (form / preview)
- [ ] Amber left border on sandbox zone
- [ ] Preview → confirm → result progression clear

## Accessibility

- [ ] Rail nav roving focus works
- [ ] Profile tab arrow keys preserved
- [ ] Schedule date keyboard shortcuts work
- [ ] Filter chips have `aria-pressed`
