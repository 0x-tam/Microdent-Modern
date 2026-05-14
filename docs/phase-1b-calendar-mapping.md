# Phase 1B — Calendar / scheduler data model (schema-only)

**Purpose:** Map **`SCHEDULE.DBF`**, **`SC_ROOM.DBF`**, and **`DICSCHED.DBF`** for a future **read-only** calendar bridge slice. This note records **field names and types from DBF headers only** (no row payloads, no patient names, phones, notes, or other appointment content).

**Sources (read):**

- `docs/master-build-plan.md` — Phase 1D schedule read model; safety posture.
- `docs/legacy-system-map.md` — High-level scheduling narrative and field name hints.
- `docs/phase-1b-legacy-catalog.md` — Catalog-only bridge rules; `DATA_ROOT` on a copy.
- `schedule_replacement.py` (repo root and copy under `Microdent-Legacy-Copy`) — **read as documentation**; confirms fields the 64-bit replacement touches; **not executed** for this mapping.

**Physical inspection:** DBF headers were parsed read-only from  
`/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA/`  
(versions, record counts, and field descriptors only).

---

## 1. Executive summary

| Artifact | Role |
|----------|------|
| **`SCHEDULE.DBF`** | Canonical appointment rows (Visual FoxPro `0xF5`; memo `COMMENT`; paired **`SCHEDULE.FPT`**, **`SCHEDULE.CDX`**). |
| **`SC_ROOM.DBF`** | Per-room configuration: which weekdays a room is active; optional doctor link (`DOCT`). |
| **`DICSCHED.DBF`** | Wide **UI / localization dictionary** for the legacy scheduler (column labels, dialogs, **`ROOM1`–`ROOM25`** captions). Not transactional schedule data. |

The replacement script aligns with **`SCHEDULE`** keys used for booking: **`ID`**, **`DATE`**, **`TIME`** (character clock), **`DURATION`**, **`ROOM`**, **`PAT_ID` / `PAT_NAME`**, **`TELEPHONE`**, **`STATUS`**, **`COMMENT`**, **`PERIOD`**, plus defaults for **`VAC_ID`**, **`RECALL`**, **`UNREASON`**, **`MISSED`**, **`PROC_CLASS`**, **`DOC_ID`**, **`CASENUM`**.

---

## 2. `SCHEDULE.DBF` — schema and inferred semantics

**Header facts (copy inspected):** version `0xF5` (VFP with null flags / extended table type family), **18 fields**, logical record count from header **181297** (includes deleted rows per DBF rules; bridge should use library semantics for active vs deleted), record length **154** bytes.

**Sidecars:** `SCHEDULE.FPT` (required for **`COMMENT`** memo), `SCHEDULE.CDX` (indexes; keep with DBF).

| Field | Type | Len | Dec | Likely role |
|-------|------|-----|-----|---------------|
| `ID` | N | 12 | 0 | **Appointment primary key** / allocator id. Replacement uses `max(ID)+1` on save. |
| `DATE` | D | 8 | 0 | **Appointment calendar date** (FoxPro `D` = `YYYYMMDD` storage). |
| `TIME` | C | 8 | 0 | **Start time** as text (replacement UI uses `HH:MM`). Treat as **string**, not native `T` time type. |
| `DURATION` | N | 3 | 0 | **Length in scheduler slots**; replacement UI labels slots as **×30 minutes** and uses `PERIOD` / grid step — see §6. |
| `ROOM` | N | 2 | 0 | **Room / chair index** (1-based in replacement; joins conceptually to `SC_ROOM.ROOM`). |
| `COMMENT` | M | 10 | 0 | **Staff memo** (memo block); assume PHI/clinical free text — **do not log or echo raw content** in Phase 1 APIs without policy. |
| `PROC_CLASS` | N | 2 | 0 | Procedure / visit classification code; replacement defaults **0**. Meaning vs `PROCINIT` / legacy UI **unconfirmed**. |
| `PAT_ID` | N | 10 | 0 | **Patient foreign key** (join `PATIENT.ID` / `_patshet` per legacy map). |
| `PAT_NAME` | C | 41 | 0 | **Denormalized patient name** for scheduler display; redundant with master patient — **high PHI**. |
| `DOC_ID` | N | 5 | 0 | **Doctor reference**; replacement defaults **0** when unknown. Likely ties to `DOCTORS` or similar — confirm width / join. |
| `PERIOD` | N | 3 | 0 | **Minutes per grid unit** or related quantum; replacement sets **30** on new rows — likely **slot length in minutes**. |
| `TELEPHONE` | C | 20 | 0 | **Denormalized phone**; **PHI** — duplicate of phone graph in `PHONETAB` / `PHN_TEL` for convenience. |
| `STATUS` | N | 2 | 0 | **Workflow status**; replacement documents **0 Available, 1 Scheduled, 2 Confirmed, 3 Completed, 4 Cancelled, 5 No-show** (validate against legacy EXE if discrepancies appear). |
| `CASENUM` | C | 12 | 0 | Case / chart identifier string; replacement defaults empty. Semantics **partially known** (case number). |
| `VAC_ID` | N | 10 | 0 | Vacation / block / template link — **inferred from name**; replacement defaults **0**. |
| `RECALL` | N | 2 | 0 | Recall-related flag or code — **inferred**; replacement defaults **0**. |
| `UNREASON` | N | 2 | 0 | Cancellation / unschedule reason code — **inferred**; replacement defaults **0**. |
| `MISSED` | L | 1 | 0 | Logical **missed** flag; replacement defaults **`.F.`** on create. |

