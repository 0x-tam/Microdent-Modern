import { createServer } from "node:http";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { BridgeDevStatusResponseSchema, HealthResponseSchema } from "@microdent/contracts";
import { createBridgeApp } from "./app.js";

async function withServer<T>(run: (port: number) => Promise<T>): Promise<T> {
  const app = createBridgeApp("cors-root-test");
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("expected TCP listen address");
  }
  const port = addr.port;
  try {
    return await run(port);
  } finally {
    server.close();
    await once(server, "close");
  }
}

function expectNoCredentials(res: Response): void {
  expect(res.headers.get("access-control-allow-credentials")).toBeNull();
}

describe("GET /", () => {
  it("returns safe service JSON", async () => {
    await withServer(async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      expect(res.status).toBe(200);
      const json: unknown = await res.json();
      expect(json).toEqual({ ok: true, service: "Microdent bridge", health: "/health" });
    });
  });
});

describe("GET /health (unchanged)", () => {
  it("still returns contract body", async () => {
    await withServer(async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      expect(res.status).toBe(200);
      const json: unknown = await res.json();
      expect(HealthResponseSchema.safeParse(json).success).toBe(true);
    });
  });
});

const SAMPLE_ALLOWED_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
  "http://127.0.0.1:5174",
  "http://localhost:5174",
  "http://[::1]:5173",
] as const;

describe("Local preview CORS (loopback + port range)", () => {
  it.each(SAMPLE_ALLOWED_ORIGINS)("reflects Access-Control-Allow-Origin for %s on GET /health", async (origin) => {
    await withServer(async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        headers: { Origin: origin },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe(origin);
      expect(res.headers.get("access-control-allow-methods")).toContain("GET");
      const allowHeaders = res.headers.get("access-control-allow-headers");
      expect(allowHeaders?.toLowerCase()).toContain("accept");
      expect(allowHeaders?.toLowerCase()).toContain("content-type");
      expectNoCredentials(res);
    });
  });

  it.each([
    "https://evil.example",
    "http://evil.example",
    "http://192.168.1.5:5173",
    "http://0.0.0.0:5173",
    "http://127.0.0.1:6000",
    "http://localhost:2999",
  ])("does not set Access-Control-Allow-Origin for %s", async (origin) => {
    await withServer(async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        headers: { Origin: origin },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expectNoCredentials(res);
    });
  });

  it("does not allow Origin string null", async () => {
    await withServer(async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        headers: { Origin: "null" },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expectNoCredentials(res);
    });
  });

  it.each(SAMPLE_ALLOWED_ORIGINS)("OPTIONS preflight for %s returns 204 with CORS headers", async (origin) => {
    await withServer(async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "GET",
        },
      });
      expect(res.status).toBe(204);
      expect(res.headers.get("access-control-allow-origin")).toBe(origin);
      expect(res.headers.get("access-control-allow-methods")).toMatch(/GET/);
      const allowHeaders = res.headers.get("access-control-allow-headers");
      expect(allowHeaders?.toLowerCase()).toContain("accept");
      expect(allowHeaders?.toLowerCase()).toContain("content-type");
      expectNoCredentials(res);
    });
  });

  it("OPTIONS for disallowed origin omits Access-Control-Allow-Origin", async () => {
    await withServer(async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.example",
          "Access-Control-Request-Method": "GET",
        },
      });
      expect(res.status).toBe(204);
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expectNoCredentials(res);
    });
  });
});

