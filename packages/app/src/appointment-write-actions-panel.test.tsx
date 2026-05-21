// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppointmentWriteActionsPanel } from "./AppointmentWriteActionsPanel.js";
import { APPOINTMENT_STATUS_WRITE_CONFIRM } from "./appointment-status-write.js";
import { SCHEDULE_CONFLICT_SAFE_MESSAGE } from "./appointment-time-move-write.js";
import {
  APPOINTMENT_WRITE_ACTIONS_SUMMARY,
  APPOINTMENT_WRITE_TAB_MOVE,
  APPOINTMENT_WRITE_TAB_STATUS,
  SCHEDULE_SANDBOX_WRITE_PILOT_BANNER,
  WRITE_POST_COMMIT_MIRROR_NUDGE,
} from "./read-only-ui-copy.js";
import { containsForbiddenWriteResultToken } from "./safe-write-plan-display.js";
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

describe("AppointmentWriteActionsPanel", () => {
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

  function renderPanel(
    props: Partial<Parameters<typeof AppointmentWriteActionsPanel>[0]> = {},
  ) {
    act(() => {
      root.render(
        <AppointmentWriteActionsPanel
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
    renderPanel({ writePilotEnabled: false });
    expect(container.querySelector('[data-testid="appt-write-actions-panel"]')).toBeNull();
  });

  it("shows blocked notice when bridge is not write-ready", () => {
    renderPanel({
      writeCapability: {
        writeMode: "disabled",
        writesPermitted: false,
        writableSandbox: false,
        dataRootConfigured: false,
        backupDirConfigured: false,
        sqlitePathConfigured: false,
      },
    });
    expect(container.querySelector('[data-testid="appt-write-actions-panel"]')).toBeNull();
    expect(container.querySelector('[data-testid="appt-write-actions-blocked"]')).toBeTruthy();
    expect(container.textContent).toMatch(/Sandbox writes are blocked/i);
  });

  it("is collapsed by default and does not show per-row sandbox banner", () => {
    renderPanel();
    const details = container.querySelector('[data-testid="appt-write-actions-panel"]') as HTMLDetailsElement;
    expect(details).toBeTruthy();
    expect(details.open).toBe(false);
    expect(container.textContent).toContain(APPOINTMENT_WRITE_ACTIONS_SUMMARY);
    expect(container.textContent).not.toContain("disposable data only");
    expect(container.textContent).not.toContain(SCHEDULE_SANDBOX_WRITE_PILOT_BANNER);
  });

  it("shows status and move tabs when expanded", async () => {
    renderPanel();
    const details = container.querySelector('[data-testid="appt-write-actions-panel"]') as HTMLDetailsElement;
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle", { bubbles: true }));
    });

    const text = container.textContent ?? "";
    expect(text).toContain(APPOINTMENT_WRITE_TAB_STATUS);
    expect(text).toContain(APPOINTMENT_WRITE_TAB_MOVE);
    expect(container.querySelector('[data-testid="appt-status-write-pilot"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appt-time-move-write-pilot"]')).toBeNull();
    assertNoForbiddenDomTokens(text);
  });

  it("previews status then commits after confirm", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      const intent = (init?.headers as Record<string, string> | undefined)?.["X-Write-Intent"];
      if (u.includes("/status") && intent === "dry-run") {
        return Promise.resolve(jsonResponse(dryRunPlan));
      }
      if (u.includes("/status") && intent === "commit") {
        return Promise.resolve(jsonResponse(committedPlan));
      }
      if (u.includes("/write-audit-recent")) {
        return Promise.resolve(jsonResponse({ sqliteConfigured: true, sqliteUsable: true, entries: [] }));
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    });
    const onCommitted = vi.fn();
    renderPanel({ fetchImpl, onCommitted });

    const details = container.querySelector('[data-testid="appt-write-actions-panel"]') as HTMLDetailsElement;
    await act(async () => {
      details.open = true;
    });

    const select = container.querySelector("select");
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
    expect(container.querySelector('[data-testid="appt-status-write-plan"]')).toBeTruthy();

    const applyBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Apply status change"),
    );
    await act(async () => {
      applyBtn?.click();
    });

    expect(window.confirm).toHaveBeenCalledWith(APPOINTMENT_STATUS_WRITE_CONFIRM);
    expect(onCommitted).toHaveBeenCalledTimes(1);
    const text = container.textContent ?? "";
    expect(text).toContain("Committed: true");
    expect(text).toContain(WRITE_POST_COMMIT_MIRROR_NUDGE);
    assertNoForbiddenDomTokens(text);
    expect(containsForbiddenWriteResultToken(text)).toBe(false);
  });

  it("maps schedule conflict to safe copy on the move tab", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "SCHEDULE_CONFLICT", message: "overlap with PAT_NAME at 09:00 room 1" },
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );
    renderPanel({ fetchImpl });

    const details = container.querySelector('[data-testid="appt-write-actions-panel"]') as HTMLDetailsElement;
    await act(async () => {
      details.open = true;
    });

    const moveTab = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes(APPOINTMENT_WRITE_TAB_MOVE),
    );
    await act(async () => {
      moveTab?.click();
    });

    const previewBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Preview move"),
    );
    await act(async () => {
      previewBtn?.click();
    });

    const text = container.textContent ?? "";
    expect(text).toContain(SCHEDULE_CONFLICT_SAFE_MESSAGE);
    expect(text).not.toMatch(/PAT_NAME/i);
    assertNoForbiddenDomTokens(text);
  });

  it("switches to move tab content", async () => {
    renderPanel();
    const details = container.querySelector('[data-testid="appt-write-actions-panel"]') as HTMLDetailsElement;
    await act(async () => {
      details.open = true;
    });

    const moveTab = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes(APPOINTMENT_WRITE_TAB_MOVE),
    );
    await act(async () => {
      moveTab?.click();
    });

    const text = container.textContent ?? "";
    expect(container.querySelector('[data-testid="appt-time-move-write-pilot"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appt-status-write-pilot"]')).toBeNull();
    assertNoForbiddenDomTokens(text);
  });
});
