import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import {
  ScheduleAppointmentsResponseSchema,
  ScheduleRoomsResponseSchema,
} from "@microdent/contracts";
import { importAppointments, importPatients, importScheduleRooms } from "@microdent/sqlite-mirror";
import { createBridgeApp } from "./app.js";
import { parseDataRootFromValue, parseSqlitePathFromValue } from "./config.js";
import type { BridgeConfig } from "./config.js";

async function withServer(app: ReturnType<typeof createBridgeApp>, fn: (port: number) => Promise<void>): Promise<void> {
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("expected port");
  try {
    await fn(addr.port);
  } finally {
    server.close();
    await once(server, "close");
  }
}

function bridgeConfig(dataRootPath: string, sqlitePath?: string): BridgeConfig {
  const dataRoot = parseDataRootFromValue(dataRootPath);
  if (!dataRoot.configured) throw new Error("data root");
  return {
    listen: { host: "127.0.0.1", port: 0 },
    dataRoot,
    sqlitePath:
      sqlitePath === undefined ? { configured: false } : parseSqlitePathFromValue(sqlitePath),
  };
}

import { writeScheduleFixtures } from "./test-fixtures/schedule-fixtures.js";

async function importScheduleMirror(dataRoot: string, sqlitePath: string): Promise<void> {
  const rooms = await importScheduleRooms({ dataRoot, sqlitePath });
  expect(rooms.status).toBe("success");
  const patients = await importPatients({ dataRoot, sqlitePath });
  expect(patients.status).toBe("success");
  const appointments = await importAppointments({ dataRoot, sqlitePath });
  expect(appointments.status).toBe("success");
}

