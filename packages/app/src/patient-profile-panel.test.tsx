// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BridgeClientError } from "@microdent/bridge-client";
import {
  PatientProfilePanel,
  PROFILE_TAB_DESCRIPTIONS,
  safePatientAppointmentsError,
  safePatientChartError,
  safePatientLedgerError,
  safePatientMedicalSummaryError,
  safePatientProfileError,
  safePatientTreatmentsError,
} from "./PatientProfilePanel.js";
import { PATIENT_DEMOGRAPHICS_WRITE_CONFIRM } from "./patient-demographics-write.js";
import { PATIENT_TAB_HIDDEN_FIELDS_NOTE } from "./read-only-ui-copy.js";
import { defaultPatientApptRange, inclusiveDayCount } from "./patient-appointments-range.js";
import { assertNoForbiddenDomTokens } from "./read-only-smoke-fixtures.js";
import { wrapFetchWithSummaryPrefetchFallback } from "./read-only-summary-prefetch-mock.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setSearchInputValue(input: HTMLInputElement, value: string): void {
  const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  proto?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function hasPageSearchDropdown(container: HTMLElement): boolean {
  return container.querySelector("#app-patients-page-search-listbox") !== null;
}

const syntheticDoctors = {
  doctors: [
    { doctorId: "5", displayName: "Synthetic Provider ApptRow", active: true },
    { doctorId: "7", displayName: "Synthetic Provider Profile", active: true },
  ],
};

function withReferenceDoctors(
  inner: (input: RequestInfo | URL) => Promise<Response>,
  doctors: unknown | "fail" = syntheticDoctors,
  patientId = "42",
): ReturnType<typeof vi.fn> {
  const wrappedInner = wrapFetchWithSummaryPrefetchFallback(inner, patientId);
  return vi.fn((input: RequestInfo | URL) => {
    const u = String(input);
    if (u.includes("/v1/reference/doctors")) {
      if (doctors === "fail") {
        return Promise.resolve(new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } }));
      }
      return Promise.resolve(jsonResponse(doctors));
    }
    return wrappedInner(input);
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

async function clickMedicalTab(container: HTMLElement): Promise<void> {
  const tab = container.querySelector("#patient-tab-medical");
  if (!(tab instanceof HTMLButtonElement)) {
    throw new Error("Medical tab button not found");
  }
  await act(async () => {
    tab.click();
  });
}

async function clickTreatmentsTab(container: HTMLElement): Promise<void> {
  const tab = container.querySelector("#patient-tab-treatments");
  if (!(tab instanceof HTMLButtonElement)) {
    throw new Error("Treatments tab button not found");
  }
  await act(async () => {
    tab.click();
  });
}

async function clickChartTab(container: HTMLElement): Promise<void> {
  const tab = container.querySelector("#patient-tab-chart");
  if (!(tab instanceof HTMLButtonElement)) {
    throw new Error("Chart tab button not found");
  }
  await act(async () => {
    tab.click();
  });
}

async function clickLedgerTab(container: HTMLElement): Promise<void> {
  const tab = container.querySelector("#patient-tab-ledger");
  if (!(tab instanceof HTMLButtonElement)) {
    throw new Error("Ledger tab button not found");
  }
  await act(async () => {
    tab.click();
  });
}

const PRIVACY_NOTE =
  "Problem description, allergy free text, and medical notes remain hidden until field mapping is reviewed." as const;

const TREATMENTS_PRIVACY_NOTE =
  "Procedure memos, per-line descriptions, fee columns, and raw OPERTBL rows are never exposed by this route." as const;

const CHART_PRIVACY_NOTE =
  "Chart memos, layer code legends, clinical labels, and raw CHARTDBF rows are never exposed by this route." as const;

const LEDGER_PRIVACY_NOTE =
  "Ledger amounts, memo text, insurance identifiers, plan numbers, and raw TRANS rows are never exposed by this route." as const;

const syntheticTreatment = {
  treatmentId: "100",
  patientId: "42",
  date: "2024-06-01",
  tooth: 14,
  procedureCode: "SYN01",
  procedureLabel: "Synthetic dictionary label",
  doctorId: "3",
  doctorLabel: "Synthetic Provider Three",
  status: 2,
  hasDescription: true,
};

function treatmentsFetchHandler(
  body: unknown,
): (input: RequestInfo | URL) => Promise<Response> {
  return (input) => {
    const u = String(input);
    if (u.includes("/profile")) {
      return Promise.resolve(jsonResponse(validProfile));
    }
    if (u.includes("/treatments")) {
      return Promise.resolve(jsonResponse(body));
    }
    return Promise.reject(new Error(`unexpected ${u}`));
  };
}

const syntheticChartEntry = {
  chartEntryId: "14-1-1",
  patientId: "42",
  toothNumber: 14,
  chartType: 1,
  treated: true,
  hasNote: true,
};

const syntheticLedgerEntry = {
  ledgerEntryId: "200",
  patientId: "42",
  date: "2024-06-01",
  chargeTypeCode: 2,
  adjustmentTypeCode: 0,
  paymentTypeCode: 100,
  isCardPayment: true,
  hasDescription: true,
};

