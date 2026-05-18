// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PatientDemographicsWritePanel } from "./PatientDemographicsWritePanel.js";
import { PATIENT_DEMOGRAPHICS_WRITE_CONFIRM } from "./patient-demographics-write.js";
import { containsForbiddenWriteResultToken } from "./safe-write-plan-display.js";
import { assertNoForbiddenDomTokens } from "./read-only-smoke-fixtures.js";

const syntheticProfile = {
  patientId: "42",
  chartNumber: "C-42",
  displayName: "Sandbox Patient",
  phoneMask: null,
  reverseName: "Patient, Sandbox",
  active: true,
  doctorId: "3",
  entryDate: "2020-01-01",
  lastVisit: "2026-01-01",
};

const readyCapability = {
  writeMode: "enabled" as const,
  writesPermitted: true,
  writableSandbox: true,
};

const dryRunPlan = {
  operationId: "f47ac10b-58cc-4372-a567-0e02b2c3d481",
  workflow: "patient.demographics.update",
  mode: "dry-run" as const,
  tablesAffected: ["PATIENT"],
  recordIds: ["42"],
  fieldsChanged: [
    { table: "PATIENT", recordId: "42", field: "NAME", changeType: "set" as const },
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

describe("PatientDemographicsWritePanel", () => {
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
    props: Partial<Parameters<typeof PatientDemographicsWritePanel>[0]> = {},
  ) {
    act(() => {
      root.render(
        <PatientDemographicsWritePanel
          patientId="42"
          profile={syntheticProfile}
          bridgeBaseUrl="http://127.0.0.1:17890"
          writePilotEnabled
          writeCapability={readyCapability}
          {...props}
        />,
      );
    });
  }

  it("renders nothing when pilot is off", () => {
    renderPilot({ writePilotEnabled: false });
    expect(container.querySelector('[data-testid="patient-demographics-write-pilot"]')).toBeNull();
  });

  it("preview and commit invoke profile refresh", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      const intent = (init?.headers as Record<string, string> | undefined)?.["X-Write-Intent"];
      if (u.includes("/demographics") && intent === "dry-run") {
        return Promise.resolve(jsonResponse(dryRunPlan));
      }
      if (u.includes("/demographics") && intent === "commit") {
        return Promise.resolve(jsonResponse(committedPlan));
      }
      if (u.includes("/write-audit-recent")) {
        return Promise.resolve(jsonResponse({ sqliteConfigured: true, sqliteUsable: true, entries: [] }));
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    });
    const onCommitted = vi.fn();
    renderPilot({ fetchImpl, onCommitted });

    const displayInput = container.querySelector(
      'input[aria-label="Display name"], label span',
    );
    const nameInput = [...container.querySelectorAll("input")].find(
      (el) => el.previousElementSibling?.textContent === "Display name",
    );
    await act(async () => {
      if (nameInput) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(nameInput, "Updated Sandbox Label");
        nameInput.dispatchEvent(new Event("input", { bubbles: true }));
        nameInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    const previewBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Preview changes"),
    );
    await act(async () => {
      previewBtn?.click();
    });

    expect(container.textContent).toContain("patient.demographics.update");

    const applyBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Apply demographics"),
    );
    await act(async () => {
      applyBtn?.click();
    });

    expect(window.confirm).toHaveBeenCalledWith(PATIENT_DEMOGRAPHICS_WRITE_CONFIRM);
    expect(onCommitted).toHaveBeenCalledTimes(1);
    const text = container.textContent ?? "";
    assertNoForbiddenDomTokens(text);
    expect(containsForbiddenWriteResultToken(text)).toBe(false);
    expect(text).not.toContain("TELEPHONE");
    expect(displayInput).toBeTruthy();
  });
});
