# Phase 3.a — Write audit log schema

**Status:** SQLite migration and PHI-safe writer utilities in `@microdent/sqlite-mirror`. No DBF writes, no bridge write routes, no backup executor.

**Related:** `docs/phase-3-audit-log-plan.md`, `docs/phase-2-sqlite-schema.md`

---

## Purpose

Future mutation workflows must leave an **operations audit trail** that answers who attempted what, how (dry-run vs real write), and whether it succeeded — **without** storing patient names, notes, amounts, or row snapshots.

Audit tables live in the **same SQLite file** as the mirror schema (`SQLITE_PATH`). They are separate from `import_runs` / `import_errors`.

---

## Tables

Migration: `services/sqlite-mirror/sql/migrations/007_write_audit.sql`

| Table | Role |
| --- | --- |
| `write_audit_log` | One row per write operation (`operation_id` PK) |
| `write_audit_steps` | Append-only lifecycle timeline per operation |
| `write_errors` | Sanitized failure rows (codes + templated messages only) |

### `write_audit_log`

Parent record. Key columns:

- `operation_id` — UUID string (correlates steps and errors)
- `requested_at` / `finished_at` — ISO-8601 UTC
- `status` — latest lifecycle state (`requested` … `cancelled`)
- `terminal_status` — outcome when finished (`success`, `partial`, `failed`, `restored`, `cancelled`)
- `workflow_type` — e.g. `appointment.update`
- `execution_mode` — `dry_run` \| `real_write`
- `actor_type` / `actor_id` — operator identity when available (never patient identity)
- `target_tables` — JSON array of logical table names
- `target_record_ids` — JSON array of `{ "table", "id" }` only
- `backup_id` — optional link to future backup catalog
- `feature_flags`, `data_root_fingerprint`, `bridge_version`, `app_version` — optional safe metadata

### `write_audit_steps`

Fine-grained steps. `detail_json` may hold counts and opaque tokens only (no row payloads).

### `write_errors`

Parallel to `import_errors`. Multiple errors per operation allowed. `message` must be templated (table + id + code), never PHI.

### Indexes

- `idx_write_audit_log_requested` — `(requested_at DESC)`
- `idx_write_audit_log_workflow` — `(workflow_type, requested_at DESC)`
- `idx_write_audit_log_backup` — partial on `backup_id`
- `idx_write_audit_steps_operation` — `(operation_id, step_id)`
- `idx_write_errors_operation` — `(operation_id)`

Foreign keys: deleting `write_audit_log` cascades steps and errors.

---

## Writer utilities

Package: `@microdent/sqlite-mirror` (`services/sqlite-mirror/src/write-audit.ts`)

| Function | Behavior |
| --- | --- |
| `beginWriteAudit(db, opts)` | Inserts parent row with `status = requested`; returns `operation_id` |
| `addWriteAuditStep(db, opts)` | Inserts step, updates parent `status` (transaction) |
| `finishWriteAudit(db, opts)` | Sets `finished_at`, `terminal_status`, and terminal lifecycle `status` |
| `recordWriteError(db, opts)` | Inserts sanitized error row |

Payload guard (`audit-payload-guard.ts`) rejects forbidden keys anywhere in nested objects passed to writers, and rejects free-text that embeds forbidden JSON key tokens:

`before`, `after`, `rawRow`, `patientName`, `noteText`, `amount`

Violations throw `AuditUnsafePayloadError` before any insert.

---

## Synthetic usage example

```ts
import { applyMigrations, beginWriteAudit, addWriteAuditStep, finishWriteAudit, recordWriteError } from "@microdent/sqlite-mirror";
import { openDatabaseSync } from "@microdent/sqlite-mirror/node-sqlite"; // internal; pass db from caller

applyMigrations(sqlitePath);
const db = openDatabaseSync(sqlitePath);

const operationId = beginWriteAudit(db, {
  workflowType: "appointment.update",
  executionMode: "dry_run",
  targetTables: ["appointments"],
  targetRecordIds: [{ table: "SCHEDULE", id: "88421" }],
  actorType: "user",
  actorId: "usr_synthetic_01",
});

addWriteAuditStep(db, {
  operationId,
  stepName: "validate_targets",
  lifecycleStatus: "validated",
});

addWriteAuditStep(db, {
  operationId,
  stepName: "dry_run_complete",
  lifecycleStatus: "dry_run_generated",
  detailJson: { record_count: 1 },
});

finishWriteAudit(db, { operationId, terminalStatus: "success" });
```

On failure:

```ts
recordWriteError(db, {
  operationId,
  errorCode: "VALIDATION_RECORD_LOCKED",
  message: "Record locked (table=SCHEDULE, id=88421)",
  targetTable: "SCHEDULE",
  targetRecordId: "88421",
});
finishWriteAudit(db, { operationId, terminalStatus: "failed" });
```

---

## What must never be stored

Same policy as `docs/phase-3-audit-log-plan.md` §3: no names, phones, addresses, notes, medical text, payment amounts, credentials, or raw DBF/SQLite rows. When unsure, log **table + id + error_code** only.

---

## Tests

`services/sqlite-mirror/src/write-audit.test.ts`:

- Create audit operation
- Append steps (parent status follows latest step)
- Record sanitized error and finish operation
- Reject forbidden payload keys (nothing persisted on rejection)

Migration coverage: `apply-migrations.test.ts` includes `007_write_audit`.

---

## Bridge read API (operator UI)

`GET /v1/meta/write-audit-recent` returns the latest operations with **safe fields only** (`operationId`, `workflow`, `terminalStatus`, `requestedAt`, `finishedAt`). The sandbox status write pilot uses this after a commit to show whether the operation appears in recent audit metadata — never step `detail_json`, paths, or row payloads.

Implementation: `services/bridge/src/sqlite/write-audit-recent.ts`. Client: `getWriteAuditRecent()` in `@microdent/bridge-client`. UI formatting: `packages/app/src/write-operation-feedback.ts`.

---

## Not implemented (later bands)

- `write_backups` catalog table and backup executor
- Bridge `GET /v1/audit/operations` routes (full operation detail)
- Wiring into real write handlers (Phase 4)
- DBF mutation or `O_RDWR` on production DATA_ROOT

---

## Related docs

- `docs/phase-3-audit-log-plan.md` — full lifecycle and HTTP plan
- `services/sqlite-mirror/sql/migrations/007_write_audit.sql` — source DDL
