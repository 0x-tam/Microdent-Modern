import { existsSync } from "node:fs";
import { DBFFile, DELETED } from "dbffile";
import type { DataRootSet } from "../config.js";
import type { ScheduleRoomItem } from "@microdent/contracts";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";

const SC_ROOM_DBF = "SC_ROOM.DBF";
const DICSCHED_DBF = "DICSCHED.DBF";

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

/**
 * Reads first non-deleted DICSCHED row and extracts ROOM1…ROOM25 trimmed labels only.
 */
export async function readDicschedRoomLabels(dataRoot: DataRootSet): Promise<Map<number, string>> {
  const labels = new Map<number, string>();
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, DICSCHED_DBF);
  } catch {
    return labels;
  }
  if (!existsSync(abs)) {
    return labels;
  }

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, OPEN_OPTIONS);
  } catch {
    return labels;
  }

  try {
    for await (const row of dbf) {
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      for (let i = 1; i <= 25; i++) {
        const key = `ROOM${i}`;
        const raw = strField(rec, key);
        if (raw.length > 0) {
          labels.set(i, raw);
        }
      }
      break;
    }
  } catch {
    return labels;
  }

  return labels;
}

export type ScheduleRoomsOutcome =
  | { kind: "ok"; rooms: ScheduleRoomItem[] }
  | { kind: "missing_sc_room" }
  | { kind: "read_error" };

/**
 * Read-only: SC_ROOM rows + optional DICSCHED ROOMn labels (first row only).
 */
export async function readScheduleRooms(dataRoot: DataRootSet): Promise<ScheduleRoomsOutcome> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, SC_ROOM_DBF);
  } catch {
    return { kind: "read_error" };
  }
  if (!existsSync(abs)) {
    return { kind: "missing_sc_room" };
  }

  let labels: Map<number, string>;
  try {
    labels = await readDicschedRoomLabels(dataRoot);
  } catch {
    labels = new Map();
  }

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, OPEN_OPTIONS);
  } catch {
    return { kind: "read_error" };
  }

  const rooms: ScheduleRoomItem[] = [];
  try {
    for await (const row of dbf) {
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      const roomNum = Math.trunc(num(rec, "ROOM"));
      if (roomNum <= 0) continue;

      const activeDays = {
        sunday: toBool(rec.DAY1),
        monday: toBool(rec.DAY2),
        tuesday: toBool(rec.DAY3),
        wednesday: toBool(rec.DAY4),
        thursday: toBool(rec.DAY5),
        friday: toBool(rec.DAY6),
        saturday: toBool(rec.DAY7),
      };

      const doct = Math.trunc(num(rec, "DOCT"));
      const fromDic = labels.get(roomNum);
      const displayName = fromDic !== undefined && fromDic.length > 0 ? fromDic : null;

      rooms.push({
        room: roomNum,
        displayName,
        activeDays,
        doctorId: doct !== 0 ? doct : null,
      });
    }
  } catch {
    return { kind: "read_error" };
  }

  rooms.sort((a, b) => a.room - b.room);
  return { kind: "ok", rooms };
}
