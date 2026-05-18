import type { ScheduleRoomActiveDays, ScheduleRoomItem } from "@microdent/contracts";
import type { ScheduleRoomsOutcome } from "../dbf/schedule-rooms.js";
import { openDatabaseSync } from "./node-sqlite.js";

/** Mirror stores labels only; weekday/doctor fields are not imported. */
const INACTIVE_ACTIVE_DAYS: ScheduleRoomActiveDays = {
  sunday: false,
  monday: false,
  tuesday: false,
  wednesday: false,
  thursday: false,
  friday: false,
  saturday: false,
};

function displayNameFromLabel(room: number, label: string): string | null {
  const trimmed = label.trim();
  if (trimmed.length === 0) return null;
  const fallback = `Room ${room}`;
  if (trimmed === fallback) return null;
  return trimmed;
}

/**
 * Read schedule room ids and display labels from mirror `schedule_rooms`.
 * Maps to the same DTO shape as {@link readScheduleRooms}; `activeDays` and `doctorId` use
 * safe defaults because the importer does not store SC_ROOM weekday/doctor columns.
 */
export function readScheduleRoomsFromSqlite(sqlitePath: string): ScheduleRoomsOutcome {
  try {
    const db = openDatabaseSync(sqlitePath, { readOnly: true });
    try {
      const rows = db
        .prepare(`SELECT room_id, label FROM schedule_rooms ORDER BY CAST(room_id AS INTEGER), room_id`)
        .all() as { room_id: string; label: string }[];

      const rooms: ScheduleRoomItem[] = [];
      for (const row of rows) {
        const room = Math.trunc(Number(String(row.room_id).trim()));
        if (!Number.isFinite(room) || room <= 0) continue;
        rooms.push({
          room,
          displayName: displayNameFromLabel(room, String(row.label)),
          activeDays: INACTIVE_ACTIVE_DAYS,
          doctorId: null,
        });
      }

      return { kind: "ok", rooms };
    } finally {
      db.close();
    }
  } catch {
    return { kind: "read_error" };
  }
}
