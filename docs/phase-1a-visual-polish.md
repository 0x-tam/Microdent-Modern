# Phase 1A — Visual polish (shell + UI)

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

## App shell (`packages/app`)

- **Top bar**: brand **kicker** (“Dental clinic workspace”), **underline accent** on “Microdent”, **search teaser** strip (non-interactive, `Soon` badge, `role="note"`), **two-line bridge pill** (“Local bridge idle” + “No clinic link yet”), **`Preview UI`** badge.
- **Read-only banner**: warmer, explicit **read-first** + no PHI copy (still `role="status"` via `ReadOnlyBanner`).
- **Sidebar**: **`Navigate`** header + hint; **grouped modules** (Today / Patients & clinical / Plans & finance / Office); each row is a **glyph + label** button with rail background and clearer active/hover elevation.
- **Dashboard route** (`active === "dashboard"`):
  - **Date kicker** + “preview counts” disclaimer.
  - **Four stat cards** (em dash placeholders, tabular feel, semantic hints).
  - **Split row**: “Next on the floor” sample queue (badged statuses) + **Local desktop bridge** card (plain-language lead, numbered steps, info callout).
  - **Module tile grid** (all modules except Dashboard) — navigates via existing `useState` (no router).
- **Other modules**: **`ModuleHome`** — area badge, summary + bullet “planned capabilities”, actions to return to dashboard / peek Schedule, plus the **`EmptyState`** preview panel (`Sample UI · no PHI`).
- **`app-shell.css`**: layout, grids, tile hover/focus, queue list, bridge card, module home — **gradients and colors reference `var(--ui-*)` only** (no raw hex in rulesets).

## Tests

- `packages/app/src/app-shell.test.tsx` updated for **“Local bridge idle”** and sidebar label **“Navigate”**.

## Dependencies

**None added.**

## Verification

- `pnpm test` (root chain) passes.
- `pnpm build:web` passes.

## Security / audit

Re-run `pnpm audit --audit-level=high` in CI or locally before release; this pass did not add packages. If a **high/critical** advisory appears, stop and address per repo policy.
