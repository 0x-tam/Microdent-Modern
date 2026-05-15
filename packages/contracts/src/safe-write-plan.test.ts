import { describe, expect, it } from "vitest";
import { SafeWritePlanSchema } from "./safe-write-plan.js";

const VALID_SYNTHETIC_PLAN = {
  operationId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  workflow: "appointment.statusUpdate",
  mode: "dry-run",
  tablesAffected: ["SCHEDULE"],
  recordIds: ["1001"],
  fieldsChanged: [
    {
      table: "SCHEDULE",
      recordId: "1001",
      field: "STATUS",
      changeType: "set",
    },
  ],
  backupRequired: true,
  backupWouldCreate: true,
  warnings: [],
  committed: false,
  createdAt: "2026-05-15T12:00:00.000Z",
} as const;

describe("SafeWritePlanSchema", () => {
  it("parses a valid synthetic plan", () => {
    const parsed = SafeWritePlanSchema.parse(VALID_SYNTHETIC_PLAN);
    expect(parsed.workflow).toBe("appointment.statusUpdate");
    expect(parsed.fieldsChanged[0]?.field).toBe("STATUS");
    expect(parsed.committed).toBe(false);
  });

  it("rejects before/after value keys on field changes", () => {
    const withBefore = {
      ...VALID_SYNTHETIC_PLAN,
      fieldsChanged: [
        {
          table: "SCHEDULE",
          recordId: "1001",
          field: "STATUS",
          changeType: "set",
          before: 1,
        },
      ],
    };
    expect(() => SafeWritePlanSchema.parse(withBefore)).toThrow();

    const withAfter = {
      ...VALID_SYNTHETIC_PLAN,
      fieldsChanged: [
        {
          table: "SCHEDULE",
          recordId: "1001",
          field: "STATUS",
          changeType: "set",
          after: 2,
        },
      ],
    };
    expect(() => SafeWritePlanSchema.parse(withAfter)).toThrow();
  });

  it("rejects unknown keys on the plan and nested objects", () => {
    expect(() =>
      SafeWritePlanSchema.parse({
        ...VALID_SYNTHETIC_PLAN,
        extraTopLevel: true,
      }),
    ).toThrow();

    expect(() =>
      SafeWritePlanSchema.parse({
        ...VALID_SYNTHETIC_PLAN,
        warnings: [
          {
            code: "FOXPRO_LOCK_RISK",
            message: "Legacy EXE may hold file locks.",
            severity: "warn",
            detail: "should not appear",
          },
        ],
      }),
    ).toThrow();
  });
});
