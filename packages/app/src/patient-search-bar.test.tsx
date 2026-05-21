// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BridgeClientError } from "@microdent/bridge-client";
import { PatientSearchBar, safePatientSearchError } from "./PatientSearchBar.js";
import { assertNoForbiddenDomTokens } from "./read-only-smoke-fixtures.js";

function setSearchInputValue(input: HTMLInputElement, value: string): void {
  const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  proto?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function hasSearchResultsDropdown(container: HTMLElement): boolean {
  return container.querySelector("#app-patient-search-listbox") !== null;
}

const demoHitResponse = {
  results: [
    {
      patientId: "90001",
      chartNumber: "C-100",
      displayName: "Demo Alpha",
      phoneMask: "…9000",
    },
  ],
};

describe("safePatientSearchError", () => {
  it("maps network errors to a neutral clinic message", () => {
    const err = new BridgeClientError("x", { kind: "network" });
    expect(safePatientSearchError(err)).toContain("clinic service");
  });

  it("maps schema mismatch to the mapping-fix copy", () => {
    const err = new BridgeClientError("Response body failed schema validation", {
      kind: "invalid_body",
      status: 200,
      cause: { issues: [{ path: ["results", 0, "patientId"], code: "custom" }] },
    });
    expect(safePatientSearchError(err)).toContain("small data mapping fix");
  });

  it("maps invalid_body without schema cause to format copy", () => {
    const err = new BridgeClientError("Response body is not valid JSON", { kind: "invalid_body", status: 200 });
    expect(safePatientSearchError(err)).toContain("could not read the clinic response format");
  });

  it("maps unknown errors to a generic message", () => {
    expect(safePatientSearchError(new Error("secret"))).toBe("Search could not be completed.");
  });
});

describe("PatientSearchBar", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses distinct DOM ids for the Patients page instance", () => {
    act(() => {
      root.render(
        <PatientSearchBar instanceId="page" bridgePhase="offline" bridgeBaseUrl="http://127.0.0.1:17890" />,
      );
    });
    expect(container.querySelector("input#app-patients-page-search-input")).toBeTruthy();
    expect(container.querySelector("#app-patient-search-input")).toBeFalsy();
  });

  it("disables search when the bridge is offline", () => {
    act(() => {
      root.render(<PatientSearchBar bridgePhase="offline" bridgeBaseUrl="http://127.0.0.1:17890" />);
    });
    const input = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(container.textContent).toContain("Connect the clinic service");
    expect(container.querySelector(".app-patient-search__offline-banner")).toBeTruthy();
  });

  it("disables search while the bridge is still checking", () => {
    act(() => {
      root.render(<PatientSearchBar bridgePhase="checking" bridgeBaseUrl="http://127.0.0.1:17890" />);
    });
    const input = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(container.textContent).toContain("Waiting for the clinic service");
  });

  it("does not call the network when the query is under 2 characters", async () => {
    const fetchImpl = vi.fn();
    act(() => {
      root.render(
        <PatientSearchBar bridgePhase="connected" bridgeBaseUrl="http://127.0.0.1:17890" fetchImpl={fetchImpl} />,
      );
    });
    const input = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    await act(async () => {
      setSearchInputValue(input, "x");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Enter at least 2 letters");
  });

  it("does not render forbidden PHI tokens in the DOM", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify(demoHitResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    act(() => {
      root.render(
        <PatientSearchBar bridgePhase="connected" bridgeBaseUrl="http://127.0.0.1:17890" fetchImpl={fetchImpl} />,
      );
    });
    const input = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    await act(async () => {
      setSearchInputValue(input, "De");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await act(async () => {
      await Promise.resolve();
    });
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });

  it("shows successful results using only safe fields from the response", async () => {
    const fetchImpl = vi.fn(async () => {
      const body = {
        results: [
          {
            patientId: "90001",
            chartNumber: "C-100",
            displayName: "Demo Alpha",
            phoneMask: "…9000",
          },
        ],
      };
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    act(() => {
      root.render(
        <PatientSearchBar bridgePhase="connected" bridgeBaseUrl="http://127.0.0.1:17890" fetchImpl={fetchImpl} />,
      );
    });
    const input = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    await act(async () => {
      setSearchInputValue(input, "De");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchImpl).toHaveBeenCalled();
    const url = String(fetchImpl.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/v1/patients/search?");
    expect(url).toContain("q=De");
    expect(container.textContent).toContain("Demo Alpha");
    expect(container.textContent).toContain("Chart C-100");
    expect(container.textContent).toContain("…9000");
  });

  it("calls onPatientRecordSelect when a result row is clicked", async () => {
    const fetchImpl = vi.fn(async () => {
      const body = {
        results: [
          {
            patientId: "90001",
            chartNumber: "C-100",
            displayName: "Demo Alpha",
            phoneMask: "…9000",
          },
        ],
      };
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    const onPatientRecordSelect = vi.fn();

    act(() => {
      root.render(
        <PatientSearchBar
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onPatientRecordSelect={onPatientRecordSelect}
        />,
      );
    });
    const input = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    await act(async () => {
      setSearchInputValue(input, "De");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const btn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Demo Alpha"));
    expect(btn).toBeTruthy();
    await act(async () => {
      btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onPatientRecordSelect).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: "90001", displayName: "Demo Alpha" }),
    );
    expect(hasSearchResultsDropdown(container)).toBe(false);
    expect(input.value).toBe("Demo Alpha");
  });

  it("closes the dropdown on first Escape without clearing the query", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify(demoHitResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    act(() => {
      root.render(
        <PatientSearchBar bridgePhase="connected" bridgeBaseUrl="http://127.0.0.1:17890" fetchImpl={fetchImpl} />,
      );
    });
    const input = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    await act(async () => {
      setSearchInputValue(input, "De");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(hasSearchResultsDropdown(container)).toBe(true);

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(hasSearchResultsDropdown(container)).toBe(false);
    expect(input.value).toBe("De");
  });

  it("clears the query and closes results when Escape is pressed twice", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify(demoHitResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const onPatientSelectionClear = vi.fn();

    act(() => {
      root.render(
        <PatientSearchBar
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onPatientSelectionClear={onPatientSelectionClear}
        />,
      );
    });
    const input = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    await act(async () => {
      setSearchInputValue(input, "De");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(hasSearchResultsDropdown(container)).toBe(true);

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(hasSearchResultsDropdown(container)).toBe(false);
    expect(input.value).toBe("De");

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(input.value).toBe("");
    expect(onPatientSelectionClear).toHaveBeenCalled();
  });

  it("selects the first result when Enter is pressed after a successful search", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify(demoHitResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const onPatientRecordSelect = vi.fn();

    act(() => {
      root.render(
        <PatientSearchBar
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onPatientRecordSelect={onPatientRecordSelect}
        />,
      );
    });
    const input = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    await act(async () => {
      setSearchInputValue(input, "De");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(onPatientRecordSelect).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: "90001", displayName: "Demo Alpha" }),
    );
    expect(input.value).toBe("Demo Alpha");
    expect(hasSearchResultsDropdown(container)).toBe(false);
  });

  it("exposes combobox listbox semantics on the search input", async () => {
    act(() => {
      root.render(<PatientSearchBar bridgePhase="connected" bridgeBaseUrl="http://127.0.0.1:17890" />);
    });
    const input = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    expect(input.getAttribute("role")).toBe("combobox");
    expect(input.getAttribute("aria-haspopup")).toBe("listbox");
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
  });

  it("closes the results dropdown when clicking outside the search component", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify(demoHitResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const outside = document.createElement("button");
    outside.type = "button";
    outside.textContent = "Outside";
    document.body.appendChild(outside);

    act(() => {
      root.render(
        <PatientSearchBar bridgePhase="connected" bridgeBaseUrl="http://127.0.0.1:17890" fetchImpl={fetchImpl} />,
      );
    });
    const input = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    await act(async () => {
      setSearchInputValue(input, "De");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(hasSearchResultsDropdown(container)).toBe(true);

    await act(async () => {
      outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(hasSearchResultsDropdown(container)).toBe(false);
    outside.remove();
  });

  it("shows results again after a new valid search query", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify(demoHitResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const onPatientRecordSelect = vi.fn();

    act(() => {
      root.render(
        <PatientSearchBar
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onPatientRecordSelect={onPatientRecordSelect}
        />,
      );
    });
    const input = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    await act(async () => {
      setSearchInputValue(input, "De");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const btn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Demo Alpha"));
    await act(async () => {
      btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(hasSearchResultsDropdown(container)).toBe(false);

    await act(async () => {
      setSearchInputValue(input, "Jo");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(hasSearchResultsDropdown(container)).toBe(true);
    expect(container.textContent).toContain("Demo Alpha");
  });

  it("shows a clear empty state when there are no matches", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    act(() => {
      root.render(
        <PatientSearchBar bridgePhase="connected" bridgeBaseUrl="http://127.0.0.1:17890" fetchImpl={fetchImpl} />,
      );
    });
    const input = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    await act(async () => {
      setSearchInputValue(input, "zz");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toMatch(/No patients matched/i);
  });

  it("shows a safe message when the bridge returns an error", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ error: { code: "X", message: "internal" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    });

    act(() => {
      root.render(
        <PatientSearchBar bridgePhase="connected" bridgeBaseUrl="http://127.0.0.1:17890" fetchImpl={fetchImpl} />,
      );
    });
    const input = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    await act(async () => {
      setSearchInputValue(input, "ab");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).not.toContain("internal");
    expect(container.textContent).toMatch(/could not be completed/i);
  });

  it("shows mapping-fix copy and dev hint when the response fails schema validation", async () => {
    const fetchImpl = vi.fn(async () => {
      const body = {
        results: [
          {
            patientId: "1",
            chartNumber: null,
            displayName: "Ok",
            phoneMask: null,
            notAllowed: true,
          },
        ],
      };
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    act(() => {
      root.render(
        <PatientSearchBar bridgePhase="connected" bridgeBaseUrl="http://127.0.0.1:17890" fetchImpl={fetchImpl} />,
      );
    });
    const input = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    await act(async () => {
      setSearchInputValue(input, "ab");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain("small data mapping fix");
    expect(container.textContent).toContain("Response shape mismatch");
  });

  it("navigates results with ArrowDown and ArrowUp and selects with Enter", async () => {
    const fetchImpl = vi.fn(async () => {
      const body = {
        results: [
          {
            patientId: "90001",
            chartNumber: "C-100",
            displayName: "Demo Alpha",
            phoneMask: "…9000",
          },
          {
            patientId: "90002",
            chartNumber: "C-200",
            displayName: "Demo Beta",
            phoneMask: null,
          },
        ],
      };
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    const onPatientRecordSelect = vi.fn();

    act(() => {
      root.render(
        <PatientSearchBar
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onPatientRecordSelect={onPatientRecordSelect}
        />,
      );
    });
    const input = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    await act(async () => {
      setSearchInputValue(input, "De");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    expect(container.querySelector(".app-patient-search__hit--active")?.textContent).toContain("Demo Beta");

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(onPatientRecordSelect).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: "90002", displayName: "Demo Beta" }),
    );
  });

  it("does not clear shell selection when clearSelectionOnQueryChange is false", async () => {
    const onPatientSelectionClear = vi.fn();
    act(() => {
      root.render(
        <PatientSearchBar
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          clearSelectionOnQueryChange={false}
          onPatientSelectionClear={onPatientSelectionClear}
        />,
      );
    });
    const input = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    await act(async () => {
      setSearchInputValue(input, "Jo");
    });
    expect(onPatientSelectionClear).not.toHaveBeenCalled();
  });

  it("shows the open-record chip when selectedDisplayName is set on the topbar", () => {
    act(() => {
      root.render(
        <PatientSearchBar
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          selectedDisplayName="Demo Alpha"
        />,
      );
    });
    expect(container.textContent).toMatch(/Open record:/i);
    expect(container.textContent).toContain("Demo Alpha");
    expect(container.querySelector(".app-patient-search__selected")).toBeTruthy();
  });

  it("shows session recent patients when query is short and does not include phone", () => {
    const onRecentPatientSelect = vi.fn();
    act(() => {
      root.render(
        <PatientSearchBar
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          recentPatients={[
            { patientId: "42", displayName: "Recent One", chartNumber: "C-42" },
          ]}
          onRecentPatientSelect={onRecentPatientSelect}
        />,
      );
    });
    expect(container.querySelector('[data-testid="patient-search-recent"]')).toBeTruthy();
    expect(container.textContent).toContain("Recent this session");
    expect(container.textContent).toContain("Recent One");
    expect(container.textContent).toContain("Chart C-42");
    expect(container.textContent).not.toMatch(/phone/i);
    assertNoForbiddenDomTokens(container.textContent ?? "");

    const recentBtn = container.querySelector(".app-patient-search__recent-btn") as HTMLButtonElement;
    act(() => {
      recentBtn?.click();
    });
    expect(onRecentPatientSelect).toHaveBeenCalledWith({
      patientId: "42",
      displayName: "Recent One",
      chartNumber: "C-42",
    });
  });

  it("highlights the recent row matching selectedPatientId until Clear", () => {
    act(() => {
      root.render(
        <PatientSearchBar
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          selectedPatientId="42"
          recentPatients={[
            { patientId: "42", displayName: "Recent One", chartNumber: "C-42" },
            { patientId: "99", displayName: "Other", chartNumber: null },
          ]}
          onRecentPatientSelect={vi.fn()}
        />,
      );
    });
    expect(container.querySelector(".app-patient-search__recent-btn--selected")).toBeTruthy();
  });
});
