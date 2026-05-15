# Phase 1b — Medical summary (UI)

Read-only **Medical** tab on the patient profile. Data comes from **`GET /v1/patients/:patientId/medical-summary`** via **`getPatientMedicalSummary`** — see [phase-1b-medical-summary-backend.md](phase-1b-medical-summary-backend.md).

## Where it lives

- **`PatientProfilePanel`** — tab strip after **Appointments**; **Treatments**, **Payments**, and **Chart** stay disabled (“Soon”).
- **`patient-medical-summary-display.ts`** — generic screening labels and list builder (excludes `med1`, `med2`, `aids` from named lists).
- Styles: **`app-patient-profile__medical*`** in `app-shell.css`.

## Fetch gating

Medical summary loads **only** when all are true:

- `patientId !== null`
- Profile **`state.phase === "loaded"`** (tab strip visible)
- **`activeTab === "medical"`**
- **`bridgeBaseUrl`** trimmed non-empty
- **`bridgePhase === "connected"`**

No prefetch on profile load. No fetch when offline. No `localStorage` / `sessionStorage`. No `console.log` of responses.

## UI states

| State | When | What the user sees |
| --- | --- | --- |
| No patient | `patientId === null` | “No patient selected” — no Medical tab |
| Bridge offline (panel) | Profile cannot load | “Clinic service offline” |
| Loading profile | Profile in flight | “Loading profile…” — no tabs yet |
| Bridge offline (tab) | On Medical, bridge down | “Clinic service offline” for medical |
| Loading medical | Tab active, fetch in flight | “Loading medical summary…” |
| No record | `hasMedicalRecord === false` | “No medical record found for this patient.” |
| Record + sensitive | `hasSensitiveMedicalDetails` | Banner + dates + count only; no per-flag list |
| Record + flags | Record, not sensitive | Dates, count, generic labels for `true` flags |
| Error | Network / HTTP / schema | Safe message + **Retry** |

Tab lede (always on Medical panel):

> Medical summary is read-only. Detailed notes and allergy text are hidden in this preview.

Sensitive banner:

> This patient has medical details recorded in the legacy system. Details are hidden in this read-only preview.

## Fields shown

| Field | Display |
| --- | --- |
| `hasMedicalRecord` | Layout only (empty vs summary) |
| `hasSensitiveMedicalDetails` | Aggregate-only layout when true |
| `lastUpdated` | “Questionnaire date” |
| `lastDentalVisit` | “Last dental visit (questionnaire)” |
| `flaggedConditionCount` | “Flagged screening items” |
| `conditions` | Named list only when not sensitive; `true` keys with generic labels |
| `privacyNote` | Verbatim footnote from API |

## Fields hidden

Never rendered, logged, or stored in fixtures:

- `PROBLEM`, `ALLERGY_TO`, `NOTES`
- Any free-text medical content
- Raw DBF row / arbitrary columns
- CamelCase API keys as visible labels (`heartTrouble`, `med1`, …)
- Blocked column names as UI copy

**Named list omissions (count still from API):** `med1`, `med2`, `aids`.

## Privacy / read-only limits

- Read-only preview only — no editing or writes.
- Sensitive records hide per-flag bullets even when booleans exist in the payload.
- `allergic` is a screening flag label only — never allergy substance text.
- Staff should use legacy tools for full charts until a later mapping review.

## What remains blocked

- **Treatments**, **Payments**, **Chart** tabs (placeholders).
- Problem descriptions, allergy free text, medical memos.
- TanStack Query, new routes, prefetch on profile load.
- Legacy **`Microdent-Legacy`** folder (untouched); UI uses bridge + read-only copy via **`DATA_ROOT`**.

## Tests

- **`patient-profile-panel.test.tsx`** — tab activation, fetch gating, offline, no record, flags, sensitive layout, forbidden tokens, errors, **`safePatientMedicalSummaryError`**.
- **`patient-medical-summary-display.test.ts`** — label map omissions.

Synthetic fixtures only — no real medical strings in the repo.

## Local check

```bash
export DATA_ROOT="/path/to/Microdent-Legacy-Copy/DATA"
# start bridge, then pnpm preview:web
# Connect → search → select patient → Medical tab
```

Do not paste real medical JSON into tickets or docs.
