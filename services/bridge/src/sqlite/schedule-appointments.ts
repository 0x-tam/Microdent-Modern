import type {
  ScheduleAppointmentItem,
  ScheduleAppointmentPatientSummary,
} from "@microdent/contracts";
import { SCHEDULE_APPOINTMENTS_MAX, type ScheduleAppointmentsOutcome } from "../dbf/schedule-appointments.js";
import { openDatabaseSync } from "./node-sqlite.js";

type AppointmentSqlRow = {
  appointment_id: string;
  appointment_date: string;
  start_time: string | null;
  duration_slots: number | null;
  period_minutes: number | null;
  room_id: string | null;
  status_code: string | null;
  doctor_id: string | null;
  patient_id: string | null;
  proc_class: number | null;
  vac_id: number | null;
  recall: number | null;
  unreason: number | null;
  missed: number | null;
  has_comment: number | null;
  join_patient_id: string | null;
  patient_display_name: string | null;
  patient_chart_number: string | null;
};

function sqliteInt(value: unknown, def = 0): number {
  if (value === null || value === undefined) return def;
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function sqliteBool(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  return sqliteInt(value) !== 0;
}

function patIdFromSqlite(patientId: string | null): string {
  if (patientId === null || patientId === undefined) return "0";
  const s = String(patientId).trim();
  return s.length > 0 ? s : "0";
}

function patientSummaryFromJoin(row: AppointmentSqlRow, patId: string): ScheduleAppointmentPatientSummary | null {
  if (patId === "0") return null;
  const displayName = row.patient_display_name?.trim() ?? "";
  if (displayName.length === 0 || row.join_patient_id === null) return null;
  const chartRaw = row.patient_chart_number?.trim() ?? "";
  return {
    patientId: String(row.join_patient_id),
    displayName,
    chartNumber: chartRaw.length > 0 ? chartRaw : null,
  };
}

function mapSqliteRowToAppointment(row: AppointmentSqlRow): ScheduleAppointmentItem {
  const patId = patIdFromSqlite(row.patient_id);
  const period = row.period_minutes;
  return {
    id: String(row.appointment_id),
    date: row.appointment_date,
    time: row.start_time?.trim() ?? "",
    durationSlots: sqliteInt(row.duration_slots),
    periodMinutes: period !== null && period !== undefined && sqliteInt(period) > 0 ? sqliteInt(period) : null,
    room: sqliteInt(row.room_id),
    status: sqliteInt(row.status_code),
    docId: sqliteInt(row.doctor_id),
    patId,
    patient: patientSummaryFromJoin(row, patId),
    procClass: sqliteInt(row.proc_class),
    vacId: sqliteInt(row.vac_id),
    recall: sqliteInt(row.recall),
    unreason: sqliteInt(row.unreason),
    missed: sqliteBool(row.missed),
    hasComment: sqliteBool(row.has_comment),
  };
}

/**
 * Read schedule appointments from mirror `appointments`, with safe patient summaries via
 * `LEFT JOIN patients`. Never returns raw SQL rows or blocked schedule fields on the wire.
 */
export function readScheduleAppointmentsFromSqlite(
  sqlitePath: string,
  fromIso: string,
  toIso: string,
  roomFilter?: number,
  patientIdFilter?: string,
): ScheduleAppointmentsOutcome {
  const conditions = [
    "COALESCE(a.source_deleted, 0) = 0",
    "a.appointment_date >= ?",
    "a.appointment_date <= ?",
  ];
  const params: (string | number)[] = [fromIso, toIso];

  if (roomFilter !== undefined) {
    conditions.push("CAST(a.room_id AS INTEGER) = ?");
    params.push(roomFilter);
  }
  if (patientIdFilter !== undefined) {
    conditions.push("a.patient_id = ?");
    params.push(patientIdFilter);
  }

  const sql = `SELECT
      a.appointment_id,
      a.appointment_date,
      a.start_time,
      a.duration_slots,
      a.period_minutes,
      a.room_id,
      a.status_code,
      a.doctor_id,
      a.patient_id,
      a.proc_class,
      a.vac_id,
      a.recall,
      a.unreason,
      a.missed,
      a.has_comment,
      p.patient_id AS join_patient_id,
      p.display_name AS patient_display_name,
      p.chart_number AS patient_chart_number
    FROM appointments a
    LEFT JOIN patients p
      ON p.patient_id = a.patient_id AND COALESCE(p.source_deleted, 0) = 0
    WHERE ${conditions.join(" AND ")}
    ORDER BY a.appointment_date, a.start_time, a.appointment_id
    LIMIT ?`;

  params.push(SCHEDULE_APPOINTMENTS_MAX);

  try {
    const db = openDatabaseSync(sqlitePath, { readOnly: true });
    try {
      const rows = db.prepare(sql).all(...params) as AppointmentSqlRow[];
      const appointments = rows.map(mapSqliteRowToAppointment);
      return { kind: "ok", appointments };
    } finally {
      db.close();
    }
  } catch {
    return { kind: "read_error" };
  }
}
