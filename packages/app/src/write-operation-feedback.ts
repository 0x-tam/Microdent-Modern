import type { SafeWritePlan, WriteAuditRecentResponse } from "@microdent/contracts";
import {
  WRITE_AUDIT_EMPTY,
  WRITE_AUDIT_NOT_CONFIGURED,
  WRITE_AUDIT_UNAVAILABLE,
  WRITE_BACKUP_CREATED_LINE,
  WRITE_BACKUP_NOT_CREATED_LINE,
  WRITE_BACKUP_SKIPPED_LINE,
  WRITE_OPERATION_ID_PREFIX,
} from "./read-only-ui-copy.js";

export type WriteOperationFeedback = {
  operationId: string;
  committed: boolean;
  backupCreated: boolean | null;
  auditEntryCount: number | null;
  auditOperationMatch: boolean | null;
  auditTerminalStatus: string | null;
};

/** True when a committed plan indicates a backup was created (never exposes paths). */
export function backupCreatedFromPlan(plan: SafeWritePlan): boolean | null {
  if (!plan.committed) return null;
  if (plan.backupWouldCreate === true) return true;
  if (plan.backupWouldCreate === false) return false;
  return plan.backupRequired;
}

export function formatBackupFeedbackLine(backupCreated: boolean | null): string {
  if (backupCreated === null) return WRITE_BACKUP_SKIPPED_LINE;
  return backupCreated ? WRITE_BACKUP_CREATED_LINE : WRITE_BACKUP_NOT_CREATED_LINE;
}

/**
 * PHI-safe audit summary from `GET /v1/meta/write-audit-recent` metadata only.
 */
export function resolveWriteAuditFeedback(
  operationId: string,
  audit: WriteAuditRecentResponse | null | undefined,
): Pick<
  WriteOperationFeedback,
  "auditEntryCount" | "auditOperationMatch" | "auditTerminalStatus"
> {
  if (!audit) {
    return { auditEntryCount: null, auditOperationMatch: null, auditTerminalStatus: null };
  }
  if (!audit.sqliteConfigured) {
    return { auditEntryCount: 0, auditOperationMatch: false, auditTerminalStatus: null };
  }
  if (!audit.sqliteUsable) {
    return { auditEntryCount: null, auditOperationMatch: null, auditTerminalStatus: null };
  }

  const auditEntryCount = audit.entries.length;
  const match = audit.entries.find((e) => e.operationId === operationId);
  return {
    auditEntryCount,
    auditOperationMatch: match !== undefined,
    auditTerminalStatus: match?.terminalStatus ?? null,
  };
}

export function formatAuditFeedbackLine(
  operationId: string,
  audit: WriteAuditRecentResponse | null | undefined,
  resolved: Pick<
    WriteOperationFeedback,
    "auditEntryCount" | "auditOperationMatch" | "auditTerminalStatus"
  > = resolveWriteAuditFeedback(operationId, audit),
): string {
  if (!audit) return WRITE_AUDIT_UNAVAILABLE;
  if (!audit.sqliteConfigured) return WRITE_AUDIT_NOT_CONFIGURED;
  if (!audit.sqliteUsable) return WRITE_AUDIT_UNAVAILABLE;
  if (resolved.auditEntryCount === 0) return WRITE_AUDIT_EMPTY;
  if (resolved.auditOperationMatch) {
    const status = resolved.auditTerminalStatus ?? "pending";
    return `Audit: operation found (${status}). Recent entries: ${resolved.auditEntryCount}.`;
  }
  return `Audit: operation not in recent ${resolved.auditEntryCount} entries.`;
}

export function buildWriteOperationFeedback(
  plan: SafeWritePlan,
  audit?: WriteAuditRecentResponse | null,
): WriteOperationFeedback {
  const auditFields = resolveWriteAuditFeedback(plan.operationId, audit);
  return {
    operationId: plan.operationId,
    committed: plan.committed,
    backupCreated: backupCreatedFromPlan(plan),
    ...auditFields,
  };
}

/** Operator-visible lines after a write (no paths, payloads, or PHI). */
export function formatWriteOperationFeedbackLines(
  feedback: WriteOperationFeedback,
  audit?: WriteAuditRecentResponse | null,
): string[] {
  const lines = [`${WRITE_OPERATION_ID_PREFIX}: ${feedback.operationId}`];
  lines.push(formatBackupFeedbackLine(feedback.backupCreated));
  lines.push(
    formatAuditFeedbackLine(feedback.operationId, audit, {
      auditEntryCount: feedback.auditEntryCount,
      auditOperationMatch: feedback.auditOperationMatch,
      auditTerminalStatus: feedback.auditTerminalStatus,
    }),
  );
  return lines;
}
