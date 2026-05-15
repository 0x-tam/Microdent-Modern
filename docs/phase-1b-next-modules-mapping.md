# Phase 1b — Next patient profile modules (schema mapping only)

**Purpose:** Safe planning for read-only **Treatments**, **Payments / ledger**, and **Medical history** (plus reference joins) before any bridge routes or UI exist.

**Scope:** Field names, FoxPro/VFP types (from DBF headers), widths/decimals where present, and **row counts** on the inspected copy only. **No** sample values, **no** memo text, **no** patient or staff identifying strings.

**Data source (read-only):** DBF headers were inspected with a **stdlib-only** binary read of:

`/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA/{OPERTBL,TRANS,MEDICAL,TRETPLAN,PROCCHRT,DOCTORS}.DBF`

Cross-checks use `docs/legacy-system-map.md` (counts from a different legacy tree snapshot may differ slightly from this copy).

---

## 0. Copy-specific record counts (metadata only)

| Table       | Header version | Active rows (header) | Record length (bytes) |
|------------|----------------|----------------------|------------------------|
| `OPERTBL`  | `0x30`         | 420,910              | 301                    |
| `TRANS`    | `0xF5`         | 343,998              | 102                    |
| `MEDICAL`  | `0xF5`         | 2,619                | 119                    |
| `TRETPLAN` | `0x30`         | 56,056               | 155                    |
| `PROCCHRT` | `0x30`         | 25                   | 319                    |
| `DOCTORS`  | `0xF5`         | 7                    | 774                    |

---

## 1. Treatments / procedures (`OPERTBL.DBF`)

### 1.1 Likely patient reference

- **`ID`** — `N` 10,0. Same role as `PATIENT.ID` / `CHARTDBF.ID` in `docs/legacy-system-map.md` (**procedure lines belong to one patient**).

### 1.2 Likely date / ordering

- **`DATE`** — `D` 8 (FoxPro date).
- **`OPNUM`** — `N` 10,0 (line or operation sequence within patient history).

### 1.3 Tooth, procedure, status, doctor

| Field         | Type | Len / dec | Role (inferred) |
|---------------|------|-----------|-----------------|
| `TOOTHNB`     | `N`  | 2,0       | Tooth index / quadrant coding (clinical). |
| `PROCNB`      | `C`  | 12        | Procedure **code**; join candidate to `PROCCHRT.PROCNB` (`C` 6 — **width mismatch**, see §4). |
| `PROCEDURE`   | `C`  | 50        | Human-readable procedure label or template text (treat as sensitive until proven dictionary-only). |
| `SUBPROC`     | `C`  | 10        | Sub-code / modifier bucket. |
| `CLASSIF`     | `C`  | 50        | Classification / category text. |
| `SURFACE`     | `C`  | 6         | Surface codes (not free prose, but opaque without a legend). |
| `QUANTITY`    | `N`  | 4,0       | Quantity. |
| `STATUS`      | `N`  | 1,0       | Line status (numeric code). |
| `DOCT`        | `N`  | 2,0       | Doctor index; join to `DOCTORS.DOCTOR_NB` (`N` 10 — **width mismatch**, pad/cast in app). |
| `PLANNUM`     | `N`  | 10,0      | Treatment plan bucket; ties to `TRETPLAN.PLANNUM`. |
| `TRANSNUM`    | `N`  | 10,0      | Link to ledger row `TRANS.TRANS_NB` when financially posted. |
| `FROMCH`      | `L`  | 1         | Logical flag (e.g. from chart). |
| `CAT_ID`      | `N`  | 4,0       | Category id. |
| `SER_ID`      | `N`  | 3,0       | Service id. |
| `WITHRESULT`  | `L`  | 1         | Lab / result linkage hint (see `OPERAT.DBC` note in legacy map). |
| `TAX` / `ASKSURF` / `ASKQTY` | `L` | 1 | UI / posting behavior flags. |
| `IMPBY_HIS`   | `L`  | 1         | Import/history flag (name only). |
| `PROC_DISC`   | `N`  | 4,1       | Discount percent or similar. |

### 1.4 Fee / money columns on the same row (high sensitivity for a “clinical” tab)

`FEE_INIT`, `FEE`, `CHARGE` (`N` 13,4), `PROFIT` / `COST` (`Y` 8 — VFP currency), `PER_PROF` (`N` 5,2). For a **first-pass treatments** API, treat amounts as **blocked or aggregated** until product policy and parity with `TRANS` are defined.

### 1.5 Fields that look like notes / free text — **block on first pass**

- **`DESCRIPT`** — `M` 4 (memo): highest risk for free-text clinical content.
- **`DESC`** — `C` 30: short text; may still echo patient-specific wording — **block** until reviewed.
- **`PROCEDURE`**, **`CLASSIF`** — wide character fields; **prefer** returning **`PROCNB`** + dictionary label from `PROCCHRT` / other fee tables instead of raw strings.

