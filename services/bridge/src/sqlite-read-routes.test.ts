import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import {
  PatientSearchResponseSchema,
  ReferenceDoctorsResponseSchema,
  ReferenceProceduresResponseSchema,
} from "@microdent/contracts";
import { importDoctors, importPatients, importProcedures } from "@microdent/sqlite-mirror";
import { createBridgeApp } from "./app.js";
import type { BridgeConfig } from "./config.js";
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

function bridgeConfig(dataRootPath: string, sqlitePath?: string): BridgeConfig {
  const dataRoot = parseDataRootFromValue(dataRootPath);
  if (!dataRoot.configured) throw new Error("data root");
  return {
    listen: { host: "127.0.0.1", port: 0 },
    dataRoot,
    sqlitePath:
      sqlitePath === undefined
        ? { configured: false }
        : parseSqlitePathFromValue(sqlitePath),
  };
}

const doctorFields = [
  { name: "DOCTOR_NB", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "NAME", type: "C" as const, size: 30 },
  { name: "SCHEDULE", type: "N" as const, size: 1, decimalPlaces: 0 },
  { name: "PHONE", type: "C" as const, size: 19 },
];

const procchrtFields = [
  { name: "PROCNB", type: "C" as const, size: 6 },
  { name: "PROCEDURE", type: "C" as const, size: 50 },
  { name: "CHART", type: "L" as const, size: 1 },
  { name: "CLASS", type: "C" as const, size: 50 },
  { name: "CATAGORY", type: "C" as const, size: 3 },
  { name: "CLASS_ID", type: "N" as const, size: 10, decimalPlaces: 0 },
];

const patientFields = [
  { name: "ID", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "CASENB", type: "C" as const, size: 15 },
  { name: "NAME", type: "C" as const, size: 51 },
  { name: "REV_NAME", type: "C" as const, size: 51 },
  { name: "FIRST_NAME", type: "C" as const, size: 25 },
  { name: "LAST_NAME", type: "C" as const, size: 25 },
  { name: "HOME_PHONE", type: "C" as const, size: 19 },
  { name: "MOBILE", type: "C" as const, size: 19 },
];

function markDbfRecordDeleted(dbfPath: string, recordIndex: number): void {
  const buf = readFileSync(dbfPath);
  const hlen = buf.readUInt16LE(8);
  const rlen = buf.readUInt16LE(10);
  buf[hlen + recordIndex * rlen] = 0x2a;
  writeFileSync(dbfPath, buf);
}

async function writeFixtureDbfs(dir: string): Promise<void> {
  const doctorsPath = join(dir, "DOCTORS.DBF");
  const doctors = await DBFFile.create(doctorsPath, doctorFields, {});
  await doctors.appendRecords([
    { DOCTOR_NB: 101, NAME: "Synthetic Provider Alpha", SCHEDULE: 1, PHONE: "555-000-1001" },
    { DOCTOR_NB: 102, NAME: "", SCHEDULE: 0, PHONE: "555-000-1002" },
    { DOCTOR_NB: 103, NAME: "Synthetic Provider Deleted", SCHEDULE: 1, PHONE: "555-000-1003" },
  ]);
  markDbfRecordDeleted(doctorsPath, 2);

  const procPath = join(dir, "PROCCHRT.DBF");
  const proc = await DBFFile.create(procPath, procchrtFields, {});
  await proc.appendRecords([
    {
      PROCNB: "SYN01",
      PROCEDURE: "Synthetic exam label A",
      CHART: true,
      CLASS: "Synthetic preventive",
      CATAGORY: "PRE",
      CLASS_ID: 101,
    },
    {
      PROCNB: "SYN02",
      PROCEDURE: "",
      CHART: false,
      CLASS: "",
      CATAGORY: "",
      CLASS_ID: 0,
    },
  ]);

  const patientPath = join(dir, "PATIENT.DBF");
  const patients = await DBFFile.create(patientPath, patientFields, {});
  await patients.appendRecords([
    {
      ID: 901,
      CASENB: "SYN-001",
      NAME: "Synthetic Alpha",
      REV_NAME: "",
      FIRST_NAME: "",
      LAST_NAME: "",
      HOME_PHONE: "(555) 100-2003",
      MOBILE: "",
    },
    {
      ID: 902,
      CASENB: "SYN-002",
      NAME: "",
      REV_NAME: "",
      FIRST_NAME: "Synthetic",
      LAST_NAME: "BetaRow",
      HOME_PHONE: "",
      MOBILE: "5559876543",
    },
  ]);
}

