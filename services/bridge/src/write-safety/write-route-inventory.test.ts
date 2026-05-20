import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBridgeApp } from "../app.js";
import { writeScheduleFixtures } from "../test-fixtures/schedule-fixtures.js";
import { writeSandboxMarker } from "../test-fixtures/write-sandbox.js";
import {
  withEnabledSandboxServer,
  withHttpServer,
} from "../test-fixtures/write-route-gate-helpers.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const V1_SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "routes", "v1.ts"),
  "utf8",
);

const ALLOWED_WRITE_ROUTES = [
  'router.patch("/schedule/appointments/:appointmentId/status"',
  'router.patch("/schedule/appointments/:appointmentId/time"',
  'router.post("/schedule/appointments"',
  'router.patch("/patients/:patientId/demographics"',
] as const;

const FORBIDDEN_WRITE_PATH_FRAGMENTS = [
  "/ledger",
  "/treatment",
  "/chart",
  "/medical",
  "/memo",
  "/payment",
] as const;

describe("write route inventory", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("registers exactly four PATCH/POST write handlers in v1.ts", () => {
    const patchCount = (V1_SOURCE.match(/router\.patch\(/g) ?? []).length;
    const postCount = (V1_SOURCE.match(/router\.post\(/g) ?? []).length;
    expect(patchCount).toBe(3);
    expect(postCount).toBe(1);
    expect(V1_SOURCE).not.toMatch(/router\.delete\(/);
    expect(V1_SOURCE).not.toMatch(/router\.put\(/);
    for (const route of ALLOWED_WRITE_ROUTES) {
      expect(V1_SOURCE).toContain(route);
    }
    for (const fragment of FORBIDDEN_WRITE_PATH_FRAGMENTS) {
      expect(V1_SOURCE).not.toMatch(
        new RegExp(`router\\.(patch|post)\\([^)]*${fragment.replace(/\//g, "\\/")}`, "i"),
      );
    }
  });

  it("rejects blocked schedule fields on time-move PATCH", async () => {
    await withEnabledSandboxServer({ prefix: "inventory-comment-" }, async ({ port }) => {
      vi.stubEnv("ALLOW_LEGACY_WRITES", "I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY");
      const res = await fetch(
        `http://127.0.0.1:${port}/v1/schedule/appointments/1001/time`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-Write-Intent": "commit" },
          body: JSON.stringify({
            date: "2026-06-01",
            time: "10:00",
            room: "1",
            COMMENT: "blocked",
          }),
        },
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error?: { code?: string } };
      expect(json.error?.code).toBe("BLOCKED_SCHEDULE_FIELD");
    });
  });

  it("rejects non-allowlisted keys on patient demographics PATCH (strict schema)", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "inventory-demo-"));
    try {
      await writeScheduleFixtures(tmp);
      writeSandboxMarker(tmp);
      const app = createBridgeApp("v-inventory-demo", {
        bridgeConfig: {
          listen: { host: "127.0.0.1", port: 0 },
          dataRoot: { configured: true, path: tmp },
          writeMode: "enabled",
          backupDir: { configured: true, path: join(tmp, "backups") },
        },
      });
      await withHttpServer(app, async (port) => {
        vi.stubEnv("ALLOW_LEGACY_WRITES", "I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY");
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/90001/demographics`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-Write-Intent": "commit" },
          body: JSON.stringify({ displayName: "Demo", telephone: "555-0000" }),
        });
        expect(res.status).toBe(400);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("INVALID_REQUEST_BODY");
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
