# Phase 1b — Ledger / payments mapping (`TRANS.DBF`)

**Purpose:** Safe implementation plan for a read-only patient ledger from **`TRANS.DBF`** before any bridge route, contract, or UI work. **Schema and field semantics only** — no route implementation in this document.

**Scope:** Field names, FoxPro/VFP types (DBF headers), widths/decimals, row counts on the inspected copy, join keys, blocked columns, recommended first DTO, route shape, caps, implementation order, and required tests.

**Out of scope here:** Bridge code, Zod contracts, React panels, amount posting, running-balance guarantees, or opening **`_transto.DBF`** in the first route.

**Related docs:** `docs/phase-1b-next-modules-mapping.md` §2, `docs/legacy-system-map.md` §3.5, `docs/master-build-plan.md` §2.3 / Phase 1E, `docs/phase-1b-patient-profile-backend.md`, `docs/phase-1b-treatments-backend-spike.md`, `docs/phase-1b-medical-summary-backend.md`.

**Data source (read-only):** DBF headers parsed with a **stdlib-only** binary read (no row payloads) from:

`/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA/{TRANS,TRETPLAN,PATIENT}.DBF`

Cross-checks: `docs/legacy-system-map.md` (counts from a different tree snapshot may differ slightly).

---

## 0. Copy-specific metadata (no row values)

| Artifact | Notes |
|----------|--------|
| **`TRANS.DBF`** | Header `0xF5` (Visual FoxPro); **343,998** active rows (header count); record length **102** bytes; **16** fields; paired **`TRANS.FPT`** (memo) and **`TRANS.CDX`** present — copy **DBF + FPT + CDX** together. |
| **`TRETPLAN.DBF`** | Header `0x30`; **56,056** rows; **18** logical fields (see §5); plan/insurance context for **`PLANNUM`**. |
| **`PATIENT.DBF`** | Header `0xF5`; **18,347** rows; **`ID`** `N` 10 — profile/search key; financial-adjacent columns exist but stay **blocked** on ledger routes (§6). |

Legacy map also lists **`_transto.DBF`** (~156k rows) as a transaction shadow with **`NAME`**, **`CASENB`**, and memo **`DESCR`** — **do not** use for the first patient ledger API (§8).

---

## 1. `TRANS.DBF` — full field inventory

| Field | Type | Len / dec | Role (inferred) |
|-------|------|-----------|-----------------|
| **`PATIENT_ID`** | `N` | 6,0 | Patient filter / join to **`PATIENT.ID`** (see §2). |
| **`TRANS_NB`** | `N` | 10,0 | Line primary key; target of **`OPERTBL.TRANSNUM`** when posted. |
| **`DATE`** | `D` | 8 | Transaction date (FoxPro `D`). |
| **`AMOUNT`** | `N` | 13,4 | Primary monetary amount (sign/role depends on type codes — §4). |
| **`SAMOUNT`** | `N` | 13,4 | Secondary amount (split/tax/shadow — **SME confirm**). |
| **`CH_TYPE`** | `N` | 1,0 | Charge type code. |
| **`ADJ_TYPE`** | `N` | 1,0 | Adjustment type code. |
| **`PAY_TYPE`** | `N` | 4,0 | Payment instrument / category code. |
| **`CARD`** | `L` | 1 | Card / electronic-payment flag (name only). |
| **`MONTH`** | `N` | 2,0 | Period month (denormalized reporting). |
| **`YEAR`** | `N` | 4,0 | Period year (denormalized reporting). |
| **`QUANTITY`** | `N` | 4,0 | Quantity (may apply to multi-unit charges). |
| **`DOCT`** | `N` | 4,0 | Provider index (width differs from **`OPERTBL.DOCT`** `N` 2 — do not assume one join shape). |
| **`PLANNUM`** | `N` | 10,0 | Treatment-plan / insurance-plan bucket; joins **`TRETPLAN.PLANNUM`**. |
| **`INSPAYNO`** | `N` | 10,0 | Insurance payment / remittance reference id. |
| **`DESCR`** | `M` | 10 | Memo — ledger narrative (highest text risk). |

