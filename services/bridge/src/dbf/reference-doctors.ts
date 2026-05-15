import { existsSync } from "node:fs";
import { DBFFile, DELETED } from "dbffile";
import type { ReferenceDoctorItem } from "@microdent/contracts";
import type { DataRootSet } from "../config.js";
import { doctorIdFromRow, logicalToBoolOrNull, strField } from "./patient-dbf-helpers.js";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";

const DOCTORS_DBF = "DOCTORS.DBF";
const OPEN_OPTIONS = { encoding: "win1252" as const, readMode: "loose" as const };

function displayNameFromRow(row: Record<string, unknown>, doctorId: string): string {
  const name = strField(row, "NAME");
  if (name.length > 0) return name;
  return `Doctor ${doctorId}`;
}

/**
 * `SCHEDULE` is `N` 1,0 in legacy headers — not a FoxPro logical. Map 0/1 only; otherwise null.
 */
function activeFromScheduleField(row: Record<string, unknown>): boolean | null {
  const v = row.SCHEDULE;
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.trunc(v);
    if (n === 0) return false;
    if (n === 1) return true;
    return null;
  }
  const s = String(v).trim();
  if (s === "0") return false;
  if (s === "1") return true;
  return logicalToBoolOrNull(v);
}

function toReferenceDoctor(row: Record<string, unknown>): ReferenceDoctorItem | null {
  const doctorId = doctorIdFromRow(row);
  if (doctorId === null) return null;
  return {
    doctorId,
    displayName: displayNameFromRow(row, doctorId),
    active: activeFromScheduleField(row),
  };
}

export type ReadReferenceDoctorsOutcome =
  | { kind: "ok"; doctors: ReferenceDoctorItem[] }
  | { kind: "missing_table" }
  | { kind: "read_error" };

/**
 * Read-only scan of `DOCTORS.DBF`. Returns id + display label (+ optional `active`); no PII columns.
 */
export async function readReferenceDoctorsFromDbf(dataRoot: DataRootSet): Promise<ReadReferenceDoctorsOutcome> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, DOCTORS_DBF);
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

  const doctors: ReferenceDoctorItem[] = [];
  try {
    for await (const row of dbf) {
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      const item = toReferenceDoctor(rec);
      if (item !== null) {
        doctors.push(item);
      }
    }
  } catch {
    return { kind: "read_error" };
  }

  doctors.sort((a, b) => {
    const na = Number(a.doctorId);
    const nb = Number(b.doctorId);
    if (na !== nb) return na - nb;
    return a.doctorId.localeCompare(b.doctorId);
  });

  return { kind: "ok", doctors };
}
