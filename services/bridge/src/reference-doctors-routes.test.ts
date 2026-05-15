import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { ReferenceDoctorsResponseSchema } from "@microdent/contracts";
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

const doctorFields = [
  { name: "DOCTOR_NB", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "NAME", type: "C" as const, size: 30 },
  { name: "SCHEDULE", type: "N" as const, size: 1, decimalPlaces: 0 },
  { name: "PHONE", type: "C" as const, size: 19 },
  { name: "ADDRESS", type: "C" as const, size: 50 },
  { name: "FED_TAXID", type: "C" as const, size: 12 },
];

/** FoxPro soft-delete: first byte of record becomes `*`. */
function markDbfRecordDeleted(dbfPath: string, recordIndex: number): void {
  const buf = readFileSync(dbfPath);
  const hlen = buf.readUInt16LE(8);
  const rlen = buf.readUInt16LE(10);
  const offset = hlen + recordIndex * rlen;
  buf[offset] = 0x2a;
  writeFileSync(dbfPath, buf);
}

async function writeSyntheticDoctorsDbf(dir: string, opts?: { markThirdDeleted?: boolean }): Promise<void> {
  const path = join(dir, "DOCTORS.DBF");
  const dbf = await DBFFile.create(path, doctorFields, {});
  await dbf.appendRecords([
    {
      DOCTOR_NB: 101,
      NAME: "Synthetic Provider Alpha",
      SCHEDULE: 1,
      PHONE: "555-000-1001",
      ADDRESS: "100 Synthetic Clinic Way",
      FED_TAXID: "00-1111111",
    },
    {
      DOCTOR_NB: 102,
      NAME: "",
      SCHEDULE: 0,
      PHONE: "555-000-1002",
      ADDRESS: "200 Hidden Address Row",
      FED_TAXID: "00-2222222",
    },
    {
      DOCTOR_NB: 103,
      NAME: "Synthetic Provider Deleted",
      SCHEDULE: 1,
      PHONE: "555-000-1003",
      ADDRESS: "300 Should Not Appear",
      FED_TAXID: "00-3333333",
    },
  ]);
  if (opts?.markThirdDeleted) {
    markDbfRecordDeleted(path, 2);
  }
}

describe("GET /v1/reference/doctors", () => {
  it("returns doctor id + display label from synthetic DOCTORS.DBF", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-ref-doctors-"));
    try {
      await writeSyntheticDoctorsDbf(tmp, { markThirdDeleted: true });
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/reference/doctors`);
        expect(res.status).toBe(200);
        const json = await res.json();
        const parsed = ReferenceDoctorsResponseSchema.parse(json);
        expect(parsed.doctors).toHaveLength(2);
        expect(parsed.doctors[0]).toEqual({
          doctorId: "101",
          displayName: "Synthetic Provider Alpha",
          active: true,
        });
        expect(parsed.doctors[1]).toEqual({
          doctorId: "102",
          displayName: "Doctor 102",
          active: false,
        });
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("skips soft-deleted rows", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-ref-doctors-del-"));
    try {
      await writeSyntheticDoctorsDbf(tmp, { markThirdDeleted: true });
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/reference/doctors`);
        const json = (await res.json()) as { doctors: { doctorId: string }[] };
        const ids = json.doctors.map((d) => d.doctorId);
        expect(ids).not.toContain("103");
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not return raw or private fields in JSON", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-ref-doctors-pii-"));
    try {
      await writeSyntheticDoctorsDbf(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/reference/doctors`);
        const text = await res.text();
        expect(text).not.toContain("555-000-1001");
        expect(text).not.toContain("Synthetic Clinic Way");
        expect(text).not.toContain("00-1111111");
        expect(text).not.toContain("PHONE");
        expect(text).not.toContain("ADDRESS");
        expect(text).not.toContain("FED_TAXID");
        const json = JSON.parse(text) as { doctors: Record<string, unknown>[] };
        for (const row of json.doctors) {
          expect(Object.keys(row).sort()).toEqual(["active", "displayName", "doctorId"]);
        }
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
      const res = await fetch(`http://127.0.0.1:${port}/v1/reference/doctors`);
      expect(res.status).toBe(503);
      const body = (await res.json()) as { error?: { code?: string } };
      expect(body.error?.code).toBe("DATA_ROOT_NOT_CONFIGURED");
    });
  });

  it("returns 404 when DOCTORS.DBF is absent", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-ref-doctors-missing-"));
    try {
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/reference/doctors`);
        expect(res.status).toBe(404);
        const body = (await res.json()) as { error?: { code?: string } };
        expect(body.error?.code).toBe("DOCTORS_DBF_NOT_FOUND");
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
