import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { PatientChartResponseSchema } from "@microdent/contracts";
import { createBridgeApp } from "./app.js";
import type { BridgeConfig } from "./config.js";
import { parseDataRootFromValue } from "./config.js";
import { PATIENT_CHART_MAX } from "./dbf/patient-chart.js";

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

/** Synthetic subset — no `NOTE` memo (`dbffile` cannot create memo DBFs). */
const chartdbfFields = [
  { name: "ID", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "TOOTH_NB", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "TYPE", type: "N" as const, size: 1, decimalPlaces: 0 },
  { name: "TREATED", type: "L" as const, size: 1 },
  { name: "F1_S", type: "N" as const, size: 1, decimalPlaces: 0 },
];

const SECRET_LAYER = 9;

async function writeChartFixture(dir: string, extraRows: Record<string, unknown>[] = []): Promise<void> {
  const chartPath = join(dir, "CHARTDBF.DBF");
  const chart = await DBFFile.create(chartPath, chartdbfFields, {});
  await chart.appendRecords([
    {
      ID: 501,
      TOOTH_NB: 14,
      TYPE: 1,
      TREATED: true,
      F1_S: SECRET_LAYER,
    },
    {
      ID: 501,
      TOOTH_NB: 3,
      TYPE: 0,
      TREATED: false,
      F1_S: 0,
    },
    {
      ID: 502,
      TOOTH_NB: 8,
      TYPE: 1,
      TREATED: false,
      F1_S: 1,
    },
    ...extraRows,
  ]);
}

describe("GET /v1/patients/:patientId/chart", () => {
  it("returns safe chart fields and omits blocked columns", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-chart-"));
    try {
      await writeChartFixture(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });

      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/501/chart`);
        expect(res.status).toBe(200);
        const json = await res.json();
        const parsed = PatientChartResponseSchema.safeParse(json);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;

        expect(parsed.data.patientId).toBe("501");
        expect(parsed.data.entries).toHaveLength(2);
        expect(parsed.data.truncated).toBe(false);

        const treated = parsed.data.entries.find((e) => e.treated);
        expect(treated).toBeDefined();
        expect(treated?.toothNumber).toBe(14);
        expect(treated?.chartType).toBe(1);
        expect(treated?.chartEntryId).toBe("14-1-1");
        expect(treated?.hasNote).toBe(false);

        const jsonText = JSON.stringify(json);
        expect(jsonText).not.toContain(String(SECRET_LAYER));
        expect(jsonText).not.toContain("F1_S");
        for (const entry of parsed.data.entries) {
          expect(Object.keys(entry)).not.toContain("F1_S");
        }
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns empty entries when no CHARTDBF rows match", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-chart-miss-"));
    try {
      await writeChartFixture(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });

      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/999999/chart`);
        expect(res.status).toBe(200);
        const parsed = PatientChartResponseSchema.parse(await res.json());
        expect(parsed.entries).toHaveLength(0);
        expect(parsed.truncated).toBe(false);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it(`caps entries at PATIENT_CHART_MAX (${PATIENT_CHART_MAX})`, async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-chart-cap-"));
    try {
      const extra = Array.from({ length: PATIENT_CHART_MAX + 5 }, (_, i) => ({
        ID: 888,
        TOOTH_NB: (i % 32) + 1,
        TYPE: i % 2,
        TREATED: false,
        F1_S: 0,
      }));
      await writeChartFixture(tmp, extra);

      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });

      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/888/chart`);
        expect(res.status).toBe(200);
        const parsed = PatientChartResponseSchema.parse(await res.json());
        expect(parsed.entries.length).toBe(PATIENT_CHART_MAX);
        expect(parsed.truncated).toBe(true);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects invalid patient id", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-chart-bad-"));
    try {
      await writeChartFixture(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });

      await withServer(app, async (port) => {
        const a = await fetch(`http://127.0.0.1:${port}/v1/patients/0/chart`);
        const b = await fetch(`http://127.0.0.1:${port}/v1/patients/abc/chart`);
        expect(a.status).toBe(400);
        expect(b.status).toBe(400);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns 404 when CHARTDBF.DBF is absent", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-chart-empty-"));
    try {
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });

      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/1/chart`);
        expect(res.status).toBe(404);
        const body = (await res.json()) as { error?: { code?: string } };
        expect(body.error?.code).toBe("CHARTDBF_NOT_FOUND");
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
