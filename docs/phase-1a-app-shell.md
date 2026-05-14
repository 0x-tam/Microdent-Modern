# Phase 1A — App shell (Band A6)

## What was built

- **`packages/app`**: exportable **`AppShell`** and **`AppErrorBoundary`** for a future host (`apps/web` / desktop). Hosts import CSS and render the shell.
- **Layout** (see [design-system.md](design-system.md) §13):
  - **Top bar** (`role="banner"`): **Microdent**, **`clinicLabel`**, large **patient search** field (`role="search"`, disabled in the static shell), **bridge health** (`role="status"`): **Checking…** / **Connected** / **Offline** when **`bridgeBaseUrl`** is set, plus **Refresh**; omit **`bridgeBaseUrl`** to skip **`GET /health`** (e.g. static tests).
  - **Global `ReadOnlyBanner`** (compact variant): **Read-only mode** — short safety copy (see [phase-1a-clinic-ux-simplification.md](phase-1a-clinic-ux-simplification.md)).
  - **Left rail** (~220px): flat **Today**, **Patients**, **Schedule**, **Dental Chart**, **Treatments**, **Payments**, **Reports**, **Settings** — **`aria-current="true"`** on the active item, **`aria-controls`** → main.
  - **Main** (`role="main"`, `id="app-main-region"`): **`h2`** + lede; **Today** uses a **two-column** layout (appointments + next visit / quick actions / reminders) with **generic Sample patient** copy only; other modules use **`ModuleHome`** (summary, bullets, **EmptyState**). Only **`GET /health`** is called from the shell when **`bridgeBaseUrl`** is configured — **no `/v1/*`** routes.
- **Navigation IDs** (`AppNavModuleId`): **`today`**, **`patients`**, **`schedule`**, **`dental-chart`**, **`treatments`**, **`payments`**, **`reports`**, **`settings`** — **`useState`**, **no React Router**.
- **Styling**: **`app-shell.css`** uses **`var(--ui-*)`** only; load UI tokens + component CSS first ([packages/app/README.md](../packages/app/README.md)).
- **Docs:** [phase-1a-visual-polish.md](phase-1a-visual-polish.md) (earlier decorative pass); [phase-1a-clinic-ux-simplification.md](phase-1a-clinic-ux-simplification.md) (calmer clinic-first chrome and Today layout); [phase-1a-web-preview.md](phase-1a-web-preview.md) (web + bridge).

## What was intentionally not built

- **TanStack Query**, **`DATA_ROOT`**, DBF or legacy paths, **`/v1/*`** table/meta routes from the shell.
- **Patient search**, **scheduler**, **charts**, writes.

## Tests

`src/app-shell.test.tsx` uses **`react-dom/server`** `renderToStaticMarkup` (same lightweight approach as `packages/ui`): landmarks, nav labels, default **`aria-current`**, bridge line when **`bridgeBaseUrl`** is set vs omitted.

`src/bridge-health.test.ts` covers **`probeBridgeHealth`** with a mock client (no real bridge process).

## Dependencies

| Package | Why |
|---------|-----|
| `@microdent/ui` | Buttons, cards, banner, badge, empty state, error UI. |
| `@microdent/bridge-client` | Typed **`GET /health`** only when the host supplies **`bridgeBaseUrl`**. |
| `react` / `react-dom` **18.3.1** | Same pinned line as `packages/ui` (peer + dev). |
| `typescript`, `vitest` **2.1.9** | Build + tests; Vitest version matches security-patched workspace. |

**No new** router, query, icon, or chart libraries.

## Security / audit

Follows repo rules: no secrets, no legacy access, bridge remains **127.0.0.1** in the real service (this package does not start the bridge). Re-run **`pnpm audit`** periodically; prior note on **moderate** transitive **Vite/esbuild** (dev-only) from Vitest still applies until a coordinated Vitest/Vite upgrade.
