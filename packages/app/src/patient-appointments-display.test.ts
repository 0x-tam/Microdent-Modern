import { describe, expect, it } from "vitest";
import { buildDoctorLabelMap } from "./doctor-labels.js";
import { buildProcedureReferenceMaps, procClassDisplayLabel } from "./procedure-reference.js";
import {
  appointmentVisitMeta,
  buildRoomLabelMap,
  comparePatientApptToNow,
  filterPatientAppointments,
  findCurrentAppointmentInRange,
  patientApptProviderFilterOptions,
  patientApptRangeCountLabel,
  patientApptRowMeta,
  patientApptStatusLabel,
  patientApptStatusSemanticLabel,
  patientApptUniqueDocIds,
  patientApptUniqueRooms,
  roomDisplayLabel,
  scheduleDayAppointmentCountLabel,
} from "./patient-appointments-display.js";
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

describe("appointmentVisitMeta", () => {
  const roomMap = buildRoomLabelMap([{ room: 2, displayName: "Synthetic bay B", activeDays: 127, doctorId: 1 }]);

  it("builds unified visit meta with duration and room dictionary label", () => {
    const appt = { ...baseAppt, docId: 5, procClass: 44 };
    const doctorLabels = buildDoctorLabelMap([
      { doctorId: "5", displayName: "Synthetic Provider Appt", active: true },
    ]);
    const meta = appointmentVisitMeta(appt, doctorLabels, maps, {
      includeDuration: true,
      roomLabel: roomDisplayLabel(appt.room, roomMap),
    });
    expect(meta).toContain("Synthetic bay B");
    expect(meta).toContain("30 min");
    expect(meta).toContain("Synthetic Provider Appt");
    expect(meta).toContain("Synthetic category only");
  });

  it("uses patientApptRowMeta with room map fallback", () => {
    expect(patientApptRowMeta(baseAppt, new Map(), maps, roomMap)).toContain("Synthetic bay B");
    expect(patientApptRowMeta(baseAppt, new Map(), maps)).toContain("Room 2");
  });
});

describe("patientApptStatusSemanticLabel", () => {
  it("uses human status text without raw code", () => {
    expect(patientApptStatusSemanticLabel(2)).toBe("Visit status: Confirmed");
    expect(patientApptStatusSemanticLabel(2)).not.toMatch(/\b2\b/);
  });
});

describe("patient appointment filters", () => {
  const ref = new Date(2026, 4, 15, 12, 0, 0);
  const past = { ...baseAppt, id: "past", date: "2026-05-10", time: "10:00", status: 3, room: 1 };
  const future = { ...baseAppt, id: "future", date: "2026-05-20", time: "14:00", status: 1, room: 3 };
  const todayPast = { ...baseAppt, id: "today-past", date: "2026-05-15", time: "08:00", status: 2, room: 2 };
  const todayFuture = { ...baseAppt, id: "today-future", date: "2026-05-15", time: "16:00", status: 4, room: 2 };
  const list = [past, future, todayPast, todayFuture];

  it("filters by past and upcoming relative to now", () => {
    expect(filterPatientAppointments(list, { timeDirection: "past", ref }).map((a) => a.id)).toEqual([
      "past",
      "today-past",
    ]);
    expect(filterPatientAppointments(list, { timeDirection: "upcoming", ref }).map((a) => a.id)).toEqual([
      "future",
      "today-future",
    ]);
  });

  it("filters by status, room, and provider", () => {
    expect(filterPatientAppointments(list, { statusFilter: 1, ref })).toHaveLength(1);
    expect(filterPatientAppointments(list, { roomFilter: 2, ref }).map((a) => a.id)).toEqual([
      "today-past",
      "today-future",
    ]);
    const withProvider = [
      ...list,
      { ...baseAppt, id: "other-doc", docId: 9, date: "2026-05-16", time: "11:00" },
    ];
    expect(filterPatientAppointments(withProvider, { providerFilter: 9, ref }).map((a) => a.id)).toEqual([
      "other-doc",
    ]);
  });

  it("lists unique doc ids and provider chip labels", () => {
    const doctorLabels = buildDoctorLabelMap([
      { doctorId: "5", displayName: "Synthetic Provider Appt", active: true },
    ]);
    const withTwo = [
      { ...baseAppt, id: "a", docId: 5 },
      { ...baseAppt, id: "b", docId: 9 },
    ];
    expect(patientApptUniqueDocIds(withTwo)).toEqual([5, 9]);
    expect(patientApptProviderFilterOptions(withTwo, doctorLabels)).toEqual([
      { docId: 5, label: "Synthetic Provider Appt" },
      { docId: 9, label: "Doctor 9" },
    ]);
  });

  it("finds current appointment on today's date in range", () => {
    const ref = new Date(2026, 4, 15, 10, 30, 0);
    const current = {
      ...baseAppt,
      id: "now",
      date: "2026-05-15",
      time: "10:00",
      durationSlots: 2,
      periodMinutes: 30,
    };
    const later = { ...baseAppt, id: "later", date: "2026-05-15", time: "14:00" };
    expect(findCurrentAppointmentInRange([past, later, current], ref)?.id).toBe("now");
    expect(findCurrentAppointmentInRange([past, future], ref)).toBeNull();
  });

  it("formats per-day count copy", () => {
    expect(scheduleDayAppointmentCountLabel(1)).toBe("1 appointment");
    expect(scheduleDayAppointmentCountLabel(4)).toBe("4 appointments");
  });

  it("lists unique rooms sorted", () => {
    expect(patientApptUniqueRooms(list)).toEqual([1, 2, 3]);
  });

  it("formats range count copy", () => {
    expect(patientApptRangeCountLabel(1)).toBe("1 appointment in range");
    expect(patientApptRangeCountLabel(3)).toBe("3 appointments in range");
  });

  it("maps filter status codes to safe labels without forbidden tokens", () => {
    for (const code of [1, 2, 3, 4, 5] as const) {
      const label = patientApptStatusLabel(code);
      expect(label).not.toMatch(/\bPAT_NAME\b|\bTELEPHONE\b|\bAMOUNT\b/i);
    }
  });

  it("comparePatientApptToNow treats same-day times correctly", () => {
    expect(comparePatientApptToNow(todayPast, ref)).toBe(-1);
    expect(comparePatientApptToNow(todayFuture, ref)).toBe(1);
  });
});
