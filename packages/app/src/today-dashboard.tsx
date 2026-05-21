import { createBridgeClient } from "@microdent/bridge-client";
import type { BridgeDevStatusResponse, MirrorStatusResponse, ScheduleAppointmentItem } from "@microdent/contracts";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge, Button } from "@microdent/ui";
import { ClinicEmptyState } from "./clinic-empty-state.js";
import { ClinicLoadingSkeleton } from "./clinic-loading-skeleton.js";
import { ClinicPage, ClinicPageHero } from "./clinic-page.js";
import { ClinicPanel } from "./clinic-panel.js";
import { ClinicStatCard, type ClinicStatCardTone } from "./clinic-stat-card.js";
import { ClinicStatusGrid, type ClinicStatusRowItem, type ClinicStatusTone } from "./clinic-status-row.js";
import type { AppSidebarModuleId } from "./app-nav-modules.js";
import type { SessionRecentPatient } from "./session-recent-patients.js";
import type { BridgeHealthPhase } from "./bridge-health.js";
import { FixtureConnectionPanel } from "./FixtureConnectionPanel.js";
import { LegacyCatalogPanel } from "./LegacyCatalogPanel.js";
import { isMirrorImportStale } from "./mirror-stale.js";
import {
  appointmentVisitMeta,
  buildRoomLabelMap,
  formatAppointmentStatusMix,
  patientApptStatusBadgeVariant,
  patientApptStatusLabel,
  patientApptStatusSemanticLabel,
  roomDisplayLabel,
  type RoomLabelMap,
} from "./patient-appointments-display.js";
import {
  resolveBackupConfiguredStatus,
  resolveFrontDeskOverview,
  type SettingsStatusTone,
} from "./settings-status.js";
import type { ProcedureReferenceMaps } from "./procedure-reference.js";
import { useDoctorLabels } from "./useDoctorLabels.js";
import { useProcedureReference } from "./useProcedureReference.js";
import {
  CLINIC_AT_A_GLANCE_TITLE,
  CLINIC_SERVICE_CHECKING,
  CLINIC_SERVICE_CONNECT_TODAY,
  CLINIC_SERVICE_OFFLINE_TITLE,
  FRONT_DESK_OVERVIEW_BACKUP_LABEL,
  FRONT_DESK_OVERVIEW_BRIDGE_CHECKING,
  FRONT_DESK_OVERVIEW_BRIDGE_CONNECTED,
  FRONT_DESK_OVERVIEW_BRIDGE_OFFLINE,
  FRONT_DESK_OVERVIEW_OPEN_SETTINGS,
  FRONT_DESK_OVERVIEW_SANDBOX_PILOT_LABEL,
  FRONT_DESK_OVERVIEW_WRITE_MODE_LABEL,
  FRONT_DESK_OVERVIEW_WRITE_MODE_UNKNOWN,
  SETTINGS_SANDBOX_PILOT_OFF,
  SETTINGS_SANDBOX_PILOT_ON,
  WRITE_MODE_CHIP_DISABLED,
  WRITE_MODE_CHIP_DRY_RUN,
  WRITE_MODE_CHIP_ENABLED,
  MIRROR_ACTIVE_BANNER_LABEL,
  MIRROR_FALLBACK_BANNER_LABEL,
  MIRROR_STALE_BANNER_LABEL,
  READONLY_STATE_RETRY,
  SCHEDULE_LOAD_ERROR,
  TODAY_APPT_ROW_CURRENT_LABEL,
  TODAY_APPT_ROW_NEXT_LABEL,
  TODAY_EMPTY_DESCRIPTION,
  TODAY_EMPTY_TITLE,
  TODAY_LOADING,
  TODAY_METRIC_NEXT_LABEL,
  TODAY_METRIC_ON_SCHEDULE,
  TODAY_METRIC_SCHEDULE_LABEL,
  TODAY_MIRROR_STALE_ADVISORY,
  TODAY_NEXT_LOADING,
  TODAY_NEXT_NO_UPCOMING,
  TODAY_NOW_CARD_TITLE,
  TODAY_REMINDERS_FOOTNOTE,
  TODAY_NEXT_OFFLINE,
  TODAY_OPEN_PATIENT,
  TODAY_OPEN_SCHEDULE,
  TODAY_OPEN_SETTINGS,
  TODAY_PILOT_READINESS_HINT,
  TODAY_PRIVACY_LEDE,
  TODAY_QUICK_ACTIONS_LEDE,
  TODAY_REFRESH,
  TODAY_REOPEN_RECENT,
  TODAY_REMINDERS_PILOT_UNAVAILABLE,
  TODAY_SCHEDULE_UNAVAILABLE,
  TODAY_SEARCH_PATIENT,
  TODAY_SELECTED_PATIENT_OPEN,
  TODAY_STATUS_MIRROR_ACTIVE,
  TODAY_STATUS_MIRROR_FALLBACK,
  TODAY_STATUS_MIRROR_OFFLINE,
  TODAY_STATUS_MIRROR_STALE,
  TODAY_STATUS_MIRROR_TITLE,
  TODAY_STATUS_MIRROR_UNKNOWN,
  TODAY_OPEN_PATIENT_APPOINTMENTS,
  TODAY_SCHEDULE_READINESS_OFFLINE,
  TODAY_SCHEDULE_READINESS_STALE,
  TODAY_SCHEDULE_READINESS_READY,
} from "./read-only-ui-copy.js";

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function statusLabel(code: number): string {
  return patientApptStatusLabel(code);
}

