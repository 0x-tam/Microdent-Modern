import express from "express";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HealthResponseSchema } from "@microdent/contracts";

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

export function loadListenOptions(): { host: string; port: number } {
  const host = process.env.BRIDGE_HOST ?? "127.0.0.1";
  const raw = process.env.BRIDGE_PORT ?? "17890";
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid BRIDGE_PORT: ${raw}`);
  }
  return { host, port };
}

/**
 * Express app exposing only `GET /health` (Phase 1A).
 * @param version - exposed in JSON; defaults to this package's `version` from package.json.
 */
export function createBridgeApp(version: string = readBridgeVersion()): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.get("/health", (_req, res) => {
    const body = { ok: true as const, version };
    HealthResponseSchema.parse(body);
    res.json(body);
  });
  return app;
}
