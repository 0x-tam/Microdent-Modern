# Phase 1b — Dental chart / odontogram (schema mapping only)

**Purpose:** Safe planning for **read-only** clinical charting from **`CHARTDBF.DBF`** and related reference tables before any bridge route or UI exists.

**Scope:** Field names, FoxPro/VFP types (from DBF headers), widths/decimals, and **row counts** on the inspected copy only. **No** sample values, **no** memo text, **no** patient or staff identifying strings, **no** raw rows.

**Data source (read-only):** DBF headers were inspected with a **stdlib-only** binary read of:

`/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA/{CHARTDBF,PROCCHRT,OPERTBL,PATIENT,CHARTFLG,CHARTTMP}.DBF`

Cross-checks use `docs/legacy-system-map.md`, `docs/phase-1b-next-modules-mapping.md`, and `docs/master-build-plan.md` (counts from other snapshots may differ slightly).

**Related (already implemented elsewhere):** `GET /v1/reference/procedures` (`PROCCHRT`) — see `docs/phase-1b-reference-procedures.md`. `GET /v1/patients/:patientId/treatments` (`OPERTBL`) — see `docs/phase-1b-treatments-backend-spike.md`.

---

## 0. Copy-specific metadata (header only)

| Table       | Header version | Active rows (header) | Record length (bytes) | Sidecars (present on copy) |
|------------|----------------|----------------------|------------------------|----------------------------|
| `CHARTDBF` | `0xF5`         | 868,465              | 94                     | `.CDX`, `.FPT` (memo `NOTE`) |
| `CHARTTMP` | `0xF5`         | 424                  | 94                     | Same 67-field layout as `CHARTDBF` — **staging / in-session edits**; out of scope for first patient route. |
| `CHARTFLG` | `0x03`         | 26,799               | 12                     | `.CDX` only |
| `PROCCHRT` | `0x30`         | 25                   | 319                    | No `.FPT` on copy |
| `OPERTBL`  | `0x30`         | 420,910              | 301                    | Context for chart ↔ posted procedures |
| `PATIENT`  | `0xF5`         | 18,347               | 1,398                  | Join key context only |

**Out of scope / suspect:** `CHARTST.DBF` failed sanity check on this copy (garbage `record_count` in header) — listed in `docs/legacy-system-map.md` as **unparsed**; do not use for Phase 1b.

**Naming correction:** `docs/legacy-system-map.md` §3.3 refers to **`TOOTHNB`** on `CHARTDBF`; the physical column on this copy is **`TOOTH_NB`** (`N` 2,0). `OPERTBL` uses **`TOOTHNB`** without underscore — treat as **parallel semantics, different spellings** until join tests on a copy confirm alignment.

---

## 1. `CHARTDBF.DBF` — per-patient tooth state

### 1.1 Likely patient reference

| Field | Type | Len / dec | Role (inferred) |
|-------|------|-----------|-----------------|
| **`ID`** | `N` | 10,0 | Patient key; same role as **`PATIENT.ID`** and **`OPERTBL.ID`** per `docs/legacy-system-map.md`. |

**Join rule (documentation only):** filter `CHARTDBF` rows where `ID` equals the requested `patientId` (stringified integer). No row values logged during validation.

### 1.2 Likely tooth / arch / dentition fields

| Field | Type | Len / dec | Role (inferred) |
|-------|------|-----------|-----------------|
| **`TOOTH_NB`** | `N` | 2,0 | Tooth index within the practice’s numbering scheme (FDI vs Universal **not** encoded in the header — requires SME + legacy UI review). |
| **`TYPE`** | `N` | 1,0 | Chart **variant** or arch bucket (e.g. permanent vs primary chart, upper/lower template). **Semantics unknown** — expose as opaque `chartType` code only on first pass. |
| **`TOOTH_TYPE`** | `N` | 1,0 | Tooth classification (e.g. molar/incisor, primary marker). **Semantics unknown**. |
| **`INIT`** | `L` | 1 | Initialization / baseline flag for the tooth row. |
| **`ROTATE_S`** | `N` | 1,0 | Rotation/orientation indicator for rendering. |
| **`IMATURE_S`** / **`IMATURE_C`** | `N` | 1,0 each | Immature tooth state (status + companion code). |
| **`MISS_S`** | `N` | 1,0 | Missing-tooth indicator (status code, not boolean in DBF). |
| **`BUILD_S`** | `N` | 1,0 | Build-up / structural state code. |

**Cardinality:** ~868k rows ÷ ~18k patients ≈ **tens of rows per patient** on average — consistent with **multiple teeth** and possibly **multiple `TYPE` values per tooth**. First API must **cap** results (e.g. max 64–128 rows) and set `truncated: true` when exceeded.

### 1.3 Likely surface / condition fields (`*_S` / `*_C` pairs)