### 1.6 Parser / metadata risks (`OPERTBL`)

- **Header `0x30`** (FoxPro/FoxBASE+ style) **with** a trailing **`_NullFlags`** column (`C` length 4 in header — VFP nullability bitmask column). Some DBF libraries **mis-handle** mixed-era layouts or skip `_NullFlags`, producing **column drift** or unreadable rows. Treat as **high parser risk**; validate against a **synthetic fixture** mirroring this header before exposing production paths.
- **Large row count** (~420k+): sequential scans per patient must be **bounded** (pagination, max rows, indexed reads later).
- **`Y` (currency)** fields: ensure the bridge’s DBF codec supports VFP currency types for `PROFIT` / `COST`.
- **Join key widths:** `PROCNB` `C(12)` vs `PROCCHRT.PROCNB` `C(6)` — require a documented **normalization** rule (trim, left match, or separate dictionary).

---

## 2. Payments / ledger (`TRANS.DBF`)

**Detailed ledger plan:** `docs/phase-1b-ledger-payments-mapping.md` (blocked fields, v1 DTO, route cap, tests).

### 2.1 Likely patient reference

- **`PATIENT_ID`** — `N` 6,0. Intended join to `PATIENT.ID`, but **`PATIENT.ID` is `N` 10** in the patient profile docs — assume **semantic match with possible legacy width difference**; validate joins on a copy with **counts and orphan checks**, not by logging row values.

### 2.2 Likely transaction date

- **`DATE`** — `D` 8.
- **`MONTH`**, **`YEAR`** — `N` 2,0 and `N` 4,0 (reporting / period denormalization).

### 2.3 Amounts and classification

| Field       | Type | Len / dec | Notes |
|------------|------|-----------|--------|
| `AMOUNT`   | `N`  | 13,4      | Primary signed amount (charge/payment/adjustment — **semantics depend on** `CH_TYPE` / `PAY_TYPE` / `ADJ_TYPE`). |
| `SAMOUNT`  | `N`  | 13,4      | Secondary amount (split, tax, shadow — **confirm in app/SME**). |
| `CH_TYPE`  | `N`  | 1,0       | Charge type. |
| `ADJ_TYPE` | `N`  | 1,0       | Adjustment type. |
| `PAY_TYPE` | `N`  | 4,0       | Payment instrument / category. |
| `CARD`     | `L`  | 1         | Card / payment-method flag (name suggests payment channel). |
| `QUANTITY` | `N`  | 4,0       | Quantity. |
| `TRANS_NB` | `N`  | 10,0      | Primary key for the line; target of `OPERTBL.TRANSNUM`. |
| `PLANNUM`  | `N`  | 10,0      | Plan linkage (insurance / treatment plan accounting). |
| `DOCT`     | `N`  | 4,0       | Provider reference (width differs from `OPERTBL.DOCT` `N` 2 — **do not assume one join key shape**). |
| `INSPAYNO` | `N`  | 10,0      | Insurance payment / remittance reference (identifier). |

### 2.4 Fields to **hide first**

- **`DESCR`** — `M` 10: memo; almost certainly **free text** (PII/PCI/clinical/financial narrative). **Never** return in an early ledger API.
- **Raw `AMOUNT` / `SAMOUNT`** until **type code semantics** are documented: mis-labeled credits/debits would **destroy accounting trust**. First pass might expose **opaque line ids + date + non-text codes only**, or **aggregates** with legal review.
- **`INSPAYNO`**, **`PLANNUM`** — identifiers that can combine with other tables to **re-identify** insurance episodes; gate behind policy.

### 2.5 Accounting correctness risks

- **No single “balance” field** in header: running balance is **derived** from ordered `TRANS` lines (and possibly `_transto`, adjustments in tables that failed parse elsewhere — see legacy map **ADJUST** parse failures). Any “balance” in Modern must be labeled **unofficial / informational** until reconciled with legacy reports.
- **Deleted rows:** respect soft-delete flags in the reader (same pattern as `SCHEDULE` / `PATIENT` routes).
- **Join to `OPERTBL`:** `TRANSNUM` ↔ `TRANS_NB` must handle **unposted** procedures (`TRANSNUM` zero or non-matching — confirm rules without dumping data).
- **Currency `Y` elsewhere** vs `N` here: internal rounding may differ from FoxPro UI.

---

## 3. Medical history (`MEDICAL.DBF`)

### 3.1 Likely patient reference

- **`PATIENT_ID`** — `N` 6,0 (same width caveat vs `PATIENT.ID` `N` 10).

### 3.2 Dates

- **`DATE`** — `D` 8 (questionnaire / update date).
- **`LAST_DENTA`** — `D` 8 (last dental visit date field — name truncated in header).

