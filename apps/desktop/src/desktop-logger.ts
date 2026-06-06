import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, win32 } from "node:path";

export type DesktopLogLevel = "info" | "warn" | "error";

export type DesktopLogDetails = Record<string, string | number | boolean | null | undefined>;

export type DesktopLogger = {
  readonly logFile: string;
  info(event: string, details?: DesktopLogDetails): void;
  warn(event: string, details?: DesktopLogDetails): void;
  error(event: string, details?: DesktopLogDetails): void;
};

export type DesktopLoggerOptions = {
  maxBytes?: number;
  maxFiles?: number;
  now?: () => Date;
};

export type SupportLogExportResult = {
  fileName: string;
  lineCount: number;
};

export type SupportLogExportOptions = {
  maxFiles?: number;
  maxBytes?: number;
  now?: () => Date;
};

const DEFAULT_MAX_BYTES = 512 * 1024;
const DEFAULT_MAX_FILES = 5;

function safeEventName(event: string): string {
  return event.replace(/[^a-z0-9_.:-]+/gi, "_").slice(0, 80) || "event";
}

function safeDetailValue(value: string | number | boolean | null | undefined): string | number | boolean | null {
  if (value === undefined) return null;
  if (typeof value !== "string") return value;
  if (value.length === 0) return "";
  if (/[\\/]/.test(value)) {
    const leaf = value.includes("\\") ? win32.basename(value) : basename(value);
    return `<path:${leaf}>`;
  }
  return value.replace(/[^\w .:@-]+/g, "_").slice(0, 160);
}

function safeLogObject(value: unknown): Record<string, string | number | boolean | null> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "boolean" ||
      rawValue === null ||
      rawValue === undefined
    ) {
      result[safeEventName(key)] = safeDetailValue(rawValue);
    }
  }
  return result;
}

function rotateIfNeeded(logFile: string, maxBytes: number, maxFiles: number): void {
  if (!existsSync(logFile)) return;
  if (statSync(logFile).size < maxBytes) return;

  for (let i = maxFiles - 1; i >= 1; i--) {
    const from = `${logFile}.${i}`;
    const to = `${logFile}.${i + 1}`;
    if (existsSync(from)) {
      if (existsSync(to)) {
        rmSync(to, { force: true });
      }
      renameSync(from, to);
    }
  }
  renameSync(logFile, `${logFile}.1`);
}

export function createDesktopLogger(
  logsDir: string,
  options: DesktopLoggerOptions = {},
): DesktopLogger {
  mkdirSync(logsDir, { recursive: true });
  const logFile = join(logsDir, "microdent-desktop.log");
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const now = options.now ?? (() => new Date());

  function write(level: DesktopLogLevel, event: string, details: DesktopLogDetails = {}): void {
    rotateIfNeeded(logFile, maxBytes, maxFiles);
    const safeDetails = Object.fromEntries(
      Object.entries(details).map(([key, value]) => [safeEventName(key), safeDetailValue(value)]),
    );
    appendFileSync(
      logFile,
      `${JSON.stringify({
        ts: now().toISOString(),
        level,
        event: safeEventName(event),
        ...safeDetails,
      })}\n`,
      "utf8",
    );
  }

  return {
    logFile,
    info: (event, details) => write("info", event, details),
    warn: (event, details) => write("warn", event, details),
    error: (event, details) => write("error", event, details),
  };
}

export function exportSupportLogBundle(
  logsDir: string,
  options: SupportLogExportOptions = {},
): SupportLogExportResult {
  mkdirSync(logsDir, { recursive: true });
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const now = options.now ?? (() => new Date());
  const stamp = now().toISOString().replace(/[:.]/g, "-");
  const fileName = `microdent-support-log-${stamp}.jsonl`;
  const outputFile = join(logsDir, fileName);
  const sourceFiles = [
    join(logsDir, "microdent-desktop.log"),
    ...Array.from({ length: Math.max(0, maxFiles) }, (_, index) =>
      join(logsDir, `microdent-desktop.log.${index + 1}`),
    ),
  ];

  let writtenBytes = 0;
  let lineCount = 0;
  const output: string[] = [];

  for (const sourceFile of sourceFiles) {
    if (!existsSync(sourceFile) || sourceFile === outputFile) continue;
    const text = readFileSync(sourceFile, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      let safeRecord: Record<string, string | number | boolean | null> | null = null;
      try {
        safeRecord = safeLogObject(JSON.parse(line));
      } catch {
        safeRecord = {
          level: "warn",
          event: "unreadable_log_line_omitted",
        };
      }
      if (!safeRecord) continue;
      const safeLine = `${JSON.stringify(safeRecord)}\n`;
      if (writtenBytes + Buffer.byteLength(safeLine, "utf8") > maxBytes) break;
      output.push(safeLine);
      writtenBytes += Buffer.byteLength(safeLine, "utf8");
      lineCount += 1;
    }
    if (writtenBytes >= maxBytes) break;
  }

  if (output.length === 0) {
    output.push(`${JSON.stringify({
      ts: now().toISOString(),
      level: "info",
      event: "support_log_empty",
    })}\n`);
    lineCount = 1;
  }

  writeFileSync(outputFile, output.join(""), "utf8");
  return { fileName, lineCount };
}
