import type { PatientDemographicsUpdateBody, PatientProfileResponse } from "@microdent/contracts";
import { PatientDemographicsUpdateBodySchema } from "@microdent/contracts";

export const PATIENT_DEMOGRAPHICS_WRITE_CONFIRM =
  "Update patient demographics in the disposable sandbox? A backup runs first. Only use on test data you can restore.";

export function patientDemographicsWriteUnavailableMessage(status?: number): string {
  if (status === 403) {
    return "Sandbox writes are not enabled on this bridge.";
  }
  if (status === 503) {
    return "Write backup is not configured on this bridge.";
  }
  if (status === 404) {
    return "Demographics route is not available on this bridge yet.";
  }
  return "Demographics update failed. Check bridge configuration.";
}

export type PatientDemographicsFormState = {
  firstName: string;
  lastName: string;
  displayName: string;
  reverseName: string;
  chartNumber: string;
  active: "" | "true" | "false";
  doctorId: string;
};

export function profileToDemographicsForm(profile: PatientProfileResponse): PatientDemographicsFormState {
  return {
    firstName: "",
    lastName: "",
    displayName: profile.displayName,
    reverseName: profile.reverseName ?? "",
    chartNumber: profile.chartNumber ?? "",
    active:
      profile.active === true ? "true" : profile.active === false ? "false" : "",
    doctorId: profile.doctorId ?? "",
  };
}

export function buildDemographicsUpdateBody(
  form: PatientDemographicsFormState,
  baseline: PatientDemographicsFormState,
): PatientDemographicsUpdateBody | null {
  const body: Record<string, unknown> = {};
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  const displayName = form.displayName.trim();
  const reverseName = form.reverseName.trim();
  const chartNumber = form.chartNumber.trim();
  const doctorId = form.doctorId.trim();

  if (firstName.length > 0 && firstName !== baseline.firstName.trim()) body.firstName = firstName;
  if (lastName.length > 0 && lastName !== baseline.lastName.trim()) body.lastName = lastName;
  if (displayName.length > 0 && displayName !== baseline.displayName.trim()) {
    body.displayName = displayName;
  }
  if (reverseName.length > 0 && reverseName !== baseline.reverseName.trim()) {
    body.reverseName = reverseName;
  }
  if (chartNumber.length > 0 && chartNumber !== baseline.chartNumber.trim()) {
    body.chartNumber = chartNumber;
  } else if (form.chartNumber.trim() === "" && baseline.chartNumber.trim() !== "") {
    body.chartNumber = null;
  }
  if (form.active === "true" && baseline.active !== "true") body.active = true;
  if (form.active === "false" && baseline.active !== "false") body.active = false;
  if (doctorId.length > 0 && doctorId !== baseline.doctorId.trim()) {
    const n = Number(doctorId);
    if (Number.isFinite(n) && n > 0) {
      body.doctorId = String(Math.trunc(n));
    }
  } else if (form.doctorId.trim() === "" && baseline.doctorId.trim() !== "") {
    body.doctorId = null;
  }

  const parsed = PatientDemographicsUpdateBodySchema.safeParse(body);
  if (!parsed.success) return null;
  return parsed.data;
}
