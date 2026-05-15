import { existsSync } from "node:fs";
import { DBFFile, DELETED } from "dbffile";
import type { ScheduleAppointmentItem } from "@microdent/contracts";
import type { DataRootSet } from "../config.js";
import { mapScheduleRowToAppointment } from "./schedule-appointments.js";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";

const SCHEDULE_DBF = "SCHEDULE.DBF";
const OPEN_OPTIONS = { encoding: "win1252" as const, readMode: "loose" as const };

export type ReadAllScheduleAppointmentsOutcome =
  | { kind: "ok"; appointments: ScheduleAppointmentItem[] }
  | { kind: "missing_schedule" }
  | { kind: "read_error" };

/**
 * Full-file read of SCHEDULE.DBF for mirror import (no date filter).
 * Never exposes PAT_NAME, TELEPHONE, COMMENT text, or raw rows.
 */
export async function readAllScheduleAppointmentsForMirror(
  dataRoot: DataRootSet,
): Promise<ReadAllScheduleAppointmentsOutcome> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, SCHEDULE_DBF);
  } catch {
    return { kind: "read_error" };
  }
  if (!existsSync(abs)) {
    return { kind: "missing_schedule" };
  }

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, OPEN_OPTIONS);
  } catch {
    return { kind: "read_error" };
  }

  const appointments: ScheduleAppointmentItem[] = [];
  try {
    for await (const row of dbf) {
      if (row[DELETED]) continue;
      const mapped = mapScheduleRowToAppointment(row as Record<string, unknown>);
      if (mapped !== null) {
        appointments.push(mapped);
      }
    }
  } catch {
    return { kind: "read_error" };
  }

  return { kind: "ok", appointments };
}
