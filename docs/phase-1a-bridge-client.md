# Phase 1A — `bridge-client` (Band A4)

## What was built

- **`packages/bridge-client`**: small typed HTTP client for the local bridge, consuming **`@microdent/contracts`** Zod schemas for **response validation** on success paths. **`tsc -p tsconfig.build.json`** emits **`.d.ts`** alongside **`dist/*.js`** for workspace consumers (e.g. **`@microdent/app`**).
- **`BridgeClient`** methods:
  - `getHealth()` → `GET /health`
  - `getMetaTables()` → `GET /v1/meta/tables`
  - `getTableSchema(tableId)` → `GET /v1/tables/:tableId/schema`
  - `getTableRows(tableId, { limit?, offset? })` → `GET /v1/tables/:tableId/rows` with query string when params are set
- **`createBridgeClient({ baseUrl, fetch? })`**: factory; **`fetch`** is injectable for tests or non-default runtimes. When omitted, the client uses **`globalThis.fetch.bind(globalThis)`** so calls work in browsers (avoids **`Illegal invocation`** from an unbound **`window.fetch`** reference).
- **`BridgeClientError`**: unified failure type with **`kind`**: `network` | `http` | `invalid_body` | `invalid_argument`, optional **`status`**, and **`apiCode` / `apiMessage`** when a non-2xx body matches **`ApiErrorBodySchema`**.

## What was intentionally not built

- No React app, TanStack Query, or UI.
- No hardcoded production table names beyond what tests use as **opaque example strings** matching the synthetic fixture id (`fixture_tiny`) from the bridge registry.
- No automatic `DATA_ROOT` or DBF file access from this package (HTTP only).

## Error-handling choices

- **Network vs HTTP vs body**: Any `fetch` throw → **`network`**. Received response with **`!res.ok`** → if body parses as **`ApiErrorBody`**, throw **`http`** via **`BridgeClientError.fromApiErrorBody`** (preserves bridge **`code`/`message`**); otherwise **`http`** with a generic message. **`res.ok`** but JSON parse fails → **`invalid_body`**. JSON parses but Zod fails → **`invalid_body`** (cause carries Zod issues for debugging).
- **Table id validation**: Same **`^[a-z][a-z0-9_]*$`** rule as the bridge; invalid ids throw **`invalid_argument`** **before** `fetch` to avoid odd URLs and to mirror server-side rejection.
- **Empty body on 2xx**: Treated as **`null`** JSON; success schemas will fail validation → **`invalid_body`** (bridge today always returns JSON bodies on success).

## Tests

Vitest unit tests with a **mock `fetch`** (no real bridge process, no DBF reads). Includes a regression test that **`globalThis.fetch`** must receive the correct **`this`** binding when no custom **`fetch`** is passed. Run from repo root via **`pnpm test`** / **`npm test`** after **`@microdent/contracts`** build.
