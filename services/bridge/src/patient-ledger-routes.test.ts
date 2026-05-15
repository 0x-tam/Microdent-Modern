import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { PatientLedgerResponseSchema } from "@microdent/contracts";
import { createBridgeApp } from "./app.js";
import type { BridgeConfig } from "./config.js";
import { parseDataRootFromValue } from "./config.js";
import { PATIENT_LEDGER_MAX } from "./dbf/patient-ledger.js";

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

const transFields = [
  { name: "PATIENT_ID", type: "N" as const, size: 6, decimalPlaces: 0 },
  { name: "TRANS_NB", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "DATE", type: "D" as const, size: 8 },
  { name: "AMOUNT", type: "N" as const, size: 13, decimalPlaces: 4 },
  { name: "SAMOUNT", type: "N" as const, size: 13, decimalPlaces: 4 },
  { name: "CH_TYPE", type: "N" as const, size: 1, decimalPlaces: 0 },
  { name: "ADJ_TYPE", type: "N" as const, size: 1, decimalPlaces: 0 },
  { name: "PAY_TYPE", type: "N" as const, size: 4, decimalPlaces: 0 },
  { name: "CARD", type: "L" as const, size: 1 },
  { name: "DESCR", type: "C" as const, size: 30 },
  { name: "PLANNUM", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "INSPAYNO", type: "N" as const, size: 10, decimalPlaces: 0 },
];

const SECRET_DESCR = "SYNTHETIC_LEDGER_MEMO_TOKEN";
const SECRET_AMOUNT = 9876.54;
const SECRET_SAMOUNT = 111.11;
const SECRET_PLANNUM = 424242;
const SECRET_INSPAYNO = 999888777;

async function writeLedgerFixture(dir: string, extraRows: Record<string, unknown>[] = []): Promise<void> {
  const transPath = join(dir, "TRANS.DBF");
  const trans = await DBFFile.create(transPath, transFields, {});
  await trans.appendRecords([
    {
      PATIENT_ID: 501,
      TRANS_NB: 200,
      DATE: new Date(Date.UTC(2024, 5, 1)),
      AMOUNT: SECRET_AMOUNT,
      SAMOUNT: SECRET_SAMOUNT,
      CH_TYPE: 2,
      ADJ_TYPE: 0,
      PAY_TYPE: 100,
      CARD: true,
      DESCR: SECRET_DESCR,
      PLANNUM: SECRET_PLANNUM,
      INSPAYNO: SECRET_INSPAYNO,
    },
    {
      PATIENT_ID: 501,
      TRANS_NB: 199,
      DATE: new Date(Date.UTC(2023, 0, 15)),
      AMOUNT: 50.25,
      SAMOUNT: 0,
      CH_TYPE: 1,
      ADJ_TYPE: 1,
      PAY_TYPE: 0,
      CARD: false,
      DESCR: "",
      PLANNUM: 0,
      INSPAYNO: 0,
    },
    {
      PATIENT_ID: 502,
      TRANS_NB: 50,
      DATE: new Date(Date.UTC(2024, 0, 1)),
      AMOUNT: 1,
      SAMOUNT: 0,
      CH_TYPE: 0,
      ADJ_TYPE: 0,
      PAY_TYPE: 0,
      CARD: false,
      DESCR: "Other patient memo",
      PLANNUM: 0,
      INSPAYNO: 0,
    },
    ...extraRows,
  ]);
}

