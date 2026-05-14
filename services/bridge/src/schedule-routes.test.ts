import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import {
  ScheduleAppointmentsResponseSchema,
  ScheduleRoomsResponseSchema,
} from "@microdent/contracts";
import { createBridgeApp } from "./app.js";
import type { BridgeConfig } from "./config.js";
import { parseDataRootFromValue } from "./config.js";
import { SCHEDULE_APPOINTMENTS_MAX } from "./dbf/schedule-appointments.js";

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

const scheduleFields = [
  { name: "ID", type: "N" as const, size: 12, decimalPlaces: 0 },
  { name: "DATE", type: "D" as const, size: 8 },
  { name: "TIME", type: "C" as const, size: 8 },
  { name: "DURATION", type: "N" as const, size: 3, decimalPlaces: 0 },
  { name: "ROOM", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "COMMENT", type: "C" as const, size: 40 },
  { name: "PAT_NAME", type: "C" as const, size: 41 },
  { name: "TELEPHONE", type: "C" as const, size: 20 },
  { name: "PERIOD", type: "N" as const, size: 3, decimalPlaces: 0 },
  { name: "STATUS", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "DOC_ID", type: "N" as const, size: 5, decimalPlaces: 0 },
  { name: "PAT_ID", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "PROC_CLASS", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "VAC_ID", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "RECALL", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "UNREASON", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "MISSED", type: "L" as const, size: 1 },
];

const scRoomFields = [
  { name: "ROOM", type: "N" as const, size: 3, decimalPlaces: 0 },
  { name: "DAY1", type: "L" as const, size: 1 },
  { name: "DAY2", type: "L" as const, size: 1 },
  { name: "DAY3", type: "L" as const, size: 1 },
  { name: "DAY4", type: "L" as const, size: 1 },
  { name: "DAY5", type: "L" as const, size: 1 },
  { name: "DAY6", type: "L" as const, size: 1 },
  { name: "DAY7", type: "L" as const, size: 1 },
  { name: "DOCT", type: "N" as const, size: 5, decimalPlaces: 0 },
];

function dicFields(): { name: string; type: "C"; size: number }[] {
  const out: { name: string; type: "C"; size: number }[] = [];
  for (let i = 1; i <= 25; i++) {
    out.push({ name: `ROOM${i}`, type: "C", size: 40 });
  }
  return out;
}

