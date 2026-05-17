import type { Response } from "express";
import { SafeWritePlanSchema } from "@microdent/contracts";
import type { PatientDemographicsUpdateBody } from "@microdent/contracts";
import type { DataRootSet } from "../config.js";
import { validatePatientDemographicsDryRun } from "./patient-demographics-commit.js";
import { tryValidateWritableSandbox } from "./write-route-guards.js";

export async function sendPatientDemographicsDryRunPlan(
  res: Response,
  input: {
    dataRoot: DataRootSet;
    patientId: string;
    body: PatientDemographicsUpdateBody;
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

  const result = await validatePatientDemographicsDryRun(
    input.dataRoot,
    input.patientId,
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
