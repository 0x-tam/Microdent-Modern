import type { PatientProfileResponse } from "@microdent/contracts";
import { openDatabaseSync } from "./node-sqlite.js";

export type ReadPatientProfileSqliteOutcome =
  | { kind: "ok"; profile: PatientProfileResponse }
  | { kind: "not_found" }
  | { kind: "read_error" };

function activeFromSqlite(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? Math.trunc(value) : Math.trunc(Number(String(value)));
  if (n === 0) return false;
  if (n === 1) return true;
  return null;
}

/**
 * Read one patient profile from mirror `patients` (safe columns only).
 * Maps to the same DTO as {@link readPatientProfileFromDbf}; never returns raw SQL rows on the wire.
 */
export function readPatientProfileFromSqlite(
  sqlitePath: string,
  patientIdDigits: string,
): ReadPatientProfileSqliteOutcome {
  const sql = `SELECT patient_id, chart_number, display_name, phone_mask,
      reverse_name, active, doctor_id, entry_date, last_visit
    FROM patients
    WHERE patient_id = ?
      AND COALESCE(source_deleted, 0) = 0
    LIMIT 1`;

  try {
    const db = openDatabaseSync(sqlitePath, { readOnly: true });
    try {
      const row = db.prepare(sql).get(patientIdDigits) as
        | {
            patient_id: string;
            chart_number: string | null;
            display_name: string;
            phone_mask: string | null;
            reverse_name: string | null;
            active: number | null;
            doctor_id: string | null;
            entry_date: string | null;
            last_visit: string | null;
          }
        | undefined;

      if (!row) {
        return { kind: "not_found" };
      }

      const profile: PatientProfileResponse = {
        patientId: String(row.patient_id),
        chartNumber: row.chart_number,
        displayName: String(row.display_name),
        phoneMask: row.phone_mask,
        reverseName: row.reverse_name,
        active: activeFromSqlite(row.active),
        doctorId: row.doctor_id,
        entryDate: row.entry_date,
        lastVisit: row.last_visit,
      };

      return { kind: "ok", profile };
    } finally {
      db.close();
    }
  } catch {
    return { kind: "read_error" };
  }
}
