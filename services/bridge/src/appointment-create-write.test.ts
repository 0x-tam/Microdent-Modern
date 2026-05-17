import { createServer } from "node:http";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DBFFile } from "dbffile";
import { SafeWritePlanSchema } from "@microdent/contracts";
import { createBridgeApp } from "./app.js";
import { parseBackupDirFromValue, parseDataRootFromValue } from "./config.js";
import { lookupScheduleAppointmentById } from "./dbf/schedule-appointments.js";
import { ALLOW_LEGACY_WRITES_ACK } from "./write-safety/constants.js";
import { writeScheduleFixtures } from "./test-fixtures/schedule-fixtures.js";
import { writeSandboxMarker } from "./test-fixtures/write-sandbox.js";

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

function postCreate(
  port: number,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/v1/schedule/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST appointment create — sandbox write band", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects invalid patient id", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-create-invalid-pat-"));
    const backupRoot = mkdtempSync(join(tmpdir(), "bridge-create-backup-"));
    try {
      await writeScheduleFixtures(tmp);
      writeSandboxMarker(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");

      vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
      const app = createBridgeApp("v-test", {
        bridgeConfig: {
          listen: { host: "127.0.0.1", port: 0 },
          dataRoot,
          backupDir: parseBackupDirFromValue(backupRoot),
          writeMode: "enabled",
        },
      });
      await withServer(app, async (port) => {
        const res = await postCreate(port, {
          date: "2026-05-21",
          time: "08:00",
          room: 1,
          patId: "99999",
        });
        expect(res.status).toBe(400);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("INVALID_PATIENT_ID");
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
      rmSync(backupRoot, { recursive: true, force: true });
    }
  });

  it("creates appointment with empty blocked columns", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-create-ok-"));
    const backupRoot = mkdtempSync(join(tmpdir(), "bridge-create-backup-ok-"));
    try {
      await writeScheduleFixtures(tmp);
      writeSandboxMarker(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");

      vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
      const app = createBridgeApp("v-test", {
        bridgeConfig: {
          listen: { host: "127.0.0.1", port: 0 },
          dataRoot,
          backupDir: parseBackupDirFromValue(backupRoot),
          writeMode: "enabled",
        },
      });
      await withServer(app, async (port) => {
        const res = await postCreate(port, {
          date: "2026-05-21",
          time: "08:00",
          room: 1,
          durationSlots: 1,
          patId: "50001",
        });
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).not.toContain("SYNTHETIC_NAME_TOKEN");
        const parsed = SafeWritePlanSchema.parse(JSON.parse(text));
        expect(parsed.committed).toBe(true);
        expect(parsed.workflow).toBe("appointment.create");
        const newId = parsed.recordIds[0]!;

        const lookup = await lookupScheduleAppointmentById(dataRoot, newId);
        expect(lookup.kind).toBe("found");

        const dbf = await DBFFile.open(join(tmp, "SCHEDULE.DBF"), {
          encoding: "win1252",
          readMode: "loose",
        });
        for await (const row of dbf) {
          const rec = row as Record<string, unknown>;
          if (String(rec.ID).trim() === newId) {
            expect(String(rec.PAT_NAME ?? "").trim()).toBe("");
            expect(String(rec.TELEPHONE ?? "").trim()).toBe("");
            expect(String(rec.COMMENT ?? "").trim()).toBe("");
            break;
          }
        }

        const backupFolders = readdirSync(backupRoot);
        expect(backupFolders.length).toBe(1);
        expect(backupFolders[0]).toContain("appointment.create");
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
      rmSync(backupRoot, { recursive: true, force: true });
    }
  });
});
