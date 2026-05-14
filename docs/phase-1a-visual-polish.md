# Phase 1A — Visual polish (shell + UI)

> **Note (later pass):** the **Today** home screen and top bar were **simplified** for a calmer, less “admin preview” feel — see [phase-1a-clinic-ux-simplification.md](phase-1a-clinic-ux-simplification.md). Token and component work below (e.g. `--ui-gradient-shell`, read-only banner base styles, `ui-card--accent`) still applies unless superseded there.

## Summary

A **design-only** pass on `@microdent/ui` and `@microdent/app` to make the read-only shell feel closer to **modern dental clinic software**: clearer hierarchy, teal-forward canvas, grouped navigation, a **dashboard-shaped** home (sample tiles, “next on the floor”, module jump grid), and **human bridge copy** — still **no data wiring**, **no bridge-client**, **no router/query**, and **no PHI** (only generic preview labels).

## Tokens (`packages/ui/src/tokens.css`)

- **`--ui-bg-canvas-wash`**, **`--ui-bg-rail`**: subtle cool washes for shell gradient and sidebar (distinct from flat gray “admin template” feel).
- **`--ui-primary-700`**: deeper brand step for kickers, stat emphasis, and read-only emphasis text.
- **`--ui-gradient-shell`**, **`--ui-gradient-topbar`**: soft background depth (tokens only; hosts keep the same import order).
- **`--ui-shadow-card-hover`**: slightly deeper lift for interactive tiles on hover.

## UI components / CSS (`packages/ui`)

- **`ReadOnlyBanner`**: icon character **`i`** in a solid primary badge (better legibility than a thin glyph on busy backgrounds).
- **`components.css`**:
  - **Read-only banner**: left **primary** bar, soft multi-stop gradient using **primary + surface + info** tokens, card shadow, rounded to `radius-md`, icon in a **filled primary** tile; `<em>` in body styled as a stressed phrase (not italic noise).
  - **`ui-card--accent`**: optional elevated border/shadow for summary cards.
  - **`ui-empty--start`**: left-aligned “module preview” empty layout with gentle primary wash (used under module home).

## App shell (`packages/app`) — historical detail

The following described an **earlier** shell layout (grouped sidebar, stat tiles, bridge explainer, module tiles). The **current** shell is documented in [phase-1a-clinic-ux-simplification.md](phase-1a-clinic-ux-simplification.md).

- **Top bar (earlier)**: brand kicker, search teaser with “Soon” badge, two-line bridge pill, “Preview UI” badge.
- **Sidebar (earlier)**: grouped nav + glyph cells.
- **Home (earlier)**: stat tiles, “next on the floor” + bridge card, module jump grid.
- **Module home (earlier)**: area badge, “Sample UI · no PHI” empty panel.

## Tests (at time of polish)

- `packages/app/src/app-shell.test.tsx` was updated during that iteration (later superseded by clinic UX pass).

## Dependencies

**None added.**

## Verification

- `pnpm test` (root chain) passes.
- `pnpm build:web` passes.

## Security / audit

Re-run `pnpm audit --audit-level=high` in CI or locally before release; this pass did not add packages. If a **high/critical** advisory appears, stop and address per repo policy.
