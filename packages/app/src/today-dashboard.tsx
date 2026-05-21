import { createBridgeClient } from "@microdent/bridge-client";
import type { BridgeDevStatusResponse, MirrorStatusResponse, ScheduleAppointmentItem } from "@microdent/contracts";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState } from "@microdent/ui";
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
import { resolveFrontDeskOverview } from "./settings-status.js";
import type { ProcedureReferenceMaps } from "./procedure-reference.js";
import { useDoctorLabels } from "./useDoctorLabels.js";
import { useProcedureReference } from "./useProcedureReference.js";
import {
  CLINIC_AT_A_GLANCE_TITLE,
  CLINIC_SERVICE_CHECKING,
  CLINIC_SERVICE_CONNECT_TODAY,
  FRONT_DESK_OVERVIEW_OPEN_SETTINGS,
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
  TODAY_STATUS_MIX_UNAVAILABLE,
  TODAY_STATUS_MIRROR_ACTIVE,
  TODAY_STATUS_MIRROR_FALLBACK,
  TODAY_STATUS_MIRROR_OFFLINE,
  TODAY_STATUS_MIRROR_STALE,
  TODAY_STATUS_MIRROR_TITLE,
  TODAY_STATUS_MIRROR_UNKNOWN,
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

function selectedPatientHeadline(
  patientId: string,
  displayName?: string | null,
): string {
  const trimmed = displayName?.trim();
  if (trimmed && trimmed.length > 0) return trimmed;
  return `Patient ID ${patientId}`;
}

export function DashboardHome({
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

  const countCardValue: ReactNode = (() => {
    if (!base || bridgePhase === "offline") {
      return <span className="app-dashboard-status__value app-dashboard-status__value--muted">—</span>;
    }
    if (bridgePhase === "checking" || loading) {
      return <span className="app-dashboard-status__value app-dashboard-status__value--muted">…</span>;
    }
    if (error) {
      return <span className="app-dashboard-status__value app-dashboard-status__value--muted">—</span>;
    }
    return (
      <span className="app-dashboard-status__value" role="status">
        {sorted.length}
      </span>
    );
  })();

  const countCardHint: ReactNode = (() => {
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

  const primaryBody: ReactNode = (() => {
    if (!base || bridgePhase === "offline") {
      return (
        <div className="app-dashboard-sched__empty-wrap">
          <EmptyState
            className="ui-empty--start app-dashboard-sched__empty-state"
            title="Clinic service offline"
            description={CLINIC_SERVICE_CONNECT_TODAY}
          />
          <div className="app-dashboard-cta-row app-dashboard-cta-row--empty">
            <Button
              type="button"
              variant="secondary"
              className="ui-focusable app-dashboard-cta-row__secondary"
              onClick={() => onOpenModule("settings")}
            >
              {TODAY_OPEN_SETTINGS}
            </Button>
          </div>
        </div>
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
        <p className="app-readonly-state app-readonly-state--loading" role="status" aria-live="polite" aria-busy="true">
          {TODAY_LOADING}
        </p>
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
        <div className="app-dashboard-sched__empty-wrap">
          <EmptyState
            className="ui-empty--start app-dashboard-sched__empty-state"
            title={TODAY_EMPTY_TITLE}
            description={TODAY_EMPTY_DESCRIPTION}
          />
          <div className="app-dashboard-cta-row app-dashboard-cta-row--empty">
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
        </div>
      );
    }
    return (
      <ul className="app-appt-list" aria-label="Today’s appointments from the clinic copy">
        {sorted.map((a) => {
          const rowClass = [
            "app-appt-list__row",
            currentAppt?.id === a.id ? "app-appt-list__row--current" : "",
            nextUpcoming?.id === a.id && currentAppt?.id !== a.id ? "app-appt-list__row--next" : "",
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
          <li key={a.id} className={rowClass} aria-label={rowLabel}>
            <span className="app-appt-list__time">{a.time.trim()}</span>
            <div className="app-appt-list__main">
              <span
                className={
                  a.patId === "0"
                    ? "app-appt-list__patient app-appt-list__patient--muted"
                    : "app-appt-list__patient"
                }
              >
                <span className="app-appt-list__patient-name">{dashboardPatientHeadline(a)}</span>
                {a.patId !== "0" && dashboardPatientChart(a) !== null ? (
                  <span className="app-appt-list__patient-chart"> · {dashboardPatientChart(a)}</span>
                ) : null}
              </span>
              <span className="app-appt-list__visit">{visitMetaLine(a, doctorLabels, procedureMaps, roomMap)}</span>
              <div className="app-appt-list__extras">
                {a.hasComment ? <span className="app-appt-list__pill">Note hidden</span> : null}
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
                    className="ui-focusable app-appt-list__open-patient"
                    onClick={() => openPatientFromAppt(a)}
                  >
                    {TODAY_OPEN_PATIENT}
                  </Button>
                ) : null}
              </div>
            </div>
            <Badge variant={statusBadgeVariant(a.status)} semanticLabel={patientApptStatusSemanticLabel(a.status)}>
              {statusLabel(a.status)}
            </Badge>
          </li>
          );
        })}
      </ul>
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
        <p className="app-next-patient__hint" role="status" aria-busy="true">
          {TODAY_NEXT_LOADING}
        </p>
      );
    }
    if (error) {
      return <p className="app-next-patient__hint">{TODAY_SCHEDULE_UNAVAILABLE}</p>;
    }
    if (sorted.length === 0) {
      return (
        <>
          <p className="app-next-patient__hint">{TODAY_EMPTY_TITLE}</p>
          <div className="app-dashboard-cta-row">
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
        </>
      );
    }
    if (!nextUpcoming) {
      return <p className="app-next-patient__hint">{TODAY_NEXT_NO_UPCOMING}</p>;
    }
    return (
      <>
        <p className="app-next-patient__time">{nextUpcoming.time.trim()}</p>
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
      </>
    );
  })();

  return (
    <div className="app-dashboard">
      <p className="app-dashboard__kicker">
        <span className="app-dashboard__date">{formatTodayLine()}</span>
      </p>

      <div className="app-dashboard__layout">
        <div className="app-dashboard__primary">
          <Card>
            <CardHeader>
              <div className="app-dashboard-sched__head">
                <p className="ui-card__title app-card-title-lg">Today&apos;s appointments</p>
                {canLoad ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="compact"
                    className="ui-focusable app-dashboard-sched__refresh"
                    disabled={loading}
                    onClick={refreshToday}
                  >
                    {TODAY_REFRESH}
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardBody>
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
            </CardBody>
          </Card>
        </div>

        <aside className="app-dashboard__aside" aria-label="Status, next visit, and shortcuts">
          <div className="app-dashboard-status-strip">
            <Card className="app-dashboard-status-card">
              <CardHeader>
                <p className="ui-card__title app-card-title-lg">{TODAY_STATUS_COUNT_TITLE}</p>
              </CardHeader>
              <CardBody>
                {countCardValue}
                <p className="app-dashboard-status__hint">{countCardHint}</p>
                {statusMixLine ? (
                  <p className="app-dashboard-status__mix" role="status">
                    {statusMixLine}
                  </p>
                ) : canLoad && (loading || error) ? (
                  <p className="app-dashboard-status__mix app-dashboard-status__mix--muted" role="status">
                    {TODAY_STATUS_MIX_UNAVAILABLE}
                  </p>
                ) : null}
              </CardBody>
            </Card>
            <Card className={`app-dashboard-status-card app-dashboard-status-card--${mirrorFreshness.tone}`}>
              <CardHeader>
                <p className="ui-card__title app-card-title-lg">{TODAY_STATUS_MIRROR_TITLE}</p>
              </CardHeader>
              <CardBody>
                <p className="app-dashboard-status__label">{mirrorFreshness.label}</p>
                <p className="app-dashboard-status__hint">{mirrorFreshness.body}</p>
              </CardBody>
            </Card>
          </div>

          <Card className="app-dashboard-clinic-overview">
            <CardHeader>
              <p className="ui-card__title app-card-title-lg">{CLINIC_AT_A_GLANCE_TITLE}</p>
            </CardHeader>
            <CardBody>
              <dl className="app-dashboard-clinic-overview__list">
                {clinicOverview.map((row) => (
                  <div
                    key={row.key}
                    className={`app-dashboard-clinic-overview__row app-dashboard-clinic-overview__row--${row.tone}`}
                  >
                    <dt className="app-dashboard-clinic-overview__label">{row.label}</dt>
                    <dd className="app-dashboard-clinic-overview__value">{row.value}</dd>
                  </div>
                ))}
              </dl>
              {canLoad ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="compact"
                  className="ui-focusable app-dashboard-clinic-overview__settings-link"
                  onClick={() => onOpenModule("settings")}
                >
                  {FRONT_DESK_OVERVIEW_OPEN_SETTINGS}
                </Button>
              ) : null}
            </CardBody>
          </Card>

          <Card className="app-next-patient-card">
            <CardHeader>
              <p className="ui-card__title app-card-title-lg">Next appointment</p>
            </CardHeader>
            <CardBody>{nextCardBody}</CardBody>
          </Card>

          {selectedPatientId ? (
            <Card className="app-dashboard-selected-patient">
              <CardHeader>
                <p className="ui-card__title app-card-title-lg">{TODAY_SELECTED_PATIENT_TITLE}</p>
              </CardHeader>
              <CardBody>
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
                  className="ui-focusable app-dashboard-selected-patient__btn"
                  onClick={() => onOpenModule("patients")}
                >
                  {TODAY_SELECTED_PATIENT_OPEN}
                </Button>
              </CardBody>
            </Card>
          ) : null}

          {recentPatients.length > 0 && onRecentPatientSelect ? (
            <Card className="app-dashboard-recent-patients">
              <CardHeader>
                <p className="ui-card__title app-card-title-lg">{TODAY_RECENT_PATIENTS_TITLE}</p>
              </CardHeader>
              <CardBody>
                <ul className="app-dashboard-recent-patients__list" aria-label={TODAY_RECENT_PATIENTS_TITLE}>
                  {recentPatients.slice(0, 5).map((entry) => (
                    <li key={entry.patientId}>
                      <button
                        type="button"
                        className="app-dashboard-recent-patients__btn ui-focusable"
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
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <p className="ui-card__title app-card-title-lg">Quick actions</p>
            </CardHeader>
            <CardBody>
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
                <Button
                  type="button"
                  variant="ghost"
                  className="ui-focusable app-quick-actions__btn"
                  disabled
                  title={TAB_UNAVAILABLE_TITLE}
                >
                  Record payment
                </Button>
              </div>
              <p className="app-quick-actions__pilot-hint" role="note">
                {TODAY_PILOT_READINESS_HINT}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <p className="ui-card__title app-card-title-lg">Reminders</p>
            </CardHeader>
            <CardBody>
              <p className="app-reminder-list__empty" role="status">
                {TODAY_REMINDERS_PILOT_UNAVAILABLE}
              </p>
            </CardBody>
          </Card>

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