### 3.3 Warning / allergy / condition fields

**Low verbal leakage (mostly `L` 1 flags):**  
`HOSPITAL`, `PHYSICIAN`, `MEDICINE`, `ILL`, `REACTION`, `BLEEDING`, `ALLERGIC`, `HEART_TRBL`, `CONG_HEART`, `HEART_MRM`, `HIGH_PRESS`, `LOW_PRESS`, `ANEMIA`, `RH_FEVER`, `JAUNDICE`, `ASTHMA`, `COUGH`, `KIDNEYS`, `MED1`, `DIABETS`, `TUBERCUL`, `HEPATISIS`, `ARTHRITIS`, `STROKE`, `EPILEPSEY`, `PSYCHIATRI`, `SINUS_TRBL`, `PREGNANT`, `ULCERS`, `AIDS`, `MED2`.

**Higher sensitivity (text or memos):**

- **`PROBLEM`** — `C` 40 — **free-text / semi-structured clinical**; **block** on first pass.
- **`ALLERGY_TO`** — `C` 15 — may encode drug names or classes; treat as **sensitive** even when short.
- **`NOTES`** — `M` 10 — **block** entirely for early APIs.

### 3.4 Recommended safe first-pass approach

**`GET /v1/patients/:patientId/medical-summary` (conceptual contract only):**

- Return **only** non-identifying booleans (and optionally **counts** of “yes” answers), e.g. `hasAllergicFlag`, `hasDiabetesFlag`, with **no** string fields.
- Omit **`PROBLEM`**, **`ALLERGY_TO`**, **`NOTES`**, and all raw character memos.
- If a future phase needs allergy detail, use **controlled vocabulary** after SME review (never raw `PROBLEM` / `ALLERGY_TO` in v1).
- **Header `0xF5`:** ensure nullable / `_NullFlags` handling matches other VFP tables in the bridge (if present in other patient tables).

---

## 4. Doctors (`DOCTORS.DBF`) and procedure labels (`PROCCHRT.DBF`)

### 4.1 `DOCTORS` — keys and safe labeling

- **Primary key candidate:** **`DOCTOR_NB`** — `N` 10,0 (aligns with `PATIENT.DOCTOR_NB` and schedule `DOC_ID` conceptually; widths still need join tests).
- **Staff directory / PII:** `NAME` `C` 30, `ADDRESS` `C` 200, `CITY`, `STATE`, `ZIP`, `PHONE`, `FAX`, `CONTACT`, `LICNO`, `GROUP_NO`, `FED_TAXID`, `TAXID_TYPE`, `CREDENTIAL`, `NOTES` (`M` 10), and extensive **schedule window** `C` 8 fields (`SUNFROM1` … `SATTO3`) — **staff personal and operational data**.

**Safe to show (staff-facing app, first pass):**

- **`DOCTOR_NB`** as opaque **`doctorId`** (stringified integer).
- Optionally **`NAME`** for chairside UI **if** policy treats provider directory as non-patient PHI (still personal data — **mask or omit** in any patient-facing or export context).

**Block first:** address block, all phones/fax, tax ids, license numbers, memos, full weekly hour matrix (operational noise + indirectly identifies location patterns).

### 4.2 `PROCCHRT` — replacing raw ids

- **`PROCNB`** — `C` 6 — **canonical short code** for lookup from `OPERTBL.PROCNB` after trimming/padding rules are defined.
- **`PROCEDURE`** — `C` 50 — **human label** for the code (generally safer than per-patient `OPERTBL.PROCEDURE` text if dictionary-maintained).
- **`CHART`** — `L` 1 — likely “appears on chart” / chart-relevant flag.
- **`CLASS`**, **`GROUP`**, **`MODIFIER`**, **`CATAGORY`**, **`POS`**, **`CLASS_ID`**, **`TRANS_CODE`**, **`NI`**, etc. — configuration metadata; lower privacy risk than patient memos but **business-sensitive**.

**Financial sensitivity on the same table:**  
`PRICE1` … `PRICE9` (`N` 13,4), `PER_PROF` (`N` 5,2), `QTYOH`, `QTYPRIC` — **fee schedule / commercial**. For **`GET /v1/reference/procedures`**, a first pass should expose **code + label + non-monetary flags** only; **omit all price columns** until explicitly approved.

**Join / parser notes:** `PROCCHRT` header `0x30`, wide record (319 bytes) — low row count (25) makes it a cheap reference load.

---

## 5. Treatment plans (`TRETPLAN.DBF`) — context for tabs (not a required first route)

