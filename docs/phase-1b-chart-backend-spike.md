# Phase 1b — CHARTDBF chart backend spike

**Date:** 2026-05-15  
**Data source (read-only):** `/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA/CHARTDBF.DBF`  
**Parser:** [`dbffile`](https://www.npmjs.com/package/dbffile) v1.12.x (existing bridge dependency)

---

## 1. Parser investigation summary

| Mode | Open | Header metadata | Row iteration (1 row, not logged) |
|------|------|-----------------|-----------------------------------|
| Default / strict + `encoding: "win1252"` | **OK** | `recordCount` 868,465; `fieldCount` 67 | **OK** |
| `readMode: "loose"` + `encoding: "win1252"` | **OK** | Same | **OK** |

**Header checks (field names / types only):** `ID` `N` 10,0; `TOOTH_NB` `N` 2,0; `TYPE` `N` 1,0; `TREATED` `L` 1; `NOTE` `M` 10 (memo via `.FPT`); 67 fields total; header version `0xF5` on copy. Full mapping: `docs/phase-1b-dental-chart-mapping.md`.

**Unlike `OPERTBL`:** `CHARTDBF` does **not** require loose mode — no `_NullFlags` type `0` column in the header on this copy.

**Conclusion:** `dbffile` can safely open and iterate `CHARTDBF` in **strict** mode with `win1252`. Production reads are feasible with the same pattern as `PATIENT` / `SCHEDULE` readers.

**Operational note:** ~868k rows — each request performs a **full-table scan** filtered by `ID` until the per-patient cap. Acceptable for localhost Phase 1b; index or SQLite mirror recommended before multi-user production.

---

## 2. Route implemented

`GET /v1/patients/:patientId/chart`

- **Patient id:** same validation as profile (`PatientProfilePathParamsSchema`).
- **Scan:** sequential filter on `CHARTDBF.ID`; **cap 128** rows with `truncated: true` when more matches exist.
- **Sort:** `toothNumber`, then `chartType`, then `chartEntryId`.
- **Entry id:** opaque `{toothNumber}-{chartType}-{ordinal}` within the response (ordinal disambiguates duplicate tooth/type pairs).

### Returned fields

| Field | Source |
|-------|--------|
| `chartEntryId` | `{TOOTH_NB}-{TYPE}-{ordinal}` |
| `patientId` | path param |
| `toothNumber` | `TOOTH_NB` when non-zero |
| `chartType` | `TYPE` (opaque code) |
| `treated` | `TREATED` logical |
| `hasNote` | `NOTE` memo populated (boolean only) |
| `truncated` | cap indicator |
| `privacyNote` | fixed literal |

### Blocked (never serialized)

- `NOTE` memo text and all other memos
- All `*_S` / `*_C` layer codes (deferred until SME legend exists)
- `TOOTH_TYPE`, `USER_S`, `INIT`, spacing/bridge detail columns
- Raw rows, patient names, procedure labels, `CHARTTMP` staging rows

---

## 3. Risks and follow-ups

| Risk | Mitigation / next step |
|------|------------------------|
| **Full-table scan** per patient | Cap 128; add CDX seek or SQLite `chart_lines` import later. |
| **Opaque `TYPE` / `TOOTH_NB` semantics** | List UI first; no glyph decoding until SME legend doc. |
| **Memo read for `hasNote`** | Boolean only; memo body never returned or logged. |
| **Multiple rows per tooth** | `chartEntryId` ordinal; UI must not collapse blindly. |
| **Layer codes omitted in v1** | Add `ChartLayerCode[]` only after approved field→glyph mapping. |

**Not recommended without approval:** new npm parser dependency; returning `NOTE` or decoded clinical labels.

---

## 4. Tests and artifacts

- Synthetic `CHARTDBF` only (`services/bridge/src/patient-chart-routes.test.ts`).
- Contracts: `packages/contracts/src/patient-chart.ts`.
- Bridge reader: `services/bridge/src/dbf/patient-chart.ts`.
- Bridge client: `getPatientChart(patientId)`.

No real chart row values appear in this document or test fixtures beyond intentional synthetic tokens checked for absence in JSON.
