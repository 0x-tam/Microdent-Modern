import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SCHEDULE_BLOCKED_WRITE_FIELD_NAMES } from "@microdent/contracts";
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
  "/odontogram",
  "/allerg",
] as const;

/** Out-of-scope legacy columns; strict Zod bodies must reject these on schedule routes. */
const FORBIDDEN_OUT_OF_SCOPE_SCHEDULE_BODY_KEYS = [
  "NOTE",
  "DESCRIPT",
  "DESC",
  "AMOUNT",
  "SAMOUNT",
] as const;

const ALLOWED_TIME_MOVE_BODY = {
  date: "2026-06-01",
  time: "10:00",
  room: 1,
} as const;

async function patchTimeMove(
  port: number,
  appointmentId: string,
  extra: Record<string, unknown>,
): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/v1/schedule/appointments/${appointmentId}/time`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Write-Intent": "commit" },
    body: JSON.stringify({ ...ALLOWED_TIME_MOVE_BODY, ...extra }),
  });
}

async function postCreate(
  port: number,
  extra: Record<string, unknown>,
): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/v1/schedule/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Write-Intent": "commit" },
    body: JSON.stringify({
      date: "2026-06-02",
      time: "11:00",
      room: 1,
      patId: 90001,
      ...extra,
    }),
  });
}

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
    const blockedKeyChecks = V1_SOURCE.match(/findBlockedScheduleBodyKeys\(req\.body\)/g) ?? [];
    expect(blockedKeyChecks).toHaveLength(2);
  });

  it.each(SCHEDULE_BLOCKED_WRITE_FIELD_NAMES)(
    "rejects blocked schedule field %s on time-move PATCH",
    async (field) => {
      await withEnabledSandboxServer({ prefix: `inventory-time-${field}-` }, async ({ port }) => {
        vi.stubEnv("ALLOW_LEGACY_WRITES", "I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY");
        const res = await patchTimeMove(port, "1001", { [field]: "blocked" });
        expect(res.status).toBe(400);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("BLOCKED_SCHEDULE_FIELD");
      });
    },
  );

  it.each(SCHEDULE_BLOCKED_WRITE_FIELD_NAMES)(
    "rejects blocked schedule field %s on appointment create POST",
    async (field) => {
      await withEnabledSandboxServer({ prefix: `inventory-create-${field}-` }, async ({ port }) => {
        vi.stubEnv("ALLOW_LEGACY_WRITES", "I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY");
        const res = await postCreate(port, { [field]: "blocked" });
        expect(res.status).toBe(400);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("BLOCKED_SCHEDULE_FIELD");
      });
    },
  );

  it.each(FORBIDDEN_OUT_OF_SCOPE_SCHEDULE_BODY_KEYS)(
    "rejects out-of-scope body key %s on time-move PATCH (strict schema)",
    async (field) => {
      await withEnabledSandboxServer({ prefix: `inventory-strict-${field}-` }, async ({ port }) => {
        vi.stubEnv("ALLOW_LEGACY_WRITES", "I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY");
        const res = await patchTimeMove(port, "1001", { [field]: "blocked" });
        expect(res.status).toBe(400);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("INVALID_REQUEST_BODY");
      });
    },
  );

  it.each(FORBIDDEN_OUT_OF_SCOPE_SCHEDULE_BODY_KEYS)(
    "rejects out-of-scope body key %s on appointment create POST (strict schema)",
    async (field) => {
      await withEnabledSandboxServer({ prefix: `inventory-create-strict-${field}-` }, async ({ port }) => {
        vi.stubEnv("ALLOW_LEGACY_WRITES", "I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY");
        const res = await postCreate(port, { [field]: "blocked" });
        expect(res.status).toBe(400);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("INVALID_REQUEST_BODY");
      });
    },
  );

  it("rejects blocked COMMENT on status PATCH before commit", async () => {
    await withEnabledSandboxServer({ prefix: "inventory-status-comment-" }, async ({ port }) => {
      vi.stubEnv("ALLOW_LEGACY_WRITES", "I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY");
      const res = await fetch(
        `http://127.0.0.1:${port}/v1/schedule/appointments/1001/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-Write-Intent": "commit" },
          body: JSON.stringify({ status: 2, COMMENT: "blocked" }),
        },
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error?: { code?: string } };
      expect(json.error?.code).toBe("INVALID_REQUEST_BODY");
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

  it.each(["TELEPHONE", "PAT_NAME", "AMOUNT", "SAMOUNT"] as const)(
    "rejects forbidden demographics body key %s (strict schema)",
    async (field) => {
      const tmp = mkdtempSync(join(tmpdir(), `inventory-demo-${field}-`));
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
            body: JSON.stringify({ firstName: "Demo", [field]: "blocked" }),
          });
          expect(res.status).toBe(400);
          const json = (await res.json()) as { error?: { code?: string } };
          expect(json.error?.code).toBe("INVALID_REQUEST_BODY");
        });
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    },
  );
});
