import { existsSync } from "node:fs";
import { Router, type Response } from "express";
import {
  ApiErrorBodySchema,
  AppointmentStatusPathParamsSchema,
  AppointmentStatusUpdateBodySchema,
  AppointmentTimeMovePathParamsSchema,
  AppointmentTimeMoveBodySchema,
  AppointmentCreateBodySchema,
  PatientDemographicsPathParamsSchema,
  PatientDemographicsUpdateBodySchema,
  LegacyCatalogResponseSchema,
  SafeWritePlanSchema,
  PatientProfilePathParamsSchema,
  PatientProfileResponseSchema,
  PatientMedicalSummaryResponseSchema,
  PatientTreatmentsResponseSchema,
  PatientChartResponseSchema,
  PatientLedgerResponseSchema,
  PatientSearchQueryParamsSchema,
  PatientSearchResponseSchema,
  PatientAppointmentsQuerySchema,
  ReferenceDoctorsResponseSchema,
  ScheduleAppointmentsQuerySchema,
  ScheduleAppointmentsResponseSchema,
  ReferenceProceduresResponseSchema,
  ScheduleRoomsResponseSchema,
  MirrorStatusResponseSchema,
  WriteAuditRecentResponseSchema,
  BridgeDevStatusResponseSchema,
  TableRowsResponseSchema,
  TablesListResponseSchema,
  TableSchemaResponseSchema,
} from "@microdent/contracts";
import type { BridgeConfig } from "../config.js";
import { isWritableSandboxReady, writesPermitted } from "../config.js";
import { readPatientMedicalSummaryFromDbf } from "../dbf/patient-medical-summary.js";
import { readPatientTreatmentsFromDbf } from "../dbf/patient-treatments.js";
import { readPatientChartFromDbf } from "../dbf/patient-chart.js";
import { readPatientLedgerFromDbf } from "../dbf/patient-ledger.js";
import { readPatientProfileFromDbf } from "../dbf/patient-profile.js";
import { searchPatientsInDbf } from "../dbf/patient-search.js";
import { openRegisteredDbf, parsePagination, readRegisteredTableRows } from "../dbf/read-table.js";
import { resolveRegisteredDbfPath } from "../dbf/resolve-registered-dbf.js";
import { findRegistryEntry, TABLE_ID_PATTERN, TABLE_REGISTRY } from "../dbf/table-registry.js";
import { readLegacyCatalogRows } from "../dbf/read-legacy-catalog.js";
import { lookupScheduleAppointmentById } from "../dbf/schedule-appointments.js";
import { readScheduleAppointmentsForApi } from "../schedule-appointments-read.js";
import { commitAppointmentStatusUpdate } from "../write/appointment-status-commit.js";
import { sendAppointmentStatusDryRunPlan } from "../write/appointment-status-dry-run-handler.js";
import { commitAppointmentTimeMove } from "../write/appointment-time-move-commit.js";
import { sendAppointmentTimeMoveDryRunPlan } from "../write/appointment-time-move-dry-run-handler.js";
import { commitAppointmentCreate } from "../write/appointment-create-commit.js";
import { sendAppointmentCreateDryRunPlan } from "../write/appointment-create-dry-run-handler.js";
import { commitPatientDemographicsUpdate } from "../write/patient-demographics-commit.js";
import { sendPatientDemographicsDryRunPlan } from "../write/patient-demographics-dry-run-handler.js";
import { findBlockedScheduleBodyKeys } from "../write/reject-blocked-body-keys.js";
import { sendWriteModeDisabled } from "../write/write-route-guards.js";
import { parseWriteIntentHeader } from "../write/parse-write-intent.js";
import { readReferenceDoctorsFromDbf } from "../dbf/reference-doctors.js";
import { readReferenceProcedures } from "../dbf/reference-procedures.js";
import { readScheduleRoomsForApi } from "../schedule-rooms-read.js";
import { isSqliteMirrorUsable } from "../sqlite/mirror-usable.js";
import { readPatientProfileFromSqlite } from "../sqlite/patient-profile.js";
import { readPatientMedicalSummaryFromSqlite } from "../sqlite/patient-medical-summary.js";
import { searchPatientsInSqlite } from "../sqlite/patient-search.js";
import { readPatientTreatmentsFromSqlite } from "../sqlite/patient-treatments.js";
import { readReferenceDoctorsFromSqlite } from "../sqlite/reference-doctors.js";
import { readReferenceProceduresFromSqlite } from "../sqlite/reference-procedures.js";
import { readMirrorStatus } from "../sqlite/mirror-status.js";
import { readWriteAuditRecent } from "../sqlite/write-audit-recent.js";

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

  router.get("/mirror/status", (_req, res) => {
    const body = readMirrorStatus(bridgeConfig.sqlitePath);
    MirrorStatusResponseSchema.parse(body);
    res.json(body);
  });

  router.get("/meta/write-capability", (_req, res) => {
    const body = {
      writeMode: bridgeConfig.writeMode,
      writesPermitted: writesPermitted(bridgeConfig),
      writableSandbox: isWritableSandboxReady(bridgeConfig),
    };
    BridgeDevStatusResponseSchema.parse(body);
    res.json(body);
  });

  router.get("/meta/write-audit-recent", (_req, res) => {
    const body = readWriteAuditRecent(bridgeConfig.sqlitePath);
    WriteAuditRecentResponseSchema.parse(body);
    res.json(body);
  });

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

    let outcome;
    if (isSqliteMirrorUsable(bridgeConfig.sqlitePath, "patients")) {
      const sqliteOutcome = searchPatientsInSqlite(bridgeConfig.sqlitePath.path, parsedQ.data.q);
      outcome =
        sqliteOutcome.kind === "ok" ? sqliteOutcome : await searchPatientsInDbf(dr, parsedQ.data.q);
    } else {
      outcome = await searchPatientsInDbf(dr, parsedQ.data.q);
    }
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

  router.get("/patients/:patientId/profile", async (req, res) => {
    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const dr = bridgeConfig.dataRoot;

    const parsedParams = PatientProfilePathParamsSchema.safeParse({ patientId: req.params.patientId });
    if (!parsedParams.success) {
      sendError(res, 400, "INVALID_PATIENT_ID", "invalid patient id");
      return;
    }

    const patientId = parsedParams.data.patientId;
    let outcome;
    if (isSqliteMirrorUsable(bridgeConfig.sqlitePath, "patients")) {
      const sqliteOutcome = readPatientProfileFromSqlite(bridgeConfig.sqlitePath.path, patientId);
      if (sqliteOutcome.kind === "ok" || sqliteOutcome.kind === "not_found") {
        outcome = sqliteOutcome;
      } else {
        outcome = await readPatientProfileFromDbf(dr, patientId);
      }
    } else {
      outcome = await readPatientProfileFromDbf(dr, patientId);
    }
    if (outcome.kind === "missing_table") {
      sendError(res, 404, "PATIENT_DBF_NOT_FOUND", "PATIENT.DBF not found under DATA_ROOT");
      return;
    }
    if (outcome.kind === "read_error") {
      sendError(res, 500, "PATIENT_PROFILE_ERROR", "patient profile could not be read");
      return;
    }
    if (outcome.kind === "not_found") {
      sendError(res, 404, "PATIENT_NOT_FOUND", "patient not found");
      return;
    }

    const body = outcome.profile;
    PatientProfileResponseSchema.parse(body);
    res.json(body);
  });

  router.get("/patients/:patientId/medical-summary", async (req, res) => {
    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const dr = bridgeConfig.dataRoot;

    const parsedParams = PatientProfilePathParamsSchema.safeParse({ patientId: req.params.patientId });
    if (!parsedParams.success) {
      sendError(res, 400, "INVALID_PATIENT_ID", "invalid patient id");
      return;
    }

    const patientId = parsedParams.data.patientId;
    let outcome;
    if (isSqliteMirrorUsable(bridgeConfig.sqlitePath, "medical_summary")) {
      const sqliteOutcome = readPatientMedicalSummaryFromSqlite(bridgeConfig.sqlitePath.path, patientId);
      outcome =
        sqliteOutcome.kind === "ok" ? sqliteOutcome : await readPatientMedicalSummaryFromDbf(dr, patientId);
    } else {
      outcome = await readPatientMedicalSummaryFromDbf(dr, patientId);
    }
    if (outcome.kind === "missing_table") {
      sendError(res, 404, "MEDICAL_DBF_NOT_FOUND", "MEDICAL.DBF not found under DATA_ROOT");
      return;
    }
    if (outcome.kind === "read_error") {
      sendError(res, 500, "MEDICAL_SUMMARY_ERROR", "medical summary could not be read");
      return;
    }

    const body = outcome.summary;
    PatientMedicalSummaryResponseSchema.parse(body);
    res.json(body);
  });

  router.get("/patients/:patientId/treatments", async (req, res) => {
    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const dr = bridgeConfig.dataRoot;

    const parsedParams = PatientProfilePathParamsSchema.safeParse({ patientId: req.params.patientId });
    if (!parsedParams.success) {
      sendError(res, 400, "INVALID_PATIENT_ID", "invalid patient id");
      return;
    }

    let outcome;
    if (isSqliteMirrorUsable(bridgeConfig.sqlitePath, "treatments")) {
      const sqliteOutcome = readPatientTreatmentsFromSqlite(
        bridgeConfig.sqlitePath.path,
        parsedParams.data.patientId,
      );
      outcome =
        sqliteOutcome.kind === "ok"
          ? sqliteOutcome
          : await readPatientTreatmentsFromDbf(dr, parsedParams.data.patientId);
    } else {
      outcome = await readPatientTreatmentsFromDbf(dr, parsedParams.data.patientId);
    }
    if (outcome.kind === "missing_table") {
      sendError(res, 404, "OPERTBL_DBF_NOT_FOUND", "OPERTBL.DBF not found under DATA_ROOT");
      return;
    }
    if (outcome.kind === "read_error") {
      sendError(res, 500, "PATIENT_TREATMENTS_ERROR", "treatments could not be read");
      return;
    }

    const body = outcome.body;
    PatientTreatmentsResponseSchema.parse(body);
    res.json(body);
  });

  router.get("/patients/:patientId/chart", async (req, res) => {
    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const dr = bridgeConfig.dataRoot;

    const parsedParams = PatientProfilePathParamsSchema.safeParse({ patientId: req.params.patientId });
    if (!parsedParams.success) {
      sendError(res, 400, "INVALID_PATIENT_ID", "invalid patient id");
      return;
    }

    const outcome = await readPatientChartFromDbf(dr, parsedParams.data.patientId);
    if (outcome.kind === "missing_table") {
      sendError(res, 404, "CHARTDBF_NOT_FOUND", "CHARTDBF.DBF not found under DATA_ROOT");
      return;
    }
    if (outcome.kind === "read_error") {
      sendError(res, 500, "PATIENT_CHART_ERROR", "chart could not be read");
      return;
    }

    const body = outcome.body;
    PatientChartResponseSchema.parse(body);
    res.json(body);
  });

  router.get("/patients/:patientId/ledger", async (req, res) => {
    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const dr = bridgeConfig.dataRoot;

    const parsedParams = PatientProfilePathParamsSchema.safeParse({ patientId: req.params.patientId });
    if (!parsedParams.success) {
      sendError(res, 400, "INVALID_PATIENT_ID", "invalid patient id");
      return;
    }

    const outcome = await readPatientLedgerFromDbf(dr, parsedParams.data.patientId);
    if (outcome.kind === "missing_table") {
      sendError(res, 404, "TRANS_DBF_NOT_FOUND", "TRANS.DBF not found under DATA_ROOT");
      return;
    }
    if (outcome.kind === "read_error") {
      sendError(res, 500, "PATIENT_LEDGER_ERROR", "patient ledger could not be read");
      return;
    }

    const body = outcome.body;
    PatientLedgerResponseSchema.parse(body);
    res.json(body);
  });

  router.get("/patients/:patientId/appointments", async (req, res) => {
    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;

    const parsedParams = PatientProfilePathParamsSchema.safeParse({ patientId: req.params.patientId });
    if (!parsedParams.success) {
      sendError(res, 400, "INVALID_PATIENT_ID", "invalid patient id");
      return;
    }

    const rawFrom = firstQueryString(req.query.from);
    const rawTo = firstQueryString(req.query.to);
    if (rawFrom === undefined || rawFrom === "" || rawTo === undefined || rawTo === "") {
      sendError(res, 400, "INVALID_PATIENT_APPOINTMENTS_QUERY", "from and to are required (YYYY-MM-DD)");
      return;
    }

    const parsed = PatientAppointmentsQuerySchema.safeParse({ from: rawFrom, to: rawTo });
    if (!parsed.success) {
      sendError(res, 400, "INVALID_PATIENT_APPOINTMENTS_QUERY", "invalid dates or range");
      return;
    }

    const { from, to } = parsed.data;
    const patientId = parsedParams.data.patientId;
    const outcome = await readScheduleAppointmentsForApi(bridgeConfig, from, to, undefined, patientId);
    if (outcome.kind === "missing_schedule") {
      sendError(res, 404, "SCHEDULE_DBF_NOT_FOUND", "SCHEDULE.DBF not found under DATA_ROOT");
      return;
    }
    if (outcome.kind === "read_error") {
      sendError(res, 500, "PATIENT_APPOINTMENTS_ERROR", "failed to read appointments");
      return;
    }

    const body = { appointments: outcome.appointments };
    ScheduleAppointmentsResponseSchema.parse(body);
    res.json(body);
  });

  router.get("/reference/procedures", async (_req, res) => {
    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const dr = bridgeConfig.dataRoot;
    let outcome;
    if (isSqliteMirrorUsable(bridgeConfig.sqlitePath, "procedures")) {
      const sqliteOutcome = readReferenceProceduresFromSqlite(bridgeConfig.sqlitePath.path);
      outcome =
        sqliteOutcome.kind === "ok" ? sqliteOutcome : await readReferenceProcedures(dr);
    } else {
      outcome = await readReferenceProcedures(dr);
    }
    if (outcome.kind === "missing_procchrt") {
      sendError(res, 404, "PROCCHRT_DBF_NOT_FOUND", "PROCCHRT.DBF not found under DATA_ROOT");
      return;
    }
    if (outcome.kind === "read_error") {
      sendError(res, 500, "REFERENCE_PROCEDURES_ERROR", "failed to read procedure reference");
      return;
    }
    const body = { procedures: outcome.procedures };
    ReferenceProceduresResponseSchema.parse(body);
    res.json(body);
  });

  router.get("/reference/doctors", async (_req, res) => {
    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const dr = bridgeConfig.dataRoot;
    let outcome;
    if (isSqliteMirrorUsable(bridgeConfig.sqlitePath, "doctors")) {
      const sqliteOutcome = readReferenceDoctorsFromSqlite(bridgeConfig.sqlitePath.path);
      outcome =
        sqliteOutcome.kind === "ok" ? sqliteOutcome : await readReferenceDoctorsFromDbf(dr);
    } else {
      outcome = await readReferenceDoctorsFromDbf(dr);
    }
    if (outcome.kind === "missing_table") {
      sendError(res, 404, "DOCTORS_DBF_NOT_FOUND", "DOCTORS.DBF not found under DATA_ROOT");
      return;
    }
    if (outcome.kind === "read_error") {
      sendError(res, 500, "REFERENCE_DOCTORS_ERROR", "failed to read doctors reference");
      return;
    }
    const body = { doctors: outcome.doctors };
    ReferenceDoctorsResponseSchema.parse(body);
    res.json(body);
  });

  router.get("/schedule/rooms", async (_req, res) => {
    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const outcome = await readScheduleRoomsForApi(bridgeConfig);
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
    const outcome = await readScheduleAppointmentsForApi(bridgeConfig, from, to, room);
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

  router.patch("/schedule/appointments/:appointmentId/status", async (req, res) => {
    if (bridgeConfig.writeMode === "disabled") {
      sendError(res, 403, "WRITE_MODE_DISABLED", "WRITE_MODE is disabled");
      return;
    }

    const pathParsed = AppointmentStatusPathParamsSchema.safeParse({
      appointmentId: req.params.appointmentId,
    });
    if (!pathParsed.success) {
      sendError(res, 400, "INVALID_APPOINTMENT_ID", "appointmentId must be a positive integer without leading zeros");
      return;
    }

    const bodyParsed = AppointmentStatusUpdateBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      const statusIssue = bodyParsed.error.issues.find((i) => i.path[0] === "status");
      if (statusIssue) {
        sendError(res, 400, "INVALID_APPOINTMENT_STATUS", "status must be an integer from 0 to 5");
        return;
      }
      sendError(res, 400, "INVALID_REQUEST_BODY", "request body must be { status: number }");
      return;
    }

    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const dr = bridgeConfig.dataRoot;
    const { appointmentId } = pathParsed.data;

    const lookup = await lookupScheduleAppointmentById(dr, appointmentId);
    if (lookup.kind === "missing_schedule") {
      sendError(res, 404, "SCHEDULE_DBF_NOT_FOUND", "SCHEDULE.DBF not found under DATA_ROOT");
      return;
    }
    if (lookup.kind === "read_error") {
      sendError(res, 500, "SCHEDULE_APPOINTMENTS_ERROR", "failed to read appointments");
      return;
    }
    if (lookup.kind === "not_found") {
      sendError(res, 404, "SCHEDULE_APPOINTMENT_NOT_FOUND", "appointment not found");
      return;
    }

    const allowLegacyWrites = process.env.ALLOW_LEGACY_WRITES;

    const writeIntent = parseWriteIntentHeader(req.headers["x-write-intent"]);

    if (bridgeConfig.writeMode === "dry-run" || writeIntent === "dry-run") {
      sendAppointmentStatusDryRunPlan(res, {
        dataRoot: dr,
        appointmentId,
        allowLegacyWritesValue: allowLegacyWrites,
      });
      return;
    }

    const commit = await commitAppointmentStatusUpdate({
      bridgeConfig,
      dataRoot: dr,
      appointmentId,
      status: bodyParsed.data.status,
      allowLegacyWritesValue: allowLegacyWrites,
    });
    if (!commit.ok) {
      sendError(res, commit.httpStatus, commit.code, commit.message);
      return;
    }
    SafeWritePlanSchema.parse(commit.plan);
    res.json(commit.plan);
  });

  router.patch("/schedule/appointments/:appointmentId/time", async (req, res) => {
    if (bridgeConfig.writeMode === "disabled") {
      sendWriteModeDisabled(res);
      return;
    }

    const pathParsed = AppointmentTimeMovePathParamsSchema.safeParse({
      appointmentId: req.params.appointmentId,
    });
    if (!pathParsed.success) {
      sendError(res, 400, "INVALID_APPOINTMENT_ID", "appointmentId must be a positive integer without leading zeros");
      return;
    }

    const blocked = findBlockedScheduleBodyKeys(req.body);
    if (blocked.length > 0) {
      sendError(res, 400, "BLOCKED_SCHEDULE_FIELD", "request contains blocked schedule fields");
      return;
    }

    const bodyParsed = AppointmentTimeMoveBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      sendError(res, 400, "INVALID_REQUEST_BODY", "invalid appointment time move body");
      return;
    }

    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const dr = bridgeConfig.dataRoot;
    const { appointmentId } = pathParsed.data;
    const allowLegacyWrites = process.env.ALLOW_LEGACY_WRITES;
    const writeIntent = parseWriteIntentHeader(req.headers["x-write-intent"]);

    if (bridgeConfig.writeMode === "dry-run" || writeIntent === "dry-run") {
      await sendAppointmentTimeMoveDryRunPlan(res, {
        dataRoot: dr,
        appointmentId,
        body: bodyParsed.data,
        allowLegacyWritesValue: allowLegacyWrites,
      });
      return;
    }

    const commit = await commitAppointmentTimeMove({
      bridgeConfig,
      dataRoot: dr,
      appointmentId,
      body: bodyParsed.data,
      allowLegacyWritesValue: allowLegacyWrites,
    });
    if (!commit.ok) {
      sendError(res, commit.httpStatus, commit.code, commit.message);
      return;
    }
    SafeWritePlanSchema.parse(commit.plan);
    res.json(commit.plan);
  });

  router.post("/schedule/appointments", async (req, res) => {
    if (bridgeConfig.writeMode === "disabled") {
      sendWriteModeDisabled(res);
      return;
    }

    const blocked = findBlockedScheduleBodyKeys(req.body);
    if (blocked.length > 0) {
      sendError(res, 400, "BLOCKED_SCHEDULE_FIELD", "request contains blocked schedule fields");
      return;
    }

    const bodyParsed = AppointmentCreateBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      sendError(res, 400, "INVALID_REQUEST_BODY", "invalid appointment create body");
      return;
    }

    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const dr = bridgeConfig.dataRoot;
    const allowLegacyWrites = process.env.ALLOW_LEGACY_WRITES;
    const writeIntent = parseWriteIntentHeader(req.headers["x-write-intent"]);

    if (bridgeConfig.writeMode === "dry-run" || writeIntent === "dry-run") {
      await sendAppointmentCreateDryRunPlan(res, {
        dataRoot: dr,
        body: bodyParsed.data,
        allowLegacyWritesValue: allowLegacyWrites,
      });
      return;
    }

    const commit = await commitAppointmentCreate({
      bridgeConfig,
      dataRoot: dr,
      body: bodyParsed.data,
      allowLegacyWritesValue: allowLegacyWrites,
    });
    if (!commit.ok) {
      sendError(res, commit.httpStatus, commit.code, commit.message);
      return;
    }
    SafeWritePlanSchema.parse(commit.plan);
    res.json(commit.plan);
  });

  router.patch("/patients/:patientId/demographics", async (req, res) => {
    if (bridgeConfig.writeMode === "disabled") {
      sendWriteModeDisabled(res);
      return;
    }

    const pathParsed = PatientDemographicsPathParamsSchema.safeParse({
      patientId: req.params.patientId,
    });
    if (!pathParsed.success) {
      sendError(res, 400, "INVALID_PATIENT_ID", "patientId must be a positive integer without leading zeros");
      return;
    }

    const bodyParsed = PatientDemographicsUpdateBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      sendError(res, 400, "INVALID_REQUEST_BODY", "invalid patient demographics body");
      return;
    }

    if (!requireConfiguredDataRoot(res, bridgeConfig)) return;
    const dr = bridgeConfig.dataRoot;
    const { patientId } = pathParsed.data;
    const allowLegacyWrites = process.env.ALLOW_LEGACY_WRITES;
    const writeIntent = parseWriteIntentHeader(req.headers["x-write-intent"]);

    if (bridgeConfig.writeMode === "dry-run" || writeIntent === "dry-run") {
      await sendPatientDemographicsDryRunPlan(res, {
        dataRoot: dr,
        patientId,
        body: bodyParsed.data,
        allowLegacyWritesValue: allowLegacyWrites,
      });
      return;
    }

    const commit = await commitPatientDemographicsUpdate({
      bridgeConfig,
      dataRoot: dr,
      patientId,
      body: bodyParsed.data,
      allowLegacyWritesValue: allowLegacyWrites,
    });
    if (!commit.ok) {
      sendError(res, commit.httpStatus, commit.code, commit.message);
      return;
    }
    SafeWritePlanSchema.parse(commit.plan);
    res.json(commit.plan);
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
