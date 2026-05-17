import { createServer } from "node:http";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DBFFile } from "dbffile";
import { SafeWritePlanSchema } from "@microdent/contracts";
import { createBridgeApp } from "./app.js";
import { parseBackupDirFromValue, parseDataRootFromValue } from "./config.js";
import { readScheduleRowInternal } from "./dbf/read-schedule-row-internal.js";
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

function patchTime(
  port: number,
  appointmentId: string,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/v1/schedule/appointments/${appointmentId}/time`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function readSensitiveFieldsFromDbf(dataRoot: string, appointmentId: string) {
  const dbf = await DBFFile.open(join(dataRoot, "SCHEDULE.DBF"), {
    encoding: "win1252",
    readMode: "loose",
  });
  for await (const row of dbf) {
    const rec = row as Record<string, unknown>;
    const id = String(rec.ID ?? "").trim();
    if (id === appointmentId || String(Number(id)) === appointmentId) {
      return {
        comment: String(rec.COMMENT ?? ""),
        patName: String(rec.PAT_NAME ?? ""),
        telephone: String(rec.TELEPHONE ?? ""),
      };
    }
  }
  throw new Error("appointment not found in fixture dbf");
}

describe("PATCH appointment time move — sandbox write band", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects blocked schedule fields in body", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-time-blocked-"));
    const backupRoot = mkdtempSync(join(tmpdir(), "bridge-time-backup-"));
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
        const res = await patchTime(port, "1001", {
          date: "2026-05-20",
          time: "15:00",
          room: 1,
          COMMENT: "secret",
        });
        expect(res.status).toBe(400);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("BLOCKED_SCHEDULE_FIELD");
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
      rmSync(backupRoot, { recursive: true, force: true });
    }
  });

  it("returns 409 when move overlaps another appointment", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-time-conflict-"));
    const backupRoot = mkdtempSync(join(tmpdir(), "bridge-time-conflict-backup-"));
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
        const res = await patchTime(port, "1005", {
          date: "2026-05-20",
          time: "09:30",
          room: 1,
          durationSlots: 2,
        });
        expect(res.status).toBe(409);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("SCHEDULE_CONFLICT");
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
      rmSync(backupRoot, { recursive: true, force: true });
    }
  });

  it("creates backup then updates DATE/TIME/ROOM without touching blocked fields", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-time-ok-"));
    const backupRoot = mkdtempSync(join(tmpdir(), "bridge-time-backup-ok-"));
    try {
      await writeScheduleFixtures(tmp);
      writeSandboxMarker(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const beforeSensitive = await readSensitiveFieldsFromDbf(tmp, "1001");

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
        const res = await patchTime(port, "1001", {
          date: "2026-05-20",
          time: "15:00",
          room: 2,
        });
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).not.toContain("SYNTHETIC_COMMENT_TOKEN");
        expect(text).not.toContain("SYNTHETIC_NAME_TOKEN");
        const parsed = SafeWritePlanSchema.parse(JSON.parse(text));
        expect(parsed.committed).toBe(true);
        expect(parsed.workflow).toBe("appointment.timeMove");

        const backupFolders = readdirSync(backupRoot);
        expect(backupFolders.length).toBe(1);
        expect(backupFolders[0]).toContain("appointment.timeMove");

        const row = await readScheduleRowInternal(dataRoot, "1001");
        expect(row.kind).toBe("ok");
        if (row.kind === "ok") {
          expect(row.row.time).toBe("15:00");
          expect(row.row.room).toBe(2);
        }

        const afterSensitive = await readSensitiveFieldsFromDbf(tmp, "1001");
        expect(afterSensitive.comment).toBe(beforeSensitive.comment);
        expect(afterSensitive.patName).toBe(beforeSensitive.patName);
        expect(afterSensitive.telephone).toBe(beforeSensitive.telephone);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
      rmSync(backupRoot, { recursive: true, force: true });
    }
  });
});
