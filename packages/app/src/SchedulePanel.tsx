import { createBridgeClient } from "@microdent/bridge-client";
import type { BridgeDevStatusResponse, MirrorStatusResponse, ScheduleAppointmentItem, ScheduleRoomItem } from "@microdent/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, EmptyState } from "@microdent/ui";
import type { BridgeHealthPhase } from "./bridge-health.js";
import { AppErrorBoundary } from "./AppErrorBoundary.js";
import {
  appointmentVisitMeta,
  buildRoomLabelMap,
  patientApptStatusSemanticLabel,
} from "./patient-appointments-display.js";
import { useDoctorLabels } from "./useDoctorLabels.js";
import { useProcedureReference } from "./useProcedureReference.js";
import {
  CLINIC_SERVICE_CHECKING,
  CLINIC_SERVICE_CONNECT_SCHEDULE,
  SCHEDULE_DAY_APPOINTMENT_COUNT,
  SCHEDULE_EMPTY_DESCRIPTION,
  SCHEDULE_EMPTY_TITLE,
  SCHEDULE_FILTER_ALL_PROVIDERS,
  SCHEDULE_FILTER_EMPTY_DESCRIPTION,
  SCHEDULE_FILTER_EMPTY_TITLE,
  SCHEDULE_FILTER_PROVIDER_ARIA,
  FILTER_CLEAR_LABEL,
  SCHEDULE_ROOMS_IN_USE,
  SCHEDULE_KEYBOARD_HINT,
  SCHEDULE_LOAD_ERROR,
  SCHEDULE_LOADING,
  SCHEDULE_MIRROR_STALE_ADVISORY,
  SCHEDULE_MIRROR_STALE_FILTER_NOTE,
  SCHEDULE_NAV_NEXT_DAY,
  SCHEDULE_NAV_NEXT_WEEK,
  SCHEDULE_NAV_PREV_DAY,
  SCHEDULE_NAV_PREV_WEEK,
  SCHEDULE_NAV_TODAY,
  SCHEDULE_PRIVACY_LEDE,
  SCHEDULE_RANGE_APPOINTMENT_COUNT,
  SCHEDULE_RANGE_INCLUDES_TODAY,
  SCHEDULE_ROOM_ALL,
  SCHEDULE_OPEN_PATIENT,
  SCHEDULE_ROOM_FILTER_CONTEXT,
  SCHEDULE_ROOM_FILTER_LABEL,
  SCHEDULE_ROOM_FILTER_LOADING,
  SCHEDULE_ROOM_FILTER_EMPTY,
  SCHEDULE_SANDBOX_WRITE_PILOT_BANNER,
  TODAY_APPT_ROW_CURRENT_LABEL,
  SCHEDULE_WRITE_DISCOVERABILITY_HINT,
  READONLY_STATE_RETRY,
  SCHEDULE_VIEW_DAY,
  SCHEDULE_VIEW_LABEL,
  SCHEDULE_VIEW_WEEK,
  SCHEDULE_WRITE_MODE_CHIP_OFFLINE,
} from "./read-only-ui-copy.js";
import { AppointmentCreateWriteAction } from "./AppointmentCreateWriteAction.js";
import { AppointmentStatusDryRunAction } from "./AppointmentStatusDryRunAction.js";
import { AppointmentWriteActionsPanel } from "./AppointmentWriteActionsPanel.js";
import { resolveWriteModeChip } from "./shell-status-banners.js";
import { isMirrorImportStale } from "./mirror-stale.js";
import {
  countAppointmentsByStatus,
  filterPatientAppointments,
  findCurrentAppointmentInRange,
  patientApptProviderFilterOptions,
  patientApptStatusBadgeVariant,
  patientApptStatusLabel,
} from "./patient-appointments-display.js";
import { scheduleOperationalSummary } from "./patient-workspace-intelligence.js";
import type { DashboardPatientSummary } from "./today-dashboard.js";

