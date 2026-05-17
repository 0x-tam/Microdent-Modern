import type { Response } from "express";
import { SafeWritePlanSchema } from "@microdent/contracts";
import type { AppointmentCreateBody } from "@microdent/contracts";
import type { DataRootSet } from "../config.js";
import { validateAppointmentCreateDryRun } from "./appointment-create-commit.js";
import { tryValidateWritableSandbox } from "./write-route-guards.js";

export async function sendAppointmentCreateDryRunPlan(
  res: Response,
  input: {
    dataRoot: DataRootSet;
    body: AppointmentCreateBody;
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

  const result = await validateAppointmentCreateDryRun(input.dataRoot, input.body);
  if (!result.ok) {
    const body = { error: { code: result.code, message: result.message } };
    res.status(result.httpStatus).json(body);
    return;
  }
  SafeWritePlanSchema.parse(result.plan);
  res.json(result.plan);
}
