import {
  MedicalConditionFlagsSchema,
  type PatientMedicalSummaryResponse,
} from "@microdent/contracts";
import {
  emptyPatientMedicalSummary,
  PATIENT_MEDICAL_SUMMARY_PRIVACY_NOTE,
} from "../dbf/patient-medical-summary.js";
import { openDatabaseSync } from "./node-sqlite.js";

export type ReadPatientMedicalSummarySqliteOutcome =
  | { kind: "ok"; summary: PatientMedicalSummaryResponse }
  | { kind: "read_error" };

function boolFromSqlite(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const n = typeof value === "number" ? Math.trunc(value) : Math.trunc(Number(String(value)));
  return n !== 0;
}

/**
 * Read one patient medical summary from mirror `medical_summary` (safe columns only).
 * Maps to the same DTO as {@link readPatientMedicalSummaryFromDbf}; never returns free text or raw rows.
 */
export function readPatientMedicalSummaryFromSqlite(
  sqlitePath: string,
  patientIdDigits: string,
): ReadPatientMedicalSummarySqliteOutcome {
  const sql = `SELECT has_medical_record, has_sensitive_medical_details,
      last_updated, last_dental_visit, flagged_condition_count, conditions_json
    FROM medical_summary
    WHERE patient_id = ?
    LIMIT 1`;

  try {
    const db = openDatabaseSync(sqlitePath, { readOnly: true });
    try {
      const row = db.prepare(sql).get(patientIdDigits) as
        | {
            has_medical_record: number;
            has_sensitive_medical_details: number;
            last_updated: string | null;
            last_dental_visit: string | null;
            flagged_condition_count: number;
            conditions_json: string | null;
          }
        | undefined;

      if (!row || !boolFromSqlite(row.has_medical_record)) {
        return { kind: "ok", summary: emptyPatientMedicalSummary(patientIdDigits) };
      }

      let conditionsParsed: unknown;
      try {
        conditionsParsed = row.conditions_json === null ? null : JSON.parse(row.conditions_json);
      } catch {
        return { kind: "read_error" };
      }

      const conditionsResult = MedicalConditionFlagsSchema.safeParse(conditionsParsed);
      if (!conditionsResult.success) {
        return { kind: "read_error" };
      }

      const summary: PatientMedicalSummaryResponse = {
        patientId: patientIdDigits,
        hasMedicalRecord: true,
        hasSensitiveMedicalDetails: boolFromSqlite(row.has_sensitive_medical_details),
        lastUpdated: row.last_updated,
        lastDentalVisit: row.last_dental_visit,
        flaggedConditionCount:
          typeof row.flagged_condition_count === "number"
            ? Math.max(0, Math.trunc(row.flagged_condition_count))
            : 0,
        conditions: conditionsResult.data,
        privacyNote: PATIENT_MEDICAL_SUMMARY_PRIVACY_NOTE,
      };

      return { kind: "ok", summary };
    } finally {
      db.close();
    }
  } catch {
    return { kind: "read_error" };
  }
}
