# Phase 3 — Appointment write mapping (documentation only)

**Purpose:** Plan the **safest first write workflow** for appointment create/update against legacy **`SCHEDULE.DBF`**, without implementing writes in Microdent-Modern.

**Status:** Mapping and risk analysis only — **no bridge routes, no DBF writers, no UI mutations**.

**Constraints (this effort):**

- Read legacy files only from **`Microdent-Legacy-Copy`** (never modify).
- Do **not** touch **`Microdent-Legacy`** (production tree).
- Schema/header inspection only — **no row values**, patient names, phones, appointment notes, or raw dumps in this document.
- All implementation stays in **`Microdent-Modern`** when Phase 4 begins.

**Sources (read):**

- [phase-1b-calendar-mapping.md](./phase-1b-calendar-mapping.md) — field semantics and read API sketch
- [phase-1b-calendar-backend.md](./phase-1b-calendar-backend.md) — current read routes and blocked fields
- [phase-1b-route-inventory.md](./phase-1b-route-inventory.md) — zero writes today
- `Microdent-Legacy-Copy/schedule_replacement.py` — **documentation only** (64-bit scheduler write behavior; not executed)
- DBF headers re-verified read-only from  
  `/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA/`  
  on 2026-05-15 (`SCHEDULE.DBF`, `SC_ROOM.DBF`, `DICSCHED.DBF`)

---

## 1. Executive summary

| Artifact | Role in writes |
|----------|----------------|
| **`SCHEDULE.DBF`** (+ **`SCHEDULE.FPT`**, **`SCHEDULE.CDX`**) | **Only** transactional target for appointment create/edit/delete |
| **`SC_ROOM.DBF`** | **Read-only validation** — room index must exist and be active for the weekday pattern |
| **`DICSCHED.DBF`** | **Not written** — UI label dictionary (`ROOM1`–`ROOM25`); optional read for display names only |
| **`PATIENT.DBF`** / **`_patshet.DBF`** | **Read-only validation** — `PAT_ID` must resolve; do **not** copy name/phone into schedule on first write band |
| **`DOCTORS.DBF`** | **Read-only validation** — when `DOC_ID` is non-zero |
| **`IDS.DBF`** | **Unknown / high risk** — singleton counters may govern appointment `ID` allocation in FoxPro; replacement script uses `max(ID)+1` instead |

**Recommended first production write (when Phase 4 is approved):** **status-only update** on an existing `SCHEDULE` row by primary key `ID`, with all PHI-bearing and memo fields **omitted from the write payload** (leave unchanged in DBF).

**Defer until later bands:** create appointment, room/time move, denormalized field sync, memo `COMMENT`, soft-delete.

---

## 2. Verified schemas (headers only)

### 2.1 `SCHEDULE.DBF`

| Header fact | Value (copy inspected) |
|-------------|-------------------------|
| Version | `0xF5` (Visual FoxPro family) |
| Fields | **18** |
| Record length | **154** bytes |
| Header record count | **181297** (includes soft-deleted rows per DBF rules) |
| Sidecars | **`SCHEDULE.FPT`** (memo `COMMENT`), **`SCHEDULE.CDX`** (indexes) |

| Field | Type | Len | Dec | Write relevance |
|-------|------|-----|-----|-----------------|
| `ID` | N | 12 | 0 | Primary key; required on create; immutable on edit |
| `DATE` | D | 8 | 0 | Calendar date |
| `TIME` | C | 8 | 0 | Start time (character, not native `T`) |
| `DURATION` | N | 3 | 0 | Slot count |
| `ROOM` | N | 2 | 0 | Room/chair index → `SC_ROOM.ROOM` |
| `COMMENT` | M | 10 | 0 | **Block initially** — memo + FPT |
| `PROC_CLASS` | N | 2 | 0 | Procedure/visit class code |
| `PAT_ID` | N | 10 | 0 | Patient FK → `PATIENT.ID` |
| `PAT_NAME` | C | 41 | 0 | **Block initially** — denormalized PHI |
| `DOC_ID` | N | 5 | 0 | Doctor FK (often `0`) |
| `PERIOD` | N | 3 | 0 | Minutes per grid slot |
| `TELEPHONE` | C | 20 | 0 | **Block initially** — denormalized PHI |
| `STATUS` | N | 2 | 0 | Workflow status code |
| `CASENUM` | C | 12 | 0 | **Block initially** — case/chart string |
| `VAC_ID` | N | 10 | 0 | Vacation/block link (opaque) |
| `RECALL` | N | 2 | 0 | Recall flag/code (opaque) |
| `UNREASON` | N | 2 | 0 | Cancel/unschedule reason (opaque) |
| `MISSED` | L | 1 | 0 | Logical missed flag |

