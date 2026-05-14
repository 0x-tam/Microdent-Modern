import { existsSync } from "node:fs";
import { Router, type Response } from "express";
import {
  ApiErrorBodySchema,
  TableRowsResponseSchema,
  TablesListResponseSchema,
  TableSchemaResponseSchema,
} from "@microdent/contracts";
import type { BridgeConfig } from "../config.js";
import { openRegisteredDbf, parsePagination, readRegisteredTableRows } from "../dbf/read-table.js";
import { resolveRegisteredDbfPath } from "../dbf/resolve-registered-dbf.js";
import { findRegistryEntry, TABLE_ID_PATTERN, TABLE_REGISTRY } from "../dbf/table-registry.js";

function sendError(res: Response, status: number, code: string, message: string): void {
  const body = { error: { code, message } };
  ApiErrorBodySchema.parse(body);
  res.status(status).json(body);
}

function requireConfiguredDataRoot(
  res: Response,
  cfg: BridgeConfig,
): cfg is BridgeConfig & { dataRoot: { configured: true; realPath: string } } {
  if (!cfg.dataRoot.configured) {
    sendError(res, 503, "DATA_ROOT_NOT_CONFIGURED", "DATA_ROOT is not configured");
    return false;
  }
  return true;
}

export function createV1Router(bridgeConfig: BridgeConfig): Router {
  const router = Router();

  router.get("/meta/tables", (_req, res) => {
    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const dr = bridgeConfig.dataRoot;

    const tables = TABLE_REGISTRY.filter((entry) => {
      try {
        const abs = resolveRegisteredDbfPath(dr, entry.fileName);
        return existsSync(abs);
      } catch {
        return false;
      }
    }).map((entry) => ({
      id: entry.id,
      label: entry.label,
      fileName: entry.fileName,
    }));

    const body = { tables };
    TablesListResponseSchema.parse(body);
    res.json(body);
  });

  router.get("/tables/:tableId/schema", async (req, res) => {
    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const dr = bridgeConfig.dataRoot;

    const { tableId } = req.params;
    if (!TABLE_ID_PATTERN.test(tableId)) {
      sendError(res, 400, "INVALID_TABLE_ID", "table id has invalid format");
      return;
    }

    const entry = findRegistryEntry(tableId);
    if (!entry) {
      sendError(res, 404, "TABLE_NOT_FOUND", "unknown table id");
      return;
    }

    try {
      const dbf = await openRegisteredDbf(dr, entry);
      const fields = dbf.fields.map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
        ...(f.decimalPlaces !== undefined ? { decimalPlaces: f.decimalPlaces } : {}),
      }));
      const body = { tableId, fields };
      TableSchemaResponseSchema.parse(body);
      res.json(body);
    } catch {
      sendError(res, 500, "DBF_READ_ERROR", "failed to read DBF schema");
    }
  });

  router.get("/tables/:tableId/rows", async (req, res) => {
    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const dr = bridgeConfig.dataRoot;

    const parsed = parsePagination(req.query as Record<string, unknown>);
    if ("error" in parsed) {
      sendError(res, 400, "INVALID_PAGINATION", parsed.error);
      return;
    }

    const { tableId } = req.params;
    if (!TABLE_ID_PATTERN.test(tableId)) {
      sendError(res, 400, "INVALID_TABLE_ID", "table id has invalid format");
      return;
    }

    const entry = findRegistryEntry(tableId);
    if (!entry) {
      sendError(res, 404, "TABLE_NOT_FOUND", "unknown table id");
      return;
    }

    try {
      const { totalRecords, rows } = await readRegisteredTableRows(dr, entry, parsed);
      const body = {
        tableId,
        limit: parsed.limit,
        offset: parsed.offset,
        totalRecords,
        rows: rows.map(sanitizeRowForJson),
      };
      TableRowsResponseSchema.parse(body);
      res.json(body);
    } catch {
      sendError(res, 500, "DBF_READ_ERROR", "failed to read DBF rows");
    }
  });

  return router;
}

function sanitizeRowForJson(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) {
      out[k] = v.toISOString();
    } else {
      out[k] = v;
    }
  }
  return out;
}
