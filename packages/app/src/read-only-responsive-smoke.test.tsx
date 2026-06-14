// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppShell } from "./AppShell.js";
import {
  assertNoForbiddenDomTokens,
  assertNoMainPageJargonInDom,
  createReadOnlySmokeFetch,
  SMOKE_BRIDGE_BASE,
} from "./read-only-smoke-fixtures.js";

type Viewport = {
  label: string;
  width: number;
  height: number;
};

const VIEWPORTS: Viewport[] = [
  { label: "wide desktop", width: 1600, height: 1000 },
  { label: "standard desktop", width: 1280, height: 900 },
  { label: "compact desktop", width: 1024, height: 768 },
  { label: "narrow fallback", width: 760, height: 760 },
];

function setViewport({ width, height }: Viewport): void {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
  document.documentElement.style.width = `${width}px`;
  document.documentElement.style.height = `${height}px`;
  window.dispatchEvent(new Event("resize"));
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function waitForBridgeConnected(container: HTMLElement): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    if (container.textContent?.includes("Connected")) return;
    await flush();
  }
  throw new Error("Bridge did not reach Connected state");
}

function clickSidebarModule(container: HTMLElement, label: string): void {
  const labelEl = Array.from(
    container.querySelectorAll(".clinic-sidebar__nav-label, .app-sidebar__btn-label"),
  ).find((b) => b.textContent?.trim() === label);
  const btn = labelEl?.closest("button");
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Sidebar module button not found: ${label}`);
  }
  act(() => {
    btn.click();
  });
}

describe("read-only responsive smoke", () => {
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
    document.documentElement.removeAttribute("style");
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each(VIEWPORTS)("keeps core workspace navigable at $label ($width px)", async (viewport) => {
    setViewport(viewport);
    const fetchImpl = vi.fn(createReadOnlySmokeFetch());

    await act(async () => {
      root.render(<AppShell bridgeBaseUrl={SMOKE_BRIDGE_BASE} fetchImpl={fetchImpl} />);
    });

    await waitForBridgeConnected(container);

    expect(container.querySelector(".app-workspace-shell")).toBeTruthy();
    expect(container.querySelector(".clinic-sidebar")).toBeTruthy();
    expect(container.querySelector(".clinic-workspace")).toBeTruthy();
    expect(container.querySelector("#app-main-region")).toBeTruthy();
    expect(container.querySelector("input#app-patient-search-input")).toBeTruthy();

    const labels = Array.from(container.querySelectorAll(".app-sidebar__btn-label")).map((b) =>
      b.textContent?.trim(),
    );
    expect(labels).toEqual(["Today", "Patients", "Schedule", "Settings"]);
    expect(container.querySelector("#app-main-heading")?.textContent).toBe("Today");
    expect(container.textContent).toMatch(/Today's schedule/i);
    assertNoForbiddenDomTokens(container.textContent ?? "");
    assertNoMainPageJargonInDom(container.textContent ?? "");

    clickSidebarModule(container, "Patients");
    await flush();
    expect(container.querySelector("#app-main-heading")?.textContent).toBe("Patients");
    expect(container.querySelector("input#app-patients-page-search-input")).toBeTruthy();
    assertNoForbiddenDomTokens(container.textContent ?? "");
    assertNoMainPageJargonInDom(container.textContent ?? "");

    clickSidebarModule(container, "Schedule");
    await flush();
    await flush();
    expect(container.querySelector("#app-main-heading")?.textContent).toBe("Schedule");
    expect(container.querySelector(".app-schedule__summary-bar")).toBeTruthy();
    assertNoForbiddenDomTokens(container.textContent ?? "");
    assertNoMainPageJargonInDom(container.textContent ?? "");

    clickSidebarModule(container, "Settings");
    await flush();
    expect(container.querySelector("#app-main-heading")?.textContent).toBe("Settings");
    expect(container.textContent).toMatch(/Clinic service|Local copy|Settings/i);
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });
});