**Derived end time (not stored):** If `PERIOD` = minutes per slot and `DURATION` = slot count,  
`end = start(TIME) + DURATION × PERIOD` minutes (application-layer only).

### 2.2 `SC_ROOM.DBF`

| Header fact | Value |
|-------------|--------|
| Version | `0x03` |
| Fields | **9** |
| Record length | **16** bytes |
| Header record count | **25** |
| Sidecars | None observed on copy |

| Field | Type | Len | Dec | Role |
|-------|------|-----|-----|------|
| `ROOM` | N | 3 | 0 | Room index (matches `SCHEDULE.ROOM`) |
| `DAY1` … `DAY7` | L | 1 | 0 | Weekday active flags (bridge assumes **DAY1 = Sunday … DAY7 = Saturday**) |
| `DOCT` | N | 5 | 0 | Default/owning doctor for column |

**Write use:** Validate `ROOM` exists in an active row; optionally check `DAYn` for appointment weekday. **Do not write `SC_ROOM`** in the first appointment band.

### 2.3 `DICSCHED.DBF`

| Header fact | Value |
|-------------|--------|
| Version | `0x03` |
| Fields | **172** (all `C` in header) |
| Record length | **3554** bytes |
| Header record count | **2** |

**Nature:** Localization / UI strings (menus, warnings, month names, patient form **labels**). Operational room captions: **`ROOM1` … `ROOM25`** (`C` 40 each).

**Write use:** **None** for appointment CRUD. Read first row’s `ROOMn` for display only (same as Phase 1b).

---

## 3. Fields likely needed for create / edit

These are the **transactional** columns a future write API should understand. Phase 4 should accept only an explicit allowlist per operation type.

| Field | Create | Edit (full) | Edit (minimal) | Notes |
|-------|:------:|:-------------:|:----------------:|-------|
| `ID` | Required (allocated) | Key only | Key only | See §7.1 |
| `DATE` | Yes | Yes | Optional (move band) | FoxPro `D` |
| `TIME` | Yes | Yes | Optional (move band) | `C(8)` — format risk |
| `DURATION` | Yes | Yes | Optional (move band) | Slot count |
| `ROOM` | Yes | Yes | Optional (move band) | Must pass `SC_ROOM` validation |
| `PROC_CLASS` | Default `0` | Yes | Defer | Opaque without SME |
| `PAT_ID` | Yes (non-zero for real visits) | Yes | No (status-only) | Validate against `PATIENT` |
| `DOC_ID` | Default `0` | Yes | Defer | Validate if non-zero |
| `PERIOD` | Default `30` | Yes | Defer on status-only | See §7.3 |
| `STATUS` | Default `1` (scheduled) | Yes | **Yes (first write)** | See §7.4 |
| `VAC_ID` | Default `0` | Yes | Defer | Block/vacation semantics unknown |
| `RECALL` | Default `0` | Yes | Defer | Opaque |
| `UNREASON` | Default `0` | On cancel flows | Defer | Pair with status cancel |
| `MISSED` | Default `.F.` | Yes | Optional with no-show | Overlap with `STATUS` = 5 unclear |

**Not in first write allowlist:** `COMMENT`, `TELEPHONE`, `PAT_NAME`, `CASENUM` (§4).

**Replacement-script defaults on create** (documentation from `schedule_replacement.py`, not executed here):  
`VAC_ID=0`, `RECALL=0`, `UNREASON=0`, `MISSED=.F.`, `PROC_CLASS=0`, `DOC_ID=0`, `CASENUM=''`, `PERIOD=30`.

---

## 4. Fields blocked initially

| Field | Type | Block reason |
|-------|------|--------------|
| **`COMMENT`** | `M` + **FPT** | Free-text PHI; memo read/write is the highest parser and leakage risk; replacement tooling treats memo simplistically |
| **`TELEPHONE`** | `C` | Denormalized phone — duplicate of patient phone graph; never returned on read API today |
| **`PAT_NAME`** | `C` | Denormalized patient name — read API resolves display via `PATIENT.DBF` only |
| **`CASENUM`** | `C` | Case/chart identifier — withheld from read API; jurisdiction/workflow sensitivity |

**Write contract rule:** PATCH/PUT payloads must **reject** these keys. DBF updates must use **field-level merge** so omitted columns are not blanked.

