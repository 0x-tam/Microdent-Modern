# @microdent/app

Application shell for Microdent Modern (layout, navigation state, read-only chrome). **No router, no data fetching, no bridge-client** in Band A6.

## Styles

Import **in this order** in the host (e.g. future `apps/web` entry):

1. `@microdent/ui/tokens.css`
2. `@microdent/ui/components.css`
3. `@microdent/app/app-shell.css`

Then render `<AppShell />` from `@microdent/app`.

## Build

Requires `@microdent/ui` built first:

```bash
pnpm --filter @microdent/ui run build
pnpm --filter @microdent/app run build
```

## API

- **`AppShell`** — top bar, read-only banner, sidebar (`useState` selection), bridge-offline placeholder card, main placeholder per module.
- **`AppErrorBoundary`** — wraps volatile main content; shows **`ErrorState`** + retry.

## Dependencies

- **`@microdent/ui`** (workspace) — primitives only.
- **React 18.3.x** — peer + dev, aligned with `packages/ui`.
