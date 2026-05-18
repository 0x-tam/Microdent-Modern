import { describe, expect, it } from "vitest";
import {
  backupCreatedFromPlan,
  buildWriteOperationFeedback,
  formatAuditFeedbackLine,
  formatWriteOperationFeedbackLines,
  resolveWriteAuditFeedback,
} from "./write-operation-feedback.js";

const operationId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

const committedPlan = {
  operationId,
  workflow: "appointment.statusUpdate",
  mode: "enabled" as const,
  tablesAffected: ["SCHEDULE"],
  recordIds: ["501"],
  fieldsChanged: [],
  backupRequired: true,
  backupWouldCreate: true,
  warnings: [],
  committed: true,
  createdAt: "2026-05-15T12:00:00.000Z",
};

describe("backupCreatedFromPlan", () => {
  it("returns null when not committed", () => {
    expect(backupCreatedFromPlan({ ...committedPlan, committed: false })).toBeNull();
  });

  it("uses backupWouldCreate when present", () => {
    expect(backupCreatedFromPlan(committedPlan)).toBe(true);
    expect(backupCreatedFromPlan({ ...committedPlan, backupWouldCreate: false })).toBe(false);
  });
});

describe("resolveWriteAuditFeedback", () => {
  it("handles not configured and unavailable", () => {
    expect(resolveWriteAuditFeedback(operationId, null)).toEqual({
      auditEntryCount: null,
      auditOperationMatch: null,
      auditTerminalStatus: null,
    });
    expect(
      resolveWriteAuditFeedback(operationId, {
        sqliteConfigured: false,
        sqliteUsable: false,
        entries: [],
      }),
    ).toEqual({
      auditEntryCount: 0,
      auditOperationMatch: false,
      auditTerminalStatus: null,
    });
  });

  it("detects matching operation in recent entries", () => {
    const resolved = resolveWriteAuditFeedback(operationId, {
      sqliteConfigured: true,
      sqliteUsable: true,
      entries: [
        {
          operationId,
          workflow: "appointment.statusUpdate",
          terminalStatus: "success",
          requestedAt: "2026-05-15T12:00:00.000Z",
          finishedAt: "2026-05-15T12:00:01.000Z",
        },
      ],
    });
    expect(resolved.auditOperationMatch).toBe(true);
    expect(resolved.auditTerminalStatus).toBe("success");
  });
});

describe("formatWriteOperationFeedbackLines", () => {
  it("never includes forbidden tokens", () => {
    const lines = formatWriteOperationFeedbackLines(
      buildWriteOperationFeedback(committedPlan, {
        sqliteConfigured: true,
        sqliteUsable: true,
        entries: [],
      }),
    );
    const text = lines.join("\n");
    expect(text).toContain(operationId);
    expect(text).toContain("Backup created");
    expect(text).not.toMatch(/DATA_ROOT|manifest|before|after|PAT_NAME/i);
  });

  it("formats audit match and miss", () => {
    expect(
      formatAuditFeedbackLine(operationId, {
        sqliteConfigured: true,
        sqliteUsable: true,
        entries: [],
      }),
    ).toContain("no recent entries");
    expect(
      formatAuditFeedbackLine(operationId, {
        sqliteConfigured: true,
        sqliteUsable: true,
        entries: [
          {
            operationId: "other-id",
            workflow: "appointment.statusUpdate",
            terminalStatus: "success",
            requestedAt: "2026-05-15T12:00:00.000Z",
            finishedAt: null,
          },
        ],
      }),
    ).toContain("not in recent");
  });
});