describe("GET /v1/meta/write-capability", () => {
  it("returns safe write capability fields", async () => {
    const { createBridgeApp } = await import("./app.js");
    const { parseBackupDirFromValue, parseDataRootFromValue } = await import("./config.js");
    const dataRoot = parseDataRootFromValue("/tmp/microdent-write-capability-data");
    const backupDir = parseBackupDirFromValue("/tmp/microdent-write-capability-backups");
    if (!dataRoot.configured || !backupDir.configured) throw new Error("paths");
    const app = createBridgeApp("v-test", {
      bridgeConfig: {
        listen: { host: "127.0.0.1", port: 0 },
        dataRoot,
        backupDir,
        writeMode: "enabled",
      },
    });
    const server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => resolve());
      server.on("error", reject);
    });
    try {
      const addr = server.address();
      if (!addr || typeof addr === "string") throw new Error("no port");
      const res = await fetch(`http://127.0.0.1:${addr.port}/v1/meta/write-capability`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(BridgeDevStatusResponseSchema.safeParse(json).success).toBe(true);
      expect(json).toMatchObject({
        writeMode: "enabled",
        writesPermitted: true,
        dataRootConfigured: true,
        backupDirConfigured: true,
      });
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});

describe("GET /debug/status (non-production only)", () => {
  it("returns write mode without permitting writes", async () => {
    if (process.env.NODE_ENV === "production") {
      return;
    }
    await withServer(async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/debug/status`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(BridgeDevStatusResponseSchema.safeParse(json).success).toBe(true);
      expect(json).toEqual({
        writeMode: "disabled",
        writesPermitted: false,
        writableSandbox: false,
        dataRootConfigured: false,
        backupDirConfigured: false,
        sqlitePathConfigured: false,
      });
    });
  });

  it("reflects enabled writeMode with writesPermitted false when backup is missing", async () => {
    if (process.env.NODE_ENV === "production") {
      return;
    }
    const { createBridgeApp } = await import("./app.js");
    const { parseDataRootFromValue } = await import("./config.js");
    const dataRoot = parseDataRootFromValue("/tmp/microdent-write-mode-test-data");
    if (!dataRoot.configured) throw new Error("data root");
    const app = createBridgeApp("v-test", {
      bridgeConfig: {
        listen: { host: "127.0.0.1", port: 0 },
        dataRoot,
        writeMode: "enabled",
      },
    });
    const server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => resolve());
      server.on("error", reject);
    });
    try {
      const addr = server.address();
      if (!addr || typeof addr === "string") throw new Error("no port");
      const res = await fetch(`http://127.0.0.1:${addr.port}/debug/status`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        writeMode: "enabled",
        writesPermitted: false,
        writableSandbox: false,
        dataRootConfigured: true,
        backupDirConfigured: false,
        sqlitePathConfigured: false,
      });
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("reflects writesPermitted true when enabled with backup and data root", async () => {
    if (process.env.NODE_ENV === "production") {
      return;
    }
    const { createBridgeApp } = await import("./app.js");
    const { parseBackupDirFromValue, parseDataRootFromValue } = await import("./config.js");
    const dataRoot = parseDataRootFromValue("/tmp/microdent-write-mode-test-data");
    const backupDir = parseBackupDirFromValue("/tmp/microdent-write-mode-test-backups");
    if (!dataRoot.configured || !backupDir.configured) throw new Error("paths");
    const app = createBridgeApp("v-test", {
      bridgeConfig: {
        listen: { host: "127.0.0.1", port: 0 },
        dataRoot,
        backupDir,
        writeMode: "enabled",
      },
    });
    const server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => resolve());
      server.on("error", reject);
    });
    try {
      const addr = server.address();
      if (!addr || typeof addr === "string") throw new Error("no port");
      const res = await fetch(`http://127.0.0.1:${addr.port}/debug/status`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toMatchObject({
        writeMode: "enabled",
        writesPermitted: true,
      });
      expect(typeof json.writableSandbox).toBe("boolean");
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});

describe("GET /debug/cors (non-production only)", () => {
  it("returns static CORS policy metadata without secrets", async () => {
    if (process.env.NODE_ENV === "production") {
      return;
    }
    await withServer(async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/debug/cors`);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        service: string;
        cors: { allowedLoopbackHosts: string[]; allowedPortRange: { min: number; max: number } };
      };
      expect(json.service).toBe("Microdent bridge");
      expect(json.cors.allowedLoopbackHosts).toEqual(["127.0.0.1", "localhost", "::1"]);
      expect(json.cors.allowedPortRange).toEqual({ min: 3000, max: 5999 });
    });
  });

  it("sends CORS headers for GET /debug/cors when Origin is an allowed preview URL", async () => {
    if (process.env.NODE_ENV === "production") {
      return;
    }
    await withServer(async (port) => {
      const origin = "http://127.0.0.1:5173";
      const res = await fetch(`http://127.0.0.1:${port}/debug/cors`, {
        headers: { Origin: origin },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe(origin);
      expectNoCredentials(res);
    });
  });
});
