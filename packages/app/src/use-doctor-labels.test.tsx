// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useDoctorLabels } from "./useDoctorLabels.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function Probe({
  bridgePhase,
  bridgeBaseUrl,
  fetchImpl,
  enabled,
  onLabels,
}: {
  bridgePhase: "connected" | "offline";
  bridgeBaseUrl: string;
  fetchImpl?: typeof fetch;
  enabled?: boolean;
  onLabels: (labels: ReadonlyMap<string, string>) => void;
}): null {
  const { labels } = useDoctorLabels({ bridgePhase, bridgeBaseUrl, fetchImpl, enabled });
  onLabels(labels);
  return null;
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useDoctorLabels", () => {
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

  it("loads doctorId to displayName when connected", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/reference/doctors")) {
        return Promise.resolve(
          jsonResponse({
            doctors: [{ doctorId: "7", displayName: "Synthetic Provider Hook", active: true }],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    });

    let latest = new Map<string, string>();
    await act(async () => {
      root.render(
        <Probe
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onLabels={(m) => {
            latest = new Map(m);
          }}
        />,
      );
    });
    await flush();

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:17890/v1/reference/doctors",
      expect.anything(),
    );
    expect(latest.get("7")).toBe("Synthetic Provider Hook");
  });

  it("keeps an empty map when reference fetch fails", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ error: { code: "REFERENCE_DOCTORS_ERROR" } }, 500)));

    let latest: ReadonlyMap<string, string> | null = null;
    await act(async () => {
      root.render(
        <Probe
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onLabels={(m) => {
            latest = m;
          }}
        />,
      );
    });
    await flush();

    expect(latest).not.toBeNull();
    expect(latest!.size).toBe(0);
  });

  it("does not fetch when offline", async () => {
    const fetchImpl = vi.fn();
    await act(async () => {
      root.render(
        <Probe
          bridgePhase="offline"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onLabels={() => {}}
        />,
      );
    });
    await flush();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
