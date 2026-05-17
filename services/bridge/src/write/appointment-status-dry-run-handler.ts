import type { Response } from "express";
import { ApiErrorBodySchema, SafeWritePlanSchema } from "@microdent/contracts";
import type { DataRootSet } from "../config.js";
import { httpStatusForWriteSandboxError } from "./map-write-sandbox-error.js";
import { validateWritableSandbox, WriteSandboxError } from "../write-safety/index.js";
import { buildAppointmentStatusUpdatePlan } from "./appointment-status-plan.js";

export function sendAppointmentStatusDryRunPlan(
  res: Response,
  input: {
    dataRoot: DataRootSet;
    appointmentId: string;
    allowLegacyWritesValue: string | undefined;
  },
): void {
  try {
    validateWritableSandbox({
      dataRoot: input.dataRoot.path,
      writeMode: "dry-run",
      allowLegacyWritesValue: input.allowLegacyWritesValue,
    });
  } catch (err) {
    if (err instanceof WriteSandboxError) {
      const body = { error: { code: err.code, message: err.message } };
      ApiErrorBodySchema.parse(body);
      res.status(httpStatusForWriteSandboxError(err.code)).json(body);
      return;
    }
    throw err;
  }
  const plan = buildAppointmentStatusUpdatePlan({
    appointmentId: input.appointmentId,
    writeMode: "dry-run",
  });
  SafeWritePlanSchema.parse(plan);
  res.json(plan);
}
