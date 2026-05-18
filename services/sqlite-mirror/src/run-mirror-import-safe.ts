import { applyMigrations } from "./apply-migrations.js";
import { importAppointments } from "./import-appointments.js";
import { importDoctors } from "./import-doctors.js";
import { importMedicalSummary } from "./import-medical-summary.js";
import { importPatients } from "./import-patients.js";
import { importProcedures } from "./import-procedures.js";
import { importScheduleRooms } from "./import-schedule-rooms.js";
import { importTreatments } from "./import-treatments.js";
import type { ImportRunStatus } from "./import-run.js";

/** Process exit code for `mirror:import-safe` — 0 only when overall is success. */
export function mirrorImportSafeExitCode(overall: ImportRunStatus): number {
  return overall === "success" ? 0 : 1;
}

export type MirrorImportStepStatus = "success" | "partial" | "failed" | "skipped";

export type MirrorImportStepResult = {
  table: string;
  status: MirrorImportStepStatus;
  rowCount: number;
  errorCount: number;
};

export type RunMirrorImportSafeOptions = {
  dataRoot: string;
  sqlitePath: string;
};

export type RunMirrorImportSafeResult = {
  migrations: { applied: number; skipped: number };
  steps: MirrorImportStepResult[];
  overall: ImportRunStatus;
};

function mergeOverall(steps: MirrorImportStepResult[]): ImportRunStatus {
  if (steps.some((s) => s.status === "failed")) return "failed";
  if (steps.some((s) => s.status === "partial")) return "partial";
  return "success";
}

/**
 * Applies migrations once, then imports all safe mirror tables in dependency order.
 */
export async function runMirrorImportSafe(
  options: RunMirrorImportSafeOptions,
): Promise<RunMirrorImportSafeResult> {
  const { dataRoot, sqlitePath } = options;

  const migrationResult = applyMigrations(sqlitePath);
  const steps: MirrorImportStepResult[] = [];

  const doctors = await importDoctors({ dataRoot, sqlitePath });
  steps.push({
    table: "doctors",
    status: doctors.status,
    rowCount: doctors.rowCount,
    errorCount: doctors.errorCount,
  });

  const procedures = await importProcedures({ dataRoot, sqlitePath });
  steps.push({
    table: "procedures",
    status: procedures.status,
    rowCount: procedures.rowCount,
    errorCount: procedures.errorCount,
  });

  const scheduleRooms = await importScheduleRooms({ dataRoot, sqlitePath });
  steps.push({
    table: "schedule_rooms",
    status: scheduleRooms.status,
    rowCount: scheduleRooms.rowCount,
    errorCount: scheduleRooms.errorCount,
  });

  const patients = await importPatients({ dataRoot, sqlitePath });
  steps.push({
    table: "patients",
    status: patients.status,
    rowCount: patients.patientsImported,
    errorCount: patients.errorCount,
  });

  const appointments = await importAppointments({ dataRoot, sqlitePath });
  steps.push({
    table: "appointments",
    status: appointments.status,
    rowCount: appointments.rowCount,
    errorCount: appointments.errorCount,
  });

  const medical = await importMedicalSummary({ dataRoot, sqlitePath });
  steps.push({
    table: "medical_summary",
    status: medical.status,
    rowCount: medical.rowCount,
    errorCount: medical.errorCount,
  });

  const treatments = await importTreatments({ dataRoot, sqlitePath });
  steps.push({
    table: "treatments",
    status: treatments.status,
    rowCount: treatments.rowCount,
    errorCount: treatments.errorCount,
  });

  return {
    migrations: {
      applied: migrationResult.appliedVersions.length,
      skipped: migrationResult.skippedVersions.length,
    },
    steps,
    overall: mergeOverall(steps),
  };
}

function padCell(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

/** PHI-safe stdout lines: table name, status, rowCount, errorCount only. */
export function formatMirrorImportSafeSummaryLines(result: RunMirrorImportSafeResult): string[] {
  const lines: string[] = [
    `migrations: applied=${result.migrations.applied} skipped=${result.migrations.skipped}`,
  ];

  const headers = ["table", "status", "rows", "errors"] as const;
  const body = result.steps.map((step) => ({
    table: step.table,
    status: step.status,
    rows: String(step.rowCount),
    errors: String(step.errorCount),
  }));

  const widths = headers.map((header) => {
    const values = body.map((row) => row[header].length);
    return Math.max(header.length, ...values);
  });

  lines.push(headers.map((header, i) => padCell(header, widths[i]!)).join("  "));
  lines.push(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of body) {
    lines.push(
      [padCell(row.table, widths[0]!), padCell(row.status, widths[1]!), padCell(row.rows, widths[2]!), padCell(row.errors, widths[3]!)].join(
        "  ",
      ),
    );
  }
  lines.push(`overall: ${result.overall}`);
  return lines;
}

/** Prints counts and status only — never row values or paths. */
export function printMirrorImportSafeReport(result: RunMirrorImportSafeResult): void {
  for (const line of formatMirrorImportSafeSummaryLines(result)) {
    console.log(line);
  }
}