export type SchedulePanelProps = {
  moduleTitle?: string;
  moduleDescription?: string;
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
   * When true, schedule rows may show sandbox write pilots (requires bridge enabled sandbox).
   */
  sandboxWritePilot?: boolean;
  /** @deprecated Use {@link sandboxWritePilot}. */
  appointmentStatusWritePilot?: boolean;
  onBackToday: () => void;
  onOpenPatient?: (patientId: string, summary?: DashboardPatientSummary) => void;
  mirrorStatus?: MirrorStatusResponse | null;
  /** When set, switches to day view focused on this date (YYYY-MM-DD) once active. */
  initialDate?: string | null;
  onInitialDateApplied?: () => void;
  /** Pre-fill create appointment with selected patient from shell. */
  selectedPatientId?: string | null;
  selectedPatientDisplayName?: string | null;
  selectedPatientChartNumber?: string | null;
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

function rangeIncludesToday(from: string, to: string): boolean {
  const today = toLocalIsoDate(new Date());
  return from <= today && today <= to;
}

function isViewingTodayRange(from: string, to: string, granularity: Granularity): boolean {
  const today = toLocalIsoDate(new Date());
  if (granularity === "day") {
    return from === today;
  }
  const week = defaultWeekRange();
  return from === week.from && to === week.to;
}

function statusLabel(code: number): string {
  return patientApptStatusLabel(code);
}

function statusBadgeVariant(
  code: number,
): "neutral" | "success" | "warning" | "danger" | "info" {
  return patientApptStatusBadgeVariant(code);
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
  moduleTitle = "Schedule",
  moduleDescription,
  isActive,
  bridgePhase,
  bridgeBaseUrl,
  fetchImpl,
  writeDiagnosticsActions = false,
  appointmentStatusDryRunDev = false,
  sandboxWritePilot = false,
  appointmentStatusWritePilot = false,
  onBackToday,
  onOpenPatient,
  mirrorStatus = null,
  initialDate = null,
  onInitialDateApplied,
  selectedPatientId = null,
  selectedPatientDisplayName = null,
  selectedPatientChartNumber = null,
}: SchedulePanelProps) {
  const sandboxPilotEnabled = sandboxWritePilot || appointmentStatusWritePilot;
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
  const [statusFilter, setStatusFilter] = useState<number | null>(null);
  const [providerFilter, setProviderFilter] = useState<number | null>(null);
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
    if (!isActive || !initialDate) {
      return;
    }
    setGranularity("day");
    setRange(initialDate, initialDate);
    onInitialDateApplied?.();
  }, [isActive, initialDate, onInitialDateApplied, setRange]);

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

  const includesToday = useMemo(
    () => rangeIncludesToday(rangeFrom, rangeTo),
    [rangeFrom, rangeTo],
  );

  const viewingToday = useMemo(
    () => isViewingTodayRange(rangeFrom, rangeTo, granularity),
    [rangeFrom, rangeTo, granularity],
  );

  const displayAppointments = useMemo(
    () =>
      filterPatientAppointments(appointments, {
        statusFilter,
        providerFilter,
      }),
    [appointments, statusFilter, providerFilter],
  );

  const grouped = useMemo(() => groupByDateThenRoom(displayAppointments), [displayAppointments]);

  const providerOptions = useMemo(
    () => patientApptProviderFilterOptions(appointments, doctorLabels),
    [appointments, doctorLabels],
  );

  const currentAppt = useMemo(
    () => (includesToday ? findCurrentAppointmentInRange(displayAppointments) : null),
    [displayAppointments, includesToday],
  );

  const clientFiltersActive =
    statusFilter !== null || providerFilter !== null || roomFilter !== "";

  const operationalSummary = useMemo(
    () =>
      scheduleOperationalSummary(
        appointments,
        displayAppointments,
        { statusFilter, providerFilter, roomFilter },
        doctorLabels,
      ),
    [appointments, displayAppointments, statusFilter, providerFilter, roomFilter, doctorLabels],
  );

  const roomsInUseCount = useMemo(() => {
    if (roomFilter !== "" || appointments.length === 0) return null;
    return new Set(appointments.map((a) => a.room)).size;
  }, [appointments, roomFilter]);

  const clearClientFilters = useCallback(() => {
    setStatusFilter(null);
    setProviderFilter(null);
    setRoomFilter("");
  }, []);

  const roomOptions = useMemo(() => {
    const nums = [...new Set(rooms.map((r) => r.room))].sort((a, b) => a - b);
    return nums;
  }, [rooms]);

  const offlineMessage = bridgePhase === "checking" ? CLINIC_SERVICE_CHECKING : CLINIC_SERVICE_CONNECT_SCHEDULE;
  const writeModeChip = resolveWriteModeChip(writeCapability);
  const mirrorStale =
    bridgePhase === "connected" && mirrorStatus !== null && isMirrorImportStale(mirrorStatus, Date.now());

  const statusBreakdown = useMemo(() => {
    const counts = countAppointmentsByStatus(appointments);
    return [...counts.entries()]
      .filter(([, n]) => n > 0)
      .sort(([a], [b]) => a - b)
      .map(([code, n]) => ({
        code,
        count: n,
        label: statusLabel(code),
        variant: statusBadgeVariant(code),
      }));
  }, [appointments]);

  const roomFilterContext =
    roomFilter !== "" && !loading && !error && canLoad
      ? SCHEDULE_ROOM_FILTER_CONTEXT(roomCopyLabel(rooms, roomFilter), displayAppointments.length)
      : null;

  const mirrorStaleMessage =
    mirrorStale && clientFiltersActive
      ? `${SCHEDULE_MIRROR_STALE_ADVISORY}${SCHEDULE_MIRROR_STALE_FILTER_NOTE}`
      : SCHEDULE_MIRROR_STALE_ADVISORY;

  const openPatientFromAppt = useCallback(
    (appt: ScheduleAppointmentItem) => {
      if (!onOpenPatient || appt.patId === "0") return;
      onOpenPatient(appt.patId, {
        displayName: appt.patient?.displayName ?? null,
        chartNumber: appt.patient?.chartNumber ?? null,
      });
    },
    [onOpenPatient],
  );

  return (
    <div className="app-workspace-page app-schedule">
      <header className="app-page-hero">
        <div>
          <h2 className="app-page-hero__title">{moduleTitle}</h2>
          {moduleDescription ? <p className="app-page-hero__meta">{moduleDescription}</p> : null}
        </div>
        <p className="app-page-hero__meta">{rangeHeading}</p>
      </header>
        <div className="app-schedule__toolbar app-toolbar app-filter-bar">
          <div className="app-schedule__toolbar-row app-filter-bar__group">
          <div className="app-schedule__granularity" role="group" aria-label={SCHEDULE_VIEW_LABEL}>
            <Button
              type="button"
              variant={granularity === "week" ? "secondary" : "ghost"}
              size="compact"
              className="ui-focusable"
              disabled={!canLoad}
              aria-pressed={granularity === "week"}
              onClick={() => onGranularityChange("week")}
            >
              {SCHEDULE_VIEW_WEEK}
            </Button>
            <Button
              type="button"
              variant={granularity === "day" ? "secondary" : "ghost"}
              size="compact"
              className="ui-focusable"
              disabled={!canLoad}
              aria-pressed={granularity === "day"}
              onClick={() => onGranularityChange("day")}
            >
              {SCHEDULE_VIEW_DAY}
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
              aria-label={granularity === "day" ? SCHEDULE_NAV_PREV_DAY : SCHEDULE_NAV_PREV_WEEK}
            >
              ← {granularity === "day" ? SCHEDULE_VIEW_DAY : SCHEDULE_VIEW_WEEK}
            </Button>
            <Button
              type="button"
              variant={viewingToday ? "secondary" : "ghost"}
              size="compact"
              className={`ui-focusable app-schedule__nav-today${viewingToday ? " app-schedule__nav-today--active" : ""}`}
              disabled={!canLoad || loading}
              onClick={goToday}
              aria-current={viewingToday ? "date" : undefined}
            >
              {SCHEDULE_NAV_TODAY}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="compact"
              className="ui-focusable"
              disabled={!canLoad || loading}
              onClick={goNext}
              aria-label={granularity === "day" ? SCHEDULE_NAV_NEXT_DAY : SCHEDULE_NAV_NEXT_WEEK}
            >
              {granularity === "day" ? SCHEDULE_VIEW_DAY : SCHEDULE_VIEW_WEEK} →
            </Button>
          </div>
          <div className="app-schedule__toolbar-actions">
            {roomOptions.length > 0 ? (
              <label className="app-schedule__room-filter">
                <span className="app-schedule__room-filter-label">{SCHEDULE_ROOM_FILTER_LABEL}</span>
                <select
                  className="app-schedule__select ui-focusable"
                  disabled={!canLoad || loading}
                  value={roomFilter === "" ? "" : String(roomFilter)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRoomFilter(v === "" ? "" : Number.parseInt(v, 10));
                  }}
                  aria-label="Filter by room"
                  aria-busy={loading && roomOptions.length === 0}
                >
                  <option value="">{SCHEDULE_ROOM_ALL}</option>
                  {roomOptions.map((n) => (
                    <option key={n} value={String(n)}>
                      {roomCopyLabel(rooms, n)}
                    </option>
                  ))}
                </select>
              </label>
            ) : canLoad ? (
              <span
                className="app-schedule__room-filter app-schedule__room-filter--empty"
                role="status"
                aria-live="polite"
              >
                <span className="app-schedule__room-filter-label">{SCHEDULE_ROOM_FILTER_LABEL}</span>
                <span className="app-schedule__room-filter-hint">
                  {loading ? SCHEDULE_ROOM_FILTER_LOADING : SCHEDULE_ROOM_FILTER_EMPTY}
                </span>
              </span>
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
        <div className="app-schedule__range-block">
          <p
            className="app-schedule__range"
            aria-live="polite"
            aria-label={`Schedule range: ${rangeHeading}`}
          >
            <time dateTime={`${rangeFrom}/${rangeTo}`}>{rangeHeading}</time>
          </p>
          {!loading && !error && canLoad ? (
            <>
              <div className="app-stat-strip app-schedule__stat-strip" role="status">
                <div className="app-stat app-stat--emphasis">
                  <p className="app-stat__label">Shown</p>
                  <p className="app-stat__value">{operationalSummary.shownLabel}</p>
                </div>
                {includesToday ? (
                  <div className="app-stat">
                    <p className="app-stat__label">Range</p>
                    <p className="app-stat__value">{SCHEDULE_RANGE_INCLUDES_TODAY}</p>
                  </div>
                ) : null}
                {operationalSummary.statusMix ? (
                  <div className="app-stat">
                    <p className="app-stat__label">Status</p>
                    <p className="app-stat__value">{operationalSummary.statusMix}</p>
                  </div>
                ) : null}
                {operationalSummary.providerMix ? (
                  <div className="app-stat">
                    <p className="app-stat__label">Providers</p>
                    <p className="app-stat__value">{operationalSummary.providerMix}</p>
                  </div>
                ) : null}
                {roomFilterContext || operationalSummary.roomMix ? (
                  <div className="app-stat">
                    <p className="app-stat__label">Rooms</p>
                    <p className="app-stat__value">{roomFilterContext ?? operationalSummary.roomMix}</p>
                  </div>
                ) : null}
              </div>
              {operationalSummary.filterActiveLabel ? (
                <p className="app-schedule__filter-active-label" role="status">
                  {operationalSummary.filterActiveLabel}
                </p>
              ) : null}
              {statusBreakdown.length > 0 ? (
                <div className="app-schedule__status-breakdown" role="group" aria-label="Status breakdown">
                  {statusBreakdown.map(({ code, count, label, variant }) => (
                    <Button
                      key={code}
                      type="button"
                      size="compact"
                      variant={statusFilter === code ? "primary" : "secondary"}
                      className={`app-schedule__status-chip app-schedule__status-chip--${variant}`}
                      aria-pressed={statusFilter === code}
                      onClick={() => setStatusFilter((f) => (f === code ? null : code))}
                    >
                      {count} {label}
                    </Button>
                  ))}
                </div>
              ) : null}
              {providerOptions.length > 1 ? (
                <div
                  className="app-schedule__provider-filters"
                  role="group"
                  aria-label={SCHEDULE_FILTER_PROVIDER_ARIA}
                >
                  <Button
                    type="button"
                    size="compact"
                    variant={providerFilter === null ? "primary" : "secondary"}
                    className="ui-focusable app-schedule__provider-chip"
                    aria-pressed={providerFilter === null}
                    onClick={() => setProviderFilter(null)}
                  >
                    {SCHEDULE_FILTER_ALL_PROVIDERS}
                  </Button>
                  {providerOptions.map(({ docId, label }) => (
                    <Button
                      key={docId}
                      type="button"
                      size="compact"
                      variant={providerFilter === docId ? "primary" : "secondary"}
                      className="ui-focusable app-schedule__provider-chip"
                      aria-pressed={providerFilter === docId}
                      onClick={() => setProviderFilter((f) => (f === docId ? null : docId))}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              ) : null}
              {(statusFilter !== null || providerFilter !== null || roomFilter !== "") ? (
                <Button
                  type="button"
                  size="compact"
                  variant="ghost"
                  className="ui-focusable app-schedule__clear-filters"
                  onClick={clearClientFilters}
                >
                  {FILTER_CLEAR_LABEL}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
        {mirrorStale ? (
          <p className="app-schedule__mirror-advisory" role="note">
            {mirrorStaleMessage}
          </p>
        ) : null}
        <p className="app-schedule__privacy">{SCHEDULE_PRIVACY_LEDE}</p>
        {canLoad ? <p className="app-schedule__keyboard-hint">{SCHEDULE_KEYBOARD_HINT}</p> : null}
        {sandboxPilotEnabled && canLoad ? (
          <p className="app-schedule__sandbox-write-banner" role="status">
            {SCHEDULE_SANDBOX_WRITE_PILOT_BANNER}
          </p>
        ) : null}
        {sandboxPilotEnabled && canLoad ? (
          <p className="app-schedule__write-discoverability-hint" role="note">
            {SCHEDULE_WRITE_DISCOVERABILITY_HINT}
          </p>
        ) : null}
      </div>

      {!canLoad ? (
        <p
          className={`app-readonly-state app-schedule__state app-schedule__state--muted${bridgePhase === "checking" ? " app-readonly-state--checking" : " app-readonly-state--offline"}`}
          role="status"
        >
          {offlineMessage}
        </p>
      ) : loading ? (
        <p
          className="app-readonly-state app-readonly-state--loading app-schedule__state app-schedule__state--muted"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          {SCHEDULE_LOADING}
        </p>
      ) : error ? (
        <div className="app-readonly-state app-readonly-state--error app-schedule__state app-schedule__state--error" role="alert">
          <p>{error}</p>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            className="ui-focusable"
            onClick={() => setRefreshTick((x) => x + 1)}
          >
            {READONLY_STATE_RETRY}
          </Button>
        </div>
      ) : appointments.length === 0 ? (
        <AppErrorBoundary>
          <EmptyState
            className="ui-empty--start"
            title={SCHEDULE_EMPTY_TITLE}
            description={SCHEDULE_EMPTY_DESCRIPTION}
          />
        </AppErrorBoundary>
      ) : displayAppointments.length === 0 ? (
        <AppErrorBoundary>
          <EmptyState
            className="ui-empty--start"
            title={SCHEDULE_FILTER_EMPTY_TITLE}
            description={SCHEDULE_FILTER_EMPTY_DESCRIPTION}
          />
        </AppErrorBoundary>
      ) : (
        <div className="app-schedule__days">
          {[...grouped.entries()].map(([dateIso, byRoom]) => {
            const dayCount = [...byRoom.values()].reduce((sum, list) => sum + list.length, 0);
            return (
            <section key={dateIso} className="app-schedule__day-card">
              <h3 className="app-board-day-header app-schedule__day-title">
                <time dateTime={dateIso}>{formatRangeHeading(dateIso, dateIso, "day")}</time>
                <span className="app-board-day-header__count">{SCHEDULE_DAY_APPOINTMENT_COUNT(dayCount)}</span>
              </h3>
              <div className="app-schedule__day-body">
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
                          <li
                            key={appt.id}
                            className={[
                              "app-schedule__appt-row",
                              currentAppt?.id === appt.id ? "app-schedule__appt-row--current" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            aria-label={
                              currentAppt?.id === appt.id ? TODAY_APPT_ROW_CURRENT_LABEL : undefined
                            }
                          >
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
                                    const meta = appointmentVisitMeta(appt, doctorLabels, procedureMaps, {
                                      includeRoom: false,
                                    });
                                    return meta.length > 0 ? ` · ${meta}` : "";
                                  })()}
                                </span>
                              </div>
                              <div className="app-schedule__appt-badges">
                                <Badge variant={statusBadgeVariant(appt.status)} semanticLabel={patientApptStatusSemanticLabel(appt.status)}>
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
                                {appt.patId !== "0" && onOpenPatient ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="compact"
                                    className="ui-focusable app-schedule__open-patient"
                                    onClick={() => openPatientFromAppt(appt)}
                                  >
                                    {SCHEDULE_OPEN_PATIENT}
                                  </Button>
                                ) : null}
                              </div>
                              {bridgeBaseUrl && sandboxPilotEnabled && canLoad ? (
                                <AppointmentWriteActionsPanel
                                  appointment={appt}
                                  bridgeBaseUrl={bridgeBaseUrl}
                                  fetchImpl={fetchImpl}
                                  writePilotEnabled={sandboxPilotEnabled}
                                  writeCapability={writeCapability}
                                  roomOptions={roomOptions}
                                  roomMap={buildRoomLabelMap(rooms)}
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
              </div>
            </section>
          );
          })}
        </div>
      )}

      <div className="app-schedule__footer">
        {writeModeChip ? (
          <Badge
            variant={writeModeChip.variant}
            className="app-schedule__write-mode-chip"
            semanticLabel={`Bridge write mode: ${writeModeChip.label}`}
            title={!sandboxPilotEnabled ? SCHEDULE_WRITE_MODE_CHIP_OFFLINE : undefined}
          >
            {writeModeChip.label}
          </Badge>
        ) : null}
        {bridgeBaseUrl && sandboxPilotEnabled && canLoad ? (
          <AppointmentCreateWriteAction
            bridgeBaseUrl={bridgeBaseUrl}
            fetchImpl={fetchImpl}
            writePilotEnabled={sandboxPilotEnabled}
            writeCapability={writeCapability}
            defaultDate={rangeFrom}
            defaultRoom={roomFilter === "" ? 1 : roomFilter}
            roomOptions={roomOptions}
            roomMap={buildRoomLabelMap(rooms)}
            selectedPatientId={selectedPatientId}
            selectedPatientDisplayName={selectedPatientDisplayName}
            selectedPatientChartNumber={selectedPatientChartNumber}
            onCommitted={() => setRefreshTick((x) => x + 1)}
          />
        ) : null}
        <Button type="button" variant="secondary" className="ui-focusable" onClick={onBackToday}>
          Back to Today
        </Button>
      </div>
    </div>
  );
}
