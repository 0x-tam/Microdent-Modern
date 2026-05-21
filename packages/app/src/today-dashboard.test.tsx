// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DashboardHome } from "./today-dashboard.js";
import { isMirrorImportStale } from "./mirror-stale.js";
import { assertNoForbiddenDomTokens } from "./read-only-smoke-fixtures.js";

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

  it("shows checking copy without fetching schedule", async () => {
    const fetchImpl = vi.fn();
    await act(async () => {
      root.render(
        <DashboardHome
          onOpenModule={() => {}}
          bridgePhase="checking"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
        />,
      );
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/Waiting for the clinic service/i);
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

    expect(container.textContent).toContain("Today's appointments");
    expect(container.textContent).toContain("2");
    expect(container.textContent).toContain("On the schedule today");
    expect(container.textContent).toContain("08:00");
    expect(container.textContent).toContain("Synthetic Dashboard One");
    expect(container.textContent).toContain("DASH-501");
    expect(container.textContent).toContain("Note hidden");
    expect(container.textContent).toContain("Missed");
    expect(container.textContent).toContain("14:00");
    expect(container.textContent).toContain("Synthetic Dashboard Two");
    assertNoForbiddenDomTokens(container.textContent ?? "");
    expect(container.textContent).not.toContain("555-");
    expect(container.textContent).toMatch(/Next appointment/i);
    expect(container.textContent).toContain("14:00");
    expect(container.textContent).toContain("Synthetic Dashboard Two");
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
    const idx = t.indexOf("Next appointment");
    expect(idx).toBeGreaterThan(-1);
    const slice = t.slice(idx, idx + 400);
    expect(slice).toContain("13:30");
    expect(slice).toContain("Next Card Synth");
    expect(slice).toContain("NC-2");
    expect(slice).not.toContain("Patient ID 3");
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
    expect(container.textContent).toMatch(/Schedule unavailable/i);
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
    expect(container.textContent).toMatch(/No upcoming appointments on the schedule for today/i);
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
  });

  it("shows status strip count and mirror freshness in the aside", async () => {
    vi.useFakeTimers({ now: new Date(2026, 5, 15, 10, 30, 0), toFake: ["Date"] });
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/appointments")) {
        return Promise.resolve(
          jsonResponse({
            appointments: [appt({ id: "1", date: "2026-06-15", time: "09:00", patId: "501", patient: null })],
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
          mirrorStatus={{
            sqliteConfigured: true,
            sqliteUsable: true,
            importedTables: ["appointments"],
            latestImportRuns: [
              {
                tableName: "appointments",
                status: "success",
                rowCount: 1,
                errorCount: 0,
                finishedAt: new Date(2026, 5, 14, 12, 0, 0).toISOString(),
              },
            ],
          }}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Data freshness");
    expect(container.textContent).toContain("SQLite mirror active");
    const countIdx = container.textContent?.indexOf("Today's appointments") ?? -1;
    expect(countIdx).toBeGreaterThan(-1);
    expect(container.textContent).toContain("1");
  });

  it("shows mirror stale copy in status strip and schedule advisory", async () => {
    vi.useFakeTimers({ now: new Date(2026, 5, 15, 10, 30, 0), toFake: ["Date"] });
    const staleMirrorStatus = {
      sqliteConfigured: true,
      sqliteUsable: true,
      importedTables: ["appointments"],
      latestImportRuns: [
        {
          tableName: "appointments",
          status: "success" as const,
          rowCount: 1,
          errorCount: 0,
          finishedAt: "2026-04-01T12:00:00.000Z",
        },
      ],
    };
    expect(isMirrorImportStale(staleMirrorStatus, Date.parse("2026-06-15T17:30:00.000Z"))).toBe(true);
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
          mirrorStatus={staleMirrorStatus}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toMatch(/Local copy may be outdated/i);
    expect(container.textContent).toMatch(/older than 48 hours/i);
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });

  it("shows selected patient card when selectedPatientId is set", async () => {
    vi.useFakeTimers({ now: new Date(2026, 5, 15, 10, 30, 0), toFake: ["Date"] });
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ appointments: [] })));

    await act(async () => {
      root.render(
        <DashboardHome
          onOpenModule={() => {}}
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          selectedPatientId="501"
          selectedPatientDisplayName="Synthetic Selected Patient"
          selectedPatientChartNumber="SEL-501"
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Selected patient");
    expect(container.textContent).toContain("Synthetic Selected Patient");
    expect(container.textContent).toContain("Chart SEL-501");
    expect(container.textContent).toContain("Open record");
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });

  it("calls onOpenPatient when open patient is clicked on an appointment row", async () => {
    vi.useFakeTimers({ now: new Date(2026, 5, 15, 8, 0, 0), toFake: ["Date"] });
    const onOpenPatient = vi.fn();
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          appointments: [
            appt({
              id: "1",
              date: "2026-06-15",
              time: "09:00",
              patId: "501",
              patient: { patientId: "501", displayName: "Row Open Synth", chartNumber: "ROW-501" },
            }),
          ],
        }),
      ),
    );

    await act(async () => {
      root.render(
        <DashboardHome
          onOpenModule={() => {}}
          onOpenPatient={onOpenPatient}
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

    const btn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Open patient record"),
    );
    expect(btn).toBeTruthy();
    await act(async () => {
      btn!.click();
    });
    expect(onOpenPatient).toHaveBeenCalledWith("501", {
      displayName: "Row Open Synth",
      chartNumber: "ROW-501",
    });
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });

  it("quick actions navigate via onOpenModule stubs", async () => {
    vi.useFakeTimers({ now: new Date(2026, 5, 15, 10, 30, 0), toFake: ["Date"] });
    const onOpenModule = vi.fn();
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ appointments: [] })));

    await act(async () => {
      root.render(
        <DashboardHome
          onOpenModule={onOpenModule}
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

    const settingsBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.trim() === "Open settings",
    );
    expect(settingsBtn).toBeTruthy();
    await act(async () => {
      settingsBtn!.click();
    });
    expect(onOpenModule).toHaveBeenCalledWith("settings");
    expect(container.textContent).toMatch(/Pilot readiness checklist/i);
    expect(container.textContent).toMatch(/not available in this pilot build/i);
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });

  it("refresh today re-fetches schedule appointments", async () => {
    vi.useFakeTimers({ now: new Date(2026, 5, 15, 10, 30, 0), toFake: ["Date"] });
    let callCount = 0;
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/appointments")) {
        callCount += 1;
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
    expect(callCount).toBe(1);

    const refreshBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Refresh today"),
    );
    expect(refreshBtn).toBeTruthy();
    await act(async () => {
      refreshBtn!.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(callCount).toBe(2);
  });

  it("shows status mix on the count card and highlights current/next rows", async () => {
    vi.useFakeTimers({ now: new Date(2026, 7, 10, 11, 15, 0), toFake: ["Date"] });
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/appointments")) {
        return Promise.resolve(
          jsonResponse({
            appointments: [
              appt({ id: "current", date: "2026-08-10", time: "11:00", status: 2, patId: "1", patient: null }),
              appt({ id: "next", date: "2026-08-10", time: "13:30", status: 1, patId: "2", patient: null }),
            ],
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

    expect(container.textContent).toMatch(/1 scheduled · 1 confirmed/i);
    expect(container.querySelector(".app-appt-list__row--current")).toBeTruthy();
    expect(container.querySelector(".app-appt-list__row--next")).toBeTruthy();
  });

  it("renders Clinic at a glance with safe overview rows when connected", async () => {
    vi.useFakeTimers({ now: new Date(2026, 5, 15, 10, 30, 0), toFake: ["Date"] });
    const onOpenModule = vi.fn();
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/appointments")) {
        return Promise.resolve(jsonResponse({ appointments: [appt({ status: 1 }), appt({ id: "2", status: 2 })] }));
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    });

    await act(async () => {
      root.render(
        <DashboardHome
          onOpenModule={onOpenModule}
          bridgePhase="connected"
          bridgeBaseUrl="http://127.0.0.1:17890"
          fetchImpl={fetchImpl}
          sandboxWritePilot
          sessionRecentPatientCount={2}
          writeCapability={{
            writeMode: "disabled",
            writesPermitted: false,
            writableSandbox: false,
            dataRootConfigured: true,
            backupDirConfigured: false,
            sqlitePathConfigured: true,
          }}
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
                finishedAt: new Date().toISOString(),
              },
            ],
          }}
          selectedPatientId="42"
          selectedPatientDisplayName="Overview Synth"
          selectedPatientChartNumber="OV-42"
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toMatch(/Clinic at a glance/i);
    expect(container.textContent).toMatch(/Connected/i);
    expect(container.textContent).toMatch(/Writes off/i);
    expect(container.textContent).toMatch(/Sandbox write pilot enabled/i);
    expect(container.textContent).toMatch(/2 appointments/i);
    expect(container.textContent).toMatch(/2 patients/i);
    expect(container.textContent).toMatch(/scheduled · .*confirmed/i);
    expect(container.textContent).toMatch(/Overview Synth · Chart OV-42/i);
    const settingsLink = container.querySelector(".app-dashboard-clinic-overview__settings-link");
    expect(settingsLink?.textContent).toMatch(/Open Settings/i);
    await act(async () => {
      settingsLink?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onOpenModule).toHaveBeenCalledWith("settings");
    assertNoForbiddenDomTokens(container.textContent ?? "");
  });

  it("shows connect guidance in Clinic at a glance when offline", async () => {
    await act(async () => {
      root.render(
        <DashboardHome onOpenModule={() => {}} bridgePhase="offline" bridgeBaseUrl="http://127.0.0.1:17890" />,
      );
    });
    expect(container.textContent).toMatch(/Clinic at a glance/i);
    expect(container.textContent).toMatch(/Connect the clinic service in Settings/i);
    expect(container.textContent).not.toMatch(/1 appointment/i);
  });

  it("offers Open schedule on the next appointment card", async () => {
    vi.useFakeTimers({ now: new Date(2026, 7, 10, 11, 0, 0), toFake: ["Date"] });
    const onOpenModule = vi.fn();
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/v1/schedule/appointments")) {
        return Promise.resolve(
          jsonResponse({
            appointments: [appt({ id: "next", date: "2026-08-10", time: "13:30", patId: "2", patient: null })],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    });

    await act(async () => {
      root.render(
        <DashboardHome
          onOpenModule={onOpenModule}
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

    const idx = container.textContent?.indexOf("Next appointment") ?? -1;
    expect(idx).toBeGreaterThan(-1);
    const slice = container.textContent?.slice(idx, idx + 500) ?? "";
    const scheduleBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Open schedule" && slice.includes(b.textContent ?? ""),
    );
    expect(scheduleBtn).toBeTruthy();
    await act(async () => {
      scheduleBtn!.click();
    });
    expect(onOpenModule).toHaveBeenCalledWith("schedule");
  });
});
