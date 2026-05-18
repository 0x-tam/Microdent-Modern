import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBridgeApp } from "../app.js";
import { parseBackupDirFromValue, parseDataRootFromValue } from "../config.js";
import { FORBIDDEN_LEGACY_COPY_ROOT, ALLOW_LEGACY_WRITES_ACK } from "./constants.js";
import { writeScheduleFixtures } from "../test-fixtures/schedule-fixtures.js";
import { writeSandboxMarker } from "../test-fixtures/write-sandbox.js";
import {
  assertSafeWritePlanJson,
  withEnabledSandboxServer,
  withHttpServer,
} from "../test-fixtures/write-route-gate-helpers.js";

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function patchStatus(
  port: number,
  appointmentId: string,
  status: number,
  headers?: Record<string, string>,
): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/v1/schedule/appointments/${appointmentId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ status }),
  });
}

describe("write route safety band", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects WRITE_MODE=disabled without changing SCHEDULE hash", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "write-safety-disabled-"));
    try {
      await writeScheduleFixtures(tmp);
      writeSandboxMarker(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const hashBefore = sha256File(join(tmp, "SCHEDULE.DBF"));

      const app = createBridgeApp("v-write-safety", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot, writeMode: "disabled" },
      });
      await withHttpServer(app, async (port) => {
        const res = await patchStatus(port, "1001", 3);
        expect(res.status).toBe(403);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("WRITE_MODE_DISABLED");
      });

      expect(sha256File(join(tmp, "SCHEDULE.DBF"))).toBe(hashBefore);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects enabled commit without sandbox marker", async () => {
    await withEnabledSandboxServer(
      { prefix: "write-safety-no-marker-", withMarker: false },
      async ({ port, schedPath }) => {
        vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
        const mtimeBefore = statSync(schedPath).mtimeMs;
        const res = await patchStatus(port, "1001", 3);
        expect(res.status).toBe(403);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("WRITE_SANDBOX_MARKER_MISSING");
        expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
      },
    );
  });

  it("rejects enabled commit without ALLOW_LEGACY_WRITES ack", async () => {
    await withEnabledSandboxServer({ prefix: "write-safety-no-allow-" }, async ({ port, schedPath }) => {
      vi.stubEnv("ALLOW_LEGACY_WRITES", "");
      const mtimeBefore = statSync(schedPath).mtimeMs;
      const res = await patchStatus(port, "1001", 3);
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error?: { code?: string } };
      expect(json.error?.code).toBe("WRITE_NOT_ACKNOWLEDGED");
      expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
    });
  });

  it("rejects enabled commit when BACKUP_DIR is not configured", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "write-safety-no-backup-"));
    try {
      await writeScheduleFixtures(tmp);
      writeSandboxMarker(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const schedPath = join(tmp, "SCHEDULE.DBF");
      const mtimeBefore = statSync(schedPath).mtimeMs;

      vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
      const app = createBridgeApp("v-write-safety", {
        bridgeConfig: {
          listen: { host: "127.0.0.1", port: 0 },
          dataRoot,
          writeMode: "enabled",
        },
      });
      await withHttpServer(app, async (port) => {
        const res = await patchStatus(port, "1001", 3);
        expect(res.status).toBe(503);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("WRITE_BACKUP_NOT_CONFIGURED");
        expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects forbidden legacy-copy DATA_ROOT on commit", async () => {
    const backupRoot = mkdtempSync(join(tmpdir(), "write-safety-forbidden-backup-"));
    try {
      const dataRoot = parseDataRootFromValue(join(FORBIDDEN_LEGACY_COPY_ROOT, "DATA"));
      if (!dataRoot.configured) throw new Error("data root");

      vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
      const app = createBridgeApp("v-write-safety", {
        bridgeConfig: {
          listen: { host: "127.0.0.1", port: 0 },
          dataRoot,
          backupDir: parseBackupDirFromValue(backupRoot),
          writeMode: "enabled",
        },
      });
      await withHttpServer(app, async (port) => {
        const res = await patchStatus(port, "1001", 3);
        expect(res.status).toBe(403);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("WRITE_TARGET_FORBIDDEN_LEGACY_COPY");
      });
    } finally {
      rmSync(backupRoot, { recursive: true, force: true });
    }
  });

  it("dry-run on enabled bridge leaves SCHEDULE hash unchanged and creates no backup", async () => {
    await withEnabledSandboxServer({ prefix: "write-safety-dry-run-" }, async ({ port, schedPath, backupRoot }) => {
      vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
      const hashBefore = sha256File(schedPath);
      const res = await patchStatus(port, "1001", 3, { "X-Write-Intent": "dry-run" });
      expect(res.status).toBe(200);
      const text = await res.text();
      assertSafeWritePlanJson(text);
      expect(sha256File(schedPath)).toBe(hashBefore);
      expect(readdirSync(backupRoot)).toHaveLength(0);
    });
  });
});
