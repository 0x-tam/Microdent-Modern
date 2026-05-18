import type { BridgeConfig } from "./config.js";
import type { DataRootSet } from "./config.js";
import { readScheduleRooms, type ScheduleRoomsOutcome } from "./dbf/schedule-rooms.js";
import { isSqliteMirrorUsable } from "./sqlite/mirror-usable.js";
import { readScheduleRoomsFromSqlite } from "./sqlite/schedule-rooms.js";

/**
 * Schedule room reads: SQLite mirror when configured and `schedule_rooms` is usable, else DBF.
 * Invalid mirror falls back to DBF without changing response shape.
 */
export async function readScheduleRoomsForApi(
  bridgeConfig: BridgeConfig & { dataRoot: DataRootSet },
): Promise<ScheduleRoomsOutcome> {
  if (isSqliteMirrorUsable(bridgeConfig.sqlitePath, "schedule_rooms")) {
    const sqliteOutcome = readScheduleRoomsFromSqlite(bridgeConfig.sqlitePath.path);
    if (sqliteOutcome.kind === "ok") {
      return sqliteOutcome;
    }
  }

  return readScheduleRooms(bridgeConfig.dataRoot);
}
