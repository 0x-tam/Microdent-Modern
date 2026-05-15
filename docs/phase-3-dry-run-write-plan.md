# Phase 3 — Dry-run write architecture

**Status:** Design only — no write routes, DBF mutation, or backup implementation in this band.

**Scope:** Define how **future** bridge mutation routes must behave before any real DBF write is permitted. All development and tests use **synthetic fixtures** under a temp `DATA_ROOT`; operators use **`Microdent-Legacy-Copy`** only (read-only). **Do not** modify `Microdent-Legacy`.

**Related:** [master-build-plan.md](./master-build-plan.md) Phase 4 writes posture; [phase-1a-safety-module.md](./phase-1a-safety-module.md) path sandbox; [phase-1b-calendar-backend.md](./phase-1b-calendar-backend.md) / [phase-1b-calendar-mapping.md](./phase-1b-calendar-mapping.md) schedule fields; [phase-2-mirror-import-command.md](./phase-2-mirror-import-command.md) mirror import audit pattern.

---

## 1. What dry-run means

**Dry-run** is a **commit gate** on mutation requests. The bridge runs the **full write pipeline** up to the point of persisting bytes:

1. Authenticate / authorize (when implemented).
2. Resolve targets under `DATA_ROOT` via the path sandbox.
3. **Validate** the request against contracts, legacy field rules, and workflow policy.
4. **Load current row state** in-process only (never returned to the client).
5. Compute the intended **patch** (field-level diff).
6. Decide whether a **backup** is required and whether one already exists for this operation window.
7. Build a **safe write plan** DTO (see §4) describing *what would change*, not *sensitive values*.
8. **Do not** open DBF for write, **do not** call `fs.writeFile` / `unlink` / pack / reindex on legacy paths.

Dry-run answers: *“If we applied this mutation with backups and audit, which files and record keys would change, and are there policy warnings?”* It is **not** a preview of row contents.

**Contrast:**

| Mode | Validates | Returns plan | Touches DBF bytes | Audit row |
| --- | --- | --- | --- | --- |
| `disabled` | No (rejected early) | No | No | Optional reject log only |
| `dry-run` | Yes | Yes (`SafeWritePlan`) | **No** | Yes (`outcome: dry_run`) |
| `enabled` | Yes | Yes (same plan shape, then execute) | Yes (after backup) | Yes (`outcome: committed` / `failed`) |

SQLite mirror imports remain **out of scope** for this plan; mirror DB writes are batch ETL, not clinic operator mutations.

---

## 2. Required environment flags

### `WRITE_MODE`

| Value | Meaning | Default |
| --- | --- | --- |
| `disabled` | All mutation routes return **403** `WRITE_MODE_DISABLED`. No validation of write body beyond schema (optional). | **Yes** — unset env treats as `disabled`. |
| `dry-run` | Mutations run validation + plan generation only. | No |
| `enabled` | Mutations may commit after backup + audit preconditions pass. | No |

**Parsing rules (bridge startup):**

- Read `process.env.WRITE_MODE`; trim; lowercase.
- Missing, empty, or unknown value → **`disabled`** (fail closed).
- Log at startup: `writeMode` enum only — never log mutation payloads.

**Companion flags (Phase 3 implementation, documented here):**

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATA_ROOT` | Absolute path to legacy **copy** tree (existing). Required for any write path resolution. | Unset → writes impossible (503 `DATA_ROOT_NOT_CONFIGURED`). |
| `WRITE_BACKUP_DIR` | Absolute directory for timestamped DBF sidecar copies before `enabled` commits. Must be **outside** `DATA_ROOT` and outside the git repo. | Unset → `enabled` commits **blocked** (503 `WRITE_BACKUP_NOT_CONFIGURED`). |
| `WRITE_AUDIT_LOG` | Absolute path to append-only JSONL audit file. | Unset → `enabled` commits **blocked** (503 `WRITE_AUDIT_NOT_CONFIGURED`). |
| `WRITE_ALLOWED_WORKFLOWS` | Comma-separated allowlist (e.g. `appointment.statusUpdate`). Unlisted workflows → **403** even in dry-run. | Empty → no workflows allowed (fail closed until explicitly enabled in dev). |

**Operator runbook (future):**

```bash
# Safe development default — bridge starts with writes off
export WRITE_MODE=disabled

