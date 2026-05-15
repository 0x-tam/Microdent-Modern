# Phase 1b — Patients page search UX

## Goal

The **Patients** sidebar module should be the obvious place to **search and open** a patient record, not an empty canvas that only points at the top bar.

## Behavior

| State | UI |
| --- | --- |
| No patient selected | **Find a patient** block on the Patients page: lede explains there is no full directory; embedded `PatientSearchBar` (`instanceId="page"`) |
| Clinic service offline | Page search input disabled; same offline copy as top-bar search — **no** `GET /v1/patients/search` |
| Query &lt; 2 characters | Hint only — no network |
| Searching / results / no matches / error | Same safe states as top-bar search (debounced `GET /v1/patients/search?q=...`) |
| Result selected | Shell sets `selectedPatientId`; `PatientProfilePanel` loads profile and tabs; results list closes |
| Patient open | Profile + tabs unchanged; toolbar **Search another patient** toggles inline page search without clearing the current record until a new row is picked |

**Global top-bar search** remains unchanged and still navigates to Patients on select.

## Why there is no full patient directory

- The legacy copy can contain **~18k** patient rows; loading or paging them in the browser would be slow and risky.
- This read-only viewer only exposes **search hits** for a typed query (min 2 characters, capped list), using the existing safe search DTO.
- A paginated directory route is **out of scope** until mirror/import and privacy review are ready.

## Privacy limits (search hits)

Approved fields only:

- `displayName`
- `chartNumber`
- `patientId`
- `phoneMask` (only when returned by the bridge)

Never shown: raw DBF rows, notes, memos, full phone numbers, addresses, medical free text, payment amounts, or staff-only fields.

## Code

- `PatientSearchBar` — `instanceId: "topbar" | "page"` for unique ids; `clearSelectionOnQueryChange` for change-patient mode
- `PatientProfilePanel` — embedded search when `patientId === null`; change-patient search strip when open
- Copy: `read-only-ui-copy.ts` (`PATIENT_PAGE_SEARCH_*`, `PATIENT_CHANGE_PATIENT_LABEL`)

## Verification

```bash
pnpm test --workspace=@microdent/app
pnpm build:web
```

Manual: open **Patients** with bridge connected → search on the page → open a record → **Search another patient** → pick a different row.
