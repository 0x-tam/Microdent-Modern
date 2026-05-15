# Phase 1b — Treatments (UI)

Read-only **Treatments** tab on the patient profile. Data comes from **`GET /v1/patients/:patientId/treatments`** via **`getPatientTreatments`** — see [phase-1b-treatments-backend-spike.md](phase-1b-treatments-backend-spike.md).

## Where it lives

- **`PatientProfilePanel`** — tab strip after **Medical**; **Payments** and **Chart** stay disabled (“Soon”).
- **`patient-treatments-display.ts`** — sort order, procedure line, provider label, tooth/status copy.
- Styles: **`app-patient-profile__treatments*`** in `app-shell.css`.

## Fetch gating

Treatment history loads **only** when all are true:

- `patientId !== null`
- Profile **`state.phase === "loaded"`** (tab strip visible)
- **`activeTab === "treatments"`**
- **`bridgeBaseUrl`** trimmed non-empty
- **`bridgePhase === "connected"`**

No prefetch on profile load. No fetch when offline. No `localStorage` / `sessionStorage`. No `console.log` of responses.

## UI states

| State | When | What the user sees |
| --- | --- | --- |
| No patient | `patientId === null` | “No patient selected” — no Treatments tab |
| Bridge offline (panel) | Profile cannot load | “Clinic service offline” |
| Loading profile | Profile in flight | “Loading profile…” — no tabs yet |
| Bridge offline (tab) | On Treatments, bridge down | “Clinic service offline” for treatments |
| Loading treatments | Tab active, fetch in flight | “Loading treatments…” |
| No treatments | Empty `treatments` array | “No treatments found” |
| Loaded | One or more safe rows | Procedure list + privacy footnote |
| Truncated | `truncated === true` | Banner: recent procedures only (server cap) |
| Error | Network / HTTP / schema | Safe message + **Retry** |

Tab lede (always on Treatments panel):

> Procedure history is read-only. Memos, per-line descriptions, and fees stay hidden.

## Fields shown

| Field | Display |
| --- | --- |
| `date` | Formatted procedure date (or “—”) |
| `tooth` | “Tooth {n}” when non-null |
| `procedureCode` | Code in procedure line |
| `procedureLabel` | Chart/dictionary label in procedure line |
| `doctorLabel` / `doctorId` | Provider name (API label, reference map, or `Doctor {id}`) |
| `status` | Opaque “Status {code}” |
| `hasDescription` | Badge: “Description hidden” (never memo text) |
| `privacyNote` | Verbatim footnote from API |
| `truncated` | Banner only — not row data |

## Fields hidden

Never rendered, logged, or stored in fixtures:

- `DESCRIPT`, `DESC`, treatment notes, memos, free text
- `FEE`, charges, payments, insurance columns
- Raw `OPERTBL` rows or arbitrary DBF columns
- `OPERTBL.PROCEDURE` per-patient text (only `PROCCHRT` labels via `procedureLabel`)
- Blocked column names as UI copy (`DESCRIPT`, `DESC`, `NOTE`, `FEE`, `CHARGE`, …)

## Parser / read-only limits

- UI consumes the strict Zod contract only — no passthrough of unknown JSON keys.
- `hasDescription` is a boolean flag; description bodies are never requested or shown.
- Procedure display uses `procedureCode` + `procedureLabel` only.
- Server caps matching rows (default 200); UI shows a truncation banner when `truncated` is true.
- Read-only preview — no editing, writes, or legacy EXE launch.

## What remains blocked

- **Payments** and **Chart** tabs (placeholders).
- Per-line description text, procedure memos, fee columns.
- TanStack Query, prefetch on profile load, local persistence of treatment rows.

## Tests

- `packages/app/src/patient-profile-panel.test.tsx` — tab activation, fetch gating, offline, safe fields, empty/error, forbidden tokens, Payments/Chart still disabled.
- `packages/app/src/patient-treatments-display.test.ts` — display helpers.
