import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  previewLatestSupportLogExport,
  summarizeSupportDiagnostics,
} from "./support-diagnostics.js";

describe("summarizeSupportDiagnostics", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
  });

  it("returns support-safe counts and filenames only", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-support-diagnostics-"));
    cleanup.push(root);
    const logsDir = join(root, "Operator Name", "logs");
    const crashDumpsDir = join(root, "Operator Name", "crash-dumps");
    mkdirSync(logsDir, { recursive: true });
    mkdirSync(crashDumpsDir, { recursive: true });
    writeFileSync(join(logsDir, "microdent-desktop.log"), "{}\n", "utf8");
    writeFileSync(join(logsDir, "microdent-desktop.log.1"), "{}\n", "utf8");
    writeFileSync(join(logsDir, "microdent-support-log-2026-06-06T01-02-03-000Z.jsonl"), "{}\n", "utf8");
    writeFileSync(join(crashDumpsDir, "crash-1.dmp"), "dump", "utf8");
    writeFileSync(join(crashDumpsDir, "crash-details.extra"), "metadata", "utf8");
    writeFileSync(join(crashDumpsDir, "ignored.txt"), "not included", "utf8");

    const result = summarizeSupportDiagnostics({ logsDir, crashDumpsDir });

    expect(result.ok).toBe(true);
    expect(result.logFileCount).toBe(2);
    expect(result.supportExportCount).toBe(1);
    expect(result.crashDumpCount).toBe(2);
    expect(result.crashDumpFiles).toHaveLength(2);
    expect(result.crashDumpFiles.map((file) => file.fileName).sort()).toEqual([
      "crash-1.dmp",
      "crash-details.extra",
    ]);
    expect(result.crashDumpFiles.map((file) => file.kind).sort()).toEqual(["dump", "metadata"]);
    expect(result.latestSupportExportFileName).toBe("microdent-support-log-2026-06-06T01-02-03-000Z.jsonl");
    expect(JSON.stringify(result)).not.toContain("Operator Name");
    expect(JSON.stringify(result)).not.toContain(root);
  });

  it("caps crash metadata and sanitizes unusual filenames", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-support-diagnostics-"));
    cleanup.push(root);
    const logsDir = join(root, "logs");
    const crashDumpsDir = join(root, "crash-dumps");
    mkdirSync(logsDir, { recursive: true });
    mkdirSync(crashDumpsDir, { recursive: true });
    for (let i = 0; i < 7; i += 1) {
      writeFileSync(join(crashDumpsDir, `crash:${i}.dmp`), "dump", "utf8");
    }

    const result = summarizeSupportDiagnostics({ logsDir, crashDumpsDir });
    const serialized = JSON.stringify(result);

    expect(result.crashDumpCount).toBe(7);
    expect(result.crashDumpFiles).toHaveLength(5);
    expect(result.crashDumpFiles.every((file) => !file.fileName.includes(":"))).toBe(true);
    expect(result.crashDumpFiles.every((file) => file.sizeBytes > 0)).toBe(true);
    expect(serialized).not.toContain(crashDumpsDir);
  });

  it("previews latest support export with capped sanitized lines", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-support-diagnostics-"));
    cleanup.push(root);
    const logsDir = join(root, "Operator Name", "logs");
    mkdirSync(logsDir, { recursive: true });
    writeFileSync(
      join(logsDir, "microdent-support-log-2026-06-06T01-02-03-000Z.jsonl"),
      [
        JSON.stringify({
          level: "info",
          event: "desktop_start",
          dataRoot: "/Users/operator/Clinic Data/DATA",
          writeMode: "disabled",
        }),
        "not-json /Users/operator/secret",
        JSON.stringify({ level: "error", event: "clinic_service_failed", code: "E_START" }),
      ].join("\n"),
      "utf8",
    );

    const result = previewLatestSupportLogExport({ logsDir, maxLines: 2 });
    const serialized = JSON.stringify(result);

    expect(result.ok).toBe(true);
    expect(result.lineCount).toBe(2);
    expect(result.fileName).toBe("microdent-support-log-2026-06-06T01-02-03-000Z.jsonl");
    expect(result.lines[0]).toMatchObject({
      level: "info",
      event: "desktop_start",
    });
    expect(result.lines[0]?.summary).toContain("dataRoot=<path>");
    expect(result.lines[1]?.event).toBe("unreadable_log_line_omitted");
    expect(serialized).not.toContain("/Users/operator");
    expect(serialized).not.toContain("Clinic Data");
  });
});
