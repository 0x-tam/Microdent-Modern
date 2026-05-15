# Phase 2 — Mirror status endpoint and dev diagnostic

**Status:** Implemented.

**Scope:** Safe read-only metadata for whether the bridge is using the SQLite mirror or DBF fallback. No paths, row payloads, or PHI in responses or dev UI.

---

## HTTP API

`GET /v1/mirror/status`

Does **not** require `DATA_ROOT`. Returns:

| Field | Type | Meaning |
| --- | --- | --- |
| `sqliteConfigured` | boolean | `SQLITE_PATH` is set to a non-empty absolute path |
| `sqliteUsable` | boolean | File exists, opens read-only, and `schema_migrations` has at least one row |
| `importedTables` | string[] | Domain mirror tables with `COUNT(*) > 0` (names only) |
| `latestImportRuns` | object[] | Latest finished import per table: `tableName`, `status`, `rowCount`, `errorCount`, `finishedAt` |

**Never returned:** `SQLITE_PATH`, `DATA_ROOT`, file paths, row values, patient names, `import_errors.message`, `import_runs.notes`, or fingerprints.

### Behavior

| Condition | `sqliteConfigured` | `sqliteUsable` |
| --- | --- | --- |
| `SQLITE_PATH` unset / blank | `false` | `false` |
| Path set but file missing | `true` | `false` |
| Path set but not a valid migrated DB | `true` | `false` |
| Valid migrated mirror file | `true` | `true` |

Read paths (patient search, reference doctors/procedures) still choose SQLite per-table via `isSqliteMirrorUsable`; the dev line summarizes global mirror file health.

---

## Client

`BridgeClient.getMirrorStatus()` → `GET /v1/mirror/status` (Zod: `MirrorStatusResponseSchema`).

---

## Dev UI

When `mirrorConnectionDiagnostics` is true (web app: `import.meta.env.DEV` only), and the bridge health probe is **connected**, the shell fetches mirror status and shows one line under bridge connection diagnostics:

- **Mirror: active** — `sqliteUsable === true`
- **Mirror: DBF fallback** — configured but not usable, or mirror not ready

Not shown in production builds. Hidden when bridge is offline or the request fails.

Props: `mirrorConnectionDiagnostics` on `AppShell` (paired with `bridgeConnectionDiagnostics` in `apps/web`).

---

## Tests

- `services/bridge/src/mirror-status-routes.test.ts` — no path, synthetic import, invalid file, missing file; JSON leak checks
- `packages/app/src/app-shell.test.tsx` — mirror line absent without dev flag
- `packages/bridge-client` — add `getMirrorStatus` mock test if present in suite

Run on **Node 22.5+** for full monorepo `pnpm test` (sqlite-mirror + bridge mirror route).

---

## Related

- `services/bridge/src/sqlite/mirror-status.ts` — reader
- `packages/contracts/src/mirror-status.ts` — wire schema
- `docs/phase-2-sqlite-read-routes.md` — per-route DBF/SQLite switching
