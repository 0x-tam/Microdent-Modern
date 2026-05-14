// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SchedulePanel } from "./SchedulePanel.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const activeDays = {
  sunday: true,
  monday: false,
  tuesday: false,
  wednesday: false,
  thursday: false,
  friday: false,
  saturday: false,
};

const sampleRooms = {
  rooms: [
    { room: 1, displayName: "Synthetic bay A", activeDays, doctorId: 9 },
    { room: 2, displayName: "Synthetic bay B", activeDays, doctorId: null },
  ],
};

function sampleAppointments(from: string) {
  return {
    appointments: [
      {
        id: "501",
        date: from,
        time: "09:00",
        durationSlots: 2,
        periodMinutes: 30,
        room: 1,
        status: 2,
        docId: 3,
        patId: "9001",
        procClass: 1,
        vacId: 0,
        recall: 0,
        unreason: 0,
        missed: false,
        hasComment: true,
      },
    ],
  };
}

describe("SchedulePanel", () => {
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

  it("does not fetch when the bridge is offline", async () => {
    const fetchImpl = vi.fn();
    await act(async () => {
      root.render(
        <SchedulePanel
          isActive
          bridgePhase="offline"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onBackToday={() => {}}
        />,
      );
    });
    expect(container.textContent).toMatch(/Connect the clinic service|clinic service/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("shows loading then appointments from synthetic DTOs", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/rooms")) {
        return Promise.resolve(jsonResponse(sampleRooms));
      }
      if (u.includes("/v1/schedule/appointments")) {
        const m = u.match(/from=([^&]+)/);
        const fromQ = m ? decodeURIComponent(m[1]) : "";
        expect(fromQ.length).toBe(10);
        return Promise.resolve(jsonResponse(sampleAppointments(fromQ)));
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });

    await act(async () => {
      root.render(
        <SchedulePanel
          isActive
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onBackToday={() => {}}
        />,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("09:00");
    expect(container.textContent).toContain("Patient ID 9001");
    expect(container.textContent).toContain("Synthetic bay A");
    expect(container.textContent).toMatch(/Confirmed|Note/i);
  });

  it("does not render PAT_NAME, TELEPHONE, or COMMENT as visible labels or leaked tokens", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/rooms")) {
        return Promise.resolve(jsonResponse({ rooms: [] }));
      }
      if (u.includes("/v1/schedule/appointments")) {
        const m = u.match(/from=([^&]+)/);
        const fromQ = m ? decodeURIComponent(m[1]) : "";
        return Promise.resolve(
          jsonResponse({
            appointments: [
              {
                id: "1",
                date: fromQ,
                time: "08:00",
                durationSlots: 1,
                periodMinutes: 30,
                room: 1,
                status: 1,
                docId: 0,
                patId: "0",
                procClass: 0,
                vacId: 0,
                recall: 0,
                unreason: 0,
                missed: false,
                hasComment: false,
              },
            ],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    });

    await act(async () => {
      root.render(
        <SchedulePanel
          isActive
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onBackToday={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const t = container.textContent ?? "";
    expect(t).not.toMatch(/\bPAT_NAME\b/i);
    expect(t).not.toMatch(/\bTELEPHONE\b/i);
    expect(t).not.toMatch(/\bCOMMENT\b/i);
    expect(t).toContain("Read-only schedule");
  });

  it("refetches appointments when the room filter changes", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/rooms")) {
        return Promise.resolve(jsonResponse(sampleRooms));
      }
      if (u.includes("/v1/schedule/appointments")) {
        return Promise.resolve(jsonResponse({ appointments: [] }));
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    });

    await act(async () => {
      root.render(
        <SchedulePanel
          isActive
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onBackToday={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const apptCalls0 = fetchImpl.mock.calls.filter((c) => String(c[0]).includes("appointments")).length;
    expect(apptCalls0).toBeGreaterThanOrEqual(1);

    const sel = container.querySelector("select.app-schedule__select") as HTMLSelectElement | null;
    expect(sel).not.toBeNull();
    await act(async () => {
      sel!.value = "1";
      sel!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    const withRoom = fetchImpl.mock.calls.filter(
      (c) => String(c[0]).includes("appointments") && String(c[0]).includes("room=1"),
    );
    expect(withRoom.length).toBeGreaterThanOrEqual(1);
  });

  it("refetches when Refresh is clicked", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/rooms")) {
        return Promise.resolve(jsonResponse({ rooms: [] }));
      }
      if (u.includes("/v1/schedule/appointments")) {
        return Promise.resolve(jsonResponse({ appointments: [] }));
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    });

    await act(async () => {
      root.render(
        <SchedulePanel
          isActive
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onBackToday={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const before = fetchImpl.mock.calls.length;
    const refreshBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Refresh"));
    expect(refreshBtn).toBeDefined();
    await act(async () => {
      refreshBtn!.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(before);
  });

  it("shows an error message when appointments cannot be loaded", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/rooms")) {
        return Promise.resolve(jsonResponse({ rooms: [] }));
      }
      if (u.includes("/v1/schedule/appointments")) {
        return Promise.resolve(new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } }));
      }
      return Promise.reject(new Error(String(input)));
    });

    await act(async () => {
      root.render(
        <SchedulePanel
          isActive
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onBackToday={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toMatch(/Could not load the schedule/i);
  });
});