# Plan-only rehearsal on synthetic or copy DATA_ROOT
export DATA_ROOT="/absolute/path/to/Microdent-Legacy-Copy/DATA"
export WRITE_MODE=dry-run
export WRITE_ALLOWED_WORKFLOWS=appointment.statusUpdate

# Real commit (pilot only, never production without DBA sign-off)
export WRITE_MODE=enabled
export WRITE_BACKUP_DIR="/absolute/path/to/microdent-write-backups"
export WRITE_AUDIT_LOG="/absolute/path/to/microdent-write-audit.jsonl"
```

---

## 3. Route behavior in each mode

All mutation routes are **`POST`** or **`PATCH`** under `/v1/...` (exact paths defined per workflow). Every route accepts optional header:

`X-Write-Intent: dry-run | commit`

When `WRITE_MODE=dry-run`, **`commit` is ignored** (still no file changes). When `WRITE_MODE=disabled`, any mutation → **403** regardless of header.

### `WRITE_MODE=disabled` (default)

| Step | Behavior |
| --- | --- |
| Request hits mutation route | **403** `WRITE_MODE_DISABLED` |
| Body validation | Not required (reject before business logic) |
| File I/O | None |
| Response | `{ error: { code, message } }` per `@microdent/contracts` — no plan |

### `WRITE_MODE=dry-run`

| Step | Behavior |
| --- | --- |
| `DATA_ROOT` unset | **503** `DATA_ROOT_NOT_CONFIGURED` |
| Workflow not in `WRITE_ALLOWED_WORKFLOWS` | **403** `WRITE_WORKFLOW_NOT_ALLOWED` |
| Body fails Zod / domain rules | **400** with safe validation errors (field names, codes — no PHI) |
| Target record not found | **404** workflow-specific code |
| Validation passes | **200** with `{ plan: SafeWritePlan, committed: false }` |
| DBF / FPT / CDX | **Read-only** opens only (existing `openReadOnlyUnderDataRoot`) |
| Backup files | **Not created** in dry-run (plan includes `backupRequired: true` and `backupWouldCreate: true` when enabled would need one) |
| Audit | Append **dry_run** event (operationId, workflow, outcome, counts — no row payloads) |

### `WRITE_MODE=enabled`

| Step | Behavior |
| --- | --- |
| Same gates as dry-run | Plus backup + audit path must be configured |
| `X-Write-Intent: dry-run` on enabled server | Same as dry-run mode behavior (no commit) — allows operators to rehearse on an enabled-capable bridge without flipping global mode |
| `X-Write-Intent: commit` (or omitted, default commit when enabled) | After plan: if `backupRequired` and no valid backup manifest for `operationId` → **409** `WRITE_BACKUP_REQUIRED` |
| Backup step | Copy affected basenames + sidecars (`.CDX`, `.FPT`) to `WRITE_BACKUP_DIR/<operationId>/` with manifest checksum |
| Commit step | Exclusive file lock policy TBD; single-writer; patch only allowlisted fields |
| Success | **200** `{ plan, committed: true, backupManifestId }` |
| Failure after backup | **500** / **409**; backup retained; audit `outcome: failed`; restore procedure (§6) |

**Idempotency:** Clients should send `Idempotency-Key` (or body `clientRequestId`); bridge stores `(workflow, key) → operationId` in audit index to reject duplicate commits.

**HTTP surface (illustrative first workflow):**

- `PATCH /v1/schedule/appointments/:appointmentId/status` — body: `{ status: number }` (opaque int per read API).
- `PATCH /v1/schedule/appointments/:appointmentId/time` — body: `{ date, time, durationSlots?, room? }` — **no comment/memo fields** on this route.

---

## 4. Safe write plan DTO

Returned as `plan` on successful validation (dry-run and enabled). Defined in `@microdent/contracts` as `SafeWritePlanSchema` (future).

```typescript
// Illustrative — implement as Zod in packages/contracts
type SafeWritePlan = {
  operationId: string;       // UUID v4 generated server-side per request
  workflow: string;          // e.g. "appointment.statusUpdate"
  tablesAffected: string[];  // logical ids: "SCHEDULE" → SCHEDULE.DBF (+ sidecars if touched)
  recordIds: string[];       // stringified legacy keys, e.g. appointment "ID"
  fieldsChanged: FieldChange[];
  backupRequired: boolean;
  backupWouldCreate?: boolean; // true when dry-run and enabled would create new backup dir entry
  warnings: WritePlanWarning[];
  committed: boolean;        // always false in global dry-run mode
  createdAt: string;         // ISO-8601 UTC
};

