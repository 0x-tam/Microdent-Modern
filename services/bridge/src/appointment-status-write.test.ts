import { createServer } from "node:http";
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DBFFile } from "dbffile";
import { SafeWritePlanSchema } from "@microdent/contracts";
import { applyMigrations } from "@microdent/sqlite-mirror";
import { createBridgeApp } from "./app.js";
import { parseBackupDirFromValue, parseDataRootFromValue, parseSqlitePathFromValue } from "./config.js";
import { openDatabaseSync } from "./sqlite/node-sqlite.js";
import { readScheduleAppointmentStatus } from "./write/verify/read-appointment-status.js";
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
        status: Number(rec.STATUS),
      };
    }
  }
  throw new Error("appointment not found in fixture dbf");
}

describe("PATCH appointment status — sandbox write band", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects enabled mode without sandbox marker", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-appt-write-no-marker-"));
    const backupRoot = mkdtempSync(join(tmpdir(), "bridge-appt-write-backup-"));
    try {
      await writeScheduleFixtures(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const schedPath = join(tmp, "SCHEDULE.DBF");
      const mtimeBefore = statSync(schedPath).mtimeMs;

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
        const res = await patchStatus(port, "1001", 3);
        expect(res.status).toBe(403);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("WRITE_SANDBOX_MARKER_MISSING");
        expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
      rmSync(backupRoot, { recursive: true, force: true });
    }
  });

  it("rejects enabled mode without allow flag", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-appt-write-no-allow-"));
    const backupRoot = mkdtempSync(join(tmpdir(), "bridge-appt-write-backup-"));
    try {
      await writeScheduleFixtures(tmp);
      writeSandboxMarker(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const schedPath = join(tmp, "SCHEDULE.DBF");
      const mtimeBefore = statSync(schedPath).mtimeMs;

      vi.stubEnv("ALLOW_LEGACY_WRITES", "");
      const app = createBridgeApp("v-test", {
        bridgeConfig: {
          listen: { host: "127.0.0.1", port: 0 },
          dataRoot,
          backupDir: parseBackupDirFromValue(backupRoot),
          writeMode: "enabled",
        },
      });
      await withServer(app, async (port) => {
        const res = await patchStatus(port, "1001", 3);
        expect(res.status).toBe(403);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("WRITE_NOT_ACKNOWLEDGED");
        expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
      rmSync(backupRoot, { recursive: true, force: true });
    }
  });

  it("does not write when backup fails", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-appt-write-backup-fail-"));
    const backupRoot = mkdtempSync(join(tmpdir(), "bridge-appt-write-backup-ro-"));
    try {
      await writeScheduleFixtures(tmp);
      writeSandboxMarker(tmp);
      chmodSync(backupRoot, 0o500);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const schedPath = join(tmp, "SCHEDULE.DBF");
      const mtimeBefore = statSync(schedPath).mtimeMs;
      const before = await readScheduleAppointmentStatus(dataRoot, "1001");
      expect(before.kind).toBe("ok");
      if (before.kind !== "ok") return;

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
        const res = await patchStatus(port, "1001", 3);
        expect(res.status).toBe(503);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("WRITE_BACKUP_FAILED");
        expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
        const after = await readScheduleAppointmentStatus(dataRoot, "1001");
        expect(after.kind).toBe("ok");
        if (after.kind === "ok") {
          expect(after.status).toBe(before.status);
        }
      });
    } finally {
      chmodSync(backupRoot, 0o700);
      rmSync(tmp, { recursive: true, force: true });
      rmSync(backupRoot, { recursive: true, force: true });
    }
  });

  it("honors X-Write-Intent dry-run on enabled bridge without mutating SCHEDULE", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-appt-write-intent-"));
    const backupRoot = mkdtempSync(join(tmpdir(), "bridge-appt-write-intent-backup-"));
    try {
      await writeScheduleFixtures(tmp);
      writeSandboxMarker(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const schedPath = join(tmp, "SCHEDULE.DBF");
      const mtimeBefore = statSync(schedPath).mtimeMs;

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
        const res = await patchStatus(port, "1001", 3, { "X-Write-Intent": "dry-run" });
        expect(res.status).toBe(200);
        const parsed = SafeWritePlanSchema.parse(await res.json());
        expect(parsed.committed).toBe(false);
        expect(parsed.mode).toBe("dry-run");
        expect(statSync(schedPath).mtimeMs).toBe(mtimeBefore);
        expect(readdirSync(backupRoot)).toHaveLength(0);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
      rmSync(backupRoot, { recursive: true, force: true });
    }
  });

  it("records write_audit when SQLITE_PATH is configured", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-appt-write-audit-"));
    const backupRoot = mkdtempSync(join(tmpdir(), "bridge-appt-write-audit-backup-"));
    const sqlitePath = join(tmp, "mirror.sqlite");
    try {
      await writeScheduleFixtures(tmp);
      writeSandboxMarker(tmp);
      applyMigrations(sqlitePath);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");

      vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
      const app = createBridgeApp("v-test", {
        bridgeConfig: {
          listen: { host: "127.0.0.1", port: 0 },
          dataRoot,
          backupDir: parseBackupDirFromValue(backupRoot),
          sqlitePath: parseSqlitePathFromValue(sqlitePath),
          writeMode: "enabled",
        },
      });
      await withServer(app, async (port) => {
        const res = await patchStatus(port, "1001", 3);
        expect(res.status).toBe(200);
        SafeWritePlanSchema.parse(await res.json());
      });

      const db = openDatabaseSync(sqlitePath);
      try {
        const row = db
          .prepare(
            `SELECT workflow_type, execution_mode, terminal_status
             FROM write_audit_log
             WHERE workflow_type = 'appointment.statusUpdate'
             ORDER BY requested_at DESC LIMIT 1`,
          )
          .get() as { workflow_type: string; execution_mode: string; terminal_status: string | null };
        expect(row.workflow_type).toBe("appointment.statusUpdate");
        expect(row.execution_mode).toBe("real_write");
        expect(row.terminal_status).toBe("success");
      } finally {
        db.close();
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
      rmSync(backupRoot, { recursive: true, force: true });
    }
  });

  it("creates backup then updates STATUS only with committed true", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-appt-write-ok-"));
    const backupRoot = mkdtempSync(join(tmpdir(), "bridge-appt-write-backup-ok-"));
    try {
      await writeScheduleFixtures(tmp);
      writeSandboxMarker(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const schedPath = join(tmp, "SCHEDULE.DBF");
      const beforeFields = await readSensitiveFieldsFromDbf(tmp, "1001");
      expect(beforeFields.status).toBe(1);

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
        const res = await patchStatus(port, "1001", 3);
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).not.toContain("SYNTHETIC_COMMENT_TOKEN");
        expect(text).not.toContain("SYNTHETIC_NAME_TOKEN");
        expect(text).not.toContain("SYNTHETIC_PHONE_TOKEN");
        expect(text).not.toMatch(/"PAT_NAME"/i);
        expect(text).not.toMatch(/"TELEPHONE"/i);
        expect(text).not.toMatch(/"COMMENT"/i);

        const parsed = SafeWritePlanSchema.parse(JSON.parse(text));
        expect(parsed.committed).toBe(true);
        expect(parsed.mode).toBe("enabled");
        expect(parsed.fieldsChanged).toEqual([
          { table: "SCHEDULE", recordId: "1001", field: "STATUS", changeType: "set" },
        ]);

        const backupFolders = readdirSync(backupRoot);
        expect(backupFolders.length).toBe(1);
        expect(backupFolders[0]).toContain("appointment.statusUpdate");
        const manifest = JSON.parse(
          readFileSync(join(backupRoot, backupFolders[0]!, "manifest.json"), "utf8"),
        ) as { files: { filename: string }[] };
        expect(manifest.files.map((f) => f.filename)).toContain("SCHEDULE.DBF");

        const afterFields = await readSensitiveFieldsFromDbf(tmp, "1001");
        expect(afterFields.status).toBe(3);
        expect(afterFields.comment).toBe(beforeFields.comment);
        expect(afterFields.patName).toBe(beforeFields.patName);
        expect(afterFields.telephone).toBe(beforeFields.telephone);
        expect(statSync(schedPath).mtimeMs).not.toBe(statSync(join(backupRoot, backupFolders[0]!, "files", "SCHEDULE.DBF")).mtimeMs);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
      rmSync(backupRoot, { recursive: true, force: true });
    }
  });
});
