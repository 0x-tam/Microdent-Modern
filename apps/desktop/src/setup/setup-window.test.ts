import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
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
      expect(result.message).toContain("Clinic data folder");
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
      expect(result.config.logsDir).toBeTruthy();
      expect(result.config.setupCompletedAt).toBeTruthy();
    }
  });

  it("derives local copy, backup, and logs paths from only the clinic data folder", () => {
    const parent = mkdtempSync(join(tmpdir(), "microdent-setup-derived-"));
    const dataRoot = join(parent, "DATA");
    cleanup.push(parent);
    writeFileSync(join(parent, "placeholder.txt"), "");
    mkdirSync(dataRoot);

    const result = validateSetupPayload({ dataRoot });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.dataRoot).toBe(dataRoot);
      expect(result.config.sqlitePath).toBe(join(parent, "mirror", "clinic.sqlite"));
      expect(result.config.backupDir).toBe(join(parent, "microdent-backups"));
      expect(result.config.logsDir).toBe(join(parent, "logs"));
      expect(result.config.writeMode).toBe("disabled");
      expect(result.config.lastImportStatus).toBeUndefined();
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
    expect(summary).toMatch(/Configuration saved/i);
    expect(summary).toMatch(/clinic service/i);
    expect(summary).toMatch(/legacy/i);
  });

  it("rejects when sqlitePath points to a directory instead of a file", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "microdent-setup-sqlite-dir-"));
    const sqliteDir = mkdtempSync(join(tmpdir(), "microdent-setup-sqlite-dir2-"));
    cleanup.push(dataRoot, sqliteDir);

    const result = validateSetupPayload({
      dataRoot,
      sqlitePath: sqliteDir, // directory, not a file
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Fast local copy/i);
      expect(result.message).toMatch(/file/i);
    }
  });

  it("rejects when dataRoot points to a file instead of a directory", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "microdent-setup-dataroot-"));
    const sqliteDir = mkdtempSync(join(tmpdir(), "microdent-setup-datafile-"));
    cleanup.push(dataRoot, sqliteDir);
    const fakeFile = join(dataRoot, "fake-data-root");
    writeFileSync(fakeFile, "");
    const sqlitePath = join(sqliteDir, "mirror.sqlite");
    writeFileSync(sqlitePath, "");

    const result = validateSetupPayload({
      dataRoot: fakeFile, // file, not a directory
      sqlitePath,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Clinic data folder/i);
      expect(result.message).toMatch(/folder/i);
    }
  });
});

describe("collectSetupPathWarnings", () => {
  it("returns empty array for valid local paths", () => {
    const warnings = collectSetupPathWarnings({
      dataRoot: "/home/user/microdent/DATA",
      sqlitePath: "/home/user/microdent/mirror/clinic.sqlite",
      backupDir: "/home/user/microdent/backups",
    });
    expect(warnings).toEqual([]);
  });

  it("collects UNC warnings from multiple fields", () => {
    const warnings = collectSetupPathWarnings({
      dataRoot: "\\\\server\\share\\DATA",
      sqlitePath: "/local/mirror.sqlite",
    });
    expect(warnings.some((w) => /UNC/i.test(w))).toBe(true);
  });

  it("deduplicates identical warnings", () => {
    const warnings = collectSetupPathWarnings({
      dataRoot: "\\\\server\\share1\\DATA",
      sqlitePath: "\\\\server\\share2\\mirror.sqlite",
    });
    const uncWarnings = warnings.filter((w) => /UNC/i.test(w));
    expect(uncWarnings.length).toBe(1);
  });
});

describe("formatSetupSaveSummary", () => {
  it("includes summary text without any raw paths", () => {
    const summary = formatSetupSaveSummary([]);
    expect(summary).toMatch(/Configuration saved/i);
    expect(summary).not.toMatch(/\//);
    expect(summary).not.toMatch(/\\/);
  });

  it("appends warnings when present", () => {
    const summary = formatSetupSaveSummary(["Test warning one", "Test warning two"]);
    expect(summary).toContain("Test warning one");
    expect(summary).toContain("Test warning two");
    expect(summary).toContain("Note:");
  });
});

describe("getLegacyPathSegmentWarning", () => {
  it("detects microdent-legacy in any path segment", () => {
    expect(getLegacyPathSegmentWarning("microdent-legacy")).toMatch(/legacy/i);
    expect(getLegacyPathSegmentWarning("/home/Microdent-Legacy/DATA")).toMatch(/legacy/i);
    expect(getLegacyPathSegmentWarning("C:\\Legacy-Copy\\DATA")).toMatch(/legacy/i);
  });

  it("returns null for safe paths", () => {
    expect(getLegacyPathSegmentWarning("/home/Microdent/DATA")).toBeNull();
    expect(getLegacyPathSegmentWarning("C:\\Microdent\\Write-Sandbox\\DATA")).toBeNull();
  });
});