type FieldChange = {
  table: string;             // logical table id
  recordId: string;
  field: string;             // DBF column name only, e.g. "STATUS", "TIME"
  changeType: "set" | "clear";
  // intentionally NO `before` / `after` values in API response
};

type WritePlanWarning = {
  code: string;              // e.g. "STATUS_TRANSITION_UNVERIFIED", "FOXPRO_LOCK_RISK"
  message: string;           // operator-safe English, no PHI
  severity: "info" | "warn" | "block"; // block → enabled mode returns 409, dry-run still returns plan
};
```

**`operationId`:** Correlates validation, backup manifest, audit lines, and restore. Never reuse across distinct client intents.

**`workflow`:** Stable string registered in server allowlist and docs; drives which validators and tables run.

**`tablesAffected`:** Logical registry ids (same as [phase-1b-legacy-catalog.md](./phase-1b-legacy-catalog.md)), not absolute paths in API JSON.

**`recordIds`:** Primary keys only; multiple ids only when a workflow truly touches multiple rows (avoid for v1).

**`fieldsChanged`:** Field **names** and change type only. Example: `{ table: "SCHEDULE", recordId: "42", field: "STATUS", changeType: "set" }`. Server may compute values internally for audit hashing without exposing them.

**`backupRequired`:** `true` for any DBF byte mutation. `false` only for hypothetical future pure-SQLite workflows (not Phase 3).

**`warnings`:** Non-blocking in dry-run unless `severity: "block"` (validation failure).

---

## 5. What dry-run must not include

The plan, validation errors, audit entries, and logs must **never** contain:

| Category | Examples (blocked) |
| --- | --- |
| Raw row snapshots | Full DBF row maps, hex dumps, `before` / `after` objects |
| Medical text | `MEDICAL` problems, allergies, notes; treatment `DESCRIPT` |
| Staff / appointment notes | `SCHEDULE.COMMENT` memo body, `QUICKNOTE`, chart notes |
| Full phones | `TELEPHONE`, `PHN_TEL` — at most `phoneMask` style if ever needed (prefer none on write plans) |
| Payment / ledger amounts | `TRANS` amounts, balances, `FEE_*`, `CHARGE`, insurance dollars |
| Denormalized PHI on schedule | `PAT_NAME` values in plan (use `patId` only) |
| Paths secrets | Absolute `DATA_ROOT`, backup paths in JSON responses (ok in server logs as basenames only) |

**Allowed in plan:** table logical ids, record ids, field names, enum/status **codes** (e.g. status integer), slot counts, room index, date strings (`YYYY-MM-DD`), time pattern metadata (`HH:MM` format validation message without echoing input if policy requires).

---

## 6. How dry-run connects to validation, backup, audit, restore

```text
Client mutation request
        │
        ▼
┌───────────────────┐
│ WRITE_MODE gate   │── disabled ──► 403
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Workflow allowlist│── deny ──► 403
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Zod + domain      │── fail ──► 400 (safe errors)
│ validation        │
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Read-only load    │  sandboxed open; row in memory only
│ target row(s)     │
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Diff → fieldsChanged│  no values in plan DTO
│ + warnings        │
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    │ dry-run   │ enabled + commit
    ▼           ▼
 Audit      Backup manifest
 dry_run    (required files + checksums)
    │           │
    │           ▼
    │      DBF patch + sidecar sync policy
    │           │
    │           ▼
    │      Audit committed | failed
    ▼           ▼
 Return plan   Return plan + backupManifestId
 committed:false   committed:true
