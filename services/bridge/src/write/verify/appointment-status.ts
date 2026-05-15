import { parseDataRootFromValue, type DataRootSet } from "../../config.js";
import { PostWriteVerificationError } from "./post-write-error.js";
import { readScheduleAppointmentStatus } from "./read-appointment-status.js";

export type VerifyAppointmentStatusChangedInput = {
  /** Absolute DATA_ROOT path or configured {@link DataRootSet}. */
  dataRoot: string | DataRootSet;
  appointmentId: string;
  expectedStatus: number;
};

function resolveDataRoot(dataRoot: string | DataRootSet): DataRootSet {
  if (typeof dataRoot !== "string") {
    if (!dataRoot.configured) {
      throw new PostWriteVerificationError("DATA_ROOT_NOT_CONFIGURED", "dataRoot is not configured");
    }
    return dataRoot;
  }
  const parsed = parseDataRootFromValue(dataRoot);
  if (!parsed.configured) {
    throw new PostWriteVerificationError("DATA_ROOT_NOT_CONFIGURED", "dataRoot must be a non-empty absolute path");
  }
  return parsed;
}

/**
 * After a sandbox write, confirms the appointment row exists and `STATUS` equals `expectedStatus`.
 * Reads only `ID` and `STATUS`; error messages never include other field values.
 */
export async function verifyAppointmentStatusChanged(
  input: VerifyAppointmentStatusChangedInput,
): Promise<void> {
  const root = resolveDataRoot(input.dataRoot);
  const outcome = await readScheduleAppointmentStatus(root, input.appointmentId);

  switch (outcome.kind) {
    case "missing_schedule":
      throw new PostWriteVerificationError("SCHEDULE_DBF_MISSING", "SCHEDULE.DBF not found under dataRoot");
    case "read_error":
      throw new PostWriteVerificationError("SCHEDULE_READ_ERROR", "could not read SCHEDULE.DBF");
    case "not_found":
      throw new PostWriteVerificationError(
        "APPOINTMENT_NOT_FOUND",
        `appointment not found: id=${input.appointmentId}`,
      );
    case "ok":
      if (outcome.status !== input.expectedStatus) {
        throw new PostWriteVerificationError(
          "APPOINTMENT_STATUS_MISMATCH",
          `appointment status mismatch for id=${input.appointmentId}`,
        );
      }
      return;
  }
}
