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

const syntheticDoctors = {
  doctors: [{ doctorId: "3", displayName: "Synthetic Provider Sched", active: true }],
};

const syntheticProcedures = {
  procedures: [
    {
      procedureCode: "000001",
      displayName: "Synthetic schedule procedure label",
      category: null,
      categoryCode: null,
      classId: 1,
      chartRelevant: true,
    },
  ],
};

function withReferenceDoctors(
  inner: (input: RequestInfo | URL) => Promise<Response>,
  doctors: unknown | "fail" = syntheticDoctors,
  procedures: unknown | "fail" = { procedures: [] },
): ReturnType<typeof vi.fn> {
  return vi.fn((input: RequestInfo | URL) => {
    const u = String(input);
    if (u.includes("/v1/meta/write-capability")) {
      return Promise.resolve(inner(input)).catch(() =>
        jsonResponse({ writeMode: "disabled", writesPermitted: false, writableSandbox: false }),
      );
    }
    if (u.includes("/v1/reference/doctors")) {
      if (doctors === "fail") {
        return Promise.resolve(new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } }));
      }
      return Promise.resolve(jsonResponse(doctors));
    }
    if (u.includes("/v1/reference/procedures")) {
      if (procedures === "fail") {
        return Promise.resolve(new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } }));
      }
      return Promise.resolve(jsonResponse(procedures));
    }
    return inner(input);
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
        patient: {
          patientId: "9001",
          displayName: "Synthetic Schedule Panel Patient",
          chartNumber: "PNL-9K",
        },
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
    expect(container.textContent).toContain("Synthetic Schedule Panel Patient");
    expect(container.textContent).toContain("PNL-9K");
    expect(container.textContent).not.toContain("Patient ID 9001");
    expect(container.textContent).toContain("Synthetic bay A (Room 1)");
    expect(container.textContent).toMatch(/Confirmed|Note/i);
    const rangeTime = container.querySelector("time[dateTime]");
    expect(rangeTime).toBeTruthy();
    expect(rangeTime?.textContent?.length).toBeGreaterThan(0);
  });

  it("exposes copy-friendly room labels in the filter and headings", async () => {
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
      await Promise.resolve();
    });

    const sel = container.querySelector("select.app-schedule__select") as HTMLSelectElement;
    expect(sel.options[1]?.textContent).toContain("Synthetic bay A (Room 1)");
    expect(sel.options[2]?.textContent).toContain("Synthetic bay B (Room 2)");
  });

  it("moves the schedule range with arrow keys when focus is not in a form control", async () => {
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
      await Promise.resolve();
    });

    const rangeBefore = container.querySelector("time[dateTime]")?.getAttribute("dateTime") ?? "";
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    const rangeAfter = container.querySelector("time[dateTime]")?.getAttribute("dateTime") ?? "";
    expect(rangeAfter).not.toBe(rangeBefore);
  });

  it("keeps toolbar navigation buttons keyboard focusable", async () => {
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

    const todayBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Today");
    expect(todayBtn?.classList.contains("ui-focusable")).toBe(true);
    expect(todayBtn?.disabled).toBe(false);
  });

  it("falls back to Patient ID when patient summary is null", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/rooms")) {
        return Promise.resolve(jsonResponse(sampleRooms));
      }
      if (u.includes("/v1/schedule/appointments")) {
        const m = u.match(/from=([^&]+)/);
        const fromQ = m ? decodeURIComponent(m[1]) : "";
        return Promise.resolve(
          jsonResponse({
            appointments: [
              {
                id: "601",
                date: fromQ,
                time: "10:30",
                durationSlots: 1,
                periodMinutes: 30,
                room: 1,
                status: 1,
                docId: 0,
                patId: "770077",
                patient: null,
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

    expect(container.textContent).toContain("Patient ID 770077");
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
                patient: null,
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
    const fetchImpl = withReferenceDoctors((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/rooms")) {
        return Promise.resolve(jsonResponse({ rooms: [] }));
      }
      if (u.includes("/v1/schedule/appointments") && !u.includes("/status")) {
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
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toMatch(/Could not load the schedule/i);
    expect(container.textContent).toMatch(/clinic service connection/i);
    expect(container.textContent).not.toMatch(/No appointments in this range/i);
  });

  it("shows reference doctor displayName on appointments", async () => {
    const fetchImpl = withReferenceDoctors((input) => {
      const u = String(input);
      if (u.includes("/v1/schedule/rooms")) {
        return Promise.resolve(jsonResponse(sampleRooms));
      }
      if (u.includes("/v1/schedule/appointments")) {
        const m = u.match(/from=([^&]+)/);
        const fromQ = m ? decodeURIComponent(m[1]) : "";
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
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Synthetic Provider Sched");
    expect(container.textContent).not.toMatch(/\bDoctor 3\b/);
  });

  it("falls back to Doctor {id} when doctor is not in reference", async () => {
    const fetchImpl = withReferenceDoctors((input) => {
      const u = String(input);
      if (u.includes("/v1/schedule/rooms")) {
        return Promise.resolve(jsonResponse(sampleRooms));
      }
      if (u.includes("/v1/schedule/appointments")) {
        const m = u.match(/from=([^&]+)/);
        const fromQ = m ? decodeURIComponent(m[1]) : "";
        return Promise.resolve(
          jsonResponse({
            appointments: [{ ...sampleAppointments(fromQ).appointments[0], docId: 99 }],
          }),
        );
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
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Doctor 99");
  });

  it("still renders schedule when reference doctors fail", async () => {
    const fetchImpl = withReferenceDoctors(
      (input) => {
        const u = String(input);
        if (u.includes("/v1/schedule/rooms")) {
          return Promise.resolve(jsonResponse(sampleRooms));
        }
        if (u.includes("/v1/schedule/appointments")) {
          const m = u.match(/from=([^&]+)/);
          const fromQ = m ? decodeURIComponent(m[1]) : "";
          return Promise.resolve(jsonResponse(sampleAppointments(fromQ)));
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      },
      "fail",
    );

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
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Synthetic Schedule Panel Patient");
    expect(container.textContent).toContain("Doctor 3");
  });

  it("does not render private doctor fields in the DOM", async () => {
    const fetchImpl = withReferenceDoctors(
      (input) => {
        const u = String(input);
        if (u.includes("/v1/schedule/rooms")) {
          return Promise.resolve(jsonResponse(sampleRooms));
        }
        if (u.includes("/v1/schedule/appointments")) {
          const m = u.match(/from=([^&]+)/);
          const fromQ = m ? decodeURIComponent(m[1]) : "";
          return Promise.resolve(jsonResponse(sampleAppointments(fromQ)));
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      },
      {
        doctors: [
          {
            doctorId: "3",
            displayName: "Synthetic Provider Sched",
            active: true,
            ADDRESS: "Leaked staff street",
            LICNO: "LEAK-LIC",
            NOTES: "Leaked staff memo",
          },
        ],
      },
    );

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
      await Promise.resolve();
      await Promise.resolve();
    });

    const rowText =
      container.querySelector(".app-schedule__appt-row")?.textContent ??
      container.textContent ??
      "";
    expect(rowText).toContain("Doctor 3");
    expect(rowText).not.toContain("Leaked staff street");
    expect(rowText).not.toContain("LEAK-LIC");
    expect(rowText).not.toContain("Leaked staff memo");
    expect(rowText).not.toMatch(/\bactive:\s*(true|false)\b/i);
  });

  it("shows procedure label when reference classId matches procClass", async () => {
    const fetchImpl = withReferenceDoctors(
      (input) => {
        const u = String(input);
        if (u.includes("/v1/schedule/rooms")) {
          return Promise.resolve(jsonResponse(sampleRooms));
        }
        if (u.includes("/v1/schedule/appointments")) {
          const m = u.match(/from=([^&]+)/);
          const fromQ = m ? decodeURIComponent(m[1]) : "";
          return Promise.resolve(jsonResponse(sampleAppointments(fromQ)));
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      },
      syntheticDoctors,
      syntheticProcedures,
    );

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
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Synthetic schedule procedure label");
    expect(container.textContent).not.toContain("Procedure class 1");
  });

  it("falls back to Procedure class when procedure reference is missing", async () => {
    const fetchImpl = withReferenceDoctors((input) => {
      const u = String(input);
      if (u.includes("/v1/schedule/rooms")) {
        return Promise.resolve(jsonResponse(sampleRooms));
      }
      if (u.includes("/v1/schedule/appointments")) {
        const m = u.match(/from=([^&]+)/);
        const fromQ = m ? decodeURIComponent(m[1]) : "";
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
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Procedure class 1");
  });

  it("does not render price or fee fields from procedure reference", async () => {
    const fetchImpl = withReferenceDoctors(
      (input) => {
        const u = String(input);
        if (u.includes("/v1/schedule/rooms")) {
          return Promise.resolve(jsonResponse(sampleRooms));
        }
        if (u.includes("/v1/schedule/appointments")) {
          const m = u.match(/from=([^&]+)/);
          const fromQ = m ? decodeURIComponent(m[1]) : "";
          return Promise.resolve(jsonResponse(sampleAppointments(fromQ)));
        }
        return Promise.reject(new Error(`unexpected fetch ${u}`));
      },
      syntheticDoctors,
      {
        procedures: [
          {
            procedureCode: "000001",
            displayName: "Synthetic label only",
            category: null,
            categoryCode: null,
            classId: 1,
            chartRelevant: false,
            PRICE1: 100,
            fee: 50,
          },
        ],
      },
    );

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
      await Promise.resolve();
      await Promise.resolve();
    });

    const t = container.textContent ?? "";
    expect(t).toContain("Synthetic label only");
    expect(t).not.toMatch(/\bPRICE\d*\b/i);
    expect(t).not.toMatch(/\b100\b/);
    expect(t).not.toMatch(/\bfee\b/i);
  });

  it("shows dry-run action only when dev flag is on", async () => {
    const fetchImpl = withReferenceDoctors((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/rooms")) {
        return Promise.resolve(jsonResponse(sampleRooms));
      }
      if (u.includes("/v1/schedule/appointments") && !u.includes("/status")) {
        const m = u.match(/from=([^&]+)/);
        const fromQ = m ? decodeURIComponent(m[1]) : "";
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
          appointmentStatusDryRunDev={false}
          onBackToday={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).not.toContain("Dry-run status");

    await act(async () => {
      root.render(
        <SchedulePanel
          isActive
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          appointmentStatusDryRunDev={import.meta.env.DEV}
          onBackToday={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    if (import.meta.env.DEV) {
      expect(container.textContent).toContain("Dry-run status");
    } else {
      expect(container.textContent).not.toContain("Dry-run status");
    }
  });

  it("shows compact write-mode chip from write-capability", async () => {
    const fetchImpl = withReferenceDoctors((input) => {
      const u = String(input);
      if (u.includes("/v1/meta/write-capability")) {
        return Promise.resolve(
          jsonResponse({
            writeMode: "dry-run",
            writesPermitted: false,
            writableSandbox: true,
          }),
        );
      }
      if (u.includes("/v1/schedule/rooms")) {
        return Promise.resolve(jsonResponse(sampleRooms));
      }
      if (u.includes("/v1/schedule/appointments")) {
        const m = u.match(/from=([^&]+)/);
        const fromQ = m ? decodeURIComponent(m[1]) : "";
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
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Dry-run");
    expect(container.querySelector(".app-schedule__write-mode-chip")).toBeTruthy();
  });
});
