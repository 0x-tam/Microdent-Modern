import type { ReferenceProcedureItem } from "@microdent/contracts";
import { openDatabaseSync } from "./node-sqlite.js";

export type ReadReferenceProceduresSqliteOutcome =
  | { kind: "ok"; procedures: ReferenceProcedureItem[] }
  | { kind: "read_error" };

function nullableTrimmed(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function classIdFromSqlite(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? Math.trunc(value) : Math.trunc(Number(String(value)));
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}

function chartRelevantFromSqlite(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const n = typeof value === "number" ? value : Number(String(value));
  return n === 1;
}

/**
 * Read procedure dictionary rows from the SQLite mirror (`procedures` table).
 * Maps to the same DTO shape as DBF {@link readReferenceProcedures}; omits prices and raw rows.
 */
export function readReferenceProceduresFromSqlite(sqlitePath: string): ReadReferenceProceduresSqliteOutcome {
  try {
    const db = openDatabaseSync(sqlitePath, { readOnly: true });
    try {
      const rows = db
        .prepare(
          `SELECT procedure_code, label, procedure_class, category_code, class_id, chart_flag
           FROM procedures
           WHERE COALESCE(source_deleted, 0) = 0
           ORDER BY procedure_code`,
        )
        .all() as {
        procedure_code: string;
        label: string;
        procedure_class: string | null;
        category_code: string | null;
        class_id: number | null;
        chart_flag: number | null;
      }[];

      const procedures: ReferenceProcedureItem[] = rows.map((row) => {
        const procedureCode = String(row.procedure_code).trim();
        const label = String(row.label).trim();
        const displayName =
          label.length === 0 || label === procedureCode ? null : label;
        return {
          procedureCode,
          displayName,
          category: nullableTrimmed(row.procedure_class),
          categoryCode: nullableTrimmed(row.category_code),
          classId: classIdFromSqlite(row.class_id),
          chartRelevant: chartRelevantFromSqlite(row.chart_flag),
        };
      });

      return { kind: "ok", procedures };
    } finally {
      db.close();
    }
  } catch {
    return { kind: "read_error" };
  }
}
