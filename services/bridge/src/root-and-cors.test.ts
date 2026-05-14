import { createServer } from "node:http";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { HealthResponseSchema } from "@microdent/contracts";
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

const ALLOWED_PREVIEW_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
] as const;

describe("Local preview CORS", () => {
  it.each(ALLOWED_PREVIEW_ORIGINS)("reflects Access-Control-Allow-Origin for %s on GET /health", async (origin) => {
    await withServer(async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        headers: { Origin: origin },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe(origin);
      expect(res.headers.get("access-control-allow-methods")).toContain("GET");
      expect(res.headers.get("access-control-allow-credentials")).toBeNull();
    });
  });

  it("does not set Access-Control-Allow-Origin for unrelated hosts", async () => {
    await withServer(async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        headers: { Origin: "https://evil.example" },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });
  });

  it.each(ALLOWED_PREVIEW_ORIGINS)("OPTIONS preflight for %s returns 204 with CORS headers", async (origin) => {
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
    });
  });
});
