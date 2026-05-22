import { createBridgeClient } from "@microdent/bridge-client";
import type { BridgeDevStatusResponse, MirrorStatusResponse, ScheduleAppointmentItem } from "@microdent/contracts";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge, Button } from "@microdent/ui";
import { ClinicEmptyState } from "./clinic-empty-state.js";
import { ClinicLoadingSkeleton } from "./clinic-loading-skeleton.js";
import { ClinicPage, ClinicPageHero } from "./clinic-page.js";
import { ClinicPanel } from "./clinic-panel.js";
import {
  friendlyBridgeStatus,
  friendlyEditingStatus,
  friendlyLocalCopyStatus,
  type ClinicFriendlyTone,
} from "./clinic-friendly-copy.js";
import type { AppSidebarModuleId } from "./app-nav-modules.js";
import type { SessionRecentPatient } from "./session-recent-patients.js";
import type { BridgeHealthPhase } from "./bridge-health.js";
import { FixtureConnectionPanel } from "./FixtureConnectionPanel.js";
import { LegacyCatalogPanel } from "./LegacyCatalogPanel.js";
import { isMirrorImportStale } from "./mirror-stale.js";
import { resolveTodayClinicStatus } from "./today-clinic-status.js";
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
  TODAY_APPT_ROW_CURRENT_LABEL,
  TODAY_APPT_ROW_NEXT_LABEL,
  TODAY_CLINIC_STATUS_TITLE,
  TODAY_CONTINUE_EMPTY_HINT,
  TODAY_CONTINUE_WORKING_LABEL,
  TODAY_EMPTY_DESCRIPTION,
  TODAY_EMPTY_TITLE,
  TODAY_HERO_SUBTITLE,
  TODAY_LOADING,
  TODAY_METRIC_ON_SCHEDULE,
  TODAY_MIRROR_STALE_ADVISORY,
  TODAY_NEXT_LOADING,
  TODAY_NEXT_NO_UPCOMING,
  TODAY_NEXT_OFFLINE,
  TODAY_NEXT_PANEL_TITLE,
  TODAY_OPEN_PATIENT,
  TODAY_OPEN_SCHEDULE,
  TODAY_OPEN_SETTINGS,
  TODAY_QUICK_ACTIONS_TITLE,
  TODAY_REFRESH,
  TODAY_SCHEDULE_PANEL_TITLE,
  TODAY_SCHEDULE_UNAVAILABLE,
  TODAY_SEARCH_PATIENT,
  TODAY_STATUS_VIEW_SETTINGS,
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

function mapFriendlyTone(tone: ClinicFriendlyTone): string {
  if (tone === "ok") return "ok";
  if (tone === "warn") return "warn";
  if (tone === "danger") return "danger";
  return "neutral";
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
  selectedPatientId: _selectedPatientId = null,
  selectedPatientDisplayName: _selectedPatientDisplayName = null,
  selectedPatientChartNumber: _selectedPatientChartNumber = null,
  recentPatients = [],
  onRecentPatientSelect,
  mirrorStatus = null,
  writeCapability = null,
  sandboxWritePilot = false,
  sessionRecentPatientCount: _sessionRecentPatientCount = 0,
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

  const statusMixLine = useMemo(() => {
    if (!base || bridgePhase === "offline") return null;
    if (bridgePhase === "checking" || loading) return null;
    if (error || sorted.length === 0) return null;
    return formatAppointmentStatusMix(sorted);
  }, [base, bridgePhase, loading, error, sorted]);

  const todayClinicStatus = useMemo(
    () =>
      resolveTodayClinicStatus({
        bridgePhase,
        mirrorStatus,
        writeCapability,
        sandboxWritePilot,
      }),
    [bridgePhase, mirrorStatus, writeCapability, sandboxWritePilot],
  );

  const heroServiceChip = friendlyBridgeStatus(bridgePhase).label;
  const heroLocalCopyChip = friendlyLocalCopyStatus(bridgePhase, mirrorStatus).label;
  const heroEditingChip = friendlyEditingStatus(writeCapability, sandboxWritePilot).label;

  const scheduleSummaryLine = (() => {
    if (!canLoad || loading || error) return null;
    if (sorted.length === 0) return null;
    if (statusMixLine) {
      return `${statusMixLine} · ${TODAY_METRIC_ON_SCHEDULE}`;
    }
    return TODAY_METRIC_ON_SCHEDULE;
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
      {scheduleSummaryLine ? (
        <span className="clinic-today-appt-count">{scheduleSummaryLine}</span>
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
              <span className="clinic-chip">{heroLocalCopyChip}</span>
              <span className="clinic-chip">{heroEditingChip}</span>
            </div>
          </>
        }
      />

      <div className="clinic-workspace-grid">
        <div className="clinic-col-8 clinic-workspace-grid__stack">
          <ClinicPanel
            title={TODAY_SCHEDULE_PANEL_TITLE}
            headerActions={appointmentsHeaderActions}
            testId="today-appointments-panel"
          >
            {mirrorStale ? (
              <p className="clinic-today-panel-note clinic-today-panel-note--advisory" role="note">
                {TODAY_MIRROR_STALE_ADVISORY}
              </p>
            ) : null}
            {primaryBody}
          </ClinicPanel>

          <div className="clinic-continue-strip" aria-label={TODAY_CONTINUE_WORKING_LABEL}>
            <p className="clinic-continue-strip__label">{TODAY_CONTINUE_WORKING_LABEL}</p>
            {recentPatients.length > 0 && onRecentPatientSelect ? (
              <ul className="clinic-continue-strip__chips">
                {recentPatients.slice(0, 5).map((entry) => (
                  <li key={entry.patientId}>
                    <button
                      type="button"
                      className="clinic-continue-strip__chip ui-focusable"
                      onClick={() => onRecentPatientSelect(entry)}
                    >
                      {entry.displayName?.trim() || `Patient ID ${entry.patientId}`}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="clinic-today-continue-hint">{TODAY_CONTINUE_EMPTY_HINT}</p>
            )}
          </div>
        </div>

        <aside className="clinic-col-4 clinic-workspace-grid__stack" aria-label="Next visit, shortcuts, and clinic status">
          <ClinicPanel title={TODAY_NEXT_PANEL_TITLE} testId="today-now-panel">
            {nextCardBody}
          </ClinicPanel>

          <ClinicPanel title={TODAY_QUICK_ACTIONS_TITLE}>
            <div className="clinic-today-quick-actions">
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

          <ClinicPanel title={TODAY_CLINIC_STATUS_TITLE}>
            <ul className="clinic-status-compact" aria-label={TODAY_CLINIC_STATUS_TITLE}>
              {todayClinicStatus.map((row) => (
                <li key={row.key} className="clinic-status-compact__row">
                  <span className="clinic-status-compact__label">{row.label}</span>
                  <span className={["clinic-status-pill", `clinic-status-pill--${mapFriendlyTone(row.tone)}`].join(" ")}>
                    {row.value}
                  </span>
                </li>
              ))}
            </ul>
            <p className="clinic-status-compact__footer">
              <button
                type="button"
                className="clinic-status-compact__footer-link ui-focusable"
                onClick={() => onOpenModule("settings")}
              >
                {TODAY_STATUS_VIEW_SETTINGS}
              </button>
            </p>
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
