import { createServer } from "node:http";
import { chmodSync, mkdtempSync, rmSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { MirrorStatusResponseSchema } from "@microdent/contracts";
import { applyMigrations, importDoctors } from "@microdent/sqlite-mirror";
import { createBridgeApp } from "./app.js";
import { parseSqlitePathFromValue } from "./config.js";

async function withServer(
  sqlitePath: string | undefined,
  dataRoot: string | undefined,
  fn: (port: number) => Promise<void>,
): Promise<void> {
  const app = createBridgeApp(undefined, {
    bridgeConfig: {
      listen: { host: "127.0.0.1", port: 0 },
      dataRoot:
        dataRoot === undefined
          ? { configured: false }
          : { configured: true, path: dataRoot, realPath: dataRoot },
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

const doctorFields = [
  { name: "DOCTOR_NB", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "NAME", type: "C" as const, size: 30 },
  { name: "SCHEDULE", type: "N" as const, size: 1, decimalPlaces: 0 },
  { name: "PHONE", type: "C" as const, size: 19 },
];

async function writeSyntheticDoctorsDbf(dir: string): Promise<void> {
  const path = join(dir, "DOCTORS.DBF");
  const dbf = await DBFFile.create(path, doctorFields, {});
  await dbf.appendRecords([
    { DOCTOR_NB: 101, NAME: "Synthetic Provider Alpha", SCHEDULE: 1, PHONE: "555-000-1001" },
  ]);
}

function assertNoPathsOrPhi(jsonText: string): void {
  expect(jsonText).not.toMatch(/SQLITE_PATH/i);
  expect(jsonText).not.toMatch(/DATA_ROOT/i);
  expect(jsonText).not.toMatch(/Microdent-Legacy/i);
  expect(jsonText).not.toMatch(/\/Users\//);
  expect(jsonText).not.toMatch(/\/tmp\//);
  expect(jsonText).not.toMatch(/mirror\.sqlite/);
  expect(jsonText).not.toContain("PAT_NAME");
  expect(jsonText).not.toMatch(/Smith|Jane|John/i);
}

describe("GET /v1/mirror/status", () => {
  it("returns sqliteConfigured false when SQLITE_PATH is not set", async () => {
    await withServer(undefined, undefined, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/v1/mirror/status`);
      expect(res.status).toBe(200);
      const text = await res.text();
      assertNoPathsOrPhi(text);
      const body = MirrorStatusResponseSchema.parse(JSON.parse(text));
      expect(body).toEqual({
        sqliteConfigured: false,
        sqliteUsable: false,
        importedTables: [],
        latestImportRuns: [],
      });
    });
  });

  it("returns sqliteUsable true with imported tables after synthetic import", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-mirror-status-"));
    try {
      const sqlitePath = join(dir, "mirror.sqlite");
      const dataRoot = mkdtempSync(join(tmpdir(), "microdent-mirror-status-data-"));
      await writeSyntheticDoctorsDbf(dataRoot);
      applyMigrations(sqlitePath);
      await importDoctors({ dataRoot, sqlitePath, trigger: "manual" });

      await withServer(sqlitePath, dataRoot, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/mirror/status`);
        expect(res.status).toBe(200);
        const text = await res.text();
        assertNoPathsOrPhi(text);
        const body = MirrorStatusResponseSchema.parse(JSON.parse(text));
        expect(body.sqliteConfigured).toBe(true);
        expect(body.sqliteUsable).toBe(true);
        expect(body.importedTables).toContain("doctors");
        expect(body.latestImportRuns.some((r) => r.tableName === "doctors")).toBe(true);
        const doctorsRun = body.latestImportRuns.find((r) => r.tableName === "doctors");
        expect(doctorsRun?.status).toBe("success");
        expect(doctorsRun?.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(body.sourceChangedSinceImport).toBe(false);
        expect(body.sourceFileStatuses?.find((s) => s.tableName === "doctors")?.status).toBe("unchanged");
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports copied file metadata changes since the last import without paths", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-mirror-status-changed-"));
    try {
      const sqlitePath = join(dir, "mirror.sqlite");
      const dataRoot = mkdtempSync(join(tmpdir(), "microdent-mirror-status-data-"));
      await writeSyntheticDoctorsDbf(dataRoot);
      applyMigrations(sqlitePath);
      await importDoctors({ dataRoot, sqlitePath, trigger: "manual" });

      const doctorPath = join(dataRoot, "DOCTORS.DBF");
      const future = new Date(Date.now() + 60_000);
      utimesSync(doctorPath, future, future);

      await withServer(sqlitePath, dataRoot, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/mirror/status`);
        const text = await res.text();
        assertNoPathsOrPhi(text);
        const body = MirrorStatusResponseSchema.parse(JSON.parse(text));
        expect(body.sourceChangedSinceImport).toBe(true);
        expect(body.sourceFileStatuses?.find((s) => s.tableName === "doctors")?.status).toBe("changed");
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports missing copied files since the last import without paths", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-mirror-status-missing-"));
    try {
      const sqlitePath = join(dir, "mirror.sqlite");
      const dataRoot = mkdtempSync(join(tmpdir(), "microdent-mirror-status-data-"));
      await writeSyntheticDoctorsDbf(dataRoot);
      applyMigrations(sqlitePath);
      await importDoctors({ dataRoot, sqlitePath, trigger: "manual" });
      unlinkSync(join(dataRoot, "DOCTORS.DBF"));

      await withServer(sqlitePath, dataRoot, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/mirror/status`);
        const text = await res.text();
        assertNoPathsOrPhi(text);
        const body = MirrorStatusResponseSchema.parse(JSON.parse(text));
        expect(body.sourceChangedSinceImport).toBe(true);
        expect(body.sourceFileStatuses?.find((s) => s.tableName === "doctors")?.status).toBe("missing");
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports unreadable copied files since the last import without paths", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-mirror-status-unreadable-"));
    let dataRoot: string | undefined;
    try {
      const sqlitePath = join(dir, "mirror.sqlite");
      dataRoot = mkdtempSync(join(tmpdir(), "microdent-mirror-status-data-"));
      await writeSyntheticDoctorsDbf(dataRoot);
      applyMigrations(sqlitePath);
      await importDoctors({ dataRoot, sqlitePath, trigger: "manual" });
      chmodSync(dataRoot, 0o000);

      await withServer(sqlitePath, dataRoot, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/mirror/status`);
        const text = await res.text();
        assertNoPathsOrPhi(text);
        const body = MirrorStatusResponseSchema.parse(JSON.parse(text));
        expect(body.sourceChangedSinceImport).toBe(true);
        expect(body.sourceFileStatuses?.find((s) => s.tableName === "doctors")?.status).toBe("unreadable");
      });
    } finally {
      if (dataRoot) chmodSync(dataRoot, 0o700);
      rmSync(dir, { recursive: true, force: true });
      if (dataRoot) rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("returns sqliteUsable false when SQLITE_PATH points at invalid file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-mirror-status-bad-"));
    try {
      const badPath = join(dir, "not-sqlite.txt");
      writeFileSync(badPath, "not a database", "utf8");

      await withServer(badPath, undefined, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/mirror/status`);
        expect(res.status).toBe(200);
        const text = await res.text();
        assertNoPathsOrPhi(text);
        const body = MirrorStatusResponseSchema.parse(JSON.parse(text));
        expect(body.sqliteConfigured).toBe(true);
        expect(body.sqliteUsable).toBe(false);
        expect(body.importedTables).toEqual([]);
        expect(body.latestImportRuns).toEqual([]);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("includes failed import runs in latestImportRuns via tables_requested", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-mirror-status-failed-"));
    try {
      const sqlitePath = join(dir, "mirror.sqlite");
      const dataRoot = join(dir, "empty-data");
      applyMigrations(sqlitePath);
      await importDoctors({ dataRoot, sqlitePath, trigger: "manual" });

      await withServer(sqlitePath, dataRoot, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/mirror/status`);
        const body = MirrorStatusResponseSchema.parse(JSON.parse(await res.text()));
        const doctorsRun = body.latestImportRuns.find((r) => r.tableName === "doctors");
        expect(doctorsRun?.status).toBe("failed");
        expect(doctorsRun?.errorCount).toBeGreaterThan(0);
        expect(doctorsRun?.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns sqliteUsable false when configured path does not exist", async () => {
    const missing = join(tmpdir(), `microdent-missing-mirror-${Date.now()}.sqlite`);
    await withServer(missing, undefined, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/v1/mirror/status`);
      const text = await res.text();
      assertNoPathsOrPhi(text);
      const body = MirrorStatusResponseSchema.parse(JSON.parse(text));
      expect(body.sqliteConfigured).toBe(true);
      expect(body.sqliteUsable).toBe(false);
    });
  });
});