async function writeScheduleFixtures(dir: string): Promise<void> {
  const dicPath = join(dir, "DICSCHED.DBF");
  const dicRow: Record<string, string> = {};
  for (let i = 1; i <= 25; i++) {
    dicRow[`ROOM${i}`] = "";
  }
  dicRow.ROOM1 = "Synthetic operatory A";
  dicRow.ROOM2 = "Synthetic chair B";
  const dic = await DBFFile.create(dicPath, dicFields(), {});
  await dic.appendRecords([dicRow]);

  const roomPath = join(dir, "SC_ROOM.DBF");
  const rooms = await DBFFile.create(roomPath, scRoomFields, {});
  await rooms.appendRecords([
    {
      ROOM: 1,
      DAY1: true,
      DAY2: false,
      DAY3: false,
      DAY4: false,
      DAY5: false,
      DAY6: false,
      DAY7: false,
      DOCT: 42,
    },
    {
      ROOM: 2,
      DAY1: false,
      DAY2: true,
      DAY3: false,
      DAY4: false,
      DAY5: false,
      DAY6: false,
      DAY7: false,
      DOCT: 0,
    },
  ]);

  const schedPath = join(dir, "SCHEDULE.DBF");
  const sched = await DBFFile.create(schedPath, scheduleFields, {});
  const d1 = new Date(Date.UTC(2026, 4, 20));
  const d2 = new Date(Date.UTC(2026, 4, 21));
  const dOut = new Date(Date.UTC(2026, 4, 22));
  const secretComment = "SYNTHETIC_COMMENT_TOKEN_XX";
  const secretName = "SYNTHETIC_NAME_TOKEN_YY";
  const secretPhone = "SYNTHETIC_PHONE_TOKEN_ZZ";
  await sched.appendRecords([
    {
      ID: 1001,
      DATE: d1,
      TIME: "09:00",
      DURATION: 2,
      ROOM: 1,
      COMMENT: secretComment,
      PAT_NAME: secretName,
      TELEPHONE: secretPhone,
      PERIOD: 30,
      STATUS: 1,
      DOC_ID: 7,
      PAT_ID: 50001,
      PROC_CLASS: 3,
      VAC_ID: 0,
      RECALL: 0,
      UNREASON: 0,
      MISSED: false,
    },
    {
      ID: 1002,
      DATE: d1,
      TIME: "10:00",
      DURATION: 1,
      ROOM: 2,
      COMMENT: "",
      PAT_NAME: secretName,
      TELEPHONE: secretPhone,
      PERIOD: 0,
      STATUS: 2,
      DOC_ID: 0,
      PAT_ID: 50002,
      PROC_CLASS: 0,
      VAC_ID: 1,
      RECALL: 2,
      UNREASON: 3,
      MISSED: true,
    },
    {
      ID: 1003,
      DATE: d2,
      TIME: "11:30",
      DURATION: 1,
      ROOM: 1,
      COMMENT: "",
      PAT_NAME: secretName,
      TELEPHONE: secretPhone,
      PERIOD: 45,
      STATUS: 0,
      DOC_ID: 0,
      PAT_ID: 0,
      PROC_CLASS: 0,
      VAC_ID: 0,
      RECALL: 0,
      UNREASON: 0,
      MISSED: false,
    },
    {
      ID: 1004,
      DATE: dOut,
      TIME: "12:00",
      DURATION: 1,
      ROOM: 1,
      COMMENT: "",
      PAT_NAME: secretName,
      TELEPHONE: secretPhone,
      PERIOD: 30,
      STATUS: 1,
      DOC_ID: 0,
      PAT_ID: 0,
      PROC_CLASS: 0,
      VAC_ID: 0,
      RECALL: 0,
      UNREASON: 0,
      MISSED: false,
    },
  ]);
}