There is **no** stored “running balance”, “patient balance”, or “amount due” column in this header. Any balance in Modern is **derived** and must be labeled unofficial until reconciled with legacy reports.

---

## 2. Patient reference (`PATIENT_ID` → `PATIENT.ID`)

| Topic | Guidance |
|-------|----------|
| **Ledger filter column** | **`TRANS.PATIENT_ID`** (`N` 6,0). |
| **Profile / search key** | **`PATIENT.ID`** (`N` 10,0) — same string rules as existing patient routes (`^[1-9]\d{0,14}$`, no leading zeros). |
| **Matching rule (recommended)** | Compare **stringified integers** (same approach as **`MEDICAL.PATIENT_ID`** and treatments **`OPERTBL.ID`**). |
| **Width mismatch risk** | Legacy may store the same numeric id in `N` 6 vs `N` 10; leading-zero or padding mismatches can **drop rows** without logging row contents. Validate with **orphan counts on a copy**, not sample dumps. |
| **`PATIENT.DBF` on ledger route** | **Do not** open patient rows for ledger listing (avoids accidental exposure of **`NAME`**, phones, **`LAST_PAY`**, memos). Path **`patientId`** is the only patient identifier in v1 responses. |

---

## 3. Transaction id / keys and cross-table links

| Key | Usage |
|-----|--------|
| **`TRANS_NB`** | Stable line id for API (`ledgerEntryId`); sort tie-breaker after **`DATE`**. |
| **`OPERTBL.TRANSNUM`** | Procedure line → ledger line when financially posted; handle **zero / missing** links (unposted procedures) without assuming 1:1 coverage. |
| **`PLANNUM`** | Links to **`TRETPLAN`** and appears on **`OPERTBL`**; insurance-adjacent — **block in first ledger DTO** (§7). |
| **`INSPAYNO`** | Insurance remittance reference — **block first** (re-identification with other tables). |

---

## 4. Dates and charge / payment / adjustment classification

### 4.1 Dates

| Field | Safe first pass |
|-------|-----------------|
| **`DATE`** | Expose as ISO `YYYY-MM-DD` when readable. |
| **`MONTH`**, **`YEAR`** | Optional opaque integers for reporting filters later; **omit** in v1 DTO unless product needs period chips (low value vs **`DATE`**). |

**Sort order (recommended):** `DATE` descending, then **`TRANS_NB`** descending (matches treatments/appointments “newest first” patterns).

### 4.2 Type codes (semantics unknown — treat as opaque)

| Field | Width | Inferred role |
|-------|-------|----------------|
| **`CH_TYPE`** | `N` 1 | Charge category. |
| **`ADJ_TYPE`** | `N` 1 | Adjustment category. |
| **`PAY_TYPE`** | `N` 4 | Payment method / payment category. |
| **`CARD`** | `L` 1 | Non-text payment-channel hint. |

**Risk:** Legacy UI likely combines **`CH_TYPE`**, **`ADJ_TYPE`**, **`PAY_TYPE`**, and sign of **`AMOUNT`** / **`SAMOUNT`** to decide debit vs credit vs payment vs adjustment. Publishing **raw amounts** before an SME documents these enums can **invert** charges and payments in the UI.

**First safe pass:** expose **numeric codes only** (or a single derived **`entryKind`** enum only after a verified codebook exists on a **copy** with aggregate counts per code — still **no** sample rows in docs).

### 4.3 Amount fields

| Field | First-pass policy |
|-------|-------------------|
| **`AMOUNT`** | **Block** from JSON until type semantics and sign rules are documented. |
| **`SAMOUNT`** | **Block** (same). |

Optional later phase: return amounts only with **`entryKind`**, fixed decimal string formatting, and explicit “informational / not official balance” disclaimer in API and UI.

---

## 5. `TRETPLAN.DBF` — context for `PLANNUM` (not a first route)

Read-only header on the same copy (**18** fields):

