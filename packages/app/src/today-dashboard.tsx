import { createBridgeClient } from "@microdent/bridge-client";
import type { BridgeDevStatusResponse, MirrorStatusResponse, ScheduleAppointmentItem } from "@microdent/contracts";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge, Button, CommandCenter, EmptyState, PatientQuickCard, type ButtonVariant } from "@microdent/ui";
import { ClinicPage, ClinicPageHero } from "./clinic-page.js";
import type { AppSidebarModuleId } from "./app-nav-modules.js";
import type { SessionRecentPatient } from "./session-recent-patients.js";
import type { BridgeHealthPhase } from "./bridge-health.js";
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
import type { ProcedureReferenceMaps } from "./procedure-reference.js";
import { useDoctorLabels } from "./useDoctorLabels.js";
import { useProcedureReference } from "./useProcedureReference.js";
import {
  CLINIC_SERVICE_CHECKING,
  CLINIC_SERVICE_CONNECT_TODAY,
  CLINIC_SERVICE_OFFLINE_TITLE,
  READONLY_STATE_RETRY,
  SCHEDULE_LOAD_ERROR,
  TODAY_CONTINUE_EMPTY_HINT,
  TODAY_CONTINUE_WORKING_LABEL,
  TODAY_EMPTY_DESCRIPTION,
  TODAY_EMPTY_TITLE,
  TODAY_METRIC_ON_SCHEDULE,
  TODAY_MIRROR_STALE_ADVISORY,
  TODAY_NEXT_NO_UPCOMING,
  TODAY_OPEN_PATIENT,
  TODAY_OPEN_SCHEDULE,
  TODAY_REFRESH,
  TODAY_SCHEDULE_PANEL_TITLE,
  TODAY_SCHEDULE_UNAVAILABLE,
  TODAY_SEARCH_PATIENT,
} from "./read-only-ui-copy.js";
import {
  PostWriteLocalCopyRefreshNotice,
  createCleanPostWriteLocalCopyState,
  type PostWriteLocalCopyRefreshState,
} from "./post-write-local-copy.js";

/* ── helpers ─────────────────────────────────────────────────────────────── */

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function statusLabel(code: number): string {
  return patientApptStatusLabel(code);
}

function statusBadgeVariant(code: number): "neutral" | "success" | "warning" | "danger" | "info" {
  return patientApptStatusBadgeVariant(code);
}

function patientHeadline(appt: ScheduleAppointmentItem): string {
  if (appt.patId === "0") return "No patient id";
  return appt.patient?.displayName ?? `Patient ID ${appt.patId}`;
}

function patientChart(appt: ScheduleAppointmentItem): string | null {
  if (appt.patId === "0") return null;
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

function findNextUpcomingToday(sorted: ScheduleAppointmentItem[], now: Date): ScheduleAppointmentItem | null {
  const nowM = now.getHours() * 60 + now.getMinutes();
  for (const a of sorted) {
    const m = parseTimeToMinutes(a.time);
    if (m === null) continue;
    if (m >= nowM) return a;
  }
  return null;
}

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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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

/* ── types ───────────────────────────────────────────────────────────────── */

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
  postWriteLocalCopyRefresh?: PostWriteLocalCopyRefreshState;
  onOpenSettings?: () => void;
};

/* ── component ───────────────────────────────────────────────────────────── */

