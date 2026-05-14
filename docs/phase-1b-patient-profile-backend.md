# Phase 1b — Patient profile (backend only)

Read-only **`GET /v1/patients/:patientId/profile`** loads **one** row from **`PATIENT.DBF`** under **`DATA_ROOT`**, keyed by the same **`patientId`** string returned from **`GET /v1/patients/search`** (internal `ID`, positive integer, no leading zeros). This band is **API + contracts + bridge client + tests only** — **no** profile UI, medical history, ledger, appointments-in-profile, or writes.

## Route

- **`GET /v1/patients/:patientId/profile`**
- **`503`** — `DATA_ROOT_NOT_CONFIGURED` when `DATA_ROOT` is unset (shared with other `/v1` routes).
- **`400`** — `INVALID_PATIENT_ID` when `patientId` is not a **positive integer without leading zeros** (matches client-side guard).
- **`404`** — `PATIENT_DBF_NOT_FOUND` if **`PATIENT.DBF`** is missing under `DATA_ROOT`.
- **`404`** — `PATIENT_NOT_FOUND` if the file exists but no **non-deleted** row matches `ID`.
- **`500`** — `PATIENT_PROFILE_ERROR` on open/scan/parser failures (generic message; **no** row payloads, no internal exception text).

## Fields returned (JSON)

Validated by **`PatientProfileResponseSchema`** (`strict` — unknown keys rejected). The profile **extends** the shared **`SafePatientSummarySchema`** (same four core fields as search hits).

| JSON field | Source (`PATIENT.DBF`) | Notes |
| --- | --- | --- |
| `patientId` | `ID` | Stringified; must match search `patientId`. |
| `chartNumber` | `CASENB` | `null` when blank. |
| `displayName` | `NAME`, else `FIRST_NAME` + `LAST_NAME`, else `REV_NAME`, else `Patient {id}` | Same derivation as search. |
| `phoneMask` | `HOME_PHONE`, else `MOBILE` | **Last four digits only** (`…1234`); never full number. |
| `reverseName` | `REV_NAME` | `null` when blank; optional “Last, First” style header data. |
| `active` | `ACTIVE` | FoxPro logical → boolean; `null` if unreadable. |
| `doctorId` | `DOCTOR_NB` | Stringified when non-zero; `null` when `0` or missing — opaque staff key (join to doctor table **later**). |
| `entryDate` | `ENTRY_DATE` | `YYYY-MM-DD` or `null` (date field only, not free text). |
| `lastVisit` | `LASTVISIT` | `YYYY-MM-DD` or `null` (last visit **date**; not notes). |

## Fields intentionally blocked

The bridge **does not** read memo columns for this route and **does not** return:

- Full phone, street, city, ZIP, `ADDRESS`, email, employer block
- `SS`, `INSID`, insurance / payment columns (`LAST_PAY`, `LAST_PDATE`, …)
- `QUICKNOTE`, `PAT_M_COMP`, or any memo / free-text clinical or financial fields
- `ANAME` / `AREV_NAME` / alternate-language name columns (not mapped — omit until locale rules exist)
- Appointments, treatments, ledger lines, medical history
- Raw DBF row objects or arbitrary column maps

## Privacy limits

- **No PHI in logs:** errors use fixed codes/messages; scanners do not log row contents.
- **No memo reads:** avoids pulling `QUICKNOTE` / `PAT_M_COMP` from `PATIENT.FPT` in this pass.
- **Phone:** only masked suffix, same policy as search (`docs/phase-1b-patient-search-backend.md`).
- **Name + chart:** still identifying in aggregate — treat API as **staff-only** behind localhost / future auth (per master build plan).

## Connection to search UI (later)

Search already returns **`patientId`**, **`chartNumber`**, **`displayName`**, **`phoneMask`**. A future profile shell can call **`getPatientProfile(patientId)`** after a row click to hydrate a **header strip** (name, chart, mask, active, dates, doctor id) without widening the search response or exposing blocked columns.

## Future profile tabs (out of scope here)

| Tab / domain | Likely sources (later) | Notes |
| --- | --- | --- |
| Phones / address | `PHONETAB`, `PHN_TEL`, address columns | Needs masking / consent model. |
| Medical history | `MEDICAL.DBF` | Not `PATIENT` memos alone. |
| Insurance | `PAT_INS`, etc. | High sensitivity — separate contracts. |
| Appointments | `SCHEDULE` | Already has a dedicated read API (`docs/phase-1b-calendar-backend.md`). |
| Ledger / treatments | `TRANS`, `OPERTBL`, … | Separate read routes with caps. |

## Contracts (`@microdent/contracts`)

- **`SafePatientSummarySchema`** — shared safe subset (`patientId`, `chartNumber`, `displayName`, `phoneMask`).
- **`PatientSearchResultItemSchema`** — alias of `SafePatientSummarySchema`.
- **`PatientProfilePathParamsSchema`** — validates `patientId` path segment.
- **`PatientProfileResponseSchema`** — strict profile body.

## Bridge client (`@microdent/bridge-client`)

- **`getPatientProfile(patientId)`** → `GET /v1/patients/{id}/profile` (rejects invalid id before `fetch`).

## Automated tests

- **`patient-profile-routes.test.ts`** — synthetic `PATIENT.DBF` with decoy `STREET` / `EMAIL` / full phone digit sequences; asserts success shape, **404** / **400** / **503** / missing file, and that response JSON **does not** contain those secrets.
- **`client.test.ts`** — URL construction and client-side id validation.

## Schema reference (inspected copy)

`PATIENT.DBF` includes **`ENTRY_DATE`**, **`LASTVISIT`**, **`ACTIVE`**, **`DOCTOR_NB`** alongside high-risk columns (`STREET`, `EMAIL`, `QUICKNOTE` memo, …). Only the returned fields above are mapped in this pass.

**Uncertainty:** `DOCTOR_NB` semantics (primary vs historical provider) are inferred from naming only; `ACTIVE` false vs null edge cases depend on legacy data entry.

## Local manual check (copy only)

```bash
export DATA_ROOT="/path/to/Microdent-Legacy-Copy/DATA"
# start bridge, then (use a real id only in a private environment):
curl -sS "http://127.0.0.1:17890/v1/patients/12345/profile" | jq .
```

Do **not** paste real profile JSON into public tickets.
