import type { ScheduleAppointmentItem, BridgeDevStatusResponse } from "@microdent/contracts";
import { Badge, Button, Card, CardBody, CardHeader } from "@microdent/ui";
import { ClinicEmptyState } from "./clinic-empty-state.js";
import { ClinicLoadingSkeleton } from "./clinic-loading-skeleton.js";
import {
  PATIENT_APPT_FILTER_STATUS_CODES,
  patientApptFormatDuration,
  patientApptRowMeta,
  patientApptStatusBadgeVariant,
  patientApptStatusLabel,
  patientApptStatusSemanticLabel,
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
  allStatusesLabel,
  roomFilterAria,
  allRoomsLabel,
  providerFilterAria,
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

  return (
    <section
      id="patient-panel-appointments"
      role="tabpanel"
      aria-labelledby="patient-tab-appointments"
      className="app-patient-profile__appts"
    >
      <p className="app-patient-profile__appts-lede">{ledeText}</p>

      <div className="app-patient-profile__appts-controls">
        <div className="app-patient-profile__appts-presets" role="group" aria-label="Date range">
          <Button
            type="button"
            variant={rangePreset === "default" ? "primary" : "secondary"}
            className="ui-focusable"
            onClick={() => onRangePresetChange("default")}
          >
            {presetDefaultLabel}
          </Button>
          <Button
            type="button"
            variant={rangePreset === "past90" ? "primary" : "secondary"}
            className="ui-focusable"
            onClick={() => onRangePresetChange("past90")}
          >
            Past 90 days
          </Button>
          <Button
            type="button"
            variant={rangePreset === "upcoming90" ? "primary" : "secondary"}
            className="ui-focusable"
            onClick={() => onRangePresetChange("upcoming90")}
          >
            Upcoming 90 days
          </Button>
          <Button
            type="button"
            variant={rangePreset === "thisYear" ? "primary" : "secondary"}
            className="ui-focusable"
            onClick={() => onRangePresetChange("thisYear")}
          >
            This year
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="ui-focusable"
            onClick={onRefresh}
          >
            Refresh
          </Button>
        </div>

        <div className="app-patient-profile__appts-filters">
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

      <p className="app-patient-profile__appts-range" aria-live="polite">
        {rangeHeading}
        {apptState.phase === "loaded" ? (
          <span className="app-patient-profile__appts-range-count">
            {" · "}
            {countLabel(filteredAppts.length)}
          </span>
        ) : null}
      </p>

      {apptState.phase === "offline" ? (
        <ClinicEmptyState
          variant="offline"
          className="app-patient-profile__empty"
          title={offlineTitle}
          body={offlineBody}
        />
      ) : apptState.phase === "loading" ? (
        <ClinicLoadingSkeleton lines={4} label={loadingLabel} />
      ) : apptState.phase === "error" ? (
        <AppErrorState message={apptState.message} onRetry={onRefresh} retryLabel={retryLabel} />
      ) : apptState.phase === "empty" ? (
        <ClinicEmptyState
          className="app-patient-profile__empty"
          title={emptyTitle}
          body={emptyBody}
        />
      ) : apptState.phase === "loaded" ? (
        filteredAppts.length === 0 ? (
          <ClinicEmptyState
            className="app-patient-profile__empty"
            title={emptyFilteredTitle}
            body={emptyFilteredBody}
          />
        ) : (
          <div className="app-patient-profile__appt-days">
            {[...groupedAppts.entries()].map(([dateIso, list]) => (
              <Card key={dateIso} className="app-patient-profile__appt-day">
                <CardHeader>
                  <p className="ui-card__title app-card-title-lg app-patient-profile__appt-day-title">
                    <time dateTime={dateIso}>{formatDay(dateIso)}</time>
                  </p>
                </CardHeader>
                <CardBody>
                  <ul className="app-patient-profile__appt-list" aria-label={`Appointments on ${dateIso}`}>
                    {list.map((appt) => (
                      <li key={appt.id} className="app-patient-profile__appt-row">
                        <div className="app-patient-profile__appt-time">{appt.time}</div>
                        <div className="app-patient-profile__appt-main">
                          <div className="app-patient-profile__appt-line1">
                            <span className="app-patient-profile__appt-duration">
                              {patientApptFormatDuration(appt)}
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
                    ))}
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
