import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadDataRootFromEnv, parseDataRootFromValue } from "../config.js";
import {
  PathSandboxError,
  openReadOnlyUnderConfiguredRoot,
  openReadOnlyUnderDataRoot,
  resolvePathWithinDataRoot,
} from "./index.js";

describe("parseDataRootFromValue", () => {
  it("treats missing DATA_ROOT as not configured", () => {
    expect(parseDataRootFromValue(undefined)).toEqual({ configured: false });
  });

  it("treats empty or whitespace-only as not configured", () => {
    expect(parseDataRootFromValue("")).toEqual({ configured: false });
    expect(parseDataRootFromValue("   ")).toEqual({ configured: false });
  });

  it("accepts a valid absolute DATA_ROOT", () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-data-root-"));
    const parsed = parseDataRootFromValue(dir);
    expect(parsed.configured).toBe(true);
    if (parsed.configured) {
      expect(parsed.path).toBeTruthy();
      expect(parsed.realPath).toBeTruthy();
    }
  });

  it("rejects a relative DATA_ROOT", () => {
    expect(() => parseDataRootFromValue("relative/path")).toThrow(/absolute path/i);
    expect(() => parseDataRootFromValue("./here")).toThrow(/absolute path/i);
  });
});

describe("loadDataRootFromEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads DATA_ROOT from the environment", () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-env-root-"));
    vi.stubEnv("DATA_ROOT", dir);
    const parsed = loadDataRootFromEnv();
    expect(parsed.configured).toBe(true);
  });
});

describe("resolvePathWithinDataRoot", () => {
  let root: string;

  it("accepts a normal file path inside DATA_ROOT", () => {
    root = mkdtempSync(join(tmpdir(), "microdent-sandbox-"));
    mkdirSync(join(root, "nested"));
    writeFileSync(join(root, "nested", "note.txt"), "hello");
    const cfg = parseDataRootFromValue(root);
    if (!cfg.configured) throw new Error("expected configured root");
    const resolved = resolvePathWithinDataRoot(cfg.realPath, "nested/note.txt");
    expect(readFileSync(resolved, "utf8")).toBe("hello");
  });

  it('rejects ".." traversal segments', () => {
    root = mkdtempSync(join(tmpdir(), "microdent-sandbox-"));
    const cfg = parseDataRootFromValue(root);
    if (!cfg.configured) throw new Error("expected configured root");
    expect(() => resolvePathWithinDataRoot(cfg.realPath, "nested/../../outside")).toThrow(PathSandboxError);
    expect(() => resolvePathWithinDataRoot(cfg.realPath, "..")).toThrow(PathSandboxError);
  });

  it("rejects absolute logical paths (outside root)", () => {
    root = mkdtempSync(join(tmpdir(), "microdent-sandbox-"));
    const cfg = parseDataRootFromValue(root);
    if (!cfg.configured) throw new Error("expected configured root");
    expect(() => resolvePathWithinDataRoot(cfg.realPath, "/etc/passwd")).toThrow(PathSandboxError);
  });

  it("rejects symlink targets that escape DATA_ROOT", () => {
    root = mkdtempSync(join(tmpdir(), "microdent-sandbox-"));
    const outside = mkdtempSync(join(tmpdir(), "microdent-outside-"));
    writeFileSync(join(outside, "secret.txt"), "x");
    const cfg = parseDataRootFromValue(root);
    if (!cfg.configured) throw new Error("expected configured root");

    try {
      symlinkSync(join(outside, "secret.txt"), join(root, "leak.txt"));
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES") {
        // Windows without developer mode may block symlinks.
        return;
      }
      throw err;
    }

    expect(() => resolvePathWithinDataRoot(cfg.realPath, "leak.txt")).toThrow(PathSandboxError);
  });
});

describe("openReadOnlyUnderDataRoot", () => {
  it("throws when DATA_ROOT is not configured", async () => {
    await expect(openReadOnlyUnderDataRoot({ configured: false }, "any")).rejects.toThrow(PathSandboxError);
  });

  it("opens an existing file read-only under a configured root", async () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-ro-"));
    writeFileSync(join(root, "data.bin"), "abc");
    const cfg = parseDataRootFromValue(root);
    if (!cfg.configured) throw new Error("expected configured root");

    const handle = await openReadOnlyUnderConfiguredRoot(cfg, "data.bin");
    try {
      const buf = Buffer.alloc(3);
      const { bytesRead } = await handle.read(buf, 0, 3, 0);
      expect(bytesRead).toBe(3);
      expect(buf.toString("utf8")).toBe("abc");
      await expect(handle.write(buf, 0, 1, 0)).rejects.toThrow();
    } finally {
      await handle.close();
    }
  });
});

describe("openFileReadOnly (flags)", () => {
  it("uses O_RDONLY", async () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-flags-"));
    const file = join(root, "x.txt");
    writeFileSync(file, "z");
    const { openFileReadOnly } = await import("../safety/read-only-file.js");
    const h = await openFileReadOnly(file);
    try {
      expect(h.fd).toBeGreaterThanOrEqual(0);
      // Node does not always expose O_RDONLY on handle; ensure write fails.
      const buf = Buffer.from("!");
      await expect(h.write(buf, 0, 1, 0)).rejects.toThrow();
    } finally {
      await h.close();
    }
  });
});
