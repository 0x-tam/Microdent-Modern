import { randomUUID } from "node:crypto";
import type { SqliteDatabase } from "./node-sqlite.js";
import {
  assertSafeAuditPayload,
  assertSafeAuditText,
  stringifySafeAuditJson,
} from "./audit-payload-guard.js";

export type WriteExecutionMode = "dry_run" | "real_write";
export type WriteActorType = "user" | "session" | "service" | "cli" | "unknown";
export type WriteAuditLifecycleStatus =
  | "requested"
  | "validated"
  | "backup_created"
  | "dry_run_generated"
  | "write_started"
  | "write_finished"
  | "failed"
  | "restored"
  | "cancelled";
export type WriteAuditTerminalStatus = "success" | "partial" | "failed" | "restored" | "cancelled";

export type WriteAuditTargetRecordId = {
  table: string;
  id: string;
};

export type BeginWriteAuditOptions = {
  workflowType: string;
  executionMode: WriteExecutionMode;
  targetTables: readonly string[];
  targetRecordIds: readonly WriteAuditTargetRecordId[];
  actorType?: WriteActorType | null;
  actorId?: string | null;
  backupId?: string | null;
  clientRequestId?: string | null;
  featureFlags?: Record<string, boolean> | null;
  dataRootFingerprint?: string | null;
  bridgeVersion?: string | null;
  appVersion?: string | null;
  operationId?: string;
};

export type AddWriteAuditStepOptions = {
  operationId: string;
  stepName: string;
  lifecycleStatus: WriteAuditLifecycleStatus;
  durationMs?: number | null;
  detailCode?: string | null;
  detailJson?: Record<string, unknown> | null;
};

export type FinishWriteAuditOptions = {
  operationId: string;
  terminalStatus: WriteAuditTerminalStatus;
  status?: WriteAuditLifecycleStatus;
  recordCount?: number | null;
};

export type RecordWriteErrorOptions = {
  operationId: string;
  errorCode: string;
  message: string;
  stepId?: number | null;
  targetTable?: string | null;
  targetRecordId?: string | null;
};

function withTransaction(db: SqliteDatabase, fn: () => void): void {
  db.exec("BEGIN IMMEDIATE;");
  try {
    fn();
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

function validateTargetRecordIds(targetRecordIds: readonly WriteAuditTargetRecordId[]): void {
  assertSafeAuditPayload(targetRecordIds, "targetRecordIds");
  for (const [index, record] of targetRecordIds.entries()) {
    if (typeof record.table !== "string" || typeof record.id !== "string") {
      throw new Error(`targetRecordIds[${index}] requires string table and id`);
    }
    assertSafeAuditText(record.table, `targetRecordIds[${index}].table`);
    assertSafeAuditText(record.id, `targetRecordIds[${index}].id`);
  }
}

/**
 * Creates a write audit parent row in `requested` state. Returns the operation id.
 */
export function beginWriteAudit(db: SqliteDatabase, opts: BeginWriteAuditOptions): string {
  const operationId = opts.operationId ?? randomUUID();
  validateTargetRecordIds(opts.targetRecordIds);
  assertSafeAuditPayload(opts.targetTables, "targetTables");

  if (opts.featureFlags !== undefined && opts.featureFlags !== null) {
    assertSafeAuditPayload(opts.featureFlags, "featureFlags");
  }

  const requestedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO write_audit_log (
      operation_id, requested_at, status, workflow_type, execution_mode,
      actor_type, actor_id, target_tables, target_record_ids, backup_id,
      client_request_id, feature_flags, data_root_fingerprint, bridge_version, app_version
    ) VALUES (?, ?, 'requested', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    operationId,
    requestedAt,
    opts.workflowType,
    opts.executionMode,
    opts.actorType ?? null,
    opts.actorId ?? null,
    JSON.stringify([...opts.targetTables]),
    JSON.stringify([...opts.targetRecordIds]),
    opts.backupId ?? null,
    opts.clientRequestId ?? null,
    opts.featureFlags !== undefined && opts.featureFlags !== null
      ? stringifySafeAuditJson(opts.featureFlags, "featureFlags")
      : null,
    opts.dataRootFingerprint ?? null,
    opts.bridgeVersion ?? null,
    opts.appVersion ?? null,
  );

  return operationId;
}

/**
 * Appends a timeline step and updates the parent lifecycle status.
 */
export function addWriteAuditStep(db: SqliteDatabase, opts: AddWriteAuditStepOptions): number {
  assertSafeAuditText(opts.stepName, "stepName");
  if (opts.detailCode !== undefined && opts.detailCode !== null) {
    assertSafeAuditText(opts.detailCode, "detailCode");
  }

  const detailJson =
    opts.detailJson !== undefined && opts.detailJson !== null
      ? stringifySafeAuditJson(opts.detailJson, "detailJson")
      : null;

  let stepId = 0;
  const createdAt = new Date().toISOString();

  withTransaction(db, () => {
    const insert = db
      .prepare(
        `INSERT INTO write_audit_steps (
          operation_id, step_name, lifecycle_status, created_at, duration_ms, detail_code, detail_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        opts.operationId,
        opts.stepName,
        opts.lifecycleStatus,
        createdAt,
        opts.durationMs ?? null,
        opts.detailCode ?? null,
        detailJson,
      );
    stepId = Number(insert.lastInsertRowid);

    db.prepare(`UPDATE write_audit_log SET status = ? WHERE operation_id = ?`).run(
      opts.lifecycleStatus,
      opts.operationId,
    );
  });

  return stepId;
}

/**
 * Marks the operation finished with a terminal outcome.
 */
export function finishWriteAudit(db: SqliteDatabase, opts: FinishWriteAuditOptions): void {
  const finishedAt = new Date().toISOString();
  const status = opts.status ?? terminalLifecycleStatus(opts.terminalStatus);

  db.prepare(
    `UPDATE write_audit_log SET
      finished_at = ?,
      terminal_status = ?,
      status = ?,
      record_count = COALESCE(?, record_count)
    WHERE operation_id = ?`,
  ).run(
    finishedAt,
    opts.terminalStatus,
    status,
    opts.recordCount ?? null,
    opts.operationId,
  );
}

/**
 * Records a sanitized error row linked to an operation (no cell values).
 */
export function recordWriteError(db: SqliteDatabase, opts: RecordWriteErrorOptions): number {
  assertSafeAuditText(opts.errorCode, "errorCode");
  assertSafeAuditText(opts.message, "message");
  if (opts.targetTable !== undefined && opts.targetTable !== null) {
    assertSafeAuditText(opts.targetTable, "targetTable");
  }
  if (opts.targetRecordId !== undefined && opts.targetRecordId !== null) {
    assertSafeAuditText(opts.targetRecordId, "targetRecordId");
  }

  const result = db
    .prepare(
      `INSERT INTO write_errors (
        operation_id, step_id, error_code, message, target_table, target_record_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      opts.operationId,
      opts.stepId ?? null,
      opts.errorCode,
      opts.message,
      opts.targetTable ?? null,
      opts.targetRecordId ?? null,
      new Date().toISOString(),
    );

  return Number(result.lastInsertRowid);
}

function terminalLifecycleStatus(
  terminalStatus: WriteAuditTerminalStatus,
): WriteAuditLifecycleStatus {
  switch (terminalStatus) {
    case "success":
    case "partial":
      return "write_finished";
    case "failed":
      return "failed";
    case "restored":
      return "restored";
    case "cancelled":
      return "cancelled";
  }
}
