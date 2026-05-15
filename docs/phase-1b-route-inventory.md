# Phase 1b — Safe route inventory (read-only bridge)

Inventory of **HTTP routes** exposed by `services/bridge` and how the **web preview** (`apps/web` + `@microdent/app`) consumes them. This document describes **current behavior only** — it does not specify new routes or UI changes.

**App navigation:** The shell uses **in-memory module state** (`today`, `patients`, `schedule`, …), not browser URL routes. Only the bridge endpoints below are true HTTP routes.

**Privacy:** No sample row values, patient names, or identifiers appear here. Use [phase-1b-manual-qa-checklist.md](./phase-1b-manual-qa-checklist.md) for manual verification.

---

## Summary

| Category | Count | Read-only |
| --- | ---: | --- |
| Root / health | 3 (`/`, `/health`, `/debug/cors` dev) | Yes |
| `GET /v1/*` data routes | 13 | Yes |
| Writes | 0 | — |
| Phase 2 SQLite mirror | Package `@microdent/sqlite-mirror` — **not HTTP** | Schema only |

All `GET /v1/*` routes return **503** `DATA_ROOT_NOT_CONFIGURED` when `DATA_ROOT` is unset. Path resolution uses the bridge **safety sandbox** (basename only under `DATA_ROOT`).

**Not implemented (mapping docs only):** Patient **ledger** (`TRANS.DBF`) and **dental chart** (`CHARTDBF.DBF`) — see [phase-1b-ledger-payments-mapping.md](./phase-1b-ledger-payments-mapping.md) and [phase-1b-dental-chart-mapping.md](./phase-1b-dental-chart-mapping.md). Both may appear in `GET /v1/legacy/catalog` with header counts only.

---

## Root and diagnostics

| Route | Status | Source DBF | Read-only | Fields returned | Fields explicitly blocked | UI screen | Known limitations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /` | Stable | — | Yes | `ok`, `service`, `health` path hint | — | None (discovery JSON) | Not used by shell UI |
| `GET /health` | Stable | — | Yes | `ok`, `version` | — | Top bar via `probeBridgeHealth` → `getHealth()` | No `DATA_ROOT` signal |
| `GET /debug/cors` | Dev only (`NODE_ENV !== production`) | — | Yes | Static CORS policy summary (hosts, port range) | Secrets, paths, env values | None | Production bridge omits route |

---

## Catalog and fixture table APIs

| Route | Status | Source DBF | Read-only | Fields returned | Fields explicitly blocked | UI screen | Known limitations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /v1/meta/tables` | Stable | Registry scan: **`FAKE_TINY.dbf`** only in `TABLE_REGISTRY` | Yes | Per table: `id`, `label`, `fileName` | Row data | **Today** → Data connection test (fixture probe) | Lists only registered fixture table(s) present on disk |
| `GET /v1/legacy/catalog` | Stable | Registry metadata for: `PATIENT`, `SCHEDULE`, `TRANS`, `OPERTBL`, `CHARTDBF`, `MEDICAL`, `DOCTORS`, `TRETPLAN`, `PROCCHRT`, `SC_ROOM`, `DICSCHED` (basename presence under `DATA_ROOT`) | Yes | Per table: `tableId`, `displayName`, `fileName`, `present`, `recordCount`, `fieldCount` | Row payloads, column values, field names in API | **Today** → Legacy catalog panel | **`OPERTBL.DBF`:** header open tries strict mode, then `readMode: "loose"` + `win1252` for VFP `_NullFlags` — counts only, no `readRecords`. Other tables: strict header only. `TRANS` / `CHARTDBF` presence does not imply ledger/chart routes. |
| `GET /v1/tables/:tableId/schema` | Stable | File named in registry entry (currently **`FAKE_TINY.dbf`**) | Yes | `tableId`, `fields[]` (`name`, `type`, `size`, optional `decimalPlaces`) | Row values | **Today** → fixture probe | Unknown `tableId` → 404; invalid id format → 400 |
| `GET /v1/tables/:tableId/rows?limit&offset` | Stable | Same as schema route | Yes | `tableId`, `limit`, `offset`, `totalRecords`, `rows[]` (field → JSON cell) | — (full row allowed **only** for synthetic fixture) | **Today** → fixture preview table (dev-labeled) | Default limit 50, max 100; **not** registered for clinic tables; QA must not point UI at real tables |

