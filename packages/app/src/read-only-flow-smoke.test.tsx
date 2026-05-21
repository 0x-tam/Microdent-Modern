// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppShell } from "./AppShell.js";
import {
  assertNoForbiddenDomTokens,
  createReadOnlySmokeFetch,
  SMOKE_BRIDGE_BASE,
  smokeProfile,
  smokeSearchHit,
} from "./read-only-smoke-fixtures.js";

function setSearchInputValue(input: HTMLInputElement, value: string): void {
  const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  proto?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function clickSidebarModule(container: HTMLElement, label: string): void {
  const labelEl = Array.from(container.querySelectorAll(".app-sidebar__btn-label")).find(
    (b) => b.textContent?.trim() === label,
  );
  const btn = labelEl?.closest("button");
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Sidebar module button not found: ${label}`);
  }
  act(() => {
    btn.click();
  });
}

async function clickPatientTab(container: HTMLElement, tabId: string): Promise<void> {
  const tab = container.querySelector(`#patient-tab-${tabId}`);
  if (!(tab instanceof HTMLButtonElement)) {
    throw new Error(`Patient tab not found: ${tabId}`);
  }
  await act(async () => {
    tab.click();
  });
}

async function waitForBridgeConnected(container: HTMLElement): Promise<void> {
  for (let i = 0; i < 20; i++) {
    if (container.textContent?.includes("Connected")) {
      return;
    }
    await flush();
  }
  throw new Error("Bridge did not reach Connected state");
}

describe("read-only app smoke", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 15, 10, 0, 0));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs the full read-only flow: bridge, search, patient tabs, and schedule", async () => {
    const fetchImpl = vi.fn(createReadOnlySmokeFetch());

    await act(async () => {
      root.render(<AppShell bridgeBaseUrl={SMOKE_BRIDGE_BASE} fetchImpl={fetchImpl} />);
    });

    await waitForBridgeConnected(container);
    expect(container.querySelector("#app-main-heading")?.textContent).toBe("Today");
    expect(container.textContent).toMatch(/Clinic at a glance/i);
    assertNoForbiddenDomTokens(container.textContent ?? "");

    const searchInput = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    expect(searchInput.disabled).toBe(false);

    await act(async () => {
      setSearchInputValue(searchInput, "Syn");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await flush();

    expect(container.textContent).toContain(smokeSearchHit.displayName);
    const hitBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes(smokeSearchHit.displayName),
    );
    expect(hitBtn).toBeTruthy();
    await act(async () => {
      hitBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.querySelector("#app-main-heading")?.textContent).toBe("Patients");
    expect(container.textContent).toContain(smokeProfile.displayName);
    expect(container.textContent).toContain("Chart SYN-SMOKE");
    expect(container.querySelector(".app-main__patient-context-chip")?.textContent).toContain(
      smokeProfile.displayName,
    );
    expect(container.querySelector("#patient-panel-summary")).toBeTruthy();
    expect(container.querySelector(".app-patient-profile__summary-mini-grid")).toBeTruthy();

    for (let i = 0; i < 15; i++) {
      if (container.textContent?.match(/appointment in range|No appointments|screening flag/i)) {
        break;
      }
      await flush();
    }
    expect(container.textContent).toMatch(/appointment|Medical|procedure|chart|ledger/i);
    assertNoForbiddenDomTokens(container.textContent ?? "");

    await clickPatientTab(container, "appointments");
    await flush();
    expect(container.querySelector("#patient-panel-appointments")).toBeTruthy();
    expect(container.textContent).toContain("09:30");
    expect(container.textContent).toContain("Note hidden");

    await clickPatientTab(container, "medical");
    await flush();
    expect(container.querySelector("#patient-panel-medical")).toBeTruthy();
    expect(container.textContent).toMatch(/Medical summary is read-only/i);
    expect(container.textContent).toContain("Asthma (screening)");

    await clickPatientTab(container, "treatments");
    await flush();
    expect(container.querySelector("#patient-panel-treatments")).toBeTruthy();
    expect(container.textContent).toMatch(/Procedure history is read-only/i);
    expect(container.textContent).toContain("Synthetic dictionary label");

    await clickPatientTab(container, "chart");
    await flush();
    expect(container.querySelector("#patient-panel-chart")).toBeTruthy();
    expect(container.textContent).toMatch(/Dental chart is read-only/i);
    expect(container.textContent).toContain("Tooth 14");

    const treatedOnlyBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Treated only",
    );
    if (treatedOnlyBtn) {
      await act(async () => {
        treatedOnlyBtn.click();
      });
      await flush();
    }

    await clickPatientTab(container, "ledger");
    await flush();
    expect(container.querySelector("#patient-panel-ledger")).toBeTruthy();
    expect(container.textContent).toMatch(/Ledger lines are read-only/i);
    expect(container.textContent).toContain("Legacy charge type code 2 (unmapped)");

    const paymentsBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Payments");
    if (paymentsBtn) {
      await act(async () => {
        paymentsBtn.click();
      });
      await flush();
    }

    await clickPatientTab(container, "timeline");
    await flush();
    expect(container.querySelector('[data-testid="patient-panel-timeline"]')).toBeTruthy();
    expect(container.textContent).toMatch(/Chart snapshot|Synthetic dictionary label/i);
    assertNoForbiddenDomTokens(container.textContent ?? "");

    clickSidebarModule(container, "Settings");
    await flush();
    expect(container.querySelector("#app-main-heading")?.textContent).toBe("Settings");
    assertNoForbiddenDomTokens(container.textContent ?? "");

    clickSidebarModule(container, "Schedule");
    await flush();
    await flush();
    await flush();

    expect(container.querySelector("#app-main-heading")?.textContent).toBe("Schedule");
    expect(container.querySelector(".app-main__back-today")).toBeTruthy();
    expect(container.textContent).toContain("Synthetic Schedule Smoke Patient");
    expect(container.textContent).toContain("09:00");
    expect(container.textContent).toContain("Synthetic smoke bay");

    const scheduledChip = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.match(/\d+ Scheduled/i),
    );
    if (scheduledChip) {
      await act(async () => {
        scheduledChip.click();
      });
      await flush();
      assertNoForbiddenDomTokens(container.textContent ?? "");
    }

    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/health"))).toBe(true);
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/patients/search"))).toBe(true);
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/profile"))).toBe(true);
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/appointments"))).toBe(true);
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/medical-summary"))).toBe(true);
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/treatments"))).toBe(true);
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/chart"))).toBe(true);
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/ledger"))).toBe(true);
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/v1/schedule/"))).toBe(true);

    assertNoForbiddenDomTokens(container.textContent ?? "");
  });

  it("shows Today, Patients, Schedule, and Settings in the sidebar", async () => {
    const fetchImpl = vi.fn(createReadOnlySmokeFetch());

    await act(async () => {
      root.render(<AppShell bridgeBaseUrl={SMOKE_BRIDGE_BASE} fetchImpl={fetchImpl} />);
    });
    await waitForBridgeConnected(container);

    const labels = Array.from(container.querySelectorAll(".app-sidebar__btn-label")).map((b) =>
      b.textContent?.trim(),
    );
    expect(labels).toEqual(["Today", "Patients", "Schedule", "Settings"]);
    expect(container.textContent).toMatch(/Payments and Reports are not available in this read-only viewer yet/i);
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });

  it("shows Patients page search before a patient is selected and keeps global top search", async () => {
    const fetchImpl = vi.fn(createReadOnlySmokeFetch());

    await act(async () => {
      root.render(<AppShell bridgeBaseUrl={SMOKE_BRIDGE_BASE} fetchImpl={fetchImpl} />);
    });
    await waitForBridgeConnected(container);

    expect(container.querySelector("input#app-patient-search-input")).toBeTruthy();
    clickSidebarModule(container, "Patients");
    await flush();

    expect(container.querySelector("#app-main-heading")?.textContent).toBe("Patients");
    const pageSearch = container.querySelector("input#app-patients-page-search-input") as HTMLInputElement;
    expect(pageSearch).toBeTruthy();
    expect(pageSearch.disabled).toBe(false);
    expect(container.textContent).toMatch(/no full patient directory/i);
    expect(container.textContent).not.toMatch(/No patient selected/i);

    await act(async () => {
      setSearchInputValue(pageSearch, "Syn");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await flush();

    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/patients/search"))).toBe(true);
    const hitBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes(smokeSearchHit.displayName),
    );
    await act(async () => {
      hitBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain(smokeProfile.displayName);
    expect(container.querySelector("#app-patients-page-search-listbox")).toBeFalsy();
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });

  it("keeps forbidden legacy field labels out of the DOM after the smoke flow", async () => {
    const fetchImpl = vi.fn(createReadOnlySmokeFetch());

    await act(async () => {
      root.render(<AppShell bridgeBaseUrl={SMOKE_BRIDGE_BASE} fetchImpl={fetchImpl} />);
    });
    await waitForBridgeConnected(container);

    const searchInput = container.querySelector("input#app-patient-search-input") as HTMLInputElement;
    await act(async () => {
      setSearchInputValue(searchInput, "Syn");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await flush();

    const hitBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes(smokeSearchHit.displayName),
    );
    await act(async () => {
      hitBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    for (const tabId of ["summary", "appointments", "medical", "treatments", "chart", "ledger", "timeline"] as const) {
      await clickPatientTab(container, tabId);
      await flush();
    }

    clickSidebarModule(container, "Today");
    await flush();
    expect(container.textContent).toMatch(/Clinic at a glance/i);
    assertNoForbiddenDomTokens(container.textContent ?? "");

    clickSidebarModule(container, "Schedule");
    await flush();
    await flush();

    assertNoForbiddenDomTokens(container.textContent ?? "");
  });
});