```

### Validation

- **Structural:** `@microdent/contracts` request schemas per workflow.
- **Domain:** e.g. status integer in allowlist `{0..5}` per mapping doc; appointment exists; not soft-deleted; date/time format rules; room exists in `SC_ROOM` when room changes.
- **Policy:** FoxPro lock / concurrent legacy EXE warnings as `warnings`, not thrown strings with row data.
- Dry-run and enabled share **one code path** (`buildWritePlan()`) so behavior cannot drift.

### Backup

- Triggered only in **`enabled` + commit** path, after plan accepted and `backupRequired === true`.
- Copy set: for `SCHEDULE` patch, copy `SCHEDULE.DBF` + `SCHEDULE.CDX` + `SCHEDULE.FPT` if memo field could change (status-only workflow: **DBF + CDX** only; time move without comment: same).
- Manifest: `{ operationId, createdAt, files: [{ basename, sha256, size }] }` stored beside copies.
- **Enabled mode impossible** unless backup directory writable and manifest written **before** patch (see §7 tests).

### Audit log

Append-only **JSONL** at `WRITE_AUDIT_LOG`. One line per phase:

| `event` | When | Safe fields |
| --- | --- | --- |
| `write.validated` | Plan built | `operationId`, `workflow`, `recordIds[]`, `fieldNames[]`, `writeMode`, `outcome: dry_run\|pending` |
| `write.backup_started` / `write.backup_completed` | Enabled only | `operationId`, `fileCount`, `manifestId` |
| `write.committed` / `write.failed` | Enabled only | `operationId`, `errorCode` (no stack with row data) |

Align with `import_runs` spirit in [phase-2-mirror-import-command.md](./phase-2-mirror-import-command.md): counts and status, not row payloads.

### Restore

- Operator command (future CLI): `pnpm write:restore --operationId <uuid>` reads backup manifest from `WRITE_BACKUP_DIR`, verifies checksums, copies files back over `DATA_ROOT` targets (requires bridge stopped + legacy EXE not holding locks).
- Dry-run **never** creates restore points; docs must state restore is only available for **enabled** operations that completed `write.backup_completed`.
- Failed commit after backup: restore recommended before retry; audit links `operationId` to manifest path on server only.

---

## 7. Required tests (before first enabled pilot)

All tests use **temp `DATA_ROOT`** with **synthetic** DBFs (fake tokens, no real PHI). No writes to `Microdent-Legacy` or committed repo paths.

| Test | Assertion |
| --- | --- |
| **disabled rejects** | With `WRITE_MODE=disabled` (or unset), `PATCH` mutation → **403** `WRITE_MODE_DISABLED`; mtime/size of fixture DBFs unchanged. |
| **dry-run creates no file changes** | With `WRITE_MODE=dry-run`, valid mutation → **200** + `plan.committed === false`; snapshot fixture directory before/after (hash or mtime); **no** new files under `WRITE_BACKUP_DIR` if set. |
| **enabled requires backup** | With `WRITE_MODE=enabled` and valid mutation but `WRITE_BACKUP_DIR` unset (or backup step mocked to fail) → **409** or **503**; DBF bytes unchanged. |
| **enabled happy path (fixture)** | With backup dir + audit log configured, commit succeeds; manifest exists; audit contains `write.backup_completed` + `write.committed`; only allowlisted fields differ (binary diff or field-level reader). |
| **plan privacy** | Response JSON must not match patterns for memo text, full phone, or amount fields; snapshot test against golden `SafeWritePlan` for synthetic appointment status change. |
| **workflow allowlist** | Disallowed workflow name → **403** in dry-run. |
| **idempotency** | Duplicate `Idempotency-Key` on commit → second request **409** without double patch. |

Run in CI without `DATA_ROOT` pointing at operator copies.

---

## 8. Suggested first workflow

### Primary: `appointment.statusUpdate`

**Route:** `PATCH /v1/schedule/appointments/:appointmentId/status`  
**Body:** `{ "status": <integer> }`  
**Tables affected:** `SCHEDULE` only (`STATUS` field).  
**Why first:**

- Single row, single numeric field — smallest blast radius.
- Read API already exposes `status` opaquely ([phase-1b-calendar-backend.md](./phase-1b-calendar-backend.md)).
- No memo (`COMMENT`), phone, or `PAT_NAME` writes.
- Validation is enumerable (known status codes from mapping doc).
- Easy synthetic fixture: one `SCHEDULE.DBF` row with fake `PAT_ID=0` or test patient id.

**Dry-run plan example (synthetic):**

```json
{
  "plan": {
    "operationId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "workflow": "appointment.statusUpdate",
    "tablesAffected": ["SCHEDULE"],
    "recordIds": ["1001"],
    "fieldsChanged": [
      { "table": "SCHEDULE", "recordId": "1001", "field": "STATUS", "changeType": "set" }
    ],
    "backupRequired": true,
    "backupWouldCreate": true,
    "warnings": [],
    "committed": false,
    "createdAt": "2026-05-15T12:00:00.000Z"
  },
  "committed": false
}
```

### Secondary (after status proven): `appointment.timeMove` (note-free)

**Route:** `PATCH /v1/schedule/appointments/:appointmentId/time`  
**Fields:** `DATE`, `TIME`, optionally `DURATION`, `ROOM` — **explicitly reject** any body key for `COMMENT`, `PAT_NAME`, `TELEPHONE`.  
**Why second:** Slightly higher validation surface (collision detection, room/day rules) but still no memos or payments.

---

## 9. Why patient edits and payment writes should wait

| Area | Risk | Wait until |
| --- | --- | --- |
| **Patient master (`PATIENT.DBF`)** | Broad PHI surface (names, address, DOB, insurance, memos); multi-table consistency (`PAT1`, phones); `IDS` / allocator semantics | Status + time workflows stable; field-level allowlists proven; DBA playbook for master data |
| **Payments / ledger (`TRANS.DBF`)** | Financial integrity, regulatory expectations, paired indexes; amount fields must never appear in plans | Modern ledger DB or dedicated posting service; reconciliation tests; separate `workflow` with stricter roles |
| **Medical / chart / treatments** | Clinical memos, odontogram binary, procedure text | Never first-wave DBF writes; prefer future modern store with import back |
| **Comments / memos** | `COMMENT` M+FPT writes are high PHI and FPT corruption risk | Explicit memo workflow with redaction rules — not bundled with time move |

Patient search/profile APIs deliberately omit editable fields today ([phase-1b-patient-profile-backend.md](./phase-1b-patient-profile-backend.md)). Payment UI remains disabled ([phase-1b-read-only-ui-polish.md](./phase-1b-read-only-ui-polish.md)). Dry-run architecture must not tempt early exposure of blocked columns in `fieldsChanged` value slots.

---

## 10. Implementation order (Phase 3 bands — docs only here)

| Band | Deliverable |
| --- | --- |
| **3.0** | This document + `WRITE_MODE` parsing in bridge config (no routes) |
| **3.1** | `SafeWritePlan` Zod schemas + `buildWritePlan` unit tests with synthetic rows |
| **3.2** | `appointment.statusUpdate` route — dry-run only + audit stub |
| **3.3** | Backup manifest + enabled gate + restore CLI spec |
| **3.4** | `appointment.timeMove` dry-run + enabled behind same gates |
| **3.5** | UI: “Review plan” panel showing plan DTO only; commit button disabled unless `WRITE_MODE=enabled` on bridge |

**Definition of done for 3.0 (this task):**

- [x] `docs/phase-3-dry-run-write-plan.md` exists
- [x] No real write code
- [x] No legacy tree modifications

---

## 11. Non-goals (Phase 3 dry-run band)

- No DBF writer library integration in bridge until backup/audit modules exist.
- No UI that sends real commits to production `DATA_ROOT`.
- No SQLite mirror dual-write on operator mutations.
- No exposure of dry-run plans over non-localhost binding.
- No reads from `Microdent-Legacy` (production) — copy only.
