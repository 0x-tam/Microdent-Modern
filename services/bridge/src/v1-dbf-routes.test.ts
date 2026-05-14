import { createServer } from "node:http";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  TableRowsResponseSchema,
  TablesListResponseSchema,
  TableSchemaResponseSchema,
} from "@microdent/contracts";
import { createBridgeApp } from "./app.js";
import type { BridgeConfig } from "./config.js";
import { parseDataRootFromValue } from "./config.js";

const fixtureDataRoot = (): string => fileURLToPath(new URL("../fixtures/sandbox", import.meta.url));

function fixtureBridgeConfig(): BridgeConfig {
  const dataRoot = parseDataRootFromValue(fixtureDataRoot());
  if (!dataRoot.configured) {
    throw new Error("fixture DATA_ROOT must be configured");
  }
  return {
    listen: { host: "127.0.0.1", port: 0 },
    dataRoot,
  };
}

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

describe("GET /v1 DBF fixture routes", () => {
  it("lists the synthetic fixture table when DATA_ROOT points at the fixture sandbox", async () => {
    const app = createBridgeApp("v-test", { bridgeConfig: fixtureBridgeConfig() });
    await withServer(app, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/v1/meta/tables`);
      expect(res.status).toBe(200);
      const json: unknown = await res.json();
      const parsed = TablesListResponseSchema.safeParse(json);
      expect(parsed.success).toBe(true);
      if (!parsed.success) return;
      expect(parsed.data.tables.some((t) => t.id === "fixture_tiny")).toBe(true);
    });
  });

  it("returns schema fields for the fixture table", async () => {
    const app = createBridgeApp("v-test", { bridgeConfig: fixtureBridgeConfig() });
    await withServer(app, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/v1/tables/fixture_tiny/schema`);
      expect(res.status).toBe(200);
      const json: unknown = await res.json();
      const parsed = TableSchemaResponseSchema.safeParse(json);
      expect(parsed.success).toBe(true);
      if (!parsed.success) return;
      const names = parsed.data.fields.map((f) => f.name);
      expect(names).toContain("ALIAS");
      expect(names).toContain("SCORE");
    });
  });

  it("returns fixture rows with pagination metadata", async () => {
    const app = createBridgeApp("v-test", { bridgeConfig: fixtureBridgeConfig() });
    await withServer(app, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/v1/tables/fixture_tiny/rows?limit=10&offset=0`);
      expect(res.status).toBe(200);
      const json: unknown = await res.json();
      const parsed = TableRowsResponseSchema.safeParse(json);
      expect(parsed.success).toBe(true);
      if (!parsed.success) return;
      expect(parsed.data.totalRecords).toBe(3);
      expect(parsed.data.rows.length).toBe(3);
    });
  });

  it("applies offset and limit to the row window", async () => {
    const app = createBridgeApp("v-test", { bridgeConfig: fixtureBridgeConfig() });
    await withServer(app, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/v1/tables/fixture_tiny/rows?limit=1&offset=2`);
      expect(res.status).toBe(200);
      const json: unknown = await res.json();
      const parsed = TableRowsResponseSchema.safeParse(json);
      expect(parsed.success).toBe(true);
      if (!parsed.success) return;
      expect(parsed.data.rows).toHaveLength(1);
      expect(parsed.data.offset).toBe(2);
      expect(parsed.data.limit).toBe(1);
    });
  });

  it("enforces the limit cap", async () => {
    const app = createBridgeApp("v-test", { bridgeConfig: fixtureBridgeConfig() });
    await withServer(app, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/v1/tables/fixture_tiny/rows?limit=101`);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error?: { code?: string } };
      expect(json.error?.code).toBe("INVALID_PAGINATION");
    });
  });

  it("returns 404 for unknown table id", async () => {
    const app = createBridgeApp("v-test", { bridgeConfig: fixtureBridgeConfig() });
    await withServer(app, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/v1/tables/not_a_real_table/rows`);
      expect(res.status).toBe(404);
    });
  });

  it("returns 400 when table id decodes to a path-like value", async () => {
    const app = createBridgeApp("v-test", { bridgeConfig: fixtureBridgeConfig() });
    await withServer(app, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/v1/tables/fixture_tiny%2Fextra/rows`);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error?: { code?: string } };
      expect(json.error?.code).toBe("INVALID_TABLE_ID");
    });
  });

  it("returns 400 for invalid pagination", async () => {
    const app = createBridgeApp("v-test", { bridgeConfig: fixtureBridgeConfig() });
    await withServer(app, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/v1/tables/fixture_tiny/rows?limit=0`);
      expect(res.status).toBe(400);
    });
  });

  it("returns 503 when DATA_ROOT is not configured", async () => {
    const cfg: BridgeConfig = {
      listen: { host: "127.0.0.1", port: 0 },
      dataRoot: { configured: false },
    };
    const app = createBridgeApp("v-test", { bridgeConfig: cfg });
    await withServer(app, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/v1/meta/tables`);
      expect(res.status).toBe(503);
    });
  });
});

describe("GET /health with v1 mounted", () => {
  it("still returns 200", async () => {
    const app = createBridgeApp("v-test", { bridgeConfig: fixtureBridgeConfig() });
    await withServer(app, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      expect(res.status).toBe(200);
    });
  });
});
