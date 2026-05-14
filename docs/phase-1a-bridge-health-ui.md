# Phase 1A — Bridge health in the web shell

## Behavior

- **`apps/web`** passes **`bridgeBaseUrl`** into **`AppShell`** (default **`http://127.0.0.1:17890`**, overridable with **`VITE_BRIDGE_BASE_URL`**).
- **`@microdent/bridge-client`** is used for **`getHealth()`** → **`GET /health`** only. No **`/v1/meta/tables`**, **`/v1/tables/...`**, or DBF access from the UI.
- **Status line:** **Checking…** → **Connected** or **Offline**. Copy stays clinic-neutral; technical errors are **not** shown in the main UI.
- **Diagnostics:** when **`bridgeHealthLogDiagnostics`** is true, **`apps/web`** sets it from **`import.meta.env.DEV`** so failures log to the **console only** (still no PHI).
- **Refresh:** ghost **Refresh** next to the status re-runs the health check.

## Run bridge + web (two terminals)

**Terminal A — bridge** (from repo root; needs contracts built once):

```bash
pnpm --filter @microdent/contracts run build
pnpm --filter @microdent/bridge run build
pnpm --filter @microdent/bridge run start
```

Default listen: **`127.0.0.1:17890`** (see bridge README / env).

**Terminal B — web preview:**

```bash
pnpm install
pnpm preview:web
```

Open **http://127.0.0.1:5173**. With the bridge running, the bar should move to **Connected**; stop the bridge → **Offline** (use **Refresh** after restarting the bridge).

## Optional env

Create **`apps/web/.env.local`** (not committed) if the bridge listens elsewhere:

```bash
VITE_BRIDGE_BASE_URL=http://127.0.0.1:17890
```

## Tests

- **`packages/app/src/bridge-health.test.ts`** — mock **`getHealth`** success/failure.
- **`packages/app/src/app-shell.test.tsx`** — with **`bridgeBaseUrl`**, first static paint shows **Checking** and **Refresh**; without it, **Offline** and no Refresh.

## Dependencies

No new **registry** packages: **`@microdent/app`** depends on **`@microdent/bridge-client`** (workspace). **`apps/web`** `predev` / `prebuild` also run **`@microdent/contracts`** and **`@microdent/bridge-client`** builds so **`@microdent/app`** can compile against published `dist/` types.
