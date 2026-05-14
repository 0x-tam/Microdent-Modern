import { existsSync } from "node:fs";
import { DBFFile, DELETED } from "dbffile";
import type { DataRootSet } from "../config.js";
import type { ScheduleAppointmentItem, ScheduleAppointmentPatientSummary } from "@microdent/contracts";
import { buildDisplayName, strField, strIdField } from "./patient-dbf-helpers.js";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";

const PATIENT_DBF = "PATIENT.DBF";
const PATIENT_OPEN_OPTIONS = { encoding: "win1252" as const, readMode: "loose" as const };

function rowToPatientSummary(row: Record<string, unknown>): ScheduleAppointmentPatientSummary {
  const patientId = strIdField(row, "ID");
  const chartRaw = strField(row, "CASENB");
  return {
    patientId: patientId.length > 0 ? patientId : "0",
    displayName: buildDisplayName(row),
    chartNumber: chartRaw.length > 0 ? chartRaw : null,
  };
}

/**
 * Single sequential scan of PATIENT.DBF: fills summaries for ids still needed, stops early when all are found.
 * Missing file, path errors, or read failures yield an empty map (callers treat as all lookups missed).
 */
export async function buildPatientSummaryLookupMap(
  dataRoot: DataRootSet,
  patIds: ReadonlySet<string>,
): Promise<Map<string, ScheduleAppointmentPatientSummary>> {
  const out = new Map<string, ScheduleAppointmentPatientSummary>();
  if (patIds.size === 0) {
    return out;
  }

  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, PATIENT_DBF);
  } catch {
    return out;
  }
  if (!existsSync(abs)) {
    return out;
  }

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, PATIENT_OPEN_OPTIONS);
  } catch {
    return out;
  }

  const pending = new Set(patIds);
  try {
    for await (const row of dbf) {
      if (pending.size === 0) {
        break;
      }
      if (row[DELETED]) {
        continue;
      }
      const rec = row as Record<string, unknown>;
      const pid = strIdField(rec, "ID");
      if (pid.length === 0 || !pending.has(pid)) {
        continue;
      }
      out.set(pid, rowToPatientSummary(rec));
      pending.delete(pid);
    }
  } catch {
    return out;
  }

  return out;
}

export async function mergePatientSummariesIntoScheduleAppointments(
  dataRoot: DataRootSet,
  appointments: ScheduleAppointmentItem[],
): Promise<ScheduleAppointmentItem[]> {
  const ids = new Set<string>();
  for (const a of appointments) {
    if (a.patId !== "0") {
      ids.add(a.patId);
    }
  }
  const map = await buildPatientSummaryLookupMap(dataRoot, ids);
  return appointments.map((a) => ({
    ...a,
    patient: a.patId === "0" ? null : map.get(a.patId) ?? null,
  }));
}
