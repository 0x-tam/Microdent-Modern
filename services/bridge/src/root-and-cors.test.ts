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

describe("Local preview CORS", () => {
  it("reflects Access-Control-Allow-Origin for http://127.0.0.1:5173 on GET /health", async () => {
    await withServer(async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        headers: { Origin: "http://127.0.0.1:5173" },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");
      expect(res.headers.get("access-control-allow-methods")).toContain("GET");
      expect(res.headers.get("access-control-allow-credentials")).toBeNull();
    });
  });

  it("reflects Access-Control-Allow-Origin for http://localhost:5173", async () => {
    await withServer(async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        headers: { Origin: "http://localhost:5173" },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
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

  it("OPTIONS preflight for allowed origin returns 204 with CORS headers", async () => {
    await withServer(async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://127.0.0.1:5173",
          "Access-Control-Request-Method": "GET",
        },
      });
      expect(res.status).toBe(204);
      expect(res.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");
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
