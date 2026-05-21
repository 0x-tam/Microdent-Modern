// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SchedulePanel } from "./SchedulePanel.js";
import { assertNoForbiddenDomTokens } from "./read-only-smoke-fixtures.js";

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
        jsonResponse({
          writeMode: "disabled",
          writesPermitted: false,
          writableSandbox: false,
          dataRootConfigured: false,
          backupDirConfigured: false,
          sqlitePathConfigured: false,
        }),
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

  it("shows checking copy without fetching schedule", async () => {
    const fetchImpl = vi.fn();
    await act(async () => {
      root.render(
        <SchedulePanel
          isActive
          bridgePhase="checking"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          onBackToday={() => {}}
        />,
      );
    });
    expect(container.textContent).toMatch(/Waiting for the clinic service/i);
    expect(fetchImpl).not.toHaveBeenCalled();
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
    assertNoForbiddenDomTokens(t);
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
    expect(container.textContent).toMatch(/Retry/i);
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

  it("falls back to Unknown provider {id} when doctor is not in reference", async () => {
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

    expect(container.textContent).toContain("Unknown provider 99");
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
    expect(container.textContent).toContain("Unknown provider 3");
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
    expect(rowText).toContain("Unknown provider 3");
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

  it("shows schedule-level sandbox banner once and collapsed write panel per row when pilot is on", async () => {
    const fetchImpl = withReferenceDoctors((input) => {
      const u = String(input);
      if (u.includes("/v1/meta/write-capability")) {
        return Promise.resolve(
          jsonResponse({
            writeMode: "enabled",
            writesPermitted: true,
            writableSandbox: true,
            dataRootConfigured: true,
            backupDirConfigured: true,
            sqlitePathConfigured: true,
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
          sandboxWritePilot
          onBackToday={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelectorAll(".app-schedule__sandbox-write-banner")).toHaveLength(1);
    expect(container.textContent).toMatch(/Sandbox write pilot/i);
    expect(container.textContent).toMatch(/Expand row for sandbox write actions/i);
    const writePanels = container.querySelectorAll('[data-testid="appt-write-actions-panel"]');
    expect(writePanels).toHaveLength(1);
    expect((writePanels[0] as HTMLDetailsElement).open).toBe(false);
  });

  it("does not render write panels when sandbox pilot is off", async () => {
    const fetchImpl = withReferenceDoctors((input) => {
      const u = String(input);
      if (u.includes("/v1/meta/write-capability")) {
        return Promise.resolve(
          jsonResponse({
            writeMode: "enabled",
            writesPermitted: true,
            writableSandbox: true,
            dataRootConfigured: true,
            backupDirConfigured: true,
            sqlitePathConfigured: true,
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
          sandboxWritePilot={false}
          onBackToday={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="appt-write-actions-panel"]')).toBeNull();
    expect(container.querySelector(".app-schedule__sandbox-write-banner")).toBeNull();
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
            dataRootConfigured: true,
            backupDirConfigured: false,
            sqlitePathConfigured: false,
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

  it("shows blocked write notice per row when pilot is on but sandbox is not ready", async () => {
    const fetchImpl = withReferenceDoctors((input) => {
      const u = String(input);
      if (u.includes("/v1/meta/write-capability")) {
        return Promise.resolve(
          jsonResponse({
            writeMode: "disabled",
            writesPermitted: false,
            writableSandbox: false,
            dataRootConfigured: false,
            backupDirConfigured: false,
            sqlitePathConfigured: false,
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
          sandboxWritePilot
          onBackToday={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelectorAll(".app-schedule__sandbox-write-banner")).toHaveLength(1);
    expect(container.querySelector('[data-testid="appt-write-actions-blocked"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appt-create-write-blocked"]')).toBeTruthy();
  });

  it("shows footer create panel when sandbox pilot is ready", async () => {
    const fetchImpl = withReferenceDoctors((input) => {
      const u = String(input);
      if (u.includes("/v1/meta/write-capability")) {
        return Promise.resolve(
          jsonResponse({
            writeMode: "enabled",
            writesPermitted: true,
            writableSandbox: true,
            dataRootConfigured: true,
            backupDirConfigured: true,
            sqlitePathConfigured: true,
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
          sandboxWritePilot
          onBackToday={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="appt-create-write-pilot"]')).toBeTruthy();
  });

  it("syncs create defaultDate when schedule range navigates", async () => {
    const fetchImpl = withReferenceDoctors((input) => {
      const u = String(input);
      if (u.includes("/v1/meta/write-capability")) {
        return Promise.resolve(
          jsonResponse({
            writeMode: "enabled",
            writesPermitted: true,
            writableSandbox: true,
            dataRootConfigured: true,
            backupDirConfigured: true,
            sqlitePathConfigured: true,
          }),
        );
      }
      if (u.includes("/v1/schedule/rooms")) {
        return Promise.resolve(jsonResponse({ rooms: [] }));
      }
      if (u.includes("/v1/schedule/appointments")) {
        return Promise.resolve(jsonResponse({ appointments: [] }));
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
          sandboxWritePilot
          onBackToday={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const rangeBefore = container.querySelector("time[dateTime]")?.getAttribute("dateTime")?.split("/")[0] ?? "";
    const createDetails = container.querySelector('[data-testid="appt-create-write-pilot"]') as HTMLDetailsElement;
    await act(async () => {
      createDetails.open = true;
    });
    const dateInputBefore = container.querySelector(
      '[data-testid="appt-create-write-pilot"] input[type="date"]',
    ) as HTMLInputElement;
    expect(dateInputBefore?.value).toBe(rangeBefore);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    const rangeAfter = container.querySelector("time[dateTime]")?.getAttribute("dateTime")?.split("/")[0] ?? "";
    expect(rangeAfter).not.toBe(rangeBefore);
    const dateInputAfter = container.querySelector(
      '[data-testid="appt-create-write-pilot"] input[type="date"]',
    ) as HTMLInputElement;
    expect(dateInputAfter?.value).toBe(rangeAfter);
  });

  it("refetches schedule after a sandbox status commit", async () => {
    const dryRunPlan = {
      operationId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      workflow: "appointment.statusUpdate",
      mode: "dry-run" as const,
      tablesAffected: ["SCHEDULE"],
      recordIds: ["501"],
      fieldsChanged: [
        { table: "SCHEDULE", recordId: "501", field: "STATUS", changeType: "set" as const },
      ],
      backupRequired: true,
      backupWouldCreate: true,
      warnings: [],
      committed: false,
      createdAt: "2026-05-15T12:00:00.000Z",
    };
    const committedPlan = { ...dryRunPlan, committed: true, mode: "enabled" as const };

    vi.stubGlobal("confirm", vi.fn(() => true));

    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      const intent = (init?.headers as Record<string, string> | undefined)?.["X-Write-Intent"];
      if (u.includes("/v1/meta/write-capability")) {
        return Promise.resolve(
          jsonResponse({
            writeMode: "enabled",
            writesPermitted: true,
            writableSandbox: true,
            dataRootConfigured: true,
            backupDirConfigured: true,
            sqlitePathConfigured: true,
          }),
        );
      }
      if (u.includes("/v1/reference/doctors")) {
        return Promise.resolve(jsonResponse(syntheticDoctors));
      }
      if (u.includes("/v1/reference/procedures")) {
        return Promise.resolve(jsonResponse({ procedures: [] }));
      }
      if (u.includes("/status") && intent === "dry-run") {
        return Promise.resolve(jsonResponse(dryRunPlan));
      }
      if (u.includes("/status") && intent === "commit") {
        return Promise.resolve(jsonResponse(committedPlan));
      }
      if (u.includes("/write-audit-recent")) {
        return Promise.resolve(jsonResponse({ sqliteConfigured: true, sqliteUsable: true, entries: [] }));
      }
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
          sandboxWritePilot
          onBackToday={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const apptCallsBefore = fetchImpl.mock.calls.filter(
      (c) => String(c[0]).includes("/v1/schedule/appointments") && !String(c[0]).includes("/status"),
    ).length;
    expect(apptCallsBefore).toBeGreaterThanOrEqual(1);

    const details = container.querySelector('[data-testid="appt-write-actions-panel"]') as HTMLDetailsElement;
    await act(async () => {
      details.open = true;
    });

    const select = details.querySelector("select.app-appt-status-write__select");
    expect(select).toBeTruthy();
    await act(async () => {
      if (!select) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setter?.call(select, "3");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const previewBtn = [...details.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Preview status change"),
    );
    await act(async () => {
      previewBtn?.click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const applyBtn = [...details.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Apply status change"),
    );
    await act(async () => {
      applyBtn?.click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("/status"),
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Write-Intent": "commit" }),
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const apptCallsAfter = fetchImpl.mock.calls.filter(
      (c) => String(c[0]).includes("/v1/schedule/appointments") && !String(c[0]).includes("/status"),
    ).length;
    expect(apptCallsAfter).toBeGreaterThan(apptCallsBefore);

    vi.unstubAllGlobals();
  });

  it("switches to day view and emphasizes Today when on current day", async () => {
    const fetchImpl = withReferenceDoctors((input) => {
      const u = String(input);
      if (u.includes("/v1/schedule/rooms")) {
        return Promise.resolve(jsonResponse({ rooms: [] }));
      }
      if (u.includes("/v1/schedule/appointments")) {
        return Promise.resolve(jsonResponse({ appointments: [] }));
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
    });

    const dayBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Day");
    await act(async () => {
      dayBtn?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const todayBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Today");
    expect(todayBtn?.classList.contains("app-schedule__nav-today--active")).toBe(true);
    expect(container.textContent).toMatch(/Includes today/i);
  });

  it("shows status breakdown chips and room filter context in the summary header", async () => {
    const fetchImpl = withReferenceDoctors((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/rooms")) {
        return Promise.resolve(jsonResponse(sampleRooms));
      }
      if (u.includes("/v1/schedule/appointments")) {
        const m = u.match(/from=([^&]+)/);
        const fromQ = m ? decodeURIComponent(m[1]) : "";
        const roomMatch = u.match(/room=(\d+)/);
        const room = roomMatch ? Number(roomMatch[1]) : 1;
        return Promise.resolve(
          jsonResponse({
            appointments: [
              {
                id: "1",
                date: fromQ,
                time: "09:00",
                durationSlots: 1,
                periodMinutes: 30,
                room,
                status: 1,
                docId: 0,
                patId: "100",
                patient: { patientId: "100", displayName: "Status Mix Synth", chartNumber: "SM-1" },
                procClass: 0,
                vacId: 0,
                recall: 0,
                unreason: 0,
                missed: false,
                hasComment: false,
              },
              {
                id: "2",
                date: fromQ,
                time: "10:00",
                durationSlots: 1,
                periodMinutes: 30,
                room,
                status: 3,
                docId: 0,
                patId: "101",
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
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toMatch(/1 Scheduled/i);
    expect(container.textContent).toMatch(/1 Completed/i);
    expect(container.querySelector(".app-schedule__status-breakdown")).toBeTruthy();

    const scheduledChip = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("1 Scheduled"),
    );
    expect(scheduledChip).toBeTruthy();
    await act(async () => {
      scheduledChip!.click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toMatch(/1 appointment in this range/i);
    expect(container.querySelectorAll(".app-schedule__appt-row")).toHaveLength(1);

    await act(async () => {
      scheduledChip!.click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const select = container.querySelector("select.app-schedule__select") as HTMLSelectElement;
    await act(async () => {
      select.value = "2";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toMatch(/Synthetic bay B \(Room 2\)/i);
    expect(container.textContent).toMatch(/2 appointments in this range/i);
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });

  it("shows mirror stale advisory when mirror metadata is old", async () => {
    const staleFinishedAt = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
    const fetchImpl = withReferenceDoctors((input: RequestInfo | URL) => {
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
          mirrorStatus={{
            sqliteConfigured: true,
            sqliteUsable: true,
            importedTables: ["patients"],
            latestImportRuns: [
              {
                tableName: "patients",
                status: "success",
                rowCount: 1,
                errorCount: 0,
                finishedAt: staleFinishedAt,
              },
            ],
          }}
          onBackToday={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toMatch(/Local copy may be outdated/i);
    expect(container.querySelector(".app-schedule__mirror-advisory")).toBeTruthy();
  });

  it("calls onOpenPatient from schedule rows when patient id is set", async () => {
    const onOpenPatient = vi.fn();
    const fetchImpl = withReferenceDoctors((input: RequestInfo | URL) => {
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
                id: "501",
                date: fromQ,
                time: "09:00",
                durationSlots: 1,
                periodMinutes: 30,
                room: 1,
                status: 1,
                docId: 0,
                patId: "9001",
                patient: {
                  patientId: "9001",
                  displayName: "Open Patient Synth",
                  chartNumber: "OP-1",
                },
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
          onOpenPatient={onOpenPatient}
          onBackToday={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const openBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Open patient record"),
    );
    expect(openBtn).toBeTruthy();
    await act(async () => {
      openBtn!.click();
    });
    expect(onOpenPatient).toHaveBeenCalledWith("9001", {
      displayName: "Open Patient Synth",
      chartNumber: "OP-1",
    });
  });

  it("filters by provider chips and shows per-day counts", async () => {
    const fetchImpl = withReferenceDoctors((input: RequestInfo | URL) => {
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
              { ...sampleAppointments(fromQ).appointments[0], id: "1", docId: 3, time: "09:00" },
              {
                ...sampleAppointments(fromQ).appointments[0],
                id: "2",
                docId: 99,
                time: "11:00",
                patId: "0",
                patient: null,
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
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toMatch(/Synthetic Provider Sched/i);
    expect(container.textContent).toMatch(/2 appointments/i);

    const providerChip = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Synthetic Provider Sched"),
    );
    await act(async () => {
      providerChip?.click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toMatch(/1 appointment in this range/i);
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });

  it("highlights the current appointment when today is in range", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10, 11, 15, 0));

    const fetchImpl = withReferenceDoctors((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/rooms")) {
        return Promise.resolve(jsonResponse({ rooms: [] }));
      }
      if (u.includes("/v1/schedule/appointments")) {
        return Promise.resolve(
          jsonResponse({
            appointments: [
              {
                id: "current",
                date: "2026-08-10",
                time: "11:00",
                durationSlots: 2,
                periodMinutes: 30,
                room: 1,
                status: 2,
                docId: 3,
                patId: "1",
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
      await Promise.resolve();
      await Promise.resolve();
    });

    const dayBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Day");
    await act(async () => {
      dayBtn?.click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector(".app-schedule__appt-row--current")).toBeTruthy();
    vi.useRealTimers();
  });

  it("extends mirror stale copy when client filters are active", async () => {
    const staleFinishedAt = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
    const fetchImpl = withReferenceDoctors((input: RequestInfo | URL) => {
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
              { ...sampleAppointments(fromQ).appointments[0], id: "1", status: 1 },
              { ...sampleAppointments(fromQ).appointments[0], id: "2", status: 3, time: "11:00" },
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
          mirrorStatus={{
            sqliteConfigured: true,
            sqliteUsable: true,
            importedTables: ["patients"],
            latestImportRuns: [
              {
                tableName: "patients",
                status: "success",
                rowCount: 1,
                errorCount: 0,
                finishedAt: staleFinishedAt,
              },
            ],
          }}
          onBackToday={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const scheduledChip = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Scheduled"),
    );
    await act(async () => {
      scheduledChip?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toMatch(/Active room, status, or provider filters/i);
  });

  it("opens patient after status filter is applied", async () => {
    const onOpenPatient = vi.fn();
    const fetchImpl = withReferenceDoctors((input: RequestInfo | URL) => {
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
                id: "501",
                date: fromQ,
                time: "09:00",
                durationSlots: 1,
                periodMinutes: 30,
                room: 1,
                status: 1,
                docId: 0,
                patId: "9001",
                patient: {
                  patientId: "9001",
                  displayName: "Filtered Open Patient",
                  chartNumber: "FOP-1",
                },
                procClass: 0,
                vacId: 0,
                recall: 0,
                unreason: 0,
                missed: false,
                hasComment: false,
              },
              {
                id: "502",
                date: fromQ,
                time: "10:00",
                durationSlots: 1,
                periodMinutes: 30,
                room: 1,
                status: 3,
                docId: 0,
                patId: "9002",
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
          onOpenPatient={onOpenPatient}
          onBackToday={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const scheduledChip = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("1 Scheduled"),
    );
    await act(async () => {
      scheduledChip?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const openBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Open patient record"),
    );
    await act(async () => {
      openBtn!.click();
    });
    expect(onOpenPatient).toHaveBeenCalledWith("9001", {
      displayName: "Filtered Open Patient",
      chartNumber: "FOP-1",
    });
  });

  it("places write-mode chip in the footer near write panels", async () => {
    const fetchImpl = withReferenceDoctors((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/meta/write-capability")) {
        return Promise.resolve(
          jsonResponse({
            writeMode: "dry-run",
            writesPermitted: false,
            writableSandbox: true,
            dataRootConfigured: true,
            backupDirConfigured: true,
            sqlitePathConfigured: true,
          }),
        );
      }
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
          sandboxWritePilot
          onBackToday={() => {}}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const footer = container.querySelector(".app-schedule__footer");
    expect(footer?.querySelector(".app-schedule__write-mode-chip")).toBeTruthy();
    expect(container.querySelector(".app-schedule__toolbar-actions .app-schedule__write-mode-chip")).toBeNull();
  });
});
