import { createServer } from "node:http";
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DBFFile } from "dbffile";
import { SafeWritePlanSchema, type SafeWritePlan } from "@microdent/contracts";
import { createBridgeApp } from "../app.js";
import { parseBackupDirFromValue, parseDataRootFromValue, type DataRootSet } from "../config.js";
import { runLegacyRestore } from "../backup/run-legacy-restore.js";
import { readPatientProfileFromDbf } from "../dbf/patient-profile.js";
import { readScheduleRowInternal } from "../dbf/read-schedule-row-internal.js";
import { lookupScheduleAppointmentById } from "../dbf/schedule-appointments.js";
import { readScheduleAppointmentStatus } from "../write/verify/read-appointment-status.js";
import { ALLOW_LEGACY_WRITES_ACK } from "../write-safety/constants.js";
import { writeScheduleFixtures } from "../test-fixtures/schedule-fixtures.js";
import { writeSandboxMarker } from "../test-fixtures/write-sandbox.js";

const FORBIDDEN_RESPONSE_TOKENS = [
  "SYNTHETIC_COMMENT_TOKEN",
  "SYNTHETIC_NAME_TOKEN",
  "SYNTHETIC_PHONE_TOKEN",
  "SYNTHETIC_PATIENT_NOTE_TOKEN",
] as const;

const FORBIDDEN_RESPONSE_KEYS = [
  /"before"/i,
  /"after"/i,
  /"rawRow"/i,
  /"PAT_NAME"/i,
  /"TELEPHONE"/i,
  /"COMMENT"/i,
  /"HOME_PHONE"/i,
] as const;

function assertSafeWritePlanJson(text: string): SafeWritePlan {
  for (const token of FORBIDDEN_RESPONSE_TOKENS) {
    expect(text).not.toContain(token);
  }
  for (const pattern of FORBIDDEN_RESPONSE_KEYS) {
    expect(text).not.toMatch(pattern);
  }
  const parsed = SafeWritePlanSchema.parse(JSON.parse(text));
  expect(parsed.committed).toBe(false);
  expect(parsed.mode).toBe("dry-run");
  return parsed;
}

