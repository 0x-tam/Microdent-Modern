# Phase 1b — Procedure reference (backend only)

Read-only **`GET /v1/reference/procedures`** reads **`PROCCHRT.DBF`** under **`DATA_ROOT`**. This band is **API + contracts + bridge client + tests only** — no treatment history UI and no writes.

## Route

### `GET /v1/reference/procedures`

- **503** if `DATA_ROOT` is not configured (`DATA_ROOT_NOT_CONFIGURED`).
- **404** with `PROCCHRT_DBF_NOT_FOUND` if **`PROCCHRT.DBF`** is absent.
- **500** with `REFERENCE_PROCEDURES_ERROR` on unexpected read failures (no row payloads in the message).

The bridge performs one sequential scan of **`PROCCHRT.DBF`**, skipping soft-deleted rows, and returns a sorted list of safe dictionary entries. There is no pagination cap (typical deployments have a small row count on this table).

## Contracts (`@microdent/contracts`)

- **`ReferenceProceduresResponseSchema`** / **`ReferenceProcedureItemSchema`**

## Response fields

| JSON field | Source (`PROCCHRT`) | Notes |
| --- | --- | --- |
| `procedureCode` | `PROCNB` | Trimmed character code; primary join key for future `OPERTBL` / schedule class resolution (normalize width vs `OPERTBL.PROCNB` in the client). |
| `displayName` | `PROCEDURE` | Trimmed dictionary label; `null` when blank. |
| `category` | `CLASS` | Trimmed class / category text; `null` when blank. |
| `categoryCode` | `CATAGORY` | Trimmed legacy column name (FoxPro spelling); `null` when blank. |
| `classId` | `CLASS_ID` | Integer when non-zero; otherwise `null`. |
| `chartRelevant` | `CHART` | Boolean from FoxPro logical. |

There is **no** `active` field in this pass: the header has no column with a clear “inactive procedure” meaning (`PROTECTED`, `NOSHOW`, and `DEFAULT` were not mapped without SME confirmation).

## Intentionally blocked (never returned)

- **All fee / price columns:** `PRICE1` … `PRICE9`, `PER_PROF`, `QTYPRIC`, `QTYOH`.
- **Accounting / posting hints:** `TRANS_CODE`, `NI`, and similar numeric codes tied to ledger behavior.
- **Staff / config noise:** `USER`, `LANGUAGE`, `MODIFIER`, `GROUP`, `POS`, `PEDO`, `QUESTION`, `TAX`, `STOCK`, `PRC_ID`, `MODI_ID`, `DEFAULT`, `PROTECTED`, `THSURF`, `NOSHOW`, etc.
- **Raw DBF row maps**, arbitrary field dumps, and memo bodies (none on this table in the inspected copy).

Logs and error responses do **not** include procedure row payloads.

## Intended UI usage

Future **treatment** and **schedule** views should:

1. Load this dictionary once (TanStack Query, long `staleTime`) when `DATA_ROOT` is available.
2. Build an in-memory map `procedureCode → { displayName, category, … }` using normalized codes (trim; consider left-align / padding rules vs `OPERTBL.PROCNB` width mismatch).
3. Render **`displayName`** (fallback: `procedureCode`) for procedure chips, tooltips, and legend text — **not** raw `OPERTBL.PROCEDURE` patient-specific strings on the first pass.
4. Use **`category`** / **`classId`** / **`categoryCode`** only for grouping or color keys after product review; they are business configuration, not PHI.
5. Never surface prices from this route; fee displays require a separate approved API.

## Bridge client (`@microdent/bridge-client`)

- **`getReferenceProcedures()`** → `GET /v1/reference/procedures`

## Automated tests

Bridge **`reference-procedures-routes.test.ts`** builds a **synthetic** `PROCCHRT.DBF` in a temp directory (fake codes and labels only). Covers success, JSON must not contain `PRICE` / fee keys, missing `DATA_ROOT`, and missing `PROCCHRT.DBF`.

Bridge-client tests cover URL construction for the reference route.

## Running against a copied `DATA_ROOT`

```bash
export DATA_ROOT="/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA"
# start the bridge (see repo README), then:
curl -sS "http://127.0.0.1:17890/v1/reference/procedures" | jq '.procedures | length'
```

Do not paste JSON containing real fee data or identifiable clinic configuration into public tickets.

## Semantics uncertainty

- **`CLASS` vs `CATAGORY` vs `CLASS_ID`:** exact legacy UI semantics (grouping vs ADA category vs internal id) need SME confirmation; all three are exposed as separate safe fields for now.
- **`CHART`:** assumed “show on chart / chart-relevant procedure,” not “active in fee schedule.”
- **Code normalization:** `PROCNB` is `C(6)` here vs `OPERTBL.PROCNB` `C(12)` — clients must implement one documented padding/trim rule before joins.
- **Header `0x30`:** validate parser behavior on production copies; synthetic fixtures mirror common FoxPro field types only.