describe("GET /v1/schedule/rooms", () => {
  it("returns synthetic rooms with DICSCHED labels and doctor ids", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-schedule-rooms-"));
    try {
      await writeScheduleFixtures(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/schedule/rooms`);
        expect(res.status).toBe(200);
        const json: unknown = await res.json();
        const parsed = ScheduleRoomsResponseSchema.safeParse(json);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.rooms).toHaveLength(2);
        const r1 = parsed.data.rooms.find((r) => r.room === 1);
        expect(r1?.displayName).toBe("Synthetic operatory A");
        expect(r1?.doctorId).toBe(42);
        expect(r1?.activeDays.sunday).toBe(true);
        const r2 = parsed.data.rooms.find((r) => r.room === 2);
        expect(r2?.displayName).toBe("Synthetic chair B");
        expect(r2?.doctorId).toBe(null);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns 404 when SC_ROOM.DBF is absent", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-schedule-no-room-"));
    try {
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/schedule/rooms`);
        expect(res.status).toBe(404);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("SC_ROOM_DBF_NOT_FOUND");
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("GET /v1/schedule/appointments", () => {
  it("returns safe appointment fields only for the requested date range", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-schedule-appt-"));
    try {
      await writeScheduleFixtures(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(
          `http://127.0.0.1:${port}/v1/schedule/appointments?from=2026-05-20&to=2026-05-21`,
        );
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).not.toContain("SYNTHETIC_NAME_TOKEN_YY");
        expect(text).not.toContain("SYNTHETIC_PHONE_TOKEN_ZZ");
        expect(text).not.toContain("SYNTHETIC_COMMENT_TOKEN_XX");
        const json: unknown = JSON.parse(text);
        const parsed = ScheduleAppointmentsResponseSchema.safeParse(json);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.appointments).toHaveLength(3);
        const a1 = parsed.data.appointments.find((a) => a.id === "1001");
        expect(a1?.hasComment).toBe(true);
        expect(a1?.patId).toBe("50001");
        expect(a1?.periodMinutes).toBe(30);
        const a2 = parsed.data.appointments.find((a) => a.id === "1002");
        expect(a2?.periodMinutes).toBe(null);
        expect(a2?.missed).toBe(true);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("filters by room when room query param is set", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-schedule-room-filter-"));
    try {
      await writeScheduleFixtures(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(
          `http://127.0.0.1:${port}/v1/schedule/appointments?from=2026-05-20&to=2026-05-21&room=2`,
        );
        expect(res.status).toBe(200);
        const json: unknown = await res.json();
        const parsed = ScheduleAppointmentsResponseSchema.safeParse(json);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.appointments.map((a) => a.id).sort()).toEqual(["1002"]);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns 400 for invalid dates, inverted range, span over 14 days, or bad room", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-schedule-badq-"));
    try {
      await writeScheduleFixtures(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const base = `http://127.0.0.1:${port}/v1/schedule/appointments`;
        expect((await fetch(`${base}?from=2026-05-20&to=2026-05-20`)).status).toBe(200);
        expect((await fetch(`${base}?from=not-a-date&to=2026-05-20`)).status).toBe(400);
        expect((await fetch(`${base}?from=2026-05-22&to=2026-05-20`)).status).toBe(400);
        expect((await fetch(`${base}?from=2026-05-01&to=2026-05-20`)).status).toBe(400);
        expect((await fetch(`${base}?from=2026-05-01&to=2026-05-15`)).status).toBe(400);
        expect((await fetch(`${base}?from=2026-05-01&to=2026-05-14`)).status).toBe(200);
        expect((await fetch(`${base}?from=2026-05-01&to=2026-05-14&room=abc`)).status).toBe(400);
        expect((await fetch(`${base}?to=2026-05-14`)).status).toBe(400);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it(
    "caps appointments at SCHEDULE_APPOINTMENTS_MAX",
    async () => {
      const tmp = mkdtempSync(join(tmpdir(), "bridge-schedule-cap-"));
      try {
        const schedPath = join(tmp, "SCHEDULE.DBF");
        const sched = await DBFFile.create(schedPath, scheduleFields, {});
        const d = new Date(Date.UTC(2026, 5, 10));
        const rows = Array.from({ length: SCHEDULE_APPOINTMENTS_MAX + 12 }, (_, i) => ({
          ID: 2000 + i,
          DATE: d,
          TIME: "08:00",
          DURATION: 1,
          ROOM: 1,
          COMMENT: "",
          PAT_NAME: "",
          TELEPHONE: "",
          PERIOD: 30,
          STATUS: 1,
          DOC_ID: 0,
          PAT_ID: 1,
          PROC_CLASS: 0,
          VAC_ID: 0,
          RECALL: 0,
          UNREASON: 0,
          MISSED: false,
        }));
        await sched.appendRecords(rows);

        const dataRoot = parseDataRootFromValue(tmp);
        if (!dataRoot.configured) throw new Error("data root");
        const app = createBridgeApp("v-test", {
          bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
        });
        await withServer(app, async (port) => {
          const res = await fetch(
            `http://127.0.0.1:${port}/v1/schedule/appointments?from=2026-06-10&to=2026-06-10`,
          );
          expect(res.status).toBe(200);
          const json: unknown = await res.json();
          const parsed = ScheduleAppointmentsResponseSchema.safeParse(json);
          expect(parsed.success).toBe(true);
          if (!parsed.success) return;
          expect(parsed.data.appointments.length).toBe(SCHEDULE_APPOINTMENTS_MAX);
        });
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    },
    60_000,
  );

  it("returns 404 when SCHEDULE.DBF is absent", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-schedule-no-sch-"));
    try {
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(
          `http://127.0.0.1:${port}/v1/schedule/appointments?from=2026-01-01&to=2026-01-02`,
        );
        expect(res.status).toBe(404);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("SCHEDULE_DBF_NOT_FOUND");
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns 503 when DATA_ROOT is not configured", async () => {
    const cfg: BridgeConfig = {
      listen: { host: "127.0.0.1", port: 0 },
      dataRoot: { configured: false },
    };
    const app = createBridgeApp("v-test", { bridgeConfig: cfg });
    await withServer(app, async (port) => {
      const a = await fetch(`http://127.0.0.1:${port}/v1/schedule/appointments?from=2026-01-01&to=2026-01-02`);
      expect(a.status).toBe(503);
      const b = await fetch(`http://127.0.0.1:${port}/v1/schedule/rooms`);
      expect(b.status).toBe(503);
    });
  });
});