| Field | Type | Notes |
|-------|------|--------|
| `ID` | `N` 10 | Patient id on plan rows (not the same name as **`TRANS.PATIENT_ID`**). |
| `DATE` | `T` 8 | **DateTime** — timezone/parser care if ever exposed. |
| `PLANNUM` | `N` 10 | Join key shared with **`TRANS`** / **`OPERTBL`**. |
| `DEBIT` | `N` 10 | Plan debit reference (not **`TRANS.AMOUNT`**). |
| `DESCR` | `C` 30 | Short plan description text — **block**. |
| `INS_PAY`, `TOT_PAY`, `COP_PER` | `Y` 8,4 | Currency — **block**. |
| `INSCOMP`, `INSPLAN`, `CLMNO`, `CLAIMNUM` | various | Insurance identifiers — **block first**. |
| `INSURED` | `C` 15 | Insured-party text — **block first**. |
| `NOTE` | `M` 4 | Memo — **block**. |
| `SL_INS`, `PROCESS`, `BATCH` | `L` 1 | Flags — low text risk but defer until ledger policy exists. |

**Use in Phase 1b:** Explain why **`TRANS.PLANNUM`** and **`INSPAYNO`** stay off the wire; do **not** join **`TRETPLAN`** in the first ledger route.

---

## 6. `PATIENT.DBF` — relationship context only

Fields relevant to ledger **design** (never returned from **`GET .../ledger`**):

| Field | Type | Why it matters |
|-------|------|----------------|
| **`ID`** | `N` 10 | Canonical **`patientId`** for path param. |
| **`CASENB`** | `C` 15 | Chart number — already on profile/search where allowed; **not** needed per ledger line. |
| **`LAST_PAY`** | `N` 13,4 | Last payment amount on master record — **block** (duplicate/conflicting with derived ledger). |
| **`LAST_PDATE`** | `D` 8 | Last payment date — **block** on ledger route (use line **`DATE`** only when amounts are approved). |
| **`INSID`** | `N` 10 | Insurance profile pointer — **block**; insurance-first policy (§7). |
| **`DOCTOR_NB`** | `N` 10 | Default provider — unrelated to per-line **`TRANS.DOCT`**. |

All name, address, phone, memo, and SS-like columns remain out of scope (see `docs/phase-1b-patient-profile-backend.md`).

---

## 7. Fields to explicitly block (first ledger API)

### 7.1 Must never appear in v1 JSON or logs

| Source | Fields |
|--------|--------|
| **`TRANS`** | **`DESCR`** (memo body), **`AMOUNT`**, **`SAMOUNT`**, raw row maps |
| **`TRANS`** (identifiers) | **`INSPAYNO`**, **`PLANNUM`** (insurance/plan episode linkage) |
| **`TRETPLAN`** (if joined later) | **`NOTE`**, **`DESCR`**, **`INSURED`**, **`CLAIMNUM`**, all **`Y`** currency columns, **`INSCOMP`**, **`INSPLAN`**, **`CLMNO`** |
| **`PATIENT`** | Any column if patient table were opened — especially **`NAME`**, phones, addresses, **`QUICKNOTE`**, **`PAT_M_COMP`**, **`LAST_PAY`**, **`INSID`** |
| **`_transto`** | Entire table for v1 — includes **`NAME`**, **`CASENB`**, **`DESCR`**, **`TYPE_DESC`** |

### 7.2 Insurance-related — block before clinical/financial text

Per product safety: **`INSPAYNO`**, **`PLANNUM`**, and any future **`TRETPLAN`** / **`PAT_INS`** joins stay off until insurance display policy exists. Do not expose insurance narrative or remittance ids ahead of memo blocking.

### 7.3 Memo / free-text — blocked

| Field | Table | Type |
|-------|-------|------|
| **`DESCR`** | `TRANS` | `M` 10 |
| **`NOTE`** | `TRETPLAN` | `M` 4 |
| **`DESCR`** | `TRETPLAN` | `C` 30 |

