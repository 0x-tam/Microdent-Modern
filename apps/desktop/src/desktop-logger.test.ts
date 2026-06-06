import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDesktopLogger, exportSupportLogBundle } from "./desktop-logger.js";

describe("createDesktopLogger", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
  });

  it("creates the log directory and writes structured events", () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-logs-"));
    cleanup.push(dir);
    const logsDir = join(dir, "nested", "logs");
    const logger = createDesktopLogger(logsDir, {
      now: () => new Date("2026-06-06T00:00:00.000Z"),
    });

    logger.info("desktop start", { setupComplete: true, writeMode: "disabled" });

    expect(existsSync(logger.logFile)).toBe(true);
    const line = readFileSync(logger.logFile, "utf8").trim();
    expect(JSON.parse(line)).toEqual({
      ts: "2026-06-06T00:00:00.000Z",
      level: "info",
      event: "desktop_start",
      setupComplete: true,
      writeMode: "disabled",
    });
  });

  it("redacts path-like detail values instead of logging full clinic paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-logs-"));
    cleanup.push(dir);
    const logger = createDesktopLogger(dir);

    logger.warn("clinic_service_start", {
      dataRoot: "C:\\ClinicData\\Patient Name\\DATA",
      sqlitePath: "/Users/operator/Clinic Data/clinic.sqlite",
    });

    const text = readFileSync(logger.logFile, "utf8");
    expect(text).not.toContain("Patient Name");
    expect(text).not.toContain("/Users/operator");
    expect(text).toContain("<path:DATA>");
    expect(text).toContain("<path:clinic.sqlite>");
  });

  it("rotates bounded log files", () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-logs-"));
    cleanup.push(dir);
    const logger = createDesktopLogger(dir, { maxBytes: 10, maxFiles: 2 });
    writeFileSync(logger.logFile, "01234567890", "utf8");

    logger.error("after_rotate", { ok: false });

    expect(existsSync(logger.logFile)).toBe(true);
    expect(existsSync(`${logger.logFile}.1`)).toBe(true);
    expect(readFileSync(`${logger.logFile}.1`, "utf8")).toBe("01234567890");
  });

  it("exports a support-safe log bundle without raw paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-logs-"));
    cleanup.push(dir);
    writeFileSync(
      join(dir, "microdent-desktop.log"),
      [
        JSON.stringify({
          ts: "2026-06-06T00:00:00.000Z",
          level: "info",
          event: "startup",
          dataRoot: "C:\\Clinic\\Patient Folder\\DATA",
          sqlitePath: "/Users/operator/Clinic Data/clinic.sqlite",
        }),
        "raw unreadable /Users/operator/secret",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = exportSupportLogBundle(dir, {
      now: () => new Date("2026-06-06T01:02:03.000Z"),
    });
    const text = readFileSync(join(dir, result.fileName), "utf8");

    expect(result.fileName).toBe("microdent-support-log-2026-06-06T01-02-03-000Z.jsonl");
    expect(result.lineCount).toBe(2);
    expect(text).not.toContain("Patient Folder");
    expect(text).not.toContain("/Users/operator");
    expect(text).toContain("<path:DATA>");
    expect(text).toContain("<path:clinic.sqlite>");
    expect(text).toContain("unreadable_log_line_omitted");
  });
});
