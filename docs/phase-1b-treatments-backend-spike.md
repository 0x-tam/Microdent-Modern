# Phase 1b — OPERTBL treatments backend spike

**Date:** 2026-05-15  
**Data source (read-only):** `/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA/OPERTBL.DBF`  
**Parser:** [`dbffile`](https://www.npmjs.com/package/dbffile) v1.12.x (existing bridge dependency)

---

## 1. Parser investigation summary

| Mode | Open | Header metadata | Row iteration |
|------|------|-----------------|---------------|
| Default / `readMode: "strict"` | **Fails** | — | — |
| `readMode: "loose"` + `encoding: "win1252"` | **OK** | `recordCount` 420,910; `fieldCount` 32 | Sample iteration OK (no row values logged) |

**Strict-mode failure:** `Type '0' is not supported` — caused by the trailing Visual FoxPro **`_NullFlags`** column (reported as type `0`, length 4). This matches why `GET /v1/legacy/catalog` listed `OPERTBL` as `present: true` with `recordCount` / `fieldCount: null` (catalog opens without loose mode).

**Loose-mode header (field names / types / lengths only):** 32 columns including `ID`, `OPNUM`, `TOOTHNB`, `DATE`, `PROCNB`, `STATUS`, `DOCT`, `DESCRIPT` (`M` 4), `DESC` (`C` 30), currency `Y` fields `PROFIT` / `COST`, fee `N` columns, and `_NullFlags`. Full mapping: `docs/phase-1b-next-modules-mapping.md` §1.

**Conclusion:** `dbffile` can read **headers and records** for production `OPERTBL` only in **loose** mode. The bridge treatments route uses the same pattern as `MEDICAL`, `PROCCHRT`, and `DOCTORS` readers.

---

## 2. Route implemented

`GET /v1/patients/:patientId/treatments`

- **Patient id:** same validation as profile (`PatientProfilePathParamsSchema`).
- **Scan:** full-table sequential filter on `ID` (legacy has no index hook in bridge yet); **cap 200** rows per patient with `truncated: true` when more matches exist.
- **Sort:** `date` descending, then `treatmentId` (`OPNUM`) descending.
- **Reference joins (in-memory):** `PROCCHRT` → `procedureLabel`; `DOCTORS` → `doctorLabel`. Missing reference files degrade gracefully (labels `null`).

### Returned fields

| Field | Source |
|-------|--------|
| `treatmentId` | `OPNUM` |
| `patientId` | path param |
| `date` | `DATE` → ISO date |
| `tooth` | `TOOTHNB` when non-zero |
| `procedureCode` | trimmed `PROCNB` |
| `procedureLabel` | `PROCCHRT.PROCEDURE` via normalized code lookup |
| `doctorId` | `DOCT` when non-zero |
| `doctorLabel` | `DOCTORS.NAME` |
| `status` | `STATUS` |
| `hasDescription` | `DESCRIPT` memo or `DESC` populated (boolean only) |
| `truncated` | cap indicator |
| `privacyNote` | fixed literal |

### Blocked (never serialized)

- `DESCRIPT` memo text, `DESC`, `PROCEDURE`, `CLASSIF`, `SUBPROC`, `SURFACE`, `QUANTITY`, plan/ledger ids (`PLANNUM`, `TRANSNUM`), all fee/currency columns (`FEE_*`, `CHARGE`, `PROFIT`, `COST`, `PROC_DISC`, …), raw rows, insurance-adjacent fields.

---

## 3. Risks and follow-ups

| Risk | Mitigation / next step |
|------|------------------------|
| **Full-table scan** (~420k rows) per request | Acceptable for localhost Phase 1b; add **CDX-backed seek** or SQLite import before multi-user production. |
| **Loose mode** skips unsupported column types | Monitor `dbffile` releases; if row drift appears, spike **custom header reader** or alternate parser. |
| **`PROCNB` width** `C(12)` vs `PROCCHRT` `C(6)` | Lookup tries trim, left-6, and pad-to-12; document one canonical rule in client. |
| **`DOCT` `N` 2** vs `DOCTOR_NB` `N` 10 | Route stringifies `DOCT` and joins reference by `doctorId`; validate on copy with orphan counts (no row logging). |
| **Memo read side effects** | `hasDescription` may touch memo machinery; values are never returned or logged. |

**Not recommended without approval:** new npm parser dependency; strict-mode-only path on current `dbffile`.

**Future options if loose mode regresses:** alternate DBF library spike, stdlib header + selective field decoder, one-time SQLite import job, or FoxPro export pipeline.

---

## 4. Tests and artifacts

- Synthetic `OPERTBL` / `PROCCHRT` / `DOCTORS` fixtures only (`services/bridge/src/patient-treatments-routes.test.ts`).
- Contracts: `packages/contracts/src/patient-treatments.ts`.
- Bridge client: `getPatientTreatments(patientId)`.

No real treatment row values appear in this document or test fixtures beyond intentional synthetic tokens checked for absence in JSON.
