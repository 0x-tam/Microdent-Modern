import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import {
  validateBackupDir,
  validateDataRootDir,
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
    expect(validateDataRootDir("relative/data").ok).toBe(false);
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

  it("validates SQLITE_PATH file", () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-sqlite-"));
    cleanup.push(dir);
    const file = join(dir, "mirror.sqlite");
    writeFileSync(file, "");
    const result = validateSqlitePathFile(file);
    expect(result.ok).toBe(true);
  });

  it("creates BACKUP_DIR when missing and createIfMissing is set", () => {
    const parent = mkdtempSync(join(tmpdir(), "microdent-backup-parent-"));
    cleanup.push(parent);
    const backup = join(parent, "backups");
    const result = validateBackupDir(backup, { createIfMissing: true });
    expect(result.ok).toBe(true);
  });
});
