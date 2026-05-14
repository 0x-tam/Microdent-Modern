import { existsSync } from "node:fs";
import { Router, type Response } from "express";
import {
  ApiErrorBodySchema,
  LegacyCatalogResponseSchema,
  PatientSearchQueryParamsSchema,
  PatientSearchResponseSchema,
  ScheduleAppointmentsQuerySchema,
  ScheduleAppointmentsResponseSchema,
  ScheduleRoomsResponseSchema,
  TableRowsResponseSchema,
  TablesListResponseSchema,
  TableSchemaResponseSchema,
} from "@microdent/contracts";
import type { BridgeConfig } from "../config.js";
import { searchPatientsInDbf } from "../dbf/patient-search.js";
import { openRegisteredDbf, parsePagination, readRegisteredTableRows } from "../dbf/read-table.js";
import { resolveRegisteredDbfPath } from "../dbf/resolve-registered-dbf.js";
import { findRegistryEntry, TABLE_ID_PATTERN, TABLE_REGISTRY } from "../dbf/table-registry.js";
import { readLegacyCatalogRows } from "../dbf/read-legacy-catalog.js";
import { readScheduleAppointments } from "../dbf/schedule-appointments.js";
import { readScheduleRooms } from "../dbf/schedule-rooms.js";

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

function firstQueryString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    const v0 = value[0];
    if (v0 === undefined || v0 === null) return undefined;
    return String(v0);
  }
  return String(value);
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

  router.get("/legacy/catalog", async (_req, res) => {
    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const dr = bridgeConfig.dataRoot;
    try {
      const tables = await readLegacyCatalogRows(dr);
      const body = { tables };
      LegacyCatalogResponseSchema.parse(body);
      res.json(body);
    } catch {
      sendError(res, 500, "LEGACY_CATALOG_ERROR", "failed to build legacy catalog");
    }
  });

  router.get("/patients/search", async (req, res) => {
    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const dr = bridgeConfig.dataRoot;

    const rawQ = firstQueryString(req.query.q);
    if (rawQ === undefined || rawQ === "") {
      sendError(res, 400, "INVALID_QUERY", "q is required");
      return;
    }

    const parsedQ = PatientSearchQueryParamsSchema.safeParse({ q: rawQ });
    if (!parsedQ.success) {
      sendError(res, 400, "INVALID_QUERY", "q must be at least 2 characters");
      return;
    }

    const outcome = await searchPatientsInDbf(dr, parsedQ.data.q);
    if (outcome.kind === "missing_table") {
      sendError(res, 404, "PATIENT_DBF_NOT_FOUND", "PATIENT.DBF not found under DATA_ROOT");
      return;
    }
    if (outcome.kind === "read_error") {
      sendError(res, 500, "PATIENT_SEARCH_ERROR", "patient search failed");
      return;
    }

    const body = { results: outcome.results };
    PatientSearchResponseSchema.parse(body);
    res.json(body);
  });

  router.get("/schedule/rooms", async (_req, res) => {
    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const dr = bridgeConfig.dataRoot;
    const outcome = await readScheduleRooms(dr);
    if (outcome.kind === "missing_sc_room") {
      sendError(res, 404, "SC_ROOM_DBF_NOT_FOUND", "SC_ROOM.DBF not found under DATA_ROOT");
      return;
    }
    if (outcome.kind === "read_error") {
      sendError(res, 500, "SCHEDULE_ROOMS_ERROR", "failed to read room configuration");
      return;
    }
    const body = { rooms: outcome.rooms };
    ScheduleRoomsResponseSchema.parse(body);
    res.json(body);
  });

  router.get("/schedule/appointments", async (req, res) => {
    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const dr = bridgeConfig.dataRoot;

    const rawFrom = firstQueryString(req.query.from);
    const rawTo = firstQueryString(req.query.to);
    const rawRoom = firstQueryString(req.query.room);
    if (rawFrom === undefined || rawFrom === "" || rawTo === undefined || rawTo === "") {
      sendError(res, 400, "INVALID_SCHEDULE_QUERY", "from and to are required (YYYY-MM-DD)");
      return;
    }

    const parsed = ScheduleAppointmentsQuerySchema.safeParse({
      from: rawFrom,
      to: rawTo,
      room: rawRoom,
    });
    if (!parsed.success) {
      sendError(res, 400, "INVALID_SCHEDULE_QUERY", "invalid dates, range, or room filter");
      return;
    }

    const { from, to, room } = parsed.data;
    const outcome = await readScheduleAppointments(dr, from, to, room);
    if (outcome.kind === "missing_schedule") {
      sendError(res, 404, "SCHEDULE_DBF_NOT_FOUND", "SCHEDULE.DBF not found under DATA_ROOT");
      return;
    }
    if (outcome.kind === "read_error") {
      sendError(res, 500, "SCHEDULE_APPOINTMENTS_ERROR", "failed to read appointments");
      return;
    }

    const body = { appointments: outcome.appointments };
    ScheduleAppointmentsResponseSchema.parse(body);
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
