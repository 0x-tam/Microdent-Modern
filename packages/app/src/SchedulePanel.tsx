import { createBridgeClient } from "@microdent/bridge-client";
import type { BridgeDevStatusResponse, ScheduleAppointmentItem, ScheduleRoomItem } from "@microdent/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState } from "@microdent/ui";
import type { BridgeHealthPhase } from "./bridge-health.js";
import { AppErrorBoundary } from "./AppErrorBoundary.js";
import { doctorDisplayLabel } from "./doctor-labels.js";
import { procClassDisplayLabel } from "./procedure-reference.js";
import { useDoctorLabels } from "./useDoctorLabels.js";
import { useProcedureReference } from "./useProcedureReference.js";
import {
  CLINIC_SERVICE_CHECKING,
  CLINIC_SERVICE_CONNECT_SCHEDULE,
  SCHEDULE_LOAD_ERROR,
  SCHEDULE_PRIVACY_LEDE,
} from "./read-only-ui-copy.js";
import { AppointmentStatusDryRunAction } from "./AppointmentStatusDryRunAction.js";
import { AppointmentStatusWriteAction } from "./AppointmentStatusWriteAction.js";
import { resolveWriteModeChip } from "./shell-status-banners.js";

export type SchedulePanelProps = {
  isActive: boolean;
  bridgePhase: BridgeHealthPhase;
  bridgeBaseUrl?: string;
  /** Test-only fetch override (same pattern as patient search). */
  fetchImpl?: typeof fetch;
  /**
   * When true with `import.meta.env.DEV`, shows per-row dev write diagnostics (dry-run / sandbox apply).
   */
  writeDiagnosticsActions?: boolean;
  /** @deprecated Use {@link writeDiagnosticsActions}. */
  appointmentStatusDryRunDev?: boolean;
  /**
   * When true, schedule rows may show the sandbox status write pilot (requires bridge enabled sandbox).
   */
  appointmentStatusWritePilot?: boolean;
  onBackToday: () => void;
};

type Granularity = "day" | "week";

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDaysLocal(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

/** Monday-based week start (local). */
function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = x.getDay();
  const offset = wd === 0 ? -6 : 1 - wd;
  x.setDate(x.getDate() + offset);
  return x;
}

function defaultWeekRange(): { from: string; to: string } {
  const start = startOfWeekMonday(new Date());
  const end = addDaysLocal(start, 6);
  return { from: toLocalIsoDate(start), to: toLocalIsoDate(end) };
}

function defaultDayRange(): { from: string; to: string } {
  const t = toLocalIsoDate(new Date());
  return { from: t, to: t };
}

function weekContaining(isoDate: string): { from: string; to: string } {
  const start = startOfWeekMonday(parseLocalIso(isoDate));
  const end = addDaysLocal(start, 6);
  return { from: toLocalIsoDate(start), to: toLocalIsoDate(end) };
}

function inclusiveDayCount(from: string, to: string): number {
  const a = parseLocalIso(from).getTime();
  const b = parseLocalIso(to).getTime();
  return Math.floor((b - a) / 86_400_000) + 1;
}

function statusLabel(code: number): string {
  const map: Record<number, string> = {
    0: "Available",
    1: "Scheduled",
    2: "Confirmed",
    3: "Completed",
    4: "Cancelled",
    5: "No-show",
  };
  return map[code] ?? `Status ${code}`;
}

function statusBadgeVariant(
  code: number,
): "neutral" | "success" | "warning" | "danger" | "info" {
  if (code === 2 || code === 3) return "success";
  if (code === 4) return "warning";
  if (code === 5) return "danger";
  if (code === 1) return "info";
  return "neutral";
}

function formatDuration(a: ScheduleAppointmentItem): string {
  const slotMin = a.periodMinutes ?? 30;
  const total = a.durationSlots * slotMin;
  return `${total} min`;
}

function schedulePatientPrimary(appt: ScheduleAppointmentItem): string {
  if (appt.patId === "0") {
    return "Patient ID —";
  }
  return appt.patient?.displayName ?? `Patient ID ${appt.patId}`;
}

