import { createBridgeClient } from "@microdent/bridge-client";
import type { BridgeDevStatusResponse, MirrorStatusResponse, ScheduleAppointmentItem } from "@microdent/contracts";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge, Button } from "@microdent/ui";
import { AppEmptyPanel, AppLoadingSkeleton } from "./app-empty-panel.js";
import { AppMetricTile, type AppMetricTileTone } from "./app-metric-tile.js";
import { AppStatusGrid, type AppStatusGridItem, type AppStatusGridTone } from "./app-status-grid.js";
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
  FRONT_DESK_OVERVIEW_BRIDGE_LABEL,
  FRONT_DESK_OVERVIEW_BRIDGE_OFFLINE,
  FRONT_DESK_OVERVIEW_MIRROR_LABEL,
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
  TAB_UNAVAILABLE_TITLE,
  TODAY_APPT_ROW_CURRENT_LABEL,
  TODAY_APPT_ROW_NEXT_LABEL,
  TODAY_EMPTY_DESCRIPTION,
  TODAY_EMPTY_TITLE,
  TODAY_LOADING,
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
  TODAY_RECENT_PATIENTS_TITLE,
  TODAY_REOPEN_RECENT,
  TODAY_REMINDERS_PILOT_UNAVAILABLE,
  TODAY_SCHEDULE_UNAVAILABLE,
  TODAY_SEARCH_PATIENT,
  TODAY_SELECTED_PATIENT_OPEN,
  TODAY_SELECTED_PATIENT_TITLE,
  TODAY_STATUS_COUNT_TITLE,
  TODAY_METRIC_ON_SCHEDULE,
  TODAY_METRIC_SCHEDULE_LABEL,
  TODAY_METRIC_NEXT_LABEL,
  TODAY_STATUS_MIX_UNAVAILABLE,
  TODAY_STATUS_MIRROR_ACTIVE,
  TODAY_STATUS_MIRROR_FALLBACK,
  TODAY_STATUS_MIRROR_OFFLINE,
  TODAY_STATUS_MIRROR_STALE,
  TODAY_STATUS_MIRROR_TITLE,
  TODAY_STATUS_MIRROR_UNKNOWN,
  TODAY_OPEN_SCHEDULE_FOR_TODAY,
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

function mapOverviewTone(tone: SettingsStatusTone): AppStatusGridTone {
  return tone;
}

function mapMirrorFreshnessToMetricTone(tone: MirrorFreshness["tone"]): AppMetricTileTone {
  if (tone === "warning") return "warning";
  if (tone === "info") return "info";
  return "neutral";
}

function mapMirrorFreshnessToGridTone(tone: MirrorFreshness["tone"]): AppStatusGridTone {
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
): AppStatusGridTone {
  if (!hasBase || bridgePhase === "offline") return "neutral";
  if (bridgePhase === "checking" || loading) return "neutral";
  if (error) return "warn";
  if (mirrorStale) return "warn";
  return "ok";
}

function scheduleReadinessMetricTone(
  hasBase: boolean,
  bridgePhase: BridgeHealthPhase,
  loading: boolean,
  error: string | null,
  mirrorStale: boolean,
): AppMetricTileTone {
  const gridTone = scheduleReadinessGridTone(hasBase, bridgePhase, loading, error, mirrorStale);
  if (gridTone === "ok") return "success";
  if (gridTone === "warn") return "warning";
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
): { label: string; tone: AppMetricTileTone } {
  if (!writeCapability) {
    return { label: FRONT_DESK_OVERVIEW_WRITE_MODE_UNKNOWN, tone: "neutral" };
  }
  switch (writeCapability.writeMode) {
    case "disabled":
      return { label: WRITE_MODE_CHIP_DISABLED, tone: "success" };
    case "dry-run":
      return { label: WRITE_MODE_CHIP_DRY_RUN, tone: "warning" };
    case "enabled":
      return { label: WRITE_MODE_CHIP_ENABLED, tone: "danger" };
    default:
      return { label: FRONT_DESK_OVERVIEW_WRITE_MODE_UNKNOWN, tone: "neutral" };
  }
}