async function importMirror(dataRoot: string, sqlitePath: string): Promise<void> {
  const doctors = await importDoctors({ dataRoot, sqlitePath });
  expect(doctors.status).toBe("success");
  const procedures = await importProcedures({ dataRoot, sqlitePath });
  expect(procedures.status).toBe("success");
  const patients = await importPatients({ dataRoot, sqlitePath });
  expect(patients.status).toBe("success");
}

describe("SQLite read routes (SQLITE_PATH configured)", () => {
  it("GET /v1/reference/doctors reads from mirror with same DTO shape as DBF", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-doctors-"));
    const sqlitePath = join(dir, "mirror.sqlite");
    try {
      await writeFixtureDbfs(dir);
      await importMirror(dir, sqlitePath);
      const app = createBridgeApp("v-test", { bridgeConfig: bridgeConfig(dir, sqlitePath) });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/reference/doctors`);
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).not.toContain("555-000-1001");
        const parsed = ReferenceDoctorsResponseSchema.parse(JSON.parse(text));
        expect(parsed.doctors).toHaveLength(2);
        expect(parsed.doctors[0]).toEqual({
          doctorId: "101",
          displayName: "Synthetic Provider Alpha",
          active: true,
        });
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("GET /v1/reference/procedures reads from mirror without price fields", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-proc-"));
    const sqlitePath = join(dir, "mirror.sqlite");
    try {
      await writeFixtureDbfs(dir);
      await importMirror(dir, sqlitePath);
      const app = createBridgeApp("v-test", { bridgeConfig: bridgeConfig(dir, sqlitePath) });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/reference/procedures`);
        const json = await res.json();
        const parsed = ReferenceProceduresResponseSchema.parse(json);
        const a = parsed.procedures.find((p) => p.procedureCode === "SYN01");
        expect(a).toMatchObject({
          procedureCode: "SYN01",
          displayName: "Synthetic exam label A",
          chartRelevant: true,
        });
        const b = parsed.procedures.find((p) => p.procedureCode === "SYN02");
        expect(b?.displayName).toBeNull();
        expect(JSON.stringify(json)).not.toMatch(/PRICE/i);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("GET /v1/patients/search reads from mirror with token match and cap", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-search-"));
    const sqlitePath = join(dir, "mirror.sqlite");
    try {
      await writeFixtureDbfs(dir);
      await importMirror(dir, sqlitePath);
      const app = createBridgeApp("v-test", { bridgeConfig: bridgeConfig(dir, sqlitePath) });
      await withServer(app, async (port) => {
        const res = await fetch(
          `http://127.0.0.1:${port}/v1/patients/search?q=${encodeURIComponent("Synthetic")}`,
        );
        const parsed = PatientSearchResponseSchema.parse(await res.json());
        expect(parsed.results).toHaveLength(2);
        expect(parsed.results.find((r) => r.patientId === "901")?.phoneMask).toBe("…2003");
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to DBF when SQLITE_PATH file is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-fallback-"));
    const missingSqlite = join(dir, "missing.sqlite");
    try {
      await writeFixtureDbfs(dir);
      const app = createBridgeApp("v-test", {
        bridgeConfig: bridgeConfig(dir, missingSqlite),
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/reference/doctors`);
        const parsed = ReferenceDoctorsResponseSchema.parse(await res.json());
        expect(parsed.doctors).toHaveLength(2);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses DBF only when sqlitePath is not configured", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-dbf-only-"));
    try {
      await writeFixtureDbfs(dir);
      const app = createBridgeApp("v-test", { bridgeConfig: bridgeConfig(dir) });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/reference/doctors`);
        expect(res.status).toBe(200);
        expect(ReferenceDoctorsResponseSchema.parse(await res.json()).doctors).toHaveLength(2);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
