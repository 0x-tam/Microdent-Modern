import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "../util/classNames.js";

export type PatientQuickCardProps = HTMLAttributes<HTMLDivElement> & {
  /** Full patient name */
  name: string;
  /** Chart number, e.g. "CH-0042" */
  chartNumber: string;
  /** Appointment time, e.g. "9:30 AM" */
  time?: string;
  /** Appointment status, e.g. "Confirmed", "Checked In", "In Progress" */
  status?: ReactNode;
  /** Room/operatory, e.g. "Room 3" */
  room?: string;
  /** Avatar initials (first 2 chars of name by default) */
  initials?: string;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Compact patient card for "next appointment" and "recent patients" lists.
 * Clickable with hover highlight.
 */
export function PatientQuickCard({
  name,
  chartNumber,
  time,
  status,
  room,
  initials,
  className,
  ...rest
}: PatientQuickCardProps) {
  const displayInitials = initials ?? getInitials(name);

  return (
    <div
      className={classNames("ui-patient-card", className)}
      role="button"
      tabIndex={0}
      {...rest}
    >
      <div className="ui-patient-card__avatar" aria-hidden>
        {displayInitials}
      </div>
      <div className="ui-patient-card__info">
        <span className="ui-patient-card__name">{name}</span>
        <span className="ui-patient-card__meta">
          {chartNumber}
          {room && (
            <>
              {" "}
              <span className="ui-patient-card__sep" aria-hidden>·</span>{" "}
              {room}
            </>
          )}
        </span>
      </div>
      <div className="ui-patient-card__right">
        {time && <span className="ui-patient-card__time">{time}</span>}
        {status && <div className="ui-patient-card__status">{status}</div>}
      </div>
    </div>
  );
}
