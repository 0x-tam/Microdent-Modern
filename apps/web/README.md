# @microdent/web — Vite preview

Minimal **loopback-only** dev server to preview **`AppShell`** from `@microdent/app`. With the local **bridge** running, the shell calls **`GET /health`** for the status bar; the **Today** dashboard can also call read-only **`/v1/*`** routes for the **synthetic fixture** only when the bridge has **`DATA_ROOT`** set (see repo root README). No real clinic **`DATA/`** is used by default.

## Bridge URL (`VITE_BRIDGE_BASE_URL`)

- **Tracked template:** copy [`apps/web/.env.local.example`](./.env.local.example) if you need to recreate settings (same variable).
- **Local overrides:** `apps/web/.env.local` is gitignored and should define `VITE_BRIDGE_BASE_URL` for this machine. A default file may be created once from the example when you clone the repo; do not commit `.env.local`.
- On a **new clone**, if `apps/web/.env.local` is missing, create it without overwriting an existing file:

  ```bash
  test -f apps/web/.env.local || cp apps/web/.env.local.example apps/web/.env.local
  ```

- Default in code is still **`http://127.0.0.1:17890`** if the variable is unset; keeping **`.env.local`** in sync avoids surprises when tooling or env clearing drops defaults.

```bash
VITE_BRIDGE_BASE_URL=http://127.0.0.1:17890
```

## First-time / after dependency changes

**`predev`** / **`prebuild`** run **`@microdent/contracts`**, **`@microdent/bridge-client`**, **`@microdent/ui`**, and **`@microdent/app`** builds so workspace `dist/` exports resolve.

## Run bridge + web preview (Connected status)

**Terminal A — start the bridge** (from repo root):

```bash
pnpm install
pnpm --filter @microdent/contracts run build
pnpm --filter @microdent/bridge run build
pnpm --filter @microdent/bridge run start
```

**Terminal B — web preview:**

```bash
pnpm preview:web
```

Open **http://127.0.0.1:5173** in the browser.

**Health check (bridge is up):** open **http://127.0.0.1:17890/health** — you should see JSON with `"ok": true`. The preview top bar should show **Connected** when that endpoint responds and **`VITE_BRIDGE_BASE_URL`** points at the same host/port.

### Troubleshooting

- If the UI shows **Offline**, open **http://127.0.0.1:17890/health** in the browser. If that fails, start the bridge or fix `BRIDGE_HOST` / `BRIDGE_PORT`.
- If **`/health`** works in the address bar but the preview still shows **Offline**, check **which URL you opened for the app**: Vite **dev** often uses port **5173**; **`vite preview`** after a build often uses **4173**. The bridge only allows those loopback origins for CORS. Use **http://127.0.0.1:5173** or **http://127.0.0.1:4173** (or the matching `localhost` URLs) so the browser sends an allowed `Origin` header.
- After editing **`apps/web/.env.local`**, stop and run **`pnpm preview:web`** again so Vite reloads env vars.
- If health works in the browser but the preview stays **Offline**, confirm **`VITE_BRIDGE_BASE_URL`** in `.env.local` matches the bridge (including **`127.0.0.1`** vs **`localhost`**) and restart the preview.
- After changing **bridge CORS** or env files, restart **both** the bridge process and the web preview so each picks up changes.

In **development** builds, a small line under the status shows the bridge URL, last check time, and a **safe** offline reason (no stack traces).

## Commands (reference)

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
