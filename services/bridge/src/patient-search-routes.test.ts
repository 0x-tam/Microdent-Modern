import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { PatientSearchResponseSchema } from "@microdent/contracts";
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

async function writeSyntheticPatientDbf(dir: string): Promise<void> {
  const path = join(dir, "PATIENT.DBF");
  const dbf = await DBFFile.create(path, patientFields, {});
  await dbf.appendRecords([
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

describe("GET /v1/patients/search", () => {
  it("returns synthetic matches with masked phone and caps at 20 rows", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-patient-search-"));
    try {
      const path = join(tmp, "PATIENT.DBF");
      const dbf = await DBFFile.create(path, patientFields, {});
      await dbf.appendRecords([
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
      const batch: Record<string, string | number>[] = [];
      for (let i = 0; i < 25; i += 1) {
        batch.push({
          ID: 1000 + i,
          CASENB: `B-${i}`,
          NAME: `BatchDup Patient ${i}`,
          REV_NAME: "",
          FIRST_NAME: "",
          LAST_NAME: "",
          HOME_PHONE: "",
          MOBILE: "",
        });
      }
      await dbf.appendRecords(batch);

      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/search?q=${encodeURIComponent("Synthetic")}`);
        expect(res.status).toBe(200);
        const json: unknown = await res.json();
        const parsed = PatientSearchResponseSchema.safeParse(json);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.results.length).toBe(2);

        const alpha = parsed.data.results.find((r) => r.patientId === "901");
        expect(alpha?.displayName).toBe("Synthetic Alpha");
        expect(alpha?.chartNumber).toBe("SYN-001");
        expect(alpha?.phoneMask).toBe("…2003");

        const beta = parsed.data.results.find((r) => r.patientId === "902");
        expect(beta?.displayName).toBe("Synthetic BetaRow");
        expect(beta?.phoneMask).toBe("…6543");

        const cap = await fetch(`http://127.0.0.1:${port}/v1/patients/search?q=${encodeURIComponent("BatchDup")}`);
        expect(cap.status).toBe(200);
        const capJson: unknown = await cap.json();
        const capParsed = PatientSearchResponseSchema.safeParse(capJson);
        expect(capParsed.success).toBe(true);
        if (!capParsed.success) return;
        expect(capParsed.data.results).toHaveLength(20);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns 400 when q is too short or missing", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-patient-search-"));
    try {
      await writeSyntheticPatientDbf(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const a = await fetch(`http://127.0.0.1:${port}/v1/patients/search?q=x`);
        expect(a.status).toBe(400);
        const b = await fetch(`http://127.0.0.1:${port}/v1/patients/search`);
        expect(b.status).toBe(400);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns 404 when PATIENT.DBF is absent", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-patient-search-empty-"));
    try {
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/search?q=ab`);
        expect(res.status).toBe(404);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("PATIENT_DBF_NOT_FOUND");
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
      const res = await fetch(`http://127.0.0.1:${port}/v1/patients/search?q=ab`);
      expect(res.status).toBe(503);
    });
  });
});
