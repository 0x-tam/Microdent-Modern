import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { PatientProfileResponseSchema } from "@microdent/contracts";
import { importPatients } from "@microdent/sqlite-mirror";
import { createBridgeApp } from "./app.js";
import { parseDataRootFromValue, parseSqlitePathFromValue } from "./config.js";

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

const profilePatientFields = [
  { name: "ID", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "CASENB", type: "C" as const, size: 15 },
  { name: "NAME", type: "C" as const, size: 51 },
  { name: "REV_NAME", type: "C" as const, size: 51 },
  { name: "FIRST_NAME", type: "C" as const, size: 25 },
  { name: "LAST_NAME", type: "C" as const, size: 25 },
  { name: "HOME_PHONE", type: "C" as const, size: 19 },
  { name: "MOBILE", type: "C" as const, size: 19 },
  { name: "ACTIVE", type: "L" as const, size: 1 },
  { name: "DOCTOR_NB", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "ENTRY_DATE", type: "D" as const, size: 8 },
  { name: "LASTVISIT", type: "D" as const, size: 8 },
  { name: "STREET", type: "C" as const, size: 30 },
  { name: "EMAIL", type: "C" as const, size: 50 },
];

const SECRET_STREET = "SYNTHETIC_SQLITE_PROFILE_STREET";
const SECRET_EMAIL = "synthetic.sqlite.profile@invalid.test";
const SECRET_PHONE_FULL = "15554443322";

async function writeProfilePatientFixture(dir: string): Promise<void> {
  const path = join(dir, "PATIENT.DBF");
  const dbf = await DBFFile.create(path, profilePatientFields, {});
  const entry = new Date(Date.UTC(2019, 0, 15));
  const lastV = new Date(Date.UTC(2024, 5, 1));
  await dbf.appendRecords([
    {
      ID: 777,
      CASENB: "PFX-777",
      NAME: "Synthetic Profile Subject",
      REV_NAME: "Subject, Synthetic P.",
      FIRST_NAME: "",
      LAST_NAME: "",
      HOME_PHONE: `(${SECRET_PHONE_FULL.slice(1, 4)}) ${SECRET_PHONE_FULL.slice(4, 7)}-${SECRET_PHONE_FULL.slice(7)}`,
      MOBILE: "",
      ACTIVE: true,
      DOCTOR_NB: 12,
      ENTRY_DATE: entry,
      LASTVISIT: lastV,
      STREET: SECRET_STREET,
      EMAIL: SECRET_EMAIL,
    },
  ]);
}

describe("GET /v1/patients/:patientId/profile (SQLITE_PATH)", () => {
  it("reads profile from mirror with same DTO shape as DBF", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-profile-"));
    const sqlitePath = join(dir, "mirror.sqlite");
    try {
      await writeProfilePatientFixture(dir);
      const imported = await importPatients({ dataRoot: dir, sqlitePath });
      expect(imported.status).toBe("success");

      const dataRoot = parseDataRootFromValue(dir);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: {
          listen: { host: "127.0.0.1", port: 0 },
          dataRoot,
          sqlitePath: parseSqlitePathFromValue(sqlitePath),
        },
      });

      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/777/profile`);
        expect(res.status).toBe(200);
        const json: unknown = await res.json();
        const parsed = PatientProfileResponseSchema.parse(json);
        expect(parsed).toEqual({
          patientId: "777",
          chartNumber: "PFX-777",
          displayName: "Synthetic Profile Subject",
          reverseName: "Subject, Synthetic P.",
          phoneMask: "…3322",
          active: true,
          doctorId: "12",
          entryDate: "2019-01-15",
          lastVisit: "2024-06-01",
        });

        const raw = JSON.stringify(json);
        expect(raw).not.toContain(SECRET_STREET);
        expect(raw).not.toContain(SECRET_EMAIL);
        expect(raw).not.toContain(SECRET_PHONE_FULL);
        expect(raw).not.toContain("search_blob");
        expect(raw).not.toContain("reverse_name");
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns 404 when patient is not in mirror", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-profile-miss-"));
    const sqlitePath = join(dir, "mirror.sqlite");
    try {
      await writeProfilePatientFixture(dir);
      await importPatients({ dataRoot: dir, sqlitePath });

      const dataRoot = parseDataRootFromValue(dir);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: {
          listen: { host: "127.0.0.1", port: 0 },
          dataRoot,
          sqlitePath: parseSqlitePathFromValue(sqlitePath),
        },
      });

      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/999999/profile`);
        expect(res.status).toBe(404);
        const body = (await res.json()) as { error?: { code?: string } };
        expect(body.error?.code).toBe("PATIENT_NOT_FOUND");
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to DBF when SQLITE_PATH file is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-profile-fallback-"));
    const missingSqlite = join(dir, "missing.sqlite");
    try {
      await writeProfilePatientFixture(dir);

      const dataRoot = parseDataRootFromValue(dir);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: {
          listen: { host: "127.0.0.1", port: 0 },
          dataRoot,
          sqlitePath: parseSqlitePathFromValue(missingSqlite),
        },
      });

      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/777/profile`);
        expect(res.status).toBe(200);
        const parsed = PatientProfileResponseSchema.parse(await res.json());
        expect(parsed.patientId).toBe("777");
        expect(parsed.phoneMask).toBe("…3322");
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses DBF only when sqlitePath is not configured", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-profile-dbf-only-"));
    try {
      await writeProfilePatientFixture(dir);
      const dataRoot = parseDataRootFromValue(dir);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });

      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/777/profile`);
        expect(res.status).toBe(200);
        expect(PatientProfileResponseSchema.parse(await res.json()).patientId).toBe("777");
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
