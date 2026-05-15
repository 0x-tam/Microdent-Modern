import { existsSync } from "node:fs";
import { DBFFile, DELETED } from "dbffile";
import type { LedgerEntryV1, PatientLedgerResponse } from "@microdent/contracts";
import type { DataRootSet } from "../config.js";
import { formatFoxProDateValue, logicalToBoolOrNull, strIdField } from "./patient-dbf-helpers.js";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";

const TRANS_DBF = "TRANS.DBF";
const OPEN_OPTIONS = { encoding: "win1252" as const, readMode: "loose" as const };

/** Hard cap on matching ledger lines returned per patient. */
export const PATIENT_LEDGER_MAX = 100;

function rowPatientIdMatches(row: Record<string, unknown>, patientIdDigits: string): boolean {
  return strIdField(row, "PATIENT_ID") === patientIdDigits;
}

function numericCodeOrNull(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  const n = Math.trunc(Number(String(v).trim()));
  return Number.isFinite(n) ? n : null;
}

function memoAppearsNonEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "object" && v !== null && "length" in v) {
    const len = (v as { length: unknown }).length;
    if (typeof len === "number") return len > 0;
  }
  return Boolean(v);
}

/** True when blocked memo column appears populated — never serializes its contents. */
function rowHasDescription(row: Record<string, unknown>): boolean {
  return memoAppearsNonEmpty(row.DESCR);
}

function compareIsoDates(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a.localeCompare(b);
}

function compareEntries(a: LedgerEntryV1, b: LedgerEntryV1): number {
  const dateCmp = compareIsoDates(b.date, a.date);
  if (dateCmp !== 0) return dateCmp;
  const aNum = Number(a.ledgerEntryId);
  const bNum = Number(b.ledgerEntryId);
  if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
    return bNum - aNum;
  }
  return b.ledgerEntryId.localeCompare(a.ledgerEntryId);
}

function toLedgerEntry(row: Record<string, unknown>, patientId: string): LedgerEntryV1 | null {
  const ledgerEntryId = strIdField(row, "TRANS_NB");
  if (ledgerEntryId.length === 0) return null;

  return {
    ledgerEntryId,
    patientId,
    date: formatFoxProDateValue(row.DATE),
    chargeTypeCode: numericCodeOrNull(row, "CH_TYPE"),
    adjustmentTypeCode: numericCodeOrNull(row, "ADJ_TYPE"),
    paymentTypeCode: numericCodeOrNull(row, "PAY_TYPE"),
    isCardPayment: logicalToBoolOrNull(row.CARD),
    hasDescription: rowHasDescription(row),
  };
}

export type ReadPatientLedgerOutcome =
  | { kind: "ok"; body: PatientLedgerResponse }
  | { kind: "missing_table" }
  | { kind: "read_error" };

/**
 * Read-only scan of `TRANS.DBF` for one patient (`PATIENT_ID` matches profile `patientId`).
 * Never returns amounts, memo text, insurance ids, plan numbers, or raw rows.
 */
export async function readPatientLedgerFromDbf(
  dataRoot: DataRootSet,
  patientIdDigits: string,
): Promise<ReadPatientLedgerOutcome> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, TRANS_DBF);
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

  const collected: LedgerEntryV1[] = [];
  let matchedBeyondCap = false;

  try {
    for await (const row of dbf) {
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      if (!rowPatientIdMatches(rec, patientIdDigits)) continue;

      if (collected.length >= PATIENT_LEDGER_MAX) {
        matchedBeyondCap = true;
        continue;
      }

      const item = toLedgerEntry(rec, patientIdDigits);
      if (item !== null) {
        collected.push(item);
      }
    }
  } catch {
    return { kind: "read_error" };
  }

  collected.sort(compareEntries);

  return {
    kind: "ok",
    body: {
      patientId: patientIdDigits,
      entries: collected,
      truncated: matchedBeyondCap,
      privacyNote:
        "Ledger amounts, memo text, insurance identifiers, plan numbers, and raw TRANS rows are never exposed by this route.",
    },
  };
}
