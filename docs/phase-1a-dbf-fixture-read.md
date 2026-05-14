# Phase 1A — DBF fixture read path (Band A3)

## DBF dependency: `dbffile` (yortus / DBFFile)

**Chosen package:** [`dbffile`](https://www.npmjs.com/package/dbffile) (v1.12.x).

**Why:**

- Explicit support for **dBase III / IV, FoxPro, and Visual FoxPro** field types and file versions, with documented **memo (`.FPT`) read paths** for common variants (experimental for memo writes, which we do not use).
- **Maintained** TypeScript-first implementation with `DBFFile.open`, `readRecords`, and async iteration — fits a read-only bridge.
- **Encoding** can be set per file or field (`iconv-lite`), which matters for legacy French/Arabic text in later phases.
- **“Loose” read mode** exists for damaged files; the fixture uses strict mode.

**Limitations observed from upstream docs** (not an exhaustive audit):

- **Memo (`M`)** support is described as **read-only / partial** in some combinations.
- Unsupported field types in strict mode halt reads; loose mode skips unknown columns.
- **Write / append** APIs exist in the library but the bridge does **not** use them for legacy data.

## What was built

- **Committed fixture:** `services/bridge/fixtures/sandbox/FAKE_TINY.dbf` — three fake rows, fields `ALIAS` (character) and `SCORE` (numeric). No PHI.
- **Registry:** `services/bridge/src/dbf/table-registry.ts` — single logical id `fixture_tiny` → basename `FAKE_TINY.dbf`. No real Microdent table names.
- **Path safety:** DBF paths resolve only via `resolveRegisteredDbfPath` → `resolvePathWithinDataRoot` (basename-only registry entries).
- **Contracts (Zod):** `TablesListResponseSchema`, `TableSchemaResponseSchema`, `TableRowsResponseSchema`, `ApiErrorBodySchema` in `packages/contracts`.
- **Routes (read-only GET):**
  - `GET /v1/meta/tables`
  - `GET /v1/tables/:tableId/schema`
  - `GET /v1/tables/:tableId/rows?limit=&offset=`
- **Pagination:** default `limit` 50, hard cap **100**; `offset` ≥ 0 integers. Invalid values → **400** `INVALID_PAGINATION`.
- **Errors:** Unknown logical table → **404** `TABLE_NOT_FOUND`; malformed `tableId` (path-like / invalid pattern) → **400** `INVALID_TABLE_ID`; `DATA_ROOT` unset → **503** `DATA_ROOT_NOT_CONFIGURED`; DBF read failures → **500** `DBF_READ_ERROR` (generic message).
- **`GET /health`** unchanged.

## What was intentionally not built

- No reads from real **`DATA/`** or **Microdent-Legacy-Copy** paths.
- No `PATIENT`, `SCHEDULE`, `TRANS`, `OPERTBL`, `CHARTDBF`, or other production tables in the registry.
- No UI, search, or write APIs.

## Operator note

Point **`DATA_ROOT`** at an **absolute** directory that contains the fixture file (for tests, the `fixtures/sandbox` directory inside this repo). The bridge never auto-points `DATA_ROOT` at legacy trees.