function statusBadgeVariant(
  code: number,
): "neutral" | "success" | "warning" | "danger" | "info" {
  return patientApptStatusBadgeVariant(code);
}

function dashboardPatientHeadline(appt: ScheduleAppointmentItem): string {
  if (appt.patId === "0") {
    return "No patient id";
  }
  return appt.patient?.displayName ?? `Patient ID ${appt.patId}`;
}

function dashboardPatientChart(appt: ScheduleAppointmentItem): string | null {
  if (appt.patId === "0") {
    return null;
  }
  const c = appt.patient?.chartNumber;
  return c !== null && c !== undefined && c.length > 0 ? c : null;
}

function sortAppointments(a: ScheduleAppointmentItem, b: ScheduleAppointmentItem): number {
  const ta = a.time.trim();
  const tb = b.time.trim();
  if (ta !== tb) return ta.localeCompare(tb, undefined, { numeric: true });
  return a.id.localeCompare(b.id, undefined, { numeric: true });
}

function parseTimeToMinutes(t: string): number | null {
  const s = t.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59 || h < 0 || min < 0) return null;
  return h * 60 + min;
}

/** First appointment today at or after `now` (local), by time then id. */
function findNextUpcomingToday(sorted: ScheduleAppointmentItem[], now: Date): ScheduleAppointmentItem | null {
  const nowM = now.getHours() * 60 + now.getMinutes();
  for (const a of sorted) {
    const m = parseTimeToMinutes(a.time);
    if (m === null) continue;
    if (m >= nowM) return a;
  }
  return null;
}

/** Appointment in progress at `now` (start <= now < end). */
function findCurrentToday(sorted: ScheduleAppointmentItem[], now: Date): ScheduleAppointmentItem | null {
  const nowM = now.getHours() * 60 + now.getMinutes();
  for (const a of sorted) {
    const start = parseTimeToMinutes(a.time);
    if (start === null) continue;
    const slotMin = a.periodMinutes ?? 30;
    const end = start + a.durationSlots * slotMin;
    if (start <= nowM && nowM < end) return a;
  }
  return null;
}

function formatTodayLine(): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(new Date());
  } catch {
    return "Today";
  }
}

function visitMetaLine(
  a: ScheduleAppointmentItem,
  doctorLabels: ReadonlyMap<string, string>,
  procedureMaps: ProcedureReferenceMaps,
  roomMap: RoomLabelMap,
): string {
  return appointmentVisitMeta(a, doctorLabels, procedureMaps, {
    includeDuration: true,
    roomLabel: roomDisplayLabel(a.room, roomMap),
  });
}

export type DashboardPatientSummary = {
  displayName?: string | null;
  chartNumber?: string | null;
};

export type DashboardHomeProps = {
  moduleTitle?: string;
  moduleDescription?: string;
  onOpenModule: (id: AppSidebarModuleId) => void;
  onOpenPatient?: (patientId: string, summary?: DashboardPatientSummary) => void;
  onOpenScheduleAtDate?: (dateIso: string) => void;
  bridgeBaseUrl?: string;
  bridgePhase: BridgeHealthPhase;
  fetchImpl?: typeof fetch;
  selectedPatientId?: string | null;
  selectedPatientDisplayName?: string | null;
  selectedPatientChartNumber?: string | null;
  recentPatients?: readonly SessionRecentPatient[];
  onRecentPatientSelect?: (entry: SessionRecentPatient) => void;
  mirrorStatus?: MirrorStatusResponse | null;
  writeCapability?: BridgeDevStatusResponse | null;
  sandboxWritePilot?: boolean;
  sessionRecentPatientCount?: number;
};

type MirrorFreshness = {
  label: string;
  body: string;
  tone: "neutral" | "warning" | "info";
};