function schedulePatientChart(appt: ScheduleAppointmentItem): string | null {
  if (appt.patId === "0") {
    return null;
  }
  const c = appt.patient?.chartNumber;
  return c !== null && c !== undefined && c.length > 0 ? c : null;
}

function formatRangeHeading(from: string, to: string, granularity: Granularity): string {
  try {
    if (from === to) {
      return new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(parseLocalIso(from));
    }
    const a = parseLocalIso(from);
    const b = parseLocalIso(to);
    const sameMonth = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
    if (granularity === "week" && sameMonth) {
      return `${a.getDate()}–${b.getDate()} ${new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(a)}`;
    }
    const df = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
    return `${df.format(a)} – ${df.format(b)}`;
  } catch {
    return `${from} – ${to}`;
  }
}

function roomLabel(rooms: ScheduleRoomItem[], roomNum: number): string {
  const hit = rooms.find((r) => r.room === roomNum);
  if (hit?.displayName) return hit.displayName;
  return `Room ${roomNum}`;
}

/** Human-readable room label for filters and headings (includes room number when a display name is set). */
function roomCopyLabel(rooms: ScheduleRoomItem[], roomNum: number): string {
  const hit = rooms.find((r) => r.room === roomNum);
  if (hit?.displayName) {
    return `${hit.displayName} (Room ${roomNum})`;
  }
  return `Room ${roomNum}`;
}

function sortAppointments(a: ScheduleAppointmentItem, b: ScheduleAppointmentItem): number {
  const ta = a.time.trim();
  const tb = b.time.trim();
  if (ta !== tb) return ta.localeCompare(tb, undefined, { numeric: true });
  return a.id.localeCompare(b.id, undefined, { numeric: true });
}

function groupByDateThenRoom(
  items: ScheduleAppointmentItem[],
): Map<string, Map<number, ScheduleAppointmentItem[]>> {
  const dates = [...new Set(items.map((x) => x.date))].sort();
  const out = new Map<string, Map<number, ScheduleAppointmentItem[]>>();
  for (const d of dates) {
    const byRoom = new Map<number, ScheduleAppointmentItem[]>();
    for (const it of items.filter((x) => x.date === d)) {
      const list = byRoom.get(it.room) ?? [];
      list.push(it);
      byRoom.set(it.room, list);
    }
    for (const [, list] of byRoom) {
      list.sort(sortAppointments);
    }
    out.set(d, byRoom);
  }
  return out;
}

