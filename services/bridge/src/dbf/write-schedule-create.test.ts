import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DBFFile } from "dbffile";
import { parseBackupDirFromValue, parseDataRootFromValue } from "../config.js";
import { lookupScheduleAppointmentById } from "./schedule-appointments.js";
import { writeScheduleAppointmentCreate } from "./write-schedule-create.js";
import { writeScheduleFixturesWithMemoComment } from "../test-fixtures/schedule-fixtures.js";
import { writeSandboxMarker } from "../test-fixtures/write-sandbox.js";
import { ALLOW_LEGACY_WRITES_ACK } from "../write-safety/constants.js";
import { assertSafeWritePlanJson, withHttpServer } from "../test-fixtures/write-route-gate-helpers.js";
import { createBridgeApp } from "../app.js";
import { SafeWritePlanSchema } from "@microdent/contracts";

const createInput = {
  date: "2026-05-21",
  time: "08:00",
  room: 1,
  durationSlots: 1,
  patId: "50001",
  docId: 0,
  procClass: 0,
  periodMinutes: 30,
  status: 1,
};

describe("writeScheduleAppointmentCreate — memo COMMENT", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("appends row when COMMENT is type M and leaves blocked columns empty", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-create-memo-unit-"));
    try {
      await writeScheduleFixturesWithMemoComment(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");

      const outcome = await writeScheduleAppointmentCreate(dataRoot, createInput);
      expect(outcome).toEqual({ kind: "ok", appointmentId: "1" });

      const lookup = await lookupScheduleAppointmentById(dataRoot, "1");
      expect(lookup.kind).toBe("found");

      const dbf = await DBFFile.open(join(tmp, "SCHEDULE.DBF"), {
        encoding: "win1252",
        readMode: "loose",
        includeDeletedRecords: true,
      });
      for await (const row of dbf) {
        const rec = row as Record<string, unknown>;
        if (String(rec.ID).trim() !== "1") continue;
        expect(String(rec.PAT_NAME ?? "").trim()).toBe("");
        expect(String(rec.TELEPHONE ?? "").trim()).toBe("");
        expect(String(rec.CASENUM ?? "").trim()).toBe("");
        expect(rec.DATE).toBeInstanceOf(Date);
        expect((rec.DATE as Date).toISOString().slice(0, 10)).toBe("2026-05-21");
        expect(String(rec.TIME).trim()).toBe("08:00");
        expect(rec.COMMENT).toBeNull();
        break;
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("sandbox commit succeeds with memo COMMENT SCHEDULE", async () => {
    vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
    const tmp = mkdtempSync(join(tmpdir(), "bridge-create-memo-http-"));
    try {
      await writeScheduleFixturesWithMemoComment(tmp);
      writeSandboxMarker(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const backupRoot = mkdtempSync(join(tmpdir(), "bridge-create-memo-backup-"));
      const app = createBridgeApp("v-test", {
        bridgeConfig: {
          listen: { host: "127.0.0.1", port: 0 },
          dataRoot,
          writeMode: "enabled",
          backupDir: parseBackupDirFromValue(backupRoot),
        },
      });
      await withHttpServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/schedule/appointments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: "2026-05-21",
            time: "08:00",
            room: 1,
            durationSlots: 1,
            patId: "50001",
          }),
        });
        expect(res.status).toBe(200);
        const text = await res.text();
        assertSafeWritePlanJson(text);
        const parsed = SafeWritePlanSchema.parse(JSON.parse(text));
        expect(parsed.committed).toBe(true);
        expect(parsed.workflow).toBe("appointment.create");
        const newId = parsed.recordIds[0]!;
        const lookup = await lookupScheduleAppointmentById(dataRoot, newId);
        expect(lookup.kind).toBe("found");
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
