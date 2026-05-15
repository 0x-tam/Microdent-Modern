// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppointmentStatusDryRunAction } from "./AppointmentStatusDryRunAction.js";
import {
  isAppointmentStatusDryRunVisible,
  proposedDryRunStatus,
  summarizeDryRunPlan,
} from "./appointment-status-dry-run.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const syntheticAppointment = {
  id: "501",
  date: "2026-05-20",
  time: "09:00",
  durationSlots: 2,
  periodMinutes: 30,
  room: 1,
  status: 1,
  docId: 3,
  patId: "0",
  patient: null,
  procClass: 1,
  vacId: 0,
  recall: 0,
  unreason: 0,
  missed: false,
  hasComment: false,
} as const;

const syntheticPlan = {
  operationId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  workflow: "appointment.statusUpdate",
  mode: "dry-run" as const,
  tablesAffected: ["SCHEDULE"],
  recordIds: ["501"],
  fieldsChanged: [
    { table: "SCHEDULE", recordId: "501", field: "STATUS", changeType: "set" as const },
  ],
  backupRequired: true,
  backupWouldCreate: true,
  warnings: [],
  committed: false,
  createdAt: "2026-05-15T12:00:00.000Z",
};

describe("appointment-status-dry-run helpers", () => {
  it("proposedDryRunStatus advances within rehearsal range", () => {
    expect(proposedDryRunStatus(1)).toBe(2);
    expect(proposedDryRunStatus(5)).toBe(1);
  });

  it("summarizeDryRunPlan extracts safe summary fields", () => {
    expect(summarizeDryRunPlan(syntheticPlan)).toEqual({
      workflow: "appointment.statusUpdate",
      table: "SCHEDULE",
      recordId: "501",
      field: "STATUS",
      committed: false,
    });
  });

  it("isAppointmentStatusDryRunVisible requires dev build and flag", () => {
    expect(isAppointmentStatusDryRunVisible(false)).toBe(false);
    expect(isAppointmentStatusDryRunVisible(true)).toBe(import.meta.env.DEV);
  });
});

describe("AppointmentStatusDryRunAction", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders nothing when dev flag is off", () => {
    act(() => {
      root.render(
        <AppointmentStatusDryRunAction
          appointment={syntheticAppointment}
          bridgeBaseUrl="http://127.0.0.1:17890"
          devDryRunEnabled={false}
        />,
      );
    });
    expect(container.textContent?.trim()).toBe("");
  });

  it("calls dry-run PATCH and shows plan summary", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ plan: syntheticPlan, committed: false }),
    );

    act(() => {
      root.render(
        <AppointmentStatusDryRunAction
          appointment={syntheticAppointment}
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          devDryRunEnabled={import.meta.env.DEV}
        />,
      );
    });

    if (!import.meta.env.DEV) {
      expect(container.textContent?.trim()).toBe("");
      return;
    }

    const btn = container.querySelector("button");
    expect(btn?.textContent).toContain("Dry-run status update");

    await act(async () => {
      btn?.click();
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:17890/v1/schedule/appointments/501/status",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          "X-Write-Intent": "dry-run",
        }),
      }),
    );

    expect(container.textContent).toContain("appointment.statusUpdate");
    expect(container.textContent).toContain("SCHEDULE");
    expect(container.textContent).toContain("501");
    expect(container.textContent).toContain("STATUS");
    expect(container.textContent).toContain("false");
  });

  it("shows graceful message when route is missing (404)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 404 }));

    act(() => {
      root.render(
        <AppointmentStatusDryRunAction
          appointment={syntheticAppointment}
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          devDryRunEnabled={import.meta.env.DEV}
        />,
      );
    });

    if (!import.meta.env.DEV) return;

    const btn = container.querySelector("button");
    await act(async () => {
      btn?.click();
    });

    expect(container.textContent).toContain("Dry-run route is not available");
  });
});
