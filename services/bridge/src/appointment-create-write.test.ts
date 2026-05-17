import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DBFFile } from "dbffile";
import { SafeWritePlanSchema, SCHEDULE_BLOCKED_WRITE_FIELD_NAMES } from "@microdent/contracts";
import { createBridgeApp } from "./app.js";
import { parseDataRootFromValue } from "./config.js";
import { lookupScheduleAppointmentById } from "./dbf/schedule-appointments.js";
import { ALLOW_LEGACY_WRITES_ACK } from "./write-safety/constants.js";
import { writeScheduleFixtures } from "./test-fixtures/schedule-fixtures.js";
import { writeSandboxMarker } from "./test-fixtures/write-sandbox.js";
import {
  assertSafeWritePlanJson,
  withEnabledSandboxServer,
  withHttpServer,
} from "./test-fixtures/write-route-gate-helpers.js";

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

const validCreateBody = {
  date: "2026-05-21",
  time: "08:00",
  room: 1,
  durationSlots: 1,
  patId: "50001",
};

describe("POST appointment create — sandbox write band", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects WRITE_MODE=disabled", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-create-disabled-"));
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
        const res = await postCreate(port, validCreateBody);
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
      { prefix: "bridge-create-no-marker-", withMarker: false },
      async ({ port, schedPath }) => {
        const mtimeBefore = statSync(schedPath).mtimeMs;
        const res = await postCreate(port, validCreateBody);
        expect(res.status).toBe(403);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("WRITE_SANDBOX_MARKER_MISSING");
        expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
      },
    );
  });

  it("rejects enabled mode without allow flag", async () => {
    vi.stubEnv("ALLOW_LEGACY_WRITES", "");
    await withEnabledSandboxServer({ prefix: "bridge-create-no-allow-" }, async ({ port, schedPath }) => {
      const mtimeBefore = statSync(schedPath).mtimeMs;
      const res = await postCreate(port, validCreateBody);
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error?: { code?: string } };
      expect(json.error?.code).toBe("WRITE_NOT_ACKNOWLEDGED");
      expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
    });
  });

  it("does not write when backup fails", async () => {
    vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
    await withEnabledSandboxServer(
      { prefix: "bridge-create-backup-fail-", backupDirMode: 0o500 },
      async ({ port, schedPath }) => {
        const mtimeBefore = statSync(schedPath).mtimeMs;
        const res = await postCreate(port, validCreateBody);
        expect(res.status).toBe(503);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("WRITE_BACKUP_FAILED");
        expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
      },
    );
  });

  it("honors X-Write-Intent dry-run on enabled bridge without mutating SCHEDULE", async () => {
    vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
    await withEnabledSandboxServer({ prefix: "bridge-create-intent-" }, async ({ port, backupRoot, schedPath }) => {
      const mtimeBefore = statSync(schedPath).mtimeMs;
      const res = await postCreate(port, validCreateBody, { "X-Write-Intent": "dry-run" });
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
      await withEnabledSandboxServer({ prefix: `bridge-create-blocked-${field}-` }, async ({ port }) => {
        const res = await postCreate(port, {
          ...validCreateBody,
          [field]: "blocked-value",
        });
        expect(res.status).toBe(400);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("BLOCKED_SCHEDULE_FIELD");
      });
    },
  );

  it("rejects invalid patient id", async () => {
    vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
    await withEnabledSandboxServer({ prefix: "bridge-create-invalid-pat-" }, async ({ port }) => {
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
  });

  it("creates appointment with empty blocked columns", async () => {
    vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
    await withEnabledSandboxServer({ prefix: "bridge-create-ok-" }, async ({ port, backupRoot, tmp, dataRoot }) => {
      const res = await postCreate(port, validCreateBody);
      expect(res.status).toBe(200);
      const text = await res.text();
      assertSafeWritePlanJson(text);
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
  });
});
