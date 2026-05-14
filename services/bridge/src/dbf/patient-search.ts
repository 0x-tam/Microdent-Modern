import { existsSync } from "node:fs";
import { DBFFile, DELETED } from "dbffile";
import type { DataRootSet } from "../config.js";
import type { PatientSearchResultItem } from "@microdent/contracts";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";

const PATIENT_DBF = "PATIENT.DBF";
const MAX_RESULTS = 20;

/** FoxPro / legacy text often uses Windows-1252; dbffile default is Latin-1 — win1252 is safer for names. */
const PATIENT_OPEN_OPTIONS = { encoding: "win1252" as const, readMode: "loose" as const };

function strField(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function strIdField(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(Math.trunc(v));
  }
  return String(v).trim();
}

function buildDisplayName(row: Record<string, unknown>): string {
  const name = strField(row, "NAME");
  if (name.length > 0) return name;
  const first = strField(row, "FIRST_NAME");
  const last = strField(row, "LAST_NAME");
  const joined = `${first} ${last}`.trim();
  if (joined.length > 0) return joined;
  const rev = strField(row, "REV_NAME");
  if (rev.length > 0) return rev;
  const id = strIdField(row, "ID");
  return id.length > 0 ? `Patient ${id}` : "Patient";
}

function maskPhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 4) return null;
  const last4 = digits.slice(-4);
  return `…${last4}`;
}

function pickPhoneMask(row: Record<string, unknown>): string | null {
  return maskPhone(row.HOME_PHONE) ?? maskPhone(row.MOBILE);
}

/**
 * Text used for substring matching only — excludes phones, addresses, memos, and other PHI-heavy columns.
 * Field names align with inspected Microdent `PATIENT.DBF` (see docs/phase-1b-patient-search-backend.md).
 */
function buildSearchHaystack(row: Record<string, unknown>): string {
  const parts = [
    strIdField(row, "ID"),
    strField(row, "CASENB"),
    strField(row, "NAME"),
    strField(row, "REV_NAME"),
    strField(row, "FIRST_NAME"),
    strField(row, "LAST_NAME"),
  ].filter((p) => p.length > 0);
  return parts.join(" ").toLowerCase();
}

function tokenizeQuery(q: string): string[] {
  return q
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function rowMatchesTokens(haystackLower: string, tokens: string[]): boolean {
  return tokens.every((t) => haystackLower.includes(t));
}

function toResult(row: Record<string, unknown>): PatientSearchResultItem {
  const patientId = strIdField(row, "ID");
  const chart = strField(row, "CASENB");
  return {
    patientId: patientId.length > 0 ? patientId : "0",
    chartNumber: chart.length > 0 ? chart : null,
    displayName: buildDisplayName(row),
    phoneMask: pickPhoneMask(row),
  };
}

export type PatientSearchOutcome =
  | { kind: "ok"; results: PatientSearchResultItem[] }
  | { kind: "missing_table" }
  | { kind: "read_error"; message: string };

/**
 * Read-only scan of `PATIENT.DBF` under `DATA_ROOT`. Returns at most {@link MAX_RESULTS} hits.
 * Does not read memo blobs; does not write; does not log row contents.
 */
export async function searchPatientsInDbf(dataRoot: DataRootSet, rawQuery: string): Promise<PatientSearchOutcome> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, PATIENT_DBF);
  } catch {
    return { kind: "read_error", message: "invalid path" };
  }
  if (!existsSync(abs)) {
    return { kind: "missing_table" };
  }

  const tokens = tokenizeQuery(rawQuery);
  if (tokens.length === 0) {
    return { kind: "ok", results: [] };
  }

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, PATIENT_OPEN_OPTIONS);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "open failed";
    return { kind: "read_error", message: msg };
  }

  const results: PatientSearchResultItem[] = [];
  try {
    for await (const row of dbf) {
      if (results.length >= MAX_RESULTS) break;
      if (row[DELETED]) continue;
      const hay = buildSearchHaystack(row as Record<string, unknown>);
      if (!rowMatchesTokens(hay, tokens)) continue;
      results.push(toResult(row as Record<string, unknown>));
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "scan failed";
    return { kind: "read_error", message: msg };
  }

  return { kind: "ok", results };
}
