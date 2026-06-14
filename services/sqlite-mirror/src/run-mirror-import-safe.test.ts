import { mkdirSync, mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabaseSync } from "./node-sqlite.js";
import {
  formatMirrorImportSafeSummaryLines,
  mirrorImportSafeExitCode,
  runMirrorImportSafe,
  type RunMirrorImportSafeResult,
} from "./run-mirror-import-safe.js";
import { writeSyntheticMirrorDataRoot } from "./test-fixtures/synthetic-mirror-data-root.js";

const BLOCKED_TOKENS = [
  "Blocked comment token",
  "Blocked name token",
  "Hidden street token",
  "Hidden note token",
  "Blocked problem token",
  "Blocked desc token",
  "555-000-0000",
];

function readSafeMirrorSnapshot(sqlitePath: string): {
  tableCounts: Record<string, number>;
  importRunCount: number;
} {
  const db = openDatabaseSync(sqlitePath, { readOnly: true });
  try {
    const tables = [
      "doctors",
      "procedures",
      "schedule_rooms",
      "patients",
      "appointments",
      "medical_summary",
      "treatments",
    ] as const;
    const tableCounts: Record<string, number> = {};
    for (const table of tables) {
      const row = db.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get() as { c: number };
      tableCounts[table] = Number(row.c);
    }
    const runs = db.prepare("SELECT COUNT(*) AS c FROM import_runs").get() as { c: number };
    return { tableCounts, importRunCount: Number(runs.c) };
  } finally {
    db.close();
  }
}

function syntheticResult(overall: RunMirrorImportSafeResult["overall"]): RunMirrorImportSafeResult {
  return {
    migrations: { applied: 2, skipped: 4 },
    steps: [
      { table: "doctors", status: "success", rowCount: 3, errorCount: 0 },
      { table: "patients", status: overall === "success" ? "success" : "partial", rowCount: 10, errorCount: 1 },
    ],
    overall,
  };
}

describe("mirrorImportSafeExitCode", () => {
  it("returns 0 only for success", () => {
    expect(mirrorImportSafeExitCode("success")).toBe(0);
    expect(mirrorImportSafeExitCode("partial")).toBe(1);
    expect(mirrorImportSafeExitCode("failed")).toBe(1);
  });
});

describe("formatMirrorImportSafeSummaryLines", () => {
  it("prints a PHI-safe table without paths or row payloads", () => {
    const lines = formatMirrorImportSafeSummaryLines(syntheticResult("partial"));
    const text = lines.join("\n");
    expect(text).toContain("table");
    expect(text).toContain("doctors");
    expect(text).toContain("partial");
    expect(text).toContain("overall: partial");
    expect(text).not.toMatch(/\/Users\//);
    expect(text).not.toMatch(/PAT_NAME|555-/);
  });
});

describe("runMirrorImportSafe", () => {
  it("imports all safe mirror tables from a synthetic DATA_ROOT", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-mirror-import-safe-"));
    const dataRoot = join(dir, "data");
    const sqlitePath = join(dir, "mirror.sqlite");

    try {
      mkdirSync(dataRoot, { recursive: true });
      await writeSyntheticMirrorDataRoot(dataRoot);

      const result = await runMirrorImportSafe({ dataRoot, sqlitePath });

      expect(result.overall).toBe("success");
      expect(result.migrations.applied).toBeGreaterThan(0);
      expect(result.steps.map((s) => s.table)).toEqual([
        "doctors",
        "procedures",
        "schedule_rooms",
        "patients",
        "appointments",
        "medical_summary",
        "treatments",
      ]);
      for (const step of result.steps) {
        expect(step.status).toBe("success");
        expect(step.errorCount).toBe(0);
        expect(step.rowCount).toBeGreaterThan(0);
      }

      const snapshot = readSafeMirrorSnapshot(sqlitePath);
      expect(snapshot.tableCounts.doctors).toBeGreaterThan(0);
      expect(snapshot.tableCounts.schedule_rooms).toBeGreaterThan(0);
      expect(snapshot.tableCounts.patients).toBeGreaterThan(0);
      expect(snapshot.importRunCount).toBeGreaterThanOrEqual(7);

      const dump = JSON.stringify(snapshot);
      for (const token of BLOCKED_TOKENS) {
        expect(dump).not.toContain(token);
      }

      const second = await runMirrorImportSafe({ dataRoot, sqlitePath });
      expect(second.overall).toBe("success");
      for (const step of second.steps) {
        expect(step.status).toBe("success");
      }

      const incremental = await runMirrorImportSafe({ dataRoot, sqlitePath, incremental: true });
      expect(incremental.overall).toBe("success");
      expect(incremental.steps.find((s) => s.table === "doctors")?.status).toBe("skipped");
      expect(incremental.steps.find((s) => s.table === "procedures")?.status).toBe("skipped");
      expect(incremental.steps.find((s) => s.table === "schedule_rooms")?.status).toBe("skipped");
      expect(incremental.steps.find((s) => s.table === "patients")?.status).toBe("success");

      const future = new Date(Date.now() + 60_000);
      utimesSync(join(dataRoot, "DOCTORS.DBF"), future, future);
      const changed = await runMirrorImportSafe({ dataRoot, sqlitePath, incremental: true });
      expect(changed.overall).toBe("success");
      expect(changed.steps.find((s) => s.table === "doctors")?.status).toBe("success");
      expect(changed.steps.find((s) => s.table === "procedures")?.status).toBe("skipped");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
