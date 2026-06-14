import { createBridgeClient } from "@microdent/bridge-client";
import type { BridgeDevStatusResponse, MirrorStatusResponse, ScheduleAppointmentItem, ScheduleRoomItem } from "@microdent/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PatientQuickCard } from "@microdent/ui";
import type { BridgeHealthPhase } from "./bridge-health.js";
import { AppErrorBoundary } from "./AppErrorBoundary.js";
import { AppLoadingSkeleton } from "./app-empty-panel.js";
import { ClinicPage, ClinicPageHero } from "./clinic-page.js";
import { ClinicEmptyState } from "./clinic-empty-state.js";
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
  CLINIC_SERVICE_OFFLINE_TITLE,
  PATIENT_PROFILE_WAITING_TITLE,
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
  SCHEDULE_NAV_NEXT_DAY,
  SCHEDULE_NAV_NEXT_WEEK,
  SCHEDULE_NAV_PREV_DAY,
  SCHEDULE_NAV_PREV_WEEK,
  SCHEDULE_NAV_TODAY,
  SCHEDULE_RANGE_APPOINTMENT_COUNT,
  SCHEDULE_ROOM_ALL,
  SCHEDULE_OPEN_PATIENT,
  SCHEDULE_ROOM_FILTER_CONTEXT,
  SCHEDULE_ROOM_FILTER_LABEL,
  SCHEDULE_ROOM_FILTER_LOADING,
  SCHEDULE_ROOM_FILTER_EMPTY,
  SCHEDULE_FILTER_ACTIVE_PREFIX,
  SCHEDULE_PAGE_SUBTITLE,
  SCHEDULE_VIEW_DAY,
  SCHEDULE_VIEW_WEEK,
  SCHEDULE_VIEW_LABEL,
  READONLY_STATE_RETRY,
  TODAY_APPT_ROW_CURRENT_LABEL,
} from "./read-only-ui-copy.js";
import { AppointmentCreateWriteAction } from "./AppointmentCreateWriteAction.js";
import { AppointmentStatusDryRunAction } from "./AppointmentStatusDryRunAction.js";
import { AppointmentWriteActionsPanel } from "./AppointmentWriteActionsPanel.js";
import {
  PostWriteLocalCopyRefreshNotice,
  createCleanPostWriteLocalCopyState,
  type PostWriteLocalCopyRefreshState,
} from "./post-write-local-copy.js";
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
  postWriteLocalCopyRefresh?: PostWriteLocalCopyRefreshState;
  onSandboxWriteCommitted?: () => void;
  onOpenSettings?: () => void;
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

function statusBadgeClassName(code: number): string {
  return `app-schedule__status-badge app-schedule__status-badge--${statusBadgeVariant(code)}`;
}