**Denormalized fields on create (later band):** Legacy scheduler copies name/phone from patient pick. Modern first create should either leave `PAT_NAME` / `TELEPHONE` **empty** or run a separate, audited “sync denormalized display fields” band — not mixed into status-only.

---

## 5. Safe first write candidates (ordered)

### 5.1 Status-only update (recommended first)

**Operation:** Update **`STATUS`** (and optionally coordinated **`MISSED`** / **`UNREASON`** after SME review) on one existing row identified by **`ID`**.

**Why safest:**

- No new `ID` allocation or `IDS.DBF` interaction
- No slot geometry change → no overlap algorithm required in v1
- No memo/FPT, no denormalized PHI columns touched
- Smallest blast radius for dual-app concurrency (legacy FoxPro + Modern)
- Aligns with read API: `status` is already exposed as an opaque integer

** Preconditions:**

- `ID` exists, row not soft-deleted
- New `STATUS` in allowlisted set (§7.4) or explicit “unknown” policy
- Optional: reject transitions that legacy treats as invalid (unknown until FoxPro source review)

**Out of scope for v1:** Bulk status change, recurring templates, `VAC_ID` blocks.

### 5.2 Room / time move (second band)

**Operation:** Update **`DATE`**, **`TIME`**, **`ROOM`**, and possibly **`DURATION`** / **`PERIOD`** on an existing `ID`.

**Additional requirements:**

- Overlap detection (§6) in the target room/date window
- `SC_ROOM` validation + weekday `DAYn` check
- `TIME` normalization (§7.2)
- Still **omit** blocked fields; do not refresh `PAT_NAME` / `TELEPHONE` automatically in this band unless specified

### 5.3 Create appointment without comment (third band)

**Operation:** Append row with core keys, **`COMMENT`** absent/empty, blocked fields empty or defaulted.

**Additional requirements:**

- `ID` generation strategy (§7.1) with collision checks
- `PAT_ID` validation (non-zero → row in `PATIENT` or `_patshet`)
- Defaults for `VAC_ID`, `RECALL`, `UNREASON`, `MISSED`, `PROC_CLASS`, `DOC_ID`, `CASENUM`, `PERIOD`
- Overlap detection
- **CDX / index maintenance** after insert (§7.5)
- Decide policy for empty vs synced `PAT_NAME` / `TELEPHONE` (prefer empty in Modern until a dedicated sync step)

---

## 6. Required invariants (pre-write checks)

| Invariant | Applies to | Validation source | Failure posture |
|-----------|------------|-------------------|-----------------|
| **Valid patient id** | Create; patient change on edit | Sequential or indexed read of **`PATIENT.DBF`** (or **`_patshet.DBF`** if that is the clinic’s scheduler subset) — **id existence only**, no name/phone in logs | 400 `INVALID_PATIENT_ID` |
| **Valid room** | Create; move | **`SC_ROOM`**: `ROOM` matches; at least one `DAYn` true; optional weekday match for `DATE` | 400 `INVALID_ROOM` |
| **Valid doctor id** | When `DOC_ID ≠ 0` | **`DOCTORS.DBF`** — id exists (and optionally `active` when semantics known) | 400 `INVALID_DOCTOR_ID` |
| **Date/time parseable** | Create; move | `DATE` valid FoxPro date; `TIME` matches agreed format | 400 `INVALID_SCHEDULE_TIME` |
| **No overlapping appointment** | Create; move (when conflict logic enabled) | Scan **copy** of `SCHEDULE` for same **`ROOM`** + **`DATE`** where intervals intersect: `[start, start + DURATION×PERIOD)` | 409 `SCHEDULE_CONFLICT` |
| **Row exists and not deleted** | Edit | `ID` match; deletion flag not `*` | 404 `APPOINTMENT_NOT_FOUND` |
| **Exclusive access / backup** | All writes | Legacy app not holding exclusive lock; writable **disposable copy** for tests | 503 / operator abort |

**Overlap algorithm (sketch):** For each candidate row in room/date range, parse `TIME` to minutes-from-midnight, compute `end = start + durationSlots * (periodMinutes || 30)`. Reject if `start < otherEnd && otherStart < end`. Treat unknown `PERIOD` as 30 until distribution is validated on a copy (aggregate only, no row dumps).

**Concurrency:** Legacy scheduler and Modern must not write the same `DATA` tree simultaneously. Master plan: backup, feature flag, dry-run, audit before any live path.

---

## 7. Unknowns and risks

### 7.1 ID generation

