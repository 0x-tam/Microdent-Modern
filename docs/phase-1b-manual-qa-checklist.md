# Phase 1b — Manual QA checklist (read-only app)

Use this checklist to smoke-test the **Microdent-Modern** web preview and local bridge without guessing navigation. All steps assume **localhost only**, a **copied** legacy `DATA` tree (never `Microdent-Legacy`), and **no PHI** in notes, screenshots, or tickets.

**Related:** [phase-1b-route-inventory.md](./phase-1b-route-inventory.md) (API routes, DBF sources, blocked fields).

---

## Before you start

| Item | Requirement |
| --- | --- |
| Repo | `/Users/Tamam/Desktop/Microdent/Microdent-Modern` |
| Legacy data | Read-only copy only, e.g. `Microdent-Legacy-Copy/DATA` — **do not** open or modify `Microdent-Legacy` |
| Node / pnpm | **Node 18+** for bridge and web; **Node 22.5+** required only for SQLite mirror checks (§15) |
| `DATA_ROOT` | **Absolute** path to either the legacy copy `DATA` folder **or** `services/bridge/fixtures/sandbox` (fixture-only, no real patients) |
| Web env | `apps/web/.env.local` with `VITE_BRIDGE_BASE_URL=http://127.0.0.1:17890` (created from `.env.local.example` by `pnpm dev:web` if missing) |

**Privacy rule for QA:** Do not paste patient names, chart numbers, phone digits, appointment comment text, treatment memos, medical notes, ledger amounts, or raw JSON from clinic data into chat, email, or issue trackers. Use pass/fail and generic descriptions only.

---

## 1. Clean startup (three terminals)

Run from the **repo root** in order.

### 1.1 Free dev ports

```bash
pnpm dev:kill-ports
pnpm dev:ports
```

**Pass:** Ports **17890**, **5173**, and **4173** show nothing listening (or only processes you intend to replace).

### 1.2 Bridge (terminal A)

```bash
export DATA_ROOT="/absolute/path/to/your/DATA-copy-or-fixtures/sandbox"
pnpm dev:bridge
```

**Pass:**

- Process stays running; no `DATA_ROOT` error at startup.
- `curl -sS http://127.0.0.1:17890/health` returns JSON with `"ok": true` and a `version` string.

**Fail clues:** Relative `DATA_ROOT`, missing directory, or port already in use — re-run `pnpm dev:kill-ports`.

### 1.3 Web preview (terminal B)

```bash
pnpm dev:web
```

**Pass:** Vite serves **http://127.0.0.1:5173** (loopback only).

Open that URL in a browser on the same machine.

---

## 2. Health check

| Step | Action | Pass |
| --- | --- | --- |
| 2.1 | Observe top bar after load | Status moves **Checking…** → **Connected** when bridge is up |
| 2.2 | Click **Refresh** next to status | Status re-checks without page reload errors |
| 2.3 | Stop bridge; click **Refresh** | Status shows **Offline**; copy stays clinic-neutral (no stack traces in UI) |
| 2.4 | (Optional) Dev diagnostics | In dev build, lines under status show app origin, bridge URL, last check — no patient data |
| 2.5 | Direct HTTP | `GET http://127.0.0.1:17890/health` matches connected state |

Restart bridge and confirm **Connected** returns.

---

## 3. Legacy catalog check (Today)

**Navigate:** Sidebar → **Today** → scroll to **Legacy data catalog** card.

| Step | Action | Pass |
| --- | --- | --- |
| 3.1 | Bridge connected | Table list loads (or clear error if `DATA_ROOT` wrong) |
| 3.2 | Row content | Each row shows logical name, basename, **present** yes/no, optional record/field counts — **no row payloads** |
| 3.3 | Expected tables | Entries align with catalog registry (`patient`, `schedule`, `medical`, `opertbl`, `trans`, `chartdbf`, `doctors`, `procchrt`, …) — presence depends on your copy |
| 3.4 | Refresh | Panel can reload without crashing |

### 3.5 OPERTBL loose header check (catalog only)

When **`OPERTBL.DBF`** is **present** on your copy:

| Step | Action | Pass |
| --- | --- | --- |
| 3.5.1 | `opertbl` row | **Present** = yes |
| 3.5.2 | Counts | `recordCount` and `fieldCount` are **numbers** (not both null) — bridge may use strict open first, then **`readMode: "loose"`** for VFP header metadata only |
| 3.5.3 | No row read | Catalog never shows procedure text, fees, or arbitrary columns — header metadata only |

**Fail clues:** `opertbl` present but both counts null → loose header read failed; treatments route may also fail on the same file. Re-check copy integrity (DBF + CDX/FPT sidecars if applicable).

**Note:** `trans` (ledger) and `chartdbf` (odontogram) may appear in the catalog with counts; there are **no** `GET /v1/*` ledger or chart routes yet — mapping docs only (see §12).

