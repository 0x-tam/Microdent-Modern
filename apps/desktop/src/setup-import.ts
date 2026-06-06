import { spawn } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveImportNodeBinary, resolveSqliteMirrorJsonCli } from "./runtime-install-root.js";

export type SetupImportStepStatus = "success" | "partial" | "failed" | "skipped";

export type SetupImportStep = {
  key: string;
  label: string;
  status: SetupImportStepStatus;
  rowCount: number;
  errorCount: number;
};

export type SafeSetupImportSummary = {
  overall: "success" | "partial" | "failed";
  coreReady: boolean;
  steps: SetupImportStep[];
};

export type SetupImportProgressPhase =
  | "validating"
  | "creating-folders"
  | "migrating"
  | "doctors"
  | "procedures"
  | "rooms"
  | "patients"
  | "appointments"
  | "medical"
  | "treatments"
  | "verifying"
  | "finishing";

export type SetupImportProgress = {
  phase: SetupImportProgressPhase;
  label: string;
  percent: number;
};

export type MirrorImportRawStep = {
  table: string;
  status: SetupImportStepStatus;
  rowCount: number;
  errorCount: number;
};

export type MirrorImportRawResult = {
  overall: "success" | "partial" | "failed";
  steps: MirrorImportRawStep[];
};

export type RunMirrorImport = (options: {
  dataRoot: string;
  sqlitePath: string;
}) => Promise<MirrorImportRawResult>;

export type RunSetupImportOptions = {
  installRoot: string;
  dataRoot: string;
  sqlitePath: string;
  nodeBinary?: string;
  runImport?: RunMirrorImport;
  onProgress?: (progress: SetupImportProgress) => void;
};

const STEP_LABELS: Record<string, { label: string; phase: SetupImportProgressPhase; percent: number }> = {
  doctors: { label: "Loading providers", phase: "doctors", percent: 22 },
  procedures: { label: "Loading treatment references", phase: "procedures", percent: 34 },
  schedule_rooms: { label: "Loading rooms", phase: "rooms", percent: 44 },
  patients: { label: "Loading patients", phase: "patients", percent: 58 },
  appointments: { label: "Loading schedule", phase: "appointments", percent: 72 },
  medical_summary: { label: "Loading medical overview", phase: "medical", percent: 84 },
  treatments: { label: "Loading treatment history", phase: "treatments", percent: 92 },
};

const CORE_TABLES = new Set(["doctors", "patients", "appointments"]);

function emit(
  onProgress: RunSetupImportOptions["onProgress"],
  phase: SetupImportProgressPhase,
  label: string,
  percent: number,
): void {
  onProgress?.({ phase, label, percent });
}

