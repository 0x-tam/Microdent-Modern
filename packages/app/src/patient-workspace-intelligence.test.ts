import { describe, expect, it } from "vitest";
import {
  patientWorkspaceAtGlance,
  partitionTimelineEventsByTemporal,
  scheduleOperationalSummary,
  timelineTemporalCounts,
} from "./patient-workspace-intelligence.js";
import { buildTimelineDisplayModel } from "./patient-timeline-display.js";
import type { ScheduleAppointmentItem } from "@microdent/contracts";

describe("patientWorkspaceAtGlance", () => {
  it("returns safe count hints without PHI tokens", () => {
    const glance = patientWorkspaceAtGlance({
      appt: { phase: "empty", appointments: [] },
      medical: { phase: "loaded", hasMedicalRecord: true, flaggedConditionCount: 2, sensitive: false },
      treatments: { phase: "loaded", count: 3, truncated: false },
      chart: { phase: "empty", count: 0, truncated: false },
      ledger: { phase: "loaded", count: 1, truncated: false },
    });
    expect(glance.medicalScreening).toContain("2 flagged");
    expect(glance.treatmentCount).toBe("3 procedures");
    expect(glance.ledgerCount).toBe("1 ledger line");
    expect(JSON.stringify(glance)).not.toMatch(/PAT_NAME|TELEPHONE|AMOUNT/i);
  });
});

describe("partitionTimelineEventsByTemporal", () => {
  it("partitions dated events into upcoming, recent, and older", () => {
    const now = new Date(2026, 4, 15, 12, 0, 0).getTime();
    const model = buildTimelineDisplayModel({
      profile: { patientId: "1", active: true, entryDate: null, lastVisit: null },
      appointments: [
        { id: "1", date: "2026-05-20", time: "09:00", room: 1, patId: "1", status: 1, durationSlots: 1, periodMinutes: 30, missed: false, hasComment: false, docId: 0 } as ScheduleAppointmentItem,
        { id: "2", date: "2026-05-10", time: "09:00", room: 1, patId: "1", status: 3, durationSlots: 1, periodMinutes: 30, missed: false, hasComment: false, docId: 0 } as ScheduleAppointmentItem,
        { id: "3", date: "2025-01-01", time: "09:00", room: 1, patId: "1", status: 3, durationSlots: 1, periodMinutes: 30, missed: false, hasComment: false, docId: 0 } as ScheduleAppointmentItem,
      ],
      treatments: [],
      ledgerEntries: [],
      chartEntries: [],
      medicalSummary: null,
      apptRange: { from: "2025-01-01", to: "2026-12-31" },
      truncated: { treatments: false, ledger: false, chart: false },
      doctorLabels: new Map(),
    });
    const groups = partitionTimelineEventsByTemporal(model, now);
    expect(groups.map((g) => g.section)).toEqual(["upcoming", "recent", "older"]);
    const counts = timelineTemporalCounts(model, now);
    expect(counts.upcoming).toBe(1);
    expect(counts.recent).toBe(1);
    expect(counts.older).toBe(1);
  });
});

describe("scheduleOperationalSummary", () => {
  it("reports shown vs total and filter state without raw rows", () => {
    const appts = [
      { id: "1", status: 1, docId: 1, room: 1 } as ScheduleAppointmentItem,
      { id: "2", status: 2, docId: 2, room: 2 } as ScheduleAppointmentItem,
    ];
    const summary = scheduleOperationalSummary(
      appts,
      [appts[0]!],
      { statusFilter: 1, providerFilter: null, roomFilter: "" },
      new Map([["1", "Dr A"]]),
    );
    expect(summary.shownLabel).toBe("1 of 2 appointments shown");
    expect(summary.filterActiveLabel).toContain("status:");
    expect(summary.providerMix).toContain("2 providers");
  });
});
