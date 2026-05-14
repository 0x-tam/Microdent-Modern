// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BridgeClientError } from "@microdent/bridge-client";
import { PatientSearchBar, safePatientSearchError } from "./PatientSearchBar.js";

function setSearchInputValue(input: HTMLInputElement, value: string): void {
  const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  proto?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("safePatientSearchError", () => {
  it("maps network errors to a neutral clinic message", () => {
    const err = new BridgeClientError("x", { kind: "network" });
    expect(safePatientSearchError(err)).toContain("clinic service");
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

  it("disables search when the bridge is offline", () => {
    act(() => {
      root.render(<PatientSearchBar bridgePhase="offline" bridgeBaseUrl="http://127.0.0.1:17890" />);
    });
    const input = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(container.textContent).toContain("Connect the clinic service");
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
    expect(container.textContent).toContain("No matches");
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
});
