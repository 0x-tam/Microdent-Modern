import express from "express";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BridgeDevStatusResponseSchema, HealthResponseSchema } from "@microdent/contracts";
import type { BridgeConfigInput } from "./config.js";
import {
  isWritableSandboxReady,
  loadBridgeConfig,
  normalizeBridgeConfig,
  writesPermitted,
} from "./config.js";
import {
  LOCAL_PREVIEW_ALLOWED_HOSTS,
  LOCAL_PREVIEW_PORT_MAX,
  LOCAL_PREVIEW_PORT_MIN,
  localPreviewCorsMiddleware,
} from "./local-preview-cors.js";
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
  bridgeConfig?: BridgeConfigInput;
};

/**
 * Express app: `GET /` (service info), `GET /health`, read-only `GET /v1/*` (fixture table APIs, legacy catalog, patient search + profile + medical summary, schedule rooms/appointments).
 * In non-`production` Node env, also `GET /debug/cors` and `GET /debug/status` (safe diagnostics, no secrets).
 */
function resolveBridgeConfig(partial?: BridgeConfigInput) {
  if (!partial) return loadBridgeConfig();
  return normalizeBridgeConfig(partial);
}

export function createBridgeApp(version?: string, options?: CreateBridgeAppOptions): express.Express {
  const ver = version ?? readBridgeVersion();
  const bridgeConfig = resolveBridgeConfig(options?.bridgeConfig);
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "8kb" }));
  app.use(localPreviewCorsMiddleware);
  if (process.env.NODE_ENV !== "production") {
    app.get("/debug/cors", (_req, res) => {
      res.json({
        service: "Microdent bridge",
        cors: {
          allowedLoopbackHosts: [...LOCAL_PREVIEW_ALLOWED_HOSTS],
          allowedPortRange: { min: LOCAL_PREVIEW_PORT_MIN, max: LOCAL_PREVIEW_PORT_MAX },
        },
      });
    });
    app.get("/debug/status", (_req, res) => {
      const body = {
        writeMode: bridgeConfig.writeMode,
        writesPermitted: writesPermitted(bridgeConfig),
        writableSandbox: isWritableSandboxReady(bridgeConfig),
      };
      BridgeDevStatusResponseSchema.parse(body);
      res.json(body);
    });
  }
  app.get("/", (_req, res) => {
    res.json({ ok: true as const, service: "Microdent bridge", health: "/health" });
  });
  app.use("/v1", createV1Router(bridgeConfig));
  app.get("/health", (_req, res) => {
    const body = { ok: true as const, version: ver };
    HealthResponseSchema.parse(body);
    res.json(body);
  });
  return app;
}
