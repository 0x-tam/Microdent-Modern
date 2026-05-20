import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { validateSetupPayload } from "./setup-window.js";

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
    expect("ok" in result && result.ok === false).toBe(true);
    if ("ok" in result && !result.ok) {
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
    expect("writeMode" in result).toBe(true);
    if ("writeMode" in result) {
      expect(result.writeMode).toBe("disabled");
      expect(result.dataRoot).toBe(dataRoot);
      expect(result.sqlitePath).toBe(sqlitePath);
    }
  });

  it("rejects relative paths with not_absolute", () => {
    const result = validateSetupPayload({
      dataRoot: "sandbox/DATA",
      sqlitePath: "mirror/clinic.sqlite",
    });
    expect("ok" in result && result.ok === false).toBe(true);
    if ("ok" in result && !result.ok) {
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
    expect("writeMode" in result).toBe(true);
    if ("writeMode" in result) {
      expect(result.dataRoot).toContain(" ");
    }
  });
});