---

## 4. Today dashboard check

**Navigate:** **Today** (default module).

| Step | Action | Pass |
| --- | --- | --- |
| 4.1 | Date line | Shows today’s weekday/date (locale-formatted) |
| 4.2 | Today’s appointments | Card loads when `SCHEDULE.DBF` exists; list or empty state — not stuck loading |
| 4.3 | Patient headlines | Names come from safe patient summary or neutral fallback (`Patient ID …`) — **not** schedule `PAT_NAME` column labels in UI |
| 4.4 | Next up | Highlights next appointment by local time when data exists |
| 4.5 | Provider / procedure hints | Doctor and procedure class labels resolve when reference routes work (opaque ids mapped to labels) |
| 4.6 | Comment indicator | If UI shows “has note” style flag, **no comment body text** appears |
| 4.7 | Module shortcuts | Buttons navigate to **Schedule** / **Patients** as designed |

---

## 5. Synthetic fixture check (Today)

**Navigate:** **Today** → **Data connection test** card.

| Step | Action | Pass |
| --- | --- | --- |
| 5.1 | With `DATA_ROOT` = fixtures sandbox | **Available**, field count, row counts shown |
| 5.2 | Preview table | Only **synthetic** `fixture_tiny` cells — labeled as developer-only, not clinic data |
| 5.3 | With legacy `DATA` copy | Fixture may be **Unavailable** if `FAKE_TINY.dbf` is not in that tree — expected |

**Note:** This is the **only** UI surface that intentionally shows raw table rows, and only for the synthetic fixture.

---

## 6. Patient search check

**Navigate:** Top bar search (any module).

| Step | Action | Pass |
| --- | --- | --- |
| 6.1 | Query &lt; 2 characters | No search fired (or inline hint); no network spam |
| 6.2 | Valid query (≥ 2 chars) | Dropdown/results appear when `PATIENT.DBF` present |
| 6.3 | Result shape | Each hit: display name, chart if any, **masked phone** (`…` + 4 digits) or no phone — **never** full number |
| 6.4 | Select result | Navigates to **Patients** module; profile area targets that patient |
| 6.5 | Clear selection | Clears selected patient without error |
| 6.6 | Offline bridge | Search disabled or safe message — no partial PHI from cache |

**Privacy spot-check:** Search a patient you know has a phone on file; confirm UI shows mask only.

---

## 7. Patient profile check

**Navigate:** **Patients** after selecting a search hit.

| Step | Action | Pass |
| --- | --- | --- |
| 7.1 | No selection | Empty state (“No patient selected” or equivalent) |
| 7.2 | Profile card | `displayName`, chart, masked phone, active flag, entry date, last visit, provider label |
| 7.3 | Provider label | **Provider** row shows doctor display name from `GET /v1/reference/doctors` when `doctorId` maps — or neutral fallback, not raw id alone when reference loaded |
| 7.4 | Blocked columns | Page text does **not** include `HOME_PHONE`, `STREET`, `EMAIL`, `QUICKNOTE`, `INSURANCE`, raw JSON |
| 7.5 | Read-only banner | Still visible at top of shell |
| 7.6 | Tabs | **Appointments**, **Medical**, and **Treatments** enabled; **Payments** and **Chart** show “Soon” |

---

## 8. Appointments tab check

**Navigate:** **Patients** → **Appointments** tab.

| Step | Action | Pass |
| --- | --- | --- |
| 8.1 | Lazy load | Tab activates fetch; loading then list or empty |
| 8.2 | Date presets | Past 90 days / past year (or offered presets) change range without error |
| 8.3 | Row content | Date, time, room, status, duration — safe patient name from profile derivation |
| 8.4 | Privacy | No `COMMENT` text; no `TELEPHONE`; no `PAT_NAME` as field label in UI |
| 8.5 | Offline | Tab shows offline/empty handling, not stale clinic text |

---

## 9. Medical tab check

**Navigate:** **Patients** → **Medical** tab.

| Step | Action | Pass |
| --- | --- | --- |
| 9.1 | Lazy load | Fetch runs only when tab selected and bridge connected — not on profile load alone |
| 9.2 | Load | Screening summary or “no medical record” — not infinite spinner |
| 9.3 | Flags | Boolean-style conditions or counts — **no** problem/allergy/notes paragraphs |
| 9.4 | Sensitive flag | If `hasSensitiveMedicalDetails`, UI explains hidden text — does **not** show `PROBLEM`, `ALLERGY_TO`, `NOTES` values |
| 9.5 | Privacy note | API `privacyNote` shown (fixed wording about hidden free text) |
| 9.6 | Blocked labels | UI copy does not expose raw DBF column names as user-facing labels |
| 9.7 | Network | `GET …/medical-summary` JSON has no `problem`, `allergy`, `notes`, or raw row keys |

