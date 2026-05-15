import { createServer } from "node:http";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { SafeWritePlanSchema } from "@microdent/contracts";
import { createBridgeApp } from "./app.js";
import { parseDataRootFromValue } from "./config.js";
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

function patchStatus(
  port: number,
  appointmentId: string,
  status: number,
): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/v1/schedule/appointments/${appointmentId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

describe("PATCH /v1/schedule/appointments/:appointmentId/status", () => {
  it("returns 403 WRITE_MODE_DISABLED when writes are disabled", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-appt-status-disabled-"));
    try {
      await writeScheduleFixtures(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const schedPath = join(tmp, "SCHEDULE.DBF");
      const mtimeBefore = statSync(schedPath).mtimeMs;

      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot, writeMode: "disabled" },
      });
      await withServer(app, async (port) => {
        const res = await patchStatus(port, "1001", 3);
        expect(res.status).toBe(403);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("WRITE_MODE_DISABLED");
        expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns SafeWritePlan with committed false in dry-run mode", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-appt-status-dryrun-"));
    try {
      await writeScheduleFixtures(tmp);
      writeSandboxMarker(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const schedPath = join(tmp, "SCHEDULE.DBF");
      const mtimeBefore = statSync(schedPath).mtimeMs;

      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot, writeMode: "dry-run" },
      });
      await withServer(app, async (port) => {
        const res = await patchStatus(port, "1001", 3);
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).not.toContain("SYNTHETIC_COMMENT_TOKEN");
        expect(text).not.toContain("SYNTHETIC_NAME_TOKEN");
        expect(text).not.toContain("SYNTHETIC_PHONE_TOKEN");
        expect(text).not.toMatch(/"PAT_NAME"/i);
        expect(text).not.toMatch(/"TELEPHONE"/i);
        expect(text).not.toMatch(/"COMMENT"/i);

        const parsed = SafeWritePlanSchema.safeParse(JSON.parse(text));
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.committed).toBe(false);
        expect(parsed.data.mode).toBe("dry-run");
        expect(parsed.data.workflow).toBe("appointment.statusUpdate");
        expect(parsed.data.tablesAffected).toEqual(["SCHEDULE"]);
        expect(parsed.data.recordIds).toEqual(["1001"]);
        expect(parsed.data.fieldsChanged).toEqual([
          { table: "SCHEDULE", recordId: "1001", field: "STATUS", changeType: "set" },
        ]);
        expect(parsed.data.backupRequired).toBe(true);
        expect(parsed.data.warnings).toHaveLength(0);
        expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects invalid status values", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-appt-status-invalid-"));
    try {
      await writeScheduleFixtures(tmp);
      writeSandboxMarker(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const schedPath = join(tmp, "SCHEDULE.DBF");
      const mtimeBefore = statSync(schedPath).mtimeMs;

      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot, writeMode: "dry-run" },
      });
      await withServer(app, async (port) => {
        const res = await patchStatus(port, "1001", 9);
        expect(res.status).toBe(400);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("INVALID_APPOINTMENT_STATUS");
        expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns 404 when the appointment id is not in SCHEDULE.DBF", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-appt-status-missing-"));
    try {
      await writeScheduleFixtures(tmp);
      writeSandboxMarker(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const schedPath = join(tmp, "SCHEDULE.DBF");
      const mtimeBefore = statSync(schedPath).mtimeMs;

      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot, writeMode: "dry-run" },
      });
      await withServer(app, async (port) => {
        const res = await patchStatus(port, "99999", 2);
        expect(res.status).toBe(404);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("SCHEDULE_APPOINTMENT_NOT_FOUND");
        expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
