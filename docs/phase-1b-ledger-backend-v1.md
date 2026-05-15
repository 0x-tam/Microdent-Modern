# Phase 1b — Patient ledger v1 (backend only)

Read-only **`GET /v1/patients/:patientId/ledger`** loads transaction metadata from **`TRANS.DBF`** under **`DATA_ROOT`**, keyed by **`PATIENT_ID`** (numeric string match to profile/search **`patientId`**). **API + contracts + bridge client + tests only** — no payments UI, no writes, **no monetary amounts** in responses.

**Mapping reference:** [phase-1b-ledger-payments-mapping.md](phase-1b-ledger-payments-mapping.md).

## Route

- **`GET /v1/patients/:patientId/ledger`**
- **`503`** — `DATA_ROOT_NOT_CONFIGURED` when `DATA_ROOT` is unset.
- **`400`** — `INVALID_PATIENT_ID` when `patientId` is not a positive integer without leading zeros.
- **`404`** — `TRANS_DBF_NOT_FOUND` if **`TRANS.DBF`** is missing under `DATA_ROOT`.
- **`500`** — `PATIENT_LEDGER_ERROR` on open/scan/parser failures (generic message; no row payloads).
- **`200`** — when the file exists but no rows match: `entries: []` (not **404**).

Matching rows are sorted by **`DATE`** descending, then **`TRANS_NB`** descending. At most **100** entries per patient; **`truncated: true`** when more matching rows exist.

## Fields returned (JSON)

Validated by **`PatientLedgerResponseSchema`** (`strict`).

| JSON field | Source | Notes |
| --- | --- | --- |
| `patientId` | path | Echo of requested id. |
| `entries[]` | `TRANS` rows | Safe lines only (see below). |
| `entries[].ledgerEntryId` | `TRANS_NB` | Stringified line id. |
| `entries[].patientId` | path | Echo per line. |
| `entries[].date` | `DATE` | `YYYY-MM-DD` or `null`. |
| `entries[].chargeTypeCode` | `CH_TYPE` | Opaque integer or `null`. |
| `entries[].adjustmentTypeCode` | `ADJ_TYPE` | Opaque integer or `null`. |
| `entries[].paymentTypeCode` | `PAY_TYPE` | Opaque integer or `null`. |
| `entries[].isCardPayment` | `CARD` | Boolean or `null`. |
| `entries[].hasDescription` | `DESCR` | `true` when memo appears populated; **text never returned**. |
| `truncated` | derived | Cap exceeded during scan. |
| `privacyNote` | constant | Documents blocked columns. |

## Fields intentionally blocked

Never included in JSON (fixture tests assert absence of decoy values and column names):

| Column | Reason |
| --- | --- |
| `AMOUNT`, `SAMOUNT` | Payment amounts — deferred until type semantics are documented |
| `DESCR` | Memo narrative |
| `PLANNUM` | Insurance/plan episode linkage |
| `INSPAYNO` | Insurance remittance reference |
| `DOCT`, `QUANTITY`, `MONTH`, `YEAR` | Deferred metadata |
| `PATIENT.DBF` | Not opened on this route |
| `TRETPLAN`, `_transto` | Out of scope for v1 |
| Raw DBF row | No arbitrary column maps |

## Privacy limits

- **No amounts** in API, tests, or logs.
- **No memo text** — presence only via `hasDescription`.
- **No insurance identifiers** on the wire in v1.
- **No patient table reads** — path `patientId` is the only patient identifier returned.
- **Staff-only:** treat like other `/v1` patient routes (localhost / future auth).

## Contracts (`@microdent/contracts`)

- **`PatientLedgerPathParamsSchema`** — same id rules as profile.
- **`LedgerEntryV1Schema`** — one ledger line.
- **`PatientLedgerResponseSchema`** — strict response body.

## Bridge client (`@microdent/bridge-client`)

- **`getPatientLedger(patientId)`** → `GET /v1/patients/{id}/ledger`.

## Automated tests

- **`patient-ledger-routes.test.ts`** — synthetic **`TRANS.DBF`** with decoy amount/memo/insurance values; cap, id matching, and privacy assertions.
- **`client.test.ts`** — URL construction and client-side id validation.

## Uncertainty (`TRANS.DBF` semantics)

- **`PATIENT_ID`** is `N` 6 vs **`PATIENT.ID`** `N` 10 — matching uses stringified integers.
- **`CH_TYPE` / `ADJ_TYPE` / `PAY_TYPE`** — opaque codes; debit/credit meaning unknown until SME codebook.
- Full-file scan is O(n) over ~344k rows; per-patient filter only — Phase 2 mirror recommended for scale.
- Header **`0xF5`**: reader uses `readMode: "loose"` like other VFP tables.

## Local manual check (copy only)

```bash
export DATA_ROOT="/path/to/Microdent-Legacy-Copy/DATA"
# start bridge, then:
curl -sS "http://127.0.0.1:17890/v1/patients/12345/ledger" | jq .
```
