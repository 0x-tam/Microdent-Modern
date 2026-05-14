# @microdent/app

Application shell for Microdent Modern (layout, navigation state, read-only chrome, **Today** home with sample appointments, optional **bridge `GET /health`** when the host passes **`bridgeBaseUrl`**). **No router**, **no TanStack Query**, **no `/v1` table routes**.

## Styles

Import **in this order** in the host (e.g. future `apps/web` entry):

1. `@microdent/ui/tokens.css`
2. `@microdent/ui/components.css`
3. `@microdent/app/app-shell.css`

Then render `<AppShell />` from `@microdent/app`.

## Build

Requires **`@microdent/contracts`** and **`@microdent/bridge-client`** built (for types/exports), then **`@microdent/ui`**:

```bash
pnpm --filter @microdent/contracts run build
pnpm --filter @microdent/bridge-client run build
pnpm --filter @microdent/ui run build
pnpm --filter @microdent/app run build
```

## API

- **`AppShell`** — top bar (patient search teaser, **bridge health** via optional **`bridgeBaseUrl`** + **Refresh**), compact read-only banner, sidebar (`useState` selection), **Today** two-column home, module summaries + empty state per route. Props: **`bridgeBaseUrl`**, **`bridgeHealthLogDiagnostics`**. See [docs/phase-1a-bridge-health-ui.md](../../docs/phase-1a-bridge-health-ui.md).
- **`AppErrorBoundary`** — wraps volatile main content; shows **`ErrorState`** + retry.

## Dependencies

- **`@microdent/ui`** (workspace) — primitives only.
- **`@microdent/bridge-client`** (workspace) — **`getHealth()`** / **`GET /health`** when **`bridgeBaseUrl`** is configured.
- **React 18.3.x** — peer + dev, aligned with `packages/ui`.
