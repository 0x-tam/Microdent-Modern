import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "../util/classNames.js";
import { Card, CardMetric } from "./Card.js";
import { Button, type ButtonVariant } from "./Button.js";

export type CommandCenterMetric = { label: string; value: ReactNode };
export type CommandCenterAction = { label: string; onClick?: () => void; variant?: ButtonVariant };

export type CommandCenterProps = HTMLAttributes<HTMLElement> & {
  /** Greeting text, e.g. "Good morning, Dr. Smith" */
  greeting: ReactNode;
  /** Formatted date string, e.g. "Monday, May 25, 2026" */
  date: string;
  /** Number of patients scheduled today */
  patientsOnSchedule?: number;
  /** Next appointment info, e.g. "9:30 AM — Jane Doe" */
  nextAppointment?: ReactNode;
  /** Optional metrics row items (rendered as CardMetric inside metric cards) */
  metrics?: CommandCenterMetric[];
  /** Quick action buttons */
  actions?: CommandCenterAction[];
};

/**
 * The hero/command section for the Today dashboard.
 * Shows greeting with today's date, key metrics, and quick action buttons.
 */
export function CommandCenter({
  greeting,
  date,
  patientsOnSchedule,
  nextAppointment,
  metrics,
  actions,
  className,
  ...rest
}: CommandCenterProps) {
  return (
    <section className={classNames("ui-command", className)} aria-label="Today overview" {...rest}>
      {/* Greeting band */}
      <Card variant="hero" className="ui-command__hero">
        <h1 className="ui-command__greeting">{greeting}</h1>
        <p className="ui-command__date">{date}</p>
      </Card>

      {/* Metrics row */}
      <div className="ui-command__metrics">
        {patientsOnSchedule !== undefined && (
          <Card variant="metric" className="ui-command__metric-tile">
            <CardMetric label="Patients on schedule" value={patientsOnSchedule} />
          </Card>
        )}
        {nextAppointment && (
          <Card variant="metric" className="ui-command__metric-tile">
            <CardMetric label="Next appointment" value={nextAppointment} />
          </Card>
        )}
        {metrics?.map((m: CommandCenterMetric, i: number) => (
          <Card key={i} variant="metric" className="ui-command__metric-tile">
            <CardMetric label={m.label} value={m.value} />
          </Card>
        ))}
      </div>

      {/* Quick actions row */}
      {actions && actions.length > 0 && (
        <div className="ui-command__actions">
          {actions.map((a: CommandCenterAction, i: number) => (
            <Button key={i} variant={a.variant ?? "secondary"} onClick={a.onClick}>
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
