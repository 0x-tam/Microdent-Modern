# Microdent Modern

Modern read-only clinic stack (bridge + shared contracts + future desktop shell). Product direction and phases live in [docs/master-build-plan.md](docs/master-build-plan.md).

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

The same script runs if you use `pnpm test` at the root. It builds `@microdent/contracts`, then runs `services/bridge` Vitest (including the `GET /health` integration test on a random port).

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

Only **`GET /health`** is implemented in Phase 1A; there is no DBF or patient data access yet.
