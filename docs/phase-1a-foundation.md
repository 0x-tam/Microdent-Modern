# Phase 1A — Foundation (Band A1)

## What was built

- **pnpm workspace** monorepo at the repository root (`package.json`, `pnpm-workspace.yaml`) with packages under `packages/*` and `services/*`.
- **`packages/contracts`**: shared Zod schema `HealthResponseSchema` for `GET /health` (`{ ok: boolean, version: string }`) plus exported TypeScript type.
- **`services/bridge`**: minimal **Express** HTTP server that listens on **127.0.0.1:17890** by default; **`BRIDGE_HOST`** and **`BRIDGE_PORT`** override bind address and port. The only route is **`GET /health`**, returning JSON validated against the contract (and asserting shape before send).
- **Automated test**: starts the app on an ephemeral port (`listen(0)`), requests `/health`, expects **200**, and validates the body with **Zod** (`HealthResponseSchema.safeParse`).
- **README** instructions for install, `pnpm test`, npm workspace equivalents, and running the bridge.

## What was intentionally not built

- No **`DATA_ROOT`**, path sandbox, DBF readers, table registry, or any access to real patient data.
- No **`GET /v1/*` routes**, pagination, scheduler, search, or writes.
- No **UI**, desktop shell, or `bridge-client` package.
- No rate limiting, auth token, or structured logging beyond a startup line on the default server entry.
- No CI workflow file in this step (local `pnpm test` is the gate).

## Next (Band A2)

Per the master plan: **`DATA_ROOT` configuration**, path sandbox hardening, traversal rejection tests, and read-only file helpers—still without wiring full production tables until later bands.
