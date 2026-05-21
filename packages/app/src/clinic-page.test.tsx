// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ClinicPage, ClinicPageHero } from "./clinic-page.js";
import { assertNoForbiddenDomTokens } from "./read-only-smoke-fixtures.js";

describe("ClinicPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders clinic page shell and hero", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <ClinicPage testId="today-page">
          <ClinicPageHero title="Today" subtitle="Schedule overview." meta={<span>May 22</span>} />
        </ClinicPage>,
      );
    });

    expect(container.querySelector(".clinic-page")).toBeTruthy();
    expect(container.querySelector(".clinic-page-hero__title")?.textContent).toBe("Today");
    expect(container.querySelector(".clinic-page-hero__subtitle")?.textContent).toBe("Schedule overview.");
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });
});
