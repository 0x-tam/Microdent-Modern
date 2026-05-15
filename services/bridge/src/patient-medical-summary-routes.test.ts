import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { PatientMedicalSummaryResponseSchema } from "@microdent/contracts";
import { createBridgeApp } from "./app.js";
import type { BridgeConfig } from "./config.js";
import { parseDataRootFromValue } from "./config.js";

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

const SECRET_PROBLEM = "SYNTHETIC_MEDICAL_PROBLEM_TOKEN";
const SECRET_ALLERGY = "SYNTHETIC_ALLERGY_TEXT_TOKEN";

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

async function writeMedicalFixture(dir: string): Promise<void> {
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

describe("GET /v1/patients/:patientId/medical-summary", () => {
  it("returns boolean flags and dates without blocked free text", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-medical-summary-"));
    try {
      await writeMedicalFixture(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
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
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns hasMedicalRecord false when no row matches", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-medical-summary-miss-"));
    try {
      await writeMedicalFixture(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/999999/medical-summary`);
        expect(res.status).toBe(200);
        const json: unknown = await res.json();
        const parsed = PatientMedicalSummaryResponseSchema.safeParse(json);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.hasMedicalRecord).toBe(false);
        expect(parsed.data.conditions).toBeNull();
        expect(parsed.data.flaggedConditionCount).toBe(0);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns 400 for invalid patientId", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-medical-summary-bad-"));
    try {
      await writeMedicalFixture(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const a = await fetch(`http://127.0.0.1:${port}/v1/patients/0/medical-summary`);
        expect(a.status).toBe(400);
        const b = await fetch(`http://127.0.0.1:${port}/v1/patients/abc/medical-summary`);
        expect(b.status).toBe(400);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns 503 when DATA_ROOT is not configured", async () => {
    const cfg: BridgeConfig = {
      listen: { host: "127.0.0.1", port: 0 },
      dataRoot: { configured: false },
    };
    const app = createBridgeApp("v-test", { bridgeConfig: cfg });
    await withServer(app, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/v1/patients/1/medical-summary`);
      expect(res.status).toBe(503);
    });
  });

  it("returns 404 when MEDICAL.DBF is absent", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-medical-summary-empty-"));
    try {
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/1/medical-summary`);
        expect(res.status).toBe(404);
        const body = (await res.json()) as { error?: { code?: string } };
        expect(body.error?.code).toBe("MEDICAL_DBF_NOT_FOUND");
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
