import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import {
  getOperatorPathWarnings,
  isOperatorAbsolutePath,
  maskOperatorPath,
  normalizeOperatorPath,
  validateBackupDir,
  validateCreatableSqlitePath,
  validateDataRootDir,
  validateLogsDir,
  validateSqlitePathFile,
} from "./path-validation.js";

describe("path-validation", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
  });

  it("rejects empty and relative paths", () => {
    const empty = validateDataRootDir("");
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.code).toBe("empty");
    }
    const relative = validateDataRootDir("relative/data");
    expect(relative.ok).toBe(false);
    if (!relative.ok) {
      expect(relative.code).toBe("not_absolute");
    }
  });

  it("masks operator paths without leaking full segments", () => {
    expect(maskOperatorPath("C:\\Microdent\\Write-Sandbox\\DATA")).toBe("C:\\…/DATA");
    expect(maskOperatorPath("/var/tmp/mirror.sqlite")).toBe("/…/mirror.sqlite");
    expect(maskOperatorPath("")).toBe("(not set)");
  });

  it("accepts Windows drive-letter paths as absolute", () => {
    expect(isOperatorAbsolutePath("C:\\Microdent\\Write-Sandbox\\DATA")).toBe(true);
    expect(isOperatorAbsolutePath("D:/Microdent/mirror.sqlite")).toBe(true);
    expect(validateDataRootDir("C:\\no-such-root-on-ci").ok).toBe(false);
    const missing = validateDataRootDir("C:\\no-such-root-on-ci");
    if (!missing.ok) {
      expect(missing.code).toBe("missing");
    }
  });

  it("normalizes mixed Windows separators", () => {
    expect(normalizeOperatorPath("C:/Microdent\\Write-Sandbox/DATA")).toBe(
      "C:/Microdent/Write-Sandbox/DATA",
    );
  });

  it("warns on UNC paths without blocking validation shape", () => {
    const unc = "\\\\fileserver\\clinic\\Write-Sandbox\\DATA";
    expect(isOperatorAbsolutePath(unc)).toBe(true);
    const warnings = getOperatorPathWarnings(unc);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatch(/UNC/i);
  });

  it("allows paths containing spaces when the target exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent data root "));
    cleanup.push(dir);
    const result = validateDataRootDir(dir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalizedPath).toContain(" ");
    }
  });

  it("validates DATA_ROOT directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-data-root-"));
    cleanup.push(dir);
    const result = validateDataRootDir(dir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalizedPath).toBe(dir);
    }
  });

  it("returns UNC warnings on successful validation without blocking", () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-unc-data-"));
    cleanup.push(dir);
    const unc = `\\\\fileserver\\clinic\\share\\${dir.split(/[/\\]/).pop()}`;
    const warningsOnly = getOperatorPathWarnings(unc);
    expect(warningsOnly.some((w) => /UNC/i.test(w))).toBe(true);
  });

  it("validates SQLITE_PATH file", () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-sqlite-"));
    cleanup.push(dir);
    const file = join(dir, "mirror.sqlite");
    writeFileSync(file, "");
    const result = validateSqlitePathFile(file);
    expect(result.ok).toBe(true);
  });

  it("accepts a creatable local-copy sqlite path before the file exists", () => {
    const parent = mkdtempSync(join(tmpdir(), "microdent-creatable-sqlite-"));
    cleanup.push(parent);
    const sqlitePath = join(parent, "mirror", "clinic.sqlite");
    const result = validateCreatableSqlitePath(sqlitePath, { createParentIfMissing: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalizedPath).toBe(sqlitePath);
    }
  });

  it("creates BACKUP_DIR when missing and createIfMissing is set", () => {
    const parent = mkdtempSync(join(tmpdir(), "microdent-backup-parent-"));
    cleanup.push(parent);
    const backup = join(parent, "backups");
    const result = validateBackupDir(backup, { createIfMissing: true });
    expect(result.ok).toBe(true);
  });

  it("creates logs dir when missing and createIfMissing is set", () => {
    const parent = mkdtempSync(join(tmpdir(), "microdent-logs-parent-"));
    cleanup.push(parent);
    const logs = join(parent, "logs");
    const result = validateLogsDir(logs, { createIfMissing: true });
    expect(result.ok).toBe(true);
  });

  it("validates backup dir paths with spaces when parent exists", () => {
    const parent = mkdtempSync(join(tmpdir(), "microdent backup parent "));
    cleanup.push(parent);
    const backup = join(parent, "My Backups");
    const result = validateBackupDir(backup, { createIfMissing: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalizedPath).toContain(" ");
    }
  });

  it("classifies UNC paths separately from drive-letter paths", () => {
    const uncData = "\\\\fileserver\\clinic\\Write-Sandbox\\DATA";
    const driveData = "C:\\Microdent\\Write-Sandbox\\DATA";
    expect(isOperatorAbsolutePath(uncData)).toBe(true);
    expect(isOperatorAbsolutePath(driveData)).toBe(true);
    expect(getOperatorPathWarnings(uncData).some((w) => /UNC/i.test(w))).toBe(true);
    expect(getOperatorPathWarnings(driveData)).toHaveLength(0);
  });

  it("accepts Windows drive-letter paths with spaces as absolute shape", () => {
    const path = "C:\\Microdent\\My Sandbox\\DATA";
    expect(isOperatorAbsolutePath(path)).toBe(true);
    expect(normalizeOperatorPath(path)).toBe("C:/Microdent/My Sandbox/DATA");
    const missing = validateDataRootDir(path);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.code).toBe("missing");
    }
  });
});
