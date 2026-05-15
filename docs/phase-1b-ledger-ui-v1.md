# Phase 1b — Ledger preview (UI v1)

Read-only **Ledger preview** tab on the patient profile. Data comes from **`GET /v1/patients/:patientId/ledger`** via **`getPatientLedger`** — see [phase-1b-ledger-backend-v1.md](phase-1b-ledger-backend-v1.md).

## Where it lives

- **`PatientProfilePanel`** — **Ledger preview** tab (replaces the disabled **Payments** placeholder).
- **`patient-ledger-display.ts`** — sort order and opaque labels for type codes and card flag.
- **`read-only-ui-copy.ts`** — `PATIENT_TAB_LEDGER_LEDE` and shared offline/truncation copy.
- Styles: **`app-patient-profile__ledger*`** in `app-shell.css`.

## Fetch gating

Ledger lines load **only** when all are true:

- `patientId !== null`
- Profile **`state.phase === "loaded"`** (tab strip visible)
- **`activeTab === "ledger"`**
- **`bridgeBaseUrl`** trimmed non-empty
- **`bridgePhase === "connected"`**

No prefetch on profile load. No fetch when offline. No `localStorage` / `sessionStorage`. No `console.log` of responses.

## UI states

| State | When | What the user sees |
| --- | --- | --- |
| No patient | `patientId === null` | “No patient selected” — no Ledger tab |
| Bridge offline (panel) | Profile cannot load | “Clinic service offline” |
| Loading profile | Profile in flight | “Loading profile…” — no tabs yet |
| Bridge offline (tab) | On Ledger preview, bridge down | Offline empty state for the section |
| Loading ledger | Tab active, fetch in flight | “Loading ledger…” |
| No entries | Empty `entries` array | “No ledger entries found” |
| Loaded | One or more safe rows | Metadata list + privacy footnote |
| Truncated | `truncated === true` | Banner: capped list only (server cap) |
| Error | Network / HTTP / schema | Safe message + **Retry** |

Tab lede (always on Ledger panel):

> Ledger lines are read-only. Amounts, memo text, and insurance identifiers stay hidden.

Additional note (always visible on the tab):

> Payment amounts are intentionally hidden in this preview.

## Fields shown

| Field | Display |
| --- | --- |
| `date` | Formatted transaction date (or “—”) |
| `chargeTypeCode` | Opaque “Charge type {code}” |
| `adjustmentTypeCode` | Opaque “Adjustment type {code}” |
| `paymentTypeCode` | Opaque “Payment type {code}” |
| `isCardPayment` | “Card payment” / “Not card payment” |
| `hasDescription` | Badge: “Description hidden” (never memo text) |
| `privacyNote` | Verbatim footnote from API |
| `truncated` | Banner only — not row data |

`ledgerEntryId` is used only as a React list key — never rendered.

## Fields hidden

Never rendered, logged, or stored in fixtures:

- `AMOUNT`, `SAMOUNT`, balances, payment totals
- `DESCR` memo text
- Insurance / plan identifiers (`PLANNUM`, `INSPAYNO`, …)
- Raw `TRANS` rows or arbitrary DBF columns
- Blocked column names as UI copy (`AMOUNT`, `SAMOUNT`, `DESCR`, …)

## Parser / read-only limits

- UI consumes the strict Zod contract only — no passthrough of unknown JSON keys.
- `hasDescription` is a boolean flag; description bodies are never requested or shown.
- Server caps matching rows (100 per patient); UI shows a truncation banner when `truncated` is true.
- Read-only preview — no editing, writes, or legacy EXE launch.

## What remains blocked

- **Payments** posting UI (placeholder removed; no write path).
- Per-line amounts, memo bodies, insurance ids on the wire.
- TanStack Query, prefetch on profile load, local persistence of ledger rows.

## Tests

- `packages/app/src/patient-profile-panel.test.tsx` — tab activation, fetch gating, safe fields, empty/error, forbidden tokens, no Payments placeholder.
- `packages/app/src/patient-ledger-display.test.ts` — display helpers.
