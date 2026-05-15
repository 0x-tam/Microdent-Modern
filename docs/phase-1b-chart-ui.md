# Phase 1b — Chart (UI)

Read-only **Chart** tab on the patient profile. Data comes from **`GET /v1/patients/:patientId/chart`** via **`getPatientChart`** — see [phase-1b-chart-backend-spike.md](phase-1b-chart-backend-spike.md) and [phase-1b-dental-chart-mapping.md](phase-1b-dental-chart-mapping.md).

## Where it lives

- **`PatientProfilePanel`** — tab strip after **Treatments**; **Payments** stays disabled (“Soon”).
- **`patient-chart-display.ts`** — sort order and safe row labels (tooth, type, treated).
- Styles: **`app-patient-profile__chart*`** in `app-shell.css`.

No visual odontogram in this pass — a simple list/table of safe fields only.

## Fetch gating

Chart data loads **only** when all are true:

- `patientId !== null`
- Profile **`state.phase === "loaded"`** (tab strip visible)
- **`activeTab === "chart"`**
- **`bridgeBaseUrl`** trimmed non-empty
- **`bridgePhase === "connected"`**

No prefetch on profile load. No fetch when offline. No `localStorage` / `sessionStorage`. No `console.log` of responses.

## UI states

| State | When | What the user sees |
| --- | --- | --- |
| No patient | `patientId === null` | “No patient selected” — no Chart tab |
| Bridge offline (panel) | Profile cannot load | “Clinic service offline” |
| Loading profile | Profile in flight | “Loading profile…” — no tabs yet |
| Bridge offline (tab) | On Chart, bridge down | “Clinic service offline” for chart |
| Loading chart | Tab active, fetch in flight | “Loading chart…” |
| No chart entries | Empty `entries` array | “No chart entries found” |
| Loaded | One or more safe rows | Entry list + privacy footnote |
| Truncated | `truncated === true` | Banner: capped chart rows (server cap) |
| Error | Network / HTTP / schema | Safe message + **Retry** |

Tab lede (always on Chart panel):

> Dental chart is read-only. Memos, layer legends, and clinical labels stay hidden.

## Fields shown

| Field | Display |
| --- | --- |
| `toothNumber` | “Tooth {n}” or “Tooth —” when null |
| `chartType` | Opaque “Type {code}” or “Type —” |
| `treated` | “Treated” / “Not treated” |
| `hasNote` | Badge: “Note hidden” (never memo text) |
| `privacyNote` | Verbatim footnote from API |
| `truncated` | Banner only — not row data |

## Fields hidden

Never rendered, logged, or stored in fixtures:

- `NOTE` memo text and any chart free text
- Layer code legends (`*_S`, `*_C`, decoded clinical labels)
- Raw `CHARTDBF` rows or arbitrary DBF columns
- Patient names from chart rows, treatment descriptions, payment data
- `chartEntryId` and per-row `patientId` (used only as React list keys internally)

## Parser / read-only limits

- UI consumes the strict Zod contract only — no passthrough of unknown JSON keys.
- `hasNote` is a boolean flag; note bodies are never requested or shown.
- Server caps matching rows (default 128); UI shows a truncation banner when `truncated` is true.
- Read-only preview — no editing, writes, or legacy EXE launch.

## What remains blocked

- **Payments** tab (placeholder).
- Visual odontogram / arch grid (design-system §12 work).
- Layer arrays, decoded glyphs, `PROCCHRT` overlays on teeth.

## Tests

- `packages/app/src/patient-profile-panel.test.tsx` — tab activation, fetch gating, offline, safe fields, empty/error, forbidden tokens, Payments still disabled.
- `packages/app/src/patient-chart-display.test.ts` — display helpers.
