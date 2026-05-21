// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppointmentCreateWriteAction } from "./AppointmentCreateWriteAction.js";
import { APPOINTMENT_CREATE_WRITE_CONFIRM } from "./appointment-create-write.js";
import { containsForbiddenWriteResultToken } from "./safe-write-plan-display.js";
import { assertNoForbiddenDomTokens } from "./read-only-smoke-fixtures.js";

const readyCapability = {
  writeMode: "enabled" as const,
  writesPermitted: true,
  writableSandbox: true,
  dataRootConfigured: true,
  backupDirConfigured: true,
  sqlitePathConfigured: true,
};

const dryRunPlan = {
  operationId: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
  workflow: "appointment.create",
  mode: "dry-run" as const,
  tablesAffected: ["SCHEDULE"],
  recordIds: ["9001"],
  fieldsChanged: [
    { table: "SCHEDULE", recordId: "9001", field: "DATE", changeType: "set" as const },
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

describe("AppointmentCreateWriteAction", () => {
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
    props: Partial<Parameters<typeof AppointmentCreateWriteAction>[0]> = {},
  ) {
    act(() => {
      root.render(
        <AppointmentCreateWriteAction
          bridgeBaseUrl="http://127.0.0.1:17890"
          writePilotEnabled
          writeCapability={readyCapability}
          defaultDate="2026-05-20"
          {...props}
        />,
      );
    });
  }

  it("renders nothing when pilot is off", () => {
    renderPilot({ writePilotEnabled: false });
    expect(container.querySelector('[data-testid="appt-create-write-pilot"]')).toBeNull();
  });

  it("dry-run preview then commit refreshes parent", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      const intent = (init?.headers as Record<string, string> | undefined)?.["X-Write-Intent"];
      if (u.includes("/v1/schedule/appointments") && intent === "dry-run") {
        return Promise.resolve(jsonResponse(dryRunPlan));
      }
      if (u.includes("/v1/schedule/appointments") && intent === "commit") {
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
      b.textContent?.includes("Preview create"),
    );
    await act(async () => {
      previewBtn?.click();
    });

    expect(container.textContent).toContain("appointment.create");
    const applyBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Create appointment"),
    );
    await act(async () => {
      applyBtn?.click();
    });

    expect(window.confirm).toHaveBeenCalledWith(APPOINTMENT_CREATE_WRITE_CONFIRM);
    expect(onCommitted).toHaveBeenCalledTimes(1);
    const text = container.textContent ?? "";
    assertNoForbiddenDomTokens(text);
    expect(containsForbiddenWriteResultToken(text)).toBe(false);
    expect(text).not.toMatch(/COMMENT/i);
  });

  it("syncs defaultDate when defaultDate prop changes", async () => {
    await act(async () => {
      root.render(
        <AppointmentCreateWriteAction
          bridgeBaseUrl="http://127.0.0.1:17890"
          writePilotEnabled
          writeCapability={readyCapability}
          defaultDate="2026-05-20"
        />,
      );
    });

    const details = container.querySelector('[data-testid="appt-create-write-pilot"]') as HTMLDetailsElement;
    await act(async () => {
      details.open = true;
    });

    let dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput?.value).toBe("2026-05-20");

    await act(async () => {
      root.render(
        <AppointmentCreateWriteAction
          bridgeBaseUrl="http://127.0.0.1:17890"
          writePilotEnabled
          writeCapability={readyCapability}
          defaultDate="2026-05-27"
        />,
      );
    });

    dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput?.value).toBe("2026-05-27");
  });
});