function resolveMirrorFreshness(
  bridgePhase: BridgeHealthPhase,
  hasBaseUrl: boolean,
  mirrorStatus: MirrorStatusResponse | null | undefined,
): MirrorFreshness {
  if (!hasBaseUrl || bridgePhase === "offline") {
    return { label: "Offline", body: TODAY_STATUS_MIRROR_OFFLINE, tone: "neutral" };
  }
  if (bridgePhase === "checking") {
    return { label: "Checking", body: CLINIC_SERVICE_CHECKING, tone: "neutral" };
  }
  if (mirrorStatus === null || mirrorStatus === undefined) {
    return { label: "Unknown", body: TODAY_STATUS_MIRROR_UNKNOWN, tone: "neutral" };
  }
  if (isMirrorImportStale(mirrorStatus, Date.now())) {
    return { label: MIRROR_STALE_BANNER_LABEL, body: TODAY_STATUS_MIRROR_STALE, tone: "warning" };
  }
  if (!mirrorStatus.sqliteUsable) {
    return { label: MIRROR_FALLBACK_BANNER_LABEL, body: TODAY_STATUS_MIRROR_FALLBACK, tone: "warning" };
  }
  return { label: MIRROR_ACTIVE_BANNER_LABEL, body: TODAY_STATUS_MIRROR_ACTIVE, tone: "info" };
}

const TODAY_HERO_SUBTITLE = "Schedule overview, next steps, and clinic readiness.";

const TODAY_APPOINTMENTS_TODAY_LABEL = "Appointments today";

function mapOverviewTone(tone: SettingsStatusTone): ClinicStatusTone {
  if (tone === "ok") return "ok";
  if (tone === "warn") return "warn";
  if (tone === "danger") return "danger";
  return "neutral";
}

function mapMirrorFreshnessToStatTone(tone: MirrorFreshness["tone"]): ClinicStatCardTone {
  if (tone === "warning") return "amber";
  if (tone === "info") return "green";
  return "neutral";
}

function mapMirrorFreshnessToGridTone(tone: MirrorFreshness["tone"]): ClinicStatusTone {
  if (tone === "warning") return "warn";
  if (tone === "info") return "info";
  return "neutral";
}

function scheduleReadinessGridTone(
  hasBase: boolean,
  bridgePhase: BridgeHealthPhase,
  loading: boolean,
  error: string | null,
  mirrorStale: boolean,
): ClinicStatusTone {
  if (!hasBase || bridgePhase === "offline") return "neutral";
  if (bridgePhase === "checking" || loading) return "neutral";
  if (error) return "warn";
  if (mirrorStale) return "warn";
  return "ok";
}

function scheduleReadinessStatTone(
  hasBase: boolean,
  bridgePhase: BridgeHealthPhase,
  loading: boolean,
  error: string | null,
  mirrorStale: boolean,
): ClinicStatCardTone {
  const gridTone = scheduleReadinessGridTone(hasBase, bridgePhase, loading, error, mirrorStale);
  if (gridTone === "ok") return "green";
  if (gridTone === "warn") return "amber";
  return "neutral";
}

function scheduleReadinessShort(
  hasBase: boolean,
  bridgePhase: BridgeHealthPhase,
  loading: boolean,
  error: string | null,
  mirrorStale: boolean,
): string {
  if (!hasBase || bridgePhase === "offline") return "Offline";
  if (bridgePhase === "checking" || loading) return "…";
  if (error) return "Unavailable";
  if (mirrorStale) return "Stale";
  return "Ready";
}

function resolveWriteModeMetric(
  writeCapability: BridgeDevStatusResponse | null,
): { label: string; tone: ClinicStatCardTone } {
  if (!writeCapability) {
    return { label: FRONT_DESK_OVERVIEW_WRITE_MODE_UNKNOWN, tone: "neutral" };
  }
  switch (writeCapability.writeMode) {
    case "disabled":
      return { label: WRITE_MODE_CHIP_DISABLED, tone: "blue" };
    case "dry-run":
      return { label: WRITE_MODE_CHIP_DRY_RUN, tone: "amber" };
    case "enabled":
      return { label: WRITE_MODE_CHIP_ENABLED, tone: "amber" };
    default:
      return { label: FRONT_DESK_OVERVIEW_WRITE_MODE_UNKNOWN, tone: "neutral" };
  }
}

function resolveSandboxGlance(
  sandboxWritePilot: boolean,
  writeCapability: BridgeDevStatusResponse | null,
): { label: string; tone: ClinicStatusTone } {
  if (!sandboxWritePilot) {
    return { label: SETTINGS_SANDBOX_PILOT_OFF, tone: "neutral" };
  }
  if (writeCapability?.writableSandbox && writeCapability.writesPermitted) {
    return { label: SETTINGS_SANDBOX_PILOT_ON, tone: "ok" };
  }
  return { label: SETTINGS_SANDBOX_PILOT_ON, tone: "warn" };
}

function selectedPatientHeadline(
  patientId: string,
  displayName?: string | null,
): string {
  const trimmed = displayName?.trim();
  if (trimmed && trimmed.length > 0) return trimmed;
  return `Patient ID ${patientId}`;
}