function ledgerFetchHandler(body: unknown): (input: RequestInfo | URL) => Promise<Response> {
  return (input) => {
    const u = String(input);
    if (u.includes("/profile")) {
      return Promise.resolve(jsonResponse(validProfile));
    }
    if (u.includes("/ledger")) {
      return Promise.resolve(jsonResponse(body));
    }
    return Promise.reject(new Error(`unexpected ${u}`));
  };
}

function chartFetchHandler(body: unknown): (input: RequestInfo | URL) => Promise<Response> {
  return (input) => {
    const u = String(input);
    if (u.includes("/profile")) {
      return Promise.resolve(jsonResponse(validProfile));
    }
    if (u.includes("/chart")) {
      return Promise.resolve(jsonResponse(body));
    }
    return Promise.reject(new Error(`unexpected ${u}`));
  };
}

const nullConditions = {
  hospital: null,
  physician: null,
  medicine: null,
  ill: null,
  reaction: null,
  bleeding: null,
  allergic: null,
  heartTrouble: null,
  congenitalHeart: null,
  heartMurmur: null,
  highBloodPressure: null,
  lowBloodPressure: null,
  anemia: null,
  rheumaticFever: null,
  jaundice: null,
  asthma: null,
  cough: null,
  kidneyTrouble: null,
  med1: null,
  diabetes: null,
  tuberculosis: null,
  hepatitis: null,
  arthritis: null,
  stroke: null,
  epilepsy: null,
  psychiatric: null,
  sinusTrouble: null,
  pregnant: null,
  ulcers: null,
  aids: null,
  med2: null,
};

