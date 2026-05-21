# Visual QA Checklist — Clinic Workspace Restructure

Manual verification per page after the workspace restructure batch. No screenshot artifacts in repo.

## Global shell

- [ ] Full viewport width used — no floating ~1040px column
- [ ] Rail is 260px with brand, nav icons, patient slot, status footer
- [ ] Read-only mode shown as header pill, not full-width banner
- [ ] Status messages in compact strip (critical/warning/info tiers)
- [ ] Body text readable at arm's length (16px minimum)
- [ ] Focus rings visible on rail nav, search, filters, buttons

## Today

- [ ] Page hero shows date + module title
- [ ] Primary/aside grid: appointments left, operations panel right
- [ ] Appointment rows scannable (time, patient, status)
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