---

## Patient routes

| Route | Status | Source DBF | Read-only | Fields returned | Fields explicitly blocked | UI screen | Known limitations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /v1/patients/search?q=` | Stable | **`PATIENT.DBF`** | Yes | `results[]`: `patientId`, `chartNumber`, `displayName`, `phoneMask` | Addresses, email, SS, insurance, memos (`QUICKNOTE`, `PAT_M_COMP`), full phone, raw rows, payment columns | Top bar **PatientSearchBar** | Max **20** hits; full-file scan; `q` length 2–100; search haystack is id/chart/name columns only |
| `GET /v1/patients/:patientId/profile` | Stable | **`PATIENT.DBF`** | Yes | Extends search fields + `reverseName`, `active`, `doctorId`, `entryDate`, `lastVisit` | Same as search plus `STREET`, `EMAIL`, memos, alternate names, appointments/treatments embedded | **Patients** → profile summary card | 404 if id not found; id must be positive integer string without leading zeros; **Provider** label via `useDoctorLabels` + `doctorDisplayLabel` |
| `GET /v1/patients/:patientId/medical-summary` | Stable | **`MEDICAL.DBF`** | Yes | `patientId`, `hasMedicalRecord`, `hasSensitiveMedicalDetails`, `lastUpdated`, `lastDentalVisit`, `flaggedConditionCount`, `conditions` (boolean flags), `privacyNote` | `PROBLEM`, `ALLERGY_TO`, `NOTES` (values never returned); raw row | **Patients** → **Medical** tab | 200 with `hasMedicalRecord: false` when no row; latest row by `DATE`; lazy fetch when tab active; `med1`/`med2`/`aids` semantics uncertain |
| `GET /v1/patients/:patientId/treatments` | Stable | **`OPERTBL.DBF`** (+ joins **`PROCCHRT`**, **`DOCTORS`**) | Yes | `patientId`, `treatments[]` (`treatmentId`, `date`, `tooth`, `procedureCode`, `procedureLabel`, `doctorId`, `doctorLabel`, `status`, `hasDescription`), `truncated`, `privacyNote` | Memo `DESCRIPT`, `DESC`, `NOTE`, `PROCEDURE` line text, fees (`FEE_*`, `CHARGE`, `PROFIT`, `COST`, `AMOUNT`, `SAMOUNT`, …), plan/ledger ids, raw row | **Patients** → **Treatments** tab | Cap **200** rows per patient; full-table scan — slow on large `OPERTBL`; reader uses `readMode: "loose"` where required; UI merges `doctorLabel` with `GET /v1/reference/doctors` |
| `GET /v1/patients/:patientId/appointments?from&to` | Stable | **`SCHEDULE.DBF`** + patient merge from **`PATIENT.DBF`** | Yes | `appointments[]`: same safe appointment DTO as schedule (see below) | `PAT_NAME`, `TELEPHONE`, `COMMENT` body, `CASENUM`, raw rows | **Patients** → **Appointments** tab | Inclusive range max **365** days; filtered to one `patientId` server-side |

### Safe patient summary (search, profile, schedule patient blob)

Returned fields: `patientId`, `chartNumber`, `displayName`, `phoneMask` (search/profile only — **not** on schedule appointment `patient` object).

Blocked everywhere: full phone, address block, email, insurance, memos, raw DBF maps.

---

## Schedule routes

| Route | Status | Source DBF | Read-only | Fields returned | Fields explicitly blocked | UI screen | Known limitations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /v1/schedule/rooms` | Stable | **`SC_ROOM.DBF`**, optional **`DICSCHED.DBF`** (first row `ROOM1`–`ROOM25`) | Yes | `rooms[]`: `room`, `displayName`, `activeDays` (Sun–Sat), `doctorId` | Other `DICSCHED` columns, patient content | **Schedule** panel (room filter) | `DAY1`–`DAY7` weekday order assumed per mapping doc |
| `GET /v1/schedule/appointments?from&to&room?` | Stable | **`SCHEDULE.DBF`** + **`PATIENT.DBF`** lookup | Yes | `appointments[]`: `id`, `date`, `time`, `durationSlots`, `periodMinutes`, `room`, `status`, `docId`, `patId`, `patient` (`patientId`, `displayName`, `chartNumber` or null), `procClass`, `vacId`, `recall`, `unreason`, `missed`, `hasComment` | `PAT_NAME`, `TELEPHONE`, `COMMENT` text, `CASENUM`, raw row; no `phoneMask` on appointments | **Schedule** panel; **Today** dashboard (today’s range) | Inclusive range max **14** days; max **1000** appointments per response; `TIME` unparsed string; `periodMinutes` null → clients often assume 30 min |