function medicalFetchHandler(
  summary: unknown,
): (input: RequestInfo | URL) => Promise<Response> {
  return (input) => {
    const u = String(input);
    if (u.includes("/profile")) {
      return Promise.resolve(jsonResponse(validProfile));
    }
    if (u.includes("/medical-summary")) {
      return Promise.resolve(jsonResponse(summary));
    }
    return Promise.reject(new Error(`unexpected ${u}`));
  };
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

describe("safePatientLedgerError", () => {
  it("maps TRANS_DBF_NOT_FOUND to admin copy", () => {
    const err = new BridgeClientError("n", {
      kind: "http",
      status: 404,
      apiCode: "TRANS_DBF_NOT_FOUND",
    });
    expect(safePatientLedgerError(err)).toMatch(/not available on this bridge/i);
  });

  it("maps unknown errors to a generic message", () => {
    expect(safePatientLedgerError(new Error("secret"))).toMatch(/could not be loaded/i);
  });
});

describe("safePatientTreatmentsError", () => {
  it("maps OPERTBL_DBF_NOT_FOUND to admin copy", () => {
    const err = new BridgeClientError("n", {
      kind: "http",
      status: 404,
      apiCode: "OPERTBL_DBF_NOT_FOUND",
    });
    expect(safePatientTreatmentsError(err)).toMatch(/not available on this bridge/i);
  });

  it("maps unknown errors to a generic message", () => {
    expect(safePatientTreatmentsError(new Error("secret"))).toMatch(/could not be loaded/i);
  });
});

describe("safePatientMedicalSummaryError", () => {
  it("maps MEDICAL_DBF_NOT_FOUND to admin copy", () => {
    const err = new BridgeClientError("n", {
      kind: "http",
      status: 404,
      apiCode: "MEDICAL_DBF_NOT_FOUND",
    });
    expect(safePatientMedicalSummaryError(err)).toMatch(/not available on this bridge/i);
  });

  it("maps unknown errors to a generic message", () => {
    expect(safePatientMedicalSummaryError(new Error("secret"))).toMatch(/could not be loaded/i);
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
    vi.useFakeTimers();
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

  it("shows embedded patient search when patientId is null", async () => {
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
    expect(container.querySelector("input#app-patients-page-search-input")).toBeTruthy();
    expect(container.textContent).toMatch(/Find a patient/i);
    expect(container.textContent).toMatch(/no full patient directory/i);
    expect(container.textContent).not.toMatch(/No patient selected/i);
    expect(container.textContent).not.toContain("Synthetic Profile Patient");
  });

  it("does not fetch search when the bridge is offline on the Patients page", async () => {
    const fetchImpl = vi.fn();
    await act(async () => {
      root.render(
        <PatientProfilePanel
          patientId={null}
          bridgePhase="offline"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onBackToday={() => {}}
          onClearPatient={() => {}}
        />,
      );
    });
    const input = container.querySelector("input#app-patients-page-search-input") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(container.textContent).toMatch(/Connect the clinic service/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("calls patient search from the Patients page when connected and opens profile on select", async () => {
    const searchBody = {
      results: [
        {
          patientId: "42",
          chartNumber: "SYN-CHART",
          displayName: "Synthetic Profile Patient",
          phoneMask: "…4242",
        },
      ],
    };
    const fetchImpl = withReferenceDoctors((input) => {
      const u = String(input);
      if (u.includes("/v1/patients/search")) {
        return Promise.resolve(jsonResponse(searchBody));
      }
      if (u.includes("/v1/patients/42/profile")) {
        return Promise.resolve(jsonResponse(validProfile));
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    });
    const onPatientRecordSelect = vi.fn();

    await act(async () => {
      root.render(
        <PatientProfilePanel
          patientId={null}
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onBackToday={() => {}}
          onClearPatient={() => {}}
          onPatientRecordSelect={onPatientRecordSelect}
        />,
      );
    });

    const input = container.querySelector("input#app-patients-page-search-input") as HTMLInputElement;
    await act(async () => {
      setSearchInputValue(input, "Sy");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/v1/patients/search"))).toBe(true);
    expect(container.textContent).toContain("Synthetic Profile Patient");

    const hitBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Synthetic Profile Patient"),
    );
    await act(async () => {
      hitBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onPatientRecordSelect).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: "42", displayName: "Synthetic Profile Patient" }),
    );
    expect(hasPageSearchDropdown(container)).toBe(false);

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
    });
    expect(container.textContent).toContain("Synthetic Profile Patient");
    expect(container.querySelector("#patient-panel-summary")).toBeTruthy();
  });

  it("does not surface forbidden legacy field labels in page search results", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/patients/search")) {
        return jsonResponse({
          results: [
            {
              patientId: "99",
              chartNumber: "X-1",
              displayName: "Synthetic Search Only",
              phoneMask: "…9900",
            },
          ],
        });
      }
      return new Response("{}", { status: 404 });
    });

    await act(async () => {
      root.render(
        <PatientProfilePanel
          patientId={null}
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onBackToday={() => {}}
          onClearPatient={() => {}}
        />,
      );
    });

    const input = container.querySelector("input#app-patients-page-search-input") as HTMLInputElement;
    await act(async () => {
      setSearchInputValue(input, "Sy");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Synthetic Search Only");
    assertNoForbiddenDomTokens(text);
    expect(text).not.toMatch(/555[- ]?\d{3}[- ]?\d{4}/);
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
    const fetchImpl = withReferenceDoctors((input) => {
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
    expect(container.textContent).toContain("Provider");
    expect(container.textContent).toContain("Synthetic Provider Profile");
    expect(container.textContent).not.toMatch(/\bProvider id\b/);
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
    const fetchImpl = withReferenceDoctors((input) => {
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
    const summary = container.querySelector("#patient-panel-summary");
    const t = summary?.textContent ?? "";
    expect(t).not.toMatch(/HOME_PHONE|STREET|EMAIL|QUICKNOTE|PAT_M_COMP|\bINSURANCE\b|raw json/i);
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

  it("prefetches appointments on Summary and refetches when Appointments tab opens", async () => {
    const fetchImpl = withReferenceDoctors((input) => {
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
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/appointments"))).toBe(true);

    await clickAppointmentsTab(container);
    await flush();

    const apptUrls = fetchImpl.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/appointments"));
    expect(apptUrls.length).toBeGreaterThanOrEqual(2);
    expect(apptUrls[0]).toContain("/v1/patients/42/appointments");
    expect(apptUrls[0]).toMatch(/from=\d{4}-\d{2}-\d{2}/);
    expect(apptUrls[0]).toMatch(/to=\d{4}-\d{2}-\d{2}/);
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

    const fetchImpl = withReferenceDoctors((input) => {
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
    expect(t).toContain("Synthetic Provider ApptRow");
    expect(t).not.toMatch(/\bDoctor 5\b/);
    expect(t).toContain("Procedure class 2");
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

  it("falls back to Unknown provider {id} on appointments when doctor is missing from reference", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 15));

    const fetchImpl = withReferenceDoctors((input) => {
      const u = String(input);
      if (u.includes("/profile")) {
        return Promise.resolve(jsonResponse(validProfile));
      }
      if (u.includes("/appointments")) {
        return Promise.resolve(jsonResponse({ appointments: [syntheticAppt] }));
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    }, { doctors: [{ doctorId: "7", displayName: "Synthetic Provider Profile", active: true }] });

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

    expect(container.textContent).toContain("Unknown provider 5");
  });

  it("does not show Medical tab when no patient is selected", async () => {
    const fetchImpl = vi.fn();
    await act(async () => {
      root.render(
        <PatientProfilePanel
          patientId={null}
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onBackToday={() => {}}
          onClearPatient={() => {}}
        />,
      );
    });
    expect(container.querySelector("#patient-tab-medical")).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("exposes a Medical tab that can be activated", async () => {
    const fetchImpl = withReferenceDoctors((input) => {
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
    const tab = container.querySelector("#patient-tab-medical");
    expect(tab).toBeTruthy();
    expect(tab?.getAttribute("aria-selected")).toBe("false");
    await clickMedicalTab(container);
    expect(tab?.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector("#patient-panel-medical")).toBeTruthy();
  });

  it("prefetches medical summary on Summary and refetches when Medical tab opens", async () => {
    const fetchImpl = withReferenceDoctors(medicalFetchHandler({
      patientId: "42",
      hasMedicalRecord: false,
      hasSensitiveMedicalDetails: false,
      lastUpdated: null,
      lastDentalVisit: null,
      flaggedConditionCount: 0,
      conditions: null,
      privacyNote: PRIVACY_NOTE,
    }));

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
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/medical-summary"))).toBe(true);

    await clickMedicalTab(container);
    await flush();

    const medUrls = fetchImpl.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/medical-summary"));
    expect(medUrls.length).toBeGreaterThanOrEqual(2);
    expect(medUrls[0]).toContain("/v1/patients/42/medical-summary");
  });

  it("does not fetch medical summary when the bridge is offline", async () => {
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

  it("shows no medical record state", async () => {
    const fetchImpl = withReferenceDoctors(
      medicalFetchHandler({
        patientId: "42",
        hasMedicalRecord: false,
        hasSensitiveMedicalDetails: false,
        lastUpdated: null,
        lastDentalVisit: null,
        flaggedConditionCount: 0,
        conditions: null,
        privacyNote: PRIVACY_NOTE,
      }),
    );

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
    await clickMedicalTab(container);
    await flush();
    expect(container.textContent).toMatch(/No medical record found for this patient/i);
  });

  it("shows medical record with screening flags when not sensitive", async () => {
    const fetchImpl = withReferenceDoctors(
      medicalFetchHandler({
        patientId: "42",
        hasMedicalRecord: true,
        hasSensitiveMedicalDetails: false,
        lastUpdated: "2024-06-01",
        lastDentalVisit: "2024-01-10",
        flaggedConditionCount: 2,
        conditions: { ...nullConditions, asthma: true, diabetes: true },
        privacyNote: PRIVACY_NOTE,
      }),
    );

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
    await clickMedicalTab(container);
    await flush();

    const t = container.textContent ?? "";
    expect(t).toMatch(/Medical summary is read-only/i);
    expect(t).toMatch(/Jun 1, 2024/i);
    expect(t).toMatch(/Jan 10, 2024/i);
    expect(t).toContain("2");
    expect(t).toContain("Asthma (screening)");
    expect(t).toContain("Diabetes (screening)");
    expect(t).toContain(PRIVACY_NOTE);
    expect(t).not.toMatch(/\bheartTrouble\b/);
  });

  it("shows sensitive-details layout without per-flag list", async () => {
    const fetchImpl = withReferenceDoctors(
      medicalFetchHandler({
        patientId: "42",
        hasMedicalRecord: true,
        hasSensitiveMedicalDetails: true,
        lastUpdated: "2024-06-01",
        lastDentalVisit: null,
        flaggedConditionCount: 3,
        conditions: { ...nullConditions, asthma: true, diabetes: true, med1: true },
        privacyNote: PRIVACY_NOTE,
      }),
    );

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
    await clickMedicalTab(container);
    await flush();

    const t = container.textContent ?? "";
    expect(t).toMatch(/Sensitive fields stay hidden in this read-only viewer/i);
    expect(t).toContain("3");
    expect(t).not.toContain("Asthma (screening)");
    expect(t).not.toContain("Diabetes (screening)");
    expect(t).toContain(PRIVACY_NOTE);
  });

  it("does not render forbidden medical field tokens in the Medical tab", async () => {
    const fetchImpl = withReferenceDoctors(
      medicalFetchHandler({
        patientId: "42",
        hasMedicalRecord: true,
        hasSensitiveMedicalDetails: false,
        lastUpdated: "2024-06-01",
        lastDentalVisit: null,
        flaggedConditionCount: 1,
        conditions: { ...nullConditions, asthma: true },
        privacyNote: PRIVACY_NOTE,
      }),
    );

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
    await clickMedicalTab(container);
    await flush();

    const t = container.textContent ?? "";
    expect(t).not.toMatch(/\b(PROBLEM|ALLERGY_TO|NOTES)\b/);
    expect(t).not.toMatch(/\braw row\b/i);
    expect(t).not.toContain("SYNTHETIC_MEDICAL_FREE_TEXT");
    assertNoForbiddenDomTokens(t);
  });

  it("shows error state when medical summary cannot be loaded", async () => {
    const fetchImpl = withReferenceDoctors((input) => {
      const u = String(input);
      if (u.includes("/profile")) {
        return Promise.resolve(jsonResponse(validProfile));
      }
      if (u.includes("/medical-summary")) {
        return Promise.resolve(
          jsonResponse({ error: { code: "MEDICAL_SUMMARY_ERROR", message: "secret leak" } }, 500),
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
    await clickMedicalTab(container);
    await flush();
    expect(container.textContent).not.toContain("secret leak");
    expect(container.textContent).toMatch(/medical summary could not be loaded|Try again/i);
  });

  it("exposes a Treatments tab that can be activated", async () => {
    const fetchImpl = withReferenceDoctors((input) => {
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
    const tab = container.querySelector("#patient-tab-treatments");
    expect(tab).toBeTruthy();
    expect(tab?.getAttribute("aria-selected")).toBe("false");
    await clickTreatmentsTab(container);
    expect(tab?.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector("#patient-panel-treatments")).toBeTruthy();
  });

  it("prefetches treatments on Summary and refetches when Treatments tab opens", async () => {
    const fetchImpl = withReferenceDoctors(
      treatmentsFetchHandler({
        patientId: "42",
        treatments: [],
        truncated: false,
        privacyNote: TREATMENTS_PRIVACY_NOTE,
      }),
    );

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
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/treatments"))).toBe(true);

    await clickTreatmentsTab(container);
    await flush();

    const txUrls = fetchImpl.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/treatments"));
    expect(txUrls.length).toBeGreaterThanOrEqual(2);
    expect(txUrls[0]).toContain("/v1/patients/42/treatments");
  });

  it("does not fetch treatments when the bridge is offline", async () => {
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

  it("renders safe treatment fields when load succeeds", async () => {
    const fetchImpl = withReferenceDoctors(
      treatmentsFetchHandler({
        patientId: "42",
        treatments: [syntheticTreatment],
        truncated: false,
        privacyNote: TREATMENTS_PRIVACY_NOTE,
      }),
    );

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
    await clickTreatmentsTab(container);
    await flush();

    const t = container.textContent ?? "";
    expect(t).toMatch(/Procedure history is read-only/i);
    expect(t).toContain("SYN01");
    expect(t).toContain("Synthetic dictionary label");
    expect(t).toContain("Tooth 14");
    expect(t).toContain("Synthetic Provider Three");
    expect(t).toContain("Legacy status code 2 (unmapped)");
    expect(t).toContain("Description hidden");
    expect(t).toContain(TREATMENTS_PRIVACY_NOTE);
    expect(t).not.toMatch(/\bDoctor 3\b/);
  });

  it("shows empty state when no treatments are returned", async () => {
    const fetchImpl = withReferenceDoctors(
      treatmentsFetchHandler({
        patientId: "42",
        treatments: [],
        truncated: false,
        privacyNote: TREATMENTS_PRIVACY_NOTE,
      }),
    );

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
    await clickTreatmentsTab(container);
    await flush();
    expect(container.textContent).toMatch(/No treatments found/i);
  });

  it("shows error state when treatments cannot be loaded", async () => {
    const fetchImpl = withReferenceDoctors((input) => {
      const u = String(input);
      if (u.includes("/profile")) {
        return Promise.resolve(jsonResponse(validProfile));
      }
      if (u.includes("/treatments")) {
        return Promise.resolve(
          jsonResponse({ error: { code: "PATIENT_TREATMENTS_ERROR", message: "secret leak" } }, 500),
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
    await clickTreatmentsTab(container);
    await flush();
    expect(container.textContent).not.toContain("secret leak");
    expect(container.textContent).toMatch(/Treatment history could not be loaded|Try again/i);
  });

  it("does not render forbidden treatment field tokens in the Treatments tab", async () => {
    const fetchImpl = withReferenceDoctors(
      treatmentsFetchHandler({
        patientId: "42",
        treatments: [syntheticTreatment],
        truncated: false,
        privacyNote: TREATMENTS_PRIVACY_NOTE,
      }),
    );

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
    await clickTreatmentsTab(container);
    await flush();

    const t = container.textContent ?? "";
    assertNoForbiddenDomTokens(t);
    expect(t).not.toMatch(/\b(FEE|CHARGE)\b/);
    expect(t).not.toContain("SYNTHETIC_TREATMENT_DESC_TOKEN");
    expect(t).not.toContain("SYNTHETIC_PATIENT_SPECIFIC_PROCEDURE_TEXT");
  });

  it("enables Ledger tab and does not show a disabled Payments placeholder", async () => {
    const fetchImpl = withReferenceDoctors((input) => {
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
    const disabled = [...container.querySelectorAll(".app-patient-profile__tab[disabled]")];
    expect(disabled).toHaveLength(0);
    const ledgerTab = container.querySelector("#patient-tab-ledger");
    expect(ledgerTab).toBeTruthy();
    expect(ledgerTab?.hasAttribute("disabled")).toBe(false);
    expect(ledgerTab?.textContent ?? "").toMatch(/Ledger/);
    expect(container.textContent ?? "").not.toMatch(/\bPayments\b/);
  });

  it("exposes a Ledger tab that can be activated", async () => {
    const fetchImpl = withReferenceDoctors(
      ledgerFetchHandler({
        patientId: "42",
        entries: [],
        truncated: false,
        privacyNote: LEDGER_PRIVACY_NOTE,
      }),
    );
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
    const tab = container.querySelector("#patient-tab-ledger");
    expect(tab?.getAttribute("aria-selected")).toBe("false");
    await clickLedgerTab(container);
    expect(tab?.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector("#patient-panel-ledger")).toBeTruthy();
  });

  it("prefetches ledger on Summary and refetches when Ledger tab opens", async () => {
    const fetchImpl = withReferenceDoctors(
      ledgerFetchHandler({
        patientId: "42",
        entries: [],
        truncated: false,
        privacyNote: LEDGER_PRIVACY_NOTE,
      }),
    );
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
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/ledger"))).toBe(true);
    await clickLedgerTab(container);
    await flush();
    const ledgerUrls = fetchImpl.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/ledger"));
    expect(ledgerUrls.length).toBeGreaterThanOrEqual(2);
    expect(ledgerUrls[0]).toContain("/v1/patients/42/ledger");
  });

  it("renders safe ledger fields when load succeeds", async () => {
    const fetchImpl = withReferenceDoctors(
      ledgerFetchHandler({
        patientId: "42",
        entries: [syntheticLedgerEntry],
        truncated: true,
        privacyNote: LEDGER_PRIVACY_NOTE,
      }),
    );
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
    await clickLedgerTab(container);
    await flush();
    const t = container.textContent ?? "";
    expect(t).toMatch(/Ledger lines are read-only/i);
    expect(t).toMatch(/Dollar amounts, running balances, and payment totals are never shown/i);
    expect(t).toContain("Legacy charge type code 2 (unmapped)");
    expect(t).toContain("Legacy payment type code 100 (unmapped)");
    expect(t).toContain("Card payment");
    expect(t).toContain("Description hidden");
    expect(t).toContain(LEDGER_PRIVACY_NOTE);
    expect(t).toMatch(/capped list only/i);
  });

  it("does not render forbidden ledger field tokens in the Ledger tab", async () => {
    const fetchImpl = withReferenceDoctors(
      ledgerFetchHandler({
        patientId: "42",
        entries: [syntheticLedgerEntry],
        truncated: false,
        privacyNote: LEDGER_PRIVACY_NOTE,
      }),
    );
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
    await clickLedgerTab(container);
    await flush();
    const t = container.textContent ?? "";
    expect(t).not.toMatch(/\b(AMOUNT|SAMOUNT|DESCR)\b/);
    expect(t).not.toMatch(/\braw row\b/i);
    expect(t).not.toContain("SYNTHETIC_LEDGER_MEMO_TOKEN");
    expect(t).not.toContain("9876.54");
    assertNoForbiddenDomTokens(t);
  });

  it("activates Chart tab and shows panel", async () => {
    const fetchImpl = withReferenceDoctors(
      chartFetchHandler({
        patientId: "42",
        entries: [],
        truncated: false,
        privacyNote: CHART_PRIVACY_NOTE,
      }),
    );
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
    const tab = container.querySelector("#patient-tab-chart");
    expect(tab?.getAttribute("aria-selected")).toBe("false");
    await clickChartTab(container);
    expect(tab?.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector("#patient-panel-chart")).toBeTruthy();
  });

  it("prefetches chart on Summary and refetches when Chart tab opens", async () => {
    const fetchImpl = withReferenceDoctors(
      chartFetchHandler({
        patientId: "42",
        entries: [],
        truncated: false,
        privacyNote: CHART_PRIVACY_NOTE,
      }),
    );
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
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/chart"))).toBe(true);
    await clickChartTab(container);
    await flush();
    const chartUrls = fetchImpl.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/chart"));
    expect(chartUrls.length).toBeGreaterThanOrEqual(2);
    expect(chartUrls[0]).toContain("/v1/patients/42/chart");
  });

  it("does not fetch chart when the bridge is offline", async () => {
    const fetchImpl = withReferenceDoctors(
      chartFetchHandler({
        patientId: "42",
        entries: [syntheticChartEntry],
        truncated: false,
        privacyNote: CHART_PRIVACY_NOTE,
      }),
    );
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
    await flush();
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/chart"))).toBe(false);
  });

  it("renders safe chart fields when load succeeds", async () => {
    const fetchImpl = withReferenceDoctors(
      chartFetchHandler({
        patientId: "42",
        entries: [syntheticChartEntry],
        truncated: true,
        privacyNote: CHART_PRIVACY_NOTE,
      }),
    );
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
    await clickChartTab(container);
    await flush();
    const t = container.textContent ?? "";
    expect(t).toMatch(/Dental chart is read-only/i);
    expect(t).toContain("Tooth 14");
    expect(t).toContain("Legacy chart type code 1 (unmapped)");
    expect(t).toContain("Treated");
    expect(t).toContain("Note hidden");
    expect(t).toContain(CHART_PRIVACY_NOTE);
    expect(t).toMatch(/capped/i);
  });

  it("does not render forbidden chart field tokens in the Chart tab", async () => {
    const fetchImpl = withReferenceDoctors(
      chartFetchHandler({
        patientId: "42",
        entries: [syntheticChartEntry],
        truncated: false,
        privacyNote: CHART_PRIVACY_NOTE,
      }),
    );
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
    await clickChartTab(container);
    await flush();
    const t = container.textContent ?? "";
    expect(t).not.toMatch(/\bNOTE\b/);
    expect(t).not.toMatch(/\braw row\b/i);
    expect(t).not.toContain("SYNTHETIC_CHART_MEMO_TOKEN");
    expect(t).not.toContain("LEAKED PATIENT NAME FROM CHART");
    expect(t).not.toContain("F2_S");
    assertNoForbiddenDomTokens(t);
  });

  it("still renders appointments when reference doctors fail", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 15));

    const fetchImpl = withReferenceDoctors(
      (input) => {
        const u = String(input);
        if (u.includes("/profile")) {
          return Promise.resolve(jsonResponse(validProfile));
        }
        if (u.includes("/appointments")) {
          return Promise.resolve(jsonResponse({ appointments: [syntheticAppt] }));
        }
        return Promise.reject(new Error(`unexpected ${u}`));
      },
      "fail",
    );

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

    expect(container.textContent).toContain("Unknown provider 5");
    expect(container.textContent).toContain("Room 3");
  });

  it("shows profile header strip with chart, provider, status, and record id", async () => {
    const fetchImpl = withReferenceDoctors((input) => {
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
    expect(container.querySelector(".app-patient-profile__header-strip")).toBeTruthy();
    expect(container.textContent).toContain("Synthetic Profile Patient");
    expect(container.textContent).toContain("SYN-CHART");
    expect(container.textContent).toContain("Synthetic Provider Profile");
    expect(container.textContent).toContain("Active");
    expect(container.textContent).toContain("Record id");
    expect(container.textContent).toContain("42");
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });

  it("shows a one-line description for the active tab", async () => {
    const fetchImpl = withReferenceDoctors((input) => {
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
    const desc = container.querySelector("#patient-tab-desc-summary");
    expect(desc?.textContent).toBe(PROFILE_TAB_DESCRIPTIONS.summary);
  });

  it("formats appointment day headers instead of raw ISO dates", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 15));

    const fetchImpl = withReferenceDoctors((input) => {
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

    const dayTitle = container.querySelector(".app-patient-profile__appt-day-title");
    expect(dayTitle?.textContent ?? "").not.toBe("2026-05-20");
    expect(dayTitle?.querySelector("time")?.getAttribute("dateTime")).toBe("2026-05-20");
    expect(dayTitle?.textContent ?? "").toMatch(/May/i);
  });

  it("shows hidden-in-viewer note on clinical tabs", async () => {
    const fetchImpl = withReferenceDoctors(
      treatmentsFetchHandler({
        patientId: "42",
        treatments: [syntheticTreatment],
        truncated: false,
        privacyNote: TREATMENTS_PRIVACY_NOTE,
      }),
    );
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
    await clickTreatmentsTab(container);
    await flush();
    expect(container.textContent).toContain(PATIENT_TAB_HIDDEN_FIELDS_NOTE);
  });

  it("keeps selection when typing in change-patient search", async () => {
    const onClearPatient = vi.fn();
    const fetchImpl = withReferenceDoctors((input) => {
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
          onClearPatient={onClearPatient}
        />,
      );
    });
    await flush();

    const changeBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Search another patient"),
    );
    await act(async () => {
      changeBtn?.click();
    });

    const input = container.querySelector("input#app-patients-page-search-input") as HTMLInputElement;
    await act(async () => {
      setSearchInputValue(input, "Ne");
    });
    expect(onClearPatient).not.toHaveBeenCalled();
  });

  it("refetches profile after demographics commit when sandbox pilot is enabled", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));

    const updatedProfile = { ...validProfile, displayName: "Updated Sandbox Label" };
    const dryRunPlan = {
      operationId: "f47ac10b-58cc-4372-a567-0e02b2c3d481",
      workflow: "patient.demographics.update",
      mode: "dry-run" as const,
      tablesAffected: ["PATIENT"],
      recordIds: ["42"],
      fieldsChanged: [{ table: "PATIENT", recordId: "42", field: "NAME", changeType: "set" as const }],
      backupRequired: true,
      backupWouldCreate: true,
      warnings: [],
      committed: false,
      createdAt: "2026-05-15T12:00:00.000Z",
    };
    const committedPlan = { ...dryRunPlan, committed: true, mode: "enabled" as const };
    const readyCapability = {
      writeMode: "enabled" as const,
      writesPermitted: true,
      writableSandbox: true,
      dataRootConfigured: true,
      backupDirConfigured: true,
      sqlitePathConfigured: true,
    };

    let profileFetches = 0;
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      const intent = (init?.headers as Record<string, string> | undefined)?.["X-Write-Intent"];
      if (u.includes("/v1/reference/doctors")) {
        return Promise.resolve(jsonResponse(syntheticDoctors));
      }
      if (u.includes("/profile")) {
        profileFetches += 1;
        return Promise.resolve(jsonResponse(profileFetches > 1 ? updatedProfile : validProfile));
      }
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

    await act(async () => {
      root.render(
        <PatientProfilePanel
          patientId="42"
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          sandboxWritePilot
          writeCapability={readyCapability}
          onBackToday={() => {}}
          onClearPatient={() => {}}
        />,
      );
    });
    await flush();

    expect(container.querySelector('[data-testid="patient-sandbox-demographics-section"]')).toBeTruthy();

    const nameInput = container.querySelector<HTMLInputElement>('input[aria-label="Display name"]');
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    await act(async () => {
      proto?.set?.call(nameInput, "Updated Sandbox Label");
      nameInput?.dispatchEvent(new Event("input", { bubbles: true }));
      nameInput?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="patient-demographics-preview"]')?.click();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="patient-demographics-apply"]')?.click();
    });

    expect(window.confirm).toHaveBeenCalledWith(PATIENT_DEMOGRAPHICS_WRITE_CONFIRM);
    await flush();
    expect(profileFetches).toBeGreaterThanOrEqual(2);
    expect(container.textContent).toContain("Updated Sandbox Label");

    vi.unstubAllGlobals();
  });

  describe("summary workspace mini-cards", () => {
    it("prefetches domain summaries when Summary tab is active without forbidden tokens", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 4, 15));

      const fetchImpl = withReferenceDoctors((input) => {
        const u = String(input);
        if (u.includes("/profile")) {
          return Promise.resolve(jsonResponse(validProfile));
        }
        if (u.includes("/appointments")) {
          return Promise.resolve(jsonResponse({ appointments: [syntheticAppt] }));
        }
        if (u.includes("/medical-summary")) {
          return Promise.resolve(
            jsonResponse({
              patientId: "42",
              hasMedicalRecord: true,
              hasSensitiveMedicalDetails: false,
              lastUpdated: "2024-06-01",
              lastDentalVisit: null,
              flaggedConditionCount: 1,
              conditions: { ...nullConditions, asthma: true },
              privacyNote: PRIVACY_NOTE,
            }),
          );
        }
        if (u.includes("/treatments")) {
          return Promise.resolve(
            jsonResponse({
              patientId: "42",
              treatments: [syntheticTreatment],
              truncated: false,
              privacyNote: TREATMENTS_PRIVACY_NOTE,
            }),
          );
        }
        if (u.includes("/chart")) {
          return Promise.resolve(
            jsonResponse({
              patientId: "42",
              entries: [syntheticChartEntry],
              truncated: false,
              privacyNote: CHART_PRIVACY_NOTE,
            }),
          );
        }
        if (u.includes("/ledger")) {
          return Promise.resolve(
            jsonResponse({
              patientId: "42",
              entries: [syntheticLedgerEntry],
              truncated: true,
              privacyNote: LEDGER_PRIVACY_NOTE,
            }),
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

      expect(container.querySelector(".app-patient-profile__summary-mini-grid")).toBeTruthy();
      expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/medical-summary"))).toBe(true);
      expect(container.textContent).toMatch(/1 appointment in range/i);
      assertNoForbiddenDomTokens(container.textContent ?? "");
      vi.useRealTimers();
    });

    it("navigates to a tab when a mini-card is clicked", async () => {
      const fetchImpl = withReferenceDoctors((input) => {
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

      const medicalCard = [...container.querySelectorAll(".app-patient-profile__summary-mini-card")].find((el) =>
        el.textContent?.includes("Medical"),
      );
      expect(medicalCard).toBeTruthy();
      await act(async () => {
        (medicalCard as HTMLButtonElement).click();
      });
      expect(container.querySelector("#patient-tab-medical")?.getAttribute("aria-selected")).toBe("true");
      assertNoForbiddenDomTokens(container.textContent ?? "");
    });
  });

  describe("clinical tab filters", () => {
    it("does not surface forbidden tokens in treatments filter UI", async () => {
      const fetchImpl = withReferenceDoctors(
        treatmentsFetchHandler({
          patientId: "42",
          treatments: [
            syntheticTreatment,
            {
              ...syntheticTreatment,
              treatmentId: "101",
              date: "2023-06-01",
              procedureCode: "SYN02",
              doctorLabel: "Synthetic Provider Two",
            },
          ],
          truncated: false,
          privacyNote: TREATMENTS_PRIVACY_NOTE,
        }),
      );

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
      await clickTreatmentsTab(container);
      await flush();

      const yearBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "2024");
      await act(async () => {
        yearBtn?.click();
      });
      await flush();

      assertNoForbiddenDomTokens(container.textContent ?? "");
      expect(container.textContent).toMatch(/1 of 2 procedures shown \(filtered\)/i);
    });

    it("does not surface forbidden tokens in chart filter UI", async () => {
      const fetchImpl = withReferenceDoctors(
        chartFetchHandler({
          patientId: "42",
          entries: [
            syntheticChartEntry,
            {
              ...syntheticChartEntry,
              chartEntryId: "32-1-1",
              toothNumber: 32,
              treated: false,
            },
          ],
          truncated: false,
          privacyNote: CHART_PRIVACY_NOTE,
        }),
      );

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
      await clickChartTab(container);
      await flush();

      const treatedOnlyBtn = [...container.querySelectorAll("button")].find(
        (b) => b.textContent === "Treated only",
      );
      await act(async () => {
        treatedOnlyBtn?.click();
      });
      await flush();

      assertNoForbiddenDomTokens(container.textContent ?? "");
    });

    it("does not surface forbidden tokens in ledger filter UI", async () => {
      const fetchImpl = withReferenceDoctors(
        ledgerFetchHandler({
          patientId: "42",
          entries: [
            syntheticLedgerEntry,
            {
              ...syntheticLedgerEntry,
              ledgerEntryId: "201",
              date: "2024-05-01",
              chargeTypeCode: 0,
              adjustmentTypeCode: 0,
              paymentTypeCode: 100,
            },
          ],
          truncated: false,
          privacyNote: LEDGER_PRIVACY_NOTE,
        }),
      );

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
      await clickLedgerTab(container);
      await flush();

      const paymentsBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Payments");
      await act(async () => {
        paymentsBtn?.click();
      });
      await flush();

      assertNoForbiddenDomTokens(container.textContent ?? "");
      expect(container.textContent).toMatch(/Amounts intentionally hidden/i);
      expect(container.textContent).toMatch(/\d+ charge/i);
    });
  });

  describe("appointment history filters", () => {
    it("highlights Default preset and shows range count without forbidden tokens", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 4, 15));

      const fetchImpl = withReferenceDoctors((input) => {
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

      const defaultBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Default");
      expect(defaultBtn?.className).toMatch(/primary/);
      expect(container.textContent).toMatch(/1 appointment in range/i);
      assertNoForbiddenDomTokens(container.textContent ?? "");
      vi.useRealTimers();
    });

    it("filters appointments by status and room without forbidden tokens", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 4, 15));

      const otherAppt = {
        ...syntheticAppt,
        id: "9002",
        room: 1,
        status: 3,
        date: "2026-05-19",
      };

      const fetchImpl = withReferenceDoctors((input) => {
        const u = String(input);
        if (u.includes("/profile")) {
          return Promise.resolve(jsonResponse(validProfile));
        }
        if (u.includes("/appointments")) {
          return Promise.resolve(jsonResponse({ appointments: [syntheticAppt, otherAppt] }));
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

      const completedBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Completed");
      await act(async () => {
        completedBtn?.click();
      });
      await flush();
      expect(container.textContent).toMatch(/1 appointment in range/i);

      const roomBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Room 3");
      await act(async () => {
        roomBtn?.click();
      });
      await flush();
      expect(container.textContent).toMatch(/No appointments match/i);
      assertNoForbiddenDomTokens(container.textContent ?? "");
      vi.useRealTimers();
    });
  });
});
