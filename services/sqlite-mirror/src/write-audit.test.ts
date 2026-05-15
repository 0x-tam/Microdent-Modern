import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { AuditUnsafePayloadError } from "./audit-payload-guard.js";
import { applyMigrations } from "./apply-migrations.js";
import { openDatabaseSync } from "./node-sqlite.js";
import {
  addWriteAuditStep,
  beginWriteAudit,
  finishWriteAudit,
  recordWriteError,
} from "./write-audit.js";

function openMigratedDb(): { dir: string; dbPath: string } {
  const dir = mkdtempSync(join(tmpdir(), "microdent-write-audit-"));
  const dbPath = join(dir, "mirror.sqlite");
  applyMigrations(dbPath);
  return { dir, dbPath };
}

describe("write audit utilities", () => {
  it("can create audit operation", () => {
    const { dir, dbPath } = openMigratedDb();
    const db = openDatabaseSync(dbPath);

    try {
      const operationId = beginWriteAudit(db, {
        workflowType: "appointment.update",
        executionMode: "dry_run",
        targetTables: ["appointments"],
        targetRecordIds: [{ table: "SCHEDULE", id: "88421" }],
        actorType: "cli",
        actorId: "cli:synthetic_01",
      });

      const row = db
        .prepare(
          `SELECT operation_id, status, workflow_type, execution_mode, target_record_ids
           FROM write_audit_log WHERE operation_id = ?`,
        )
        .get(operationId) as {
        operation_id: string;
        status: string;
        workflow_type: string;
        execution_mode: string;
        target_record_ids: string;
      };

      expect(row.operation_id).toBe(operationId);
      expect(row.status).toBe("requested");
      expect(row.workflow_type).toBe("appointment.update");
      expect(row.execution_mode).toBe("dry_run");
      expect(JSON.parse(row.target_record_ids)).toEqual([{ table: "SCHEDULE", id: "88421" }]);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("can append steps", () => {
    const { dir, dbPath } = openMigratedDb();
    const db = openDatabaseSync(dbPath);

    try {
      const operationId = beginWriteAudit(db, {
        workflowType: "appointment.create",
        executionMode: "dry_run",
        targetTables: ["appointments"],
        targetRecordIds: [{ table: "SCHEDULE", id: "90001" }],
      });

      const stepId = addWriteAuditStep(db, {
        operationId,
        stepName: "validate_targets",
        lifecycleStatus: "validated",
        detailJson: { record_count: 1 },
      });

      const parent = db
        .prepare(`SELECT status FROM write_audit_log WHERE operation_id = ?`)
        .get(operationId) as { status: string };
      const step = db
        .prepare(`SELECT step_id, step_name, lifecycle_status, detail_json FROM write_audit_steps WHERE step_id = ?`)
        .get(stepId) as {
        step_id: number;
        step_name: string;
        lifecycle_status: string;
        detail_json: string;
      };

      expect(parent.status).toBe("validated");
      expect(step.step_name).toBe("validate_targets");
      expect(step.lifecycle_status).toBe("validated");
      expect(JSON.parse(step.detail_json)).toEqual({ record_count: 1 });
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("can record sanitized error", () => {
    const { dir, dbPath } = openMigratedDb();
    const db = openDatabaseSync(dbPath);

    try {
      const operationId = beginWriteAudit(db, {
        workflowType: "appointment.update",
        executionMode: "real_write",
        targetTables: ["appointments"],
        targetRecordIds: [{ table: "SCHEDULE", id: "88421" }],
      });

      const stepId = addWriteAuditStep(db, {
        operationId,
        stepName: "write_begin",
        lifecycleStatus: "write_started",
      });

      const errorId = recordWriteError(db, {
        operationId,
        stepId,
        errorCode: "VALIDATION_RECORD_LOCKED",
        message: "Record locked (table=SCHEDULE, id=88421)",
        targetTable: "SCHEDULE",
        targetRecordId: "88421",
      });

      finishWriteAudit(db, {
        operationId,
        terminalStatus: "failed",
      });

      const error = db
        .prepare(
          `SELECT error_code, message, target_table, target_record_id
           FROM write_errors WHERE error_id = ?`,
        )
        .get(errorId) as {
        error_code: string;
        message: string;
        target_table: string;
        target_record_id: string;
      };
      const parent = db
        .prepare(`SELECT terminal_status, finished_at FROM write_audit_log WHERE operation_id = ?`)
        .get(operationId) as { terminal_status: string; finished_at: string };

      expect(error.error_code).toBe("VALIDATION_RECORD_LOCKED");
      expect(error.message).toBe("Record locked (table=SCHEDULE, id=88421)");
      expect(error.target_table).toBe("SCHEDULE");
      expect(error.target_record_id).toBe("88421");
      expect(parent.terminal_status).toBe("failed");
      expect(parent.finished_at).toBeTruthy();
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not store forbidden tokens", () => {
    const { dir, dbPath } = openMigratedDb();
    const db = openDatabaseSync(dbPath);

    try {
      const operationId = beginWriteAudit(db, {
        workflowType: "patient.demographics.update",
        executionMode: "dry_run",
        targetTables: ["patients"],
        targetRecordIds: [{ table: "patients", id: "10042" }],
      });

      expect(() =>
        addWriteAuditStep(db, {
          operationId,
          stepName: "dry_run_complete",
          lifecycleStatus: "dry_run_generated",
          detailJson: { before: { display_name: "Synthetic" } },
        }),
      ).toThrow(AuditUnsafePayloadError);

      expect(() =>
        recordWriteError(db, {
          operationId,
          errorCode: "VALIDATION_FAILED",
          message: 'Rejected field "patientName" in payload',
        }),
      ).toThrow(AuditUnsafePayloadError);

      const blob = db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM write_audit_steps WHERE operation_id = ?) AS steps,
             (SELECT COUNT(*) FROM write_errors WHERE operation_id = ?) AS errors`,
        )
        .get(operationId, operationId) as { steps: number; errors: number };

      expect(blob.steps).toBe(0);
      expect(blob.errors).toBe(0);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