---

## 10. Treatments tab check

**Navigate:** **Patients** → **Treatments** tab (not the sidebar **Treatments** module — that remains a placeholder).

| Step | Action | Pass |
| --- | --- | --- |
| 10.1 | Tab visible | **Treatments** tab enabled (not “Soon”) |
| 10.2 | Lazy load | Fetch runs only when tab selected and bridge connected |
| 10.3 | Lede | Read-only copy mentions memos, descriptions, and fees stay hidden |
| 10.4 | List | Date, tooth, procedure code/label line, doctor label, status — no fee or amount columns |
| 10.5 | Procedure labels | Line uses `procedureCode` + `procedureLabel` from API (`PROCCHRT` join) — not raw `OPERTBL` procedure memo text |
| 10.6 | Doctor labels | Provider shows API `doctorLabel` or name from reference map — not address/phone from `DOCTORS.DBF` |
| 10.7 | Descriptions | `hasDescription` may show “Description hidden” badge — **no** `DESCRIPT` / `DESC` / `NOTE` body text |
| 10.8 | Truncation | If many rows, banner mentions truncation when API sets `truncated: true` |
| 10.9 | Privacy footnote | Treatments `privacyNote` visible at bottom of list |
| 10.10 | Network | `GET …/treatments` JSON has no `descript`, `desc`, `fee`, `charge`, `amount`, `samount`, or `rows` keys |
| 10.11 | Offline | Tab shows offline message when bridge down — no cached treatment rows |

**Fail clues:** `OPERTBL_DBF_NOT_FOUND` or empty list with error while catalog shows `opertbl` present → treatments reader needs loose mode on copy; see §3.5.

---

## 11. Reference labels check (doctors + procedures)

**Goal:** Confirm opaque ids resolve to staff-facing labels without exposing reference-table PII.

| Step | Where | Pass |
| --- | --- | --- |
| 11.1 | Network (once) | `GET /v1/reference/doctors` returns `doctorId`, `displayName`, `active` only — no address, phone, fax, tax, schedule grid, or `NOTES` |
| 11.2 | Network (once) | `GET /v1/reference/procedures` returns codes and labels — no price/fee/ledger amount fields |
| 11.3 | **Today** | Appointment cards show doctor / procedure class names when ids exist in reference data |
| 11.4 | **Schedule** | Grid/list shows resolved doctor and procedure class labels where hooks succeed |
| 11.5 | **Patients** profile | Provider row uses doctor reference (§7.3) |
| 11.6 | **Patients** → **Treatments** | Provider column matches §10.6 |
| 11.7 | Reference failure | If doctors route 404/offline, UI falls back to neutral copy (`Doctor {id}` or em dash) — no crash, no reference row dump |

Hooks cache in memory only — no `localStorage` of reference payloads.

---

## 12. Schedule page check

**Navigate:** Sidebar → **Schedule**.

| Step | Action | Pass |
| --- | --- | --- |
| 12.1 | Rooms | Room list or filter loads from `SC_ROOM` / dictionary |
| 12.2 | Day / week | Toggle changes date range within API **14-day inclusive** cap |
| 12.3 | Appointments grid/list | Times, rooms, status badges, patient safe names |
| 12.4 | Room filter | Optional room filter narrows results |
| 12.5 | Privacy | No comment bodies; no full phones; schedule `PAT_NAME` not used as display source |
| 12.6 | Reference labels | Procedure class and doctor names where hooks succeed (§11) |

---

## 13. Placeholder modules (quick)

**Navigate:** Sidebar → **Dental Chart**, **Treatments**, **Payments**, **Reports**, **Settings**.

| Module | Pass |
| --- | --- |
| **Dental Chart** | Module home + “Nothing to show yet” — **no** `CHARTDBF` API calls |
| **Treatments** (sidebar) | Placeholder only — real treatment history is under **Patients** → **Treatments** tab |
| **Payments** | Placeholder — **no** `TRANS.DBF` / ledger API |
| **Reports**, **Settings** | Placeholder empty states |
| **Back to Today** | Returns to dashboard from any placeholder |

**Mapped-only (docs, no routes):** Ledger — [phase-1b-ledger-payments-mapping.md](./phase-1b-ledger-payments-mapping.md). Odontogram — [phase-1b-dental-chart-mapping.md](./phase-1b-dental-chart-mapping.md).

Profile tabs **Payments** and **Chart** remain “Soon” — same as ledger/chart backend gap.

---

## 14. Privacy checks (cross-cutting)

Perform while on **Patients**, **Schedule**, and **Today** with real copied data (staff-only machine). Treat any failure as a **release blocker** for clinic preview.