export function SchedulePanel({
  isActive,
  bridgePhase,
  bridgeBaseUrl,
  fetchImpl,
  writeDiagnosticsActions = false,
  appointmentStatusDryRunDev = false,
  appointmentStatusWritePilot = false,
  onBackToday,
}: SchedulePanelProps) {
  const devWriteActionsEnabled =
    import.meta.env.DEV && (writeDiagnosticsActions || appointmentStatusDryRunDev);
  const base = bridgeBaseUrl?.trim() ?? "";
  const canLoad = Boolean(base) && bridgePhase === "connected";
  const { labels: doctorLabels } = useDoctorLabels({
    bridgePhase,
    bridgeBaseUrl,
    fetchImpl,
    enabled: isActive,
  });
  const { maps: procedureMaps } = useProcedureReference({
    bridgePhase,
    bridgeBaseUrl,
    fetchImpl,
    enabled: isActive,
  });

  const [granularity, setGranularity] = useState<Granularity>("week");
  const [rangeFrom, setRangeFrom] = useState(() => defaultWeekRange().from);
  const [rangeTo, setRangeTo] = useState(() => defaultWeekRange().to);
  const [roomFilter, setRoomFilter] = useState<number | "">("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [sandboxApplyEnabled, setSandboxApplyEnabled] = useState(false);
  const [writeCapability, setWriteCapability] = useState<BridgeDevStatusResponse | null>(null);

  const [rooms, setRooms] = useState<ScheduleRoomItem[]>([]);
  const [appointments, setAppointments] = useState<ScheduleAppointmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scheduleLoadSeq = useRef(0);

  const setRange = useCallback((from: string, to: string) => {
    if (inclusiveDayCount(from, to) > 14) {
      return;
    }
    setRangeFrom(from);
    setRangeTo(to);
  }, []);

  const goToday = useCallback(() => {
    if (granularity === "day") {
      const d = defaultDayRange();
      setRange(d.from, d.to);
    } else {
      const w = defaultWeekRange();
      setRange(w.from, w.to);
    }
  }, [granularity, setRange]);

  const goPrev = useCallback(() => {
    if (granularity === "day") {
      const d = addDaysLocal(parseLocalIso(rangeFrom), -1);
      const s = toLocalIsoDate(d);
      setRange(s, s);
    } else {
      setRange(
        toLocalIsoDate(addDaysLocal(parseLocalIso(rangeFrom), -7)),
        toLocalIsoDate(addDaysLocal(parseLocalIso(rangeTo), -7)),
      );
    }
  }, [granularity, rangeFrom, rangeTo, setRange]);

  const goNext = useCallback(() => {
    if (granularity === "day") {
      const d = addDaysLocal(parseLocalIso(rangeFrom), 1);
      const s = toLocalIsoDate(d);
      setRange(s, s);
    } else {
      setRange(
        toLocalIsoDate(addDaysLocal(parseLocalIso(rangeFrom), 7)),
        toLocalIsoDate(addDaysLocal(parseLocalIso(rangeTo), 7)),
      );
    }
  }, [granularity, rangeFrom, rangeTo, setRange]);

  const onGranularityChange = useCallback(
    (g: Granularity) => {
      setGranularity(g);
      if (g === "day") {
        const d = defaultDayRange();
        setRange(d.from, d.to);
      } else {
        const w = weekContaining(rangeFrom);
        setRange(w.from, w.to);
      }
    },
    [rangeFrom, setRange],
  );

  useEffect(() => {
    if (!devWriteActionsEnabled || !canLoad) {
      setSandboxApplyEnabled(false);
      return;
    }
    let cancelled = false;
    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });
    void client
      .getBridgeDevStatus()
      .then((status) => {
        if (!cancelled) {
          setSandboxApplyEnabled(status.writableSandbox && status.writeMode !== "disabled");
        }
      })
      .catch(() => {
        if (!cancelled) setSandboxApplyEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [devWriteActionsEnabled, canLoad, base, fetchImpl]);

  useEffect(() => {
    if (!canLoad) {
      setWriteCapability(null);
      return;
    }
    let cancelled = false;
    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });
    void client
      .getWriteCapability()
      .then((status) => {
        if (!cancelled) setWriteCapability(status);
      })
      .catch(() => {
        if (!cancelled) setWriteCapability(null);
      });
    return () => {
      cancelled = true;
    };
  }, [canLoad, base, fetchImpl, refreshTick]);

  useEffect(() => {
    if (!isActive || !canLoad) {
      setRooms([]);
      setAppointments([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    let cancelled = false;
    const seq = ++scheduleLoadSeq.current;
    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });

    async function run(): Promise<void> {
      let roomsList: ScheduleRoomItem[] = [];
      try {
        roomsList = (await client.getScheduleRooms()).rooms;
      } catch {
        roomsList = [];
      }
      if (cancelled || seq !== scheduleLoadSeq.current) {
        return;
      }
      try {
        const apptData = await client.getScheduleAppointments({
          from: rangeFrom,
          to: rangeTo,
          room: roomFilter === "" ? undefined : roomFilter,
        });
        if (cancelled || seq !== scheduleLoadSeq.current) {
          return;
        }
        setRooms(roomsList);
        setAppointments(apptData.appointments);
        setError(null);
      } catch {
        if (cancelled || seq !== scheduleLoadSeq.current) {
          return;
        }
        setRooms(roomsList);
        setAppointments([]);
        setError(SCHEDULE_LOAD_ERROR);
      } finally {
        if (!cancelled && seq === scheduleLoadSeq.current) {
          setLoading(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [isActive, canLoad, base, fetchImpl, rangeFrom, rangeTo, roomFilter, refreshTick]);

  useEffect(() => {
    if (!isActive || !canLoad) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (loading) {
        return;
      }
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        goToday();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isActive, canLoad, loading, goPrev, goNext, goToday]);

  const rangeHeading = useMemo(
    () => formatRangeHeading(rangeFrom, rangeTo, granularity),
    [rangeFrom, rangeTo, granularity],
  );

  const grouped = useMemo(() => groupByDateThenRoom(appointments), [appointments]);

  const roomOptions = useMemo(() => {
    const nums = [...new Set(rooms.map((r) => r.room))].sort((a, b) => a - b);
    return nums;
  }, [rooms]);

  const offlineMessage = bridgePhase === "checking" ? CLINIC_SERVICE_CHECKING : CLINIC_SERVICE_CONNECT_SCHEDULE;
  const writeModeChip = resolveWriteModeChip(writeCapability);

  return (
    <div className="app-schedule">
      <div className="app-schedule__toolbar">
        <div className="app-schedule__toolbar-row">
          <div className="app-schedule__granularity" role="group" aria-label="Schedule view">
            <Button
              type="button"
              variant={granularity === "week" ? "secondary" : "ghost"}
              size="compact"
              className="ui-focusable"
              disabled={!canLoad}
              onClick={() => onGranularityChange("week")}
            >
              Week
            </Button>
            <Button
              type="button"
              variant={granularity === "day" ? "secondary" : "ghost"}
              size="compact"
              className="ui-focusable"
              disabled={!canLoad}
              onClick={() => onGranularityChange("day")}
            >
              Day
            </Button>
          </div>
          <div className="app-schedule__nav" role="group" aria-label="Move schedule range">
            <Button
              type="button"
              variant="ghost"
              size="compact"
              className="ui-focusable"
              disabled={!canLoad || loading}
              onClick={goPrev}
              aria-label={granularity === "day" ? "Previous day" : "Previous week"}
            >
              ← {granularity === "day" ? "Day" : "Week"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="compact"
              className="ui-focusable"
              disabled={!canLoad || loading}
              onClick={goToday}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="compact"
              className="ui-focusable"
              disabled={!canLoad || loading}
              onClick={goNext}
              aria-label={granularity === "day" ? "Next day" : "Next week"}
            >
              {granularity === "day" ? "Day" : "Week"} →
            </Button>
          </div>
          <div className="app-schedule__toolbar-actions">
            {writeModeChip ? (
              <Badge
                variant={writeModeChip.variant}
                className="app-schedule__write-mode-chip"
                semanticLabel={`Bridge write mode: ${writeModeChip.label}`}
              >
                {writeModeChip.label}
              </Badge>
            ) : null}
            {roomOptions.length > 0 ? (
              <label className="app-schedule__room-filter">
                <span className="app-schedule__room-filter-label">Room</span>
                <select
                  className="app-schedule__select ui-focusable"
                  disabled={!canLoad || loading}
                  value={roomFilter === "" ? "" : String(roomFilter)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRoomFilter(v === "" ? "" : Number.parseInt(v, 10));
                  }}
                  aria-label="Filter by room"
                >
                  <option value="">All rooms</option>
                  {roomOptions.map((n) => (
                    <option key={n} value={String(n)}>
                      {roomCopyLabel(rooms, n)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="compact"
              className="ui-focusable"
              disabled={!canLoad || loading}
              onClick={() => setRefreshTick((x) => x + 1)}
            >
              Refresh
            </Button>
          </div>
        </div>
        <p
          className="app-schedule__range"
          aria-live="polite"
          aria-label={`Schedule range: ${rangeHeading}`}
        >
          <time dateTime={`${rangeFrom}/${rangeTo}`}>{rangeHeading}</time>
        </p>
        <p className="app-schedule__privacy">{SCHEDULE_PRIVACY_LEDE}</p>
      </div>

      {!canLoad ? (
        <p className="app-schedule__state app-schedule__state--muted" role="status">
          {offlineMessage}
        </p>
      ) : loading ? (
        <p className="app-schedule__state" role="status">
          Loading schedule…
        </p>
      ) : error ? (
        <p className="app-schedule__state app-schedule__state--error" role="alert">
          {error}
        </p>
      ) : appointments.length === 0 ? (
        <AppErrorBoundary>
          <EmptyState
            className="ui-empty--start"
            title="No appointments in this range"
            description="Try another day or week, change the room filter, or refresh after the bridge loads data."
          />
        </AppErrorBoundary>
      ) : (
        <div className="app-schedule__days">
          {[...grouped.entries()].map(([dateIso, byRoom]) => (
            <Card key={dateIso} className="app-schedule__day-card">
              <CardHeader>
                <p className="ui-card__title app-card-title-lg app-schedule__day-title">
                  <time dateTime={dateIso}>{formatRangeHeading(dateIso, dateIso, "day")}</time>
                </p>
              </CardHeader>
              <CardBody>
                {[...byRoom.entries()]
                  .sort(([a], [b]) => a - b)
                  .map(([roomNum, list]) => (
                    <section key={`${dateIso}-${roomNum}`} className="app-schedule__room-block">
                      <h3 className="app-schedule__room-heading">{roomCopyLabel(rooms, roomNum)}</h3>
                      <ul
                        className="app-schedule__appt-list"
                        aria-label={`Appointments on ${formatRangeHeading(dateIso, dateIso, "day")} in ${roomCopyLabel(rooms, roomNum)}`}
                      >
                        {list.map((appt) => {
                          const chart = schedulePatientChart(appt);
                          return (
                          <li key={appt.id} className="app-schedule__appt-row">
                            <div className="app-schedule__appt-time">{appt.time}</div>
                            <div className="app-schedule__appt-main">
                              <div className="app-schedule__appt-line1">
                                <span className="app-schedule__appt-duration">{formatDuration(appt)}</span>
                                <span className="app-schedule__appt-meta">
                                  <span className="app-schedule__appt-patient-primary">{schedulePatientPrimary(appt)}</span>
                                  {chart !== null ? (
                                    <span className="app-schedule__appt-patient-chart"> · {chart}</span>
                                  ) : null}
                                  {(() => {
                                    const doc = doctorDisplayLabel(appt.docId, doctorLabels);
                                    return doc !== null ? ` · ${doc}` : "";
                                  })()}
                                  {(() => {
                                    const proc = procClassDisplayLabel(appt.procClass, procedureMaps);
                                    return proc !== null ? ` · ${proc}` : "";
                                  })()}
                                </span>
                              </div>
                              <div className="app-schedule__appt-badges">
                                <Badge variant={statusBadgeVariant(appt.status)} semanticLabel={`Visit status code ${appt.status}`}>
                                  {statusLabel(appt.status)}
                                </Badge>
                                {appt.missed ? (
                                  <Badge variant="danger" semanticLabel="Missed appointment">
                                    Missed
                                  </Badge>
                                ) : null}
                                {appt.hasComment ? (
                                  <Badge variant="neutral" semanticLabel="Internal note hidden">
                                    Note hidden
                                  </Badge>
                                ) : null}
                              </div>
                              {bridgeBaseUrl && appointmentStatusWritePilot ? (
                                <AppointmentStatusWriteAction
                                  appointment={appt}
                                  bridgeBaseUrl={bridgeBaseUrl}
                                  fetchImpl={fetchImpl}
                                  writePilotEnabled={appointmentStatusWritePilot}
                                  writeCapability={writeCapability}
                                  onCommitted={() => setRefreshTick((x) => x + 1)}
                                />
                              ) : null}
                              {bridgeBaseUrl && devWriteActionsEnabled ? (
                                <AppointmentStatusDryRunAction
                                  appointment={appt}
                                  bridgeBaseUrl={bridgeBaseUrl}
                                  fetchImpl={fetchImpl}
                                  writeDiagnosticsActions={devWriteActionsEnabled}
                                  sandboxApplyEnabled={sandboxApplyEnabled}
                                />
                              ) : null}
                            </div>
                          </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <div className="app-schedule__footer">
        <Button type="button" variant="secondary" className="ui-focusable" onClick={onBackToday}>
          Back to Today
        </Button>
      </div>
    </div>
  );
}