**Allowed pattern (mirror treatments):** boolean **`hasDescription`** — true when memo field is non-empty; **never** return memo text.

### 7.4 Deferred (optional later, still sensitive)

| Field | Notes |
|-------|--------|
| **`DOCT`** | Opaque **`doctorId`** only after reference route policy; no staff PII from **`DOCTORS`**. |
| **`QUANTITY`** | Usually low risk; omit until amount policy exists. |
| **`MONTH`**, **`YEAR`** | Reporting only. |

---

## 8. Balance and accounting correctness risks

| Risk | Detail | Mitigation |
|------|--------|------------|
| **No balance column** | Running balance is computed from ordered lines + legacy business rules. | Do **not** show “Balance” in v1; if ever added, label **informational / not official**. |
| **Type code ambiguity** | Wrong mapping of **`CH_TYPE`** / **`ADJ_TYPE`** / **`PAY_TYPE`** flips debits/credits. | Ship **codes only** or defer amounts entirely until codebook exists. |
| **Dual amounts** | **`SAMOUNT`** may adjust totals. | Block both until semantics documented. |
| **Deleted rows** | Soft-deleted **`TRANS`** rows (~468 deleted in legacy map snapshot). | Skip deleted records in reader (same as schedule/patient routes). |
| **Unposted procedures** | **`OPERTBL.TRANSNUM`** may be zero or stale. | Do not infer ledger completeness from procedures tab. |
| **`ADJUST.DBF`** | Listed as **header parse failure** in legacy map. | Do not fold adjustments from unparsed tables into Modern totals. |
| **`_transto` pipeline** | Parallel transaction store with denormalized names. | Out of scope for v1; avoids duplicate/conflicting lines. |
| **Full-table scan** | ~344k rows; per-patient scan is O(n) without CDX seek. | Hard **cap** + `truncated` flag; plan SQLite mirror (Phase 2). |
| **Memo side effects** | Reading **`DESCR`** may touch **`.FPT`**. | Use presence check only; never log memo bytes. |
| **Profile `LAST_PAY`** | Single aggregate on **`PATIENT`** may disagree with sum of **`TRANS`**. | Never expose on ledger route. |

---

## 9. Recommended first safe DTO (v1)

**Route (documentation only):** `GET /v1/patients/:patientId/ledger`

**Response shape (conceptual):**

```json
{
  "entries": [ /* LedgerEntryV1 */ ],
  "truncated": false,
  "privacyNote": "…fixed literal…"
}
```

**`LedgerEntryV1` fields (allow-list):**

| JSON field | Source | Notes |
|------------|--------|--------|
| `ledgerEntryId` | `TRANS_NB` | Stringified integer. |
| `patientId` | path | Echo only. |
| `date` | `DATE` | `YYYY-MM-DD` or `null` if unreadable. |
| `chargeTypeCode` | `CH_TYPE` | Number or `null`; opaque. |
| `adjustmentTypeCode` | `ADJ_TYPE` | Number or `null`; opaque. |
| `paymentTypeCode` | `PAY_TYPE` | Number or `null`; opaque. |
| `isCardPayment` | `CARD` | Boolean or `null`. |
| `hasDescription` | `DESCR` | Boolean only — memo never returned. |

**Explicitly omit from v1:** `amount`, `secondaryAmount`, `planNumber`, `insurancePaymentNumber`, `doctorId`, `quantity`, `month`, `year`, `runningBalance`, `description`, any string from **`TRETPLAN`** or **`PATIENT`**.

**HTTP errors (align with other patient routes):**

| Status | Code (suggested) |
|--------|------------------|
| 400 | `INVALID_PATIENT_ID` |
| 404 | `TRANS_DBF_NOT_FOUND` |
| 503 | `DATA_ROOT_NOT_CONFIGURED` |
| 500 | `PATIENT_LEDGER_ERROR` (generic; no row logging) |

**v2 (requires SME + legal):** Add `amount` / `secondaryAmount` with documented sign rules and `entryKind` enum; optional `doctorId` via reference join; still **no** `DESCR` text.

