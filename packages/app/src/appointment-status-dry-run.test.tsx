// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppointmentStatusDryRunAction } from "./AppointmentStatusDryRunAction.js";
import {
  containsForbiddenWriteResultToken,
  FORBIDDEN_WRITE_RESULT_TOKENS,
  isAppointmentStatusWriteActionsVisible,
  proposedDryRunStatus,
  summarizeWritePlan,
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

const leakyPlan = {
  ...syntheticPlan,
  warnings: [
    {
      code: "WRITE_PLAN_REHEARSAL",
      message: "SYNTHETIC_NAME_TOKEN SYNTHETIC_PHONE_TOKEN PAT_NAME TELEPHONE COMMENT",
      severity: "warn" as const,
    },
  ],
};

describe("appointment-status write helpers", () => {
  it("proposedDryRunStatus advances within rehearsal range", () => {
    expect(proposedDryRunStatus(1)).toBe(2);
    expect(proposedDryRunStatus(5)).toBe(1);
  });

  it("summarizeWritePlan extracts safe summary fields", () => {
    expect(summarizeWritePlan(syntheticPlan)).toEqual({
      workflow: "appointment.statusUpdate",
      mode: "dry-run",
      committed: false,
      table: "SCHEDULE",
      recordId: "501",
      field: "STATUS",
      warnings: [],
    });
  });

  it("isAppointmentStatusWriteActionsVisible requires dev build and flag", () => {
    expect(isAppointmentStatusWriteActionsVisible(false)).toBe(false);
    expect(isAppointmentStatusWriteActionsVisible(true)).toBe(import.meta.env.DEV);
  });

  it("forbidden token helper matches PHI/raw row markers", () => {
    for (const token of FORBIDDEN_WRITE_RESULT_TOKENS) {
      expect(containsForbiddenWriteResultToken(`leak ${token} here`)).toBe(true);
    }
    expect(containsForbiddenWriteResultToken("appointment.statusUpdate")).toBe(false);
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

  function renderAction(
    props: Partial<Parameters<typeof AppointmentStatusDryRunAction>[0]> = {},
  ) {
    act(() => {
      root.render(
        <AppointmentStatusDryRunAction
          appointment={syntheticAppointment}
          bridgeBaseUrl="http://127.0.0.1:17890"
          writeDiagnosticsActions={import.meta.env.DEV}
          sandboxApplyEnabled={false}
          {...props}
        />,
      );
    });
  }

  it("renders nothing when write diagnostics flag is off", () => {
    renderAction({ writeDiagnosticsActions: false });
    expect(container.textContent?.trim()).toBe("");
    expect(container.querySelector('[data-testid="appt-status-write-dev"]')).toBeNull();
  });

  it("calls dry-run PATCH and shows plan summary", async () => {
    if (!import.meta.env.DEV) return;

    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(syntheticPlan));
    const onCommitted = vi.fn();

    renderAction({ fetchImpl, onCommitted });

    const btn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Dry-run status"),
    );
    expect(btn).toBeTruthy();

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

    const text = container.textContent ?? "";
    expect(text).toContain("appointment.statusUpdate");
    expect(text).toContain("dry-run");
    expect(text).toContain("SCHEDULE");
    expect(text).toContain("501");
    expect(text).toContain("STATUS");
    expect(text).toContain("false");
    expect(onCommitted).not.toHaveBeenCalled();
    expect(containsForbiddenWriteResultToken(text)).toBe(false);
  });

  it("shows sandbox apply only when enabled", () => {
    if (!import.meta.env.DEV) return;

    renderAction({ sandboxApplyEnabled: false });
    expect(container.textContent).not.toContain("Apply status in sandbox");

    act(() => {
      root.render(
        <AppointmentStatusDryRunAction
          appointment={syntheticAppointment}
          bridgeBaseUrl="http://127.0.0.1:17890"
          writeDiagnosticsActions
          sandboxApplyEnabled
        />,
      );
    });
    expect(container.textContent).toContain("Apply status in sandbox");
  });

  it("refreshes via onCommitted when plan reports committed true", async () => {
    if (!import.meta.env.DEV) return;

    const committedPlan = { ...syntheticPlan, committed: true, mode: "enabled" as const };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(committedPlan));
    const onCommitted = vi.fn();

    renderAction({ fetchImpl, onCommitted, sandboxApplyEnabled: true });

    const btn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Apply status in sandbox"),
    );
    await act(async () => {
      btn?.click();
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Write-Intent": "commit" }),
      }),
    );
    expect(onCommitted).toHaveBeenCalledTimes(1);
  });

  it("does not render forbidden PHI/raw row tokens from leaky plan warnings", async () => {
    if (!import.meta.env.DEV) return;

    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(leakyPlan));
    renderAction({ fetchImpl });

    const btn = container.querySelector("button");
    await act(async () => {
      btn?.click();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("WRITE_PLAN_REHEARSAL (warn)");
    expect(text).not.toContain("SYNTHETIC_NAME_TOKEN");
    expect(text).not.toContain("SYNTHETIC_PHONE_TOKEN");
    expect(text).not.toMatch(/PAT_NAME/i);
    expect(text).not.toMatch(/TELEPHONE/i);
    expect(text).not.toMatch(/COMMENT/i);
    expect(containsForbiddenWriteResultToken(text)).toBe(false);
  });

  it("shows graceful message when route is missing (404)", async () => {
    if (!import.meta.env.DEV) return;

    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 404 }));
    renderAction({ fetchImpl });

    const btn = container.querySelector("button");
    await act(async () => {
      btn?.click();
    });

    expect(container.textContent).toContain("Status route is not available");
  });
});
