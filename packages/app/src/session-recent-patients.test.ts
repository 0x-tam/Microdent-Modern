import { describe, expect, it } from "vitest";
import {
  formatSessionRecentPatientMeta,
  pushSessionRecentPatient,
  SESSION_RECENT_PATIENTS_MAX,
} from "./session-recent-patients.js";

describe("pushSessionRecentPatient", () => {
  const a = { patientId: "1", displayName: "Alpha", chartNumber: "C-1" };
  const b = { patientId: "2", displayName: "Beta", chartNumber: null };
  const c = { patientId: "3", displayName: "Gamma", chartNumber: "C-3" };

  it("prepends a new entry and caps at max length", () => {
    let list = pushSessionRecentPatient([], a);
    list = pushSessionRecentPatient(list, b);
    expect(list).toEqual([b, a]);
    for (let i = 4; i <= SESSION_RECENT_PATIENTS_MAX + 2; i++) {
      list = pushSessionRecentPatient(list, {
        patientId: String(i),
        displayName: `Patient ${i}`,
        chartNumber: null,
      });
    }
    expect(list).toHaveLength(SESSION_RECENT_PATIENTS_MAX);
    expect(list[0]?.patientId).toBe(String(SESSION_RECENT_PATIENTS_MAX + 2));
  });

  it("moves an existing patient to the front without duplicating", () => {
    const list = pushSessionRecentPatient(pushSessionRecentPatient([a, b], c), a);
    expect(list).toEqual([a, c, b]);
  });
});

describe("formatSessionRecentPatientMeta", () => {
  it("prefers chart number over record id", () => {
    expect(formatSessionRecentPatientMeta({ patientId: "9", displayName: "X", chartNumber: "C-9" })).toBe(
      "Chart C-9",
    );
  });

  it("falls back to record id when chart is missing", () => {
    expect(formatSessionRecentPatientMeta({ patientId: "9", displayName: "X", chartNumber: null })).toBe(
      "Record 9",
    );
  });
});
