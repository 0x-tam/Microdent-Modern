// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DashboardHome } from "./today-dashboard.js";
import { assertNoForbiddenDomTokens, assertNoMainPageJargonInDom } from "./read-only-smoke-fixtures.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const syntheticDoctors = {
  doctors: [{ doctorId: "3", displayName: "Synthetic Provider Today", active: true }],
};

function withReferenceDoctors(
  inner: (input: RequestInfo | URL) => Promise<Response>,
  doctors: unknown | "fail" = syntheticDoctors,
): ReturnType<typeof vi.fn> {
  return vi.fn((input: RequestInfo | URL) => {
    const u = String(input);
    if (u.includes("/v1/reference/doctors")) {
      if (doctors === "fail") {
        return Promise.resolve(new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } }));
      }
      return Promise.resolve(jsonResponse(doctors));
    }
    return inner(input);
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
    patient: null,
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

  it("uses workflow-first layout with CommandCenter and appointment sections", async () => {
    vi.useFakeTimers({ now: new Date(2026, 5, 15, 10, 30, 0), toFake: ["Date"] });
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/appointments")) {
        return Promise.resolve(jsonResponse({ appointments: [] }));
      }
      return Promise.reject(new Error(`unexpected ${u}`));
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

    // New layout: CommandCenter + schedule section + footer
    expect(container.querySelector(".ui-command")).toBeTruthy();
    expect(container.querySelector(".today-schedule-section")).toBeTruthy();
    expect(container.querySelector(".today-footer")).toBeTruthy();
    // Old layout classes should not exist
    expect(container.querySelector(".clinic-workspace-grid")).toBeFalsy();
    expect(container.querySelector(".clinic-col-8")).toBeFalsy();
    expect(container.querySelector(".clinic-col-4")).toBeFalsy();
    expect(container.querySelector(".clinic-status-compact")).toBeFalsy();
    expect(container.querySelector(".clinic-stat-grid--five")).toBeFalsy();
    expect(container.textContent).not.toMatch(/Clinic at a glance/i);
    assertNoMainPageJargonInDom(container.textContent ?? "");
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
              appt({
                id: "1",
                date: "2026-06-15",
                time: "08:00",
                patId: "501",
                docId: 3,
                hasComment: true,
                missed: true,
                patient: { patientId: "501", displayName: "Synthetic Dashboard One", chartNumber: "DASH-501" },
              }),
              appt({
                id: "2",
                date: "2026-06-15",
                time: "14:00",
                patId: "502",
                patient: { patientId: "502", displayName: "Synthetic Dashboard Two", chartNumber: null },
              }),
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

    expect(container.textContent).toMatch(/On the schedule today/i);
    expect(container.textContent).toMatch(/2 scheduled/i);
    expect(container.textContent).toContain("08:00");
    expect(container.textContent).toContain("Synthetic Dashboard One");
    expect(container.textContent).toContain("DASH-501");
    expect(container.textContent).toContain("Missed");
    expect(container.textContent).toContain("14:00");
    expect(container.textContent).toContain("Synthetic Dashboard Two");
    expect(container.textContent).not.toMatch(/\bPAT_NAME\b|\bTELEPHONE\b|\bCOMMENT\b/i);
    expect(container.textContent).not.toContain("555-");
    expect(container.textContent).toMatch(/Next up/i);
    expect(container.textContent).toContain("14:00");
    expect(container.textContent).toContain("Synthetic Dashboard Two");
    assertNoForbiddenDomTokens(container.textContent ?? "");
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
    expect(container.textContent).toMatch(/No appointments today/i);
  });

  it("picks the next upcoming appointment after now for the Next card", async () => {
    vi.useFakeTimers({ now: new Date(2026, 7, 10, 11, 0, 0), toFake: ["Date"] });
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          appointments: [
            appt({ id: "a", date: "2026-08-10", time: "09:00", patId: "1", patient: null }),
            appt({
              id: "b",
              date: "2026-08-10",
              time: "13:30",
              patId: "2",
              patient: { patientId: "2", displayName: "Next Card Synth", chartNumber: "NC-2" },
            }),
            appt({ id: "c", date: "2026-08-10", time: "15:00", patId: "3", patient: null }),
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
    expect(t).toMatch(/Next up/i);
    // The "Next up" card gets .today-appt-card--next class
    const nextCard = container.querySelector(".today-appt-card--next");
    expect(nextCard).toBeTruthy();
    const nextText = nextCard!.textContent ?? "";
    expect(nextText).toContain("13:30");
    expect(nextText).toContain("Next Card Synth");
    expect(nextText).toContain("NC-2");
    expect(nextText).not.toContain("Patient ID 3");
  });

  it("falls back to Patient ID when patient summary is missing", async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 1, 9, 0, 0), toFake: ["Date"] });
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          appointments: [appt({ id: "1", date: "2026-10-01", time: "10:00", patId: "770077", patient: null })],
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
    expect(container.textContent).toContain("Patient ID 770077");
  });

  it("shows a safe error state when schedule load fails", async () => {
    vi.useFakeTimers({ now: new Date(2026, 4, 20, 12, 0, 0), toFake: ["Date"] });
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } })),
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
    expect(container.textContent).toMatch(/Could not load today's schedule/i);
    expect(container.textContent).toMatch(/Retry/i);
  });

  it("does not render PAT_NAME, TELEPHONE, or COMMENT tokens from the API", async () => {
    vi.useFakeTimers({ now: new Date(2026, 6, 4, 10, 0, 0), toFake: ["Date"] });
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          appointments: [
            {
              ...appt({ id: "1", date: "2026-07-04", time: "09:00", patId: "1", patient: null }),
              PAT_NAME: "Leaked Schedule Name",
              TELEPHONE: "555-0100",
              COMMENT: "Secret note body",
            },
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
    expect(t).not.toContain("Leaked Schedule Name");
    expect(t).not.toContain("555-0100");
    expect(t).not.toContain("Secret note body");
    expect(t).not.toMatch(/\bPAT_NAME\b/i);
    expect(t).not.toMatch(/\bTELEPHONE\b/i);
    expect(t).not.toMatch(/\bCOMMENT\b/i);
    assertNoForbiddenDomTokens(t);
    expect(t).toContain("Patient ID 1");
  });

  it("shows mapped procedure label on visit meta when reference matches procClass", async () => {
    vi.useFakeTimers({ now: new Date(2026, 5, 15, 10, 30, 0), toFake: ["Date"] });
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/appointments")) {
        return Promise.resolve(
          jsonResponse({
            appointments: [
              appt({
                id: "1",
                date: "2026-06-15",
                time: "09:00",
                procClass: 44,
                patient: { patientId: "1", displayName: "Synthetic Today Proc", chartNumber: null },
              }),
            ],
          }),
        );
      }
      if (u.includes("/v1/reference/procedures")) {
        return Promise.resolve(
          jsonResponse({
            procedures: [
              {
                procedureCode: "SYN04",
                displayName: null,
                category: "Synthetic today category",
                categoryCode: null,
                classId: 44,
                chartRelevant: false,
              },
            ],
          }),
        );
      }
      if (u.includes("/v1/reference/doctors")) {
        return Promise.resolve(jsonResponse({ doctors: [] }));
      }
      return Promise.reject(new Error(`unexpected ${u}`));
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

    expect(container.textContent).toContain("Synthetic today category");
    expect(container.textContent).not.toContain("Procedure class 44");
    expect(container.textContent).not.toMatch(/\bPRICE\d*\b/i);
  });

  it("falls back to Procedure class when procedure reference is unavailable", async () => {
    vi.useFakeTimers({ now: new Date(2026, 5, 15, 10, 30, 0), toFake: ["Date"] });
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/appointments")) {
        return Promise.resolve(
          jsonResponse({
            appointments: [
              appt({
                id: "1",
                date: "2026-06-15",
                time: "09:00",
                procClass: 7,
                patient: { patientId: "1", displayName: "Synthetic Today Fallback", chartNumber: null },
              }),
            ],
          }),
        );
      }
      if (u.includes("/v1/reference/procedures")) {
        return Promise.resolve(new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } }));
      }
      if (u.includes("/v1/reference/doctors")) {
        return Promise.resolve(jsonResponse({ doctors: [] }));
      }
      return Promise.reject(new Error(`unexpected ${u}`));
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

    expect(container.textContent).toContain("Procedure class 7");
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
    expect(container.textContent).toMatch(/No upcoming/i);
  });

  it("shows reference doctor label on today appointments", async () => {
    vi.useFakeTimers({ now: new Date(2026, 5, 15, 10, 30, 0), toFake: ["Date"] });
    const fetchImpl = withReferenceDoctors((input) => {
      const u = String(input);
      if (u.includes("/v1/schedule/appointments")) {
        return Promise.resolve(
          jsonResponse({
            appointments: [appt({ id: "1", date: "2026-06-15", time: "08:00", docId: 3, patId: "501", patient: null })],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected ${u}`));
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

    expect(container.textContent).toContain("Synthetic Provider Today");
    expect(container.textContent).not.toMatch(/\bDoc 3\b/);
  });

  it("falls back to Unknown provider {id} when doctor is not in reference", async () => {
    vi.useFakeTimers({ now: new Date(2026, 5, 15, 10, 30, 0), toFake: ["Date"] });
    const fetchImpl = withReferenceDoctors((input) => {
      const u = String(input);
      if (u.includes("/v1/schedule/appointments")) {
        return Promise.resolve(
          jsonResponse({
            appointments: [appt({ id: "1", date: "2026-06-15", time: "08:00", docId: 88, patId: "501", patient: null })],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    }, { doctors: [] });

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

    expect(container.textContent).toContain("Unknown provider 88");
  });

  it("still renders today schedule when reference doctors fail", async () => {
    vi.useFakeTimers({ now: new Date(2026, 5, 15, 10, 30, 0), toFake: ["Date"] });
    const fetchImpl = withReferenceDoctors(
      (input) => {
        const u = String(input);
        if (u.includes("/v1/schedule/appointments")) {
          return Promise.resolve(
            jsonResponse({
              appointments: [
                appt({
                  id: "1",
                  date: "2026-06-15",
                  time: "08:00",
                  docId: 3,
                  patId: "501",
                  patient: { patientId: "501", displayName: "Synthetic Dashboard One", chartNumber: null },
                }),
              ],
            }),
          );
        }
        return Promise.reject(new Error(`unexpected ${u}`));
      },
      "fail",
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

    expect(container.textContent).toContain("Synthetic Dashboard One");
    expect(container.textContent).toContain("Unknown provider 3");
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });
});
