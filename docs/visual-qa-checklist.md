# Visual QA Checklist — v2 Modern Workspace Redesign

Manual verification per page after the structural v2 redesign (hero bands, metric tiles, status grids, 300px rail, last-loaded `workspace-redesign.css`). No screenshot artifacts in repo.

**Browser proof (2026-05-21):** `browser_visibly_changed: **yes**` — warm canvas, teal rail brand band, hero + metric grid on Today, status chips (not `<dl>` table), search hero on Patients, schedule header band, profile display hero + pill tabs, Settings status hero tiles.

## Global shell

- [ ] Full viewport width used — no floating ~960px / ~1040px column
- [ ] Rail is **300px** (272px below 1200px) with teal brand band, tall nav rows, patient card, connection footer
- [ ] Teal identity visible at first glance (brand kicker, active nav left bar, focus rings)
- [ ] Read-only mode shown as header pill, not full-width banner
- [ ] Status messages in compact strip (critical/warning/info tiers) with intentional semantic color
- [ ] Body text readable at arm's length (**16px** minimum on workspace surfaces)
- [ ] Focus rings visible on rail nav, search, filters, buttons (teal ring)
- [ ] Surfaces use warm workspace canvas / rail tint / hero band — not flat gray admin panels
- [ ] `workspace-redesign.css` loaded last in `app-shell.css`

## Today

- [ ] `.app-hero-band` with display title + date kicker — pronounced clinical band
- [ ] `.app-metric-tile-grid` with bold values (appointments, freshness, schedule readiness)
- [ ] `.app-command-grid`: board panel + ops panel
- [ ] Appointment rows: thicker rows with status-colored left accent
- [ ] Ops panel: next appointment uses `.app-ops-highlight`
- [ ] **Clinic at a glance** uses `.app-status-grid` with colored chips — not `<dl>` text table
- [ ] Empty / offline states use `.app-empty-panel` with primary CTA
- [ ] No horizontal overflow at 1280px and 1920px

## Patients (empty)

- [ ] Search hero elevated card centered on Patients page
- [ ] Recent patients as tinted mini-cards or card grid
- [ ] Result rows 16px+ with chart pill affordance
- [ ] Keyboard nav + offline banner preserved

## Profile

- [ ] `.app-hero-band` with display name, chart, provider chips
- [ ] Summary uses `.app-metric-tile-grid`
- [ ] Segmented tabs **44px** height, active = filled teal pill
- [ ] Tab empty / offline states use `.app-empty-panel`

## Schedule

- [ ] Page header band with date range + count badge
- [ ] Pill filter chips with filled teal active state
- [ ] Card-style appointment rows (not flat gray strips)
- [ ] Empty day uses operational empty panel

## Settings

- [ ] Status overview hero: **5** `.app-metric-tile` tiles (connection / mirror / write / sandbox / backup)
- [ ] Section cards in 2-column grid with severity left accent
- [ ] Path masking unchanged

## Write panels

- [ ] Amber sandbox banner spanning write zone
- [ ] Numbered step strip with filled active step
- [ ] Result panels: green / amber / red distinct surfaces

## Accessibility

- [ ] Rail nav roving focus works
- [ ] Profile tab arrow keys + `aria-selected`
- [ ] Schedule date keyboard shortcuts
- [ ] Filter chips have `aria-pressed` where applicable
- [ ] `prefers-reduced-motion`: no panel hover lift

## Color / life criteria (all pages)

- [ ] Not pale/gray admin — warm clinical canvas at first glance
- [ ] Teal-forward identity without gradient soup
- [ ] Status colors intentional (success/info/warning/danger/neutral)
- [ ] Primary action obvious within 3 seconds
- [ ] **browser_visibly_changed:** yes / no (record in batch report)
