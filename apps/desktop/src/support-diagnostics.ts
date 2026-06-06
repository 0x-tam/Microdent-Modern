import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";

export type SupportDiagnosticsSummary = {
  ok: boolean;
  logFileCount: number;
  supportExportCount: number;
  crashDumpCount: number;
  crashDumpFiles: SupportDiagnosticsCrashDumpFile[];
  latestLogUpdatedAt: string | null;
  latestCrashDumpUpdatedAt: string | null;
  latestSupportExportFileName: string | null;
  message: string;
};

export type SupportDiagnosticsCrashDumpFile = {
  fileName: string;
  kind: "dump" | "metadata" | "other";
  sizeBytes: number;
  updatedAt: string;
};

export type SupportDiagnosticsPreviewLine = {
  index: number;
  level: string;
  event: string;
  summary: string;
};

export type SupportDiagnosticsPreview = {
  ok: boolean;
  fileName: string | null;
  lineCount: number;
  lines: SupportDiagnosticsPreviewLine[];
  message: string;
};

function latestMtimeIso(files: string[]): string | null {
  let latest = 0;
  for (const file of files) {
    try {
      latest = Math.max(latest, statSync(file).mtimeMs);
    } catch {
      // Ignore files that disappear while summarizing diagnostics.
    }
  }
  return latest > 0 ? new Date(latest).toISOString() : null;
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => `${dir}/${entry.name}`);
  } catch {
    return [];
  }
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w .@()-]+/g, "_").slice(0, 160);
}

function sanitizePreviewValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value !== "string") return "";
  if (/[\\/]/.test(value)) return "<path>";
  return value.replace(/[^\w .:@-]+/g, "_").slice(0, 120);
}

function supportExportFiles(logsDir: string): string[] {
  return listFiles(logsDir).filter((file) =>
    /^microdent-support-log-[\w.-]+\.jsonl$/i.test(basename(file)),
  );
}

function crashDumpKind(fileName: string): SupportDiagnosticsCrashDumpFile["kind"] {
  if (/\.(dmp|dump)$/i.test(fileName)) return "dump";
  if (/\.(json|extra)$/i.test(fileName)) return "metadata";
  return "other";
}

function crashDumpMetadata(files: string[], limit = 5): SupportDiagnosticsCrashDumpFile[] {
  return files
    .map((file) => {
      try {
        const stats = statSync(file);
        const fileName = sanitizeFileName(basename(file));
        return {
          fileName,
          kind: crashDumpKind(fileName),
          sizeBytes: Math.max(0, stats.size),
          updatedAt: new Date(stats.mtimeMs).toISOString(),
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is SupportDiagnosticsCrashDumpFile => item !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export function summarizeSupportDiagnostics(options: {
  logsDir: string;
  crashDumpsDir: string;
}): SupportDiagnosticsSummary {
  const logFiles = listFiles(options.logsDir).filter((file) =>
    /^microdent-desktop\.log(?:\.\d+)?$/i.test(basename(file)),
  );
  const supportExports = supportExportFiles(options.logsDir);
  const crashDumpFiles = listFiles(options.crashDumpsDir).filter((file) =>
    /\.(dmp|dump|json|extra)$/i.test(basename(file)),
  );
  const crashDumpFilesPreview = crashDumpMetadata(crashDumpFiles);
  const latestSupportExport = supportExports
    .map(basename)
    .sort()
    .at(-1) ?? null;

  return {
    ok: true,
    logFileCount: logFiles.length,
    supportExportCount: supportExports.length,
    crashDumpCount: crashDumpFiles.length,
    crashDumpFiles: crashDumpFilesPreview,
    latestLogUpdatedAt: latestMtimeIso(logFiles),
    latestCrashDumpUpdatedAt: latestMtimeIso(crashDumpFiles),
    latestSupportExportFileName: latestSupportExport,
    message:
      "Diagnostics summary loaded. Counts and filenames are support-safe; folder paths and log contents stay hidden.",
  };
}

export function previewLatestSupportLogExport(options: {
  logsDir: string;
  maxLines?: number;
}): SupportDiagnosticsPreview {
  const maxLines = Math.max(1, Math.min(options.maxLines ?? 8, 20));
  const latest = supportExportFiles(options.logsDir).sort().at(-1) ?? null;
  if (!latest) {
    return {
      ok: false,
      fileName: null,
      lineCount: 0,
      lines: [],
      message: "No support log export is available yet. Export a support log first.",
    };
  }

  const lines = readFileSync(latest, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(0, maxLines)
    .map((line, index) => {
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        const level = sanitizePreviewValue(parsed.level) || "info";
        const event = sanitizePreviewValue(parsed.event) || "event";
        const details = Object.entries(parsed)
          .filter(([key]) => !["ts", "level", "event"].includes(key))
          .slice(0, 4)
          .map(([key, value]) => `${sanitizePreviewValue(key)}=${sanitizePreviewValue(value)}`)
          .join(", ");
        return {
          index: index + 1,
          level,
          event,
          summary: details || "No additional details",
        };
      } catch {
        return {
          index: index + 1,
          level: "warn",
          event: "unreadable_log_line_omitted",
          summary: "Line omitted",
        };
      }
    });

  return {
    ok: true,
    fileName: basename(latest),
    lineCount: lines.length,
    lines,
    message: "Support log preview loaded. Values are sanitized and capped.",
  };
}