| Approach | Risk |
|----------|------|
| `max(ID) + 1` over active rows (replacement script) | Race with FoxPro or second client; ignores **`IDS.DBF`** singleton counters documented in [legacy-system-map.md](./legacy-system-map.md) |
| Increment **`IDS.DBF`** appointment counter | Requires exact field name and write discipline on singleton row — **must confirm in legacy source** before use |
| Pre-allocate id block | Operational complexity |

**Mitigation:** Status-only updates avoid allocation. For create: disposable copy tests, collision probe after insert, never reuse deleted row ids without SME sign-off.

### 7.2 `TIME` format

- Stored as **`C(8)`**, not native DateTime.
- Replacement UI uses **`HH:MM`** on a 30-minute grid (07:00–19:00).
- Historical rows may use padding or variants — **do not log raw `TIME` on validation failure**.
- Normalize to fixed width on write only after distribution study on a **copy** (counts/histograms, not row samples in docs).

### 7.3 `PERIOD` meaning

- Documented inference: **minutes per scheduler slot**; replacement sets **`30`** on new rows.
- Read API exposes `periodMinutes` with `null` when zero — clients often assume 30.
- Risk: legacy rows with `PERIOD ≠ 30` break grid math and overlap checks.
- **Mitigation:** On write, default `30` for new rows; on move, preserve existing `PERIOD` unless operator explicitly changes it.

### 7.4 Status codes

Replacement UI documents:

| Code | Label (replacement UI) |
|------|-------------------------|
| 0 | Available |
| 1 | Scheduled |
| 2 | Confirmed |
| 3 | Completed |
| 4 | Cancelled |
| 5 | No-show |

Production data may contain **other integers** — read API passes them through unchanged. Write band should use an **allowlist** and map unknowns to read-only until validated.

**`MISSED` vs `STATUS`:** Logical `MISSED` may overlap status **5**; do not assume mutual exclusivity without legacy confirmation.

### 7.5 Index / CDX updates

- **`SCHEDULE.CDX`** must stay consistent with FoxPro expectations.
- Naïve byte-append writers (replacement script) **may not update CDX tags** the way VFP does.
- Risk: legacy app slow seeks, corrupted index, or `REINDEX` requirement.
- **Mitigation:** Prefer VFP-compatible library with index maintenance, or batch `REINDEX` on disposable copy only; never on production without backup.

### 7.6 Memo / FPT behavior

- `COMMENT` is type **`M`** — requires **`SCHEDULE.FPT`**.
- Missing/corrupt FPT breaks memo reads/writes.
- Replacement `DBFFile` class does not model memo type **`M`** fully (falls through to char-like handling) — **not a safe model for Modern writes**.
- **Mitigation:** Block `COMMENT` until a dedicated memo writer is tested on disposable data.

### 7.7 Soft delete

- FoxPro soft-delete sets record flag `0x2A` (`*`).
- Replacement supports `delete_record` (soft delete) — out of scope for first band but higher risk than status change.
- Header record counts include deleted rows — bridge read path skips `DELETED`.

### 7.8 Dual writers and file locking

- Writing while legacy **`SCHEDULE.EXE`** / FoxPro holds exclusive lock can corrupt files.
- **Mitigation:** Write only to **disposable copy** in dev; production path needs maintenance window or confirmed close of legacy scheduler.

### 7.9 Parser / encoding

- Use **`win1252`** / `readMode: 'loose'` lessons from Phase 1b reads.
- VFP `0xF5` null flags — verify writer preserves header version and field layout exactly.

---

## 8. Why `COMMENT` must not be writable first

1. **PHI concentration** — Staff free text is clinical/operational narrative; highest sensitivity in `SCHEDULE`.
2. **Memo + FPT** — Writes touch a second file (`SCHEDULE.FPT`) with block allocation; corruption affects all memos in the table.
3. **Read path already constrained** — Phase 1b returns `hasComment` boolean only; extending to write is asymmetric risk.
4. **Replacement script is not spec** — Python scheduler stores comment in a string field in the dialog but the on-disk type is **`M`**; round-trip safety is unproven for Modern stack.
5. **Leakage in errors** — Validation failures on memo content could echo text into logs or HTTP responses; blocked fields policy exists precisely to prevent this.
6. **No user story requires it for first workflow** — Status changes and moves do not require memo edits.

**Later band:** Dedicated memo write with redacted audit, size limits, charset checks, and FPT backup in the same backup bundle as DBF.

---

## 9. Required disposable `DATA` tests (before any live write)

