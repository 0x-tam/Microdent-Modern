// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppointmentStatusWriteAction } from "./AppointmentStatusWriteAction.js";
import {
  APPOINTMENT_STATUS_WRITE_CONFIRM,
  containsForbiddenWriteResultToken,
  isAppointmentStatusWritePilotEnabled,
  isAppointmentStatusWriteReady,
} from "./appointment-status-write.js";
import { assertNoForbiddenDomTokens } from "./read-only-smoke-fixtures.js";

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

const readyCapability = {
  writeMode: "enabled" as const,
  writesPermitted: true,
  writableSandbox: true,
};

const committedPlan = {
  operationId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  workflow: "appointment.statusUpdate",
  mode: "enabled" as const,
  tablesAffected: ["SCHEDULE"],
  recordIds: ["501"],
  fieldsChanged: [
    { table: "SCHEDULE", recordId: "501", field: "STATUS", changeType: "set" as const },
  ],
  backupRequired: true,
  backupWouldCreate: true,
  warnings: [],
  committed: true,
  createdAt: "2026-05-15T12:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("appointment-status write pilot helpers", () => {
  it("isAppointmentStatusWritePilotEnabled requires explicit flag", () => {
    expect(isAppointmentStatusWritePilotEnabled(false)).toBe(false);
    expect(isAppointmentStatusWritePilotEnabled(true)).toBe(true);
  });

  it("isAppointmentStatusWriteReady requires enabled sandbox gates", () => {
    expect(isAppointmentStatusWriteReady(readyCapability)).toBe(true);
    expect(
      isAppointmentStatusWriteReady({ ...readyCapability, writesPermitted: false }),
    ).toBe(false);
    expect(
      isAppointmentStatusWriteReady({ ...readyCapability, writeMode: "dry-run" }),
    ).toBe(false);
  });
});

describe("AppointmentStatusWriteAction", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function renderPilot(
    props: Partial<Parameters<typeof AppointmentStatusWriteAction>[0]> = {},
  ) {
    act(() => {
      root.render(
        <AppointmentStatusWriteAction
          appointment={syntheticAppointment}
          bridgeBaseUrl="http://127.0.0.1:17890"
          writePilotEnabled
          writeCapability={readyCapability}
          {...props}
        />,
      );
    });
  }

  it("renders nothing when pilot flag is off", () => {
    renderPilot({ writePilotEnabled: false });
    expect(container.querySelector('[data-testid="appt-status-write-pilot"]')).toBeNull();
  });

  it("renders nothing when bridge is not write-ready", () => {
    renderPilot({
      writeCapability: { writeMode: "disabled", writesPermitted: false, writableSandbox: false },
    });
    expect(container.querySelector('[data-testid="appt-status-write-pilot"]')).toBeNull();
  });

  it("shows sandbox write banner when pilot is active", () => {
    renderPilot();
    expect(container.textContent).toContain("Sandbox write mode");
    expect(container.textContent).toContain("disposable data only");
  });

  async function applyStatusChange(fetchImpl: typeof fetch) {
    const select = container.querySelector("select");
    expect(select).toBeTruthy();
    await act(async () => {
      if (!select) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setter?.call(select, "3");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const btn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Apply status change"),
    );
    await act(async () => {
      btn?.click();
    });
  }

  it("commits after confirm and refreshes parent", async () => {
    const auditBody = {
      sqliteConfigured: true,
      sqliteUsable: true,
      entries: [
        {
          operationId: committedPlan.operationId,
          workflow: committedPlan.workflow,
          terminalStatus: "success",
          requestedAt: "2026-05-15T12:00:00.000Z",
          finishedAt: "2026-05-15T12:00:01.000Z",
        },
      ],
    };
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/write-audit-recent")) {
        return Promise.resolve(jsonResponse(auditBody));
      }
      return Promise.resolve(jsonResponse(committedPlan));
    });
    const onCommitted = vi.fn();

    renderPilot({ fetchImpl, onCommitted });

    await applyStatusChange(fetchImpl);

    expect(window.confirm).toHaveBeenCalledWith(APPOINTMENT_STATUS_WRITE_CONFIRM);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("/status"),
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ "X-Write-Intent": "commit" }),
      }),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("/write-audit-recent"),
      expect.anything(),
    );
    expect(onCommitted).toHaveBeenCalledTimes(1);
    const text = container.textContent ?? "";
    expect(text).toContain("Committed: true");
    expect(text).toContain("status updated");
    expect(text).toContain(committedPlan.operationId);
    expect(text).toContain("Backup created");
    expect(text).toContain("Audit: operation found");
    const result = container.querySelector(".app-appt-status-write__result");
    expect(result?.getAttribute("data-committed")).toBe("true");
    assertNoForbiddenDomTokens(text);
    expect(containsForbiddenWriteResultToken(text)).toBe(false);
    expect(text).not.toMatch(/PAT_NAME/i);
    expect(text).not.toMatch(/TELEPHONE/i);
    expect(text).not.toMatch(/COMMENT/i);
  });

  it("uncommitted plan does not refresh parent or imply a save", async () => {
    const uncommittedPlan = { ...committedPlan, committed: false, mode: "dry-run" as const };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(uncommittedPlan));
    const onCommitted = vi.fn();

    renderPilot({ fetchImpl, onCommitted });
    await applyStatusChange(fetchImpl);

    expect(onCommitted).not.toHaveBeenCalled();
    const text = container.textContent ?? "";
    expect(text).toContain("Committed: false");
    expect(text).toContain("nothing was saved");
    expect(text).not.toContain("status updated");
    const result = container.querySelector(".app-appt-status-write__result");
    expect(result?.getAttribute("data-committed")).toBe("false");
    assertNoForbiddenDomTokens(text);
    expect(containsForbiddenWriteResultToken(text)).toBe(false);
  });

  it("does not apply when confirm is dismissed", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(committedPlan));

    renderPilot({ fetchImpl });
    await applyStatusChange(fetchImpl);

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
