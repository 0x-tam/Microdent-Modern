# Phase 1b — Patient profile (UI)

## What was built

- **`PatientProfilePanel`** in `@microdent/app`: shown when the user selects **Patients** in the sidebar **or** lands there automatically after picking a search result.
- **Selection flow:** **`PatientSearchBar`** is controlled from **`AppShell`**: **`selectedPatientId`** lives in shell state only. Clicking a search row calls **`onPatientRecordSelect`**, which sets **`selectedPatientId`** and switches **`active`** to **`patients`**. Editing the search input clears the selection via **`onPatientSelectionClear`**.
- **Data:** **`createBridgeClient` → `getPatientProfile(patientId)`** → **`GET /v1/patients/:patientId/profile`** (see [phase-1b-patient-profile-backend.md](phase-1b-patient-profile-backend.md)). Fetches run only when **`patientId !== null`**, **`bridgePhase === "connected"`**, and **`bridgeBaseUrl`** is set — same gating idea as search and schedule.
- **Summary card:** large **`displayName`**, optional **`reverseName`** line, **Active / Inactive** badge when **`active`** is known, compact **`dl`** for chart number, record id, masked phone, provider id, entry date, last visit.
- **Read-only note:** visible line under the toolbar — *Read-only profile — safe summary from the bridge only.*
- **Future tabs:** **Appointments**, **Treatments**, **Payments**, **Medical**, **Chart** appear as **disabled** buttons with a **Soon** badge and tooltip — no routes called for those tabs in this pass.

## States

1. **No patient selected** — empty state with guidance to use top-bar search.
2. **Clinic service offline** — when **`patientId`** is set but the bridge is not **connected** (or URL missing); no profile `fetch`.
3. **Loading profile** — short status line while **`getPatientProfile`** is in flight.
4. **Profile loaded** — card + future tab strip.
5. **Patient not found** — HTTP **404** with **`PATIENT_NOT_FOUND`** → dedicated empty state (no raw API message).
6. **Failed to load** — generic copy + **Retry** (bumps an internal retry counter to re-run the effect).

## What remains intentionally blocked / out of scope

- **Editing** any patient field; **writes** to DBF or bridge mutation APIs.
- **Appointments, treatments, payments, medical, chart** content — tabs are placeholders only; **no** calls to schedule, ledger, or medical routes from this panel.
- **Full phone, address, email, employer, insurance, notes, memos, raw JSON** — not rendered; the UI only uses fields allowed by **`PatientProfileResponseSchema`**.
- **TanStack Query, React Router, date libs, charts, icon packs** — not added.

## Tests

- **`patient-profile-panel.test.tsx`** — no-selection and offline (no fetch), successful load (URL contains **`/v1/patients/42/profile`**), **404** not-found, **500** generic error, blocked field names absent from visible text, **`safePatientProfileError`** mapping.
- **`patient-search-bar.test.tsx`** — extended with **row click** → **`onPatientRecordSelect`** called with the hit payload.

## How to try it locally

1. Set **`DATA_ROOT`** on the bridge to your **read-only copy** (e.g. `Microdent-Legacy-Copy/DATA`).
2. Start the bridge and **`pnpm preview:web`**.
3. Wait for **Connected**, search (**≥ 2** characters), click a result — the app switches to **Patients** and loads the read-only profile.

## UX / semantics uncertainty

- **Provider id** is still an opaque numeric key (**`doctorId`**) until a doctors reference table is wired.
- **`active === null`** hides the status badge — meaning may vary by legacy data quality.
- **Monday-first** or locale preferences do not affect displayed **entry / last visit** strings (they are **`YYYY-MM-DD`** from the API as-is).

## Privacy

- No **`console.log`** of profile responses.
- Tests and this doc use **synthetic** ids and labels only.
