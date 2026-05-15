import { existsSync } from "node:fs";
import { DBFFile, DELETED } from "dbffile";
import type { ReferenceProcedureItem } from "@microdent/contracts";
import type { DataRootSet } from "../config.js";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";

const PROCCHRT_DBF = "PROCCHRT.DBF";

const OPEN_OPTIONS = { encoding: "win1252" as const, readMode: "loose" as const };

function strField(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function num(row: Record<string, unknown>, key: string, def = 0): number {
  const v = row[key];
  if (v === null || v === undefined) return def;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : def;
}

function toBool(v: unknown): boolean {
  if (v === true || v === false) return v;
  if (typeof v === "string") {
    const s = v.trim().toUpperCase();
    return s === "T" || s === "Y" || s === "1";
  }
  return Boolean(v);
}

function nullableTrimmed(value: string): string | null {
  return value.length > 0 ? value : null;
}

export type ReferenceProceduresOutcome =
  | { kind: "ok"; procedures: ReferenceProcedureItem[] }
  | { kind: "missing_procchrt" }
  | { kind: "read_error" };

/**
 * Read-only PROCCHRT scan: code, label, class metadata, chart flag only.
 * Never maps PRICE*, PER_PROF, QTY*, insurance/accounting columns, or raw rows.
 */
export async function readReferenceProcedures(dataRoot: DataRootSet): Promise<ReferenceProceduresOutcome> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, PROCCHRT_DBF);
  } catch {
    return { kind: "read_error" };
  }
  if (!existsSync(abs)) {
    return { kind: "missing_procchrt" };
  }

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, OPEN_OPTIONS);
  } catch {
    return { kind: "read_error" };
  }

  const procedures: ReferenceProcedureItem[] = [];
  try {
    for await (const row of dbf) {
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      const procedureCode = strField(rec, "PROCNB");
      if (procedureCode.length === 0) continue;

      const classIdRaw = Math.trunc(num(rec, "CLASS_ID"));
      procedures.push({
        procedureCode,
        displayName: nullableTrimmed(strField(rec, "PROCEDURE")),
        category: nullableTrimmed(strField(rec, "CLASS")),
        categoryCode: nullableTrimmed(strField(rec, "CATAGORY")),
        classId: classIdRaw !== 0 ? classIdRaw : null,
        chartRelevant: toBool(rec.CHART),
      });
    }
  } catch {
    return { kind: "read_error" };
  }

  procedures.sort((a, b) => a.procedureCode.localeCompare(b.procedureCode));
  return { kind: "ok", procedures };
}
