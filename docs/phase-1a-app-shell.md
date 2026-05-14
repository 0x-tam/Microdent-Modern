# Phase 1A — App shell (Band A6)

## What was built

- **`packages/app`**: exportable **`AppShell`** and **`AppErrorBoundary`** for a future host (`apps/web` / desktop) — **no `apps/web` package** in this band to avoid extra bundler surface; hosts only need to import CSS and render the shell.
- **Layout** (see [design-system.md](design-system.md) §13 for target dimensions):
  - **Top bar** (`role="banner"`): product name **Microdent**, configurable **`clinicLabel`**, **bridge status pill** (`role="status"`, two-line human copy — not color-only), optional **search teaser** (`role="note"`, non-interactive), and a **`Preview UI`** `Badge` with explicit `semanticLabel`.
  - **Global `ReadOnlyBanner`** under the bar (read-only phase messaging).
  - **Left rail** (~272px): **grouped** navigation (**Today**, **Patients & clinical**, **Plans & finance**, **Office**) with glyph + label **buttons**, **`aria-current="true"`** on the active item, **`aria-controls`** → main region.
  - **Main** (`role="main"`, `id="app-main-region"`): page **`h2`** + short lede; **Dashboard** shows sample stat tiles, “next on the floor”, bridge explainer card, and a **module tile grid**; other modules show a **Module home** summary + bullets + `EmptyState` preview — still **no HTTP calls** from the shell.
- **Navigation modules** (match [ui-redesign-plan.md](ui-redesign-plan.md) rail list): Dashboard, Patients, Schedule, Dental Chart, Treatment Plans, Payments, Reports, Settings — selection is **`useState`**, **no React Router**.
- **Styling**: **`app-shell.css`** uses only **`var(--ui-*)`** tokens; consumers must load UI tokens + component CSS first (documented in [packages/app/README.md](../packages/app/README.md)).
- **Visual polish (2026):** see [phase-1a-visual-polish.md](phase-1a-visual-polish.md) for tokens, banner/card tweaks, and dashboard/module UX.

## What was intentionally not built

- **`apps/web`**, Vite/Webpack host, HMR.
- **TanStack Query**, **bridge-client** wiring, **`DATA_ROOT`**, DBF or legacy paths.
- **Patient search**, **scheduler**, **charts**, writes.

## Tests

`src/app-shell.test.tsx` uses **`react-dom/server`** `renderToStaticMarkup` (same lightweight approach as `packages/ui`): landmarks, nav labels, default **`aria-current`**.

## Dependencies

| Package | Why |
|---------|-----|
| `@microdent/ui` | Buttons, cards, banner, badge, empty state, error UI. |
| `react` / `react-dom` **18.3.1** | Same pinned line as `packages/ui` (peer + dev). |
| `typescript`, `vitest` **2.1.9** | Build + tests; Vitest version matches security-patched workspace. |

**No new** router, query, icon, or chart libraries.

## Security / audit

Follows repo rules: no secrets, no legacy access, bridge remains **127.0.0.1** in the real service (this package does not start the bridge). Re-run **`pnpm audit`** periodically; prior note on **moderate** transitive **Vite/esbuild** (dev-only) from Vitest still applies until a coordinated Vitest/Vite upgrade.
