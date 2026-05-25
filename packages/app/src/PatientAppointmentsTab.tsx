import type { ScheduleAppointmentItem } from "@microdent/contracts";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState } from "@microdent/ui";
import { ClinicLoadingSkeleton } from "./clinic-loading-skeleton.js";
import {
  PATIENT_APPT_FILTER_STATUS_CODES,
  patientApptFormatDuration,
  patientApptRowMeta,
  patientApptStatusBadgeVariant,
  patientApptStatusLabel,
  patientApptStatusSemanticLabel,
  findCurrentAppointmentInRange,
  type PatientApptFilterStatusCode,
  type PatientApptProviderFilterOption,
  type PatientApptTimeDirection,
  type RoomLabelMap,
} from "./patient-appointments-display.js";
import type { PatientApptRangePreset } from "./patient-appointments-range.js";
import type { ProcedureReferenceMaps } from "./procedure-reference.js";

/** Load-state shape for appointments (must match ApptLoadState in PatientProfilePanel). */
export type ApptLoadState =
  | { phase: "idle" }
  | { phase: "offline" }
  | { phase: "loading" }
  | { phase: "loaded"; appointments: ScheduleAppointmentItem[] }
  | { phase: "empty" }
  | { phase: "error"; message: string };

export type PatientAppointmentsTabProps = {
  apptRange: { from: string; to: string };
  rangePreset: PatientApptRangePreset;
  apptState: ApptLoadState;
  filteredAppts: ScheduleAppointmentItem[];
  groupedAppts: Map<string, ScheduleAppointmentItem[]>;
  rangeHeading: string;
  apptRoomsInRange: number[];
  apptProviderOptions: PatientApptProviderFilterOption[];
  statusFilter: number | null;
  roomFilter: number | null;
  providerFilter: number | null;
  timeDirection: PatientApptTimeDirection;
  doctorLabels: ReadonlyMap<string, string>;
  procedureMaps: ProcedureReferenceMaps;
  roomMap: RoomLabelMap;
  onRangePresetChange: (preset: PatientApptRangePreset) => void;
  onTimeDirectionChange: (direction: PatientApptTimeDirection) => void;
  onStatusFilterChange: (code: PatientApptFilterStatusCode | null) => void;
  onRoomFilterChange: (room: number | null) => void;
  onProviderFilterChange: (docId: number | null) => void;
  onRefresh: () => void;
  onOpenScheduleAtDate?: (dateIso: string) => void;
  /** Empty-state and UI constants (from read-only-ui-copy for decoupling). */
  ledeText: string;
  presetDefaultLabel: string;
  timeAllLabel: string;
  timePastLabel: string;
  timeUpcomingLabel: string;
  statusFilterAria: string;
  allStatusesLabel: string;
  roomFilterAria: string;
  allRoomsLabel: string;
  providerFilterAria: string;
  allProvidersLabel: string;
  openInScheduleLabel: string;
  emptyTitle: string;
  emptyBody: string;
  emptyFilteredTitle: string;
  emptyFilteredBody: string;
  loadingLabel: string;
  offlineTitle: string;
  offlineBody: string;
  retryLabel: string;
  rangeCountLabel: (count: number) => string;
  formatDayHeading: (dateIso: string) => string;
};

function defaultFormatApptDayHeading(dateIso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateIso + "T12:00:00"));
  } catch {
    return dateIso;
  }
}

function defaultRangeCountLabel(count: number): string {
  if (count === 0) return "0 appointments";
  if (count === 1) return "1 appointment";
  return `${count} appointments`;
}

const RANGE_PRESETS: PatientApptRangePreset[] = ["default", "past90", "upcoming90", "thisYear"];