function resolveSandboxMetric(
  sandboxWritePilot: boolean,
  writeCapability: BridgeDevStatusResponse | null,
): { label: string; tone: AppMetricTileTone } {
  if (!sandboxWritePilot) {
    return { label: SETTINGS_SANDBOX_PILOT_OFF, tone: "neutral" };
  }
  if (writeCapability?.writableSandbox && writeCapability.writesPermitted) {
    return { label: SETTINGS_SANDBOX_PILOT_ON, tone: "success" };
  }
  return { label: SETTINGS_SANDBOX_PILOT_ON, tone: "warning" };
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
  moduleDescription,
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

  const sandboxMetric = useMemo(
    () => resolveSandboxMetric(sandboxWritePilot, writeCapability),
    [sandboxWritePilot, writeCapability],
  );

  const scheduleMetricShort = useMemo(
    () => scheduleReadinessShort(Boolean(base), bridgePhase, loading, error, mirrorStale),
    [base, bridgePhase, loading, error, mirrorStale],
  );

  const scheduleMetricTone = useMemo(
    () => scheduleReadinessMetricTone(Boolean(base), bridgePhase, loading, error, mirrorStale),
    [base, bridgePhase, loading, error, mirrorStale],
  );

  const statusGridItems = useMemo((): AppStatusGridItem[] => {
    const overviewByKey = new Map(clinicOverview.map((row) => [row.key, row]));
    const bridge = overviewByKey.get("bridge");
    const mirrorRow = overviewByKey.get("mirror");
    const writeRow = overviewByKey.get("write-mode");
    const backupRow = overviewByKey.get("backup");
    const sandboxRow = overviewByKey.get("sandbox-pilot");
    const backupFallback = resolveBackupConfiguredStatus(writeCapability);

    const rows: AppStatusGridItem[] = [
      {
        key: "clinic-service",
        label: FRONT_DESK_OVERVIEW_BRIDGE_LABEL,
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
        key: "data-freshness",
        label: FRONT_DESK_OVERVIEW_MIRROR_LABEL,
        value: mirrorRow?.value ?? mirrorFreshness.body,
        tone: mapOverviewTone(mirrorRow?.tone ?? "neutral"),
      },
      {
        key: "schedule-readiness",
        label: "Schedule readiness",
        value: scheduleReadinessLine,
        tone: scheduleReadinessGridTone(Boolean(base), bridgePhase, loading, error, mirrorStale),
      },
      {
        key: "write-mode",
        label: FRONT_DESK_OVERVIEW_WRITE_MODE_LABEL,
        value: writeRow?.value ?? writeModeMetric.label,
        tone: mapOverviewTone(writeRow?.tone ?? "neutral"),
      },
      {
        key: "sandbox",
        label: FRONT_DESK_OVERVIEW_SANDBOX_PILOT_LABEL,
        value: sandboxRow?.value ?? sandboxMetric.label,
        tone: mapOverviewTone(sandboxRow?.tone ?? "neutral"),
      },
      {
        key: "backup",
        label: FRONT_DESK_OVERVIEW_BACKUP_LABEL,
        value: backupRow?.value ?? backupFallback.label,
        tone: mapOverviewTone(backupRow?.tone ?? backupFallback.tone),
      },
      {
        key: "mirror",
        label: "Mirror",
        value: mirrorFreshness.label,
        tone: mapMirrorFreshnessToGridTone(mirrorFreshness.tone),
      },
    ];

    return rows;
  }, [
    base,
    bridgePhase,
    canLoad,
    clinicOverview,
    error,
    loading,
    mirrorFreshness.body,
    mirrorFreshness.label,
    mirrorFreshness.tone,
    mirrorStale,
    onOpenModule,
    sandboxMetric.label,
    scheduleReadinessLine,
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
    return TODAY_METRIC_ON_SCHEDULE;
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

  const nextMetricTone: AppMetricTileTone = (() => {
    if (!base || bridgePhase === "offline" || bridgePhase === "checking" || loading || error) {
      return "neutral";
    }
    if (!nextUpcoming) return "neutral";
    return "info";
  })();

  const primaryBody: ReactNode = (() => {
    if (!base || bridgePhase === "offline") {
      return (
        <AppEmptyPanel
          className="app-dashboard-sched__empty-wrap"
          variant="offline"
          title={CLINIC_SERVICE_OFFLINE_TITLE}
          body={CLINIC_SERVICE_CONNECT_TODAY}
          actions={
            <Button
              type="button"
              variant="secondary"
              className="ui-focusable app-dashboard-cta-row__secondary"
              onClick={() => onOpenModule("settings")}
            >
              {TODAY_OPEN_SETTINGS}
            </Button>
          }
        />
      );
    }
    if (bridgePhase === "checking") {
      return (
        <p className="app-readonly-state app-readonly-state--checking" role="status">
          {CLINIC_SERVICE_CHECKING}
        </p>
      );
    }
    if (loading) {
      return (
        <AppLoadingSkeleton
          className="app-readonly-state app-readonly-state--loading app-dashboard-sched__loading"
          label={TODAY_LOADING}
        />
      );
    }
    if (error) {
      return (
        <div className="app-readonly-state app-readonly-state--error" role="alert">
          <p>{TODAY_SCHEDULE_UNAVAILABLE}</p>
          <Button type="button" variant="secondary" className="ui-focusable" onClick={refreshToday}>
            {READONLY_STATE_RETRY}
          </Button>
        </div>
      );
    }
    if (sorted.length === 0) {
      return (
        <AppEmptyPanel
          className="app-dashboard-sched__empty-wrap app-dashboard-sched__empty-wrap--rich"
          variant="empty-schedule"
          title={TODAY_EMPTY_TITLE}
          body={TODAY_EMPTY_DESCRIPTION}
          actions={
            <div className="app-dashboard-cta-row app-dashboard-cta-row--empty">
              <Button
                type="button"
                variant="primary"
                className="ui-focusable app-dashboard-cta-row__primary"
                onClick={() => onOpenModule("patients")}
              >
                {TODAY_SEARCH_PATIENT}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="ui-focusable app-dashboard-cta-row__secondary"
                onClick={() => onOpenModule("schedule")}
              >
                {TODAY_OPEN_SCHEDULE}
              </Button>
            </div>
          }
        />
      );
    }
    return (
      <div className="app-data-list app-data-list--today" aria-label="Today’s appointments from the clinic copy">
        <div className="app-data-list__header app-data-list__header--today">
          <span>Time</span>
          <span>Patient</span>
          <span>Visit</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        {sorted.map((a) => {
          const rowClass = [
            "app-data-row",
            `app-data-row--status-${statusBadgeVariant(a.status)}`,
            currentAppt?.id === a.id ? "app-data-row--current" : "",
            nextUpcoming?.id === a.id && currentAppt?.id !== a.id ? "app-data-row--next" : "",
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
            <div
              key={a.id}
              className={rowClass}
              aria-label={rowLabel}
            >
              <span className="app-data-row__time">{a.time.trim()}</span>
              <span
                className={
                  a.patId === "0" ? "app-data-row__primary app-data-row__primary--muted" : "app-data-row__primary"
                }
              >
                {dashboardPatientHeadline(a)}
                {a.patId !== "0" && dashboardPatientChart(a) !== null ? (
                  <span className="app-data-row__meta"> · {dashboardPatientChart(a)}</span>
                ) : null}
              </span>
              <span className="app-data-row__meta">{visitMetaLine(a, doctorLabels, procedureMaps, roomMap)}</span>
              <span className="app-data-row__badge">
                <Badge variant={statusBadgeVariant(a.status)} semanticLabel={patientApptStatusSemanticLabel(a.status)}>
                  {statusLabel(a.status)}
                </Badge>
              </span>
              <span className="app-data-row__actions">
                {a.hasComment ? <span className="app-badge">Note hidden</span> : null}
                {a.missed ? (
                  <Badge variant="danger" semanticLabel="Missed appointment">
                    Missed
                  </Badge>
                ) : null}
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
              </span>
            </div>
          );
        })}
      </div>
    );
  })();

  const nextCardBody: ReactNode = (() => {
    if (!base || bridgePhase === "offline") {
      return (
        <p className="app-next-patient__hint app-readonly-state app-readonly-state--inline" role="status">
          {TODAY_NEXT_OFFLINE}
        </p>
      );
    }
    if (bridgePhase === "checking") {
      return (
        <p className="app-next-patient__hint app-readonly-state app-readonly-state--inline" role="status">
          {CLINIC_SERVICE_CHECKING}
        </p>
      );
    }
    if (loading) {
      return (
        <AppLoadingSkeleton
          className="app-next-patient__loading"
          lines={2}
          label={TODAY_NEXT_LOADING}
        />
      );
    }
    if (error) {
      return <p className="app-next-patient__hint">{TODAY_SCHEDULE_UNAVAILABLE}</p>;
    }
    if (sorted.length === 0) {
      return (
        <AppEmptyPanel
          className="app-next-patient__empty"
          variant="empty-schedule"
          title={TODAY_EMPTY_TITLE}
          body={TODAY_NEXT_NO_UPCOMING}
        />
      );
    }
    if (!nextUpcoming) {
      return <p className="app-next-patient__hint">{TODAY_NEXT_NO_UPCOMING}</p>;
    }
    return (
      <div className="app-ops-highlight">
        <p className="app-ops-highlight__label">Next up</p>
        <p className="app-next-patient__time app-ops-highlight__value">{nextUpcoming.time.trim()}</p>
        <p
          className={
            nextUpcoming.patId === "0"
              ? "app-next-patient__patid app-next-patient__patid--muted"
              : "app-next-patient__patid"
          }
        >
          <span className="app-next-patient__patid-name">{dashboardPatientHeadline(nextUpcoming)}</span>
          {nextUpcoming.patId !== "0" && dashboardPatientChart(nextUpcoming) !== null ? (
            <span className="app-next-patient__patid-chart"> · {dashboardPatientChart(nextUpcoming)}</span>
          ) : null}
        </p>
        <p className="app-next-patient__detail">
          {visitMetaLine(nextUpcoming, doctorLabels, procedureMaps, roomMap)} · {statusLabel(nextUpcoming.status)}
        </p>
        <div className="app-next-patient__badges">
          {nextUpcoming.hasComment ? <span className="app-appt-list__pill">Note hidden</span> : null}
          {nextUpcoming.missed ? (
            <Badge variant="danger" semanticLabel="Missed appointment">
              Missed
            </Badge>
          ) : null}
        </div>
        {nextUpcoming.patId !== "0" && onOpenPatient ? (
          <Button
            type="button"
            variant="primary"
            className="ui-focusable app-next-patient__btn"
            onClick={() => openPatientFromAppt(nextUpcoming)}
          >
            {TODAY_OPEN_PATIENT}
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="ui-focusable app-next-patient__btn"
            onClick={() => onOpenModule("patients")}
          >
            {TODAY_SEARCH_PATIENT}
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          className="ui-focusable app-next-patient__btn app-next-patient__btn--schedule"
          onClick={() => onOpenModule("schedule")}
        >
          {TODAY_OPEN_SCHEDULE}
        </Button>
      </div>
    );
  })();

  return (
    <div className="app-workspace-page app-dashboard">
      <header className="app-hero-band app-dashboard__hero">
        <div className="app-dashboard__hero-main">
          <h2 className="app-hero-band__title app-dashboard__hero-title">{moduleTitle}</h2>
          {moduleDescription ? <p className="app-dashboard__hero-meta">{moduleDescription}</p> : null}
        </div>
        <div className="app-dashboard__hero-aside">
          <p className="app-dashboard__date">{formatTodayLine()}</p>
          {canLoad ? (
            <Button
              type="button"
              variant="secondary"
              className="ui-focusable app-dashboard__hero-refresh"
              disabled={loading}
              onClick={refreshToday}
            >
              {TODAY_REFRESH}
            </Button>
          ) : null}
        </div>
      </header>

      <div
        className="app-metric-tile-grid app-dashboard__metrics"
        role="region"
        aria-label="Today command center metrics"
      >
        <AppMetricTile
          label={TODAY_STATUS_COUNT_TITLE}
          value={appointmentsMetricValue}
          hint={
            statusMixLine ? `${statusMixLine} · ${TODAY_METRIC_ON_SCHEDULE}` : appointmentsMetricHint
          }
          tone="emphasis"
        />
        <AppMetricTile label={TODAY_METRIC_NEXT_LABEL} value={nextMetricValue} hint={nextMetricHint} tone={nextMetricTone} />
        <AppMetricTile
          label={TODAY_METRIC_SCHEDULE_LABEL}
          value={scheduleMetricShort}
          hint={scheduleReadinessLine}
          tone={scheduleMetricTone}
        />
        <AppMetricTile
          label={TODAY_STATUS_MIRROR_TITLE}
          value={mirrorFreshness.label}
          hint={mirrorFreshness.body}
          tone={mapMirrorFreshnessToMetricTone(mirrorFreshness.tone)}
        />
        <AppMetricTile
          label={FRONT_DESK_OVERVIEW_WRITE_MODE_LABEL}
          value={writeModeMetric.label}
          tone={writeModeMetric.tone}
        />
        <AppMetricTile
          label={FRONT_DESK_OVERVIEW_SANDBOX_PILOT_LABEL}
          value={sandboxMetric.label}
          tone={sandboxMetric.tone}
        />
      </div>

      <div className="app-command-grid">
        <section className="app-board-panel" aria-label="Today’s appointments">
          <div className="app-board-panel__head">
            <h3 className="app-board-panel__title">Today&apos;s appointments</h3>
          </div>
          {mirrorStale ? (
            <p className="app-dashboard-sched__mirror-advisory" role="note">
              {TODAY_MIRROR_STALE_ADVISORY}
            </p>
          ) : null}
          <p className="app-dashboard-sched__privacy">{TODAY_PRIVACY_LEDE}</p>
          {primaryBody}
          {sorted.length > 0 ? (
            <div className="app-appt-list__footer app-dashboard-cta-row">
              <Button
                type="button"
                variant="primary"
                className="ui-focusable app-dashboard-cta-row__primary"
                onClick={() => onOpenModule("schedule")}
              >
                {TODAY_OPEN_SCHEDULE}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="ui-focusable app-dashboard-cta-row__secondary"
                onClick={() => onOpenModule("patients")}
              >
                {TODAY_SEARCH_PATIENT}
              </Button>
            </div>
          ) : null}
        </section>

        <aside className="app-ops-panel" aria-label="Status, next visit, and shortcuts">
          <div className="app-ops-panel__head">
            <h3 className="app-ops-panel__title">{TODAY_NOW_CARD_TITLE}</h3>
          </div>
          {nextCardBody}
          {selectedPatientId ? (
            <div className="app-dashboard-selected-patient app-dashboard-selected-patient--inline">
              <p className="app-dashboard-selected-patient__name">
                {selectedPatientHeadline(selectedPatientId, selectedPatientDisplayName)}
              </p>
              {selectedPatientChartNumber ? (
                <p className="app-dashboard-selected-patient__chart">Chart {selectedPatientChartNumber}</p>
              ) : (
                <p className="app-dashboard-selected-patient__chart">Record {selectedPatientId}</p>
              )}
              <Button
                type="button"
                variant="secondary"
                size="compact"
                className="ui-focusable app-dashboard-selected-patient__btn"
                onClick={() => onOpenModule("patients")}
              >
                {TODAY_SELECTED_PATIENT_OPEN}
              </Button>
            </div>
          ) : null}

          <div className="app-ops-panel__section app-dashboard__glance">
            <h4 className="app-ops-panel__title">{CLINIC_AT_A_GLANCE_TITLE}</h4>
            <AppStatusGrid aria-label={CLINIC_AT_A_GLANCE_TITLE} items={statusGridItems} />
          </div>

          {recentPatients.length > 0 && onRecentPatientSelect ? (
            <div className="app-ops-panel__section">
              <h4 className="app-ops-panel__title">{TODAY_RECENT_PATIENTS_TITLE}</h4>
              <ul className="app-recent-grid" aria-label={TODAY_RECENT_PATIENTS_TITLE}>
                {recentPatients.slice(0, 6).map((entry) => (
                  <li key={entry.patientId}>
                    <button
                      type="button"
                      className="app-recent-list__btn ui-focusable"
                      onClick={() => onRecentPatientSelect(entry)}
                    >
                      <span className="app-dashboard-recent-patients__name">{entry.displayName}</span>
                      {entry.chartNumber ? (
                        <span className="app-dashboard-recent-patients__chart">Chart {entry.chartNumber}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="app-ops-panel__section">
            <h4 className="app-ops-panel__title">Quick actions</h4>
            <p className="app-quick-actions__lede">{TODAY_QUICK_ACTIONS_LEDE}</p>
            <div className="app-quick-actions">
              {recentPatients.length > 0 && onRecentPatientSelect ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="ui-focusable app-quick-actions__btn"
                  onClick={() => onRecentPatientSelect(recentPatients[0]!)}
                >
                  {TODAY_REOPEN_RECENT}
                </Button>
              ) : null}
              {selectedPatientId ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="ui-focusable app-quick-actions__btn"
                  onClick={() => onOpenModule("patients")}
                >
                  {TODAY_OPEN_PATIENT_APPOINTMENTS}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="primary"
                className="ui-focusable app-quick-actions__btn"
                onClick={() => onOpenModule("patients")}
              >
                {TODAY_SEARCH_PATIENT}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="ui-focusable app-quick-actions__btn"
                disabled={!canLoad}
                onClick={openScheduleToday}
              >
                {TODAY_OPEN_SCHEDULE}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="ui-focusable app-quick-actions__btn"
                onClick={() => onOpenModule("settings")}
              >
                {TODAY_OPEN_SETTINGS}
              </Button>
            </div>
            <p className="app-quick-actions__pilot-hint" role="note">
              {TODAY_PILOT_READINESS_HINT}
            </p>
            <p className="app-dashboard__reminders-footnote" role="note">
              {TODAY_REMINDERS_FOOTNOTE}
            </p>
          </div>

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
    </div>
  );
}
