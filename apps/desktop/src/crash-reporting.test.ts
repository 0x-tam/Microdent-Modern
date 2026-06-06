import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configureLocalCrashReporting } from "./crash-reporting.js";
import { createDesktopLogger } from "./desktop-logger.js";

describe("configureLocalCrashReporting", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
  });

  it("configures Electron crash reporting as local-only", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-crash-reporting-"));
    cleanup.push(root);
    const crashDumpsDir = join(root, "crash-dumps");
    const setPath = vi.fn();
    const start = vi.fn();

    configureLocalCrashReporting({
      app: { setPath },
      crashReporter: { start },
      crashDumpsDir,
    });

    expect(existsSync(crashDumpsDir)).toBe(true);
    expect(setPath).toHaveBeenCalledWith("crashDumps", crashDumpsDir);
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        productName: "Microdent Modern",
        submitURL: "",
        uploadToServer: false,
      }),
    );
  });

  it("logs only a redacted crash dump path", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-crash-reporting-"));
    cleanup.push(root);
    const logger = createDesktopLogger(join(root, "logs"));

    configureLocalCrashReporting({
      app: { setPath: vi.fn() },
      crashReporter: { start: vi.fn() },
      crashDumpsDir: join(root, "Operator", "crash-dumps"),
      logger,
    });

    expect(existsSync(logger.logFile)).toBe(true);
    const text = readFileSync(logger.logFile, "utf8");
    expect(text).not.toContain("Operator");
    expect(text).toContain("<path:crash-dumps>");
  });
});
