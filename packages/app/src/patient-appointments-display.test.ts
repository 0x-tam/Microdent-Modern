import { describe, expect, it } from "vitest";
import { buildDoctorLabelMap } from "./doctor-labels.js";
import { buildProcedureReferenceMaps, procClassDisplayLabel } from "./procedure-reference.js";
import { patientApptRowMeta } from "./patient-appointments-display.js";
import type { ScheduleAppointmentItem } from "@microdent/contracts";

const baseAppt: ScheduleAppointmentItem = {
  id: "1",
  date: "2026-05-01",
  time: "09:00",
  durationSlots: 1,
  periodMinutes: 30,
  room: 2,
  status: 1,
  docId: 0,
  patId: "42",
  procClass: 44,
  vacId: 0,
  recall: 0,
  unreason: 0,
  missed: false,
  hasComment: false,
};

const maps = buildProcedureReferenceMaps([
  {
    procedureCode: "SYN04",
    displayName: null,
    category: "Synthetic category only",
    categoryCode: null,
    classId: 44,
    chartRelevant: false,
  },
]);

describe("patientApptRowMeta doctor labels", () => {
  const doctorLabels = buildDoctorLabelMap([
    { doctorId: "5", displayName: "Synthetic Provider Appt", active: true },
  ]);

  it("uses reference displayName for doctor", () => {
    const appt = { ...baseAppt, docId: 5 };
    expect(patientApptRowMeta(appt, doctorLabels, maps)).toContain("Synthetic Provider Appt");
    expect(patientApptRowMeta(appt, doctorLabels, maps)).not.toMatch(/\bDoctor 5\b/);
  });

  it("falls back to Doctor {id} when reference is missing", () => {
    expect(patientApptRowMeta({ ...baseAppt, docId: 5 }, new Map(), maps)).toContain("Doctor 5");
  });
});

describe("patientApptRowMeta procedure labels", () => {
  it("shows mapped category when classId join is unambiguous", () => {
    expect(patientApptRowMeta(baseAppt, new Map(), maps)).toContain("Synthetic category only");
    expect(patientApptRowMeta(baseAppt, new Map(), maps)).not.toContain("Procedure class 44");
  });

  it("falls back to Procedure class when mapping is uncertain", () => {
    expect(patientApptRowMeta({ ...baseAppt, procClass: 101 }, new Map(), maps)).toContain("Procedure class 101");
  });

  it("omits procedure text when procClass is zero", () => {
    const meta = patientApptRowMeta({ ...baseAppt, procClass: 0 }, new Map(), maps);
    expect(meta).not.toMatch(/Procedure class|Proc /i);
  });
});

describe("patientApptRowMeta privacy", () => {
  it("does not render price or fee field names from reference payloads", () => {
    const meta = patientApptRowMeta(baseAppt, new Map(), maps);
    expect(meta).not.toMatch(/\bPRICE\d*\b/i);
    expect(meta).not.toMatch(/\bPER_PROF\b/i);
    expect(meta).not.toMatch(/\bfee\b/i);
    expect(procClassDisplayLabel(44, maps)).not.toMatch(/\bprice\b/i);
  });
});
