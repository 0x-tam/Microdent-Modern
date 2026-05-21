// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ClinicStatCard } from "./clinic-stat-card.js";
import { assertNoForbiddenDomTokens } from "./read-only-smoke-fixtures.js";

describe("ClinicStatCard", () => {
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
      root.render(<ClinicStatCard label="Appointments" value="12" hint="Today" tone="teal" />);
    });

    expect(container.querySelector(".clinic-stat-card--teal")).toBeTruthy();
    expect(container.textContent).toContain("Appointments");
    expect(container.textContent).toContain("12");
    expect(container.textContent).toContain("Today");
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });
});
