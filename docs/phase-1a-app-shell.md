# Phase 1A — App shell (Band A6)

## What was built

- **`packages/app`**: exportable **`AppShell`** and **`AppErrorBoundary`** for a future host (`apps/web` / desktop). Hosts import CSS and render the shell.
- **Layout** (see [design-system.md](design-system.md) §13):
  - **Top bar** (`role="banner"`): **Microdent**, **`clinicLabel`**, large **patient search** field (`role="search"`, disabled in the static shell), and a compact **`Clinic data off`** status (`role="status"`).
  - **Global `ReadOnlyBanner`** (compact variant): **Read-only mode** — short safety copy (see [phase-1a-clinic-ux-simplification.md](phase-1a-clinic-ux-simplification.md)).
  - **Left rail** (~220px): flat **Today**, **Patients**, **Schedule**, **Dental Chart**, **Treatments**, **Payments**, **Reports**, **Settings** — **`aria-current="true"`** on the active item, **`aria-controls`** → main.
  - **Main** (`role="main"`, `id="app-main-region"`): **`h2`** + lede; **Today** uses a **two-column** layout (appointments + next visit / quick actions / reminders) with **generic Sample patient** copy only; other modules use **`ModuleHome`** (summary, bullets, **EmptyState**) — still **no HTTP calls** from the shell.
- **Navigation IDs** (`AppNavModuleId`): **`today`**, **`patients`**, **`schedule`**, **`dental-chart`**, **`treatments`**, **`payments`**, **`reports`**, **`settings`** — **`useState`**, **no React Router**.
- **Styling**: **`app-shell.css`** uses **`var(--ui-*)`** only; load UI tokens + component CSS first ([packages/app/README.md](../packages/app/README.md)).
- **Docs:** [phase-1a-visual-polish.md](phase-1a-visual-polish.md) (earlier decorative pass); [phase-1a-clinic-ux-simplification.md](phase-1a-clinic-ux-simplification.md) (calmer clinic-first chrome and Today layout).

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
