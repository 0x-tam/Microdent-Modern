# Microdent Modern

Modern read-only clinic stack (bridge + shared contracts + future desktop shell). Product direction and phases live in [docs/master-build-plan.md](docs/master-build-plan.md).

**Warning:** Real Microdent `DATA` must stay **outside** git. Do not add production or clinic `DATA/` trees to this repository. For local read-only testing, use only an absolute **`DATA_ROOT`** pointing at a **copied** path on disk (never commit PHI or real patient tables).

**Data hygiene:** Legacy install trees and FoxPro/VB binaries must **never** be committed. The repo only ships a tiny synthetic DBF for automated tests.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- [pnpm](https://pnpm.io/) 9 (recommended). Enable via Corepack: `corepack enable`

## Install

```bash
pnpm install
```

## Tests

From the repository root after `pnpm install` or `npm install`:

```bash
npm test
```

The same script runs if you use `pnpm test` at the root. It builds `@microdent/contracts`, runs bridge tests, **builds and tests `@microdent/bridge-client`**, then **builds and tests `@microdent/ui`**, then **builds and tests `@microdent/app`**.

## Application shell (Band A6)

The **`@microdent/app`** package exports **`AppShell`** (top bar with optional **bridge health**, sidebar, read-only banner, **Today** home). See [docs/phase-1a-app-shell.md](docs/phase-1a-app-shell.md), [docs/phase-1a-responsive-layout.md](docs/phase-1a-responsive-layout.md), [docs/phase-1a-bridge-health-ui.md](docs/phase-1a-bridge-health-ui.md), and [packages/app/README.md](packages/app/README.md). Host apps should import, in order: `@microdent/ui/tokens.css`, `@microdent/ui/components.css`, `@microdent/app/app-shell.css`.

### Browser preview (`apps/web`)

**Bridge URL:** tracked example at [`apps/web/.env.local.example`](apps/web/.env.local.example). Local file **`apps/web/.env.local`** (gitignored) should set `VITE_BRIDGE_BASE_URL=http://127.0.0.1:17890`. If it is missing after clone, run `test -f apps/web/.env.local || cp apps/web/.env.local.example apps/web/.env.local` from the repo root (does not overwrite an existing file).

**Run the shell in a local Vite dev server** (loopback only; **`GET /health`** to the local bridge — no patient data):

1. **Terminal A — start the bridge:**

   ```bash
   pnpm install
   pnpm --filter @microdent/contracts run build
   pnpm --filter @microdent/bridge run build
   pnpm --filter @microdent/bridge run start
   ```

2. **Terminal B — web preview:**

   ```bash
   pnpm preview:web
   ```

3. Open **http://127.0.0.1:5173** (or **http://127.0.0.1:4173** when using `pnpm --filter @microdent/web run preview` after a build). Confirm the bridge with **http://127.0.0.1:17890/health** (JSON `ok`). The top bar should show **Connected** when health succeeds: the bridge allows browser **`Origin`** values that are **`http://`** on **`127.0.0.1`**, **`localhost`**, or **`::1`** with a port from **3000** through **5999** (typical Vite and other local dev servers).

**Troubleshooting:** If **`/health`** works in the address bar but the UI stays **Offline**, open the dev diagnostics under the status (in **`import.meta.env.DEV`**) and compare **App origin** to that rule. Loopback **`http`** on ports **3000–5999** is allowed; LAN IPs and **`https`** preview origins are not. **Restart the bridge** after changing CORS logic, and restart the web preview after **`.env.local`** changes.

Or: `pnpm --filter @microdent/web run dev`. Details: [docs/phase-1a-web-preview.md](docs/phase-1a-web-preview.md) and [apps/web/README.md](apps/web/README.md).

Verify the production bundle:

```bash
pnpm build:web
```

To run only the bridge tests (after contracts are already built):

```bash
npm run test --workspace=@microdent/bridge
```

## Bridge (Phase 1A)

Run a production-style server (build first):

```bash
pnpm --filter @microdent/contracts run build
pnpm --filter @microdent/bridge run build
pnpm --filter @microdent/bridge run start
```

Defaults: bind **127.0.0.1**, port **17890**. Override with `BRIDGE_HOST` and `BRIDGE_PORT`.

Development with auto-reload:

```bash
pnpm --filter @microdent/contracts run build
pnpm --filter @microdent/bridge run dev
```

**`GET /health`** is always available. Read-only **`GET /v1/*`** DBF routes are available only when **`DATA_ROOT`** is configured (see Band A3 section below). There is no access to real patient data in the default repo layout.

## `DATA_ROOT` (Band A2)

The bridge reads optional **`DATA_ROOT`** from the environment. If unset or blank, **`GET /v1/*`** table routes respond with **503** (`DATA_ROOT_NOT_CONFIGURED`). When set, it must be an **absolute** path; relative values cause **`loadBridgeConfig()`** to throw at startup. Path helpers live under `services/bridge/src/safety/`; see [docs/phase-1a-safety-module.md](docs/phase-1a-safety-module.md) for behavior, tests, and symlink caveats.

## Read-only DBF fixture API (Band A3)

With **`DATA_ROOT`** set to the absolute path of `services/bridge/fixtures/sandbox` (or any directory that contains the committed **`FAKE_TINY.dbf`**), the bridge exposes:

- `GET /v1/meta/tables`
- `GET /v1/tables/:tableId/schema`
- `GET /v1/tables/:tableId/rows?limit=&offset=` (default limit 50, max 100)

Only the synthetic registry entry **`fixture_tiny`** is available. Details and parser notes: [docs/phase-1a-dbf-fixture-read.md](docs/phase-1a-dbf-fixture-read.md).

## Typed bridge client (Band A4)

The **`@microdent/bridge-client`** package wraps the HTTP API with Zod-validated responses. See [docs/phase-1a-bridge-client.md](docs/phase-1a-bridge-client.md). The **`apps/web`** preview uses **`getHealth()`** for the status bar and optional **`/v1/*`** calls for the synthetic fixture only; see [docs/phase-1a-bridge-health-ui.md](docs/phase-1a-bridge-health-ui.md) and [docs/phase-1a-fixture-ui.md](docs/phase-1a-fixture-ui.md). Set **`VITE_BRIDGE_BASE_URL`** via **`apps/web/.env.local`** (see **`apps/web/.env.local.example`**).

## UI primitives (Band A5)

The **`@microdent/ui`** package provides design tokens (CSS variables) and base React components. See [docs/phase-1a-ui-foundation.md](docs/phase-1a-ui-foundation.md) and [packages/ui/README.md](packages/ui/README.md).
