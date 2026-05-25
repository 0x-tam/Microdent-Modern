// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppShell } from "./AppShell.js";

describe("AppShell fetch cleanup", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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
  });

  it("does not apply bridge health results after unmount", async () => {
    let resolveHealth: (() => void) | undefined;
    const healthPromise = new Promise<Response>((resolve) => {
      resolveHealth = () =>
        resolve(
          new Response(JSON.stringify({ ok: true, version: "cleanup-test" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
    });

    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/health")) {
        return healthPromise;
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    });

    await act(async () => {
      root.render(<AppShell bridgeBaseUrl="http://127.0.0.1:17890" fetchImpl={fetchImpl} />);
    });

    expect(container.textContent).toContain("Connecting");

    await act(async () => {
      root.unmount();
    });

    await act(async () => {
      resolveHealth?.();
      await healthPromise;
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("Connected");
  });
});