**End time (derived, not stored):** If `PERIOD` is minutes per slot and `DURATION` is slot count, then  
`end = start_time + DURATION * PERIOD` minutes  
(compute in application layer after parsing `TIME`).

---

## 3. `SC_ROOM.DBF` — schema and inferred semantics

**Header facts:** version `0x03` (FoxPro / dBase III+ style without memos here), **9 fields**, **25** rows in header, record length **16** bytes.

**Sidecars:** No `FPT`/`CDX` present in this copy for `SC_ROOM` (still ship/read `DBF` only).

| Field | Type | Len | Dec | Likely role |
|-------|------|-----|-----|---------------|
| `ROOM` | N | 3 | 0 | **Room index** matching `SCHEDULE.ROOM`. |
| `DAY1` … `DAY7` | L | 1 | 0 | **Sunday … Saturday activity flags** (replacement assumes **at least one `.T.`** means room is active that week pattern). Exact weekday order **assumed** from `DAY1` naming — confirm in legacy UI. |
| `DOCT` | N | 5 | 0 | **Default or owning doctor** for the room column — **inferred**; join rules unknown. |

Replacement **`load_rooms`**: builds active room list from `SC_ROOM`, then overlays **`DICSCHED` record[0] `ROOM{n}`** strings as display names.

---

## 4. `DICSCHED.DBF` — schema and inferred semantics

**Header facts:** version `0x03`, **172** character fields, **2** logical rows in header, record length **3554** bytes (very wide label row).

**Sidecars:** None in this copy.

**Nature:** Almost all fields are **`C`** — localized **menu / dialog / column title** text. Names are English **tokens** (e.g. `SCHEDULER`, `WEEKS`, `WARNING`, `ROOMS_N`). The block **`ROOM1` … `ROOM25`** (each `C` width 40) holds **human-readable room titles** keyed by room number — safe to expose as **reference labels** (not patient content).

**Other field groups (by name patterns, not by reading values):**

- **Shell chrome:** `SCHEDULER`, `NETWORK`, `EDIT`, `UNLOCK`, `REFRESH`, `PRINT`, `CLOSE`, …
- **Scheduler grid:** `WEEKS`, `DAYS`, `TIME`, `ROOM`, `ROOMS`, `PATIENTS`, `SEARCH`, `DOCTORS`, `COL_CODING`, …
- **Dialogs / warnings:** `ERR_DATA`, `INV_APP`, `WARNING`, `SCHE_INUSE`, `DEL_APP`, `NO_PAT`, …
- **Date / calendar strings:** `JAN`…`DEC`, `SUN`…`SAT`, `CALENDAR`, `GOTO`, …
- **Patient form labels (dictionary only):** `ID`, `CASE_NB`, `HOME`, `WORK1`, `BIRTH`, `QUICKNOTE`, `MEDNOTE`, etc. — these are **UI labels**, not live patient fields in this table.

**Row selection:** Replacement reads **first active row** only for `ROOM{n}` overrides. Whether row 2 is locale variant or unused — **unknown** without legacy source.

---

## 5. Cross-check with `schedule_replacement.py` (documentation)

| Topic | Script behavior | DBF schema alignment |
|-------|-----------------|----------------------|
| Primary file | `SCHEDULE.DBF` | Matches. |
| Keys / allocator | `max_id()` over numeric `ID` | `ID` **N(12,0)** — wide enough for monotonic ids. |
| Patient pick | `_patshet.DBF` else `PATIENT.DBF` | Schedule still stores **`PAT_ID` + denormalized name/phone** — bridge can avoid opening patient tables for a **minimal** calendar if policy allows slot-only view. |
| Rooms | `SC_ROOM` + optional `DICSCHED` `ROOM{n}` | Matches field names **`ROOM`**, **`DAY1`–`DAY7`**, **`DOCT`**. |
| Status enum | Hard-coded `0`–`5` strings in UI | Matches **`STATUS` N(2,0)**; legacy app may use additional codes — **risk**. |
| New row defaults | `VAC_ID=0`, `RECALL=0`, `UNREASON=0`, `MISSED=.F.`, `PROC_CLASS=0`, `DOC_ID=0`, `CASENUM=''`, `PERIOD=30` | Fields exist; script does not explain **`VAC_ID` / `RECALL` / `UNREASON`** business rules. |
| Time grid | 30-minute slots, `TIME` as `HH:MM` | **`PERIOD`=30** in script; **`DURATION`** = slot count. |
| `COMMENT` | Edited as string in Tk form | Schema type **`M`** — script’s simplified reader may **not fully round-trip** memo/binary VFP features; **parser risk** for modern bridge. |