describe("GET /v1/patients/:patientId/ledger", () => {
  it("returns safe ledger metadata with no amounts, memos, or insurance fields", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-ledger-"));
    try {
      await writeLedgerFixture(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/501/ledger`);
        expect(res.status).toBe(200);
        const json: unknown = await res.json();
        const parsed = PatientLedgerResponseSchema.safeParse(json);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;

        expect(parsed.data.patientId).toBe("501");
        expect(parsed.data.truncated).toBe(false);
        expect(parsed.data.entries).toHaveLength(2);

        const latest = parsed.data.entries[0];
        expect(latest?.ledgerEntryId).toBe("200");
        expect(latest?.date).toBe("2024-06-01");
        expect(latest?.chargeTypeCode).toBe(2);
        expect(latest?.adjustmentTypeCode).toBe(0);
        expect(latest?.paymentTypeCode).toBe(100);
        expect(latest?.isCardPayment).toBe(true);
        expect(latest?.hasDescription).toBe(true);

        const older = parsed.data.entries[1];
        expect(older?.ledgerEntryId).toBe("199");
        expect(older?.hasDescription).toBe(false);

        const raw = JSON.stringify(json);
        expect(raw).not.toContain(SECRET_DESCR);
        expect(raw).not.toContain(String(SECRET_AMOUNT));
        expect(raw).not.toContain(String(SECRET_SAMOUNT));
        expect(raw).not.toContain(String(SECRET_PLANNUM));
        expect(raw).not.toContain(String(SECRET_INSPAYNO));
        expect(raw).not.toContain('"AMOUNT"');
        expect(raw).not.toContain('"SAMOUNT"');
        expect(raw).not.toContain('"DESCR"');
        expect(raw).not.toContain('"PLANNUM"');
        expect(raw).not.toContain('"INSPAYNO"');
        expect(Object.keys(latest ?? {}).sort()).toEqual([
          "adjustmentTypeCode",
          "chargeTypeCode",
          "date",
          "hasDescription",
          "isCardPayment",
          "ledgerEntryId",
          "patientId",
          "paymentTypeCode",
        ]);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns empty entries when no TRANS rows match", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-ledger-miss-"));
    try {
      await writeLedgerFixture(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/999999/ledger`);
        expect(res.status).toBe(200);
        const json: unknown = await res.json();
        const parsed = PatientLedgerResponseSchema.safeParse(json);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.entries).toHaveLength(0);
        expect(parsed.data.truncated).toBe(false);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it(`caps entries at PATIENT_LEDGER_MAX (${PATIENT_LEDGER_MAX})`, async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-ledger-cap-"));
    try {
      const extra = Array.from({ length: PATIENT_LEDGER_MAX + 5 }, (_, i) => ({
        PATIENT_ID: 888,
        TRANS_NB: 10_000 + i,
        DATE: new Date(Date.UTC(2020, 0, 1)),
        AMOUNT: SECRET_AMOUNT,
        SAMOUNT: 0,
        CH_TYPE: 0,
        ADJ_TYPE: 0,
        PAY_TYPE: 0,
        CARD: false,
        DESCR: "",
        PLANNUM: 0,
        INSPAYNO: 0,
      }));
      await writeLedgerFixture(tmp, extra);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/888/ledger`);
        expect(res.status).toBe(200);
        const json: unknown = await res.json();
        const parsed = PatientLedgerResponseSchema.safeParse(json);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.entries.length).toBe(PATIENT_LEDGER_MAX);
        expect(parsed.data.truncated).toBe(true);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("matches PATIENT_ID using stringified integer comparison", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-ledger-id-"));
    try {
      await writeLedgerFixture(tmp, [
        {
          PATIENT_ID: 12345,
          TRANS_NB: 77,
          DATE: new Date(Date.UTC(2022, 2, 3)),
          AMOUNT: 0,
          SAMOUNT: 0,
          CH_TYPE: 3,
          ADJ_TYPE: 0,
          PAY_TYPE: 0,
          CARD: false,
          DESCR: "",
          PLANNUM: 0,
          INSPAYNO: 0,
        },
      ]);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/12345/ledger`);
        expect(res.status).toBe(200);
        const json: unknown = await res.json();
        const parsed = PatientLedgerResponseSchema.safeParse(json);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.entries).toHaveLength(1);
        expect(parsed.data.entries[0]?.ledgerEntryId).toBe("77");
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns 400 for invalid patientId", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-ledger-bad-"));
    try {
      await writeLedgerFixture(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const a = await fetch(`http://127.0.0.1:${port}/v1/patients/0/ledger`);
        expect(a.status).toBe(400);
        const b = await fetch(`http://127.0.0.1:${port}/v1/patients/abc/ledger`);
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
      const res = await fetch(`http://127.0.0.1:${port}/v1/patients/1/ledger`);
      expect(res.status).toBe(503);
    });
  });

  it("returns 404 when TRANS.DBF is absent", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-ledger-empty-"));
    try {
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/1/ledger`);
        expect(res.status).toBe(404);
        const body = (await res.json()) as { error?: { code?: string } };
        expect(body.error?.code).toBe("TRANS_DBF_NOT_FOUND");
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