Appointment `patient.displayName` is **only** from `PATIENT.DBF`, never from `SCHEDULE.PAT_NAME`.

---

## Reference routes (no dedicated page — cached hooks)

| Route | Status | Source DBF | Read-only | Fields returned | Fields explicitly blocked | UI screen | Known limitations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /v1/reference/doctors` | Stable | **`DOCTORS.DBF`** | Yes | `doctors[]`: `doctorId`, `displayName`, `active` | Address, phone, fax, tax ids, credentials, schedule grid columns, `NOTES` memo, raw row | **Today**, **Schedule**, **Patients** (profile provider + treatments) via `useDoctorLabels` | Full table scan; `active` semantics uncertain; in-memory cache only |
| `GET /v1/reference/procedures` | Stable | **`PROCCHRT.DBF`** | Yes | `procedures[]`: `procedureCode`, `displayName`, `category`, `categoryCode`, `classId`, `chartRelevant` | All price/fee columns, ledger codes (`TRANS_CODE`, …), raw row | **Today**, **Schedule** via `useProcedureReference` | No pagination; full scan; treatments use server-side `procedureLabel` from same table |

---

## UI module map (client state, not HTTP)

| Module id | Label | Wired to bridge | Primary components |
| --- | --- | --- | --- |
| `today` | Today | Yes | `DashboardHome`, `LegacyCatalogPanel`, `FixtureConnectionPanel` |
| `patients` | Patients | Yes | `PatientSearchBar` (top bar), `PatientProfilePanel` (tabs: Appointments, Medical, Treatments) |
| `schedule` | Schedule | Yes | `SchedulePanel` |
| `dental-chart` | Dental Chart | No | Placeholder `ModuleHome` — **mapping only** ([dental chart doc](./phase-1b-dental-chart-mapping.md)) |
| `treatments` | Treatments | No (sidebar) | Placeholder `ModuleHome`; patient **Treatments** tab uses `GET …/treatments` |
| `payments` | Payments | No | Placeholder — **ledger mapping only** ([ledger doc](./phase-1b-ledger-payments-mapping.md)) |
| `reports` | Reports | No | Placeholder |
| `settings` | Settings | No | Placeholder |

### Patient profile tabs (in-module, not sidebar)

| Tab | Bridge route(s) | Status |
| --- | --- | --- |
| Appointments | `GET /v1/patients/:id/appointments` | Shipped |
| Medical | `GET /v1/patients/:id/medical-summary` | Shipped |
| Treatments | `GET /v1/patients/:id/treatments` + reference doctors | Shipped |
| Payments | — | “Soon” (ledger not routed) |
| Chart | — | “Soon” (odontogram not routed) |

---

## Phase 2 — SQLite mirror (not HTTP)

| Artifact | Status | Notes |
| --- | --- | --- |
| Package `@microdent/sqlite-mirror` | Schema + migrations | Node **≥ 22.5** (`node:sqlite`); no third-party SQLite dep |
| `applyMigrations(path)` | Stable | `001_initial.sql`, `002_indexes.sql` |
| DBF import / bridge reads | Not started | Domain tables empty after migrate; no PHI columns in schema |
| QA | `pnpm --filter @microdent/sqlite-mirror test` | See [phase-2-sqlite-schema.md](./phase-2-sqlite-schema.md) |

---

## Error codes (quick reference)

| HTTP | Code | Typical cause |
| ---: | --- | --- |
| 503 | `DATA_ROOT_NOT_CONFIGURED` | `DATA_ROOT` unset |
| 400 | `INVALID_QUERY`, `INVALID_PATIENT_ID`, `INVALID_SCHEDULE_QUERY`, `INVALID_PATIENT_APPOINTMENTS_QUERY`, `INVALID_PAGINATION`, `INVALID_TABLE_ID` | Bad params |
| 404 | `PATIENT_DBF_NOT_FOUND`, `PATIENT_NOT_FOUND`, `MEDICAL_DBF_NOT_FOUND`, `SCHEDULE_DBF_NOT_FOUND`, `SC_ROOM_DBF_NOT_FOUND`, `OPERTBL_DBF_NOT_FOUND`, `PROCCHRT_DBF_NOT_FOUND`, `DOCTORS_DBF_NOT_FOUND`, `TABLE_NOT_FOUND` | Missing file or unknown id |
| 500 | `*_ERROR` family | Read/parse failure — generic message, no row dump |

---

## Tables intentionally **without** HTTP routes (Phase 1b)

| DBF (catalog id) | Reason | Doc |
| --- | --- | --- |
| `TRANS.DBF` (`trans`) | Ledger — `AMOUNT`/`SAMOUNT` and payment narrative blocked | [phase-1b-ledger-payments-mapping.md](./phase-1b-ledger-payments-mapping.md) |
| `TRETPLAN.DBF` (`tretplan`) | Financial treatment plans — blocked | [phase-1b-next-modules-mapping.md](./phase-1b-next-modules-mapping.md) |
| `CHARTDBF.DBF` (`chartdbf`) | Odontogram — no chart UI/API band yet | [phase-1b-dental-chart-mapping.md](./phase-1b-dental-chart-mapping.md) |

`OPERTBL` is exposed **only** via filtered patient treatments DTO — not as raw rows or catalog row browser.

---

## Related docs

- [phase-1b-patient-search-backend.md](./phase-1b-patient-search-backend.md)
- [phase-1b-patient-profile-backend.md](./phase-1b-patient-profile-backend.md)
- [phase-1b-medical-summary-backend.md](./phase-1b-medical-summary-backend.md)
- [phase-1b-patient-appointments-backend.md](./phase-1b-patient-appointments-backend.md)
- [phase-1b-calendar-backend.md](./phase-1b-calendar-backend.md)
- [phase-1b-treatments-backend-spike.md](./phase-1b-treatments-backend-spike.md)
- [phase-1b-treatments-ui.md](./phase-1b-treatments-ui.md)
- [phase-1b-reference-doctors.md](./phase-1b-reference-doctors.md)
- [phase-1b-reference-procedures.md](./phase-1b-reference-procedures.md)
- [phase-1b-legacy-catalog.md](./phase-1b-legacy-catalog.md)
- [phase-1b-ledger-payments-mapping.md](./phase-1b-ledger-payments-mapping.md)
- [phase-1b-dental-chart-mapping.md](./phase-1b-dental-chart-mapping.md)
- [phase-2-sqlite-schema.md](./phase-2-sqlite-schema.md)
- [phase-1a-dbf-fixture-read.md](./phase-1a-dbf-fixture-read.md)
