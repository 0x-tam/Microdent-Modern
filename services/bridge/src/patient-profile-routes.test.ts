import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { PatientProfileResponseSchema } from "@microdent/contracts";
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

const SECRET_STREET = "SYNTHETIC_PROFILE_STREET_TOKEN_AA";
const SECRET_EMAIL = "synthetic.profile.email.token@invalid.test";
const SECRET_PHONE_FULL = "15551112222";

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
    {
      ID: 778,
      CASENB: "PFX-778",
      NAME: "Other Row",
      REV_NAME: "",
      FIRST_NAME: "",
      LAST_NAME: "",
      HOME_PHONE: "",
      MOBILE: "",
      ACTIVE: false,
      DOCTOR_NB: 0,
      ENTRY_DATE: entry,
      LASTVISIT: lastV,
      STREET: "",
      EMAIL: "",
    },
  ]);
}

describe("GET /v1/patients/:patientId/profile", () => {
  it("returns a safe profile subset for a synthetic id", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-patient-profile-"));
    try {
      await writeProfilePatientFixture(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/777/profile`);
        expect(res.status).toBe(200);
        const json: unknown = await res.json();
        const parsed = PatientProfileResponseSchema.safeParse(json);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.patientId).toBe("777");
        expect(parsed.data.chartNumber).toBe("PFX-777");
        expect(parsed.data.displayName).toBe("Synthetic Profile Subject");
        expect(parsed.data.reverseName).toBe("Subject, Synthetic P.");
        expect(parsed.data.phoneMask).toBe("…2222");
        expect(parsed.data.active).toBe(true);
        expect(parsed.data.doctorId).toBe("12");
        expect(parsed.data.entryDate).toBe("2019-01-15");
        expect(parsed.data.lastVisit).toBe("2024-06-01");

        const raw = JSON.stringify(json);
        expect(raw).not.toContain(SECRET_STREET);
        expect(raw).not.toContain(SECRET_EMAIL);
        expect(raw).not.toContain(SECRET_PHONE_FULL);
        expect(raw).not.toContain("STREET");
        expect(raw).not.toContain("EMAIL");
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns 404 when patient id does not exist", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-patient-profile-miss-"));
    try {
      await writeProfilePatientFixture(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/999999/profile`);
        expect(res.status).toBe(404);
        const body = (await res.json()) as { error?: { code?: string } };
        expect(body.error?.code).toBe("PATIENT_NOT_FOUND");
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns 400 for invalid patientId", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-patient-profile-bad-"));
    try {
      await writeProfilePatientFixture(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const a = await fetch(`http://127.0.0.1:${port}/v1/patients/0/profile`);
        expect(a.status).toBe(400);
        const b = await fetch(`http://127.0.0.1:${port}/v1/patients/abc/profile`);
        expect(b.status).toBe(400);
        const c = await fetch(`http://127.0.0.1:${port}/v1/patients/0777/profile`);
        expect(c.status).toBe(400);
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
      const res = await fetch(`http://127.0.0.1:${port}/v1/patients/1/profile`);
      expect(res.status).toBe(503);
    });
  });

  it("returns 404 when PATIENT.DBF is absent", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-patient-profile-empty-"));
    try {
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot },
      });
      await withServer(app, async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/patients/1/profile`);
        expect(res.status).toBe(404);
        const body = (await res.json()) as { error?: { code?: string } };
        expect(body.error?.code).toBe("PATIENT_DBF_NOT_FOUND");
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
