import type { SqliteDatabase } from "./node-sqlite.js";

export class WriteAuditVerificationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "WriteAuditVerificationError";
    this.code = code;
  }
}

/**
 * Confirms a write audit parent row exists for `operationId` (no row payloads).
 */
export function verifyWriteAuditOperationExists(db: SqliteDatabase, operationId: string): void {
  const row = db
    .prepare(`SELECT operation_id FROM write_audit_log WHERE operation_id = ?`)
    .get(operationId) as { operation_id: string } | undefined;

  if (!row) {
    throw new WriteAuditVerificationError(
      "WRITE_AUDIT_NOT_FOUND",
      `write audit record not found for operationId=${operationId}`,
    );
  }
}
