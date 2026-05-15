import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { PatientTreatmentsResponseSchema } from "@microdent/contracts";
import { createBridgeApp } from "./app.js";
import type { BridgeConfig } from "./config.js";
import { parseDataRootFromValue } from "./config.js";
import { PATIENT_TREATMENTS_MAX } from "./dbf/patient-treatments.js";

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

const opertblFields = [
  { name: "ID", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "OPNUM", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "TOOTHNB", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "PROCEDURE", type: "C" as const, size: 50 },
  { name: "DATE", type: "D" as const, size: 8 },
  { name: "STATUS", type: "N" as const, size: 1, decimalPlaces: 0 },
  { name: "PROCNB", type: "C" as const, size: 12 },
  { name: "DOCT", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "DESC", type: "C" as const, size: 30 },
  { name: "FEE", type: "N" as const, size: 13, decimalPlaces: 4 },
];

const procchrtFields = [
  { name: "PROCNB", type: "C" as const, size: 6 },
  { name: "PROCEDURE", type: "C" as const, size: 50 },
  { name: "CHART", type: "L" as const, size: 1 },
];

const doctorFields = [
  { name: "DOCTOR_NB", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "NAME", type: "C" as const, size: 30 },
  { name: "SCHEDULE", type: "N" as const, size: 1, decimalPlaces: 0 },
];

const SECRET_DESC = "SYNTHETIC_TREATMENT_DESC_TOKEN";
const SECRET_PROCEDURE = "SYNTHETIC_PATIENT_SPECIFIC_PROCEDURE_TEXT";
const SECRET_FEE = 12345.67;

async function writeTreatmentsFixture(dir: string, extraOperRows: Record<string, unknown>[] = []): Promise<void> {
  const operPath = join(dir, "OPERTBL.DBF");
  const oper = await DBFFile.create(operPath, opertblFields, {});
  await oper.appendRecords([
    {
      ID: 501,
      OPNUM: 100,
      TOOTHNB: 14,
      PROCEDURE: SECRET_PROCEDURE,
      DATE: new Date(Date.UTC(2024, 5, 1)),
      STATUS: 2,
      PROCNB: "SYN01",
      DOCT: 3,
      DESC: SECRET_DESC,
      FEE: SECRET_FEE,
    },
    {
      ID: 501,
      OPNUM: 99,
      TOOTHNB: 0,
      PROCEDURE: "",
      DATE: new Date(Date.UTC(2023, 0, 15)),
      STATUS: 1,
      PROCNB: "SYN01",
      DOCT: 3,
      DESC: "",
      FEE: 0,
    },
    {
      ID: 502,
      OPNUM: 50,
      TOOTHNB: 3,
      PROCEDURE: "Other patient line",
      DATE: new Date(Date.UTC(2024, 0, 1)),
      STATUS: 0,
      PROCNB: "OTHER",
      DOCT: 0,
      DESC: "",
      FEE: 0,
    },
    ...extraOperRows,
  ]);

  const procPath = join(dir, "PROCCHRT.DBF");
  const proc = await DBFFile.create(procPath, procchrtFields, {});
  await proc.appendRecords([
    { PROCNB: "SYN01", PROCEDURE: "Synthetic dictionary label", CHART: true },
  ]);

  const docPath = join(dir, "DOCTORS.DBF");
  const doc = await DBFFile.create(docPath, doctorFields, {});
  await doc.appendRecords([{ DOCTOR_NB: 3, NAME: "Synthetic Provider Three", SCHEDULE: 1 }]);
}

describe("GET /v1/patients/:patientId/treatments", () => {
  it("returns safe treatment fields with reference labels and no blocked columns", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-treatments-"));
    try {
      await writeTreatmentsFixture(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/501/treatments`);
        expect(res.status).toBe(200);
        const json: unknown = await res.json();
        const parsed = PatientTreatmentsResponseSchema.safeParse(json);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;

        expect(parsed.data.patientId).toBe("501");
        expect(parsed.data.truncated).toBe(false);
        expect(parsed.data.treatments).toHaveLength(2);

        const latest = parsed.data.treatments[0];
        expect(latest?.treatmentId).toBe("100");
        expect(latest?.date).toBe("2024-06-01");
        expect(latest?.tooth).toBe(14);
        expect(latest?.procedureCode).toBe("SYN01");
        expect(latest?.procedureLabel).toBe("Synthetic dictionary label");
        expect(latest?.doctorId).toBe("3");
        expect(latest?.doctorLabel).toBe("Synthetic Provider Three");
        expect(latest?.status).toBe(2);
        expect(latest?.hasDescription).toBe(true);

        const older = parsed.data.treatments[1];
        expect(older?.treatmentId).toBe("99");
        expect(older?.hasDescription).toBe(false);

        const raw = JSON.stringify(json);
        expect(raw).not.toContain(SECRET_DESC);
        expect(raw).not.toContain(SECRET_PROCEDURE);
        expect(raw).not.toContain(String(SECRET_FEE));
        expect(raw).not.toContain("FEE");
        expect(raw).not.toContain("DESCRIPT");
        expect(raw).not.toContain("DESC");
        expect(raw).not.toContain("PROCEDURE");
        expect(Object.keys(latest ?? {}).sort()).toEqual([
          "date",
          "doctorId",
          "doctorLabel",
          "hasDescription",
          "patientId",
          "procedureCode",
          "procedureLabel",
          "status",
          "tooth",
          "treatmentId",
        ]);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns empty treatments when no OPERTBL rows match", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-treatments-miss-"));
    try {
      await writeTreatmentsFixture(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/999999/treatments`);
        expect(res.status).toBe(200);
        const json: unknown = await res.json();
        const parsed = PatientTreatmentsResponseSchema.safeParse(json);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.treatments).toHaveLength(0);
        expect(parsed.data.truncated).toBe(false);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it(`caps treatments at PATIENT_TREATMENTS_MAX (${PATIENT_TREATMENTS_MAX})`, async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-treatments-cap-"));
    try {
      const extra = Array.from({ length: PATIENT_TREATMENTS_MAX + 5 }, (_, i) => ({
        ID: 888,
        OPNUM: 10_000 + i,
        TOOTHNB: 0,
        PROCEDURE: "",
        DATE: new Date(Date.UTC(2020, 0, 1)),
        STATUS: 0,
        PROCNB: "",
        DOCT: 0,
        DESC: "",
        FEE: 0,
      }));
      await writeTreatmentsFixture(tmp, extra);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/888/treatments`);
        expect(res.status).toBe(200);
        const json: unknown = await res.json();
        const parsed = PatientTreatmentsResponseSchema.safeParse(json);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.treatments.length).toBe(PATIENT_TREATMENTS_MAX);
        expect(parsed.data.truncated).toBe(true);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns 400 for invalid patientId", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-treatments-bad-"));
    try {
      await writeTreatmentsFixture(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const a = await fetch(`http://127.0.0.1:${port}/v1/patients/0/treatments`);
        expect(a.status).toBe(400);
        const b = await fetch(`http://127.0.0.1:${port}/v1/patients/abc/treatments`);
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
      const res = await fetch(`http://127.0.0.1:${port}/v1/patients/1/treatments`);
      expect(res.status).toBe(503);
    });
  });

  it("returns 404 when OPERTBL.DBF is absent", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-treatments-empty-"));
    try {
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/1/treatments`);
        expect(res.status).toBe(404);
        const body = (await res.json()) as { error?: { code?: string } };
        expect(body.error?.code).toBe("OPERTBL_DBF_NOT_FOUND");
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