---

## 10. Route shape, scan, and result cap

| Topic | Recommendation |
|-------|----------------|
| **Path** | `GET /v1/patients/:patientId/ledger` |
| **Query params (v1)** | None required; optional `?limit=` **not** recommended until caps are fixed in contract. |
| **Filter** | Sequential scan of **`TRANS.DBF`**, `PATIENT_ID` match, skip deleted. |
| **Cap** | **100** entries per patient (stricter than treatments’ 200 because financial rows are higher risk and patients can have long histories). Set **`truncated: true`** when cap hit. |
| **Sort** | `date` desc, `ledgerEntryId` desc. |
| **Parser** | Header `0xF5` — use same **`dbffile`** + `readMode: "loose"` + `win1252` pattern as **`MEDICAL`** / **`TRANS`** smoke tests before production; validate memo presence without returning text. |
| **Logging** | Row counts and timings only; never log **`DESCR`**, amounts, or patient ids in bulk debug. |

---

## 11. Recommended implementation order

1. **This mapping doc** — SME review of type codes on a **private copy** (aggregate counts only, no pasted rows).
2. **`packages/contracts`** — `PatientLedgerResponseSchema` / `LedgerEntryV1` strict allow-list (no amount fields).
3. **Synthetic `TRANS.DBF` fixture** — fake ids and codes only; decoy memo/amount columns in fixture to assert absence in JSON.
4. **`services/bridge`** reader + route — `GET /v1/patients/:patientId/ledger` only; no UI.
5. **`packages/bridge-client`** — `getPatientLedger(patientId)`.
6. **Optional reference join** — `DOCT` → `GET /v1/reference/doctors` (ids + display names policy) only after ledger v1 is stable.
7. **Amount + `entryKind` phase** — separate change request with codebook doc and accountant sign-off.
8. **UI (`PatientProfilePanel` Payments tab)** — only after contract tests pass; show codes + dates + “amounts hidden” banner in read-only mode.
9. **Phase 2 mirror** — `ledger_entries` table last (`docs/phase-2-sqlite-mirror-plan.md`).

**Do not implement before treatments + medical-summary patterns are stable:** ledger is **highest** privacy and correctness risk in the patient profile band (`docs/phase-1b-next-modules-mapping.md` §7).

---

## 12. Tests to require later (no implementation here)

| Test | Assert |
|------|--------|
| **Happy path** | Synthetic `TRANS` rows for one `PATIENT_ID`; 200 + ordered `entries`. |
| **Privacy** | JSON does not contain substring fixtures for memo text, blocked names, or numeric amount literals planted in **`AMOUNT`** / **`SAMOUNT`**. |
| **`hasDescription`** | `true` when memo populated; response still has **no** description field. |
| **Cap** | >100 matching rows → `truncated: true` and exactly 100 entries. |
| **Deleted rows** | Soft-deleted lines excluded. |
| **Patient id** | `PATIENT_ID` `6` vs path `patientId` `"12345"` string match behavior documented in test. |
| **Missing file** | `TRANS_DBF_NOT_FOUND` when basename absent. |
| **Invalid id** | `INVALID_PATIENT_ID` for `0`, leading zeros, non-numeric. |
| **No patient table read** | Spy/mock: ledger handler does not open **`PATIENT.DBF`**. |
| **Client** | `getPatientLedger` URL and Zod parse of strict response. |

---

## 13. Definition of done (this document)

- [x] **`TRANS.DBF`** fields mapped at name/type level from read-only copy headers.
- [x] Patient key, transaction key, dates, amounts, type codes, balance risks, and blocked fields documented.
- [x] Insurance and memo fields **blocked first**.
- [x] Recommended **v1 DTO** and **`GET /v1/patients/:patientId/ledger`** documented without implementing the route.
- [x] **No** real row values, amounts, patient names, notes, or raw rows in this file.

---

*Document version: 1.0 — 2026-05-15. Header parse only; amount/type semantics require SME confirmation on a private copy.*
