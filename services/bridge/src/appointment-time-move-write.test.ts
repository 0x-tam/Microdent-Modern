import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DBFFile } from "dbffile";
import { SafeWritePlanSchema, SCHEDULE_BLOCKED_WRITE_FIELD_NAMES } from "@microdent/contracts";
import { createBridgeApp } from "./app.js";
import { parseDataRootFromValue } from "./config.js";
import { readScheduleRowInternal } from "./dbf/read-schedule-row-internal.js";
import { ALLOW_LEGACY_WRITES_ACK } from "./write-safety/constants.js";
import { writeScheduleFixtures } from "./test-fixtures/schedule-fixtures.js";
import { writeSandboxMarker } from "./test-fixtures/write-sandbox.js";
import {
  assertSafeWritePlanJson,
  withEnabledSandboxServer,
  withHttpServer,
} from "./test-fixtures/write-route-gate-helpers.js";

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

const validTimeMoveBody = {
  date: "2026-05-20",
  time: "15:00",
  room: 2,
};

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

  it("rejects WRITE_MODE=disabled", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-time-disabled-"));
    try {
      await writeScheduleFixtures(tmp);
      writeSandboxMarker(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const schedPath = join(tmp, "SCHEDULE.DBF");
      const mtimeBefore = statSync(schedPath).mtimeMs;

      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot, writeMode: "disabled" },
      });
      await withHttpServer(app, async (port) => {
        const res = await patchTime(port, "1001", validTimeMoveBody);
        expect(res.status).toBe(403);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("WRITE_MODE_DISABLED");
        expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects enabled mode without sandbox marker", async () => {
    vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
    await withEnabledSandboxServer(
      { prefix: "bridge-time-no-marker-", withMarker: false },
      async ({ port, schedPath }) => {
        const mtimeBefore = statSync(schedPath).mtimeMs;
        const res = await patchTime(port, "1001", validTimeMoveBody);
        expect(res.status).toBe(403);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("WRITE_SANDBOX_MARKER_MISSING");
        expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
      },
    );
  });

  it("rejects enabled mode without allow flag", async () => {
    vi.stubEnv("ALLOW_LEGACY_WRITES", "");
    await withEnabledSandboxServer({ prefix: "bridge-time-no-allow-" }, async ({ port, schedPath }) => {
      const mtimeBefore = statSync(schedPath).mtimeMs;
      const res = await patchTime(port, "1001", validTimeMoveBody);
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error?: { code?: string } };
      expect(json.error?.code).toBe("WRITE_NOT_ACKNOWLEDGED");
      expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
    });
  });

  it("does not write when backup fails", async () => {
    vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
    await withEnabledSandboxServer(
      { prefix: "bridge-time-backup-fail-", backupDirMode: 0o500 },
      async ({ port, dataRoot, schedPath }) => {
        const mtimeBefore = statSync(schedPath).mtimeMs;
        const before = await readScheduleRowInternal(dataRoot, "1001");
        expect(before.kind).toBe("ok");
        if (before.kind !== "ok") return;

        const res = await patchTime(port, "1001", validTimeMoveBody);
        expect(res.status).toBe(503);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("WRITE_BACKUP_FAILED");
        expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
        const after = await readScheduleRowInternal(dataRoot, "1001");
        expect(after.kind).toBe("ok");
        if (after.kind === "ok") {
          expect(after.row.time).toBe(before.row.time);
          expect(after.row.room).toBe(before.row.room);
        }
      },
    );
  });

  it("honors X-Write-Intent dry-run on enabled bridge without mutating SCHEDULE", async () => {
    vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
    await withEnabledSandboxServer({ prefix: "bridge-time-intent-" }, async ({ port, backupRoot, schedPath }) => {
      const mtimeBefore = statSync(schedPath).mtimeMs;
      const res = await patchTime(port, "1001", validTimeMoveBody, { "X-Write-Intent": "dry-run" });
      expect(res.status).toBe(200);
      const text = await res.text();
      assertSafeWritePlanJson(text);
      const parsed = SafeWritePlanSchema.parse(JSON.parse(text));
      expect(parsed.committed).toBe(false);
      expect(parsed.mode).toBe("dry-run");
      expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
      expect(readdirSync(backupRoot)).toHaveLength(0);
    });
  });

  it.each(SCHEDULE_BLOCKED_WRITE_FIELD_NAMES)(
    "rejects blocked schedule field %s in body",
    async (field) => {
      vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
      await withEnabledSandboxServer({ prefix: `bridge-time-blocked-${field}-` }, async ({ port }) => {
        const res = await patchTime(port, "1001", {
          date: "2026-05-20",
          time: "15:00",
          room: 1,
          [field]: "blocked-value",
        });
        expect(res.status).toBe(400);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("BLOCKED_SCHEDULE_FIELD");
      });
    },
  );

  it("returns 409 when move overlaps another appointment", async () => {
    vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
    await withEnabledSandboxServer({ prefix: "bridge-time-conflict-" }, async ({ port }) => {
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
  });

  it("creates backup then updates DATE/TIME/ROOM without touching blocked fields", async () => {
    vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
    await withEnabledSandboxServer({ prefix: "bridge-time-ok-" }, async ({ port, dataRoot, backupRoot, tmp }) => {
      const beforeSensitive = await readSensitiveFieldsFromDbf(tmp, "1001");

      const res = await patchTime(port, "1001", validTimeMoveBody);
      expect(res.status).toBe(200);
      const text = await res.text();
      assertSafeWritePlanJson(text);
      const parsed = SafeWritePlanSchema.parse(JSON.parse(text));
      expect(parsed.committed).toBe(true);
      expect(parsed.workflow).toBe("appointment.timeMove");

      const backupFolders = readdirSync(backupRoot);
      expect(backupFolders.length).toBe(1);
      expect(backupFolders[0]).toContain("appointment.timeMove");

      const row = await readScheduleRowInternal(dataRoot, "1001");
      expect(row.kind).toBe("ok");
      if (row.kind === "ok") {
        expect(row.row.date).toBe("2026-05-20");
        expect(row.row.time).toBe("15:00");
        expect(row.row.room).toBe(2);
      }

      const afterSensitive = await readSensitiveFieldsFromDbf(tmp, "1001");
      expect(afterSensitive.comment).toBe(beforeSensitive.comment);
      expect(afterSensitive.patName).toBe(beforeSensitive.patName);
      expect(afterSensitive.telephone).toBe(beforeSensitive.telephone);
    });
  });
});