function totalBookedMinutes(items: readonly ScheduleAppointmentItem[]): number {
  return items.reduce((sum, a) => {
    const slotMin = a.periodMinutes ?? 30;
    return sum + a.durationSlots * slotMin;
  }, 0);
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

function roomLabel(_rooms: ScheduleRoomItem[], roomNum: number): string {
  const hit = _rooms.find((r) => r.room === roomNum);
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

/** Group appointments by date, then by time slot within each date. */
function groupByDateThenTime(
  items: ScheduleAppointmentItem[],
): Map<string, Map<string, ScheduleAppointmentItem[]>> {
  const dates = [...new Set(items.map((x) => x.date))].sort();
  const out = new Map<string, Map<string, ScheduleAppointmentItem[]>>();
  for (const d of dates) {
    const byTime = new Map<string, ScheduleAppointmentItem[]>();
    for (const it of items.filter((x) => x.date === d)) {
      const list = byTime.get(it.time) ?? [];
      list.push(it);
      byTime.set(it.time, list);
    }
    for (const [, list] of byTime) {
      list.sort(sortAppointments);
    }
    out.set(d, byTime);
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
  postWriteLocalCopyRefresh = createCleanPostWriteLocalCopyState(),
  onSandboxWriteCommitted,
  onOpenSettings,
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

  const [granularity, setGranularity] = useState<Granularity>("day");
  const [rangeFrom, setRangeFrom] = useState(() => defaultDayRange().from);
  const [rangeTo, setRangeTo] = useState(() => defaultDayRange().to);
  const [roomFilter, setRoomFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<number | null>(null);
  const [providerFilter, setProviderFilter] = useState<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [sandboxApplyEnabled, setSandboxApplyEnabled] = useState(false);
  const [writeCapability, setWriteCapability] = useState<BridgeDevStatusResponse | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedApptId, setExpandedApptId] = useState<string | null>(null);

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

  const grouped = useMemo(() => groupByDateThenTime(displayAppointments), [displayAppointments]);

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

  const slotsSummaryLabel = useMemo(() => {
    if (!canLoad || loading || error || appointments.length === 0) {
      return "—";
    }
    const minutes = totalBookedMinutes(appointments);
    return `${minutes} min booked`;
  }, [canLoad, loading, error, appointments]);

  const providersStatLabel = useMemo(() => {
    if (!canLoad || loading || error) {
      return "—";
    }
    if (operationalSummary.providerMix) {
      return operationalSummary.providerMix;
    }
    if (providerOptions.length > 1) {
      return `${providerOptions.length} providers`;
    }
    return providerOptions.length === 1 ? providerOptions[0].label : "—";
  }, [canLoad, loading, error, operationalSummary.providerMix, providerOptions]);

  const statusMixLabel = useMemo(() => {
    if (!canLoad || loading || error) {
      return "—";
    }
    return operationalSummary.statusMix ?? "—";
  }, [canLoad, loading, error, operationalSummary.statusMix]);

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

  const toggleExpandAppt = useCallback((id: string) => {
    setExpandedApptId((prev) => (prev === id ? null : id));
  }, []);

  const handleSandboxWriteCommitted = useCallback(() => {
    onSandboxWriteCommitted?.();
    setRefreshTick((x) => x + 1);
  }, [onSandboxWriteCommitted]);

  // Build summary string for the summary bar
  const summaryText = useMemo(() => {
    if (!canLoad || loading || error) return null;
    const parts: string[] = [];
    parts.push(`${displayAppointments.length} appointment${displayAppointments.length !== 1 ? "s" : ""}`);
    const roomCount = roomsInUseCount;
    if (roomCount !== null) {
      parts.push(`${roomCount} room${roomCount !== 1 ? "s" : ""}`);
    }
    if (providerOptions.length > 0) {
      parts.push(`${providerOptions.length} provider${providerOptions.length !== 1 ? "s" : ""}`);
    }
    if (parts.length === 0) return null;
    return parts.join(" · ");
  }, [canLoad, loading, error, displayAppointments.length, roomsInUseCount, providerOptions.length]);

  const isToday = viewingToday && granularity === "day";

  return (
    <ClinicPage className="clinic-schedule-page app-workspace-page app-schedule" testId="schedule-page">
      <ClinicPageHero
        title={moduleTitle}
        subtitle={moduleDescription ?? SCHEDULE_PAGE_SUBTITLE}
      />

      <PostWriteLocalCopyRefreshNotice
        state={postWriteLocalCopyRefresh}
        className="app-schedule__post-write-local-copy"
        onOpenSettings={onOpenSettings}
      />

      {/* ----- Date Navigation Header ----- */}
      <div className="app-schedule__header">
        <div className="app-schedule__nav-group">
          <Button
            type="button"
            variant="ghost"
            size="compact"
            className="app-schedule__nav-btn"
            disabled={!canLoad || loading}
            onClick={goPrev}
            aria-label={granularity === "day" ? SCHEDULE_NAV_PREV_DAY : SCHEDULE_NAV_PREV_WEEK}
          >
            ‹
          </Button>
          <Button
            type="button"
            variant={viewingToday ? "primary" : "ghost"}
            size="compact"
            className="app-schedule__nav-btn app-schedule__nav-today-btn"
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
            className="app-schedule__nav-btn"
            disabled={!canLoad || loading}
            onClick={goNext}
            aria-label={granularity === "day" ? SCHEDULE_NAV_NEXT_DAY : SCHEDULE_NAV_NEXT_WEEK}
          >
            ›
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="compact"
            className="app-schedule__nav-btn app-schedule__refresh-btn"
            disabled={!canLoad || loading}
            onClick={() => setRefreshTick((x) => x + 1)}
            aria-label="Refresh schedule"
          >
            ↻
          </Button>
        </div>

        <h2 className="app-schedule__range-display" aria-live="polite">
          <time dateTime={`${rangeFrom}/${rangeTo}`}>{rangeHeading}</time>
        </h2>

        <div className="app-schedule__view-toggle" role="group" aria-label={SCHEDULE_VIEW_LABEL}>
          <Button
            type="button"
            variant={granularity === "day" ? "primary" : "ghost"}
            size="compact"
            className="app-schedule__view-btn"
            disabled={!canLoad}
            aria-pressed={granularity === "day"}
            onClick={() => onGranularityChange("day")}
          >
            {SCHEDULE_VIEW_DAY}
          </Button>
          <Button
            type="button"
            variant={granularity === "week" ? "primary" : "ghost"}
            size="compact"
            className="app-schedule__view-btn"
            disabled={!canLoad}
            aria-pressed={granularity === "week"}
            onClick={() => onGranularityChange("week")}
          >
            {SCHEDULE_VIEW_WEEK}
          </Button>
        </div>

        {/* Filter toggle button */}
        {canLoad && !loading && !error && (clientFiltersActive || providerOptions.length > 1 || roomOptions.length > 0) ? (
          <Button
            type="button"
            variant={showFilters || clientFiltersActive ? "primary" : "ghost"}
            size="compact"
            className="app-schedule__filter-toggle"
            aria-expanded={showFilters}
            aria-controls="schedule-filter-panel"
            onClick={() => setShowFilters((s) => !s)}
          >
            {clientFiltersActive ? "Filters active" : "Filters"}
            {clientFiltersActive && <span className="app-schedule__filter-dot" aria-hidden />}
          </Button>
        ) : null}
      </div>

      {/* ----- Summary Bar ----- */}
      {summaryText && (
        <div className="app-schedule__summary-bar" role="status" aria-label="Today summary">
          <span className="app-schedule__summary-text">{summaryText}</span>
          {isToday && <Badge variant="info" semanticLabel="Viewing today">Today</Badge>}
          {statusMixLabel && statusMixLabel !== "—" && (
            <span className="app-schedule__summary-status">{statusMixLabel}</span>
          )}
        </div>
      )}

      {/* ----- Filter Bar (collapsible) ----- */}
      {showFilters && canLoad && !loading && !error && (
        <Card className="app-schedule__filter-card">
          <CardBody className="app-schedule__filter-body" id="schedule-filter-panel">
            {roomOptions.length > 0 && (
              <label className="app-schedule__filter-field">
                <span className="app-schedule__filter-label">{SCHEDULE_ROOM_FILTER_LABEL}</span>
                <select
                  className="app-schedule__select"
                  disabled={!canLoad || loading}
                  value={roomFilter === "" ? "" : String(roomFilter)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRoomFilter(v === "" ? "" : Number.parseInt(v, 10));
                  }}
                  aria-label="Filter by room"
                >
                  <option value="">{SCHEDULE_ROOM_ALL}</option>
                  {roomOptions.map((n) => (
                    <option key={n} value={String(n)}>
                      {roomCopyLabel(rooms, n)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {providerOptions.length > 1 && (
              <div className="app-schedule__filter-group" role="group" aria-label={SCHEDULE_FILTER_PROVIDER_ARIA}>
                <span className="app-schedule__filter-label">Provider</span>
                <div className="app-schedule__filter-chips">
                  <Button
                    type="button"
                    size="compact"
                    variant={providerFilter === null ? "primary" : "secondary"}
                    className="app-schedule__filter-chip"
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
                      className="app-schedule__filter-chip"
                      aria-pressed={providerFilter === docId}
                      onClick={() => setProviderFilter((f) => (f === docId ? null : docId))}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {statusBreakdown.length > 0 && (
              <div className="app-schedule__filter-group" role="group" aria-label="Filter by status">
                <span className="app-schedule__filter-label">Status</span>
                <div className="app-schedule__filter-chips">
                  {statusBreakdown.map(({ code, count, label, variant }) => (
                    <Button
                      key={code}
                      type="button"
                      size="compact"
                      variant={statusFilter === code ? "primary" : "secondary"}
                      className={`app-schedule__filter-chip app-schedule__filter-chip--${variant}`}
                      aria-pressed={statusFilter === code}
                      onClick={() => setStatusFilter((f) => (f === code ? null : code))}
                    >
                      {count} {label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {clientFiltersActive && (
              <Button
                type="button"
                size="compact"
                variant="ghost"
                className="app-schedule__clear-filters-btn"
                aria-label="Clear schedule filters"
                onClick={clearClientFilters}
              >
                {FILTER_CLEAR_LABEL}
              </Button>
            )}
          </CardBody>
        </Card>
      )}

      {/* ----- Filter active indicator ----- */}
      {operationalSummary.filterActiveLabel && !showFilters ? (
        <p className="app-schedule__filter-active-hint" role="status">
          {operationalSummary.filterActiveLabel.replace(/^Filters:/, `${SCHEDULE_FILTER_ACTIVE_PREFIX}:`)}
          <button
            type="button"
            className="app-schedule__show-filters-link"
            aria-label="Edit active schedule filters"
            onClick={() => setShowFilters(true)}
          >
            edit
          </button>
        </p>
      ) : null}

      {/* ----- Content Area ----- */}
      {!canLoad ? (
        <ClinicEmptyState
          className="app-schedule__empty-panel"
          variant={bridgePhase === "checking" ? "default" : "offline"}
          title={bridgePhase === "checking" ? PATIENT_PROFILE_WAITING_TITLE : CLINIC_SERVICE_OFFLINE_TITLE}
          body={offlineMessage}
        />
      ) : loading ? (
        <AppLoadingSkeleton
          className="app-readonly-state app-readonly-state--loading app-schedule__state app-schedule__state--muted"
          label={SCHEDULE_LOADING}
        />
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
            className="app-schedule__empty-panel"
            icon="📅"
            title={SCHEDULE_EMPTY_TITLE}
            description={SCHEDULE_EMPTY_DESCRIPTION}
            actions={
              <>
                <Button type="button" variant="primary" size="sm" onClick={goToday}>
                  {SCHEDULE_NAV_TODAY}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRefreshTick((x) => x + 1)}
                >
                  Refresh
                </Button>
              </>
            }
          />
        </AppErrorBoundary>
      ) : displayAppointments.length === 0 ? (
        <AppErrorBoundary>
          <EmptyState
            className="app-schedule__empty-panel"
            icon="🔍"
            title={SCHEDULE_FILTER_EMPTY_TITLE}
            description={SCHEDULE_FILTER_EMPTY_DESCRIPTION}
            actions={
              <>
                <Button type="button" variant="primary" size="sm" onClick={clearClientFilters}>
                  {FILTER_CLEAR_LABEL}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRefreshTick((x) => x + 1)}
                >
                  Refresh
                </Button>
              </>
            }
          />
        </AppErrorBoundary>
      ) : (
        <div className="app-schedule__board">
          {[...grouped.entries()].map(([dateIso, byTime]) => {
            const dayCount = [...byTime.values()].reduce((sum, list) => sum + list.length, 0);
            return (
              <section key={dateIso} className="app-schedule__day-section">
                <header className="app-schedule__day-header">
                  <h3 className="app-schedule__day-title">
                    <time dateTime={dateIso}>{formatRangeHeading(dateIso, dateIso, "day")}</time>
                  </h3>
                  <span className="app-schedule__day-count">{SCHEDULE_DAY_APPOINTMENT_COUNT(dayCount)}</span>
                </header>

                <div className="app-schedule__time-slots">
                  {[...byTime.entries()].map(([timeSlot, list]) => (
                    <div key={`${dateIso}-${timeSlot}`} className="app-schedule__time-slot">
                      <div className="app-schedule__time-label">{timeSlot}</div>
                      <div className="app-schedule__slot-cards">
                        {list.map((appt) => {
                          const chart = schedulePatientChart(appt);
                          const isCurrent = currentAppt?.id === appt.id;
                          const isExpanded = expandedApptId === appt.id;
                          const patientName = schedulePatientPrimary(appt);
                          const room = roomCopyLabel(rooms, appt.room);

                          // Get doctor label if available
                          const doctorLabel = (() => {
                            const meta = appointmentVisitMeta(appt, doctorLabels, procedureMaps, {
                              includeRoom: false,
                            });
                            return meta.length > 0 ? meta : null;
                          })();

                          return (
                            <Card
                              key={appt.id}
                              className={`app-schedule__appt-card${isCurrent ? " app-schedule__appt-card--current" : ""}`}
                            >
                              <CardHeader className="app-schedule__appt-card-header">
                                <PatientQuickCard
                                  name={patientName}
                                  chartNumber={chart ?? appt.patId}
                                  time={appt.time}
                                  room={room}
                                  status={
                                    <Badge
                                      variant={statusBadgeVariant(appt.status)}
                                      semanticLabel={patientApptStatusSemanticLabel(appt.status)}
                                    >
                                      {statusLabel(appt.status)}
                                    </Badge>
                                  }
                                  className="app-schedule__patient-card"
                                />
                                <div className="app-schedule__appt-card-actions">
                                  {appt.patId !== "0" && onOpenPatient ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="compact"
                                      className="app-schedule__open-patient-btn"
                                      aria-label={`Open patient record for ${patientName}`}
                                      onClick={() => openPatientFromAppt(appt)}
                                    >
                                      {SCHEDULE_OPEN_PATIENT}
                                    </Button>
                                  ) : null}
                                  {(sandboxPilotEnabled || devWriteActionsEnabled) && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="compact"
                                      className="app-schedule__expand-btn"
                                      onClick={() => toggleExpandAppt(appt.id)}
                                      aria-expanded={isExpanded}
                                      aria-controls={`schedule-appt-details-${appt.id}`}
                                      aria-label={isExpanded ? `Hide write details for ${patientName}` : `Show write details for ${patientName}`}
                                    >
                                      {isExpanded ? "▾" : "▸"}
                                    </Button>
                                  )}
                                </div>
                              </CardHeader>
                              <CardBody className="app-schedule__appt-card-body">
                                <div className="app-schedule__appt-meta-row">
                                  <span className="app-schedule__appt-duration">{formatDuration(appt)}</span>
                                  {doctorLabel && (
                                    <span className="app-schedule__appt-doctor"> · {doctorLabel}</span>
                                  )}
                                  {appt.missed && (
                                    <Badge variant="danger" semanticLabel="Missed appointment" className="app-schedule__missed-badge">
                                      Missed
                                    </Badge>
                                  )}
                                  {appt.hasComment && (
                                    <Badge variant="neutral" semanticLabel="Internal note hidden" className="app-schedule__note-badge">
                                      Note hidden
                                    </Badge>
                                  )}
                                </div>
                              </CardBody>

                              {/* Expandable dev/sandbox actions */}
                              {isExpanded && (
                                <CardBody className="app-schedule__appt-card-details" id={`schedule-appt-details-${appt.id}`}>
                                  {bridgeBaseUrl && sandboxPilotEnabled && canLoad ? (
                                    <AppointmentWriteActionsPanel
                                      appointment={appt}
                                      bridgeBaseUrl={bridgeBaseUrl}
                                      fetchImpl={fetchImpl}
                                      writePilotEnabled={sandboxPilotEnabled}
                                      writeCapability={writeCapability}
                                      roomOptions={roomOptions}
                                      roomMap={buildRoomLabelMap(rooms)}
                                      onCommitted={handleSandboxWriteCommitted}
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
                                </CardBody>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ----- Footer ----- */}
      <div className="app-schedule__footer">
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
            onCommitted={handleSandboxWriteCommitted}
          />
        ) : null}
        <Button type="button" variant="secondary" className="ui-focusable" onClick={onBackToday}>
          Back to Today
        </Button>
      </div>
    </ClinicPage>
  );
}
