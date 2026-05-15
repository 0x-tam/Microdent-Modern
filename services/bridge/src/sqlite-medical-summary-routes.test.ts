import { createServer } from "node:http";
import { mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { PatientMedicalSummaryResponseSchema } from "@microdent/contracts";
import { importMedicalSummary } from "@microdent/sqlite-mirror";
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

function bridgeConfig(dataRootPath: string, sqlitePath?: string) {
  const dataRoot = parseDataRootFromValue(dataRootPath);
  if (!dataRoot.configured) throw new Error("data root");
  return {
    listen: { host: "127.0.0.1" as const, port: 0 },
    dataRoot,
    sqlitePath:
      sqlitePath === undefined
        ? { configured: false as const }
        : parseSqlitePathFromValue(sqlitePath),
  };
}

const medicalFields = [
  { name: "HOSPITAL", type: "L" as const, size: 1 },
  { name: "PHYSICIAN", type: "L" as const, size: 1 },
  { name: "MEDICINE", type: "L" as const, size: 1 },
  { name: "PATIENT_ID", type: "N" as const, size: 6, decimalPlaces: 0 },
  { name: "DATE", type: "D" as const, size: 8 },
  { name: "LAST_DENTA", type: "D" as const, size: 8 },
  { name: "PROBLEM", type: "C" as const, size: 40 },
  { name: "ILL", type: "L" as const, size: 1 },
  { name: "REACTION", type: "L" as const, size: 1 },
  { name: "BLEEDING", type: "L" as const, size: 1 },
  { name: "ALLERGIC", type: "L" as const, size: 1 },
  { name: "ALLERGY_TO", type: "C" as const, size: 15 },
  { name: "HEART_TRBL", type: "L" as const, size: 1 },
  { name: "CONG_HEART", type: "L" as const, size: 1 },
  { name: "HEART_MRM", type: "L" as const, size: 1 },
  { name: "HIGH_PRESS", type: "L" as const, size: 1 },
  { name: "LOW_PRESS", type: "L" as const, size: 1 },
  { name: "ANEMIA", type: "L" as const, size: 1 },
  { name: "RH_FEVER", type: "L" as const, size: 1 },
  { name: "JAUNDICE", type: "L" as const, size: 1 },
  { name: "ASTHMA", type: "L" as const, size: 1 },
  { name: "COUGH", type: "L" as const, size: 1 },
  { name: "KIDNEYS", type: "L" as const, size: 1 },
  { name: "MED1", type: "L" as const, size: 1 },
  { name: "DIABETS", type: "L" as const, size: 1 },
  { name: "TUBERCUL", type: "L" as const, size: 1 },
  { name: "HEPATISIS", type: "L" as const, size: 1 },
  { name: "ARTHRITIS", type: "L" as const, size: 1 },
  { name: "STROKE", type: "L" as const, size: 1 },
  { name: "EPILEPSEY", type: "L" as const, size: 1 },
  { name: "PSYCHIATRI", type: "L" as const, size: 1 },
  { name: "SINUS_TRBL", type: "L" as const, size: 1 },
  { name: "PREGNANT", type: "L" as const, size: 1 },
  { name: "ULCERS", type: "L" as const, size: 1 },
  { name: "AIDS", type: "L" as const, size: 1 },
  { name: "MED2", type: "L" as const, size: 1 },
];

const SECRET_PROBLEM = "SYNTHETIC_SQLITE_MEDICAL_PROBLEM_TOKEN";
const SECRET_ALLERGY = "SYNTHETIC_SQLITE_ALLERGY_TEXT_TOKEN";

function blankLogicalRow(patientId: number, overrides: Record<string, unknown>): Record<string, unknown> {
  const base: Record<string, unknown> = {
    HOSPITAL: false,
    PHYSICIAN: false,
    MEDICINE: false,
    PATIENT_ID: patientId,
    DATE: new Date(Date.UTC(2023, 2, 10)),
    LAST_DENTA: new Date(Date.UTC(2022, 11, 1)),
    PROBLEM: "",
    ILL: false,
    REACTION: false,
    BLEEDING: false,
    ALLERGIC: false,
    ALLERGY_TO: "",
    HEART_TRBL: false,
    CONG_HEART: false,
    HEART_MRM: false,
    HIGH_PRESS: false,
    LOW_PRESS: false,
    ANEMIA: false,
    RH_FEVER: false,
    JAUNDICE: false,
    ASTHMA: false,
    COUGH: false,
    KIDNEYS: false,
    MED1: false,
    DIABETS: false,
    TUBERCUL: false,
    HEPATISIS: false,
    ARTHRITIS: false,
    STROKE: false,
    EPILEPSEY: false,
    PSYCHIATRI: false,
    SINUS_TRBL: false,
    PREGNANT: false,
    ULCERS: false,
    AIDS: false,
    MED2: false,
  };
  return { ...base, ...overrides };
}

async function writeSyntheticMedicalFixture(dir: string): Promise<void> {
  const path = join(dir, "MEDICAL.DBF");
  const dbf = await DBFFile.create(path, medicalFields, {});
  await dbf.appendRecords([
    blankLogicalRow(777, {
      DIABETS: true,
      ALLERGIC: true,
      PROBLEM: SECRET_PROBLEM,
      ALLERGY_TO: SECRET_ALLERGY,
    }),
    blankLogicalRow(778, {
      DATE: new Date(Date.UTC(2024, 0, 1)),
      DIABETS: false,
    }),
    blankLogicalRow(777, {
      DATE: new Date(Date.UTC(2021, 0, 1)),
      DIABETS: false,
      ALLERGIC: false,
    }),
  ]);
}

describe("GET /v1/patients/:patientId/medical-summary (SQLite)", () => {
  it("reads from mirror after migrations and synthetic import", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-medical-"));
    const sqlitePath = join(dir, "mirror.sqlite");
    try {
      await writeSyntheticMedicalFixture(dir);
      const imported = await importMedicalSummary({ dataRoot: dir, sqlitePath });
      expect(imported.status).toBe("success");

      const app = createBridgeApp("v-test", { bridgeConfig: bridgeConfig(dir, sqlitePath) });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/777/medical-summary`);
        expect(res.status).toBe(200);
        const json: unknown = await res.json();
        const parsed = PatientMedicalSummaryResponseSchema.safeParse(json);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.patientId).toBe("777");
        expect(parsed.data.hasMedicalRecord).toBe(true);
        expect(parsed.data.hasSensitiveMedicalDetails).toBe(true);
        expect(parsed.data.lastUpdated).toBe("2023-03-10");
        expect(parsed.data.lastDentalVisit).toBe("2022-12-01");
        expect(parsed.data.conditions?.diabetes).toBe(true);
        expect(parsed.data.conditions?.allergic).toBe(true);
        expect(parsed.data.flaggedConditionCount).toBe(2);

        const raw = JSON.stringify(json);
        expect(raw).not.toContain(SECRET_PROBLEM);
        expect(raw).not.toContain(SECRET_ALLERGY);
        expect(raw).not.toContain("PROBLEM");
        expect(raw).not.toContain("ALLERGY_TO");
        expect(raw).not.toContain("NOTES");
        expect(raw).not.toContain("conditions_json");
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns hasMedicalRecord false when patient is absent from mirror", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-medical-miss-"));
    const sqlitePath = join(dir, "mirror.sqlite");
    try {
      await writeSyntheticMedicalFixture(dir);
      const imported = await importMedicalSummary({ dataRoot: dir, sqlitePath });
      expect(imported.status).toBe("success");

      const app = createBridgeApp("v-test", { bridgeConfig: bridgeConfig(dir, sqlitePath) });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/999999/medical-summary`);
        expect(res.status).toBe(200);
        const parsed = PatientMedicalSummaryResponseSchema.parse(await res.json());
        expect(parsed.hasMedicalRecord).toBe(false);
        expect(parsed.conditions).toBeNull();
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("serves from mirror when MEDICAL.DBF is removed after import", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-medical-nodbf-"));
    const sqlitePath = join(dir, "mirror.sqlite");
    const medicalPath = join(dir, "MEDICAL.DBF");
    try {
      await writeSyntheticMedicalFixture(dir);
      const imported = await importMedicalSummary({ dataRoot: dir, sqlitePath });
      expect(imported.status).toBe("success");
      unlinkSync(medicalPath);

      const app = createBridgeApp("v-test", { bridgeConfig: bridgeConfig(dir, sqlitePath) });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/777/medical-summary`);
        expect(res.status).toBe(200);
        const parsed = PatientMedicalSummaryResponseSchema.parse(await res.json());
        expect(parsed.hasMedicalRecord).toBe(true);
        expect(parsed.conditions?.diabetes).toBe(true);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to DBF when SQLITE_PATH file is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-medical-fallback-"));
    const missingSqlite = join(dir, "missing.sqlite");
    try {
      await writeSyntheticMedicalFixture(dir);
      const app = createBridgeApp("v-test", {
        bridgeConfig: bridgeConfig(dir, missingSqlite),
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/777/medical-summary`);
        expect(res.status).toBe(200);
        const parsed = PatientMedicalSummaryResponseSchema.parse(await res.json());
        expect(parsed.hasMedicalRecord).toBe(true);
        expect(parsed.conditions?.diabetes).toBe(true);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses DBF only when sqlitePath is not configured", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bridge-sqlite-medical-dbfonly-"));
    try {
      await writeSyntheticMedicalFixture(dir);
      const app = createBridgeApp("v-test", { bridgeConfig: bridgeConfig(dir) });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/777/medical-summary`);
        expect(res.status).toBe(200);
        expect(PatientMedicalSummaryResponseSchema.parse(await res.json()).hasMedicalRecord).toBe(true);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
