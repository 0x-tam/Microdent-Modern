# Phase 3 — Post-write verification

**Status:** Implemented — read-only checks after sandbox writes (no DBF mutation in helpers).

**Related:** [phase-3-appointment-status-dry-run.md](./phase-3-appointment-status-dry-run.md), [phase-3-backup-cli.md](./phase-3-backup-cli.md), [phase-3-audit-log-schema.md](./phase-3-audit-log-schema.md), [phase-3-write-safe-qa-checklist.md](./phase-3-write-safe-qa-checklist.md).

---

## Purpose

After a disposable-sandbox write (e.g. appointment `STATUS` patch), operators and tests need to confirm:

1. Only the intended field changed on the target row.
2. A backup manifest exists for the correlated `operationId`.
3. No other workflow table files were modified unexpectedly.
4. (Optional) A SQLite write-audit parent row exists.

Helpers **never** include row payloads, names, phones, or memo text in thrown errors.

---

## Bridge helpers (`@microdent/bridge`)

Location: `services/bridge/src/write/verify/`

| Helper | Input | Pass | Fail codes (examples) |
|--------|-------|------|-------------------------|
| `verifyAppointmentStatusChanged` | `{ dataRoot, appointmentId, expectedStatus }` | Row exists; `STATUS` matches | `APPOINTMENT_NOT_FOUND`, `APPOINTMENT_STATUS_MISMATCH`, `SCHEDULE_DBF_MISSING` |
| `verifyBackupManifestExists` | `{ backupDir, operationId }` | `manifest.json` under `backupDir` lists `operationId` | `BACKUP_MANIFEST_NOT_FOUND` |
| `snapshotWorkflowFileFingerprints` | `{ dataRoot, workflow }` | Returns `Map<basename, { size, sha256 }>` | `WORKFLOW_FILE_MISSING` |
| `verifyOnlyExpectedFilesChanged` | `{ dataRoot, workflow, baseline, expectedChangedFiles }` | Only listed basenames differ from baseline | `UNEXPECTED_FILE_CHANGED` |

### Appointment status read scope

`readScheduleAppointmentStatus` scans `SCHEDULE.DBF` and uses **only** `ID` and `STATUS`. Mismatch errors cite `appointmentId` and codes only — not `PAT_NAME`, `TELEPHONE`, `COMMENT`, or other columns.

### File-change guard

For `appointment.statusUpdate`, the expected changed set is typically `["SCHEDULE.DBF"]`. Sidecars (`SCHEDULE.FPT`, `SCHEDULE.CDX`) must match the pre-write fingerprint when present.

Capture baseline **before** the write:

```typescript
const baseline = await snapshotWorkflowFileFingerprints({
  dataRoot: sandboxDataRoot,
  workflow: "appointment.statusUpdate",
});
// … perform sandbox write …
await verifyOnlyExpectedFilesChanged({
  dataRoot: sandboxDataRoot,
  workflow: "appointment.statusUpdate",
  baseline,
  expectedChangedFiles: ["SCHEDULE.DBF"],
});
await verifyAppointmentStatusChanged({
  dataRoot: sandboxDataRoot,
  appointmentId: "1001",
  expectedStatus: 3,
});
```

---

## SQLite audit helper (`@microdent/sqlite-mirror`)

| Helper | Input | Pass |
|--------|-------|------|
| `verifyWriteAuditOperationExists` | `(db, operationId)` | Parent row in `write_audit_log` |

Location: `services/sqlite-mirror/src/verify-write-audit.ts`

Use after `beginWriteAudit` / backup / commit steps in a future enabled write path.

---

## Tests

| Package | File |
|---------|------|
| bridge | `services/bridge/src/write/verify/post-write-verification.test.ts` |
| sqlite-mirror | `services/sqlite-mirror/src/verify-write-audit.test.ts` |

Synthetic `SCHEDULE.DBF` fixtures only (`SYNTHETIC_*_TOKEN_*` strings must not appear in error messages).

---

## Safety

- Verification runs against **disposable** `DATA_ROOT` / `BACKUP_DIR` only in CI and manual QA.
- Do not point helpers at `Microdent-Legacy` or live clinic trees.
- Helpers do not write DBFs; test-only writers live in Vitest files.
