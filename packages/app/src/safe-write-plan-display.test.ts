import { describe, expect, it } from "vitest";
import {
  containsForbiddenWriteResultToken,
  FORBIDDEN_WRITE_RESULT_TOKENS,
  summarizeWritePlan,
} from "./safe-write-plan-display.js";

const syntheticPlan = {
  operationId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  workflow: "appointment.statusUpdate",
  mode: "dry-run" as const,
  tablesAffected: ["SCHEDULE"],
  recordIds: ["501"],
  fieldsChanged: [
    { table: "SCHEDULE", recordId: "501", field: "STATUS", changeType: "set" as const },
  ],
  backupRequired: true,
  backupWouldCreate: true,
  warnings: [],
  committed: false,
  createdAt: "2026-05-15T12:00:00.000Z",
};

describe("containsForbiddenWriteResultToken", () => {
  it("flags PHI and raw-row markers", () => {
    for (const token of FORBIDDEN_WRITE_RESULT_TOKENS) {
      expect(containsForbiddenWriteResultToken(`leak ${token} here`)).toBe(true);
    }
  });

  it("does not flag safe workflow copy or preview-before-apply UX", () => {
    expect(containsForbiddenWriteResultToken("appointment.statusUpdate")).toBe(false);
    expect(containsForbiddenWriteResultToken("Preview status change before apply")).toBe(false);
    expect(containsForbiddenWriteResultToken("Run preview before you apply")).toBe(false);
    expect(containsForbiddenWriteResultToken("Committed: false · dry-run plan only")).toBe(false);
    expect(containsForbiddenWriteResultToken("Field changed before validation")).toBe(false);
  });

  it("flags quoted before/after plan JSON tokens only via forbidden list", () => {
    expect(containsForbiddenWriteResultToken('{"before":"x"}')).toBe(true);
    expect(containsForbiddenWriteResultToken('{"after":"y"}')).toBe(true);
  });
});

describe("summarizeWritePlan", () => {
  it("extracts safe summary fields without forbidden tokens", () => {
    const summary = summarizeWritePlan(syntheticPlan);
    expect(summary).toEqual({
      workflow: "appointment.statusUpdate",
      mode: "dry-run",
      committed: false,
      table: "SCHEDULE",
      recordId: "501",
      field: "STATUS",
      warnings: [],
    });
    const text = JSON.stringify(summary);
    expect(containsForbiddenWriteResultToken(text)).toBe(false);
  });
});
