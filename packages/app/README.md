# @microdent/app

Application shell for Microdent Modern (layout, navigation state, read-only chrome, **Today** home with sample appointments). **No router, no data fetching, no bridge-client.**

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

- **`AppShell`** — top bar (patient search teaser, quiet clinic-data status), compact read-only banner, sidebar (`useState` selection), **Today** two-column home, module summaries + empty state per route. See [docs/phase-1a-clinic-ux-simplification.md](../../docs/phase-1a-clinic-ux-simplification.md).
- **`AppErrorBoundary`** — wraps volatile main content; shows **`ErrorState`** + retry.

## Dependencies

- **`@microdent/ui`** (workspace) — primitives only.
- **React 18.3.x** — peer + dev, aligned with `packages/ui`.