export function DashboardHome({
  moduleTitle = "Today",
  moduleDescription: _moduleDescription,
  onOpenModule,
  onOpenPatient,
  onOpenScheduleAtDate,
  bridgeBaseUrl,
  bridgePhase,
  fetchImpl,
  selectedPatientId = null,
  selectedPatientDisplayName = null,
  selectedPatientChartNumber = null,
  recentPatients = [],
  onRecentPatientSelect,
  mirrorStatus = null,
  writeCapability = null,
  sandboxWritePilot = false,
  sessionRecentPatientCount = 0,
}: DashboardHomeProps) {
  const base = bridgeBaseUrl?.trim() ?? "";
  const canLoad = Boolean(base) && bridgePhase === "connected";
  const { labels: doctorLabels } = useDoctorLabels({ bridgePhase, bridgeBaseUrl, fetchImpl });
  const { maps: procedureMaps } = useProcedureReference({ bridgePhase, bridgeBaseUrl, fetchImpl });
  const [roomMap, setRoomMap] = useState<RoomLabelMap>(() => new Map());

  const todayIso = useMemo(() => toLocalIsoDate(new Date()), []);

  const [appointments, setAppointments] = useState<ScheduleAppointmentItem[]>([]);
  const [loading, setLoading] = useState(() => Boolean(bridgeBaseUrl?.trim()) && bridgePhase === "connected");
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const requestSeq = useRef(0);

  const mirrorFreshness = useMemo(
    () => resolveMirrorFreshness(bridgePhase, Boolean(base), mirrorStatus),
    [base, bridgePhase, mirrorStatus],
  );
  const mirrorStale =
    bridgePhase === "connected" && mirrorStatus !== null && isMirrorImportStale(mirrorStatus, Date.now());

  const openScheduleToday = useCallback(() => {
    if (onOpenScheduleAtDate) {
      onOpenScheduleAtDate(todayIso);
      return;
    }
    onOpenModule("schedule");
  }, [onOpenModule, onOpenScheduleAtDate, todayIso]);

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

  useEffect(() => {
    if (!canLoad) {
      setRoomMap(new Map());
      return;
    }

    let cancelled = false;
    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });

    void (async () => {
      try {
        const res = await client.getScheduleRooms();
        if (!cancelled) {
          setRoomMap(buildRoomLabelMap(res.rooms));
        }
      } catch {
        if (!cancelled) {
          setRoomMap(new Map());
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canLoad, base, fetchImpl]);

  const loadToday = useCallback(async () => {
    if (!canLoad) {
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });
    try {
      const res = await client.getScheduleAppointments({ from: todayIso, to: todayIso });
      if (seq !== requestSeq.current) return;
      const sorted = [...res.appointments].sort(sortAppointments);
      setAppointments(sorted);
    } catch {
      if (seq !== requestSeq.current) return;
      setAppointments([]);
      setError(SCHEDULE_LOAD_ERROR);
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, [base, canLoad, fetchImpl, todayIso]);

  const refreshToday = useCallback(() => {
    setRetryTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!canLoad) {
      requestSeq.current += 1;
      setLoading(false);
      setAppointments([]);
      setError(null);
      return;
    }
    void loadToday();
    return () => {
      requestSeq.current += 1;
    };
  }, [canLoad, loadToday, retryTick]);

  const sorted = useMemo(() => [...appointments].sort(sortAppointments), [appointments]);
  const now = useMemo(() => new Date(), [sorted, loading, retryTick]);
  const currentAppt = useMemo(() => findCurrentToday(sorted, now), [sorted, now]);
  const nextUpcoming = useMemo(() => findNextUpcomingToday(sorted, now), [sorted, now]);

  const todayCountForOverview = useMemo((): number | null => {
    if (!base || bridgePhase === "offline") return null;
    if (bridgePhase === "checking" || loading || error) return null;
    return sorted.length;
  }, [base, bridgePhase, loading, error, sorted.length]);

  const statusMixLine = useMemo(() => {
    if (!base || bridgePhase === "offline") return null;
    if (bridgePhase === "checking" || loading) return null;
    if (error || sorted.length === 0) return null;
    return formatAppointmentStatusMix(sorted);
  }, [base, bridgePhase, loading, error, sorted]);

  const scheduleReadinessLine = useMemo((): string => {
    if (!base || bridgePhase === "offline") return TODAY_SCHEDULE_READINESS_OFFLINE;
    if (bridgePhase === "checking" || loading) return CLINIC_SERVICE_CHECKING;
    if (error) return TODAY_SCHEDULE_UNAVAILABLE;
    if (mirrorStatus && isMirrorImportStale(mirrorStatus, Date.now())) {
      return TODAY_SCHEDULE_READINESS_STALE;
    }
    return TODAY_SCHEDULE_READINESS_READY;
  }, [base, bridgePhase, loading, error, mirrorStatus]);

  const clinicOverview = useMemo(
    () =>
      resolveFrontDeskOverview({
        bridgePhase,
        mirrorStatus,
        writeCapability,
        todayAppointmentCount: todayCountForOverview,
        sandboxWritePilot,
        sessionRecentPatientCount,
        todayStatusMix: statusMixLine,
        selectedPatientId,
        selectedPatientDisplayName,
        selectedPatientChartNumber,
      }),
    [
      bridgePhase,
      mirrorStatus,
      writeCapability,
      todayCountForOverview,
      sandboxWritePilot,
      sessionRecentPatientCount,
      statusMixLine,
      selectedPatientId,
      selectedPatientDisplayName,
      selectedPatientChartNumber,
    ],
  );

  const writeModeMetric = useMemo(
    () => resolveWriteModeMetric(writeCapability),
    [writeCapability],
  );

  const sandboxGlance = useMemo(
    () => resolveSandboxGlance(sandboxWritePilot, writeCapability),
    [sandboxWritePilot, writeCapability],
  );

  const scheduleMetricShort = useMemo(
    () => scheduleReadinessShort(Boolean(base), bridgePhase, loading, error, mirrorStale),
    [base, bridgePhase, loading, error, mirrorStale],
  );

  const scheduleMetricTone = useMemo(
    () => scheduleReadinessStatTone(Boolean(base), bridgePhase, loading, error, mirrorStale),
    [base, bridgePhase, loading, error, mirrorStale],
  );

  const statusGridItems = useMemo((): ClinicStatusRowItem[] => {
    const overviewByKey = new Map(clinicOverview.map((row) => [row.key, row]));
    const bridge = overviewByKey.get("bridge");
    const writeRow = overviewByKey.get("write-mode");
    const backupRow = overviewByKey.get("backup");
    const backupFallback = resolveBackupConfiguredStatus(writeCapability);

    return [
      {
        key: "clinic-service",
        label: "Service",
        value: bridge?.value ?? FRONT_DESK_OVERVIEW_BRIDGE_OFFLINE,
        tone: mapOverviewTone(bridge?.tone ?? "neutral"),
        ...(canLoad
          ? {
              actionLabel: FRONT_DESK_OVERVIEW_OPEN_SETTINGS,
              onAction: () => onOpenModule("settings"),
            }
          : {}),
      },
      {
        key: "mirror",
        label: "Mirror",
        value: mirrorFreshness.label,
        tone: mapMirrorFreshnessToGridTone(mirrorFreshness.tone),
      },
      {
        key: "schedule-readiness",
        label: TODAY_METRIC_SCHEDULE_LABEL,
        value: scheduleMetricShort,
        tone: scheduleReadinessGridTone(Boolean(base), bridgePhase, loading, error, mirrorStale),
      },
      {
        key: "write-mode",
        label: FRONT_DESK_OVERVIEW_WRITE_MODE_LABEL,
        value: writeRow?.value ?? writeModeMetric.label,
        tone: mapOverviewTone(writeRow?.tone ?? "neutral"),
      },
      {
        key: "backup",
        label: FRONT_DESK_OVERVIEW_BACKUP_LABEL,
        value: backupRow?.value ?? backupFallback.label,
        tone: mapOverviewTone(backupRow?.tone ?? backupFallback.tone),
      },
      {
        key: "sandbox",
        label: FRONT_DESK_OVERVIEW_SANDBOX_PILOT_LABEL,
        value: sandboxGlance.label,
        tone: sandboxGlance.tone,
      },
    ];
  }, [
    base,
    bridgePhase,
    canLoad,
    clinicOverview,
    error,
    loading,
    mirrorFreshness.label,
    mirrorFreshness.tone,
    mirrorStale,
    onOpenModule,
    sandboxGlance.label,
    sandboxGlance.tone,
    scheduleMetricShort,
    writeCapability,
    writeModeMetric.label,
  ]);

  const appointmentsMetricValue: ReactNode = (() => {
    if (!base || bridgePhase === "offline") return "—";
    if (bridgePhase === "checking" || loading) return "…";
    if (error) return "—";
    return sorted.length;
  })();

  const appointmentsMetricHint = (() => {
    if (!base || bridgePhase === "offline") {
      return TODAY_NEXT_OFFLINE;
    }
    if (bridgePhase === "checking") {
      return CLINIC_SERVICE_CHECKING;
    }
    if (loading) {
      return TODAY_NEXT_LOADING;
    }
    if (error) {
      return TODAY_SCHEDULE_UNAVAILABLE;
    }
    if (sorted.length === 0) {
      return TODAY_EMPTY_TITLE;
    }
    return "On the schedule today";
  })();

  const nextMetricValue: ReactNode = (() => {
    if (!base || bridgePhase === "offline") return "—";
    if (bridgePhase === "checking" || loading) return "…";
    if (error) return "—";
    if (sorted.length === 0 || !nextUpcoming) return "—";
    return nextUpcoming.time.trim();
  })();

  const nextMetricHint = (() => {
    if (!base || bridgePhase === "offline") return TODAY_NEXT_OFFLINE;
    if (bridgePhase === "checking") return CLINIC_SERVICE_CHECKING;
    if (loading) return TODAY_NEXT_LOADING;
    if (error) return TODAY_SCHEDULE_UNAVAILABLE;
    if (sorted.length === 0) return TODAY_EMPTY_TITLE;
    if (!nextUpcoming) return TODAY_NEXT_NO_UPCOMING;
    return dashboardPatientHeadline(nextUpcoming);
  })();

  const nextMetricTone: ClinicStatCardTone = (() => {
    if (!base || bridgePhase === "offline" || bridgePhase === "checking" || loading || error) {
      return "neutral";
    }
    if (!nextUpcoming) return "neutral";
    return "cyan";
  })();

  const heroServiceChip = (() => {
    if (!base || bridgePhase === "offline") return FRONT_DESK_OVERVIEW_BRIDGE_OFFLINE;
    if (bridgePhase === "checking") return FRONT_DESK_OVERVIEW_BRIDGE_CHECKING;
    return FRONT_DESK_OVERVIEW_BRIDGE_CONNECTED;
  })();

  const emptyStateActions = (
    <>
      <Button
        type="button"
        variant="primary"
        className="ui-focusable"
        onClick={() => onOpenModule("schedule")}
      >
        {TODAY_OPEN_SCHEDULE}
      </Button>
      <Button type="button" variant="secondary" className="ui-focusable" onClick={() => onOpenModule("patients")}>
        {TODAY_SEARCH_PATIENT}
      </Button>
    </>
  );

  const primaryBody: ReactNode = (() => {
    if (!base || bridgePhase === "offline") {
      return (
        <ClinicEmptyState
          variant="offline"
          title={CLINIC_SERVICE_OFFLINE_TITLE}
          body={CLINIC_SERVICE_CONNECT_TODAY}
          actions={
            <Button type="button" variant="secondary" className="ui-focusable" onClick={() => onOpenModule("settings")}>
              {TODAY_OPEN_SETTINGS}
            </Button>
          }
        />
      );
    }
    if (bridgePhase === "checking") {
      return <ClinicLoadingSkeleton lines={3} label={CLINIC_SERVICE_CHECKING} />;
    }
    if (loading) {
      return <ClinicLoadingSkeleton lines={5} label={TODAY_LOADING} />;
    }
    if (error) {
      return (
        <div className="clinic-today-readonly-state clinic-today-readonly-state--error" role="alert">
          <p>{TODAY_SCHEDULE_UNAVAILABLE}</p>
          <Button type="button" variant="secondary" className="ui-focusable" onClick={refreshToday}>
            {READONLY_STATE_RETRY}
          </Button>
        </div>
      );
    }
    if (sorted.length === 0) {
      return (
        <ClinicEmptyState
          title={TODAY_EMPTY_TITLE}
          body={TODAY_EMPTY_DESCRIPTION}
          actions={emptyStateActions}
        />
      );
    }
    return (
      <div className="clinic-today-appt-list" aria-label="Today’s appointments from the clinic copy">
        {sorted.map((a) => {
          const rowClass = [
            "clinic-list-card",
            `clinic-list-card--status-${statusBadgeVariant(a.status)}`,
            currentAppt?.id === a.id ? "clinic-list-card--current" : "",
            nextUpcoming?.id === a.id && currentAppt?.id !== a.id ? "clinic-list-card--next" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const rowLabel =
            currentAppt?.id === a.id
              ? TODAY_APPT_ROW_CURRENT_LABEL
              : nextUpcoming?.id === a.id && currentAppt?.id !== a.id
                ? TODAY_APPT_ROW_NEXT_LABEL
                : undefined;
          return (
            <article key={a.id} className={rowClass} aria-label={rowLabel}>
              <div className="clinic-list-card__main">
                {rowLabel ? <p className="clinic-today-appt__row-label">{rowLabel}</p> : null}
                <p className="clinic-today-appt__time">{a.time.trim()}</p>
                <p
                  className={
                    a.patId === "0"
                      ? "clinic-today-appt__patient clinic-today-appt__patient--muted"
                      : "clinic-today-appt__patient"
                  }
                >
                  {dashboardPatientHeadline(a)}
                  {a.patId !== "0" && dashboardPatientChart(a) !== null ? (
                    <span className="clinic-today-appt__meta"> · {dashboardPatientChart(a)}</span>
                  ) : null}
                </p>
                <p className="clinic-today-appt__meta">{visitMetaLine(a, doctorLabels, procedureMaps, roomMap)}</p>
                <div className="clinic-today-appt__badges">
                  <Badge variant={statusBadgeVariant(a.status)} semanticLabel={patientApptStatusSemanticLabel(a.status)}>
                    {statusLabel(a.status)}
                  </Badge>
                  {a.hasComment ? <span className="app-badge">Note hidden</span> : null}
                  {a.missed ? (
                    <Badge variant="danger" semanticLabel="Missed appointment">
                      Missed
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="clinic-list-card__actions">
                {a.patId !== "0" && onOpenPatient ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="compact"
                    className="ui-focusable"
                    onClick={() => openPatientFromAppt(a)}
                  >
                    {TODAY_OPEN_PATIENT}
                  </Button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    );
  })();

  const nextCardBody: ReactNode = (() => {
    if (!base || bridgePhase === "offline") {
      return (
        <p className="clinic-today-readonly-state" role="status">
          {TODAY_NEXT_OFFLINE}
        </p>
      );
    }
    if (bridgePhase === "checking") {
      return (
        <p className="clinic-today-readonly-state" role="status">
          {CLINIC_SERVICE_CHECKING}
        </p>
      );
    }
    if (loading) {
      return (
        <p className="clinic-today-readonly-state" role="status" aria-busy="true">
          {TODAY_NEXT_LOADING}
        </p>
      );
    }
    if (error) {
      return <p className="clinic-today-readonly-state">{TODAY_SCHEDULE_UNAVAILABLE}</p>;
    }
    if (sorted.length === 0) {
      return (
        <ClinicEmptyState title={TODAY_EMPTY_TITLE} body={TODAY_NEXT_NO_UPCOMING} actions={emptyStateActions} />
      );
    }
    if (!nextUpcoming) {
      return <p className="clinic-today-readonly-state">{TODAY_NEXT_NO_UPCOMING}</p>;
    }
    return (
      <div className="clinic-today-now__highlight">
        <p className="clinic-today-now__label">Next up</p>
        <p className="clinic-today-now__time">{nextUpcoming.time.trim()}</p>
        <p
          className={
            nextUpcoming.patId === "0"
              ? "clinic-today-now__patient clinic-today-appt__patient--muted"
              : "clinic-today-now__patient"
          }
        >
          {dashboardPatientHeadline(nextUpcoming)}
          {nextUpcoming.patId !== "0" && dashboardPatientChart(nextUpcoming) !== null ? (
            <span className="clinic-today-appt__meta"> · {dashboardPatientChart(nextUpcoming)}</span>
          ) : null}
        </p>
        <p className="clinic-today-now__detail">
          {visitMetaLine(nextUpcoming, doctorLabels, procedureMaps, roomMap)} · {statusLabel(nextUpcoming.status)}
        </p>
        <div className="clinic-today-appt__badges">
          {nextUpcoming.hasComment ? <span className="app-badge">Note hidden</span> : null}
          {nextUpcoming.missed ? (
            <Badge variant="danger" semanticLabel="Missed appointment">
              Missed
            </Badge>
          ) : null}
        </div>
        <div className="clinic-today-now__actions">
          {nextUpcoming.patId !== "0" && onOpenPatient ? (
            <Button
              type="button"
              variant="primary"
              className="ui-focusable"
              onClick={() => openPatientFromAppt(nextUpcoming)}
            >
              {TODAY_OPEN_PATIENT}
            </Button>
          ) : (
            <Button type="button" variant="secondary" className="ui-focusable" onClick={() => onOpenModule("patients")}>
              {TODAY_SEARCH_PATIENT}
            </Button>
          )}
          <Button type="button" variant="secondary" className="ui-focusable" onClick={() => onOpenModule("schedule")}>
            {TODAY_OPEN_SCHEDULE}
          </Button>
        </div>
      </div>
    );
  })();

  const appointmentsHeaderActions = (
    <>
      {canLoad && !loading && !error ? (
        <span className="clinic-today-appt-count">{sorted.length} today</span>
      ) : null}
      {canLoad ? (
        <Button
          type="button"
          variant="secondary"
          size="compact"
          className="ui-focusable"
          disabled={loading}
          onClick={refreshToday}
        >
          {TODAY_REFRESH}
        </Button>
      ) : null}
    </>
  );

  return (
    <ClinicPage className="clinic-today-page" testId="today-page">
      <ClinicPageHero
        title={moduleTitle}
        subtitle={TODAY_HERO_SUBTITLE}
        meta={
          <>
            <p className="clinic-today-hero__date">{formatTodayLine()}</p>
            <div className="clinic-today-hero__chips">
              <span className={canLoad ? "clinic-chip clinic-chip--active" : "clinic-chip"}>{heroServiceChip}</span>
              {mirrorStale ? (
                <span className="clinic-chip clinic-today-hero__chip--warn">{MIRROR_STALE_BANNER_LABEL}</span>
              ) : null}
              {writeModeMetric.label === WRITE_MODE_CHIP_ENABLED ? (
                <span className="clinic-chip clinic-today-hero__chip--warn">{WRITE_MODE_CHIP_ENABLED}</span>
              ) : null}
            </div>
          </>
        }
      />

      <div className="clinic-stat-grid clinic-stat-grid--five" role="region" aria-label="Today command center metrics">
        <ClinicStatCard
          label={TODAY_APPOINTMENTS_TODAY_LABEL}
          value={appointmentsMetricValue}
          hint={statusMixLine ? `${statusMixLine} · ${TODAY_METRIC_ON_SCHEDULE}` : appointmentsMetricHint}
          tone="teal"
        />
        <ClinicStatCard
          label={TODAY_METRIC_NEXT_LABEL}
          value={nextMetricValue}
          hint={nextMetricHint}
          tone={nextMetricTone}
        />
        <ClinicStatCard
          label={TODAY_METRIC_SCHEDULE_LABEL}
          value={scheduleMetricShort}
          hint={scheduleReadinessLine}
          tone={scheduleMetricTone}
        />
        <ClinicStatCard
          label={TODAY_STATUS_MIRROR_TITLE}
          value={mirrorFreshness.label}
          hint={mirrorFreshness.body}
          tone={mapMirrorFreshnessToStatTone(mirrorFreshness.tone)}
        />
        <ClinicStatCard
          label={FRONT_DESK_OVERVIEW_WRITE_MODE_LABEL}
          value={writeModeMetric.label}
          hint={
            writeCapability
              ? undefined
              : FRONT_DESK_OVERVIEW_WRITE_MODE_UNKNOWN
          }
          tone={writeModeMetric.tone}
        />
      </div>

      <div className="clinic-command-grid">
        <div className="clinic-command-grid__primary">
          <ClinicPanel
            title="Today&apos;s appointments"
            headerActions={appointmentsHeaderActions}
            testId="today-appointments-panel"
          >
            {mirrorStale ? (
              <p className="clinic-today-panel-note clinic-today-panel-note--advisory" role="note">
                {TODAY_MIRROR_STALE_ADVISORY}
              </p>
            ) : null}
            <p className="clinic-today-panel-note">{TODAY_PRIVACY_LEDE}</p>
            {primaryBody}
          </ClinicPanel>
        </div>

        <aside className="clinic-command-grid__aside" aria-label="Status, next visit, and shortcuts">
          <ClinicPanel title={TODAY_NOW_CARD_TITLE} testId="today-now-panel">
            {nextCardBody}
            {selectedPatientId ? (
              <div className="clinic-today-selected-patient">
                <p className="clinic-today-selected-patient__name">
                  {selectedPatientHeadline(selectedPatientId, selectedPatientDisplayName)}
                </p>
                {selectedPatientChartNumber ? (
                  <p className="clinic-today-selected-patient__chart">Chart {selectedPatientChartNumber}</p>
                ) : (
                  <p className="clinic-today-selected-patient__chart">Record {selectedPatientId}</p>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  className="ui-focusable"
                  onClick={() => onOpenModule("patients")}
                >
                  {TODAY_SELECTED_PATIENT_OPEN}
                </Button>
              </div>
            ) : null}
          </ClinicPanel>

          <ClinicPanel title={CLINIC_AT_A_GLANCE_TITLE}>
            <ClinicStatusGrid aria-label={CLINIC_AT_A_GLANCE_TITLE} items={statusGridItems} />
          </ClinicPanel>

          <ClinicPanel title="Quick actions">
            <p className="clinic-today-panel-note">{TODAY_QUICK_ACTIONS_LEDE}</p>
            <div className="clinic-today-quick-actions">
              {recentPatients.length > 0 && onRecentPatientSelect ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="ui-focusable"
                  onClick={() => onRecentPatientSelect(recentPatients[0]!)}
                >
                  {TODAY_REOPEN_RECENT}
                </Button>
              ) : null}
              {selectedPatientId ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="ui-focusable"
                  onClick={() => onOpenModule("patients")}
                >
                  {TODAY_OPEN_PATIENT_APPOINTMENTS}
                </Button>
              ) : null}
              <Button type="button" variant="primary" className="ui-focusable" onClick={() => onOpenModule("patients")}>
                {TODAY_SEARCH_PATIENT}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="ui-focusable"
                disabled={!canLoad}
                onClick={openScheduleToday}
              >
                {TODAY_OPEN_SCHEDULE}
              </Button>
              <Button type="button" variant="secondary" className="ui-focusable" onClick={() => onOpenModule("settings")}>
                {TODAY_OPEN_SETTINGS}
              </Button>
            </div>
          </ClinicPanel>

          <ClinicPanel title="Pilot notes" className="clinic-today-panel--compact">
            <div className="clinic-today-pilot-notes">
              <p>{TODAY_REMINDERS_PILOT_UNAVAILABLE}</p>
              <p>{TODAY_PILOT_READINESS_HINT}</p>
              <p>{TODAY_REMINDERS_FOOTNOTE}</p>
            </div>
          </ClinicPanel>

          {import.meta.env.DEV ? (
            <>
              <LegacyCatalogPanel bridgeBaseUrl={bridgeBaseUrl} bridgePhase={bridgePhase} />
              <FixtureConnectionPanel
                bridgeBaseUrl={bridgeBaseUrl}
                bridgePhase={bridgePhase}
                className="app-fixture-panel--deemphasized"
              />
            </>
          ) : null}
        </aside>
      </div>
    </ClinicPage>
  );
}
