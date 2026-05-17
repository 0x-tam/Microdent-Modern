import { createBridgeClient } from "@microdent/bridge-client";
import type { ScheduleAppointmentItem } from "@microdent/contracts";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState } from "@microdent/ui";
import type { AppSidebarModuleId } from "./app-nav-modules.js";
import type { BridgeHealthPhase } from "./bridge-health.js";
import { AppErrorBoundary } from "./AppErrorBoundary.js";
import { FixtureConnectionPanel } from "./FixtureConnectionPanel.js";
import { LegacyCatalogPanel } from "./LegacyCatalogPanel.js";
import { doctorDisplayLabel } from "./doctor-labels.js";
import { procClassDisplayLabel, type ProcedureReferenceMaps } from "./procedure-reference.js";
import { useDoctorLabels } from "./useDoctorLabels.js";
import { useProcedureReference } from "./useProcedureReference.js";
import {
  CLINIC_SERVICE_CHECKING,
  CLINIC_SERVICE_CONNECT_TODAY,
  TAB_UNAVAILABLE_TITLE,
  TODAY_PRIVACY_LEDE,
} from "./read-only-ui-copy.js";

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
): string {
  const parts: string[] = [`Room ${a.room}`, formatDuration(a)];
  const doc = doctorDisplayLabel(a.docId, doctorLabels);
  if (doc !== null) {
    parts.push(doc);
  }
  const proc = procClassDisplayLabel(a.procClass, procedureMaps);
  if (proc !== null) {
    parts.push(proc);
  }
  return parts.join(" · ");
}

export type DashboardHomeProps = {
  onOpenModule: (id: AppSidebarModuleId) => void;
  bridgeBaseUrl?: string;
  bridgePhase: BridgeHealthPhase;
  fetchImpl?: typeof fetch;
};

