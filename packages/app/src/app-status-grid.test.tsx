// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppStatusGrid } from "./app-status-grid.js";
import { assertNoForbiddenDomTokens, SMOKE_LEAKED_VALUES } from "./read-only-smoke-fixtures.js";

describe("AppStatusGrid", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders status chips and optional action", () => {
    const onAction = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <AppStatusGrid
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

    expect(container.querySelector(".app-status-grid__chip--ok")?.textContent).toBe("Active");
    expect(container.querySelector(".app-status-grid__chip--warn")?.textContent).toBe("Dry-run");

    const action = container.querySelector(".app-status-grid__action") as HTMLButtonElement;
    act(() => {
      action.click();
    });
    expect(onAction).toHaveBeenCalledOnce();
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });

  it("does not surface forbidden legacy field labels in status values", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <AppStatusGrid
          aria-label="Clinic status"
          items={[
            { key: "svc", label: "Clinic service", value: "Connected", tone: "ok" },
            { key: "mirror", label: "Data freshness", value: "Mirror unavailable — DBF fallback", tone: "warn" },
            { key: "write", label: "Write mode", value: "Writes off", tone: "neutral" },
          ]}
        />,
      );
    });

    assertNoForbiddenDomTokens(container.textContent ?? "");
    for (const leaked of Object.values(SMOKE_LEAKED_VALUES)) {
      expect(container.textContent).not.toContain(leaked);
    }
  });
});
