# Phase 3 — SafeWritePlan contract

**Status:** Contract band (3.1) — Zod schemas and tests only. No bridge write routes or DBF mutation.

**Scope:** Shared response shape for future dry-run and write-enabled mutation routes. Aligns with [phase-3-dry-run-write-plan.md](./phase-3-dry-run-write-plan.md).

---

## Package

Schemas live in `@microdent/contracts`:

- `SafeWritePlanSchema`
- `SafeWritePlanWarningSchema`
- `SafeWritePlanFieldChangeSchema`

Exported types: `SafeWritePlan`, `SafeWritePlanWarning`, `SafeWritePlanFieldChange`.

---

## SafeWritePlan fields

| Field | Type | Notes |
| --- | --- | --- |
| `operationId` | UUID string | Server-generated per mutation request |
| `workflow` | string | Stable id, e.g. `appointment.statusUpdate` |
| `mode` | `disabled` \| `dry-run` \| `enabled` | Bridge `WRITE_MODE` at plan build time |
| `tablesAffected` | string[] | Logical table ids (registry), not paths |
| `recordIds` | string[] | Stringified legacy primary keys |
| `fieldsChanged` | `SafeWritePlanFieldChange[]` | Field names and change type only |
| `backupRequired` | boolean | `true` when enabled commit would need backup |
| `backupWouldCreate` | boolean (optional) | Dry-run hint that enabled mode would create backup dir entry |
| `warnings` | `SafeWritePlanWarning[]` | Operator-safe codes; no PHI |
| `committed` | boolean | `false` for global dry-run; `true` after successful enabled commit |
| `createdAt` | ISO-8601 UTC datetime | Plan timestamp |

### Field change (`fieldsChanged[]`)

| Field | Type |
| --- | --- |
| `table` | string |
| `recordId` | string |
| `field` | string (DBF column name, e.g. `STATUS`) |
| `changeType` | `set` \| `clear` |

**Intentionally omitted:** `before`, `after`, or any value slots. Schemas use `.strict()` so those keys fail validation.

### Warning (`warnings[]`)

| Field | Type |
| --- | --- |
| `code` | string |
| `message` | string (operator-safe English) |
| `severity` | `info` \| `warn` \| `block` |

---

## Wire usage (future)

Successful validation in `WRITE_MODE=dry-run`:

```json
{
  "plan": { "...SafeWritePlan..." },
  "committed": false
}
```

The top-level `committed` duplicates `plan.committed` for clients that only read the envelope. Both must stay consistent when routes ship.

---

## Tests

`packages/contracts/src/safe-write-plan.test.ts`:

- Valid synthetic plan parses
- `before` / `after` on field changes rejected
- Unknown keys rejected (strict objects)

Run: `pnpm --filter @microdent/contracts test`

---

## Non-goals

- No `buildWritePlan()` in bridge yet
- No DBF writes or backup files
- No row values, memos, phones, or payment amounts in API JSON
