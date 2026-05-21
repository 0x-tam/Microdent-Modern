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
  dataRootConfigured: true,
  backupDirConfigured: true,
  sqlitePathConfigured: true,
};

const dryRunPlan = {
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

const committedPlan = { ...dryRunPlan, committed: true, mode: "enabled" as const };

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

  it("shows blocked notice when bridge is not write-ready", () => {
    renderPilot({
      writeCapability: {
        writeMode: "disabled",
        writesPermitted: false,
        writableSandbox: false,
        dataRootConfigured: false,
        backupDirConfigured: false,
        sqlitePathConfigured: false,
      },
    });
    expect(container.querySelector('[data-testid="appt-status-write-pilot"]')).toBeNull();
    expect(container.querySelector('[data-testid="appt-status-write-blocked"]')).toBeTruthy();
    expect(container.textContent).toMatch(/Sandbox writes are blocked/i);
  });

  it("re-disables Apply after status change following a successful preview", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes("/status")) {
        return Promise.resolve(jsonResponse(dryRunPlan));
      }
      return Promise.reject(new Error("unexpected"));
    });
    renderPilot({ fetchImpl });

    const select = container.querySelector("select") as HTMLSelectElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setter?.call(select, "3");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      [...container.querySelectorAll("button")]
        .find((b) => b.textContent?.includes("Preview status change"))
        ?.click();
    });
    const applyBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Apply status change"),
    );
    expect(applyBtn?.disabled).toBe(false);

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setter?.call(select, "2");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(applyBtn?.disabled).toBe(true);
    expect(container.querySelector('[data-testid="appt-status-write-plan"]')).toBeNull();
  });

  it("shows sandbox write banner when pilot is active and not embedded", () => {
    renderPilot();
    expect(container.textContent).toContain("Sandbox write pilot");
    expect(container.textContent).toContain("disposable Write-Sandbox DATA only");
  });

  it("hides sandbox write banner when embedded", () => {
    renderPilot({ embedded: true });
    expect(container.textContent).not.toContain("Sandbox write pilot");
  });

  async function previewAndApplyStatusChange(fetchImpl: typeof fetch) {
    const select = container.querySelector("select");
    expect(select).toBeTruthy();
    await act(async () => {
      if (!select) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setter?.call(select, "3");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const previewBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Preview status change"),
    );
    await act(async () => {
      previewBtn?.click();
    });

    const applyBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Apply status change"),
    );
    await act(async () => {
      applyBtn?.click();
    });
  }

  it("commits after preview and confirm and refreshes parent", async () => {
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
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      const intent = (init?.headers as Record<string, string> | undefined)?.["X-Write-Intent"];
      if (u.includes("/write-audit-recent")) {
        return Promise.resolve(jsonResponse(auditBody));
      }
      if (u.includes("/status") && intent === "dry-run") {
        return Promise.resolve(jsonResponse(dryRunPlan));
      }
      if (u.includes("/status") && intent === "commit") {
        return Promise.resolve(jsonResponse(committedPlan));
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    });
    const onCommitted = vi.fn();

    renderPilot({ fetchImpl, onCommitted });

    await previewAndApplyStatusChange(fetchImpl);

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
    const uncommittedPlan = { ...dryRunPlan, committed: false, mode: "dry-run" as const };
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      const intent = (init?.headers as Record<string, string> | undefined)?.["X-Write-Intent"];
      if (u.includes("/status") && intent === "dry-run") {
        return Promise.resolve(jsonResponse(uncommittedPlan));
      }
      if (u.includes("/status") && intent === "commit") {
        return Promise.resolve(jsonResponse(uncommittedPlan));
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    });
    const onCommitted = vi.fn();

    renderPilot({ fetchImpl, onCommitted });
    await previewAndApplyStatusChange(fetchImpl);

    expect(onCommitted).not.toHaveBeenCalled();
    const text = container.textContent ?? "";
    expect(text).toContain("Committed: false");
    expect(text).toContain("dry-run plan only");
    expect(text).not.toContain("status updated");
    const result = container.querySelector(".app-appt-status-write__result");
    expect(result?.getAttribute("data-committed")).toBe("false");
    assertNoForbiddenDomTokens(text);
    expect(containsForbiddenWriteResultToken(text)).toBe(false);
  });

  it("does not apply when confirm is dismissed", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      const intent = (init?.headers as Record<string, string> | undefined)?.["X-Write-Intent"];
      if (u.includes("/status") && intent === "dry-run") {
        return Promise.resolve(jsonResponse(dryRunPlan));
      }
      return Promise.resolve(jsonResponse(committedPlan));
    });

    renderPilot({ fetchImpl });
    await previewAndApplyStatusChange(fetchImpl);

    expect(fetchImpl).not.toHaveBeenCalledWith(
      expect.stringContaining("/status"),
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Write-Intent": "commit" }),
      }),
    );
  });

  it("requires preview before apply", async () => {
    renderPilot();
    const applyBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Apply status change"),
    );
    expect(applyBtn?.disabled).toBe(true);
  });
});