| Check | How to verify | Pass |
| --- | --- | --- |
| **No full phone numbers** | Search + profile phone row | Only `…####` mask or em dash — never 7+ contiguous digits of a real number |
| **No `COMMENT` / schedule note bodies** | Appointments with `hasComment: true` in Network | Boolean/indicator only; response and UI lack comment memo text |
| **No `NOTE` / `DESCRIPT` / `DESC` bodies** | Treatments tab + `…/treatments` JSON | `hasDescription` flag only; no description strings in UI or API |
| **No `AMOUNT` / `SAMOUNT`** | Any `17890` response while browsing | No currency fields, balances, or ledger lines in JSON or UI |
| **No fees / charges / payments** | Treatments, sidebar Payments, catalog `trans` row | No `FEE`, `CHARGE`, `COST`, `PROFIT`, payment columns, or ledger module data |
| **No medical free text** | Medical tab + `…/medical-summary` | No `problem`, `allergy`, `notes` strings; `hasSensitiveMedicalDetails` may be true without values |
| **No `PAT_NAME` from schedule** | Compare `schedule/appointments` JSON to UI name | `patient.displayName` from patient file; response must not include `pat_name` / `PAT_NAME` keys |
| **No raw row dumps** | All screens except fixture card (§5) | No arbitrary column maps or `rows[]` of clinic tables in UI |
| **Network hygiene** | DevTools → Network → filter `17890` | Copy responses only on secure machine; redact before sharing |
| **Console** | DevTools → Console | No logged row payloads (dev health logs errors only) |

**Optional HTTP sanity (redact IDs/dates; no PHI in notes):**

```bash
curl -sS "http://127.0.0.1:17890/v1/schedule/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD" | jq '[.appointments[0] | keys]'
curl -sS "http://127.0.0.1:17890/v1/patients/PATIENT_ID/treatments" | jq 'keys'
curl -sS "http://127.0.0.1:17890/v1/patients/PATIENT_ID/medical-summary" | jq 'keys'
```

Confirm: no `comment`, `telephone`, `pat_name`, `descript`, `desc`, `amount`, `samount`, `problem`, `allergy`, `notes`, or `rows` keys in safe DTOs.

---

## 15. SQLite mirror schema check (Phase 2.1)

Schema and migrations only — **no** DBF import, **no** bridge/UI wiring yet. See [phase-2-sqlite-schema.md](./phase-2-sqlite-schema.md).

| Step | Action | Pass |
| --- | --- | --- |
| 15.1 | Node version | `node -v` reports **v22.5.0** or newer (built-in `node:sqlite` required) |
| 15.2 | Package tests | From repo root: `pnpm --filter @microdent/sqlite-mirror test` |
| 15.3 | Migrations | Tests apply `001_initial` + `002_indexes` idempotently |
| 15.4 | Tables | Expected domain tables exist (`patients`, `doctors`, `procedures`, `schedule_rooms`, `appointments`, `medical_summary`, import metadata) — **empty** after migrate |
| 15.5 | Privacy | Schema has no full-phone, address, memo, or clinical free-text columns |

**Note:** Root `pnpm test` also runs sqlite-mirror when Node ≥ 22.5; bridge/web still run on Node 18+.

---

## 16. Automated regression (optional)

Before manual QA or after bridge/UI changes:

```bash
pnpm test
```

**Pass:** Contracts, bridge, bridge-client, ui, app, and (on Node 22.5+) sqlite-mirror test suites green.

For mirror-only after schema edits:

```bash
pnpm --filter @microdent/sqlite-mirror test
```

---

## Sign-off template

| Area | Tester | Date | Pass / Fail | Notes |
| --- | --- | --- | --- | --- |
| Startup + health | | | | |
| Legacy catalog + OPERTBL header | | | | |
| Today dashboard | | | | |
| Fixture panel | | | | |
| Patient search | | | | |
| Profile + appointments | | | | |
| Medical | | | | |
| Treatments (patient tab) | | | | |
| Reference labels | | | | |
| Schedule | | | | |
| Privacy cross-check | | | | |
| SQLite mirror (Node 22) | | | | |

---

## Known gaps (not failures)

- Sidebar **Dental Chart**, **Treatments**, **Payments**, **Reports**, **Settings** are placeholders — no dedicated module APIs except patient-level tabs under **Patients**.
- **Ledger** (`TRANS.DBF`) and **odontogram** (`CHARTDBF.DBF`): mapping docs only — catalog may list presence; **no** `GET /v1/patients/:id/ledger` or chart routes.
- Profile tabs **Payments** and **Chart** show “Soon”.
- No client-side URL routing; deep links are not supported.
- `GET /v1/tables/*/rows` is **fixture-only** by registry design — not a clinic data browser.
- Large `OPERTBL` full-table scan for patient treatments may be slow — cap 200 rows per patient (see route inventory).
- SQLite mirror: schema/migrations only — no import CLI or bridge read path yet.
