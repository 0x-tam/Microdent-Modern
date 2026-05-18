// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppointmentTimeMoveWriteAction } from "./AppointmentTimeMoveWriteAction.js";
import {
  APPOINTMENT_TIME_MOVE_WRITE_CONFIRM,
  SCHEDULE_CONFLICT_SAFE_MESSAGE,
} from "./appointment-time-move-write.js";
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
  workflow: "appointment.timeMove",
  mode: "dry-run" as const,
  tablesAffected: ["SCHEDULE"],
  recordIds: ["501"],
  fieldsChanged: [
    { table: "SCHEDULE", recordId: "501", field: "TIME", changeType: "set" as const },
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

describe("AppointmentTimeMoveWriteAction", () => {
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
    props: Partial<Parameters<typeof AppointmentTimeMoveWriteAction>[0]> = {},
  ) {
    act(() => {
      root.render(
        <AppointmentTimeMoveWriteAction
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
    expect(container.querySelector('[data-testid="appt-time-move-write-pilot"]')).toBeNull();
  });

  it("previews dry-run then commits after confirm", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      const intent = (init?.headers as Record<string, string> | undefined)?.["X-Write-Intent"];
      if (u.includes("/time") && intent === "dry-run") {
        return Promise.resolve(jsonResponse(dryRunPlan));
      }
      if (u.includes("/time") && intent === "commit") {
        return Promise.resolve(jsonResponse(committedPlan));
      }
      if (u.includes("/write-audit-recent")) {
        return Promise.resolve(jsonResponse({ sqliteConfigured: true, sqliteUsable: true, entries: [] }));
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    });
    const onCommitted = vi.fn();
    renderPilot({ fetchImpl, onCommitted });

    const previewBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Preview move"),
    );
    await act(async () => {
      previewBtn?.click();
    });

    expect(container.textContent).toContain("appointment.timeMove");
    expect(container.querySelector('[data-testid="appt-time-move-plan"]')).toBeTruthy();

    const applyBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Apply move"),
    );
    await act(async () => {
      applyBtn?.click();
    });

    expect(window.confirm).toHaveBeenCalledWith(APPOINTMENT_TIME_MOVE_WRITE_CONFIRM);
    expect(onCommitted).toHaveBeenCalledTimes(1);
    const text = container.textContent ?? "";
    expect(text).toContain("Committed: true");
    assertNoForbiddenDomTokens(text);
    expect(containsForbiddenWriteResultToken(text)).toBe(false);
  });

  it("maps schedule conflict to safe copy without slot details", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "SCHEDULE_CONFLICT", message: "overlap with PAT_NAME at 09:00 room 1" },
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );
    renderPilot({ fetchImpl });

    const previewBtn = container.querySelector("summary");
    await act(async () => {
      previewBtn?.click();
    });
    const btn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Preview move"),
    );
    await act(async () => {
      btn?.click();
    });

    const text = container.textContent ?? "";
    expect(text).toContain(SCHEDULE_CONFLICT_SAFE_MESSAGE);
    expect(text).not.toMatch(/PAT_NAME/i);
    expect(containsForbiddenWriteResultToken(text)).toBe(false);
  });
});