Legacy stores many **numeric status** columns (`*_S`) with parallel **category/color** columns (`*_C`). Names suggest clinical drawing layers, not ISO surface letters:

| Group | Status (`*_S`) | Companion (`*_C`) | Inferred domain (name only) |
|-------|----------------|-------------------|----------------------------|
| External | `EXT_S` | — | Extra / external annotation |
| Crown / bridge | `BCRN_S`, `BCRN2_S`, `CRN_S`, `LINKL_S`, `LINKR_S` | — | Crown, bridge links |
| Bleeding / pathology | `BLD1_S`–`BLD3_S` | — | Bleeding / lesion markers |
| Pulp / endo | `ENDO1_S`–`ENDO3_S`, `ENDOC0_S`–`ENDOC3_S` | `ENDO1_C`–`ENDO3_C`, `ENDOC1_C`–`ENDOC3_C` | Endodontic state |
| Abscess | `ABS1_S`–`ABS3_S` | — | Abscess markers |
| Filling facets | `F1_S`–`F5_S` | — | Up to five surface/facet codes |
| Implant | `IMP_S` | — | Implant marker |
| Layer | `LAY_S` | — | Layer / overlay |
| Fissure | `FIS_S` | `FIS_C` | Fissure sealant / caries pattern |
| PRR | `PRR_S` | `PRR_C` | Preventive resin restoration |
| Bridge detail | `BDG_S`, `BDG_LAST`, `BDG_1` | — | Bridge sub-state |
| Spacing (lower/upper) | `SPACEB_S`, `SPACEB_STR`, `SPACEB_END`, `SPACEB_M` | `SPACEB_C` | Lower arch spacing |
| Spacing (upper) | `SPACEU_S`, `SPACEU_STR`, `SPACEU_END`, `SPACEU_M` | `SPACEU_C` | Upper arch spacing |
| Misc | `PHM1_S`–`PHM3_S`, `WG`, `LOC` | — | Additional chart layers (`WG`, `LOC` are `L` flags) |

**First-pass API rule:** return **opaque integer codes** keyed by **field name** (e.g. `{ "field": "F2_S", "status": 2, "category": null }`) only for **non-zero** `*_S` / `*_C` pairs — **do not** translate codes to “caries”, “amalgam”, or colors until an SME-approved legend exists.

### 1.4 Likely procedure / treatment status on the chart row

| Field | Type | Role (inferred) |
|-------|------|-----------------|
| **`TREATED`** | `L` 1 | Tooth marked treated in chart UI. |
| **`USER_S`** | `N` 1,0 | Staff/user index for last chart edit (opaque; **not** a name). |

There is **no** `PROCNB`, `PROCEDURE`, or `DATE` on `CHARTDBF` — **posted procedures live in `OPERTBL`**, not on the odontogram row.

### 1.5 Date fields

**None** in the `CHARTDBF` header on this copy. Chart rows represent **current tooth state**, not a visit timeline. Historical “chart as-of date” is **not** available from this table alone.

Implications:

- Phase 1 read-only UI should show **“current chart snapshot”** only (aligns with `docs/ui-redesign-plan.md` §5 Phase 1 read-only).
- Visit history belongs to **`OPERTBL.DATE`** (treatments route) or future snapshot storage — **do not** infer dates from chart flags.

### 1.6 Fields that look like notes / free text — **block on first pass**

| Field | Type | Risk |
|-------|------|------|
| **`NOTE`** | `M` 10 | Memo on `.FPT` — **highest PHI risk**; may contain free-text clinical narrative. **Never** return body; at most `hasNote: boolean` after SME/policy review. |

No other character memos on `CHARTDBF`; remaining fields are numeric or logical.

---

## 2. Relationship to `PROCCHRT.DBF` (procedure reference)

`PROCCHRT` is the **fee-schedule / procedure dictionary**, not per-patient chart storage.

| `PROCCHRT` field | Type | Chart relevance |
|------------------|------|-----------------|
| **`PROCNB`** | `C` 6 | Procedure code; join target for **`OPERTBL.PROCNB`** (`C` 12 — width normalization required). |
| **`PROCEDURE`** | `C` 50 | Dictionary label (safe reference text when maintained centrally). |
| **`CHART`** | `L` 1 | **“Chart-relevant procedure”** — procedures that may be applied from chart UI (`chartRelevant` in `GET /v1/reference/procedures`). |
| **`THSURF`** | `L` 1 | Likely “requires tooth surface selection” when charting (confirm with SME). |

**There is no foreign key** from `CHARTDBF` rows to `PROCCHRT`. Relationship is **indirect**:

