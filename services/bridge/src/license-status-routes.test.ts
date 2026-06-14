import { createServer } from "node:http";
import { once } from "node:events";
import { join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineLicenseStatusResponseSchema } from "@microdent/contracts";
import { createBridgeApp } from "./app.js";

async function withServer(fn: (port: number) => Promise<void>): Promise<void> {
  const app = createBridgeApp(undefined, {
    bridgeConfig: {
      listen: { host: "127.0.0.1", port: 0 },
      dataRoot: { configured: false },
    },
  });
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

function assertNoPathsOrPhi(jsonText: string): void {
  expect(jsonText).not.toMatch(/MICRODENT_LICENSE_PATH/i);
  expect(jsonText).not.toMatch(/\/Users\//);
  expect(jsonText).not.toMatch(/\/tmp\//);
  expect(jsonText).not.toMatch(/[A-Z]:\\Users\\/i);
  expect(jsonText).not.toMatch(/license\.json/i);
  expect(jsonText).not.toMatch(/PAT_NAME|TELEPHONE|COMMENT/i);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /v1/meta/license-status", () => {
  it("returns not-configured without exposing paths or PHI", async () => {
    await withServer(async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/v1/meta/license-status`);
      expect(res.status).toBe(200);
      const text = await res.text();
      assertNoPathsOrPhi(text);
      const body = OfflineLicenseStatusResponseSchema.parse(JSON.parse(text));
      expect(body.status).toBe("not-configured");
      expect(body.configured).toBe(false);
      expect(body.features.readOnly).toBe(true);
      expect(body.features.sandboxWrites).toBe(false);
    });
  });

  it("returns missing for a configured absent license path without echoing the path", async () => {
    vi.stubEnv("MICRODENT_LICENSE_PATH", join(tmpdir(), "microdent-license-missing.json"));
    await withServer(async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/v1/meta/license-status`);
      const text = await res.text();
      assertNoPathsOrPhi(text);
      const body = OfflineLicenseStatusResponseSchema.parse(JSON.parse(text));
      expect(body.status).toBe("missing");
      expect(body.configured).toBe(true);
      expect(body.licensePresent).toBe(false);
    });
  });

  it("returns signature-unverified for a well-formed unsigned local license", async () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-license-status-"));
    try {
      const licensePath = join(root, "safe-license.json");
      writeFileSync(
        licensePath,
        JSON.stringify({
          schemaVersion: "microdent-offline-license/v1",
          product: "microdent-modern",
          licenseId: "LIC-CLINIC-PC-01",
          clinicLabel: "CLINIC-PC-01",
          tier: "clinic-enterprise",
          seats: 5,
          features: {
            readOnly: true,
            sandboxWrites: true,
            localCopyRefresh: true,
            supportExport: true,
          },
          issuedAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2030-01-01T00:00:00.000Z",
          graceDays: 30,
          expiryBehavior: "graceful-read-only",
          noPhiStatement: "no-real-patient-data",
          signature: "INVALIDBASE64==",
        }),
        "utf8",
      );
      vi.stubEnv("MICRODENT_LICENSE_PATH", licensePath);
      await withServer(async (port) => {
        const res = await fetch(`http://127.0.0.1:${port}/v1/meta/license-status`);
        const text = await res.text();
        assertNoPathsOrPhi(text);
        const body = OfflineLicenseStatusResponseSchema.parse(JSON.parse(text));
        expect(body.status).toBe("signature-unverified");
        expect(body.clinicLabel).toBe("CLINIC-PC-01");
        expect(body.tier).toBe("clinic-enterprise");
        expect(body.signatureVerified).toBe(false);
        expect(body.features.sandboxWrites).toBe(false);
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
