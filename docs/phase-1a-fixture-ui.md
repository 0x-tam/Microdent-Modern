# Phase 1A — Synthetic fixture UI (connectivity test)

## Purpose

A **small, clearly labelled** area on the **Today** dashboard exercises the bridge **read-only** table APIs using **only** the committed synthetic DBF (`fixture_tiny` / `FAKE_TINY.dbf`). It proves the web preview can talk to the bridge over HTTP with **`@microdent/bridge-client`**, without touching real Microdent **`DATA/`** or legacy trees.

This is **not** clinic data and must never be presented as patient information.

## What was built

- **`packages/app/src/fixture-connection-probe.ts`** — `probeSyntheticFixtureConnection()` calls exactly:
  - `GET /v1/meta/tables` via `client.getMetaTables()`
  - `GET /v1/tables/fixture_tiny/schema` via `client.getTableSchema("fixture_tiny")`
  - `GET /v1/tables/fixture_tiny/rows` via `client.getTableRows("fixture_tiny", { limit, offset: 0 })`
- **`packages/app/src/FixtureConnectionPanel.tsx`** — Card in the **Today** dashboard **aside** (below Reminders): dashed border, “Synthetic fixture only” copy, **Refresh test** button, and a tiny preview table when the probe succeeds.
- **`packages/app/src/fixture-connection-probe.test.ts`** — Vitest coverage for success, missing catalog entry, network, `DATA_ROOT_NOT_CONFIGURED`, `TABLE_NOT_FOUND`, and invalid body paths.
- **`packages/app/src/app-shell.css`** — Scoped styles for the dev panel.

## Behaviour

- **Auto-run:** When the top-bar bridge health reaches **Connected**, the panel runs the probe once (simple `useEffect`, no TanStack Query).
- **Manual refresh:** **Refresh test** always re-runs the three calls (useful after changing `DATA_ROOT` or restarting the bridge).
- **Bridge offline:** While the bar shows **Offline** / **Checking…**, the panel shows a short explanation and does not assume success. If the bridge later goes offline, stored results are cleared so the UI does not contradict the status bar.
- **Graceful errors** (mapped from `BridgeClientError` / HTTP bodies):
  - Network failure → bridge unreachable
  - **503** + `DATA_ROOT_NOT_CONFIGURED` → operator must set `DATA_ROOT` to the fixture sandbox
  - Fixture missing from meta list or **404** `TABLE_NOT_FOUND` → fixture unavailable
  - Schema validation failure → invalid response

## Routes called (only these)

| Route | Client method |
|-------|-----------------|
| `GET /v1/meta/tables` | `getMetaTables()` |
| `GET /v1/tables/fixture_tiny/schema` | `getTableSchema("fixture_tiny")` |
| `GET /v1/tables/fixture_tiny/rows?limit=5&offset=0` | `getTableRows("fixture_tiny", { limit: 5, offset: 0 })` |

No other `/v1` paths are used from this panel. No production table ids (`PATIENT`, `SCHEDULE`, etc.).

## How to run (bridge + web)

**1. `DATA_ROOT` must be the in-repo fixture sandbox** (absolute path). Do **not** point at `Microdent-Legacy-Copy/DATA` or any real clinic copy.

Example (macOS/Linux; adjust to your clone path):

```bash
export DATA_ROOT="/absolute/path/to/Microdent-Modern/services/bridge/fixtures/sandbox"
```

**2. Build and start the bridge** (from repo root):

```bash
pnpm install
pnpm --filter @microdent/contracts run build
pnpm --filter @microdent/bridge run build
pnpm --filter @microdent/bridge run start
```

**3. Web preview** (second terminal):

```bash
pnpm preview:web
```

Open **http://127.0.0.1:5173**, stay on **Today**. With the bridge up and `DATA_ROOT` set as above, **Data connection test** should show **Available**, field/row counts, and a few fake cells. Stop the bridge → top bar **Offline** and the panel returns to the offline explanation (no fake success).

Optional: **`apps/web/.env.local`** — `VITE_BRIDGE_BASE_URL=http://127.0.0.1:17890` if the bridge listens elsewhere.

## Tests

- **`packages/app/src/fixture-connection-probe.test.ts`** — probe outcomes.
- Existing shell tests still cover bridge health static paint.

## Dependencies

**None added** for this pass.
