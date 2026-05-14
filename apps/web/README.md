# @microdent/web — Vite preview

Minimal **loopback-only** dev server to preview **`AppShell`** from `@microdent/app`. No bridge, no patient data.

## First-time / after UI or app changes

`@microdent/app` consumes built `@microdent/ui` and its own `dist/`. **`predev`** / **`prebuild`** run UI + app builds automatically.

## Commands

From repo root:

```bash
pnpm --filter @microdent/web run dev
```

Then open **http://127.0.0.1:5173** (Vite is configured for `127.0.0.1` only).

Production bundle check:

```bash
pnpm --filter @microdent/web run build
pnpm --filter @microdent/web run preview
```

Preview serves **http://127.0.0.1:4173**.

## CSS order

Declared in `src/main.tsx`: `@microdent/ui/tokens.css` → `@microdent/ui/components.css` → `@microdent/app/app-shell.css`.
