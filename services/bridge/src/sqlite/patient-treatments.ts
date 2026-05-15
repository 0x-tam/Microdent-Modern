import type { PatientTreatmentItem, PatientTreatmentsResponse } from "@microdent/contracts";
import {
  comparePatientTreatmentItems,
  PATIENT_TREATMENTS_MAX,
  type ReadPatientTreatmentsOutcome,
} from "../dbf/patient-treatments.js";
import { openDatabaseSync } from "./node-sqlite.js";

const PRIVACY_NOTE =
  "Procedure memos, per-line descriptions, fee columns, and raw OPERTBL rows are never exposed by this route." as const;

type TreatmentMirrorRow = {
  treatment_id: string;
  patient_id: string;
  treatment_date: string | null;
  tooth: number | null;
  procedure_code: string | null;
  procedure_label: string | null;
  doctor_id: string | null;
  doctor_label: string | null;
  status: number | null;
  has_description: number | null;
};

function intOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? Math.trunc(value) : Math.trunc(Number(String(value)));
  return Number.isFinite(n) ? n : null;
}

function hasDescriptionFromSqlite(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const n = typeof value === "number" ? Math.trunc(value) : Math.trunc(Number(String(value)));
  return n !== 0;
}

function mapMirrorRowToTreatmentItem(row: TreatmentMirrorRow): PatientTreatmentItem {
  return {
    treatmentId: String(row.treatment_id),
    patientId: String(row.patient_id),
    date: row.treatment_date,
    tooth: intOrNull(row.tooth),
    procedureCode: row.procedure_code,
    procedureLabel: row.procedure_label,
    doctorId: row.doctor_id,
    doctorLabel: row.doctor_label,
    status: intOrNull(row.status),
    hasDescription: hasDescriptionFromSqlite(row.has_description),
  };
}

/**
 * Read treatment lines for one patient from the SQLite mirror (`treatments` table).
 * Maps to the same DTO shape as {@link readPatientTreatmentsFromDbf}; never returns raw SQL rows on the wire.
 */
export function readPatientTreatmentsFromSqlite(
  sqlitePath: string,
  patientIdDigits: string,
): ReadPatientTreatmentsOutcome {
  try {
    const db = openDatabaseSync(sqlitePath, { readOnly: true });
    try {
      const countRow = db
        .prepare(
          `SELECT COUNT(*) AS c
           FROM treatments
           WHERE patient_id = ?
             AND COALESCE(source_deleted, 0) = 0`,
        )
        .get(patientIdDigits) as { c: number } | undefined;
      const total = Number(countRow?.c ?? 0);
      const truncated = total > PATIENT_TREATMENTS_MAX;

      const rows = db
        .prepare(
          `SELECT treatment_id, patient_id, treatment_date, tooth, procedure_code, procedure_label,
                  doctor_id, doctor_label, status, has_description
           FROM treatments
           WHERE patient_id = ?
             AND COALESCE(source_deleted, 0) = 0
           ORDER BY rowid ASC
           LIMIT ?`,
        )
        .all(patientIdDigits, PATIENT_TREATMENTS_MAX) as TreatmentMirrorRow[];

      const treatments = rows.map(mapMirrorRowToTreatmentItem).sort(comparePatientTreatmentItems);

      const body: PatientTreatmentsResponse = {
        patientId: patientIdDigits,
        treatments,
        truncated,
        privacyNote: PRIVACY_NOTE,
      };

      return { kind: "ok", body };
    } finally {
      db.close();
    }
  } catch {
    return { kind: "read_error" };
  }
}
