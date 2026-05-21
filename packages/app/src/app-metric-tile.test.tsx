// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppMetricTile } from "./app-metric-tile.js";
import { assertNoForbiddenDomTokens } from "./read-only-smoke-fixtures.js";

describe("AppMetricTile", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders label, value, hint, and tone class", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(<AppMetricTile label="Appointments" value="12" hint="Today" tone="success" />);
    });

    expect(container.querySelector(".app-metric-tile--success")).toBeTruthy();
    expect(container.textContent).toContain("Appointments");
    expect(container.textContent).toContain("12");
    expect(container.textContent).toContain("Today");
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });
});
