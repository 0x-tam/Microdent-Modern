import { applyMigrations } from "./apply-migrations.js";
import { importAppointments } from "./import-appointments.js";
import { importDoctors } from "./import-doctors.js";
import { importMedicalSummary } from "./import-medical-summary.js";
import { importPatients } from "./import-patients.js";
import { importProcedures } from "./import-procedures.js";
import { importTreatments } from "./import-treatments.js";
import type { ImportRunStatus } from "./import-run.js";

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

/** Prints counts and status only — never row values or paths. */
export function printMirrorImportSafeReport(result: RunMirrorImportSafeResult): void {
  console.log(
    `migrations: applied=${result.migrations.applied} skipped=${result.migrations.skipped}`,
  );
  for (const step of result.steps) {
    console.log(
      `${step.table}: status=${step.status} rows=${step.rowCount} errors=${step.errorCount}`,
    );
  }
  console.log(`overall: ${result.overall}`);
}
