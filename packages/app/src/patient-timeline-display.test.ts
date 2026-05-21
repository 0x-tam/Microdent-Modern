import { describe, expect, it } from "vitest";
import type {
  LedgerEntryV1,
  PatientChartEntry,
  PatientMedicalSummaryResponse,
  PatientProfileResponse,
  PatientTreatmentItem,
  ScheduleAppointmentItem,
} from "@microdent/contracts";
import { timelinePatientApptRange } from "./patient-appointments-range.js";
import {
  buildTimelineDisplayModel,
  type TimelineEvent,
} from "./patient-timeline-display.js";

const profile: PatientProfileResponse = {
  patientId: "42",
  chartNumber: "C-1",
  displayName: "Synthetic Patient",
  phoneMask: "…4242",
  reverseName: "Patient, Synthetic",
  active: true,
  doctorId: "7",
  entryDate: "2020-01-10",
  lastVisit: "2024-03-15",
};

const appointment: ScheduleAppointmentItem = {
  id: "9001",
  date: "2026-05-20",
  time: "09:30",
  durationSlots: 2,
  periodMinutes: 30,
  room: 3,
  status: 1,
  docId: 5,
  patId: "42",
  patient: {
    patientId: "42",
    displayName: "LEAKED PAT_NAME",
    chartNumber: "SHOULD-NOT-SHOW",
  },
  procClass: 2,
  vacId: 0,
  recall: 0,
  unreason: 0,
  missed: false,
  hasComment: true,
};

const treatment: PatientTreatmentItem = {
  treatmentId: "100",
  patientId: "42",
  date: "2024-06-01",
  tooth: 14,
  procedureCode: "SYN01",
  procedureLabel: "Synthetic procedure",
  doctorId: "3",
  doctorLabel: "Synthetic Provider",
  status: 2,
  hasDescription: true,
};

const ledgerEntry: LedgerEntryV1 = {
  ledgerEntryId: "200",
  patientId: "42",
  date: "2024-06-01",
  chargeTypeCode: 2,
  adjustmentTypeCode: 0,
  paymentTypeCode: 100,
  isCardPayment: true,
  hasDescription: true,
};

const chartEntry: PatientChartEntry = {
  chartEntryId: "14-1-1",
  patientId: "42",
  toothNumber: 14,
  chartType: 1,
  treated: true,
  hasNote: true,
};

const medicalSummary: PatientMedicalSummaryResponse = {
  patientId: "42",
  hasMedicalRecord: true,
  hasSensitiveMedicalDetails: false,
  lastUpdated: "2024-06-01",
  lastDentalVisit: "2024-01-01",
  flaggedConditionCount: 1,
  conditions: null,
  privacyNote:
    "Problem description, allergy free text, and medical notes remain hidden until field mapping is reviewed.",
};

function collectEvents(model: ReturnType<typeof buildTimelineDisplayModel>): TimelineEvent[] {
  const dated = model.monthGroups.flatMap((month) => month.dayGroups.flatMap((day) => day.events));
  return [...model.snapshotEvents, ...dated];
}

describe("patient-timeline-display", () => {
  it("merges and sorts dated events newest-first within day groups", () => {
    const model = buildTimelineDisplayModel({
      profile,
      appointments: [appointment],
      treatments: [treatment],
      ledgerEntries: [ledgerEntry],
      chartEntries: [chartEntry],
      medicalSummary,
      apptRange: timelinePatientApptRange(new Date(2026, 4, 15)),
      truncated: { treatments: false, ledger: false, chart: false },
      doctorLabels: new Map([["5", "Provider Five"]]),
    });

    const events = collectEvents(model);
    const dated = events.filter((e) => e.kind !== "chartSnapshot");
    expect(dated[0]?.kind).toBe("appointment");
    expect(dated.some((e) => e.kind === "treatment")).toBe(true);
    expect(dated.some((e) => e.kind === "ledger")).toBe(true);
    expect(dated.some((e) => e.kind === "medicalSnapshot")).toBe(true);
    expect(dated.some((e) => e.kind === "profileAnchor")).toBe(true);
    expect(model.snapshotEvents).toHaveLength(1);
    expect(model.snapshotEvents[0]?.kind).toBe("chartSnapshot");
    expect(model.snapshotEvents[0]?.sourceTab).toBe("chart");
  });

  it("routes treatment events with a tooth to the chart tab with filter hint", () => {
    const model = buildTimelineDisplayModel({
      profile,
      appointments: [],
      treatments: [treatment],
      ledgerEntries: [],
      chartEntries: [],
      medicalSummary: null,
      apptRange: timelinePatientApptRange(),
      truncated: { treatments: false, ledger: false, chart: false },
      doctorLabels: new Map(),
    });

    const txEvent = collectEvents(model).find((e) => e.kind === "treatment");
    expect(txEvent?.sourceTab).toBe("chart");
    expect(txEvent?.navigateHint).toEqual({ chartToothFilter: 14 });
  });

  it("shows range and truncated banners honestly", () => {
    const range = timelinePatientApptRange(new Date(2026, 4, 15));
    const model = buildTimelineDisplayModel({
      profile,
      appointments: [],
      treatments: [],
      ledgerEntries: [],
      chartEntries: [],
      medicalSummary: null,
      apptRange: range,
      truncated: { treatments: true, ledger: false, chart: true },
      doctorLabels: new Map(),
    });

    expect(model.rangeBanner).toContain("Appointments in timeline range");
    expect(model.truncatedBanner).toContain("procedures");
    expect(model.truncatedBanner).toContain("chart rows");
  });

  it("uses safe labels without forbidden tokens", () => {
    const model = buildTimelineDisplayModel({
      profile,
      appointments: [appointment],
      treatments: [treatment],
      ledgerEntries: [ledgerEntry],
      chartEntries: [chartEntry],
      medicalSummary,
      apptRange: timelinePatientApptRange(),
      truncated: { treatments: false, ledger: false, chart: false },
      doctorLabels: new Map(),
    });

    const text = JSON.stringify(model);
    expect(text).not.toMatch(/\bPAT_NAME\b|\bTELEPHONE\b|\bAMOUNT\b|\bSAMOUNT\b|\brawRow\b/i);
    expect(text).not.toContain("LEAKED PAT_NAME");
    expect(text).not.toContain("SHOULD-NOT-SHOW");
  });
});
