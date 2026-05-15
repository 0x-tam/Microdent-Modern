// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BridgeClientError } from "@microdent/bridge-client";
import {
  PatientProfilePanel,
  safePatientAppointmentsError,
  safePatientProfileError,
} from "./PatientProfilePanel.js";
import { defaultPatientApptRange, inclusiveDayCount } from "./patient-appointments-range.js";

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

const syntheticAppt = {
  id: "9001",
  date: "2026-05-20",
  time: "09:30",
  durationSlots: 2,
  periodMinutes: 30,
  room: 3,
  status: 1,
  docId: 5,
  patId: "42",
  patient: {
    patientId: "42",
    displayName: "LEAKED SCHEDULE PAT_NAME",
    chartNumber: "SHOULD-NOT-SHOW",
  },
  procClass: 2,
  vacId: 0,
  recall: 0,
  unreason: 0,
  missed: true,
  hasComment: true,
};

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function clickAppointmentsTab(container: HTMLElement): Promise<void> {
  const tab = container.querySelector("#patient-tab-appointments");
  if (!(tab instanceof HTMLButtonElement)) {
    throw new Error("Appointments tab button not found");
  }
  await act(async () => {
    tab.click();
  });
}

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

describe("safePatientAppointmentsError", () => {
  it("maps invalid range to a neutral message", () => {
    const err = new BridgeClientError("n", { kind: "invalid_argument" });
    expect(safePatientAppointmentsError(err)).toMatch(/date range/i);
  });
});

describe("defaultPatientApptRange", () => {
  it("spans 180 inclusive days (90 before through 90 after anchor day) within API cap", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 15));
    const { from, to } = defaultPatientApptRange();
    expect(from).toBe("2026-02-14");
    expect(to).toBe("2026-08-13");
    expect(inclusiveDayCount(from, to)).toBe(180);
    expect(inclusiveDayCount(from, to)).toBeLessThanOrEqual(365);
    vi.useRealTimers();
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
    vi.useRealTimers();
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
    expect(container.textContent).toMatch(/Find a patient in the top bar/i);
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
    await flush();
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
    await flush();
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
    await flush();
    expect(container.textContent).not.toContain("x");
    expect(container.textContent).toMatch(/could not be loaded|Try again/i);
  });

  it("does not render blocked field names as UI copy on profile summary", async () => {
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
    await flush();
    const t = container.textContent ?? "";
    expect(t).not.toMatch(/HOME_PHONE|STREET|EMAIL|QUICKNOTE|PAT_M_COMP|INSURANCE|raw json/i);
    expect(t).not.toContain("PAT_NAME");
    expect(t).not.toContain("TELEPHONE");
    expect(t).not.toContain("COMMENT");
    expect(t).not.toMatch(/\braw row\b/i);
  });

  it("does not surface blocked DBF field labels on the empty state", async () => {
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
    const t = container.textContent ?? "";
    expect(t).not.toContain("PAT_NAME");
    expect(t).not.toContain("TELEPHONE");
    expect(t).not.toContain("COMMENT");
    expect(t).not.toMatch(/\braw row\b/i);
  });

  it("exposes an Appointments tab that can be activated", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/profile")) {
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
    await flush();
    const tab = container.querySelector("#patient-tab-appointments");
    expect(tab).toBeTruthy();
    expect(tab?.getAttribute("aria-selected")).toBe("false");
    await clickAppointmentsTab(container);
    expect(tab?.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector("#patient-panel-appointments")).toBeTruthy();
  });

  it("fetches appointments only when the Appointments tab is active and bridge is connected", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/profile")) {
        return Promise.resolve(jsonResponse(validProfile));
      }
      if (u.includes("/appointments")) {
        return Promise.resolve(jsonResponse({ appointments: [] }));
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
    await flush();
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/appointments"))).toBe(false);

    await clickAppointmentsTab(container);
    await flush();

    const apptUrl = fetchImpl.mock.calls.map((c) => String(c[0])).find((u) => u.includes("/appointments"));
    expect(apptUrl).toContain("/v1/patients/42/appointments");
    expect(apptUrl).toMatch(/from=\d{4}-\d{2}-\d{2}/);
    expect(apptUrl).toMatch(/to=\d{4}-\d{2}-\d{2}/);
  });

  it("does not fetch appointments when the bridge is offline", async () => {
    const fetchImpl = vi.fn();
    await act(async () => {
      root.render(
        <PatientProfilePanel
          patientId="42"
          bridgePhase="offline"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onBackToday={() => {}}
          onClearPatient={() => {}}
        />,
      );
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("renders safe appointment fields when load succeeds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 15));

    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/profile")) {
        return Promise.resolve(jsonResponse(validProfile));
      }
      if (u.includes("/appointments")) {
        return Promise.resolve(jsonResponse({ appointments: [syntheticAppt] }));
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
    await flush();
    await clickAppointmentsTab(container);
    await flush();

    const t = container.textContent ?? "";
    expect(t).toContain("09:30");
    expect(t).toContain("60 min");
    expect(t).toContain("Room 3");
    expect(t).toContain("Doctor 5");
    expect(t).toContain("Proc 2");
    expect(t).toContain("Scheduled");
    expect(t).toContain("Missed");
    expect(t).toContain("Note hidden");
    expect(t).not.toContain("LEAKED SCHEDULE PAT_NAME");
    expect(t).not.toContain("SHOULD-NOT-SHOW");
    expect(t).not.toContain("PAT_NAME");
    expect(t).not.toContain("TELEPHONE");
    expect(t).not.toContain("COMMENT");
    expect(t).not.toMatch(/\braw row\b/i);
  });

  it("shows empty state when no appointments are returned", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/profile")) {
        return Promise.resolve(jsonResponse(validProfile));
      }
      if (u.includes("/appointments")) {
        return Promise.resolve(jsonResponse({ appointments: [] }));
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
    await flush();
    await clickAppointmentsTab(container);
    await flush();
    expect(container.textContent).toMatch(/No appointments found/i);
  });

  it("shows error state when appointments cannot be loaded", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/profile")) {
        return Promise.resolve(jsonResponse(validProfile));
      }
      if (u.includes("/appointments")) {
        return Promise.resolve(
          jsonResponse({ error: { code: "PATIENT_APPOINTMENTS_ERROR", message: "secret" } }, 500),
        );
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
    await flush();
    await clickAppointmentsTab(container);
    await flush();
    expect(container.textContent).not.toContain("secret");
    expect(container.textContent).toMatch(/Appointment history could not be loaded|Try again/i);
  });
});
