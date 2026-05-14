# Phase 1b — Patient search (backend only)

Read-only **`GET /v1/patients/search`** scans **`PATIENT.DBF`** under the configured **`DATA_ROOT`** (path-sandboxed, basename only). This band is **API + contracts + tests only** — no web UI.

## Route

- **`GET /v1/patients/search?q=...`**
- **`q`**: required, trimmed, **2–100** characters after trim.
- **503** if `DATA_ROOT` is not configured (same as other `/v1` routes).
- **400** if `q` is missing or shorter than 2 characters.
- **404** with `PATIENT_DBF_NOT_FOUND` if `PATIENT.DBF` is absent under `DATA_ROOT`.
- **500** with `PATIENT_SEARCH_ERROR` on unexpected read failures (response does not echo internal error text).

## Fields returned (JSON)

Each hit is **not** a raw DBF row. Shapes are validated by **`PatientSearchResponseSchema`** in `@microdent/contracts`.

| JSON field | Source (Microdent `PATIENT.DBF`) | Notes |
| --- | --- | --- |
| `patientId` | `ID` | Internal numeric id, stringified for JSON. |
| `chartNumber` | `CASENB` | Chart / case id when non-empty; otherwise `null`. |
| `displayName` | `NAME`, or `FIRST_NAME` + `LAST_NAME`, else `REV_NAME`, else `Patient {id}` | Built only from name-oriented columns. |
| `phoneMask` | `HOME_PHONE`, else `MOBILE` | **Never** the full number. Digits are stripped; if fewer than 4 digits, `null`; otherwise `…` + **last 4** digits (e.g. `…2003`). |

At most **20** hits are returned. Scanning stops once 20 matches are collected (see performance).

## Fields intentionally blocked

The bridge **does not** read memo fields for search, **does not** search phones, and **does not** return:

- Addresses (`STREET`, `CITY`, `STATE`, `ZIP`, `ADDRESS`, `BUILDING`, `PO_BOX`, …)
- Email, employer block, SS, DL, insurance ids
- `QUICKNOTE`, `PAT_M_COMP` (memo) or any other memo / free-text clinical or financial fields
- Payment / visit metadata (`LAST_PAY`, `LASTVISIT`, …) beyond what might accidentally appear — **none** of these are selected for output
- Raw row objects or arbitrary column maps

Search matching uses a **lowercased haystack** built only from: **`ID`**, **`CASENB`**, **`NAME`**, **`REV_NAME`**, **`FIRST_NAME`**, **`LAST_NAME`**.

## Schema reference (inspected copy)

Field names were taken from a **header-only / structural** inspection of `PATIENT.DBF` under the read-only legacy copy (FoxPro-style layout with `ID`, `CASENB`, name columns, phones, many other columns). **No production row values** are documented here.

**Uncertainty:** If a site uses different spellings or extra name columns, matching may miss until mappings are extended; keep changes minimal and privacy-preserving.

## Safety limits

- Read-only: **no** writes, packs, reindexes, or deletes.
- **No** full-row logging in the bridge for this route (errors must not include row payloads).
- **`@microdent/bridge-client`**: `searchPatients(query)` rejects queries shorter than 2 characters before calling the network.

## Local testing with copied `DATA_ROOT`

```bash
export DATA_ROOT="/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA"
# start the bridge (see root README), then:
curl -sS "http://127.0.0.1:17890/v1/patients/search?q=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' 'Sm')" | jq .
```

Replace host/port and use a **non-PHI** test substring in your environment.

## Automated tests

Bridge tests build a **synthetic** `PATIENT.DBF` in a temp directory (fake names only), point the bridge at that directory, and assert status codes, caps, and masking. **No real patient rows** are committed.

## Performance notes

The implementation performs a **sequential full-file scan** until **20** matches are found or the file ends. For large `PATIENT.DBF` files this is **O(n)** in the worst case (few matches). Future bands could add indexes, prefix trees, or server-side caching **outside** this read-only scope.

## Encoding

`PATIENT.DBF` is opened with **`win1252`** decoding (via `dbffile`) and **`readMode: 'loose'`** to tolerate legacy quirks without reading memo attachments for search.