export function PatientAppointmentsTab({
  apptRange,
  rangePreset,
  apptState,
  filteredAppts,
  groupedAppts,
  rangeHeading,
  apptRoomsInRange,
  apptProviderOptions,
  statusFilter,
  roomFilter,
  providerFilter,
  timeDirection,
  doctorLabels,
  procedureMaps,
  roomMap,
  onRangePresetChange,
  onTimeDirectionChange,
  onStatusFilterChange,
  onRoomFilterChange,
  onProviderFilterChange,
  onRefresh,
  onOpenScheduleAtDate,
  ledeText,
  presetDefaultLabel,
  timeAllLabel,
  timePastLabel,
  timeUpcomingLabel,
  statusFilterAria,
  roomFilterAria,
  providerFilterAria,
  allStatusesLabel,
  allRoomsLabel,
  allProvidersLabel,
  openInScheduleLabel,
  emptyTitle,
  emptyBody,
  emptyFilteredTitle,
  emptyFilteredBody,
  loadingLabel,
  offlineTitle,
  offlineBody,
  retryLabel,
  rangeCountLabel: rangeCountLabelFn,
  formatDayHeading,
}: PatientAppointmentsTabProps) {
  const formatDay = formatDayHeading ?? defaultFormatApptDayHeading;
  const countLabel = rangeCountLabelFn ?? defaultRangeCountLabel;

  // Identify the currently-in-progress appointment for highlighting
  const currentApptId =
    apptState.phase === "loaded"
      ? findCurrentAppointmentInRange(apptState.appointments)?.id ?? null
      : null;

  // Determine which appointments are in the past for muting
  const isPast = (appt: ScheduleAppointmentItem): boolean => {
    if (appt.date === null) return false;
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (appt.date < todayIso) return true;
    if (appt.date === todayIso) {
      const nowM = today.getHours() * 60 + today.getMinutes();
      const slotMin = appt.periodMinutes ?? 30;
      const parts = appt.time.split(":").map(Number);
      const startM = parts[0] * 60 + (parts[1] ?? 0);
      const endM = startM + appt.durationSlots * slotMin;
      return nowM >= endM;
    }
    return false;
  };

  const presetLabel = (key: PatientApptRangePreset): string => {
    if (key === "default") return presetDefaultLabel;
    if (key === "past90") return "Past 90";
    if (key === "upcoming90") return "Next 90";
    if (key === "thisYear") return "This year";
    return key;
  };

  return (
    <section
      id="patient-panel-appointments"
      role="tabpanel"
      aria-labelledby="patient-tab-appointments"
      className="app-patient-profile__appts"
    >
      {/* Header */}
      <header className="app-patient-profile__appts-header">
        <h2 className="app-patient-profile__appts-title">Appointments</h2>
        <p className="app-patient-profile__appts-subtitle" aria-live="polite">
          {rangeHeading}
          {apptState.phase === "loaded" ? (
            <span className="app-patient-profile__appts-range-count">
              {" · "}
              {countLabel(filteredAppts.length)}
            </span>
          ) : null}
        </p>
      </header>

      {/* Filter bar */}
      <div className="app-patient-profile__appts-controls">
        {/* Date range presets — segmented row */}
        <div className="app-patient-profile__appts-presets" role="group" aria-label="Date range">
          {RANGE_PRESETS.map((key) => (
            <Button
              key={key}
              type="button"
              size="compact"
              variant={rangePreset === key ? "primary" : "secondary"}
              className="ui-focusable app-patient-profile__appts-filter-chip"
              onClick={() => onRangePresetChange(key)}
            >
              {presetLabel(key)}
            </Button>
          ))}
          <Button
            type="button"
            size="compact"
            variant="secondary"
            className="ui-focusable app-patient-profile__appts-filter-chip"
            onClick={onRefresh}
          >
            ↻ Refresh
          </Button>
        </div>

        {/* Time / Status / Room / Provider filters */}
        <div className="app-patient-profile__appts-filters">
          {/* Time direction */}
          <div className="app-patient-profile__appts-filter-group" role="group" aria-label="Past or upcoming">
            <Button
              type="button"
              size="compact"
              variant={timeDirection === "all" ? "primary" : "secondary"}
              className="ui-focusable app-patient-profile__appts-filter-chip"
              onClick={() => onTimeDirectionChange("all")}
            >
              {timeAllLabel}
            </Button>
            <Button
              type="button"
              size="compact"
              variant={timeDirection === "past" ? "primary" : "secondary"}
              className="ui-focusable app-patient-profile__appts-filter-chip"
              onClick={() => onTimeDirectionChange("past")}
            >
              {timePastLabel}
            </Button>
            <Button
              type="button"
              size="compact"
              variant={timeDirection === "upcoming" ? "primary" : "secondary"}
              className="ui-focusable app-patient-profile__appts-filter-chip"
              onClick={() => onTimeDirectionChange("upcoming")}
            >
              {timeUpcomingLabel}
            </Button>
          </div>

          {/* Status pills */}
          <div
            className="app-patient-profile__appts-filter-group"
            role="group"
            aria-label={statusFilterAria}
          >
            <Button
              type="button"
              size="compact"
              variant={statusFilter === null ? "primary" : "secondary"}
              className="ui-focusable app-patient-profile__appts-filter-chip"
              onClick={() => onStatusFilterChange(null)}
            >
              {allStatusesLabel}
            </Button>
            {PATIENT_APPT_FILTER_STATUS_CODES.map((code) => (
              <Button
                key={code}
                type="button"
                size="compact"
                variant={statusFilter === code ? "primary" : "secondary"}
                className="ui-focusable app-patient-profile__appts-filter-chip"
                onClick={() => onStatusFilterChange(code)}
              >
                {patientApptStatusLabel(code)}
              </Button>
            ))}
          </div>

          {/* Room chips */}
          {apptRoomsInRange.length > 0 ? (
            <div
              className="app-patient-profile__appts-filter-group"
              role="group"
              aria-label={roomFilterAria}
            >
              <Button
                type="button"
                size="compact"
                variant={roomFilter === null ? "primary" : "secondary"}
                className="ui-focusable app-patient-profile__appts-filter-chip"
                onClick={() => onRoomFilterChange(null)}
              >
                {allRoomsLabel}
              </Button>
              {apptRoomsInRange.map((room) => (
                <Button
                  key={room}
                  type="button"
                  size="compact"
                  variant={roomFilter === room ? "primary" : "secondary"}
                  className="ui-focusable app-patient-profile__appts-filter-chip"
                  onClick={() => onRoomFilterChange(room)}
                >
                  Room {room}
                </Button>
              ))}
            </div>
          ) : null}

          {/* Provider chips */}
          {apptProviderOptions.length > 1 ? (
            <div
              className="app-patient-profile__appts-filter-group"
              role="group"
              aria-label={providerFilterAria}
            >
              <Button
                type="button"
                size="compact"
                variant={providerFilter === null ? "primary" : "secondary"}
                className="ui-focusable app-patient-profile__appts-filter-chip"
                onClick={() => onProviderFilterChange(null)}
              >
                {allProvidersLabel}
              </Button>
              {apptProviderOptions.map(({ docId, label }) => (
                <Button
                  key={docId}
                  type="button"
                  size="compact"
                  variant={providerFilter === docId ? "primary" : "secondary"}
                  className="ui-focusable app-patient-profile__appts-filter-chip"
                  onClick={() => onProviderFilterChange(docId)}
                >
                  {label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Content states */}
      {apptState.phase === "offline" ? (
        <EmptyState
          variant="offline"
          className="app-patient-profile__empty"
          title={offlineTitle}
          description={offlineBody}
        />
      ) : apptState.phase === "loading" ? (
        <ClinicLoadingSkeleton lines={4} label={loadingLabel} />
      ) : apptState.phase === "error" ? (
        <AppErrorState message={apptState.message} onRetry={onRefresh} retryLabel={retryLabel} />
      ) : apptState.phase === "empty" ? (
        <EmptyState
          variant="empty"
          className="app-patient-profile__empty"
          title={emptyTitle}
          description={emptyBody}
        />
      ) : apptState.phase === "loaded" ? (
        filteredAppts.length === 0 ? (
          <EmptyState
            variant="empty"
            className="app-patient-profile__empty"
            title={emptyFilteredTitle}
            description={emptyFilteredBody}
          />
        ) : (
          <div className="app-patient-profile__appt-days">
            {[...groupedAppts.entries()].map(([dateIso, list]) => (
              <Card key={dateIso} className="app-patient-profile__appt-day">
                <CardHeader>
                  <p className="ui-card__title app-card-title-lg app-patient-profile__appt-day-title">
                    <time dateTime={dateIso}>{formatDay(dateIso)}</time>
                    <span className="app-patient-profile__appt-day-count">
                      {list.length === 1 ? " · 1 appointment" : ` · ${list.length} appointments`}
                    </span>
                  </p>
                </CardHeader>
                <CardBody>
                  <ul className="app-patient-profile__appt-list" aria-label={`Appointments on ${dateIso}`}>
                    {list.map((appt) => {
                      const isCurrent = appt.id === currentApptId;
                      const past = isPast(appt);
                      return (
                        <li
                          key={appt.id}
                          className={[
                            "app-patient-profile__appt-row",
                            isCurrent && "app-patient-profile__appt-row--current",
                            past && "app-patient-profile__appt-row--past",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {/* Time column */}
                          <div className="app-patient-profile__appt-time">
                            <span className="app-patient-profile__appt-time-value">{appt.time}</span>
                            <span className="app-patient-profile__appt-duration">
                              {patientApptFormatDuration(appt)}
                            </span>
                          </div>

                          {/* Main content */}
                          <div className="app-patient-profile__appt-main">
                            <div className="app-patient-profile__appt-line1">
                              <span className="app-patient-profile__appt-room">
                                Room {appt.room}
                              </span>
                              <span className="app-patient-profile__appt-meta">
                                {patientApptRowMeta(appt, doctorLabels, procedureMaps, roomMap)}
                              </span>
                            </div>
                            <div className="app-patient-profile__appt-badges">
                              <Badge
                                variant={patientApptStatusBadgeVariant(appt.status)}
                                semanticLabel={patientApptStatusSemanticLabel(appt.status)}
                              >
                                {patientApptStatusLabel(appt.status)}
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
                            {onOpenScheduleAtDate ? (
                              <div className="app-patient-profile__appt-actions">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="compact"
                                  className="ui-focusable"
                                  onClick={() => onOpenScheduleAtDate(appt.date)}
                                >
                                  {openInScheduleLabel}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardBody>
              </Card>
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}

function AppErrorState({ message, onRetry, retryLabel }: { message: string; onRetry: () => void; retryLabel: string }) {
  return (
    <div className="app-readonly-state app-readonly-state--error app-patient-profile__error" role="alert">
      <p>{message}</p>
      <Button type="button" variant="secondary" className="ui-focusable" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}
