# Phase 1b — Legacy DATA catalog (read-only metadata)

This band adds the **first controlled read** of real Microdent-style DBF files under a configured **`DATA_ROOT`**: a **table catalog only**. No row payloads, no patient search, no scheduler UI, and no writes.

## What is detected

The bridge exposes **`GET /v1/legacy/catalog`**, which returns a fixed list of **known** legacy basenames (see `services/bridge/src/dbf/legacy-catalog-registry.ts`). For each entry it reports:

| Field | Meaning |
| --- | --- |
| `tableId` | Stable logical id (e.g. `patient`, `schedule`) |
| `displayName` | Staff-facing label (no PHI) |
| `fileName` | Expected basename (e.g. `PATIENT.DBF`) |
| `present` | Whether that file exists under `DATA_ROOT` (path-safe resolution) |
| `recordCount` | Active record count from the **DBF header** when the file opens; otherwise `null` |
| `fieldCount` | Number of field definitions from the **DBF header** when readable; otherwise `null` |

The reader uses **`DBFFile.open`** and header metadata only; it does **not** call `readRecords` or stream cell values. Logs and API responses must not include row contents.

## What stays blocked

- **`GET /v1/tables/:id/rows`** and **`/schema`** remain limited to **`TABLE_REGISTRY`** (synthetic `fixture_tiny` only in this repo). Legacy logical ids are **not** row routes.
- No payments, treatments, charting, medical history UIs, or patient search.
- No modification of files under `DATA_ROOT`.

## Running the bridge against a copied legacy `DATA` folder

Point **`DATA_ROOT`** at the absolute path of the **read-only copy** of legacy data (example on this machine):

```bash
export DATA_ROOT="/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA"
pnpm --filter @microdent/bridge exec node --import tsx src/main.ts
```

(Use your repo’s documented bridge start command if it differs; the requirement is only that **`DATA_ROOT`** resolves to the folder that contains the `.DBF` files.)

Then call:

```bash
curl -sS "http://127.0.0.1:17890/v1/legacy/catalog" | jq .
```

Replace host/port with your bridge listen settings.

## Web app

The **Today** dashboard shows a **“Legacy data catalog”** card: availability and header counts only, with copy that this is a **read-only catalog from the copied legacy DATA folder**. The synthetic **fixture** panel remains separate and visually de-emphasized; it may still show **fake** row cells for `fixture_tiny` only.

## Safety limitations

- **Catalog ≠ validation**: a present file might still be unreadable (corrupt, unsupported variant); then `recordCount` / `fieldCount` may be `null` while `present` is `true`.
- **No PHI in repo artifacts**: tests use the committed **`FAKE_TINY.dbf`** copied to **`PATIENT.DBF`** in a temp directory to prove header parsing — not real patient data.
- **Do not** point `DATA_ROOT` at production backups in shared logs or screenshots.
- **Folder policy**: never modify `Microdent-Legacy`; treat `Microdent-Legacy-Copy` as read-only from the app’s perspective (only the bridge reads files the OS allows).

## Parser notes (real files)

Some production DBFs use formats or flags that **`dbffile`** may not fully support. If a specific file fails to open, the catalog still lists it with `present: true` and `recordCount` / `fieldCount` set to `null`. Document any recurring basenames in runbooks after operator verification — do not paste row samples into docs.
