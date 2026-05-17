import type { Response } from "express";
import { SafeWritePlanSchema } from "@microdent/contracts";
import type { AppointmentTimeMoveBody } from "@microdent/contracts";
import type { DataRootSet } from "../config.js";
import { validateAppointmentTimeMoveDryRun } from "./appointment-time-move-commit.js";
import { tryValidateWritableSandbox } from "./write-route-guards.js";

export async function sendAppointmentTimeMoveDryRunPlan(
  res: Response,
  input: {
    dataRoot: DataRootSet;
    appointmentId: string;
    body: AppointmentTimeMoveBody;
    allowLegacyWritesValue: string | undefined;
  },
): Promise<void> {
  if (
    !tryValidateWritableSandbox(res, {
      dataRoot: input.dataRoot,
      writeMode: "dry-run",
      allowLegacyWritesValue: input.allowLegacyWritesValue,
    })
  ) {
    return;
  }

  const result = await validateAppointmentTimeMoveDryRun(
    input.dataRoot,
    input.appointmentId,
    input.body,
  );
  if (!result.ok) {
    const body = { error: { code: result.code, message: result.message } };
    res.status(result.httpStatus).json(body);
    return;
  }
  SafeWritePlanSchema.parse(result.plan);
  res.json(result.plan);
}
