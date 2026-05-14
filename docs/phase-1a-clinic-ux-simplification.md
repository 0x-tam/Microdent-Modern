# Phase 1A — Clinic UX simplification (shell)

## Goal

After visual polish, the shell still read too much like a **developer preview**. This pass **reduces noise**, **raises type hierarchy**, and uses **clinic-first language** while keeping the same architecture: **no router**, **no bridge-client**, **no real data**.

## What changed

### Top bar

- **Microdent** + clinic name only (removed marketing kicker and competing badges).
- **Patient search** is the dominant control: a large, **disabled** search field (`role="search"`) with placeholder *Find a patient by name or chart number* — communicates the primary future action without implying it works yet.
- **Clinic data off**: one quiet **status** line (`role="status"`) instead of multi-line “bridge idle” / “Preview UI” badges.

### Read-only banner

- **`ReadOnlyBanner`** with **`label="Read-only mode"`** and short body: *This preview cannot change clinic data.*
- **`ui-readonly-banner--compact`** (from `@microdent/ui`) for **smaller padding and no drop shadow** so it does not dominate the page.

### Sidebar

- **Flat list** (no section groupings, no glyph cells): **Today**, **Patients**, **Schedule**, **Dental Chart**, **Treatments**, **Payments**, **Reports**, **Settings**.
- **Narrower rail** (~220px), **15px** labels, **inset accent bar** on the active item.
- Visible **“Main navigation”** label is **screen-reader only** (`#sidebar-nav-label` + `.app-sr-only`); less chrome for sighted users.

### Navigation IDs (export)

`AppNavModuleId` values are now: **`today`** (home), **`patients`**, **`schedule`**, **`dental-chart`**, **`treatments`** (was `treatment-plans`), **`payments`**, **`reports`**, **`settings`**. Hosts that branched on old ids should switch to these names.

### Today (home) layout

- **Max-width** main column (~1040px) so lines do not stretch edge-to-edge on wide monitors.
- **Two columns** (stack on narrow viewports):  
  - **Left:** **Today’s appointments** — short list of **Sample patient** rows with time, visit, chair, and a **single status badge** each.  
  - **Right:** **Next appointment** card, **Quick actions** (Find patient *disabled*, Open schedule, Review chart, Record payment *disabled* with `title`), **Reminders** bullet list in plain language.
- **Removed** from Today: stat tile grid, **bridge explainer** card, **module jump tile** grid, and developer-oriented copy.

### Other modules (`ModuleHome`)

- **No** category `Badge` chip; **shorter** summary + two bullets in everyday wording.
- **Back to Today** + **Open schedule** actions.
- **`EmptyState`**: *Nothing to show yet* / neutral description (no “Sample UI · no PHI” badge).

## Dependencies

**None added.**

## Verification

- `pnpm test` and `pnpm build:web` pass after this pass.

## Related docs

- Earlier polish (denser / more decorative): [phase-1a-visual-polish.md](phase-1a-visual-polish.md) — some details there are **superseded** by this simplification for the **Today** screen and chrome.
