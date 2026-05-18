/**
 * PHI-safe DBF readback for sandbox QA smoke.
 * Writes mutate SCHEDULE.DBF / PATIENT.DBF directly; the SQLite mirror is not refreshed on commit.
 * Use this CLI to verify write targets — not sqlite mirror tables.
 */
import { parseDataRootFromValue } from "../config.js";
import { readScheduleRowInternal } from "../dbf/read-schedule-row-internal.js";
import { readPatientProfileFromDbf } from "../dbf/patient-profile.js";
import { normalizeScheduleTimeHm } from "../schedule/schedule-time-utils.js";
import { readScheduleAppointmentStatus } from "../write/verify/read-appointment-status.js";

function usage(): void {
  console.error("Usage: DATA_ROOT=... node qa-sandbox-readback.js <command> <id>");
  console.error("  schedule-status <appointmentId>  — prints numeric STATUS only");
  console.error("  schedule-slot <appointmentId>    — prints date|HH:MM|room (no PHI)");
  console.error("  schedule-exists <appointmentId> — prints ok or not_found");
  console.error("  patient-chart <patientId>       — prints chart/case number only");
}

async function main(): Promise<void> {
  const command = process.argv[2]?.trim();
  const id = process.argv[3]?.trim();
  if (!command || !id) {
    usage();
    process.exit(2);
  }

  const dataRoot = parseDataRootFromValue(process.env.DATA_ROOT);
  if (!dataRoot.configured) {
    console.error("ERROR: DATA_ROOT required");
    process.exit(2);
  }

  if (command === "schedule-status") {
    const outcome = await readScheduleAppointmentStatus(dataRoot, id);
    if (outcome.kind !== "ok") {
      console.error(`ERROR: schedule-status ${outcome.kind}`);
      process.exit(1);
    }
    process.stdout.write(String(outcome.status));
    return;
  }

  if (command === "schedule-slot") {
    const outcome = await readScheduleRowInternal(dataRoot, id);
    if (outcome.kind !== "ok") {
      console.error(`ERROR: schedule-slot ${outcome.kind}`);
      process.exit(1);
    }
    const hm = normalizeScheduleTimeHm(outcome.row.time) ?? outcome.row.time.trim();
    process.stdout.write(`${outcome.row.date}|${hm}|${outcome.row.room}`);
    return;
  }

  if (command === "schedule-exists") {
    const outcome = await readScheduleRowInternal(dataRoot, id);
    if (outcome.kind === "ok") {
      process.stdout.write("ok");
      return;
    }
    if (outcome.kind === "not_found") {
      process.stdout.write("not_found");
      process.exit(1);
    }
    console.error(`ERROR: schedule-exists ${outcome.kind}`);
    process.exit(1);
  }

  if (command === "patient-chart") {
    const outcome = await readPatientProfileFromDbf(dataRoot, id);
    if (outcome.kind !== "ok") {
      console.error(`ERROR: patient-chart ${outcome.kind}`);
      process.exit(1);
    }
    const chart = outcome.profile.chartNumber?.trim() ?? "";
    process.stdout.write(chart.length > 0 ? chart : "");
    return;
  }

  usage();
  process.exit(2);
}

main().catch(() => {
  console.error("ERROR: readback failed");
  process.exit(1);
});
