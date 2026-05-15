# Phase 1b — Patient appointment history (UI)

Read-only **Appointments** tab inside **`PatientProfilePanel`** (`@microdent/app`). Loads history via **`GET /v1/patients/:patientId/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD`** through **`getPatientAppointments`**. No writes, no localStorage/sessionStorage, no legacy file changes.

## When it appears

- User selects a patient (search or Today dashboard) and the **Patients** module shows **`PatientProfilePanel`**.
- Profile summary loads with **`getPatientProfile`** (unchanged).
- **Appointments** is a clickable tab; **Treatments**, **Payments**, **Medical**, and **Chart** stay disabled with a **Soon** badge.

## Fetch rules

Appointments are requested **only when all** of the following hold:

1. Bridge phase is **connected** and **`bridgeBaseUrl`** is set.
2. A **`patientId`** is selected.
3. The user has activated the **Appointments** tab (tab is not open on first paint — avoids loading history until needed).

No fetch when offline, when no patient is selected, or when another tab would be active (only Appointments is enabled today).

## Date ranges

| Control | Range |
|--------|--------|
| **Default** (first open / patient change) | **90 days before today** through **90 days after today** (180 inclusive days) |
| **Past 90 days** | Today − 90 → today |
| **Upcoming 90 days** | Today → today + 90 |
| **This year** | Jan 1 – Dec 31 of the current calendar year, **capped** to ≤ 365 inclusive days if needed (leap years) |
| **Refresh** | Re-runs the current `from`/`to` without changing the preset |

All windows are validated client-side with the same rules as **`PatientAppointmentsQuerySchema`** (max **365** inclusive days). The UI does **not** offer an all-time or unbounded range.

## Fields shown (per appointment row)

- **date** (group heading)
- **time**
- **duration** (slots × period, default 30 min per slot)
- **room** (`Room {n}`)
- **status** (badge from status code)
- **doctor id** when `docId !== 0`
- **proc class** when `procClass !== 0`
- **Note hidden** badge when `hasComment` is true (no comment text)
- **Missed** badge when `missed` is true

Patient **display name** appears **only** in the profile header card, not repeated from appointment `patient` summaries.

## Fields hidden

Never rendered in this tab (even if present on the wire):

- `PAT_NAME` / schedule row names
- `TELEPHONE`
- `COMMENT` body (only **Note hidden**)
- Appointment `patient.displayName` / chart from schedule merge (profile header is the sole name source here)
- Phones, addresses, medical, payments, treatments, raw DBF rows, or memo text

## UI states

| State | Copy / behavior |
|--------|------------------|
| No patient | Existing empty state |
| Bridge offline (profile or appointments) | Clinic service offline |
| Loading appointments | “Loading appointments…” |
| No appointments in range | “No appointments found” |
| Load failed | Generic message + Retry (no server `message` leakage) |
| Loaded | Grouped list by date |

## Privacy / read-only limits

- Read-only: no create, edit, cancel, or delete.
- Tests and fixtures use **synthetic** ids and labels only.
- Appointment fetch URLs and rows are not logged in app code.

## Related docs

- Backend: `docs/phase-1b-patient-appointments-backend.md`
- Profile summary: `docs/phase-1b-patient-profile-ui.md`
- Schedule DTO: `docs/phase-1b-calendar-backend.md`
