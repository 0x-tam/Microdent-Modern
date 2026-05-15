# Phase 1b — Doctors reference API

**Route:** `GET /v1/reference/doctors`  
**Table:** `DOCTORS.DBF` only (read-only, localhost bridge).  
**Purpose:** Resolve opaque doctor/provider ids (`DOC_ID`, `DOCTOR_NB`, `DOCT`, etc.) to safe display labels in schedule, patient profile, and future clinical views — without exposing staff directory PII.

---

## Response shape

```json
{
  "doctors": [
    {
      "doctorId": "3",
      "displayName": "Synthetic Provider Alpha",
      "active": true
    }
  ]
}
```

| Field | Source (DBF) | Notes |
|-------|----------------|-------|
| `doctorId` | `DOCTOR_NB` | Positive integer string; primary join key. Zero/blank rows are skipped. |
| `displayName` | `NAME` | Trimmed; if empty, `Doctor {doctorId}`. |
| `active` | `SCHEDULE` (`N` 1,0) | `true`/`false` when value is exactly 0 or 1; otherwise `null`. **Semantics uncertain** — treat as scheduling-enabled hint, not HR “employed” status. |

Rows with FoxPro soft-delete markers are **omitted** (same pattern as patient search and schedule readers).

---

## Blocked fields (never returned)

Staff / operational / financial columns on `DOCTORS.DBF` remain server-side only, including:

- **Contact / location:** `ADDRESS`, `CITY`, `STATE`, `ZIP`, `PHONE`, `FAX`, `CONTACT`
- **Credentials / tax:** `LICNO`, `GROUP_NO`, `FED_TAXID`, `TAXID_TYPE`, `CREDENTIAL`, `PRINT_INFO`
- **Notes:** `NOTES` (memo)
- **Schedule grid:** `SUNFROM1` … `SATTO3` (weekly hour matrix)
- **Other config:** `DAY_TIME`, `TIME_INC`, `DAY_B_H`, `DAY_B_M`, `START_DAY`, `TAX`, `PROF_PER`, `PROF_N`, `PROF_WAIT`, and all other header columns

The API does **not** return raw DBF rows, arbitrary field maps, or memo contents.

---

## Errors

| HTTP | Code | When |
|------|------|------|
| 503 | `DATA_ROOT_NOT_CONFIGURED` | `DATA_ROOT` unset |
| 404 | `DOCTORS_DBF_NOT_FOUND` | `DOCTORS.DBF` missing under `DATA_ROOT` |
| 500 | `REFERENCE_DOCTORS_ERROR` | Open/read failure |

---

## Client

`BridgeClient.getReferenceDoctors()` → `ReferenceDoctorsResponse` (Zod-validated).

---

## Intended UI usage

1. On app load (or when entering schedule / profile modules), fetch the reference list once and cache in memory or TanStack Query.
2. Build a `Map<doctorId, displayName>` for labels on appointment cards, room headers (`doctorId` on `SC_ROOM`), and patient `doctorId`.
3. Use `active === false` only as a weak visual hint (e.g. muted label); do not hide historical rows that still reference inactive ids.
4. **Do not** show this list in patient-facing or export contexts without policy review — `displayName` is still staff personal data.
5. When lookup fails (unknown id), keep showing a neutral fallback (`Doctor {id}`) rather than leaking other tables.

---

## Testing

Bridge tests use **synthetic** `DOCTORS.DBF` fixtures only (no real staff names). Cases cover: happy path, soft-deleted rows, blocked fields absent from JSON, `DATA_ROOT` unset, missing file.

---

## Uncertainty

- **`SCHEDULE` (`N` 1,0):** Likely “appears on scheduler” or similar; not confirmed against FoxPro UI. Exposed only as nullable `active` when 0/1.
- **Join key widths:** `DOCTOR_NB` is `N` 10; schedule `DOC_ID` and `OPERTBL.DOCT` use smaller widths — normalize by stringifying integers after read.
- **No dedicated `ACTIVE` logical** on this table in the inspected copy; do not infer employment status from delete flags alone.