Fields: `ID` `N` 10, `DATE` **`T` 8** (DateTime — **parser/timezone** care), `DEBIT` `N` 10, `DESCR` `C` 30, `PLANNUM` `N` 10, several `L` flags (`SL_INS`, `PROCESS`, `BATCH`), `INS_PAY` / `TOT_PAY` / `COP_PER` (`Y` 8), `INSCOMP` `N` 10, `INSPLAN` `N` 4, `INSURED` `C` 15, `COMP` `N` 1, `CLMNO` `N` 10, **`NOTE` `M` 4**, `CLAIMNUM` `C` 15.

**Use:** Explains **`PLANNUM`** on `OPERTBL` / `TRANS` but is **insurance- and payment-adjacent**. Defer dedicated routes until ledger policy exists; **`NOTE`** and **`INSURED`** are **high sensitivity**.

---

## 6. Recommended next API routes (documentation only — **not implemented here**)

All routes assume **localhost / staff auth later**, strict caps, no full-row logging, and **GET-only** Phase 1 rules from `docs/master-build-plan.md`.

| Route | Purpose | Primary tables | First-pass safety notes |
|-------|---------|----------------|---------------------------|
| `GET /v1/reference/doctors` | Map `DOCT` / `DOC_ID` to display | `DOCTORS` | Return **`doctorId`** + optional **`displayName`** only; block PII columns. |
| `GET /v1/reference/procedures` | Map `PROCNB` to labels | `PROCCHRT` (+ later `PROCINIT` / others) | Return **`procedureCode`** + **`label`** + low-risk flags; **block all `PRICE*`** fields. |
| `GET /v1/patients/:patientId/appointments` | Profile-scoped schedule | `SCHEDULE` | Reuse privacy pattern from `docs/phase-1b-calendar-backend.md`: filter **`PAT_ID`**, **omit** `PAT_NAME`, `TELEPHONE`, `COMMENT` body (boolean `hasComment` only), cap results. |
| `GET /v1/patients/:patientId/treatments` | Procedure history | `OPERTBL` (+ optional `PROCCHRT` join) | Allow **`DATE`**, **`OPNUM`**, **`TOOTHNB`**, **`PROCNB`**, **`STATUS`**, **`DOCT`**, **`TRANSNUM`**, **`PLANNUM`**, surface codes; **block** memos and `DESC` / raw `PROCEDURE` / **all amounts** initially. |
| `GET /v1/patients/:patientId/chart` | Odontogram / tooth state | `CHARTDBF` | See **`docs/phase-1b-dental-chart-mapping.md`**: filter **`ID`**, opaque `*_S` / `*_C` codes, cap rows; **block `NOTE`** memo; list UI before visual grid. |
| `GET /v1/patients/:patientId/ledger` | Financial lines | `TRANS` | **High risk** — first design should avoid **`DESCR`** and raw amounts; consider **deferred** until type enums documented. |
| `GET /v1/patients/:patientId/medical-summary` | Non-text screening flags | `MEDICAL` | **Booleans only**; no `PROBLEM` / `ALLERGY_TO` / `NOTES`. |

---

## 7. Risk ranking and recommended implementation order

**Lowest risk → highest risk**

1. **`GET /v1/reference/doctors`** — tiny table; expose minimal columns; no patient rows.
2. **`GET /v1/reference/procedures`** — static dictionary; **exclude prices**; still business-sensitive.
3. **`GET /v1/patients/:patientId/appointments`** — same domain as existing schedule route; add **`patientId`** filter and identical redaction rules.
4. **`GET /v1/patients/:patientId/medical-summary`** — boolean-only contract; easy to test; avoid stigmatizing display UX in future UI (out of scope here).
5. **`GET /v1/patients/:patientId/treatments`** — structured mostly; **parser risk on `OPERTBL`**; memos and money columns must stay off until reviewed.
6. **`GET /v1/patients/:patientId/ledger`** — **highest** operational and privacy risk (`DESCR` memo, amount semantics, running balance correctness, insurance ids).

**Highest risks (summary):**  
`TRANS.DESCR` memo; **`TRANS` / `OPERTBL` monetary semantics** without legacy spec; **`OPERTBL` header layout + `_NullFlags`**; **patient key width mismatches** (`N` 6 vs `N` 10); **`MEDICAL` free-text and allergy columns**; **`TRETPLAN` insurance + `NOTE` memo** if pulled in too early.

---

## 8. Definition of done (this document)

- Schemas for **OPERTBL**, **TRANS**, **MEDICAL**, **TRETPLAN**, **PROCCHRT**, **DOCTORS** are mapped at **field-name / type** level from the read-only copy.
- Blocked fields and parser/accounting risks are explicit.
- Recommended **route list** and **implementation order** are documented.
- **No** real row values, names, phones, notes, amounts, or medical text appear in this file.

---

*Document version: 1.0 — 2026-05-14. Header parse only; semantics inferred from naming and `docs/legacy-system-map.md` where stated.*