1. Clinician charts conditions on **`CHARTDBF`** (numeric layer codes).
2. Posting treatment creates **`OPERTBL`** lines with **`PROCNB`**, **`TOOTHNB`**, **`SURFACE`**, **`FROMCH`**.
3. Labels come from **`PROCCHRT`** via existing reference route.

**Do not** merge `OPERTBL` and `CHARTDBF` into one DTO without explicit product rules — they answer different questions ( **ledger/history** vs **graphic chart state** ).

---

## 3. Relationship to `OPERTBL.DBF` (posted procedures)

| Concept | `CHARTDBF` | `OPERTBL` |
|---------|------------|-----------|
| Patient key | `ID` | `ID` |
| Tooth | `TOOTH_NB` | `TOOTHNB` |
| Surfaces | Many `*_S` / `F1_S`…`F5_S` numeric layers | `SURFACE` `C` 6 (encoded string) |
| Procedure code | — | `PROCNB` `C` 12 |
| Procedure label | — | `PROCEDURE` `C` 50 (**block** — use `PROCCHRT`) |
| From chart | — | **`FROMCH`** `L` 1 — **link hint** when line originated in chart module |
| Date | — | **`DATE`** `D` 8 |
| Status | `TREATED`, layer codes | **`STATUS`** `N` 1,0 |
| Free text | **`NOTE`** memo | **`DESCRIPT`** memo, **`DESC`** `C` 30 (**block**) |

**Recommended cross-module UX (later):** patient profile shows **chart snapshot** tab and **treatments** tab separately; optional UI badge “also on chart” only after rules tie `OPERTBL` (`FROMCH`, `TOOTHNB`, date window) to `CHARTDBF` — **not** required for first chart route.

---

## 4. `PATIENT.DBF` — relationship context only

| Field | Type | Use for chart planning |
|-------|------|------------------------|
| **`ID`** | `N` 10,0 | Canonical patient id for route param and `CHARTDBF.ID` filter. |
| **`CASENB`** | `C` 15 | Chart/case number for profile header (already on profile/search routes). |
| **`PEDO`** | `L` 1 | May influence which `CHARTDBF.TYPE` / dentition UI legacy shows — **do not** assume 1:1 mapping without SME. |

**Block for chart route:** all name, address, phone, memo (`PAT_M_COMP`, `QUICKNOTE`), financial (`LAST_PAY`), and identifier columns — same policy as patient profile mapping.

---

## 5. `CHARTFLG.DBF` — patient-level chart flags (optional second slice)

| Field | Type | Role (inferred) |
|-------|------|-----------------|
| **`PATIENT_ID`** | `N` 10,0 | Patient key (`PATIENT.ID`). |
| **`FLAG_C`** | `L` 1 | Single logical flag per row — **semantics unknown** (multiple rows per patient possible). |

Defer dedicated API until `FLAG_C` meaning is documented. If included later, return only `{ "flagCode": "FLAG_C", "value": true }` per row — **no** free text on this table.

---

## 6. Parser and operational risks

| Risk | Severity | Detail |
|------|----------|--------|
| **Opaque `*_S` / `*_C` semantics** | Critical | Mis-mapping a numeric code to the wrong clinical symbol is **medicolegal** and worse than showing nothing. Require SME legend before visual odontogram. |
| **Tooth numbering scheme** | Critical | `TOOTH_NB` width `N` 2 does not reveal FDI vs Universal; wrong arch layout misleads clinicians. |
| **`TYPE` multiplicity** | High | Multiple rows per patient/tooth possible; UI must not collapse blindly. |
| **No row-level date** | High | Cannot reconstruct historical chart without other tables or exports. |
| **`NOTE` memo** | Critical | Must never appear in JSON/logs; `hasNote` only if approved. |
| **Large table scan** | High | ~868k rows — **must** filter by `ID` in bridge; consider CDX index on `ID` later or SQLite mirror (`docs/phase-2-sqlite-mirror-plan.md` `chart_lines` band). |
| **Header `0xF5` + memo** | Medium | Validate `dbffile` (or chosen reader) on **synthetic** `CHARTDBF` fixture with `NOTE` `M` column before production. |
| **`CHARTTMP` edits** | Medium | Staging table may hold unsaved work — **exclude** from patient chart route. |
| **`TOOTH_NB` vs `TOOTHNB` naming** | Medium | Joins to `OPERTBL` must use explicit field mapping, not assumed column alias. |
| **Incorrect color-only UI** | High | `docs/design-system.md` §12 requires icons/patterns, not color alone. |

---

## 7. Recommended first read-only DTO (contracts sketch — not implemented)

**Route (conceptual):** `GET /v1/patients/:patientId/chart`