export function DashboardHome({
  moduleTitle = "Today",
  moduleDescription: _moduleDescription,
  onOpenModule,
  onOpenPatient,
  onOpenScheduleAtDate,
  bridgeBaseUrl,
  bridgePhase,
  fetchImpl,
  selectedPatientId: _selectedPatientId = null,
  selectedPatientDisplayName: _selectedPatientDisplayName = null,
  selectedPatientChartNumber: _selectedPatientChartNumber = null,
  recentPatients = [],
  onRecentPatientSelect,
  mirrorStatus = null,
  writeCapability: _writeCapability = null,
  sandboxWritePilot: _sandboxWritePilot = false,
  sessionRecentPatientCount: _sessionRecentPatientCount = 0,
  postWriteLocalCopyRefresh = createCleanPostWriteLocalCopyState(),
  onOpenSettings,
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

  const mirrorStale =
    bridgePhase === "connected" && mirrorStatus !== null && isMirrorImportStale(mirrorStatus, Date.now());

  const greeting = useMemo(() => getGreeting(), []);
  const todayLine = useMemo(() => formatTodayLine(), []);

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

  /* ── room fetch ──────────────────────────────────────────────────────── */
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

  /* ── today appointments fetch ────────────────────────────────────────── */
  const loadToday = useCallback(async () => {
    if (!canLoad) return;
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

  /* ── derived data ────────────────────────────────────────────────────── */
  const sorted = useMemo(() => [...appointments].sort(sortAppointments), [appointments]);
  const now = useMemo(() => new Date(), [sorted, loading, retryTick]);
  const currentAppt = useMemo(() => findCurrentToday(sorted, now), [sorted, now]);
  const nextUpcoming = useMemo(() => findNextUpcomingToday(sorted, now), [sorted, now]);

  const statusMixLine = useMemo(() => {
    if (!base || bridgePhase === "offline") return null;
    if (bridgePhase === "checking" || loading) return null;
    if (error || sorted.length === 0) return null;
    return formatAppointmentStatusMix(sorted);
  }, [base, bridgePhase, loading, error, sorted]);

  const scheduleSummaryLine = (() => {
    if (!canLoad || loading || error) return null;
    if (sorted.length === 0) return null;
    if (statusMixLine) {
      return `${statusMixLine} · ${TODAY_METRIC_ON_SCHEDULE}`;
    }
    return TODAY_METRIC_ON_SCHEDULE;
  })();

  /* ── next-appointment display values ─────────────────────────────────── */
  const nextApptTime = useMemo(() => {
    if (nextUpcoming) return nextUpcoming.time.trim();
    return "—";
  }, [nextUpcoming]);

  const nextApptPatient = useMemo(() => {
    if (nextUpcoming && nextUpcoming.patId !== "0") {
      return nextUpcoming.patient?.displayName ?? `Patient ID ${nextUpcoming.patId}`;
    }
    return "No upcoming";
  }, [nextUpcoming]);

  /* ── CommandCenter metrics & actions ─────────────────────────────────── */
  const commandMetrics = useMemo(() => {
    const items: { label: string; value: ReactNode }[] = [];
    if (canLoad && !loading && !error) {
      items.push({ label: "Patients today", value: sorted.length });
    }
    if (nextUpcoming) {
      items.push({
        label: "Next appointment",
        value: `${nextUpcoming.time.trim()} — ${patientHeadline(nextUpcoming)}`,
      });
    }
    return items;
  }, [canLoad, loading, error, sorted, nextUpcoming]);

  const commandActions = useMemo(() => {
    const items: Array<{ label: string; onClick?: () => void; variant?: ButtonVariant }> = [
      { label: TODAY_SEARCH_PATIENT, onClick: () => onOpenModule("patients"), variant: "primary" },
      { label: TODAY_OPEN_SCHEDULE, onClick: openScheduleToday, variant: "secondary" },
    ];
    if (recentPatients.length > 0 && onRecentPatientSelect) {
      items.push({
        label: `Continue: ${recentPatients[0].displayName}`,
        onClick: () => onRecentPatientSelect(recentPatients[0]),
        variant: "ghost",
      });
    }
    return items;
  }, [onOpenModule, openScheduleToday, recentPatients, onRecentPatientSelect]);

  /* ── empty / error states ────────────────────────────────────────────── */
  const emptyStateActions = (
    <>
      <Button variant="primary" onClick={() => onOpenModule("schedule")}>
        {TODAY_OPEN_SCHEDULE}
      </Button>
      <Button variant="secondary" onClick={() => onOpenModule("patients")}>
        {TODAY_SEARCH_PATIENT}
      </Button>
    </>
  );

  /* ── render body based on connection / loading state ─────────────────── */
  const renderBody = (): ReactNode => {
    // Offline
    if (!base || bridgePhase === "offline") {
      return (
        <EmptyState
          variant="offline"
          title={CLINIC_SERVICE_OFFLINE_TITLE}
          description={CLINIC_SERVICE_CONNECT_TODAY}
          actions={
            <Button variant="secondary" onClick={() => onOpenModule("settings")}>
              Open settings
            </Button>
          }
        />
      );
    }

    // Checking
    if (bridgePhase === "checking") {
      return <EmptyState variant="loading" title={CLINIC_SERVICE_CHECKING} description="" />;
    }

    // Loading
    if (loading) {
      return <EmptyState variant="loading" title="Loading today's schedule…" description="" />;
    }

    // Error
    if (error) {
      return (
        <EmptyState
          variant="error"
          title="Schedule unavailable"
          description={TODAY_SCHEDULE_UNAVAILABLE}
          actions={
            <Button variant="secondary" onClick={refreshToday}>
              {READONLY_STATE_RETRY}
            </Button>
          }
        />
      );
    }

    // Empty schedule
    if (sorted.length === 0) {
      return (
        <EmptyState
          variant="empty"
          title={TODAY_EMPTY_TITLE}
          description={TODAY_EMPTY_DESCRIPTION}
          actions={emptyStateActions}
        />
      );
    }

    // Appointment cards
    return (
      <div className="today-appt-list" aria-label="Today's appointments">
        {sorted.map((a) => {
          const isCurrent = currentAppt?.id === a.id;
          const isNext = nextUpcoming?.id === a.id && !isCurrent;
          const cardClass = [
            "today-appt-card",
            isCurrent ? "today-appt-card--current" : "",
            isNext ? "today-appt-card--next" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <article key={a.id} className={cardClass}>
              <div className="today-appt-card__main">
                {isCurrent && <span className="today-appt-card__tag">In progress</span>}
                {isNext && <span className="today-appt-card__tag">Next up</span>}
                <p className="today-appt-card__time">{a.time.trim()}</p>
                <p className="today-appt-card__patient">{patientHeadline(a)}</p>
                <p className="today-appt-card__meta">
                  {visitMetaLine(a, doctorLabels, procedureMaps, roomMap)}
                  {patientChart(a) && <> · Chart {patientChart(a)}</>}
                </p>
                <div className="today-appt-card__badges">
                  <Badge variant={statusBadgeVariant(a.status)} semanticLabel={patientApptStatusSemanticLabel(a.status)}>
                    {statusLabel(a.status)}
                  </Badge>
                  {a.missed && (
                    <Badge variant="danger" semanticLabel="Missed appointment">
                      Missed
                    </Badge>
                  )}
                </div>
              </div>
              <div className="today-appt-card__actions">
                {a.patId !== "0" && onOpenPatient && (
                  <Button variant="ghost" size="compact" onClick={() => openPatientFromAppt(a)}>
                    {TODAY_OPEN_PATIENT}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  /* ── main render ─────────────────────────────────────────────────────── */
  return (
    <ClinicPage className="clinic-today-page" testId="today-page">
      {/* Hero */}
      <ClinicPageHero
        title={moduleTitle}
        subtitle={`${greeting} · ${todayLine}`}
      />

      {/* Command Center */}
      <CommandCenter
        greeting={`${greeting}`}
        date={todayLine}
        patientsOnSchedule={canLoad && !loading && !error ? sorted.length : undefined}
        nextAppointment={
          nextUpcoming
            ? `${nextUpcoming.time.trim()} — ${patientHeadline(nextUpcoming)}`
            : nextApptPatient
        }
        metrics={commandMetrics}
        actions={commandActions}
      />

      <PostWriteLocalCopyRefreshNotice
        state={postWriteLocalCopyRefresh}
        className="today-post-write-local-copy"
        onOpenSettings={onOpenSettings}
      />

      {/* Next Appointment (prominent card) */}
      {nextUpcoming && nextUpcoming.patId !== "0" && onOpenPatient && (
        <section className="today-next-section" aria-label="Next appointment">
          <h2 className="today-next-section__title">Next up</h2>
          <PatientQuickCard
            name={nextUpcoming.patient?.displayName ?? `Patient ID ${nextUpcoming.patId}`}
            chartNumber={nextUpcoming.patient?.chartNumber ?? ""}
            time={nextUpcoming.time.trim()}
            room={roomDisplayLabel(nextUpcoming.room, roomMap)}
            status={
              <Badge variant={statusBadgeVariant(nextUpcoming.status)} semanticLabel={patientApptStatusSemanticLabel(nextUpcoming.status)}>
                {statusLabel(nextUpcoming.status)}
              </Badge>
            }
            onClick={() => openPatientFromAppt(nextUpcoming)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openPatientFromAppt(nextUpcoming);
              }
            }}
          />
        </section>
      )}

      {/* Today's Schedule */}
      <section className="today-schedule-section" aria-label={TODAY_SCHEDULE_PANEL_TITLE}>
        <div className="today-schedule-section__header">
          <h2 className="today-schedule-section__title">{TODAY_SCHEDULE_PANEL_TITLE}</h2>
          <div className="today-schedule-section__header-actions">
            {scheduleSummaryLine && (
              <span className="today-schedule-section__count">{scheduleSummaryLine}</span>
            )}
            {canLoad && (
              <Button
                variant="ghost"
                size="compact"
                disabled={loading}
                onClick={refreshToday}
              >
                {TODAY_REFRESH}
              </Button>
            )}
          </div>
        </div>
        {renderBody()}
      </section>

      {/* Recent Patients */}
      {recentPatients.length > 0 && (
        <section className="today-recent-section" aria-label={TODAY_CONTINUE_WORKING_LABEL}>
          <h2 className="today-recent-section__title">{TODAY_CONTINUE_WORKING_LABEL}</h2>
          <div className="today-recent-section__row">
            {recentPatients.slice(0, 5).map((entry) => (
              <PatientQuickCard
                key={entry.patientId}
                name={entry.displayName?.trim() || `Patient ID ${entry.patientId}`}
                chartNumber={entry.chartNumber ?? ""}
                initials={entry.displayName
                  ?.trim()
                  ?.split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()
                  ?.slice(0, 2)}
                onClick={() => onRecentPatientSelect?.(entry)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRecentPatientSelect?.(entry);
                  }
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Footer — subtle status only */}
      <footer className="today-footer">
        <div className="today-footer__status">
          {bridgePhase === "connected" && (
            <span className="today-footer__dot today-footer__dot--ok" aria-hidden />
          )}
          {bridgePhase === "checking" && (
            <span className="today-footer__dot today-footer__dot--checking" aria-hidden />
          )}
          {bridgePhase === "offline" && (
            <span className="today-footer__dot today-footer__dot--offline" aria-hidden />
          )}
          <span className="today-footer__label">
            {bridgePhase === "connected" && "Connected"}
            {bridgePhase === "checking" && "Connecting…"}
            {bridgePhase === "offline" && "Offline"}
          </span>
        </div>
        {mirrorStale && (
          <span className="today-footer__stale" role="note">
            {TODAY_MIRROR_STALE_ADVISORY}
          </span>
        )}
        {!mirrorStale && canLoad && sorted.length > 0 && (
          <span className="today-footer__info">{sorted.length} appointments today</span>
        )}
      </footer>
    </ClinicPage>
  );
}