function tempSqlitePath(sqlitePath: string): string {
  return `${sqlitePath}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function previousSqlitePath(sqlitePath: string): string {
  return `${sqlitePath}.previous`;
}

function mapStep(step: MirrorImportRawStep): SetupImportStep {
  const meta = STEP_LABELS[step.table] ?? {
    label: "Loading clinic data",
    phase: "finishing" as const,
    percent: 95,
  };
  return {
    key: step.table,
    label: meta.label,
    status: step.status,
    rowCount: step.rowCount,
    errorCount: step.errorCount,
  };
}

function isCoreReady(steps: SetupImportStep[]): boolean {
  const byKey = new Map(steps.map((step) => [step.key, step]));
  for (const key of CORE_TABLES) {
    const step = byKey.get(key);
    if (!step || step.status === "failed" || step.status === "skipped") {
      return false;
    }
  }
  return true;
}

function isMirrorImportRawResult(value: unknown): value is MirrorImportRawResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { overall?: unknown; steps?: unknown };
  if (!["success", "partial", "failed"].includes(String(candidate.overall))) return false;
  if (!Array.isArray(candidate.steps)) return false;
  return candidate.steps.every((step) => {
    if (!step || typeof step !== "object") return false;
    const raw = step as Record<string, unknown>;
    return (
      typeof raw.table === "string" &&
      ["success", "partial", "failed", "skipped"].includes(String(raw.status)) &&
      typeof raw.rowCount === "number" &&
      typeof raw.errorCount === "number"
    );
  });
}

export async function runImportInChildProcess(options: {
  installRoot: string;
  dataRoot: string;
  sqlitePath: string;
  nodeBinary?: string;
}): Promise<MirrorImportRawResult> {
  const cli = resolveSqliteMirrorJsonCli(options.installRoot);
  const nodeBin = resolveImportNodeBinary({
    installRoot: options.installRoot,
    explicitNodeBinary: options.nodeBinary,
    envNodeBinary: process.env.MICRODENT_NODE_BINARY,
    fallbackNodeBinary: process.execPath,
  });

  return await new Promise((resolve, reject) => {
    const child = spawn(
      nodeBin,
      [cli, "--data-root", options.dataRoot, "--sqlite-path", options.sqlitePath],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", () => {
      reject(new Error("Local copy import process could not start."));
    });
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error("Local copy import process failed."));
        return;
      }
      try {
        const parsed: unknown = JSON.parse(stdout);
        if (!isMirrorImportRawResult(parsed)) {
          reject(new Error("Local copy import process returned an invalid summary."));
          return;
        }
        resolve(parsed);
      } catch {
        // Keep raw child output out of all caller-facing errors; it may contain paths.
        void stderr;
        reject(new Error("Local copy import process returned an unreadable summary."));
      }
    });
  });
}

function promoteTempSqlite(tempPath: string, finalPath: string): void {
  const previousPath = previousSqlitePath(finalPath);
  rmSync(previousPath, { force: true });

  let movedExisting = false;
  if (existsSync(finalPath)) {
    renameSync(finalPath, previousPath);
    movedExisting = true;
  }

  try {
    renameSync(tempPath, finalPath);
    rmSync(previousPath, { force: true });
  } catch (err) {
    if (movedExisting && existsSync(previousPath) && !existsSync(finalPath)) {
      renameSync(previousPath, finalPath);
    }
    throw err;
  }
}

export async function runSetupImport(options: RunSetupImportOptions): Promise<SafeSetupImportSummary> {
  const { installRoot, dataRoot, sqlitePath, runImport, onProgress } = options;
  const mirrorDir = dirname(sqlitePath);
  const tmpPath = tempSqlitePath(sqlitePath);

  emit(onProgress, "validating", "Checking clinic data", 8);
  emit(onProgress, "creating-folders", "Preparing local copy", 14);
  mkdirSync(mirrorDir, { recursive: true });
  rmSync(tmpPath, { force: true });

  try {
    emit(onProgress, "migrating", "Preparing local copy", 18);
    const result = await (runImport ?? ((args) => runImportInChildProcess({
      installRoot,
      dataRoot: args.dataRoot,
      sqlitePath: args.sqlitePath,
      nodeBinary: options.nodeBinary,
    })))({
      dataRoot,
      sqlitePath: tmpPath,
    });
    const steps = result.steps.map(mapStep);
    for (const step of result.steps) {
      const meta = STEP_LABELS[step.table];
      if (meta) {
        emit(onProgress, meta.phase, meta.label, meta.percent);
      }
    }

    emit(onProgress, "verifying", "Checking workspace readiness", 96);
    const coreReady = isCoreReady(steps);
    const overall: SafeSetupImportSummary["overall"] = coreReady ? result.overall : "failed";
    const summary: SafeSetupImportSummary = { overall, coreReady, steps };

    if (!coreReady) {
      rmSync(tmpPath, { force: true });
      return summary;
    }

    promoteTempSqlite(tmpPath, sqlitePath);
    emit(onProgress, "finishing", "Finishing setup", 100);
    return summary;
  } catch {
    rmSync(tmpPath, { force: true });
    throw new Error("Local copy import failed.");
  }
}
