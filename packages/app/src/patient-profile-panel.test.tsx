// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BridgeClientError } from "@microdent/bridge-client";
import { PatientProfilePanel, safePatientProfileError } from "./PatientProfilePanel.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const validProfile = {
  patientId: "42",
  chartNumber: "SYN-CHART",
  displayName: "Synthetic Profile Patient",
  phoneMask: "…4242",
  reverseName: "Patient, Synthetic",
  active: true,
  doctorId: "7",
  entryDate: "2020-03-01",
  lastVisit: "2024-01-15",
};

describe("safePatientProfileError", () => {
  it("maps PATIENT_NOT_FOUND to a neutral message", () => {
    const err = new BridgeClientError("n", {
      kind: "http",
      status: 404,
      apiCode: "PATIENT_NOT_FOUND",
    });
    expect(safePatientProfileError(err)).toMatch(/not found/i);
  });

  it("maps unknown errors to a generic message", () => {
    expect(safePatientProfileError(new Error("secret stack"))).toMatch(/could not be loaded/i);
  });
});

describe("PatientProfilePanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("shows no-selection copy when patientId is null", async () => {
    await act(async () => {
      root.render(
        <PatientProfilePanel
          patientId={null}
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          onBackToday={() => {}}
          onClearPatient={() => {}}
        />,
      );
    });
    expect(container.textContent).toMatch(/No patient selected/i);
  });

  it("does not call profile fetch when the bridge is offline", async () => {
    const fetchImpl = vi.fn();
    await act(async () => {
      root.render(
        <PatientProfilePanel
          patientId="12"
          bridgePhase="offline"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onBackToday={() => {}}
          onClearPatient={() => {}}
        />,
      );
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/Clinic service offline/i);
  });

  it("loads profile via getPatientProfile URL and shows safe fields", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/patients/42/profile")) {
        return Promise.resolve(jsonResponse(validProfile));
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    });

    await act(async () => {
      root.render(
        <PatientProfilePanel
          patientId="42"
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onBackToday={() => {}}
          onClearPatient={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const profileUrl = fetchImpl.mock.calls.map((c) => String(c[0])).find((u) => u.includes("/v1/patients/"));
    expect(profileUrl).toContain("/v1/patients/42/profile");
    expect(container.textContent).toContain("Synthetic Profile Patient");
    expect(container.textContent).toContain("Chart number");
    expect(container.textContent).toContain("SYN-CHART");
    expect(container.textContent).toContain("…4242");
    expect(container.textContent).toContain("Active");
    expect(container.textContent).toContain("Provider id");
    expect(container.textContent).toContain("7");
    expect(container.textContent).toContain("2020-03-01");
    expect(container.textContent).toContain("2024-01-15");
  });

  it("shows not found when the bridge returns PATIENT_NOT_FOUND", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        jsonResponse({ error: { code: "PATIENT_NOT_FOUND", message: "patient not found" } }, 404),
      ),
    );
    await act(async () => {
      root.render(
        <PatientProfilePanel
          patientId="99"
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onBackToday={() => {}}
          onClearPatient={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toMatch(/Patient not found/i);
    expect(container.textContent).not.toContain("patient not found");
  });

  it("shows a generic error state on HTTP 500", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(jsonResponse({ error: { code: "PATIENT_PROFILE_ERROR", message: "x" } }, 500)),
    );
    await act(async () => {
      root.render(
        <PatientProfilePanel
          patientId="1"
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onBackToday={() => {}}
          onClearPatient={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).not.toContain("x");
    expect(container.textContent).toMatch(/could not be loaded|Try again/i);
  });

  it("does not render blocked field names as UI copy", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(validProfile)));
    await act(async () => {
      root.render(
        <PatientProfilePanel
          patientId="42"
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onBackToday={() => {}}
          onClearPatient={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const t = container.textContent ?? "";
    expect(t).not.toMatch(/HOME_PHONE|STREET|EMAIL|QUICKNOTE|PAT_M_COMP|INSURANCE|raw json/i);
  });
});
