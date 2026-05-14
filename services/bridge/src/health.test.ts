import { createServer } from "node:http";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { HealthResponseSchema } from "@microdent/contracts";
import { createBridgeApp } from "./app.js";

describe("GET /health", () => {
  it("returns 200 and a body that satisfies the Zod contract", async () => {
    const app = createBridgeApp("test-version");
    const server = createServer(app);

    await new Promise<void>((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => resolve());
      server.on("error", reject);
    });

    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("expected TCP listen address");
    }

    try {
      const res = await fetch(`http://127.0.0.1:${addr.port}/health`);
      expect(res.status).toBe(200);
      const json: unknown = await res.json();
      const parsed = HealthResponseSchema.safeParse(json);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toEqual({ ok: true, version: "test-version" });
      }
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
