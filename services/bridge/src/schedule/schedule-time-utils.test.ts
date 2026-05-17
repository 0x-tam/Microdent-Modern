import { describe, expect, it } from "vitest";
import {
  normalizeScheduleTimeHm,
  parseScheduleTimeToMinutes,
  scheduleIntervalsOverlap,
  weekdayIndexFromIsoDate,
} from "./schedule-time-utils.js";

describe("schedule time utils", () => {
  it("parses and normalizes HH:MM", () => {
    expect(parseScheduleTimeToMinutes("9:00")).toBe(540);
    expect(normalizeScheduleTimeHm("9:00")).toBe("09:00");
  });

  it("detects overlapping intervals", () => {
    expect(scheduleIntervalsOverlap(540, 600, 570, 630)).toBe(true);
    expect(scheduleIntervalsOverlap(540, 600, 600, 660)).toBe(false);
  });

  it("maps iso date to weekday index", () => {
    expect(weekdayIndexFromIsoDate("2026-05-20")).toBe(3);
  });
});
