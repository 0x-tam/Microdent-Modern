import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DBFFile } from "dbffile";
import { createBridgeApp } from "./app.js";
import { parseDataRootFromValue } from "./config.js";
import { readPatientProfileFromDbf } from "./dbf/patient-profile.js";
import { ALLOW_LEGACY_WRITES_ACK } from "./write-safety/constants.js";
import { writeScheduleFixtures } from "./test-fixtures/schedule-fixtures.js";
import { writeSandboxMarker } from "./test-fixtures/write-sandbox.js";
import {
  assertSafeWritePlanExcludesKnownSecrets,
  assertSafeWritePlanJson,
  withEnabledSandboxServer,
  withHttpServer,
} from "./test-fixtures/write-route-gate-helpers.js";

function patchDemographics(
  port: number,
  patientId: string,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/v1/patients/${patientId}/demographics`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const validDemographicsBody = {
  firstName: "Updated",
  lastName: "Synthetic",
  chartNumber: "SCH-UPDATED",
};

describe("PATCH patient demographics — sandbox write band", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects WRITE_MODE=disabled", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-patient-demo-disabled-"));
    try {
      await writeScheduleFixtures(tmp);
      writeSandboxMarker(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const patientPath = join(tmp, "PATIENT.DBF");
      const mtimeBefore = statSync(patientPath).mtimeMs;

      const app = createBridgeApp("v-test", {
        bridgeConfig: { listen: { host: "127.0.0.1", port: 0 }, dataRoot, writeMode: "disabled" },
      });
      await withHttpServer(app, async (port) => {
        const res = await patchDemographics(port, "50001", validDemographicsBody);
        expect(res.status).toBe(403);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("WRITE_MODE_DISABLED");
        expect(statSync(patientPath).mtimeMs).toBe(mtimeBefore);
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects enabled mode without sandbox marker", async () => {
    vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
    await withEnabledSandboxServer(
      { prefix: "bridge-patient-demo-no-marker-", withMarker: false },
      async ({ port, patientPath }) => {
        const mtimeBefore = statSync(patientPath).mtimeMs;
        const res = await patchDemographics(port, "50001", validDemographicsBody);
        expect(res.status).toBe(403);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("WRITE_SANDBOX_MARKER_MISSING");
        expect(statSync(patientPath).mtimeMs).toBe(mtimeBefore);
      },
    );
  });

  it("rejects enabled mode without allow flag", async () => {
    vi.stubEnv("ALLOW_LEGACY_WRITES", "");
    await withEnabledSandboxServer({ prefix: "bridge-patient-demo-no-allow-" }, async ({ port, patientPath }) => {
      const mtimeBefore = statSync(patientPath).mtimeMs;
      const res = await patchDemographics(port, "50001", validDemographicsBody);
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error?: { code?: string } };
      expect(json.error?.code).toBe("WRITE_NOT_ACKNOWLEDGED");
      expect(statSync(patientPath).mtimeMs).toBe(mtimeBefore);
    });
  });

  it("does not write when backup fails", async () => {
    vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
    await withEnabledSandboxServer(
      { prefix: "bridge-patient-demo-backup-fail-", backupDirMode: 0o500 },
      async ({ port, dataRoot, patientPath }) => {
        const mtimeBefore = statSync(patientPath).mtimeMs;
        const before = await readPatientProfileFromDbf(dataRoot, "50001");
        expect(before.kind).toBe("ok");
        if (before.kind !== "ok") return;

        const res = await patchDemographics(port, "50001", validDemographicsBody);
        expect(res.status).toBe(503);
        const json = (await res.json()) as { error?: { code?: string } };
        expect(json.error?.code).toBe("WRITE_BACKUP_FAILED");
        expect(statSync(patientPath).mtimeMs).toBe(mtimeBefore);
        const after = await readPatientProfileFromDbf(dataRoot, "50001");
        expect(after.kind).toBe("ok");
        if (after.kind === "ok") {
          expect(after.profile.chartNumber).toBe(before.profile.chartNumber);
        }
      },
    );
  });

  it("honors X-Write-Intent dry-run on enabled bridge without mutating PATIENT", async () => {
    vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
    await withEnabledSandboxServer({ prefix: "bridge-patient-demo-intent-" }, async ({ port, backupRoot, patientPath }) => {
      const mtimeBefore = statSync(patientPath).mtimeMs;
      const res = await patchDemographics(port, "50001", validDemographicsBody, { "X-Write-Intent": "dry-run" });
      expect(res.status).toBe(200);
      const text = await res.text();
      const parsed = assertSafeWritePlanJson(text);
      assertSafeWritePlanExcludesKnownSecrets(text, parsed);
      expect(parsed.committed).toBe(false);
      expect(parsed.mode).toBe("dry-run");
      expect(statSync(patientPath).mtimeMs).toBe(mtimeBefore);
      expect(readdirSync(backupRoot)).toHaveLength(0);
    });
  });

  it.each([
    ["phone", { firstName: "X", phone: "555-0100" }],
    ["notes", { notes: "private note" }],
    ["address", { address: "123 Main St" }],
  ])("rejects non-allowlisted body key %s", async (_label, body) => {
    vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
    await withEnabledSandboxServer({ prefix: `bridge-patient-demo-strict-${_label}-` }, async ({ port, patientPath }) => {
      const mtimeBefore = statSync(patientPath).mtimeMs;
      const res = await patchDemographics(port, "50001", body);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error?: { code?: string } };
      expect(json.error?.code).toBe("INVALID_REQUEST_BODY");
      expect(statSync(patientPath).mtimeMs).toBe(mtimeBefore);
    });
  });

  it("updates allowlisted fields with backup", async () => {
    vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
    await withEnabledSandboxServer({ prefix: "bridge-patient-demo-ok-" }, async ({ port, dataRoot, backupRoot, tmp }) => {
      const res = await patchDemographics(port, "50001", validDemographicsBody);
      expect(res.status).toBe(200);
      const text = await res.text();
      const parsed = assertSafeWritePlanJson(text);
      assertSafeWritePlanExcludesKnownSecrets(text, parsed);
      expect(parsed.committed).toBe(true);
      expect(parsed.workflow).toBe("patient.demographics.update");

      const profile = await readPatientProfileFromDbf(dataRoot, "50001");
      expect(profile.kind).toBe("ok");
      if (profile.kind === "ok") {
        expect(profile.profile.chartNumber).toBe("SCH-UPDATED");
      }

      const dbf = await DBFFile.open(join(tmp, "PATIENT.DBF"), {
        encoding: "win1252",
        readMode: "loose",
      });
      for await (const row of dbf) {
        const rec = row as Record<string, unknown>;
        if (String(rec.ID).trim() === "50001") {
          expect(String(rec.HOME_PHONE ?? "")).toContain("555");
          break;
        }
      }

      const backupFolders = readdirSync(backupRoot);
      expect(backupFolders.length).toBe(1);
      expect(backupFolders[0]).toContain("patient.demographics.update");
    });
  });
});
