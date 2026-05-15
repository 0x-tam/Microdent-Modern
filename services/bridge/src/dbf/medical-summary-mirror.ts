import { existsSync } from "node:fs";
import { DBFFile, DELETED } from "dbffile";
import type { PatientMedicalSummaryResponse } from "@microdent/contracts";
import type { DataRootSet } from "../config.js";
import {
  pickPreferredMedicalRow,
  rowPatientIdMatchesMedical,
  toMedicalSummary,
} from "./patient-medical-summary.js";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";

const MEDICAL_DBF = "MEDICAL.DBF";
const OPEN_OPTIONS = { encoding: "win1252" as const, readMode: "loose" as const };

export type ReadAllMedicalSummariesOutcome =
  | { kind: "ok"; summaries: PatientMedicalSummaryResponse[] }
  | { kind: "missing_table" }
  | { kind: "read_error" };

/**
 * Full-file read of MEDICAL.DBF: one summary per PATIENT_ID (latest questionnaire row).
 * Never exposes PROBLEM, ALLERGY_TO, NOTES, or raw rows.
 */
export async function readAllMedicalSummariesForMirror(
  dataRoot: DataRootSet,
): Promise<ReadAllMedicalSummariesOutcome> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, MEDICAL_DBF);
  } catch {
    return { kind: "read_error" };
  }
  if (!existsSync(abs)) {
    return { kind: "missing_table" };
  }

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, OPEN_OPTIONS);
  } catch {
    return { kind: "read_error" };
  }

  const byPatient = new Map<string, Record<string, unknown>>();
  try {
    for await (const row of dbf) {
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      const patientId = rowPatientIdMatchesMedical(rec);
      if (patientId === null) continue;
      const current = byPatient.get(patientId) ?? null;
      byPatient.set(patientId, pickPreferredMedicalRow(current, rec));
    }
  } catch {
    return { kind: "read_error" };
  }

  const summaries: PatientMedicalSummaryResponse[] = [];
  for (const [patientId, chosen] of byPatient) {
    summaries.push(toMedicalSummary(chosen, patientId));
  }

  return { kind: "ok", summaries };
}
