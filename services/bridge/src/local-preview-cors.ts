import type { NextFunction, Request, Response } from "express";

/** Loopback hostnames only; no LAN IPs, no wildcards. */
export const LOCAL_PREVIEW_ALLOWED_HOSTS = ["127.0.0.1", "localhost", "::1"] as const;

export const LOCAL_PREVIEW_PORT_MIN = 3000;
export const LOCAL_PREVIEW_PORT_MAX = 5999;

const ALLOWED_HOST_SET = new Set<string>(LOCAL_PREVIEW_ALLOWED_HOSTS);

const CORS_ALLOW_METHODS = "GET, OPTIONS";
const CORS_ALLOW_HEADERS = "Accept, Content-Type";

function normalizeLoopbackHostname(hostname: string): string {
  const lower = hostname.toLowerCase();
  if (lower.startsWith("[") && lower.endsWith("]")) {
    return lower.slice(1, -1);
  }
  return lower;
}

/**
 * True when `Origin` is a safe local preview URL: `http:` only, loopback host, dev port range 3000–5999.
 * Rejects https, file, null / opaque origin string, credentials in URL, non-loopback hosts, and ports outside range.
 */
export function isAllowedLocalPreviewOrigin(originHeader: string | undefined | null): boolean {
  if (originHeader === undefined || originHeader === null) {
    return false;
  }
  const trimmed = originHeader.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "null") {
    return false;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }

  if (url.protocol !== "http:") {
    return false;
  }
  if (url.username !== "" || url.password !== "") {
    return false;
  }

  const host = normalizeLoopbackHostname(url.hostname);
  if (!ALLOWED_HOST_SET.has(host)) {
    return false;
  }

  const portNum = url.port === "" ? 80 : Number.parseInt(url.port, 10);
  if (!Number.isInteger(portNum) || portNum < LOCAL_PREVIEW_PORT_MIN || portNum > LOCAL_PREVIEW_PORT_MAX) {
    return false;
  }

  return true;
}

/**
 * Minimal CORS for local web preview: loopback `http` origins on ports 3000–5999 only, GET + OPTIONS, no credentials.
 * Echoes the request `Origin` when allowed (never `*`).
 */
export function localPreviewCorsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get("Origin") ?? undefined;
  const allowed = isAllowedLocalPreviewOrigin(origin);

  if (req.method === "OPTIONS") {
    if (allowed && origin !== undefined) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", CORS_ALLOW_METHODS);
      res.setHeader("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
      res.setHeader("Access-Control-Max-Age", "600");
    }
    res.status(204).end();
    return;
  }

  if (allowed && origin !== undefined && req.method === "GET") {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", CORS_ALLOW_METHODS);
    res.setHeader("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
  }

  next();
}
