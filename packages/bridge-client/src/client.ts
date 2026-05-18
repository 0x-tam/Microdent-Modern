import type { ZodType } from "zod";
import {
  ApiErrorBodySchema,
  HealthResponseSchema,
  LegacyCatalogResponseSchema,
  PatientAppointmentsQuerySchema,
  PatientProfilePathParamsSchema,
  PatientProfileResponseSchema,
  PatientMedicalSummaryResponseSchema,
  PatientTreatmentsResponseSchema,
  PatientChartResponseSchema,
  PatientLedgerResponseSchema,
  PatientSearchResponseSchema,
  ReferenceDoctorsResponseSchema,
  ScheduleAppointmentsResponseSchema,
  AppointmentStatusUpdateBodySchema,
  BridgeDevStatusResponseSchema,
  WriteCapabilityResponseSchema,
  SafeWritePlanSchema,
  ReferenceProceduresResponseSchema,
  ScheduleRoomsResponseSchema,
  TableRowsResponseSchema,
  TablesListResponseSchema,
  TableSchemaResponseSchema,
  MirrorStatusResponseSchema,
  WriteAuditRecentResponseSchema,
  type HealthResponse,
  type MirrorStatusResponse,
  type WriteAuditRecentResponse,
  type LegacyCatalogResponse,
  type PatientProfileResponse,
  type PatientMedicalSummaryResponse,
  type PatientTreatmentsResponse,
  type PatientChartResponse,
  type PatientLedgerResponse,
  type PatientSearchResponse,
  type ReferenceDoctorsResponse,
  type ScheduleAppointmentsResponse,
  type AppointmentStatusUpdateBody,
  type BridgeDevStatusResponse,
  type SafeWritePlan,
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

  /** Safe SQLite mirror metadata (no paths or row payloads). */
  async getMirrorStatus(): Promise<MirrorStatusResponse> {
    return this.requestJson("/v1/mirror/status", MirrorStatusResponseSchema);
  }

  /** Recent write-audit metadata only — no paths, payloads, or PHI (`GET /v1/meta/write-audit-recent`). */
  async getWriteAuditRecent(): Promise<WriteAuditRecentResponse> {
    return this.requestJson("/v1/meta/write-audit-recent", WriteAuditRecentResponseSchema);
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

  /**
   * Read-only medical screening summary (`MEDICAL.DBF` only). Booleans and dates only — no problem/allergy/notes text.
   */
  async getPatientMedicalSummary(patientId: string): Promise<PatientMedicalSummaryResponse> {
    const parsed = PatientProfilePathParamsSchema.safeParse({ patientId });
    if (!parsed.success) {
      throw new BridgeClientError("Invalid patient id", {
        kind: "invalid_argument",
      });
    }
    const id = parsed.data.patientId;
    return this.requestJson(
      `/v1/patients/${encodeURIComponent(id)}/medical-summary`,
      PatientMedicalSummaryResponseSchema,
    );
  }

  /**
   * Read-only procedure history from `OPERTBL.DBF` for one patient. Safe fields only — no memos, fees, or raw rows.
   */
  async getPatientTreatments(patientId: string): Promise<PatientTreatmentsResponse> {
    const parsed = PatientProfilePathParamsSchema.safeParse({ patientId });
    if (!parsed.success) {
      throw new BridgeClientError("Invalid patient id", {
        kind: "invalid_argument",
      });
    }
    const id = parsed.data.patientId;
    return this.requestJson(
      `/v1/patients/${encodeURIComponent(id)}/treatments`,
      PatientTreatmentsResponseSchema,
    );
  }

  /**
   * Read-only odontogram state from `CHARTDBF.DBF` for one patient. Safe fields only — no memos or layer legends.
   */
  async getPatientChart(patientId: string): Promise<PatientChartResponse> {
    const parsed = PatientProfilePathParamsSchema.safeParse({ patientId });
    if (!parsed.success) {
      throw new BridgeClientError("Invalid patient id", {
        kind: "invalid_argument",
      });
    }
    const id = parsed.data.patientId;
    return this.requestJson(
      `/v1/patients/${encodeURIComponent(id)}/chart`,
      PatientChartResponseSchema,
    );
  }

  /**
   * Read-only ledger lines from `TRANS.DBF` for one patient. Safe metadata only — no amounts, memos, or insurance ids.
   */
  async getPatientLedger(patientId: string): Promise<PatientLedgerResponse> {
    const parsed = PatientProfilePathParamsSchema.safeParse({ patientId });
    if (!parsed.success) {
      throw new BridgeClientError("Invalid patient id", {
        kind: "invalid_argument",
      });
    }
    const id = parsed.data.patientId;
    return this.requestJson(
      `/v1/patients/${encodeURIComponent(id)}/ledger`,
      PatientLedgerResponseSchema,
    );
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

  /** Non-production bridge diagnostics (`GET /debug/status`). */
  async getBridgeDevStatus(): Promise<BridgeDevStatusResponse> {
    return this.requestJson("/debug/status", BridgeDevStatusResponseSchema);
  }

  /** Safe write gates for pilot UI (`GET /v1/meta/write-capability`). */
  async getWriteCapability(): Promise<BridgeDevStatusResponse> {
    return this.requestJson("/v1/meta/write-capability", WriteCapabilityResponseSchema);
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
   * Rehearse `appointment.statusUpdate` without committing (requires bridge dry-run route).
   * Sends `X-Write-Intent: dry-run`; does not mutate local appointment state.
   */
  async dryRunAppointmentStatusUpdate(
    appointmentId: string,
    body: AppointmentStatusUpdateBody,
  ): Promise<SafeWritePlan> {
    return this.patchAppointmentStatusUpdate(appointmentId, body, "dry-run");
  }

  /**
   * Commit `appointment.statusUpdate` in sandbox (`X-Write-Intent: commit`).
   * Requires bridge `WRITE_MODE=enabled` with backup and sandbox gates.
   */
  async applyAppointmentStatusInSandbox(
    appointmentId: string,
    body: AppointmentStatusUpdateBody,
  ): Promise<SafeWritePlan> {
    return this.patchAppointmentStatusUpdate(appointmentId, body, "commit");
  }

  async patchAppointmentTimeMove(
    appointmentId: string,
    body: import("@microdent/contracts").AppointmentTimeMoveBody,
    intent: "dry-run" | "commit",
  ): Promise<SafeWritePlan> {
    const id = encodeURIComponent(appointmentId.trim());
    return this.requestJsonWithBody(`/v1/schedule/appointments/${id}/time`, SafeWritePlanSchema, {
      method: "PATCH",
      body,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Write-Intent": intent,
      },
    });
  }

  async postAppointmentCreate(
    body: import("@microdent/contracts").AppointmentCreateBody,
    intent: "dry-run" | "commit",
  ): Promise<SafeWritePlan> {
    return this.requestJsonWithBody("/v1/schedule/appointments", SafeWritePlanSchema, {
      method: "POST",
      body,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Write-Intent": intent,
      },
    });
  }

  async patchPatientDemographics(
    patientId: string,
    body: import("@microdent/contracts").PatientDemographicsUpdateBody,
    intent: "dry-run" | "commit",
  ): Promise<SafeWritePlan> {
    const id = encodeURIComponent(patientId.trim());
    return this.requestJsonWithBody(`/v1/patients/${id}/demographics`, SafeWritePlanSchema, {
      method: "PATCH",
      body,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Write-Intent": intent,
      },
    });
  }

  async patchAppointmentStatusUpdate(
    appointmentId: string,
    body: AppointmentStatusUpdateBody,
    intent: "dry-run" | "commit",
  ): Promise<SafeWritePlan> {
    const parsedBody = AppointmentStatusUpdateBodySchema.safeParse(body);
    if (!parsedBody.success) {
      throw new BridgeClientError("Invalid appointment status body", {
        kind: "invalid_argument",
      });
    }
    const id = encodeURIComponent(appointmentId.trim());
    if (id.length === 0) {
      throw new BridgeClientError("Invalid appointment id", { kind: "invalid_argument" });
    }
    return this.requestJsonWithBody(`/v1/schedule/appointments/${id}/status`, SafeWritePlanSchema, {
      method: "PATCH",
      body: parsedBody.data,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Write-Intent": intent,
      },
    });
  }

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
    return this.requestJsonWithBody(path, schema, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  }

  private async requestJsonWithBody<T>(
    path: string,
    schema: ZodType<T>,
    init: { method: string; body?: unknown; headers: Record<string, string> },
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: init.method,
        headers: init.headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
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
