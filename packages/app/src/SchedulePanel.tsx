import { createBridgeClient } from "@microdent/bridge-client";
import type { ScheduleAppointmentItem, ScheduleRoomItem } from "@microdent/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState } from "@microdent/ui";
import type { BridgeHealthPhase } from "./bridge-health.js";
import { AppErrorBoundary } from "./AppErrorBoundary.js";

export type SchedulePanelProps = {
  isActive: boolean;
  bridgePhase: BridgeHealthPhase;
  bridgeBaseUrl?: string;
  /** Test-only fetch override (same pattern as patient search). */
  fetchImpl?: typeof fetch;
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
  onBackToday,
}: SchedulePanelProps) {
  const base = bridgeBaseUrl?.trim() ?? "";
  const canLoad = Boolean(base) && bridgePhase === "connected";

  const [granularity, setGranularity] = useState<Granularity>("week");
  const [rangeFrom, setRangeFrom] = useState(() => defaultWeekRange().from);
  const [rangeTo, setRangeTo] = useState(() => defaultWeekRange().to);
  const [roomFilter, setRoomFilter] = useState<number | "">("");
  const [refreshTick, setRefreshTick] = useState(0);

  const [rooms, setRooms] = useState<ScheduleRoomItem[]>([]);
  const [appointments, setAppointments] = useState<ScheduleAppointmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!isActive || !canLoad) {
      setRooms([]);
      setAppointments([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });

    async function run(): Promise<void> {
      setLoading(true);
      setError(null);
      let roomsList: ScheduleRoomItem[] = [];
      try {
        roomsList = (await client.getScheduleRooms()).rooms;
      } catch {
        roomsList = [];
      }
      try {
        const apptData = await client.getScheduleAppointments({
          from: rangeFrom,
          to: rangeTo,
          room: roomFilter === "" ? undefined : roomFilter,
        });
        if (cancelled) return;
        setRooms(roomsList);
        setAppointments(apptData.appointments);
      } catch {
        if (cancelled) return;
        setRooms(roomsList);
        setAppointments([]);
        setError("Could not load the schedule. Check the bridge and try Refresh.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [isActive, canLoad, base, fetchImpl, rangeFrom, rangeTo, roomFilter, refreshTick]);

  const rangeHeading = useMemo(
    () => formatRangeHeading(rangeFrom, rangeTo, granularity),
    [rangeFrom, rangeTo, granularity],
  );

  const grouped = useMemo(() => groupByDateThenRoom(appointments), [appointments]);

  const roomOptions = useMemo(() => {
    const nums = [...new Set(rooms.map((r) => r.room))].sort((a, b) => a - b);
    return nums;
  }, [rooms]);

  const offlineMessage =
    bridgePhase === "checking"
      ? "Waiting for the clinic service before the schedule can load."
      : "Connect the clinic service to load your schedule.";

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
                      {roomLabel(rooms, n)}
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
        <p className="app-schedule__range" aria-live="polite">
          {rangeHeading}
        </p>
        <p className="app-schedule__privacy">
          Read-only schedule. Notes and phone numbers are hidden in this preview.
        </p>
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
                  {formatRangeHeading(dateIso, dateIso, "day")}
                </p>
              </CardHeader>
              <CardBody>
                {[...byRoom.entries()]
                  .sort(([a], [b]) => a - b)
                  .map(([roomNum, list]) => (
                    <section key={`${dateIso}-${roomNum}`} className="app-schedule__room-block">
                      <h3 className="app-schedule__room-heading">{roomLabel(rooms, roomNum)}</h3>
                      <ul className="app-schedule__appt-list" aria-label={`Appointments on ${dateIso} in room ${roomNum}`}>
                        {list.map((appt) => (
                          <li key={appt.id} className="app-schedule__appt-row">
                            <div className="app-schedule__appt-time">{appt.time}</div>
                            <div className="app-schedule__appt-main">
                              <div className="app-schedule__appt-line1">
                                <span className="app-schedule__appt-duration">{formatDuration(appt)}</span>
                                <span className="app-schedule__appt-meta">
                                  {appt.patId !== "0" ? `Patient ID ${appt.patId}` : "Patient ID —"}
                                  {appt.docId !== 0 ? ` · Doctor ${appt.docId}` : ""}
                                  {` · Proc ${appt.procClass}`}
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
                                  <Badge variant="neutral" semanticLabel="Has internal note (content hidden)">
                                    Note
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        ))}
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
