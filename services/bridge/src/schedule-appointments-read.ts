import type { BridgeConfig, DataRootSet } from "./config.js";
import { mergePatientSummariesIntoScheduleAppointments } from "./dbf/schedule-appointment-patients.js";
import {
  readScheduleAppointments,
  type ScheduleAppointmentsOutcome,
} from "./dbf/schedule-appointments.js";
import { isSqliteMirrorUsable } from "./sqlite/mirror-usable.js";
import { readScheduleAppointmentsFromSqlite } from "./sqlite/schedule-appointments.js";

/**
 * Schedule / patient appointment reads: SQLite mirror when configured and usable, else DBF scan
 * with PATIENT.DBF summary merge. Invalid mirror falls back to DBF without changing response shape.
 */
export async function readScheduleAppointmentsForApi(
  bridgeConfig: BridgeConfig & { dataRoot: DataRootSet },
  fromIso: string,
  toIso: string,
  roomFilter?: number,
  patientIdFilter?: string,
): Promise<ScheduleAppointmentsOutcome> {
  const dr = bridgeConfig.dataRoot;

  if (isSqliteMirrorUsable(bridgeConfig.sqlitePath, "appointments")) {
    const sqliteOutcome = readScheduleAppointmentsFromSqlite(
      bridgeConfig.sqlitePath.path,
      fromIso,
      toIso,
      roomFilter,
      patientIdFilter,
    );
    if (sqliteOutcome.kind === "ok") {
      return sqliteOutcome;
    }
  }

  const dbfOutcome = await readScheduleAppointments(dr, fromIso, toIso, roomFilter, patientIdFilter);
  if (dbfOutcome.kind !== "ok") {
    return dbfOutcome;
  }

  const appointments = await mergePatientSummariesIntoScheduleAppointments(dr, dbfOutcome.appointments);
  return { kind: "ok", appointments };
}
