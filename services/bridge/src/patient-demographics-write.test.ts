import { createServer } from "node:http";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DBFFile } from "dbffile";
import { SafeWritePlanSchema } from "@microdent/contracts";
import { createBridgeApp } from "./app.js";
import { parseBackupDirFromValue, parseDataRootFromValue } from "./config.js";
import { readPatientProfileFromDbf } from "./dbf/patient-profile.js";
import { ALLOW_LEGACY_WRITES_ACK } from "./write-safety/constants.js";
import { writeScheduleFixtures } from "./test-fixtures/schedule-fixtures.js";
import { writeSandboxMarker } from "./test-fixtures/write-sandbox.js";

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

function patchDemographics(
  port: number,
  patientId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/v1/patients/${patientId}/demographics`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH patient demographics — sandbox write band", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("updates allowlisted fields with backup", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-patient-demo-"));
    const backupRoot = mkdtempSync(join(tmpdir(), "bridge-patient-demo-backup-"));
    try {
      await writeScheduleFixtures(tmp);
      writeSandboxMarker(tmp);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");

      vi.stubEnv("ALLOW_LEGACY_WRITES", ALLOW_LEGACY_WRITES_ACK);
      const app = createBridgeApp("v-test", {
        bridgeConfig: {
          listen: { host: "127.0.0.1", port: 0 },
          dataRoot,
          backupDir: parseBackupDirFromValue(backupRoot),
          writeMode: "enabled",
        },
      });
      await withServer(app, async (port) => {
        const res = await patchDemographics(port, "50001", {
          firstName: "Updated",
          lastName: "Synthetic",
          chartNumber: "SCH-UPDATED",
        });
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).not.toMatch(/555/);
        expect(text).not.toContain("HOME_PHONE");
        const parsed = SafeWritePlanSchema.parse(JSON.parse(text));
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
    } finally {
      rmSync(tmp, { recursive: true, force: true });
      rmSync(backupRoot, { recursive: true, force: true });
    }
  });
});