All tests run against a **throwaway copy** of `DATA/` (never `Microdent-Legacy` production). Suggested tree: `Microdent-Legacy-Copy/DATA-write-test/` or temp dir populated by scripted copy.

| # | Test | Pass criteria |
|---|------|----------------|
| T1 | **Backup round-trip** | Full copy of `SCHEDULE.DBF` + `SCHEDULE.FPT` + `SCHEDULE.CDX`; checksum before/after no-op |
| T2 | **Status-only patch** | Single known synthetic `ID` (inserted in test fixture): change `STATUS` only; re-read via existing `GET /v1/schedule/appointments`; blocked fields unchanged (binary or field-compare on copy) |
| T3 | **Blocked field rejection** | API returns 400 if body contains `COMMENT`, `PAT_NAME`, `TELEPHONE`, `CASENUM` |
| T4 | **Invalid patient** | `PAT_ID` not in `PATIENT` → rejected; no row appended |
| T5 | **Invalid room** | `ROOM` not in `SC_ROOM` → rejected |
| T6 | **Invalid doctor** | `DOC_ID` non-zero and missing in `DOCTORS` → rejected |
| T7 | **Overlap detection** | Two appointments same room/date/overlapping interval → second rejected with 409 |
| T8 | **No overlap false positive** | Adjacent slots (end == next start) → allowed |
| T9 | **ID uniqueness** | After create test, `ID` not present before insert; `IDS` counter consistency check if applicable |
| T10 | **Soft-delete visibility** | Deleted row not returned by read API; delete API (later) sets `*` flag only |
| T11 | **Legacy open smoke** | After write on copy, legacy scheduler or header-only open does not report corruption (manual or automated file validity check) |
| T12 | **Audit log** | Write emits audit record: actor, timestamp, `ID`, changed fields **names only** — no memo/name/phone values |
| T13 | **Dry-run mode** | Feature flag validates invariants without writing bytes |
| T14 | **Rollback** | Restore copy from T1 backup; byte-identical to pre-test |

**Automation home (future):** `services/bridge` integration tests with synthetic DBFs (pattern from `schedule-fixtures.ts`) plus one **manual** checklist on a full copied `DATA` tree.

**Operator rules:**

- `DATA_ROOT` points at disposable copy only during write development.
- Never commit `.sqlite` mirrors or real copy paths.
- No write tests in CI against real clinic directories.

---

## 10. Future API shape (sketch only — not implemented)

| Method | Path | Band |
|--------|------|------|
| `PATCH` | `/v1/schedule/appointments/:id/status` | First — body: `{ "status": number }` |
| `PATCH` | `/v1/schedule/appointments/:id` | Second — move: `date`, `time`, `room`, `durationSlots` |
| `POST` | `/v1/schedule/appointments` | Third — create without blocked fields |

**Cross-cutting:** Feature flag `ALLOW_SCHEDULE_WRITES`, `DRY_RUN`, JSONL audit, If-Match / row version (optional), 503 when `DATA_ROOT` is read-only mount.

**Still read-only:** `GET /v1/schedule/*` unchanged; no `PAT_NAME` / `TELEPHONE` / `COMMENT` in responses.

---

## 11. Relationship to existing read stack

| Layer | Today | After Phase 4 (planned) |
|-------|--------|-------------------------|
| Bridge safety module | Read-only open only | Separate write helper with explicit allowlist; never reuse for reads |
| Schedule routes | `GET` rooms + appointments | Add `PATCH`/`POST` behind flags |
| SQLite mirror | Import safe fields only | Re-import after write tests on copy; still no dual-write to DBF + SQLite from UI |
| UI | Read-only schedule panel | Status actions first; no comment editor |

See [phase-1b-route-inventory.md](./phase-1b-route-inventory.md) — **Writes: 0** until Phase 4 ships.

---

## 12. Definition of done (this document)

- [x] `docs/phase-3-appointment-write-mapping.md` exists
- [x] Schemas for `SCHEDULE`, `SC_ROOM`, `DICSCHED` from header inspection
- [x] Create/edit field list, blocked fields, safe write ordering, invariants, risks, disposable tests, comment policy
- [x] No write code in Microdent-Modern
- [x] No real row values in this file
- [x] No files modified under `Microdent-Legacy` or `Microdent-Legacy-Copy`

---

*Document version: 1.0 — 2026-05-15. Update when `IDS.DBF` appointment counter field is confirmed, `TIME`/`STATUS` distributions are validated on a copy, or Phase 4 implementation begins.*
