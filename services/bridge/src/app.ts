import express from "express";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HealthResponseSchema } from "@microdent/contracts";
import type { BridgeConfig } from "./config.js";
import { loadBridgeConfig } from "./config.js";
import { createV1Router } from "./routes/v1.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readBridgeVersion(): string {
  try {
    const path = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(path, "utf8")) as { version?: string };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export type CreateBridgeAppOptions = {
  bridgeConfig?: BridgeConfig;
};

/**
 * Express app: `GET /health`, read-only `GET /v1/*` table APIs (Band A3 fixture only).
 */
export function createBridgeApp(version?: string, options?: CreateBridgeAppOptions): express.Express {
  const ver = version ?? readBridgeVersion();
  const bridgeConfig = options?.bridgeConfig ?? loadBridgeConfig();
  const app = express();
  app.disable("x-powered-by");
  app.use("/v1", createV1Router(bridgeConfig));
  app.get("/health", (_req, res) => {
    const body = { ok: true as const, version: ver };
    HealthResponseSchema.parse(body);
    res.json(body);
  });
  return app;
}