export function DashboardHome({ onOpenModule, bridgeBaseUrl, bridgePhase, fetchImpl }: DashboardHomeProps) {
  const base = bridgeBaseUrl?.trim() ?? "";
  const canLoad = Boolean(base) && bridgePhase === "connected";
  const { labels: doctorLabels } = useDoctorLabels({ bridgePhase, bridgeBaseUrl, fetchImpl });
  const { maps: procedureMaps } = useProcedureReference({ bridgePhase, bridgeBaseUrl, fetchImpl });

  const todayIso = useMemo(() => toLocalIsoDate(new Date()), []);

  const [appointments, setAppointments] = useState<ScheduleAppointmentItem[]>([]);
  const [loading, setLoading] = useState(() => Boolean(bridgeBaseUrl?.trim()) && bridgePhase === "connected");
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const requestSeq = useRef(0);

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
      setError("Today’s schedule could not be loaded. Try again in a moment.");
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, [base, canLoad, fetchImpl, todayIso]);

  useEffect(() => {
    if (!canLoad) {
      requestSeq.current += 1;
      setLoading(false);
      setAppointments([]);
      setError(null);
      return;
    }
    void loadToday();
  }, [canLoad, loadToday, retryTick]);

  const sorted = useMemo(() => [...appointments].sort(sortAppointments), [appointments]);
  const nextUpcoming = useMemo(() => findNextUpcomingToday(sorted, new Date()), [sorted]);

  const primaryBody: ReactNode = (() => {
    if (!base || bridgePhase === "offline") {
      return (
        <p className="app-dashboard-sched__offline" role="status">
          {CLINIC_SERVICE_CONNECT_TODAY}
        </p>
      );
    }
    if (bridgePhase === "checking") {
      return (
        <p className="app-dashboard-sched__waiting" role="status">
          {CLINIC_SERVICE_CHECKING}
        </p>
      );
    }
    if (loading) {
      return (
        <p className="app-dashboard-sched__loading" role="status" aria-live="polite">
          Loading today’s schedule…
        </p>
      );
    }
    if (error) {
      return (
        <div className="app-dashboard-sched__error" role="alert">
          <p>{error}</p>
          <Button type="button" variant="secondary" className="ui-focusable" onClick={() => setRetryTick((n) => n + 1)}>
            Retry
          </Button>
        </div>
      );
    }
    if (sorted.length === 0) {
      return <p className="app-dashboard-sched__empty">No appointments found for today.</p>;
    }
    return (
      <ul className="app-appt-list" aria-label="Today’s appointments from the clinic copy">
        {sorted.map((a) => (
          <li key={a.id} className="app-appt-list__row">
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
              <span className="app-appt-list__visit">{visitMetaLine(a, doctorLabels, procedureMaps)}</span>
              <div className="app-appt-list__extras">
                {a.hasComment ? <span className="app-appt-list__pill">Note hidden</span> : null}
                {a.missed ? (
                  <Badge variant="danger" semanticLabel="Missed appointment">
                    Missed
                  </Badge>
                ) : null}
              </div>
            </div>
            <Badge variant={statusBadgeVariant(a.status)} semanticLabel={`Visit status: ${statusLabel(a.status)}`}>
              {statusLabel(a.status)}
            </Badge>
          </li>
        ))}
      </ul>
    );
  })();

  const nextCardBody: ReactNode = (() => {
    if (!base || bridgePhase === "offline") {
      return (
        <p className="app-next-patient__hint" role="status">
          Connect the clinic service to see the next appointment on today’s copy.
        </p>
      );
    }
    if (bridgePhase === "checking") {
      return (
        <p className="app-next-patient__hint" role="status">
          Waiting for the clinic service…
        </p>
      );
    }
    if (loading) {
      return (
        <p className="app-next-patient__hint" role="status">
          Loading…
        </p>
      );
    }
    if (error) {
      return <p className="app-next-patient__hint">{error}</p>;
    }
    if (sorted.length === 0) {
      return <p className="app-next-patient__hint">No appointments found for today.</p>;
    }
    if (!nextUpcoming) {
      return <p className="app-next-patient__hint">No upcoming appointments on the schedule for today.</p>;
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
          {visitMetaLine(nextUpcoming, doctorLabels, procedureMaps)} · {statusLabel(nextUpcoming.status)}
        </p>
        <div className="app-next-patient__badges">
          {nextUpcoming.hasComment ? <span className="app-appt-list__pill">Note hidden</span> : null}
          {nextUpcoming.missed ? (
            <Badge variant="danger" semanticLabel="Missed appointment">
              Missed
            </Badge>
          ) : null}
        </div>
        <Button type="button" variant="primary" className="ui-focusable app-next-patient__btn" onClick={() => onOpenModule("patients")}>
          Open Patients
        </Button>
        <p className="app-next-patient__hint">Use Find a patient in the top bar when the clinic service is connected.</p>
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
              <p className="ui-card__title app-card-title-lg">Today&apos;s appointments</p>
              {canLoad && !loading && !error ? (
                <p className="app-dashboard-sched__count" role="status">
                  {sorted.length} on the schedule today
                </p>
              ) : null}
            </CardHeader>
            <CardBody>
              <p className="app-dashboard-sched__privacy">{TODAY_PRIVACY_LEDE}</p>
              {primaryBody}
              <div className="app-appt-list__footer">
                <Button type="button" variant="secondary" className="ui-focusable" onClick={() => onOpenModule("schedule")}>
                  Open schedule
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <aside className="app-dashboard__aside" aria-label="Next visit and shortcuts">
          <Card className="app-next-patient-card">
            <CardHeader>
              <p className="ui-card__title app-card-title-lg">Next appointment</p>
            </CardHeader>
            <CardBody>{nextCardBody}</CardBody>
          </Card>

          <Card>
            <CardHeader>
              <p className="ui-card__title app-card-title-lg">Quick actions</p>
            </CardHeader>
            <CardBody>
              <div className="app-quick-actions">
                <Button
                  type="button"
                  variant="secondary"
                  className="ui-focusable app-quick-actions__btn"
                  onClick={() => onOpenModule("patients")}
                >
                  Find patient
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="ui-focusable app-quick-actions__btn"
                  onClick={() => onOpenModule("schedule")}
                >
                  Open schedule
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="ui-focusable app-quick-actions__btn"
                  onClick={() => onOpenModule("patients")}
                >
                  Open patient
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="ui-focusable app-quick-actions__btn"
                  disabled
                  title={TAB_UNAVAILABLE_TITLE}
                >
                  Record payment
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <p className="ui-card__title app-card-title-lg">Reminders</p>
            </CardHeader>
            <CardBody>
              <p className="app-reminder-list__empty" role="status">
                No reminders in this read-only viewer. Connect the clinic service and use Schedule or Patients for live data
                from your copy.
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
