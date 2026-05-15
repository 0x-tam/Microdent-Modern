import {
  normalizePatientSearchResultItemForWire,
  type PatientSearchResultItem,
} from "@microdent/contracts";
import { openDatabaseSync } from "./node-sqlite.js";

const MAX_RESULTS = 20;

export type PatientSearchSqliteOutcome =
  | { kind: "ok"; results: PatientSearchResultItem[] }
  | { kind: "read_error" };

function tokenizeQuery(q: string): string[] {
  return q
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function escapeLikeToken(token: string): string {
  return token.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Patient search against mirror `patients.search_blob` (same token rules as DBF scan).
 */
export function searchPatientsInSqlite(sqlitePath: string, rawQuery: string): PatientSearchSqliteOutcome {
  const tokens = tokenizeQuery(rawQuery);
  if (tokens.length === 0) {
    return { kind: "ok", results: [] };
  }

  const clauses = tokens.map(() => `search_blob LIKE ? ESCAPE '\\'`);
  const sql = `SELECT patient_id, chart_number, display_name, phone_mask
    FROM patients
    WHERE COALESCE(source_deleted, 0) = 0
      AND ${clauses.join(" AND ")}
    LIMIT ?`;

  const params: (string | number)[] = [
    ...tokens.map((t) => `%${escapeLikeToken(t)}%`),
    MAX_RESULTS,
  ];

  try {
    const db = openDatabaseSync(sqlitePath, { readOnly: true });
    try {
      const rows = db.prepare(sql).all(...params) as {
        patient_id: string;
        chart_number: string | null;
        display_name: string;
        phone_mask: string | null;
      }[];

      const results = rows.map((row) =>
        normalizePatientSearchResultItemForWire({
          patientId: row.patient_id,
          chartNumber: row.chart_number,
          displayName: row.display_name,
          phoneMask: row.phone_mask,
        }),
      );

      return { kind: "ok", results };
    } finally {
      db.close();
    }
  } catch {
    return { kind: "read_error" };
  }
}
