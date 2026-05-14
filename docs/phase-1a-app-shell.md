# Phase 1A — App shell (Band A6)

## What was built

- **`packages/app`**: exportable **`AppShell`** and **`AppErrorBoundary`** for a future host (`apps/web` / desktop) — **no `apps/web` package** in this band to avoid extra bundler surface; hosts only need to import CSS and render the shell.
- **Layout** (see [design-system.md](design-system.md) §13 for target dimensions):
  - **Top bar** (`role="banner"`, 56px): product name **Microdent**, configurable **`clinicLabel`**, **bridge-offline pill** (`role="status"`, visible dot + text — not color-only), and a **neutral `Badge`** (“Sample UI”) with explicit `semanticLabel`.
  - **Global `ReadOnlyBanner`** under the bar (read-only phase messaging).
  - **Left rail** (~260px): labelled **“Modules”** + `<nav>` with `<ul>` of **buttons** using **`aria-current="true"`** for the active item and **`aria-controls`** pointing at the main region.
  - **Main** (`role="main"`, `id="app-main-region"`): page heading (`<h2>`) for the active module, **“Local bridge”** `Card` (bridge-down / not-connected copy — **no HTTP calls**), and **`AppErrorBoundary`** around the per-module **placeholder** (`EmptyState` only).
- **Navigation modules** (match [ui-redesign-plan.md](ui-redesign-plan.md) rail list): Dashboard, Patients, Schedule, Dental Chart, Treatment Plans, Payments, Reports, Settings — selection is **`useState`**, **no React Router**.
- **Styling**: **`app-shell.css`** uses only **`var(--ui-*)`** tokens; consumers must load UI tokens + component CSS first (documented in [packages/app/README.md](../packages/app/README.md)).

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
