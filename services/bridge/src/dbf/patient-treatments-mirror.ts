import { existsSync } from "node:fs";
import { DBFFile, DELETED } from "dbffile";
import type { PatientTreatmentItem } from "@microdent/contracts";
import type { DataRootSet } from "../config.js";
import { readReferenceDoctorsFromDbf } from "./reference-doctors.js";
import { readReferenceProcedures } from "./reference-procedures.js";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";
import {
  buildDoctorLabelLookup,
  buildProcedureLabelLookup,
  mapOperTblRowToTreatmentItem,
  rowOperTblPatientId,
} from "./patient-treatments.js";

const OPERTBL_DBF = "OPERTBL.DBF";
const OPEN_OPTIONS = { encoding: "win1252" as const, readMode: "loose" as const };

export type ReadAllTreatmentsOutcome =
  | { kind: "ok"; treatments: PatientTreatmentItem[] }
  | { kind: "missing_table" }
  | { kind: "read_error" };

/**
 * Full-file read of OPERTBL.DBF for mirror import (all patients, no per-patient cap).
 * Uses loose mode. Never returns memo text, fees, or raw rows.
 */
export async function readAllTreatmentsForMirror(
  dataRoot: DataRootSet,
): Promise<ReadAllTreatmentsOutcome> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, OPERTBL_DBF);
  } catch {
    return { kind: "read_error" };
  }
  if (!existsSync(abs)) {
    return { kind: "missing_table" };
  }

  const procedureLookup = new Map<string, string | null>();
  const procOutcome = await readReferenceProcedures(dataRoot);
  if (procOutcome.kind === "ok") {
    for (const [k, v] of buildProcedureLabelLookup(procOutcome.procedures)) {
      procedureLookup.set(k, v);
    }
  }

  const doctorLookup = new Map<string, string>();
  const docOutcome = await readReferenceDoctorsFromDbf(dataRoot);
  if (docOutcome.kind === "ok") {
    for (const [k, v] of buildDoctorLabelLookup(docOutcome.doctors)) {
      doctorLookup.set(k, v);
    }
  }

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, OPEN_OPTIONS);
  } catch {
    return { kind: "read_error" };
  }

  const treatments: PatientTreatmentItem[] = [];
  try {
    for await (const row of dbf) {
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      const patientId = rowOperTblPatientId(rec);
      if (patientId === null) continue;
      const item = mapOperTblRowToTreatmentItem(rec, patientId, procedureLookup, doctorLookup);
      if (item !== null) {
        treatments.push(item);
      }
    }
  } catch {
    return { kind: "read_error" };
  }

  return { kind: "ok", treatments };
}
