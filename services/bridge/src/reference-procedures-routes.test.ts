import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { ReferenceProceduresResponseSchema } from "@microdent/contracts";
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

const procchrtFields = [
  { name: "PROCNB", type: "C" as const, size: 6 },
  { name: "PROCEDURE", type: "C" as const, size: 50 },
  { name: "CHART", type: "L" as const, size: 1 },
  { name: "QTYPRIC", type: "L" as const, size: 1 },
  { name: "PRICE1", type: "N" as const, size: 13, decimalPlaces: 4 },
  { name: "PRICE2", type: "N" as const, size: 13, decimalPlaces: 4 },
  { name: "PER_PROF", type: "N" as const, size: 5, decimalPlaces: 2 },
  { name: "CLASS", type: "C" as const, size: 50 },
  { name: "GROUP", type: "C" as const, size: 20 },
  { name: "CATAGORY", type: "C" as const, size: 3 },
  { name: "CLASS_ID", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "TRANS_CODE", type: "N" as const, size: 3, decimalPlaces: 0 },
];

async function writeProcchrtFixture(dir: string): Promise<void> {
  const path = join(dir, "PROCCHRT.DBF");
  const dbf = await DBFFile.create(path, procchrtFields, {});
  await dbf.appendRecords([
    {
      PROCNB: "SYN01",
      PROCEDURE: "Synthetic exam label A",
      CHART: true,
      QTYPRIC: false,
      PRICE1: 999.99,
      PRICE2: 888.88,
      PER_PROF: 12.5,
      CLASS: "Synthetic preventive",
      GROUP: "SYN_GROUP_A",
      CATAGORY: "PRE",
      CLASS_ID: 101,
      TRANS_CODE: 7,
    },
    {
      PROCNB: "SYN02",
      PROCEDURE: "",
      CHART: false,
      QTYPRIC: true,
      PRICE1: 1234.56,
      PRICE2: 0,
      PER_PROF: 0,
      CLASS: "",
      GROUP: "SYN_GROUP_B",
      CATAGORY: "",
      CLASS_ID: 0,
      TRANS_CODE: 0,
    },
  ]);
}

function appWithDataRoot(dataRootPath: string | undefined): ReturnType<typeof createBridgeApp> {
  const dataRoot =
    dataRootPath === undefined ? ({ configured: false } as const) : parseDataRootFromValue(dataRootPath);
  const bridgeConfig: BridgeConfig = {
    listen: { host: "127.0.0.1", port: 0 },
    dataRoot,
  };
  return createBridgeApp("v-test", { bridgeConfig });
}

describe("GET /v1/reference/procedures", () => {
  it("returns safe code and label; omits price/fee fields", async () => {
    const dir = mkdtempSync(join(tmpdir(), "md-ref-proc-"));
    try {
      await writeProcchrtFixture(dir);
      const app = appWithDataRoot(dir);
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/reference/procedures`);
        expect(res.status).toBe(200);
        const json = await res.json();
        const parsed = ReferenceProceduresResponseSchema.parse(json);
        expect(parsed.procedures).toHaveLength(2);

        const a = parsed.procedures.find((p) => p.procedureCode === "SYN01");
        expect(a).toMatchObject({
          procedureCode: "SYN01",
          displayName: "Synthetic exam label A",
          category: "Synthetic preventive",
          categoryCode: "PRE",
          classId: 101,
          chartRelevant: true,
        });

        const b = parsed.procedures.find((p) => p.procedureCode === "SYN02");
        expect(b).toMatchObject({
          procedureCode: "SYN02",
          displayName: null,
          category: null,
          categoryCode: null,
          classId: null,
          chartRelevant: false,
        });

        const raw = JSON.stringify(json);
        expect(raw).not.toMatch(/PRICE/i);
        expect(raw).not.toMatch(/PER_PROF/i);
        expect(raw).not.toMatch(/QTYPRIC/i);
        expect(raw).not.toMatch(/TRANS_CODE/i);
        expect(raw).not.toMatch(/999\.99/);
        expect(raw).not.toMatch(/SYN_GROUP/);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("503 when DATA_ROOT unset", async () => {
    const app = appWithDataRoot(undefined);
    await withServer(app, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/v1/reference/procedures`);
      expect(res.status).toBe(503);
      const body = (await res.json()) as { error?: { code?: string } };
      expect(body.error?.code).toBe("DATA_ROOT_NOT_CONFIGURED");
    });
  });

  it("404 when PROCCHRT.DBF missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "md-ref-proc-miss-"));
    try {
      const app = appWithDataRoot(dir);
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/reference/procedures`);
        expect(res.status).toBe(404);
        const body = (await res.json()) as { error?: { code?: string } };
        expect(body.error?.code).toBe("PROCCHRT_DBF_NOT_FOUND");
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
