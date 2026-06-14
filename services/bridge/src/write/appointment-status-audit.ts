import type { BridgeConfig } from "../config.js";
import { openDatabaseSync } from "../sqlite/node-sqlite.js";
import { APPOINTMENT_STATUS_UPDATE_WORKFLOW } from "./appointment-status-plan.js";

type AuditHandle = {
  onBackupCreated: (backupId: string) => void;
  onWriteStarted: () => void;
  onSuccess: (backupFolder: string) => void;
  onFailed: (errorCode: string, message: string) => void;
};

type AuditDb = ReturnType<typeof openDatabaseSync>;

function ensureWriteAuditTables(db: AuditDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS write_audit_log (
      operation_id TEXT NOT NULL PRIMARY KEY,
      requested_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      workflow_type TEXT NOT NULL,
      execution_mode TEXT NOT NULL,
      actor_type TEXT,
      actor_id TEXT,
      target_tables TEXT NOT NULL,
      target_record_ids TEXT NOT NULL,
      backup_id TEXT,
      terminal_status TEXT,
      record_count INTEGER,
      client_request_id TEXT,
      feature_flags TEXT,
      data_root_fingerprint TEXT,
      bridge_version TEXT,
      app_version TEXT
    );
    CREATE TABLE IF NOT EXISTS write_audit_steps (
      step_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      operation_id TEXT NOT NULL REFERENCES write_audit_log (operation_id) ON DELETE CASCADE,
      step_name TEXT NOT NULL,
      lifecycle_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      duration_ms INTEGER,
      detail_code TEXT,
      detail_json TEXT
    );
    CREATE TABLE IF NOT EXISTS write_errors (
      error_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      operation_id TEXT NOT NULL REFERENCES write_audit_log (operation_id) ON DELETE CASCADE,
      step_id INTEGER REFERENCES write_audit_steps (step_id) ON DELETE SET NULL,
      error_code TEXT NOT NULL,
      message TEXT NOT NULL,
      target_table TEXT,
      target_record_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_write_audit_log_requested
      ON write_audit_log (requested_at DESC);
    CREATE INDEX IF NOT EXISTS idx_write_audit_log_workflow
      ON write_audit_log (workflow_type, requested_at DESC);
    CREATE INDEX IF NOT EXISTS idx_write_audit_steps_operation
      ON write_audit_steps (operation_id, step_id);
    CREATE INDEX IF NOT EXISTS idx_write_errors_operation
      ON write_errors (operation_id);
  `);
}

function beginAudit(
  db: AuditDb,
  input: { operationId: string; appointmentId: string; executionMode: "dry_run" | "real_write" },
): void {
  db.prepare(
    `INSERT INTO write_audit_log (
      operation_id, requested_at, status, workflow_type, execution_mode, target_tables, target_record_ids
    ) VALUES (?, ?, 'requested', ?, ?, ?, ?)`,
  ).run(
    input.operationId,
    new Date().toISOString(),
    APPOINTMENT_STATUS_UPDATE_WORKFLOW,
    input.executionMode,
    JSON.stringify(["SCHEDULE"]),
    JSON.stringify([{ table: "SCHEDULE", id: input.appointmentId }]),
  );
}

function addAuditStep(
  db: AuditDb,
  operationId: string,
  stepName: string,
  lifecycleStatus: string,
  detailCode: string | null = null,
  detailJson: Record<string, unknown> | null = null,
): void {
  db.prepare(
    `INSERT INTO write_audit_steps (
      operation_id, step_name, lifecycle_status, created_at, duration_ms, detail_code, detail_json
    ) VALUES (?, ?, ?, ?, NULL, ?, ?)`,
  ).run(
    operationId,
    stepName,
    lifecycleStatus,
    new Date().toISOString(),
    detailCode,
    detailJson === null ? null : JSON.stringify(detailJson),
  );
  db.prepare(`UPDATE write_audit_log SET status = ? WHERE operation_id = ?`).run(
    lifecycleStatus,
    operationId,
  );
}

function finishAudit(db: AuditDb, operationId: string, terminalStatus: "success" | "failed"): void {
  db.prepare(
    `UPDATE write_audit_log SET
      finished_at = ?,
      terminal_status = ?,
      status = ?,
      record_count = COALESCE(?, record_count)
    WHERE operation_id = ?`,
  ).run(
    new Date().toISOString(),
    terminalStatus,
    terminalStatus === "success" ? "write_finished" : "failed",
    terminalStatus === "success" ? 1 : null,
    operationId,
  );
}

function recordAuditError(
  db: AuditDb,
  operationId: string,
  errorCode: string,
  message: string,
  appointmentId: string,
): void {
  db.prepare(
    `INSERT INTO write_errors (
      operation_id, step_id, error_code, message, target_table, target_record_id, created_at
    ) VALUES (?, NULL, ?, ?, 'SCHEDULE', ?, ?)`,
  ).run(operationId, errorCode, message, appointmentId, new Date().toISOString());
}

export function tryRecordAppointmentStatusAudit(
  bridgeConfig: BridgeConfig,
  input: { operationId: string; appointmentId: string; executionMode: "dry_run" | "real_write" },
): AuditHandle | null {
  if (!bridgeConfig.sqlitePath.configured) {
    return null;
  }

  try {
    const db = openDatabaseSync(bridgeConfig.sqlitePath.path);
    ensureWriteAuditTables(db);
    beginAudit(db, input);
    addAuditStep(db, input.operationId, "write.requested", "requested");

    return {
      onBackupCreated(backupId: string) {
        addAuditStep(db, input.operationId, "write.backup_created", "backup_created", "backup_id", {
          backupId,
        });
      },
      onWriteStarted() {
        addAuditStep(db, input.operationId, "write.started", "write_started");
      },
      onSuccess(backupFolder: string) {
        addAuditStep(db, input.operationId, "write.finished", "write_finished", "backup_folder", {
          backupFolder,
        });
        finishAudit(db, input.operationId, "success");
      },
      onFailed(errorCode: string, message: string) {
        recordAuditError(db, input.operationId, errorCode, message, input.appointmentId);
        finishAudit(db, input.operationId, "failed");
      },
    };
  } catch {
    return null;
  }
}
