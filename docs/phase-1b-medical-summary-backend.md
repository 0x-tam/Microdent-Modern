# Phase 1b — Patient medical summary (backend only)

Read-only **`GET /v1/patients/:patientId/medical-summary`** loads screening data from **`MEDICAL.DBF`** under **`DATA_ROOT`**, keyed by **`PATIENT_ID`** (numeric match to profile/search **`patientId`**). **API + contracts + bridge client + tests only** — no medical UI, no writes, no memo text in responses.

## Route

- **`GET /v1/patients/:patientId/medical-summary`**
- **`503`** — `DATA_ROOT_NOT_CONFIGURED` when `DATA_ROOT` is unset.
- **`400`** — `INVALID_PATIENT_ID` when `patientId` is not a positive integer without leading zeros.
- **`404`** — `MEDICAL_DBF_NOT_FOUND` if **`MEDICAL.DBF`** is missing under `DATA_ROOT`.
- **`500`** — `MEDICAL_SUMMARY_ERROR` on open/scan/parser failures (generic message; no row payloads).
- **`200`** — when the file exists but no row matches: `hasMedicalRecord: false` (not **404**).

When multiple non-deleted rows share the same **`PATIENT_ID`**, the bridge keeps the row with the latest readable questionnaire **`DATE`** (ties: last row seen while scanning).

## Fields returned (JSON)

Validated by **`PatientMedicalSummaryResponseSchema`** (`strict`).

| JSON field | Source | Notes |
| --- | --- | --- |
| `patientId` | path | Echo of requested id. |
| `hasMedicalRecord` | derived | `true` when a matching non-deleted row exists. |
| `hasSensitiveMedicalDetails` | derived | `true` when `PROBLEM`, `ALLERGY_TO`, or `NOTES` appear populated; **values never returned**. |
| `lastUpdated` | `DATE` | `YYYY-MM-DD` or `null`. |
| `lastDentalVisit` | `LAST_DENTA` | `YYYY-MM-DD` or `null`. |
| `flaggedConditionCount` | derived | Count of `conditions.*` that are `true`. |
| `conditions` | `L` columns | Object of booleans / `null` per flag; `null` entire object when no record. |
| `privacyNote` | constant | Documents that free-text fields stay hidden. |

### `conditions` keys (FoxPro `L` only)

`hospital`, `physician`, `medicine`, `ill`, `reaction`, `bleeding`, `allergic`, `heartTrouble`, `congenitalHeart`, `heartMurmur`, `highBloodPressure`, `lowBloodPressure`, `anemia`, `rheumaticFever`, `jaundice`, `asthma`, `cough`, `kidneyTrouble`, `med1`, `diabetes`, `tuberculosis`, `hepatitis`, `arthritis`, `stroke`, `epilepsy`, `psychiatric`, `sinusTrouble`, `pregnant`, `ulcers`, `aids`, `med2`.

## Fields intentionally blocked

Never read into the API response (presence may only affect `hasSensitiveMedicalDetails`):

| Column | Type | Reason |
| --- | --- | --- |
| `PROBLEM` | `C` 40 | Free-text clinical wording |
| `ALLERGY_TO` | `C` 15 | Drug/allergy free text |
| `NOTES` | `M` 10 | Memo narrative |
| Raw DBF row | — | No arbitrary column maps |
| All other non-`L` columns | — | Not mapped in this pass |

## Privacy limits

- **No PHI in logs:** errors use fixed codes; scanners do not log row contents.
- **No allergy or problem strings** in JSON, tests committed to the repo, or docs.
- **Staff-only:** treat like other `/v1` patient routes (localhost / future auth).
- **`MED1` / `MED2`:** legacy names only; clinical meaning not confirmed — exposed as opaque flags until SME review.

## Contracts (`@microdent/contracts`)

- **`PatientMedicalSummaryPathParamsSchema`** — same id rules as profile.
- **`MedicalConditionFlagsSchema`** — screening flags object.
- **`PatientMedicalSummaryResponseSchema`** — strict response body.

## Bridge client (`@microdent/bridge-client`)

- **`getPatientMedicalSummary(patientId)`** → `GET /v1/patients/{id}/medical-summary`.

## Automated tests

- **`patient-medical-summary-routes.test.ts`** — synthetic **`MEDICAL.DBF`** with decoy `PROBLEM` / `ALLERGY_TO` tokens; asserts flag mapping, sensitive detection, and absence of blocked strings in JSON.
- **`client.test.ts`** — URL construction and client-side id validation.

## Uncertainty (MEDICAL.DBF semantics)

- **`PATIENT_ID`** is `N` 6 vs **`PATIENT.ID`** `N` 10 — matching uses stringified integers (same approach as ledger mapping notes).
- **`MED1` / `MED2`** purpose unknown; returned as booleans only.
- Multiple rows per patient: latest **`DATE`** heuristic may not match legacy UI if it uses another rule.
- FoxPro **`L`** false vs unset: reader maps unreadable to `null`, not `false`.
- Header **`0xF5`**: reader uses `readMode: "loose"` like other VFP tables; production parser drift not fully characterized here.

## Local manual check (copy only)

```bash
export DATA_ROOT="/path/to/Microdent-Legacy-Copy/DATA"
# start bridge, then (use a real id only in a private environment):
curl -sS "http://127.0.0.1:17890/v1/patients/12345/medical-summary" | jq .
```

Do **not** paste real medical JSON into public tickets.
