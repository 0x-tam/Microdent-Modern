// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppointmentCreateWriteAction } from "./AppointmentCreateWriteAction.js";
import { APPOINTMENT_CREATE_WRITE_CONFIRM } from "./appointment-create-write.js";
import { WRITE_POST_COMMIT_MIRROR_NUDGE } from "./read-only-ui-copy.js";
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

const syntheticDoctors = {
  doctors: [
    { doctorId: "3", displayName: "Synthetic Provider Create", active: true },
    { doctorId: "7", displayName: "Second Provider", active: true },
  ],
};

function withReferenceDoctors(
  inner: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): ReturnType<typeof vi.fn> {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const u = String(input);
    if (u.includes("/v1/reference/doctors")) {
      return Promise.resolve(jsonResponse(syntheticDoctors));
    }
    return inner(input, init);
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function openCreateDetails(container: ParentNode) {
  const details = container.querySelector('[data-testid="appt-create-write-pilot"]') as HTMLDetailsElement;
  act(() => {
    details.open = true;
  });
  return details;
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

  it("shows embedded blocked notice when sandbox is not write-ready", () => {
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
    expect(container.querySelector('[data-testid="appt-create-write-blocked"]')).toBeTruthy();
    const text = container.textContent ?? "";
    expect(text).toMatch(/Sandbox writes are blocked/i);
    assertNoForbiddenDomTokens(text);
    expect(containsForbiddenWriteResultToken(text)).toBe(false);
  });

  it("dry-run preview then commit refreshes parent", async () => {
    const fetchImpl = withReferenceDoctors((input, init) => {
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
    expect(text).toContain(WRITE_POST_COMMIT_MIRROR_NUDGE);
    expect(text).toContain("numeric patient record id");
    assertNoForbiddenDomTokens(text);
    expect(containsForbiddenWriteResultToken(text)).toBe(false);
    expect(text).not.toMatch(/COMMENT/i);
  });

  it("populates doctor select from reference doctors", async () => {
    const fetchImpl = withReferenceDoctors(() => Promise.reject(new Error("unexpected")));
    renderPilot({ fetchImpl });
    openCreateDetails(container);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const doctorSelect = container.querySelector('select[aria-label="Doctor"]') as HTMLSelectElement;
    expect(doctorSelect).toBeTruthy();
    const options = [...doctorSelect.options].map((o) => ({ value: o.value, label: o.textContent }));
    expect(options[0]).toEqual({ value: "0", label: "None (unassigned)" });
    expect(options.some((o) => o.value === "3" && o.label === "Synthetic Provider Create")).toBe(true);
    expect(options.some((o) => o.value === "7" && o.label === "Second Provider")).toBe(true);
    expect(container.querySelector('input[aria-label="Patient id"]')).toBeTruthy();
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });

  it("re-disables Create after editing fields following preview", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes("/v1/schedule/appointments")) {
        return Promise.resolve(jsonResponse(dryRunPlan));
      }
      return Promise.reject(new Error("unexpected"));
    });
    renderPilot({ fetchImpl });

    const details = container.querySelector('[data-testid="appt-create-write-pilot"]') as HTMLDetailsElement;
    await act(async () => {
      details.open = true;
    });

    await act(async () => {
      [...container.querySelectorAll("button")]
        .find((b) => b.textContent?.includes("Preview create"))
        ?.click();
    });
    const applyBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Create appointment"),
    );
    expect(applyBtn?.disabled).toBe(false);

    const timeInput = container.querySelector('input[aria-label="Appointment time"]') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(timeInput, "10:30");
      timeInput.dispatchEvent(new Event("input", { bubbles: true }));
      timeInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(applyBtn?.disabled).toBe(true);
    expect(container.querySelector('[data-testid="appt-create-plan"]')).toBeNull();
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
