import type { ZodType } from "zod";
import {
  ApiErrorBodySchema,
  HealthResponseSchema,
  LegacyCatalogResponseSchema,
  PatientAppointmentsQuerySchema,
  PatientProfilePathParamsSchema,
  PatientProfileResponseSchema,
  PatientSearchResponseSchema,
  ReferenceDoctorsResponseSchema,
  ScheduleAppointmentsResponseSchema,
  ReferenceProceduresResponseSchema,
  ScheduleRoomsResponseSchema,
  TableRowsResponseSchema,
  TablesListResponseSchema,
  TableSchemaResponseSchema,
  type HealthResponse,
  type LegacyCatalogResponse,
  type PatientProfileResponse,
  type PatientSearchResponse,
  type ReferenceDoctorsResponse,
  type ScheduleAppointmentsResponse,
  type ReferenceProceduresResponse,
  type ScheduleRoomsResponse,
  type TableRowsResponse,
  type TablesListResponse,
  type TableSchemaResponse,
} from "@microdent/contracts";
import { BridgeClientError } from "./errors.js";
import { logResponseSchemaMismatch } from "./schema-mismatch-log.js";

/** Same rule as the bridge: logical ids only, no path segments. */
const TABLE_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

export type BridgeClientOptions = {
  /** Bridge base URL, e.g. `http://127.0.0.1:17890` (no trailing slash required). */
  baseUrl: string;
  /** Optional fetch implementation (tests inject a mock). */
  fetch?: typeof fetch;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function assertTableId(tableId: string): void {
  if (!TABLE_ID_PATTERN.test(tableId)) {
    throw new BridgeClientError("Invalid table id format", {
      kind: "invalid_argument",
    });
  }
}

/** Browsers require `fetch` to be called with `this === window` (or `globalThis`); storing a bare reference causes "Illegal invocation". */
function defaultBoundFetch(): typeof fetch {
  return globalThis.fetch.bind(globalThis);
}

export class BridgeClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: BridgeClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.fetchImpl = options.fetch ?? defaultBoundFetch();
  }

  async getHealth(): Promise<HealthResponse> {
    return this.requestJson("/health", HealthResponseSchema);
  }

  async getMetaTables(): Promise<TablesListResponse> {
    return this.requestJson("/v1/meta/tables", TablesListResponseSchema);
  }

  async getLegacyCatalog(): Promise<LegacyCatalogResponse> {
    return this.requestJson("/v1/legacy/catalog", LegacyCatalogResponseSchema);
  }

  /**
   * Read-only patient search against `PATIENT.DBF` under the bridge `DATA_ROOT`.
   * `query` must be at least 2 non-space characters (validated client- and server-side).
   */
  async searchPatients(query: string): Promise<PatientSearchResponse> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      throw new BridgeClientError("Patient search query must be at least 2 characters", {
        kind: "invalid_argument",
      });
    }
    const qs = new URLSearchParams({ q: trimmed });
    return this.requestJson(
      `/v1/patients/search?${qs.toString()}`,
      PatientSearchResponseSchema as ZodType<PatientSearchResponse>,
    );
  }

  /**
   * Read-only patient profile (`PATIENT.DBF` only). `patientId` must match search ids (positive integer, no leading zeros).
   */
  async getPatientProfile(patientId: string): Promise<PatientProfileResponse> {
    const parsed = PatientProfilePathParamsSchema.safeParse({ patientId });
    if (!parsed.success) {
      throw new BridgeClientError("Invalid patient id", {
        kind: "invalid_argument",
      });
    }
    const id = parsed.data.patientId;
    return this.requestJson(`/v1/patients/${encodeURIComponent(id)}/profile`, PatientProfileResponseSchema);
  }

  async getReferenceProcedures(): Promise<ReferenceProceduresResponse> {
    return this.requestJson("/v1/reference/procedures", ReferenceProceduresResponseSchema);
  }

  /**
   * Read-only provider directory from `DOCTORS.DBF` (`doctorId`, `displayName`, optional `active` only).
   */
  async getReferenceDoctors(): Promise<ReferenceDoctorsResponse> {
    return this.requestJson("/v1/reference/doctors", ReferenceDoctorsResponseSchema);
  }

  async getScheduleRooms(): Promise<ScheduleRoomsResponse> {
    return this.requestJson("/v1/schedule/rooms", ScheduleRoomsResponseSchema);
  }

  async getScheduleAppointments(params: { from: string; to: string; room?: number }): Promise<ScheduleAppointmentsResponse> {
    const q = new URLSearchParams({ from: params.from, to: params.to });
    if (params.room !== undefined) {
      q.set("room", String(params.room));
    }
    return this.requestJson(
      `/v1/schedule/appointments?${q.toString()}`,
      ScheduleAppointmentsResponseSchema as ZodType<ScheduleAppointmentsResponse>,
    );
  }

  /**
   * Read-only appointment history for one patient from `SCHEDULE.DBF` (same safe DTO as schedule view).
   * `patientId` matches profile/search ids; `from`/`to` may span up to 365 calendar days inclusive.
   */
  async getPatientAppointments(
    patientId: string,
    params: { from: string; to: string },
  ): Promise<ScheduleAppointmentsResponse> {
    const parsedId = PatientProfilePathParamsSchema.safeParse({ patientId });
    if (!parsedId.success) {
      throw new BridgeClientError("Invalid patient id", {
        kind: "invalid_argument",
      });
    }
    const parsedRange = PatientAppointmentsQuerySchema.safeParse(params);
    if (!parsedRange.success) {
      throw new BridgeClientError("Invalid appointment date range", {
        kind: "invalid_argument",
      });
    }
    const id = parsedId.data.patientId;
    const q = new URLSearchParams({ from: parsedRange.data.from, to: parsedRange.data.to });
    return this.requestJson(
      `/v1/patients/${encodeURIComponent(id)}/appointments?${q.toString()}`,
      ScheduleAppointmentsResponseSchema as ZodType<ScheduleAppointmentsResponse>,
    );
  }

  async getTableSchema(tableId: string): Promise<TableSchemaResponse> {
    assertTableId(tableId);
    return this.requestJson(`/v1/tables/${encodeURIComponent(tableId)}/schema`, TableSchemaResponseSchema);
  }

  async getTableRows(
    tableId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<TableRowsResponse> {
    assertTableId(tableId);
    const q = new URLSearchParams();
    if (params?.limit !== undefined) {
      q.set("limit", String(params.limit));
    }
    if (params?.offset !== undefined) {
      q.set("offset", String(params.offset));
    }
    const qs = q.toString();
    const path = `/v1/tables/${encodeURIComponent(tableId)}/rows${qs ? `?${qs}` : ""}`;
    return this.requestJson(path, TableRowsResponseSchema);
  }

  private async requestJson<T>(path: string, schema: ZodType<T>): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
    } catch (cause) {
      throw new BridgeClientError("Network request failed", { kind: "network", cause });
    }

    const text = await res.text();
    let json: unknown;
    try {
      json = text.length === 0 ? null : JSON.parse(text);
    } catch {
      throw new BridgeClientError("Response body is not valid JSON", {
        kind: "invalid_body",
        status: res.status,
      });
    }

    if (!res.ok) {
      const api = ApiErrorBodySchema.safeParse(json);
      if (api.success) {
        throw BridgeClientError.fromApiErrorBody(res.status, api.data);
      }
      throw new BridgeClientError(`HTTP ${res.status}`, { kind: "http", status: res.status });
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      logResponseSchemaMismatch(path, json, parsed.error);
      throw new BridgeClientError("Response body failed schema validation", {
        kind: "invalid_body",
        status: res.status,
        cause: parsed.error,
      });
    }
    return parsed.data;
  }
}

export function createBridgeClient(options: BridgeClientOptions): BridgeClient {
  return new BridgeClient(options);
}