describe("SQLite schedule appointment routes (SQLITE_PATH configured)", () => {
  it("GET /v1/schedule/appointments reads mirror with patient join and no blocked fields", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-schedule-"));
    const sqlitePath = join(dir, "mirror.sqlite");
    try {
      await writeScheduleFixtures(dir);
      await importScheduleMirror(dir, sqlitePath);
      const app = createBridgeApp("v-test", { bridgeConfig: bridgeConfig(dir, sqlitePath) });
      await withServer(app, async (port) => {
        const res = await fetch(
          `http://127.0.0.1:${port}/v1/schedule/appointments?from=2026-05-20&to=2026-05-21`,
        );
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).not.toContain("SYNTHETIC_NAME_TOKEN_YY");
        expect(text).not.toContain("SYNTHETIC_PHONE_TOKEN_ZZ");
        expect(text).not.toContain("SYNTHETIC_COMMENT_TOKEN_XX");
        const parsed = ScheduleAppointmentsResponseSchema.parse(JSON.parse(text));
        expect(parsed.appointments).toHaveLength(4);
        const a1 = parsed.appointments.find((a) => a.id === "1001");
        expect(a1?.patient?.displayName).toBe("Synthetic Schedule Patient Alpha");
        expect(a1?.patient?.chartNumber).toBe("SCH-ALPHA");
        expect(a1?.hasComment).toBe(true);
        const aOrphan = parsed.appointments.find((a) => a.id === "1005");
        expect(aOrphan?.patient).toBe(null);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("GET /v1/schedule/appointments filters by room from mirror", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-schedule-room-"));
    const sqlitePath = join(dir, "mirror.sqlite");
    try {
      await writeScheduleFixtures(dir);
      await importScheduleMirror(dir, sqlitePath);
      const app = createBridgeApp("v-test", { bridgeConfig: bridgeConfig(dir, sqlitePath) });
      await withServer(app, async (port) => {
        const res = await fetch(
          `http://127.0.0.1:${port}/v1/schedule/appointments?from=2026-05-20&to=2026-05-21&room=2`,
        );
        const parsed = ScheduleAppointmentsResponseSchema.parse(await res.json());
        expect(parsed.appointments.map((a) => a.id)).toEqual(["1002"]);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("GET /v1/patients/:patientId/appointments reads mirror for one patient", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-patient-appt-"));
    const sqlitePath = join(dir, "mirror.sqlite");
    try {
      await writeScheduleFixtures(dir);
      await importScheduleMirror(dir, sqlitePath);
      const app = createBridgeApp("v-test", { bridgeConfig: bridgeConfig(dir, sqlitePath) });
      await withServer(app, async (port) => {
        const res = await fetch(
          `http://127.0.0.1:${port}/v1/patients/50001/appointments?from=2026-05-20&to=2026-05-21`,
        );
        const parsed = ScheduleAppointmentsResponseSchema.parse(await res.json());
        expect(parsed.appointments.every((a) => a.patId === "50001")).toBe(true);
        expect(parsed.appointments.map((a) => a.id)).toEqual(["1001"]);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to DBF when SQLITE_PATH file is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-schedule-fallback-"));
    const missingSqlite = join(dir, "missing.sqlite");
    try {
      await writeScheduleFixtures(dir);
      const app = createBridgeApp("v-test", {
        bridgeConfig: bridgeConfig(dir, missingSqlite),
      });
      await withServer(app, async (port) => {
        const res = await fetch(
          `http://127.0.0.1:${port}/v1/schedule/appointments?from=2026-05-20&to=2026-05-21`,
        );
        const parsed = ScheduleAppointmentsResponseSchema.parse(await res.json());
        expect(parsed.appointments).toHaveLength(4);
        expect(parsed.appointments.find((a) => a.id === "1001")?.patient?.displayName).toBe(
          "Synthetic Schedule Patient Alpha",
        );
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("serves from mirror when SCHEDULE.DBF is absent but SQLITE_PATH is valid", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-schedule-no-dbf-"));
    const sqlitePath = join(dir, "mirror.sqlite");
    const dataOnly = mkdtempSync(join(tmpdir(), "bridge-sqlite-schedule-data-"));
    try {
      await writeScheduleFixtures(dataOnly);
      await importScheduleMirror(dataOnly, sqlitePath);
      const app = createBridgeApp("v-test", {
        bridgeConfig: bridgeConfig(dir, sqlitePath),
      });
      await withServer(app, async (port) => {
        const res = await fetch(
          `http://127.0.0.1:${port}/v1/schedule/appointments?from=2026-05-20&to=2026-05-21`,
        );
        expect(res.status).toBe(200);
        expect(ScheduleAppointmentsResponseSchema.parse(await res.json()).appointments.length).toBeGreaterThan(0);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(dataOnly, { recursive: true, force: true });
    }
  });

  it("uses DBF only when sqlitePath is not configured", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-schedule-dbf-only-"));
    try {
      await writeScheduleFixtures(dir);
      const app = createBridgeApp("v-test", { bridgeConfig: bridgeConfig(dir) });
      await withServer(app, async (port) => {
        const res = await fetch(
          `http://127.0.0.1:${port}/v1/schedule/appointments?from=2026-05-20&to=2026-05-21`,
        );
        expect(res.status).toBe(200);
        expect(ScheduleAppointmentsResponseSchema.parse(await res.json()).appointments).toHaveLength(4);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("SQLite schedule rooms route (SQLITE_PATH configured)", () => {
  it("GET /v1/schedule/rooms reads mirror labels", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-schedule-rooms-"));
    const sqlitePath = join(dir, "mirror.sqlite");
    try {
      await writeScheduleFixtures(dir);
      const roomsImport = await importScheduleRooms({ dataRoot: dir, sqlitePath });
      expect(roomsImport.status).toBe("success");
      const app = createBridgeApp("v-test", { bridgeConfig: bridgeConfig(dir, sqlitePath) });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/schedule/rooms`);
        expect(res.status).toBe(200);
        const parsed = ScheduleRoomsResponseSchema.parse(await res.json());
        expect(parsed.rooms).toHaveLength(2);
        const r1 = parsed.rooms.find((r) => r.room === 1);
        expect(r1?.displayName).toBe("Synthetic operatory A");
        expect(r1?.doctorId).toBe(null);
        expect(r1?.activeDays.sunday).toBe(false);
        const r2 = parsed.rooms.find((r) => r.room === 2);
        expect(r2?.displayName).toBe("Synthetic chair B");
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to DBF when SQLITE_PATH file is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-rooms-fallback-"));
    const missingSqlite = join(dir, "missing.sqlite");
    try {
      await writeScheduleFixtures(dir);
      const app = createBridgeApp("v-test", {
        bridgeConfig: bridgeConfig(dir, missingSqlite),
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/schedule/rooms`);
        const parsed = ScheduleRoomsResponseSchema.parse(await res.json());
        expect(parsed.rooms).toHaveLength(2);
        expect(parsed.rooms.find((r) => r.room === 1)?.doctorId).toBe(42);
        expect(parsed.rooms.find((r) => r.room === 1)?.activeDays.sunday).toBe(true);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("serves from mirror when SC_ROOM.DBF is absent but SQLITE_PATH is valid", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-rooms-no-dbf-"));
    const sqlitePath = join(dir, "mirror.sqlite");
    const dataOnly = mkdtempSync(join(tmpdir(), "bridge-sqlite-rooms-data-"));
    try {
      await writeScheduleFixtures(dataOnly);
      const roomsImport = await importScheduleRooms({ dataRoot: dataOnly, sqlitePath });
      expect(roomsImport.status).toBe("success");
      const app = createBridgeApp("v-test", {
        bridgeConfig: bridgeConfig(dir, sqlitePath),
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/schedule/rooms`);
        expect(res.status).toBe(200);
        expect(ScheduleRoomsResponseSchema.parse(await res.json()).rooms.length).toBeGreaterThan(0);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(dataOnly, { recursive: true, force: true });
    }
  });
});
