# @microdent/web — Vite preview

Minimal **loopback-only** dev server to preview **`AppShell`** from `@microdent/app`. **Optional:** with the local **bridge** running on **`127.0.0.1:17890`**, the shell calls **`GET /health`** only — no patient data, no **`/v1/*`** routes.

## First-time / after dependency changes

**`predev`** / **`prebuild`** run **`@microdent/contracts`**, **`@microdent/bridge-client`**, **`@microdent/ui`**, and **`@microdent/app`** builds so workspace `dist/` exports resolve.

## Bridge URL

Default base URL is **`http://127.0.0.1:17890`**. Override with **`VITE_BRIDGE_BASE_URL`** in **`apps/web/.env.local`** (optional).

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
