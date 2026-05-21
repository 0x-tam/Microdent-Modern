import { describe, expect, it, vi } from "vitest";
import {
  capPatientApptRange,
  defaultPatientApptRange,
  inclusiveDayCount,
  patientApptRangeForPreset,
} from "./patient-appointments-range.js";

describe("defaultPatientApptRange", () => {
  it("spans 90 days before and after today within API cap", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 15));
    const range = defaultPatientApptRange();
    expect(range.from).toBe("2026-02-14");
    expect(range.to).toBe("2026-08-13");
    expect(inclusiveDayCount(range.from, range.to)).toBe(180);
    vi.useRealTimers();
  });
});

describe("patientApptRangeForPreset", () => {
  it("maps default preset to ±90 window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 10));
    expect(patientApptRangeForPreset("default")).toEqual(defaultPatientApptRange());
    vi.useRealTimers();
  });

  it("maps past90 to trailing 90 days through today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 1));
    const range = patientApptRangeForPreset("past90");
    expect(range.to).toBe("2026-06-01");
    expect(inclusiveDayCount(range.from, range.to)).toBe(90);
    vi.useRealTimers();
  });

  it("caps ranges longer than 365 inclusive days", () => {
    const capped = capPatientApptRange("2020-01-01", "2022-01-01");
    expect(inclusiveDayCount(capped.from, capped.to)).toBeLessThanOrEqual(365);
  });
});
