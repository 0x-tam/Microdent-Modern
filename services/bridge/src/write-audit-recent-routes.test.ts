import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { WriteAuditRecentResponseSchema } from "@microdent/contracts";
import { applyMigrations, beginWriteAudit, finishWriteAudit } from "@microdent/sqlite-mirror";
import { createBridgeApp } from "./app.js";
import { parseSqlitePathFromValue } from "./config.js";
import { openDatabaseSync } from "./sqlite/node-sqlite.js";

function nodeSqliteAvailable(): boolean {
  const [major, minor] = process.versions.node.split(".").map(Number);
  return major > 22 || (major === 22 && minor >= 5);
}

async function withServer(
  sqlitePath: string | undefined,
  fn: (port: number) => Promise<void>,
): Promise<void> {
  const app = createBridgeApp(undefined, {
    bridgeConfig: {
      listen: { host: "127.0.0.1", port: 0 },
      dataRoot: { configured: false },
      sqlitePath:
        sqlitePath === undefined
          ? { configured: false }
          : parseSqlitePathFromValue(sqlitePath),
    },
  });
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

function assertNoPathsOrPhi(jsonText: string): void {
  expect(jsonText).not.toMatch(/SQLITE_PATH/i);
  expect(jsonText).not.toMatch(/DATA_ROOT/i);
  expect(jsonText).not.toMatch(/Microdent-Legacy/i);
  expect(jsonText).not.toMatch(/\/Users\//);
  expect(jsonText).not.toMatch(/\/tmp\//);
  expect(jsonText).not.toMatch(/mirror\.sqlite/);
  expect(jsonText).not.toContain("target_record_ids");
  expect(jsonText).not.toContain("target_tables");
  expect(jsonText).not.toContain("actor_id");
  expect(jsonText).not.toContain("detail_json");
  expect(jsonText).not.toContain("execution_mode");
  expect(jsonText).not.toContain("PAT_NAME");
  expect(jsonText).not.toMatch(/Smith|Jane|John/i);
}

function seedWriteAudit(sqlitePath: string, operationId: string): void {
  const db = openDatabaseSync(sqlitePath);
  try {
    beginWriteAudit(db, {
      operationId,
      workflowType: "appointment.statusUpdate",
      executionMode: "real_write",
      targetTables: ["SCHEDULE"],
      targetRecordIds: [{ table: "SCHEDULE", id: "SYNTHETIC_RECORD_1001" }],
      actorType: "cli",
      actorId: "cli:synthetic_actor",
    });
    finishWriteAudit(db, {
      operationId,
      terminalStatus: "success",
    });
  } finally {
    db.close();
  }
}

describe("GET /v1/meta/write-audit-recent", () => {
  it("returns sqliteConfigured false when SQLITE_PATH is not set", async () => {
    await withServer(undefined, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/v1/meta/write-audit-recent`);
      expect(res.status).toBe(200);
      const text = await res.text();
      assertNoPathsOrPhi(text);
      const body = WriteAuditRecentResponseSchema.parse(JSON.parse(text));
      expect(body).toEqual({
        sqliteConfigured: false,
        sqliteUsable: false,
        entries: [],
      });
    });
  });

  it.skipIf(!nodeSqliteAvailable())(
    "returns recent audit metadata after synthetic write_audit rows",
    async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-write-audit-recent-"));
    try {
      const sqlitePath = join(dir, "mirror.sqlite");
      applyMigrations(sqlitePath);
      const operationId = "00000000-0000-4000-8000-000000000099";
      seedWriteAudit(sqlitePath, operationId);

      await withServer(sqlitePath, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/meta/write-audit-recent`);
        expect(res.status).toBe(200);
        const text = await res.text();
        assertNoPathsOrPhi(text);
        expect(text).not.toContain("SYNTHETIC_RECORD_1001");
        expect(text).not.toContain("synthetic_actor");
        const body = WriteAuditRecentResponseSchema.parse(JSON.parse(text));
        expect(body.sqliteConfigured).toBe(true);
        expect(body.sqliteUsable).toBe(true);
        expect(body.entries.length).toBeGreaterThanOrEqual(1);
        const entry = body.entries.find((e) => e.operationId === operationId);
        expect(entry).toBeDefined();
        expect(entry?.workflow).toBe("appointment.statusUpdate");
        expect(entry?.terminalStatus).toBe("success");
        expect(entry?.requestedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(entry?.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  );

  it("returns sqliteUsable false when SQLITE_PATH points at invalid file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-write-audit-recent-bad-"));
    try {
      const badPath = join(dir, "not-sqlite.txt");
      writeFileSync(badPath, "not a database", "utf8");

      await withServer(badPath, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/meta/write-audit-recent`);
        expect(res.status).toBe(200);
        const text = await res.text();
        assertNoPathsOrPhi(text);
        const body = WriteAuditRecentResponseSchema.parse(JSON.parse(text));
        expect(body.sqliteConfigured).toBe(true);
        expect(body.sqliteUsable).toBe(false);
        expect(body.entries).toEqual([]);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
