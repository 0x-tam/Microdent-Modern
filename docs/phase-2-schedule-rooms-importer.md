# Phase 2 — Safe schedule rooms SQLite importer

**Status:** Implemented.

**Scope:** Mirror `SC_ROOM.DBF` room indices and optional `DICSCHED.DBF` display labels into `schedule_rooms` (`room_id`, `label` only). Does **not** import patient content, phones, schedule appointments, or chart/ledger data.

---

## Source files

| File | Role |
| --- | --- |
| `SC_ROOM.DBF` | Required — room number (`ROOM`) |
| `DICSCHED.DBF` | Optional — `ROOM{n}` label for display name |

Uses the same read-only mapping as `GET /v1/schedule/rooms` (`readScheduleRooms` via `@microdent/bridge/import-source`).

---

## SQLite columns

| Column | Content |
| --- | --- |
| `room_id` | String form of `ROOM` |
| `label` | DICSCHED label when present, else `Room {n}` |
| `imported_at` | ISO timestamp |

**Not stored:** `activeDays`, `doctorId`, raw DBF rows, or memo fields.

---

## Orchestration

Included in `runMirrorImportSafe` / `pnpm mirror:import-safe` after `procedures` and before `patients`.

---

## Bridge read path

`GET /v1/schedule/rooms` uses `readScheduleRoomsForApi` in the bridge: when `isSqliteMirrorUsable(sqlitePath, "schedule_rooms")`, reads mirror labels via `readScheduleRoomsFromSqlite`; otherwise `readScheduleRooms` (DBF). Mirror responses keep the same contract; **`activeDays`** are all **false** and **`doctorId`** is **null** because those columns are not imported.

## Tests

- `services/sqlite-mirror/src/import-schedule-rooms.test.ts` — synthetic `SC_ROOM.DBF` + `DICSCHED.DBF` only
- `services/sqlite-mirror/src/run-mirror-import-safe.test.ts` — full safe import chain
- `services/bridge/src/sqlite-schedule-routes.test.ts` — `GET /v1/schedule/rooms` mirror preference + DBF fallback

Run on **Node ≥ 22.5**.
