// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ClinicPanel } from "./clinic-panel.js";
import { ClinicStatusGrid } from "./clinic-status-row.js";
import { ClinicEmptyState } from "./clinic-empty-state.js";
import { ClinicLoadingSkeleton } from "./clinic-loading-skeleton.js";
import { assertNoForbiddenDomTokens } from "./read-only-smoke-fixtures.js";

describe("ClinicPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders header, body, and footer regions", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <ClinicPanel title="Now" headerActions={<button type="button">Refresh</button>} footer="Footer">
          Body content
        </ClinicPanel>,
      );
    });

    expect(container.querySelector(".clinic-panel-header__title")?.textContent).toBe("Now");
    expect(container.querySelector(".clinic-panel__body")?.textContent).toContain("Body content");
    expect(container.querySelector(".clinic-panel__footer")?.textContent).toBe("Footer");
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });
});

describe("ClinicStatusGrid", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders status pills and optional action", () => {
    const onAction = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <ClinicStatusGrid
          aria-label="Clinic status"
          items={[
            { key: "mirror", label: "Mirror", value: "Active", tone: "ok" },
            {
              key: "write",
              label: "Write mode",
              value: "Dry-run",
              tone: "warn",
              actionLabel: "Open settings",
              onAction,
            },
          ]}
        />,
      );
    });

    expect(container.querySelector(".clinic-status-pill--ok")?.textContent).toBe("Active");
    expect(container.querySelector(".clinic-status-pill--warn")?.textContent).toBe("Dry-run");

    const action = container.querySelector("button") as HTMLButtonElement;
    act(() => {
      action.click();
    });
    expect(onAction).toHaveBeenCalledOnce();
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });
});

describe("ClinicEmptyState", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders accent block, copy, and actions", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <ClinicEmptyState
          title="No appointments"
          body="Open schedule to browse slots."
          variant="offline"
          actions={<button type="button">Open schedule</button>}
        />,
      );
    });

    expect(container.querySelector(".clinic-empty-state--offline")).toBeTruthy();
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });
});

describe("ClinicLoadingSkeleton", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders shimmer bars with busy status", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(<ClinicLoadingSkeleton lines={2} label="Loading profile" />);
    });

    expect(container.querySelectorAll(".clinic-skeleton")).toHaveLength(2);
    expect(container.querySelector('[role="status"][aria-busy="true"]')).toBeTruthy();
  });
});
