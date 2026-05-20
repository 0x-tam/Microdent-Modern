import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import {
  collectSetupPathWarnings,
  formatSetupSaveSummary,
  getLegacyPathSegmentWarning,
  validateSetupPayload,
} from "./setup-window.js";

describe("validateSetupPayload", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
  });

  it("returns operator-safe errors without full paths in messages", () => {
    const result = validateSetupPayload({
      dataRoot: "",
      sqlitePath: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("DATA_ROOT");
      expect(result.message).not.toMatch(/\/Users\//);
    }
  });

  it("saves normalized paths with writeMode disabled", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "microdent-setup-data-"));
    const sqliteDir = mkdtempSync(join(tmpdir(), "microdent-setup-sql-"));
    cleanup.push(dataRoot, sqliteDir);
    const sqlitePath = join(sqliteDir, "mirror.sqlite");
    writeFileSync(sqlitePath, "");

    const result = validateSetupPayload({
      dataRoot,
      sqlitePath,
      backupDir: "",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.writeMode).toBe("disabled");
      expect(result.config.dataRoot).toBe(dataRoot);
      expect(result.config.sqlitePath).toBe(sqlitePath);
    }
  });

  it("rejects relative paths with not_absolute", () => {
    const result = validateSetupPayload({
      dataRoot: "sandbox/DATA",
      sqlitePath: "mirror/clinic.sqlite",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/not_absolute|absolute/i);
    }
  });

  it("accepts paths with spaces when directories exist", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "microdent setup data "));
    const sqliteDir = mkdtempSync(join(tmpdir(), "microdent setup sql "));
    cleanup.push(dataRoot, sqliteDir);
    const sqlitePath = join(sqliteDir, "mirror.sqlite");
    writeFileSync(sqlitePath, "");

    const result = validateSetupPayload({
      dataRoot,
      sqlitePath,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.dataRoot).toContain(" ");
    }
  });

  it("includes UNC warnings without blocking save", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "microdent-setup-unc-"));
    const sqliteDir = mkdtempSync(join(tmpdir(), "microdent-setup-unc-sql-"));
    cleanup.push(dataRoot, sqliteDir);
    const sqlitePath = join(sqliteDir, "mirror.sqlite");
    writeFileSync(sqlitePath, "");

    const payload = {
      dataRoot: `\\\\fileserver\\clinic\\${dataRoot.split(/[/\\]/).pop()}`,
      sqlitePath,
    };
    const warnings = collectSetupPathWarnings(payload);
    expect(warnings.some((w) => /UNC/i.test(w))).toBe(true);

    const localResult = validateSetupPayload({ dataRoot, sqlitePath });
    expect(localResult.ok).toBe(true);
  });

  it("warns on legacy-looking path segments without blocking", () => {
    expect(getLegacyPathSegmentWarning("C:\\Microdent-Legacy\\DATA")).toMatch(/legacy/i);
    expect(getLegacyPathSegmentWarning("C:\\Microdent\\Write-Sandbox\\DATA")).toBeNull();
    const summary = formatSetupSaveSummary([
      "A folder name looks like production legacy — use a disposable Write-Sandbox copy only.",
    ]);
    expect(summary).toMatch(/PILOT-HANDOFF-PACK/i);
    expect(summary).toMatch(/mirror import/i);
    expect(summary).toMatch(/legacy/i);
    expect(summary).toMatch(/disabled/i);
  });
});
