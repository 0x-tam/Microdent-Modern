import { describe, expect, it } from "vitest";
import type { MirrorStatusResponse } from "@microdent/contracts";
import { resolveLocalCopyIssue } from "./local-copy-issue.js";

const baseStatus: MirrorStatusResponse = {
  sqliteConfigured: true,
  sqliteUsable: true,
  importedTables: ["appointments", "patients"],
  latestImportRuns: [
    {
      tableName: "patients",
      status: "success",
      rowCount: 10,
      errorCount: 0,
      finishedAt: "2026-06-06T01:02:03.000Z",
    },
    {
      tableName: "appointments",
      status: "success",
      rowCount: 20,
      errorCount: 0,
      finishedAt: "2026-06-06T01:02:04.000Z",
    },
  ],
};

describe("resolveLocalCopyIssue", () => {
  it("returns null when core local copy tables are ready", () => {
    expect(resolveLocalCopyIssue(baseStatus)).toBeNull();
  });

  it("reports unavailable local copy without paths", () => {
    const issue = resolveLocalCopyIssue({
      ...baseStatus,
      sqliteUsable: false,
      importedTables: [],
      latestImportRuns: [],
    });

    expect(issue?.tone).toBe("error");
    expect(issue?.title).toBe("Local copy unavailable");
    expect(JSON.stringify(issue)).not.toContain("SQLITE_PATH");
    expect(JSON.stringify(issue)).not.toContain("DATA_ROOT");
    expect(JSON.stringify(issue)).not.toContain("/Users/");
    expect(JSON.stringify(issue)).not.toContain("C:\\");
  });

  it("prioritizes failed refresh runs", () => {
    const issue = resolveLocalCopyIssue({
      ...baseStatus,
      latestImportRuns: [
        {
          tableName: "patients",
          status: "failed",
          rowCount: 0,
          errorCount: 1,
          finishedAt: "2026-06-06T01:02:03.000Z",
        },
      ],
    });

    expect(issue?.tone).toBe("error");
    expect(issue?.title).toBe("Local copy refresh failed");
    expect(issue?.body).toContain("1 table");
  });

  it("reports partial refresh runs as warn-only", () => {
    const issue = resolveLocalCopyIssue({
      ...baseStatus,
      latestImportRuns: [
        {
          tableName: "patients",
          status: "partial",
          rowCount: 10,
          errorCount: 2,
          finishedAt: "2026-06-06T01:02:03.000Z",
        },
      ],
    });

    expect(issue?.tone).toBe("warn");
    expect(issue?.title).toBe("Local copy partially refreshed");
    expect(issue?.body).toContain("skipped rows");
  });

  it("reports incomplete core tables after a refresh run", () => {
    const issue = resolveLocalCopyIssue({
      ...baseStatus,
      importedTables: ["doctors"],
      latestImportRuns: [
        {
          tableName: "doctors",
          status: "success",
          rowCount: 2,
          errorCount: 0,
          finishedAt: "2026-06-06T01:02:03.000Z",
        },
      ],
    });

    expect(issue?.tone).toBe("warn");
    expect(issue?.title).toBe("Core local copy incomplete");
    expect(issue?.body).toContain("patients, appointments");
  });
});
