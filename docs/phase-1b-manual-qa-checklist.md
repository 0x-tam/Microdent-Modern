# Phase 1b — Manual QA checklist (read-only app)

Use this checklist to smoke-test the **Microdent-Modern** web preview and local bridge without guessing navigation. All steps assume **localhost only**, a **copied** legacy `DATA` tree (never `Microdent-Legacy`), and **no PHI** in notes, screenshots, or tickets.

**Related:** [phase-1b-route-inventory.md](./phase-1b-route-inventory.md) (API routes, DBF sources, blocked fields).

---

## Before you start

| Item | Requirement |
| --- | --- |
| Repo | `/Users/Tamam/Desktop/Microdent/Microdent-Modern` |
| Legacy data | Read-only copy only, e.g. `Microdent-Legacy-Copy/DATA` — **do not** open or modify `Microdent-Legacy` |
| Node / pnpm | Installed; run `pnpm install` once after clone |
| `DATA_ROOT` | **Absolute** path to either the legacy copy `DATA` folder **or** `services/bridge/fixtures/sandbox` (fixture-only, no real patients) |
| Web env | `apps/web/.env.local` with `VITE_BRIDGE_BASE_URL=http://127.0.0.1:17890` (created from `.env.local.example` by `pnpm dev:web` if missing) |

**Privacy rule for QA:** Do not paste patient names, chart numbers, phone digits, appointment comment text, or raw JSON from clinic data into chat, email, or issue trackers. Use pass/fail and generic descriptions only.

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
| 3.3 | Expected tables | Entries align with catalog registry (patient, schedule, medical, opertbl, etc.) — presence depends on your copy |
| 3.4 | Refresh | Panel can reload without crashing |

**Fail:** 503 everywhere → `DATA_ROOT` unset on bridge. Empty list with errors → path or permissions on copy.

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
| 7.3 | Blocked columns | Page text does **not** include `HOME_PHONE`, `STREET`, `EMAIL`, `QUICKNOTE`, `INSURANCE`, raw JSON |
| 7.4 | Read-only banner | Still visible at top of shell |

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
| 9.1 | Load | Screening summary or “no medical record” — not infinite spinner |
| 9.2 | Flags | Boolean-style conditions or counts — **no** problem/allergy/notes paragraphs |
| 9.3 | Sensitive flag | If `hasSensitiveMedicalDetails`, UI explains hidden text — does **not** show `PROBLEM`, `ALLERGY_TO`, `NOTES` values |
| 9.4 | Privacy note | API `privacyNote` shown (fixed wording about hidden free text) |
| 9.5 | Blocked labels | UI copy does not expose raw DBF column names as user-facing labels |

---

## 10. Treatments tab check (if implemented)

**Navigate:** **Patients** → **Treatments** tab.

| Step | Action | Pass |
| --- | --- | --- |
| 10.1 | Tab visible | **Treatments** tab enabled (not “Soon”) |
| 10.2 | Lazy load | Fetch runs only when tab selected and bridge connected |
| 10.3 | List | Date, tooth, procedure code/label, doctor label, status — no fee columns |
| 10.4 | Descriptions | `hasDescription` may show indicator — **no** memo/`DESC` body text |
| 10.5 | Truncation | If many rows, banner mentions truncation when API sets `truncated: true` |
| 10.6 | Privacy footnote | Treatments `privacyNote` visible |

**Skip note:** If tab is disabled (“Soon”), record “treatments UI not shipped” and test `GET /v1/patients/:id/treatments` via route inventory curl only on a copy.

---

## 11. Schedule page check

**Navigate:** Sidebar → **Schedule**.

| Step | Action | Pass |
| --- | --- | --- |
| 11.1 | Rooms | Room list or filter loads from `SC_ROOM` / dictionary |
| 11.2 | Day / week | Toggle changes date range within API **14-day inclusive** cap |
| 11.3 | Appointments grid/list | Times, rooms, status badges, patient safe names |
| 11.4 | Room filter | Optional room filter narrows results |
| 11.5 | Privacy | No comment bodies; no full phones; schedule `PAT_NAME` not used as display source |
| 11.6 | Reference labels | Procedure class and doctor names where hooks succeed |

---

## 12. Placeholder modules (quick)

**Navigate:** **Dental Chart**, **Treatments** (sidebar), **Payments**, **Reports**, **Settings**.

| Step | Pass |
| --- | --- |
| Each opens module home + “Nothing to show yet” empty state | No accidental API calls to ledger/payment tables |
| **Back to Today** works | Returns to dashboard |

---

## 13. Privacy checks (cross-cutting)

Perform while on **Patients**, **Schedule**, and **Today** with real copied data (staff-only machine).

| Check | How to verify | Pass |
| --- | --- | --- |
| No full phone numbers | Search + profile phone row | Only `…####` mask or em dash |
| No `COMMENT` text | Schedule + appointments with `hasComment: true` in network tab | Boolean/indicator only; no memo body in UI or Network response JSON |
| No `PAT_NAME` from schedule | Compare Network `schedule/appointments` JSON to UI name | `patient.displayName` from patient file; response must not include `pat_name` / `PAT_NAME` keys |
| No raw row dumps | Browse all screens except fixture card | No arbitrary column maps in UI |
| No fees / payments | Treatments tab, sidebar Payments, TRANS | No currency columns, balances, or ledger lines unless a future band explicitly adds them |
| No medical free text | Medical tab + Network `medical-summary` | No `problem`, `allergy`, `notes` strings; `hasSensitiveMedicalDetails` may be true without values |
| Network hygiene | DevTools → Network → filter `17890` | Copy responses only on secure machine; redact before sharing |
| Console | DevTools → Console | No logged row payloads (dev health logs errors only) |

**Optional HTTP sanity (no PHI in notes):**

```bash
# Replace IDs/dates with synthetic or redacted values from your environment
curl -sS "http://127.0.0.1:17890/v1/schedule/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD" | jq 'keys'
```

Confirm appointment objects lack `comment`, `telephone`, `pat_name`, and `rows` keys.

---

## 14. Automated regression (optional)

Before manual QA or after bridge changes:

```bash
pnpm test
```

**Pass:** Contracts, bridge, bridge-client, ui, and app test suites green.

---

## Sign-off template

| Area | Tester | Date | Pass / Fail | Notes |
| --- | --- | --- | --- | --- |
| Startup + health | | | | |
| Legacy catalog | | | | |
| Today dashboard | | | | |
| Fixture panel | | | | |
| Patient search | | | | |
| Profile + appointments | | | | |
| Medical | | | | |
| Treatments | | | | |
| Schedule | | | | |
| Privacy cross-check | | | | |

---

## Known gaps (not failures)

- Sidebar modules **Dental Chart**, **Payments**, **Reports**, **Settings** are placeholders — no backend routes yet.
- Profile tabs **Payments** and **Chart** show “Soon” — not wired.
- No client-side URL routing; deep links are not supported.
- `GET /v1/tables/*/rows` is **fixture-only** by registry design — not a clinic data browser.
- Large `OPERTBL` scans may be slow on patient treatments — see route inventory limitations.
