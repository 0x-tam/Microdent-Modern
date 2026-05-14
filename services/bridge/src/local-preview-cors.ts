import type { NextFunction, Request, Response } from "express";

/**
 * Vite dev (`pnpm dev` / `preview:web`) and production preview (`vite preview`) — loopback only.
 * Not a blanket wildcard.
 */
const LOCAL_PREVIEW_ORIGINS = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

/**
 * Minimal CORS for local web preview only: fixed loopback origins (5173 dev, 4173 preview), GET + OPTIONS, no credentials.
 * Does not reflect arbitrary Origins (avoids accidental open CORS).
 */
export function localPreviewCorsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get("Origin") ?? undefined;
  const allowed = origin !== undefined && LOCAL_PREVIEW_ORIGINS.has(origin);

  if (req.method === "OPTIONS") {
    if (allowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Accept");
      res.setHeader("Access-Control-Max-Age", "600");
    }
    res.status(204).end();
    return;
  }

  if (allowed && req.method === "GET") {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Accept");
  }

  next();
}