```text
PatientChartResponse {
  patientId: string
  privacyNote: literal (fixed safe explanation)
  truncated: boolean
  teeth: PatientChartToothItem[]
}

PatientChartToothItem {
  toothNumber: number          // TOOTH_NB
  chartType: number | null     // TYPE (opaque)
  toothType: number | null     // TOOTH_TYPE (opaque)
  treated: boolean             // TREATED
  missingStatus: number | null // MISS_S when non-zero, else null
  layers: ChartLayerCode[]     // non-zero *_S / *_C only
  hasNote: boolean             // optional phase 1b — never note text
}

ChartLayerCode {
  field: string                // e.g. "F2_S", "ENDO1_C"
  status: number | null        // from *_S or numeric source
  category: number | null      // from *_C when present
}
```

**Intentionally omitted:** `NOTE` text, decoded clinical labels, hex colors, provider names, `PROCCHRT` prices, merged `OPERTBL` rows, `CHARTTMP` rows, `CHARTFLG` until specified.

**Cap suggestion:** 128 rows per patient (covers full dentition × few `TYPE` values); sort by `TOOTH_NB`, then `TYPE`.

---

## 8. Recommended UI approach

| Phase | UI | Rationale |
|-------|-----|-----------|
| **1b (first)** | **Simple sortable list / table** of `toothNumber`, `chartType`, `treated`, count of active layers, `hasNote` badge | Proves bridge + contracts without wrong glyphs; matches “list first” safety pattern used for treatments. |
| **1c+** | **Read-only arch grid** per `docs/design-system.md` §12 | Requires notation toggle (FDI default), legend from SME, non-color encodings, keyboard focus order. |
| **Later** | Overlay **`OPERTBL`** history on selected tooth (link to treatments tab) | Separate data source; dates come from treatments, not `CHARTDBF`. |

**Shell:** `dental-chart` nav module already exists (`packages/app/src/app-nav-modules.ts`) — keep **placeholder** until list view is wired; show read-only banner and privacy line like schedule/treatments.

---

## 9. Suggested route and implementation order

### 9.1 Route (documentation only)

| Route | Purpose | Primary table | First-pass safety |
|-------|---------|---------------|-------------------|
| **`GET /v1/patients/:patientId/chart`** | Current odontogram state for one patient | `CHARTDBF` | Filter `ID`; cap rows; opaque layer codes; **block `NOTE`**; no scan logging. |

Optional later: `GET /v1/patients/:patientId/chart-flags` → `CHARTFLG` only.

### 9.2 Implementation order (within chart band)

1. **Parser spike** — synthetic `CHARTDBF.DBF` fixture mirroring 67 fields + `NOTE` `M`; confirm `dbffile` loose/read path; no production data in tests.
2. **Contracts** — `PatientChartResponse` / `PatientChartToothItem` Zod schemas (strict; no extra keys).
3. **Bridge route** — sequential scan with `ID` match + cap; `hasNote` boolean only if memo read is unavoidable.
4. **Bridge client** — `getPatientChart(patientId)`.
5. **UI** — read-only table in patient context (or dental-chart module stub with patient picker).
6. **SME legend doc** — separate mapping table `field + code → display glyph` (not in repo until approved).
7. **Visual odontogram** — only after legend + notation tests pass clinical review.

**Relative to other modules** (`docs/phase-1b-next-modules-mapping.md` §7): chart sits **after** reference routes, schedule, medical-summary, and **treatments** (reuses patient id validation and `PROCCHRT` dictionary). Chart is **lower priority than ledger** but **higher clinical risk** than boolean medical flags — do not rush the visual grid.

---

## 10. Tests to require later (no implementation in this task)

| Test | Assertion |
|------|-----------|
| Synthetic fixture round-trip | Bridge returns expected tooth count for known `ID` |
| Privacy JSON scan | Response must not contain keys: `NOTE`, `NAME`, `PROCEDURE`, `DESCRIPT`, `PRICE`, raw row maps |
| Memo policy | If `hasNote: true` appears in fixtures, body text never in JSON |
| Cap / truncate | Patient with >cap matching rows sets `truncated: true` |
| Wrong patient | Filter excludes other `ID`s (inject second patient in fixture) |
| Empty patient | Valid id with no chart rows → `teeth: []` |
| Layer filtering | Zero `*_S` / `*_C` omitted from `layers` array |
| Contract strictness | Unknown properties rejected by Zod |
| Client URL | `getPatientChart` hits `/v1/patients/:id/chart` only |

---

## 11. Definition of done (this document)

- [x] `CHARTDBF`, `PROCCHRT`, `OPERTBL`, `PATIENT`, and `CHARTFLG` mapped at **field-name / type** level from the read-only copy.
- [x] Blocked fields, parser/clinical rendering risks, first DTO, route, UI phasing, and test checklist documented.
- [x] **No** real row values, names, phones, notes, or clinical narrative in this file.

---

*Document version: 1.0 — 2026-05-15. Header parse only; semantics inferred from naming and cross-docs where stated.*
