import { existsSync } from "node:fs";
import { DBFFile, DELETED } from "dbffile";
import type { DataRootSet } from "../../config.js";
import { resolveRegisteredDbfPath } from "../../dbf/resolve-registered-dbf.js";

const SCHEDULE_DBF = "SCHEDULE.DBF";
const OPEN_OPTIONS = { encoding: "win1252" as const, readMode: "loose" as const };

function strId(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return "0";
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(Math.trunc(v));
  }
  const s = String(v).trim();
  return s.length > 0 ? s : "0";
}

function readStatus(row: Record<string, unknown>): number {
  const v = row.STATUS;
  if (v === null || v === undefined) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export type AppointmentStatusReadOutcome =
  | { kind: "ok"; status: number }
  | { kind: "not_found" }
  | { kind: "missing_schedule" }
  | { kind: "read_error" };

/**
 * Read-only scan of SCHEDULE.DBF for one row: uses only `ID` and `STATUS` fields.
 */
export async function readScheduleAppointmentStatus(
  dataRoot: DataRootSet,
  appointmentId: string,
): Promise<AppointmentStatusReadOutcome> {
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

  try {
    for await (const row of dbf) {
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      if (strId(rec, "ID") !== appointmentId) continue;
      return { kind: "ok", status: readStatus(rec) };
    }
  } catch {
    return { kind: "read_error" };
  }

  return { kind: "not_found" };
}
