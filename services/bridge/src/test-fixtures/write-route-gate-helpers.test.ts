import { describe, expect, it } from "vitest";
import type { SafeWritePlan } from "@microdent/contracts";
import {
  assertSafeWritePlanExcludesKnownSecrets,
  assertSafeWritePlanJson,
} from "./write-route-gate-helpers.js";

const BASE_PLAN: SafeWritePlan = {
  operationId: "255510e5-58cc-4372-a567-0e02b2c3d479",
  workflow: "patient.demographics.update",
  mode: "dry-run",
  tablesAffected: ["PATIENT"],
  recordIds: ["50001"],
  fieldsChanged: [
    {
      table: "PATIENT",
      recordId: "50001",
      field: "CASENB",
      changeType: "set",
    },
  ],
  backupRequired: true,
  backupWouldCreate: true,
  warnings: [],
  committed: false,
  createdAt: "2026-05-15T12:00:00.000Z",
};

describe("assertSafeWritePlanExcludesKnownSecrets", () => {
  it("allows operationId UUID substrings that match phone digit patterns", () => {
    const text = JSON.stringify(BASE_PLAN);
    expect(() => assertSafeWritePlanExcludesKnownSecrets(text, BASE_PLAN)).not.toThrow();
  });

  it("rejects known fixture phone literals in response text", () => {
    const text = JSON.stringify({
      ...BASE_PLAN,
      warnings: [
        {
          code: "LEAK",
          message: "unexpected (555) 200-3001",
          severity: "warn",
        },
      ],
    });
    expect(() => assertSafeWritePlanExcludesKnownSecrets(text, BASE_PLAN)).toThrow();
  });

  it("rejects forbidden PII field names in fieldsChanged", () => {
    const plan: SafeWritePlan = {
      ...BASE_PLAN,
      fieldsChanged: [
        {
          table: "PATIENT",
          recordId: "50001",
          field: "HOME_PHONE",
          changeType: "set",
        },
      ],
    };
    const text = JSON.stringify(plan);
    expect(() => assertSafeWritePlanExcludesKnownSecrets(text, plan)).toThrow();
  });
});

describe("assertSafeWritePlanJson", () => {
  it("parses valid plan JSON", () => {
    const text = JSON.stringify(BASE_PLAN);
    const parsed = assertSafeWritePlanJson(text);
    expect(parsed.operationId).toBe(BASE_PLAN.operationId);
  });
});
