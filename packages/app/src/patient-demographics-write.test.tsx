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
  dataRootConfigured: true,
  backupDirConfigured: true,
  sqlitePathConfigured: true,
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

const DISALLOWED_FIELD_LABELS = ["Phone", "Telephone", "Address", "Insurance", "Notes"];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function applyBtn(container: ParentNode) {
  return container.querySelector<HTMLButtonElement>('[data-testid="patient-demographics-apply"]');
}

function previewBtn(container: ParentNode) {
  return container.querySelector<HTMLButtonElement>('[data-testid="patient-demographics-preview"]');
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function displayNameInput(container: ParentNode) {
  return container.querySelector<HTMLInputElement>('input[aria-label="Display name"]');
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

  it("shows unavailable copy when sandbox writes are not ready", () => {
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
    expect(container.querySelector('[data-testid="patient-demographics-write-unavailable"]')).not.toBeNull();
    expect(container.textContent).toContain("Sandbox writes are not ready");
    expect(previewBtn(container)).toBeNull();
  });

  it("links doctor id field to helper hint via aria-describedby", () => {
    renderPilot();
    const doctorInput = container.querySelector<HTMLInputElement>('input[aria-label="Doctor id"]');
    expect(doctorInput?.getAttribute("aria-describedby")).toBe("patient-demographics-doctor-hint");
    expect(container.querySelector("#patient-demographics-doctor-hint")?.textContent).toMatch(/doctor id/i);
  });

  it("does not expose phone or address fields", () => {
    renderPilot();
    expect(container.querySelector('input[type="tel"]')).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
    const labels = [...container.querySelectorAll("label span")].map((el) => el.textContent ?? "");
    for (const label of DISALLOWED_FIELD_LABELS) {
      expect(labels).not.toContain(label);
    }
    const ariaLabels = [...container.querySelectorAll("input, select")].map(
      (el) => el.getAttribute("aria-label") ?? "",
    );
    for (const label of DISALLOWED_FIELD_LABELS) {
      expect(ariaLabels.some((a) => a.toLowerCase() === label.toLowerCase())).toBe(false);
    }
  });

  it("keeps Apply disabled until preview succeeds", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/demographics")) {
        return Promise.resolve(jsonResponse(dryRunPlan));
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    });
    renderPilot({ fetchImpl });

    const apply = applyBtn(container);
    expect(apply).not.toBeNull();
    expect(apply?.disabled).toBe(true);

    const nameInput = displayNameInput(container);
    expect(nameInput).not.toBeNull();
    await act(async () => {
      if (nameInput) setInputValue(nameInput, "Updated Sandbox Label");
    });
    expect(applyBtn(container)?.disabled).toBe(true);

    await act(async () => {
      previewBtn(container)?.click();
    });
    expect(applyBtn(container)?.disabled).toBe(false);
    expect(container.textContent).toContain("patient.demographics.update");
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

    const nameInput = displayNameInput(container);
    await act(async () => {
      if (nameInput) setInputValue(nameInput, "Updated Sandbox Label");
    });

    await act(async () => {
      previewBtn(container)?.click();
    });

    const apply = applyBtn(container);
    expect(apply?.disabled).toBe(false);

    await act(async () => {
      apply?.click();
    });

    expect(window.confirm).toHaveBeenCalledWith(PATIENT_DEMOGRAPHICS_WRITE_CONFIRM);
    expect(onCommitted).toHaveBeenCalledTimes(1);

    const demographicsCalls = fetchImpl.mock.calls.filter(([input]) =>
      String(input).includes("/demographics"),
    );
    expect(demographicsCalls.some(([, init]) => {
      const headers = init?.headers as Record<string, string> | undefined;
      return headers?.["X-Write-Intent"] === "dry-run";
    })).toBe(true);
    expect(demographicsCalls.some(([, init]) => {
      const headers = init?.headers as Record<string, string> | undefined;
      return headers?.["X-Write-Intent"] === "commit";
    })).toBe(true);

    const text = container.textContent ?? "";
    assertNoForbiddenDomTokens(text);
    expect(containsForbiddenWriteResultToken(text)).toBe(false);
    expect(text).not.toContain("TELEPHONE");
  });

  it("re-disables Apply after editing following a successful preview", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes("/demographics")) {
        return Promise.resolve(jsonResponse(dryRunPlan));
      }
      return Promise.reject(new Error("unexpected"));
    });
    renderPilot({ fetchImpl });

    const nameInput = displayNameInput(container);
    await act(async () => {
      if (nameInput) setInputValue(nameInput, "Updated Sandbox Label");
    });
    await act(async () => {
      previewBtn(container)?.click();
    });
    expect(applyBtn(container)?.disabled).toBe(false);

    await act(async () => {
      if (nameInput) setInputValue(nameInput, "Another label");
    });
    expect(applyBtn(container)?.disabled).toBe(true);
  });
});
