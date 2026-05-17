import { describe, expect, it } from "vitest";
import express from "express";
import { createServer } from "node:http";
import { once } from "node:events";
import { rateLimitMiddleware } from "./rate-limit.js";

async function withApp(fn: (port: number) => Promise<void>): Promise<void> {
  const app = express();
  app.use(rateLimitMiddleware);
  app.get("/ping", (_req, res) => {
    res.json({ ok: true });
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("port");
  try {
    await fn(addr.port);
  } finally {
    server.close();
    await once(server, "close");
  }
}

describe("rateLimitMiddleware", () => {
  it("allows normal traffic", async () => {
    await withApp(async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/ping`);
      expect(res.status).toBe(200);
    });
  });
});