---

## 6. Unknowns and risks

1. **`TIME` storage:** Character, not native DateTime — parsing must tolerate legacy padding and possible non-`HH:MM` variants without logging raw values in errors.
2. **`STATUS` completeness:** Only six codes documented in the Python UI; production data may contain other integers — map unknowns to **“Other”** in UI and metrics.
3. **`PERIOD` variability:** If historical rows used a period other than 30, grid math changes — validate distribution on a **copy** with aggregate queries only (no row dumps in logs).
4. **`DOC_ID` join:** Target table and id width mismatches (`N(5)` vs doctors table) need confirmation before showing provider names.
5. **`VAC_ID`, `RECALL`, `UNREASON`, `CASENUM`, `PROC_CLASS`:** Semantic detail lives in legacy FoxPro code — treat as **opaque codes** until SME review.
6. **`MISSED` vs `STATUS`:** Overlap between logical missed flag and status **5** (no-show) unclear — do not infer exclusivity.
7. **Memo **`COMMENT`**:** Requires **`SCHEDULE.FPT`**; corrupted/missing FPT breaks memo reads. Content is high-risk PHI — default **omit** from read API.
8. **Deleted rows:** DBF soft deletes (`*` flag) — counts in §2 include deleted unless filtered; replacement’s `active_records()` skips deleted — bridge should mirror that.
9. **Concurrency:** Reading live `SCHEDULE` while legacy FoxPro holds exclusive locks can fail; **copy-first** per master plan.
10. **`DICSCHED` row choice:** Using only row 1 for labels may be wrong if row 2 is the active language — needs legacy confirmation.
11. **Parser library:** `dbffile` / chosen reader must support **VFP `0xF5`** and **`M`** fields; fallback: header-only + “memo not available” for Phase 1.

---

## 7. Recommended first **read-only** calendar API shape (no implementation here)

Design goals: **localhost GET**, **range-bounded queries**, **no full-table scans from UI**, **no PHI in logs**, **no row dumps in documentation**.

**Suggested resources**

1. **`GET /v1/calendar/rooms`** (or `/v1/meta/schedule-rooms`)  
   - From **`SC_ROOM`**: `room`, `day1`…`day7`, `doct` (numeric codes only).  
   - Optional join to **`DICSCHED`**: first configured row’s **`ROOM1`…`ROOM25`** as `displayName` (localized label, not patient data).

2. **`GET /v1/calendar/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD&room=`**  
   - Query **`SCHEDULE`** by **`DATE` range** (+ optional **`ROOM`**).  
   - Hard cap (e.g. 500–2000 rows) + cursor if needed later.

**Suggested DTO (first safe slice)**

- **Include:** `id`, `date`, `time` (string), `durationSlots`, `periodMinutes` (from row or default 30 if null/zero), `room`, `status`, `docId`, `procClass`, `patId` (numeric key only), `vacId`, `recall`, `unreason`, `missed`, `casenum` (opaque string — consider withholding until policy), flags `hasComment` / `commentLength` **instead of** memo text.  
- **Compute server-side (optional):** `endTime` or `endLocal` ISO **only if** parsing rules are validated; otherwise let UI compute from `time` + `durationSlots` × `periodMinutes`.

**Withhold initially from any UI-facing response**

- **`PAT_NAME`**, **`TELEPHONE`**, **`COMMENT`** memo body, and any parsed free text.  
- **`CASENUM`** if treated as sensitive identifier in your jurisdiction/workflow.

**Separate, explicit patient module later**

- After **`GET /v1/patients/:id`** (or equivalent) exists with masking/consent, UI may resolve **`patId`** to display name — not from schedule row denormalization.

---

## 8. Field checklist vs research goals

| Goal | SCHEDULE field(s) | Notes |
|------|-------------------|--------|
| Appointment key | `ID` | Numeric surrogate. |
| Date | `DATE` | Native `D`. |
| Start time | `TIME` | `C`, parse as clock. |
| End / duration | `DURATION`, `PERIOD` | Derive end; not stored atomically. |
| Patient reference | `PAT_ID` (+ denormalized `PAT_NAME`) | Prefer **`PAT_ID` only** in API v1. |
| Doctor reference | `DOC_ID` | Often `0` in replacement defaults. |
| Room / chair | `ROOM` | Join `SC_ROOM` / labels. |
| Status | `STATUS` | Map known codes; bucket unknowns. |
| Notes / memo | `COMMENT` (`M`) | Present; **omit content** from first API. |

---

## 9. Definition of done (this document)

- Schemas for **`SCHEDULE`**, **`SC_ROOM`**, **`DICSCHED`** captured from headers.  
- Inferred meanings, **`schedule_replacement.py`** comparison, unknowns/risks, and a **safe first read-only API** sketched.  
- **No appointment row values and no PHI** included in this file.

---

*Document version: 1.0 — 2026-05-14. Update when bridge parser proves `TIME`/`STATUS` distributions or legacy source confirms `DAY1` weekday order and `DICSCHED` row selection.*
