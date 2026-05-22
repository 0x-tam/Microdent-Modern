# Visual QA Checklist — Clinic Structure & Workflow UX (Waves 0–4)

Manual + browser verification for the workflow-first clinic layout. Use with [clinic-workspace-layout-spec.md](./clinic-workspace-layout-spec.md) **Wave: Structure**.

**Automated guards:** `clinic-design-system.css` cascade tests, `assertNoMainPageJargonInDom`, page unit tests for grid/strip structure.

## Global shell

- [ ] Full viewport width — `clinic-workspace-main` uses `--clinic-page-max: min(1680px, 100%)`; pages use `overflow-x: clip`
- [ ] Sidebar **260px** desktop → **220–240px** at 1100–1439px → **compact rail** (&lt;800px)
- [ ] Teal brand + “Modern clinic workspace”; strong nav active state without oversized padding
- [ ] Header search **max 720px** (`clinic-header-search`); status cluster wraps at ≤899px without horizontal scroll
- [ ] Header pills: **Read-only**, **Connected**, **Local copy**, **Refresh** — no “Writes off”, “Mirror:”, or “Sandbox pilot” on main chrome
- [ ] `clinic-design-system.css` loaded last in `app-shell.css`

## Structural acceptance (main pages)

| Page | Must have | Must NOT have |
|------|-----------|----------------|
| **Today** | `.clinic-workspace-grid` 8+4; schedule panel; continue strip; 3-row `.clinic-status-compact` | `.clinic-stat-grid--five`; “Clinic at a glance”; “Pilot notes”; 6-row diagnostics grid |
| **Patients** | `.clinic-col-7` + `.clinic-col-5`; search-led results; aside recent / opens-next / safety | Long instruction blocks; duplicate full-width search hero |
| **Schedule** | `.clinic-schedule-summary-strip` (horizontal metrics) | `.clinic-stat-grid--five` as hero summary |
| **Profile** | `.clinic-profile-workflow-strip` (5 workflow metrics) | `.clinic-profile-stat-grid` / six diagnostic stat cards at top |
| **Settings** | `.clinic-settings-readiness-grid` (technical terms OK) | — |

## Jargon (main pages DOM)

- [ ] No **SQLite**, **DBF fallback**, **mirror stale**, **write mode**, **sandbox write pilot** in Today / Patients / Schedule / Profile / shell header
- [ ] Friendly copy: **Local copy**, **Read-only**, **Clinic service offline**, **Using copied clinic files** (inline advisories only)
- [ ] Technical diagnostics live in **Settings** readiness grid and grouped panels

## Today

- [ ] Hero subtitle: workflow-first (schedule + shortcuts + status)
- [ ] Primary: **Today's schedule** with in-panel next/current highlight
- [ ] Aside: **Next up**, **Quick actions** (3 buttons), **Clinic status** (3 rows + link to Settings)
- [ ] Empty / error: `clinic-empty-state`; friendly schedule-unavailable copy

## Patients

- [ ] Hero + read-only chip only
- [ ] 7+5 grid; `clinic-list-card` results with Open workspace
- [ ] Keyboard nav + offline handling preserved

## Schedule

- [ ] Hero controls: Day/Week, Prev/Today/Next, Refresh
- [ ] Summary **strip** (shown, range, rooms, providers, status mix)
- [ ] Board: date → room groups → list cards; stale copy uses “Local copy may be outdated”

## Profile

- [ ] Hero: name, chart, provider, read-only + friendly freshness chips
- [ ] Workflow strip (5 items); summary two-column grid; ledger as summary metadata
- [ ] 44px pill tabs; compact hidden-data one-liners per tab

## Settings

- [ ] Readiness grid retains Mirror / Write / Backup technical labels
- [ ] Grouped sections: Diagnostics, Local copy/import, Editing/sandbox, Backup, Package/build, Field test
- [ ] Path masking unchanged

## Responsive (verify at 1600 / 1200 / 900 / 768)

- [ ] ≥1440px: full 12-column layouts
- [ ] 1100–1439px: 8+4 / 7+5 with tighter gutters; aside stacks at ≤1099px
- [ ] ≤899px: header search full width; status pills wrap
- [ ] &lt;800px: single-column workspace grid; compact sidebar rail
- [ ] No horizontal overflow on any main page

## Write panels

- [ ] Step-based flow; friendly banners; technical backup detail linked from Settings

## Accessibility

- [ ] Rail nav roving focus; profile tab arrows; schedule date shortcuts
- [ ] Filter chips `aria-pressed` where applicable
- [ ] `prefers-reduced-motion` on skeleton/hover

## Browser proof gate (Wave 4)

- [ ] Screenshots at **1600px** and **1200px** on all five pages
- [x] `browser_structurally_changed: true` — [2026-06-03-clinic-structure-workflow-batch-report.md](../qa-runs/2026-06-03-clinic-structure-workflow-batch-report.md)
- [ ] **browser_matches_spec:** yes only if table above passes
