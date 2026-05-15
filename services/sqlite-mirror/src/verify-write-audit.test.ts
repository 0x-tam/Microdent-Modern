import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { applyMigrations } from "./apply-migrations.js";
import { openDatabaseSync } from "./node-sqlite.js";
import { beginWriteAudit } from "./write-audit.js";
import { verifyWriteAuditOperationExists, WriteAuditVerificationError } from "./verify-write-audit.js";

function openMigratedDb(): { dir: string; dbPath: string } {
  const dir = mkdtempSync(join(tmpdir(), "microdent-verify-audit-"));
  const dbPath = join(dir, "mirror.sqlite");
  applyMigrations(dbPath);
  return { dir, dbPath };
}

describe("verifyWriteAuditOperationExists", () => {
  it("passes when audit row exists", () => {
    const { dir, dbPath } = openMigratedDb();
    const db = openDatabaseSync(dbPath);

    try {
      const operationId = beginWriteAudit(db, {
        workflowType: "appointment.statusUpdate",
        executionMode: "real_write",
        targetTables: ["SCHEDULE"],
        targetRecordIds: [{ table: "SCHEDULE", id: "1001" }],
      });

      expect(() => verifyWriteAuditOperationExists(db, operationId)).not.toThrow();
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails when audit row is missing", () => {
    const { dir, dbPath } = openMigratedDb();
    const db = openDatabaseSync(dbPath);

    try {
      expect(() =>
        verifyWriteAuditOperationExists(db, "00000000-0000-4000-8000-000000000001"),
      ).toThrow(WriteAuditVerificationError);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
