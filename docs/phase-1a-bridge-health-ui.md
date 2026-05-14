# Phase 1A — Bridge health in the web shell

## Behavior

- **`apps/web`** passes **`bridgeBaseUrl`** into **`AppShell`** (default **`http://127.0.0.1:17890`**, overridable with **`VITE_BRIDGE_BASE_URL`**).
- The **bridge** exposes **`GET /`** with a small JSON discovery payload (`service`, `health`) and **minimal CORS** for **local preview only**: `http:` **only**, host **`127.0.0.1`**, **`localhost`**, or **`::1`**, port **3000–5999** inclusive (echoed `Origin`, never `*`). Methods **GET** + **OPTIONS**; allowed request headers **Accept**, **Content-Type**; **no** `Access-Control-Allow-Credentials`. In non-`production` Node env, **`GET /debug/cors`** returns a static summary of this policy (no secrets, paths, or env).
- **`@microdent/bridge-client`**: **`getHealth()`** → **`GET /health`** for the top bar. The **Today** dashboard also includes a **synthetic fixture** dev card that calls **only** **`GET /v1/meta/tables`**, **`GET /v1/tables/fixture_tiny/schema`**, and **`GET /v1/tables/fixture_tiny/rows`** (see **`docs/phase-1a-fixture-ui.md`**). No other `/v1` routes and no real clinic DBF access from the UI.
- **Status line:** **Checking…** → **Connected** or **Offline**. Copy stays clinic-neutral; production UI does not show raw errors.
- **Diagnostics:** when **`bridgeHealthLogDiagnostics`** is true, **`apps/web`** sets it from **`import.meta.env.DEV`** so failures log to the **console** (still no PHI). When **`bridgeConnectionDiagnostics`** is true (also **DEV** in **`apps/web`**), a small block under the status shows **app origin** (`window.location.origin`), **bridge URL**, last check time, and a **safe** offline summary (no stack traces).
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

- **`services/bridge/src/local-preview-cors.test.ts`** — unit tests for **`isAllowedLocalPreviewOrigin`** (loopback + port range).
- **`services/bridge/src/root-and-cors.test.ts`** — **`GET /`**, **`GET /health`**, **`GET /debug/cors`**, CORS integration (allowed / blocked **`Origin`**, **OPTIONS**, no credentials header).
- **`packages/app/src/fixture-connection-probe.test.ts`** — synthetic fixture probe (success + error mapping).
- **`packages/app/src/bridge-health.test.ts`** — mock **`getHealth`** success/failure and **`describeBridgeHealthProbeError`** summaries.
- **`packages/app/src/app-shell.test.tsx`** — with **`bridgeBaseUrl`**, first static paint shows **Checking** and **Refresh**; without it, **Offline** and no Refresh.

## Dependencies

No new **registry** packages: **`@microdent/app`** depends on **`@microdent/bridge-client`** (workspace). **`apps/web`** `predev` / `prebuild` also run **`@microdent/contracts`** and **`@microdent/bridge-client`** builds so **`@microdent/app`** can compile against published `dist/` types.
