# Phase 1b — Patient search (UI)

## What was built

- **Top bar patient search** in `@microdent/app` (`PatientSearchBar`): wired to **`createBridgeClient` → `searchPatients(query)`**, which calls **`GET /v1/patients/search?q=...`** (see [phase-1b-patient-search-backend.md](phase-1b-patient-search-backend.md)).
- **Gating:** search runs only when the shell reports **`bridgePhase === "connected"`** (after a successful **`GET /health`**). The field stays disabled while **offline** or **checking**.
- **Query rules:** **`searchPatients`** already rejects queries under 2 characters; the UI also guides staff with **“Enter at least 2 letters or numbers.”** before a request is useful.
- **Debounce:** **300 ms** after typing stops, without new npm dependencies. **Search** button and **Enter** skip the wait and run immediately (clears the pending timer first).
- **Results:** up to **20** rows from the API; a short note appears when the list is capped at 20.
- **Displayed fields only:** **`displayName`**, **`chartNumber`** (as “Chart …” when present), **`phoneMask`** when present, and **`patientId`** only as **`Record {id}`** when there is **no** chart number (helps tell similar names apart without extra columns).
- **Selection:** clicking a row highlights it (via shell **`selectedPatientId`**) and opens the **Patients** module, which loads **`getPatientProfile(patientId)`** — see [phase-1b-patient-profile-ui.md](phase-1b-patient-profile-ui.md). Typing in the search field clears the selection.
- **States:** clinic-oriented copy for **service offline / waiting**, **type at least 2 characters**, **searching**, **no matches**, **search failed**, plus the **hint** under the field.
- **Layout:** results open in a **dropdown** under the top search so the **Today** dashboard stays unchanged.
- **Types:** **`BridgeHealthPhase`** (`"checking" | "connected" | "offline"`) now lives in **`bridge-health.ts`** and is re-exported from **`AppShell`** / package **`index`** for hosts.

## Tests

- **`packages/app/src/patient-search-bar.test.tsx`** (jsdom + fake timers): offline and **checking** disabled states, **under-2-character** guard (no `fetch`), **happy path**, **row click** invokes **`onPatientRecordSelect`**, **empty results**, **HTTP error** without echoing raw server messages.
- **`safePatientSearchError`** unit coverage for **network** and unknown errors (no PHI, no stack text in UI).

## What remains intentionally blocked / out of scope

- **Patient editing**, **writes**, **localStorage / sessionStorage** for results — not implemented; search hits stay in component state until the shell stores **`patientId`** for the profile.
- **Schedule** routes and **DBF** access from the browser — unchanged outside the schedule module; search/profile use **typed bridge HTTP** only.
- **TanStack Query / React Router** — not added; local state + `BridgeClient` only.
- **Logging patient search results** — no `console.log` of hits; dev diagnostics remain limited to existing shell bridge health behavior.

## How to try it locally

1. Point the bridge at a **copy** of legacy data, e.g. **`DATA_ROOT=/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA`** (never the locked legacy tree).
2. Start the bridge and **`pnpm preview:web`** (or your usual web preview).
3. Wait until the top bar shows **Connected**, type **at least 2 characters**, pause briefly or press **Search** / **Enter**.

## Privacy / safety notes

- The UI renders **only** the DTO fields validated by **`PatientSearchResponseSchema`**; it does not render raw rows or unknown JSON keys.
- Error strings are **generic**; they do not print API stack traces or arbitrary server text in the patient search area.
- Tests and this doc use **synthetic** names and ids only — **no real patient rows** in fixtures or examples.