async function withServer(
  app: ReturnType<typeof createBridgeApp>,
  fn: (port: number) => Promise<void>,
): Promise<void> {
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

type TempSandbox = {
  dataRoot: DataRootSet;
  dataDir: string;
  backupDir: string;
  schedPath: string;
  patientPath: string;
};

function createTempSandbox(prefix: string): TempSandbox {
  const dataDir = mkdtempSync(join(tmpdir(), `${prefix}-data-`));
  const backupDir = mkdtempSync(join(tmpdir(), `${prefix}-backup-`));
  return {
    dataDir,
    backupDir,
    schedPath: join(dataDir, "SCHEDULE.DBF"),
    patientPath: join(dataDir, "PATIENT.DBF"),
    dataRoot: parseDataRootFromValue(dataDir) as DataRootSet & { configured: true },
  };
}

function destroyTempSandbox(sandbox: TempSandbox): void {
  rmSync(sandbox.dataDir, { recursive: true, force: true });
  rmSync(sandbox.backupDir, { recursive: true, force: true });
}

function createDryRunApp(sandbox: TempSandbox): ReturnType<typeof createBridgeApp> {
  return createBridgeApp("v-sandbox-validate", {
    bridgeConfig: {
      listen: { host: "127.0.0.1", port: 0 },
      dataRoot: sandbox.dataRoot,
      writeMode: "dry-run",
    },
  });
}

const runRealWriteBand = process.env.SANDBOX_VALIDATE_REAL === "1";

function realWriteIt(name: string, fn: () => Promise<void>): void {
  (runRealWriteBand ? it : it.skip)(name, fn);
}

function createEnabledWriteApp(sandbox: TempSandbox): ReturnType<typeof createBridgeApp> {
  vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
  return createBridgeApp("v-sandbox-validate-real", {
    bridgeConfig: {
      listen: { host: "127.0.0.1", port: 0 },
      dataRoot: sandbox.dataRoot,
      backupDir: parseBackupDirFromValue(sandbox.backupDir),
      writeMode: "enabled",
    },
  });
}

async function restoreLatestLegacyBackup(sandbox: TempSandbox): Promise<void> {
  const backupFolders = readdirSync(sandbox.backupDir);
  expect(backupFolders.length).toBe(1);
  await runLegacyRestore({
    backupFolder: join(sandbox.backupDir, backupFolders[0]!),
    dataRoot: sandbox.dataDir,
  });
}

async function readScheduleSensitiveFields(
  dataDir: string,
  appointmentId: string,
): Promise<{ comment: string; patName: string; telephone: string }> {
  const dbf = await DBFFile.open(join(dataDir, "SCHEDULE.DBF"), {
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

async function readPatientHomePhone(dataDir: string, patientId: string): Promise<string> {
  const dbf = await DBFFile.open(join(dataDir, "PATIENT.DBF"), {
    encoding: "win1252",
    readMode: "loose",
  });
  for await (const row of dbf) {
    const rec = row as Record<string, unknown>;
    if (String(rec.ID).trim() === patientId) {
      return String(rec.HOME_PHONE ?? "");
    }
  }
  throw new Error("patient not found in fixture dbf");
}

describe("sandbox validation band", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("dry-run band (synthetic temp sandbox)", () => {
    let sandbox: TempSandbox;

    beforeEach(async () => {
      sandbox = createTempSandbox("microdent-sandbox-validate");
      await writeScheduleFixtures(sandbox.dataDir);
      writeSandboxMarker(sandbox.dataDir);
    });

    afterEach(() => {
      destroyTempSandbox(sandbox);
    });

    it("PATCH appointment status — plan only, no DBF mtime change", async () => {
      const mtimeBefore = statSync(sandbox.schedPath).mtimeMs;
      const app = createDryRunApp(sandbox);

      await withServer(app, async (port) => {
        const res = await fetch(
          `http://127.0.0.1:${port}/v1/schedule/appointments/1001/status`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: 3 }),
          },
        );
        expect(res.status).toBe(200);
        const parsed = assertSafeWritePlanJson(await res.text());
        expect(parsed.workflow).toBe("appointment.statusUpdate");
        expect(parsed.fieldsChanged).toEqual([
          { table: "SCHEDULE", recordId: "1001", field: "STATUS", changeType: "set" },
        ]);
      });

      expect(statSync(sandbox.schedPath).mtimeMs).toBe(mtimeBefore);
      expect(readdirSync(sandbox.backupDir)).toHaveLength(0);
    });

    it("PATCH appointment time move — plan only, no DBF mtime change", async () => {
      const mtimeBefore = statSync(sandbox.schedPath).mtimeMs;
      const app = createDryRunApp(sandbox);

      await withServer(app, async (port) => {
        const res = await fetch(
          `http://127.0.0.1:${port}/v1/schedule/appointments/1001/time`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: "2026-05-20",
              time: "15:00",
              room: 2,
            }),
          },
        );
        expect(res.status).toBe(200);
        const parsed = assertSafeWritePlanJson(await res.text());
        expect(parsed.workflow).toBe("appointment.timeMove");
        expect(parsed.recordIds).toEqual(["1001"]);
      });

      expect(statSync(sandbox.schedPath).mtimeMs).toBe(mtimeBefore);
      expect(readdirSync(sandbox.backupDir)).toHaveLength(0);
    });

    it("POST appointment create — plan only, no DBF mtime change", async () => {
      const mtimeBefore = statSync(sandbox.schedPath).mtimeMs;
      const app = createDryRunApp(sandbox);

      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/schedule/appointments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: "2026-05-21",
            time: "08:00",
            room: 1,
            durationSlots: 1,
            patId: "50001",
          }),
        });
        expect(res.status).toBe(200);
        const parsed = assertSafeWritePlanJson(await res.text());
        expect(parsed.workflow).toBe("appointment.create");
        expect(parsed.tablesAffected).toContain("SCHEDULE");
      });

      expect(statSync(sandbox.schedPath).mtimeMs).toBe(mtimeBefore);
      expect(readdirSync(sandbox.backupDir)).toHaveLength(0);
    });

    it("PATCH patient demographics — plan only, no PATIENT.DBF mtime change", async () => {
      const mtimeBefore = statSync(sandbox.patientPath).mtimeMs;
      const app = createDryRunApp(sandbox);

      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/50001/demographics`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: "DryRun",
            lastName: "Synthetic",
            chartNumber: "SCH-DRY",
          }),
        });
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).not.toMatch(/555/);
        const parsed = assertSafeWritePlanJson(text);
        expect(parsed.workflow).toBe("patient.demographics.update");
        expect(parsed.tablesAffected).toContain("PATIENT");
      });

      expect(statSync(sandbox.patientPath).mtimeMs).toBe(mtimeBefore);
      expect(readdirSync(sandbox.backupDir)).toHaveLength(0);
    });
  });

  describe("optional real write band (SANDBOX_VALIDATE_REAL=1)", () => {
    realWriteIt(
      "status commit, backup, restore — STATUS reverted",
      async () => {
        const sandbox = createTempSandbox("microdent-sandbox-validate-real-status");
        try {
          await writeScheduleFixtures(sandbox.dataDir);
          writeSandboxMarker(sandbox.dataDir);

          const statusBefore = await readScheduleAppointmentStatus(sandbox.dataRoot, "1001");
          expect(statusBefore.kind).toBe("ok");
          if (statusBefore.kind !== "ok") return;
          expect(statusBefore.status).toBe(1);

          const app = createEnabledWriteApp(sandbox);
          await withServer(app, async (port) => {
            const res = await fetch(
              `http://127.0.0.1:${port}/v1/schedule/appointments/1001/status`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: 3 }),
              },
            );
            expect(res.status).toBe(200);
            const parsed = SafeWritePlanSchema.parse(await res.json());
            expect(parsed.committed).toBe(true);
            expect(parsed.workflow).toBe("appointment.statusUpdate");
          });

          const statusAfterWrite = await readScheduleAppointmentStatus(sandbox.dataRoot, "1001");
          expect(statusAfterWrite.kind).toBe("ok");
          if (statusAfterWrite.kind === "ok") {
            expect(statusAfterWrite.status).toBe(3);
          }

          await restoreLatestLegacyBackup(sandbox);

          const statusAfterRestore = await readScheduleAppointmentStatus(sandbox.dataRoot, "1001");
          expect(statusAfterRestore.kind).toBe("ok");
          if (statusAfterRestore.kind === "ok") {
            expect(statusAfterRestore.status).toBe(statusBefore.status);
          }
        } finally {
          destroyTempSandbox(sandbox);
        }
      },
    );

    realWriteIt(
      "time move commit, backup, restore — DATE/TIME/ROOM reverted; blocked fields unchanged",
      async () => {
        const sandbox = createTempSandbox("microdent-sandbox-validate-real-time");
        try {
          await writeScheduleFixtures(sandbox.dataDir);
          writeSandboxMarker(sandbox.dataDir);

          const rowBefore = await readScheduleRowInternal(sandbox.dataRoot, "1001");
          expect(rowBefore.kind).toBe("ok");
          if (rowBefore.kind !== "ok") return;
          const sensitiveBefore = await readScheduleSensitiveFields(sandbox.dataDir, "1001");

          const app = createEnabledWriteApp(sandbox);
          const timeMoveBody = { date: "2026-05-20", time: "15:00", room: 2 };
          await withServer(app, async (port) => {
            const res = await fetch(
              `http://127.0.0.1:${port}/v1/schedule/appointments/1001/time`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(timeMoveBody),
              },
            );
            expect(res.status).toBe(200);
            const parsed = SafeWritePlanSchema.parse(await res.json());
            expect(parsed.committed).toBe(true);
            expect(parsed.workflow).toBe("appointment.timeMove");
          });

          const rowAfterWrite = await readScheduleRowInternal(sandbox.dataRoot, "1001");
          expect(rowAfterWrite.kind).toBe("ok");
          if (rowAfterWrite.kind === "ok") {
            expect(rowAfterWrite.row.time).toBe("15:00");
            expect(rowAfterWrite.row.room).toBe(2);
            expect(rowAfterWrite.row.time).not.toBe(rowBefore.row.time);
            expect(rowAfterWrite.row.room).not.toBe(rowBefore.row.room);
          }
          const sensitiveAfterWrite = await readScheduleSensitiveFields(sandbox.dataDir, "1001");
          expect(sensitiveAfterWrite).toEqual(sensitiveBefore);

          await restoreLatestLegacyBackup(sandbox);

          const rowAfterRestore = await readScheduleRowInternal(sandbox.dataRoot, "1001");
          expect(rowAfterRestore.kind).toBe("ok");
          if (rowAfterRestore.kind === "ok") {
            expect(rowAfterRestore.row.time).toBe(rowBefore.row.time);
            expect(rowAfterRestore.row.room).toBe(rowBefore.row.room);
            expect(rowAfterRestore.row.date).toBe(rowBefore.row.date);
          }
        } finally {
          destroyTempSandbox(sandbox);
        }
      },
    );

    realWriteIt(
      "create commit, backup, restore — new appointment removed",
      async () => {
        const sandbox = createTempSandbox("microdent-sandbox-validate-real-create");
        try {
          await writeScheduleFixtures(sandbox.dataDir);
          writeSandboxMarker(sandbox.dataDir);

          const app = createEnabledWriteApp(sandbox);
          const createBody = {
            date: "2026-05-21",
            time: "08:00",
            room: 1,
            durationSlots: 1,
            patId: "50001",
          };
          let newId = "";
          await withServer(app, async (port) => {
            const res = await fetch(`http://127.0.0.1:${port}/v1/schedule/appointments`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(createBody),
            });
            expect(res.status).toBe(200);
            const parsed = SafeWritePlanSchema.parse(await res.json());
            expect(parsed.committed).toBe(true);
            expect(parsed.workflow).toBe("appointment.create");
            newId = parsed.recordIds[0]!;
          });

          const lookupAfterWrite = await lookupScheduleAppointmentById(sandbox.dataRoot, newId);
          expect(lookupAfterWrite.kind).toBe("found");

          const dbf = await DBFFile.open(sandbox.schedPath, {
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

          await restoreLatestLegacyBackup(sandbox);

          const lookupAfterRestore = await lookupScheduleAppointmentById(sandbox.dataRoot, newId);
          expect(lookupAfterRestore.kind).toBe("not_found");
        } finally {
          destroyTempSandbox(sandbox);
        }
      },
    );

    realWriteIt(
      "demographics commit, backup, restore — allowlisted fields reverted; HOME_PHONE unchanged",
      async () => {
        const sandbox = createTempSandbox("microdent-sandbox-validate-real-demo");
        try {
          await writeScheduleFixtures(sandbox.dataDir);
          writeSandboxMarker(sandbox.dataDir);

          const profileBefore = await readPatientProfileFromDbf(sandbox.dataRoot, "50001");
          expect(profileBefore.kind).toBe("ok");
          if (profileBefore.kind !== "ok") return;
          const homePhoneBefore = await readPatientHomePhone(sandbox.dataDir, "50001");

          const app = createEnabledWriteApp(sandbox);
          const demographicsBody = {
            firstName: "RealBand",
            lastName: "Synthetic",
            chartNumber: "SCH-REAL-BAND",
          };
          await withServer(app, async (port) => {
            const res = await fetch(`http://127.0.0.1:${port}/v1/patients/50001/demographics`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(demographicsBody),
            });
            expect(res.status).toBe(200);
            const text = await res.text();
            expect(text).not.toMatch(/555/);
            const parsed = SafeWritePlanSchema.parse(JSON.parse(text));
            expect(parsed.committed).toBe(true);
            expect(parsed.workflow).toBe("patient.demographics.update");
          });

          const profileAfterWrite = await readPatientProfileFromDbf(sandbox.dataRoot, "50001");
          expect(profileAfterWrite.kind).toBe("ok");
          if (profileAfterWrite.kind === "ok") {
            expect(profileAfterWrite.profile.chartNumber).toBe("SCH-REAL-BAND");
          }
          expect(await readPatientHomePhone(sandbox.dataDir, "50001")).toBe(homePhoneBefore);

          await restoreLatestLegacyBackup(sandbox);

          const profileAfterRestore = await readPatientProfileFromDbf(sandbox.dataRoot, "50001");
          expect(profileAfterRestore.kind).toBe("ok");
          if (profileAfterRestore.kind === "ok") {
            expect(profileAfterRestore.profile.chartNumber).toBe(profileBefore.profile.chartNumber);
          }
          expect(await readPatientHomePhone(sandbox.dataDir, "50001")).toBe(homePhoneBefore);
        } finally {
          destroyTempSandbox(sandbox);
        }
      },
    );
  });
});
