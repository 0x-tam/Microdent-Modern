import { applyMigrations } from "@microdent/sqlite-mirror";
import {
  addWriteAuditStep,
  beginWriteAudit,
  finishWriteAudit,
  recordWriteError,
} from "@microdent/sqlite-mirror";
import type { BridgeConfig } from "../config.js";
import { openDatabaseSync } from "../sqlite/node-sqlite.js";
import { APPOINTMENT_STATUS_UPDATE_WORKFLOW } from "./appointment-status-plan.js";

type AuditHandle = {
  onBackupCreated: (backupId: string) => void;
  onWriteStarted: () => void;
  onSuccess: (backupFolder: string) => void;
  onFailed: (errorCode: string, message: string) => void;
};

export function tryRecordAppointmentStatusAudit(
  bridgeConfig: BridgeConfig,
  input: { operationId: string; appointmentId: string; executionMode: "dry_run" | "real_write" },
): AuditHandle | null {
  if (!bridgeConfig.sqlitePath.configured) {
    return null;
  }

  try {
    applyMigrations(bridgeConfig.sqlitePath.path);
    const db = openDatabaseSync(bridgeConfig.sqlitePath.path);
    beginWriteAudit(db, {
      operationId: input.operationId,
      workflowType: APPOINTMENT_STATUS_UPDATE_WORKFLOW,
      executionMode: input.executionMode,
      targetTables: ["SCHEDULE"],
      targetRecordIds: [{ table: "SCHEDULE", id: input.appointmentId }],
    });
    addWriteAuditStep(db, {
      operationId: input.operationId,
      stepName: "write.requested",
      lifecycleStatus: "requested",
    });

    return {
      onBackupCreated(backupId: string) {
        addWriteAuditStep(db, {
          operationId: input.operationId,
          stepName: "write.backup_created",
          lifecycleStatus: "backup_created",
          detailCode: "backup_id",
          detailJson: { backupId },
        });
      },
      onWriteStarted() {
        addWriteAuditStep(db, {
          operationId: input.operationId,
          stepName: "write.started",
          lifecycleStatus: "write_started",
        });
      },
      onSuccess(backupFolder: string) {
        addWriteAuditStep(db, {
          operationId: input.operationId,
          stepName: "write.finished",
          lifecycleStatus: "write_finished",
          detailCode: "backup_folder",
          detailJson: { backupFolder },
        });
        finishWriteAudit(db, {
          operationId: input.operationId,
          terminalStatus: "success",
          recordCount: 1,
        });
      },
      onFailed(errorCode: string, message: string) {
        recordWriteError(db, {
          operationId: input.operationId,
          errorCode,
          message,
          targetTable: "SCHEDULE",
          targetRecordId: input.appointmentId,
        });
        finishWriteAudit(db, {
          operationId: input.operationId,
          terminalStatus: "failed",
          status: "failed",
        });
      },
    };
  } catch {
    return null;
  }
}
