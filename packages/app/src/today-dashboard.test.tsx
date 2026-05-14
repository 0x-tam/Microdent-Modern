// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DashboardHome } from "./today-dashboard.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function appt(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: "1",
    date: "2026-06-15",
    time: "09:00",
    durationSlots: 1,
    periodMinutes: 30,
    room: 1,
    status: 1,
    docId: 0,
    patId: "100",
    procClass: 0,
    vacId: 0,
    recall: 0,
    unreason: 0,
    missed: false,
    hasComment: false,
    ...over,
  };
}

describe("DashboardHome (Today schedule)", () => {
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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not fetch when the bridge is offline", async () => {
    const fetchImpl = vi.fn();
    await act(async () => {
      root.render(
        <DashboardHome
          onOpenModule={() => {}}
          bridgePhase="offline"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
        />,
      );
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/Connect the clinic service/i);
  });

  it("requests today-only schedule when connected and renders safe fields", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/appointments")) {
        expect(u).toMatch(/from=2026-06-15/);
        expect(u).toMatch(/to=2026-06-15/);
        return Promise.resolve(
          jsonResponse({
            appointments: [
              appt({ id: "1", date: "2026-06-15", time: "08:00", patId: "501", docId: 3, hasComment: true, missed: true }),
              appt({ id: "2", date: "2026-06-15", time: "14:00", patId: "502" }),
            ],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    });

    vi.useFakeTimers({ now: new Date(2026, 5, 15, 10, 30, 0), toFake: ["Date"] });

    await act(async () => {
      root.render(
        <DashboardHome
          onOpenModule={() => {}}
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("2 on the schedule today");
    expect(container.textContent).toContain("08:00");
    expect(container.textContent).toContain("Patient ID 501");
    expect(container.textContent).toContain("Note hidden");
    expect(container.textContent).toContain("Missed");
    expect(container.textContent).toContain("14:00");
    expect(container.textContent).toContain("Patient ID 502");
    expect(container.textContent).not.toMatch(/\bPAT_NAME\b|\bTELEPHONE\b|\bCOMMENT\b/i);
    expect(container.textContent).not.toContain("555-");
    expect(container.textContent).toMatch(/Next appointment/i);
    expect(container.textContent).toContain("14:00");
    expect(container.textContent).toContain("Patient ID 502");
  });

  it("shows empty copy when there are no appointments today", async () => {
    vi.useFakeTimers({ now: new Date(2026, 1, 1, 12, 0, 0), toFake: ["Date"] });
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      expect(u).toMatch(/from=2026-02-01/);
      expect(u).toMatch(/to=2026-02-01/);
      return Promise.resolve(jsonResponse({ appointments: [] }));
    });
    await act(async () => {
      root.render(
        <DashboardHome
          onOpenModule={() => {}}
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toMatch(/No appointments found for today/i);
  });

  it("picks the next upcoming appointment after now for the Next card", async () => {
    vi.useFakeTimers({ now: new Date(2026, 7, 10, 11, 0, 0), toFake: ["Date"] });
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          appointments: [
            appt({ id: "a", date: "2026-08-10", time: "09:00", patId: "1" }),
            appt({ id: "b", date: "2026-08-10", time: "13:30", patId: "2" }),
            appt({ id: "c", date: "2026-08-10", time: "15:00", patId: "3" }),
          ],
        }),
      ),
    );
    await act(async () => {
      root.render(
        <DashboardHome
          onOpenModule={() => {}}
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const t = container.textContent ?? "";
    const idx = t.indexOf("Next appointment");
    expect(idx).toBeGreaterThan(-1);
    const slice = t.slice(idx, idx + 400);
    expect(slice).toContain("13:30");
    expect(slice).toContain("Patient ID 2");
    expect(slice).not.toContain("Patient ID 3");
  });

  it("shows no-upcoming copy when all appointments are earlier today", async () => {
    vi.useFakeTimers({ now: new Date(2026, 3, 5, 18, 0, 0), toFake: ["Date"] });
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          appointments: [appt({ id: "1", date: "2026-04-05", time: "08:00", patId: "9" })],
        }),
      ),
    );
    await act(async () => {
      root.render(
        <DashboardHome
          onOpenModule={() => {}}
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toMatch(/No upcoming appointments on the schedule for today/i);
  });
});
