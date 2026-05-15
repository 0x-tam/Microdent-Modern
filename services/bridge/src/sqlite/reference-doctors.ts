import type { ReferenceDoctorItem } from "@microdent/contracts";
import { openDatabaseSync } from "./node-sqlite.js";

export type ReadReferenceDoctorsSqliteOutcome =
  | { kind: "ok"; doctors: ReferenceDoctorItem[] }
  | { kind: "read_error" };

function activeFromSqlite(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? Math.trunc(value) : Math.trunc(Number(String(value)));
  if (n === 0) return false;
  if (n === 1) return true;
  return null;
}

/**
 * Read doctor reference rows from the SQLite mirror (`doctors` table).
 * Maps to the same DTO shape as {@link readReferenceDoctorsFromDbf}; never returns raw SQL columns on the wire.
 */
export function readReferenceDoctorsFromSqlite(sqlitePath: string): ReadReferenceDoctorsSqliteOutcome {
  try {
    const db = openDatabaseSync(sqlitePath, { readOnly: true });
    try {
      const rows = db
        .prepare(
          `SELECT doctor_id, display_label, active
           FROM doctors
           WHERE COALESCE(source_deleted, 0) = 0
           ORDER BY CAST(doctor_id AS INTEGER), doctor_id`,
        )
        .all() as { doctor_id: string; display_label: string; active: number | null }[];

      const doctors: ReferenceDoctorItem[] = rows.map((row) => ({
        doctorId: String(row.doctor_id),
        displayName: String(row.display_label),
        active: activeFromSqlite(row.active),
      }));

      return { kind: "ok", doctors };
    } finally {
      db.close();
    }
  } catch {
    return { kind: "read_error" };
  }
}
