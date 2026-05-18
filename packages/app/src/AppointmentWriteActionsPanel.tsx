import type { BridgeDevStatusResponse, ScheduleAppointmentItem } from "@microdent/contracts";
import { useState } from "react";
import { Button } from "@microdent/ui";
import { AppointmentStatusWriteAction } from "./AppointmentStatusWriteAction.js";
import { AppointmentTimeMoveWriteAction } from "./AppointmentTimeMoveWriteAction.js";
import {
  APPOINTMENT_WRITE_ACTIONS_SUMMARY,
  APPOINTMENT_WRITE_TAB_MOVE,
  APPOINTMENT_WRITE_TAB_STATUS,
} from "./read-only-ui-copy.js";
import { isSandboxWritePilotEnabled, isSandboxWriteReady } from "./sandbox-write-pilot.js";

export type AppointmentWriteActionsPanelProps = {
  appointment: ScheduleAppointmentItem;
  bridgeBaseUrl: string;
  fetchImpl?: typeof fetch;
  writePilotEnabled: boolean;
  writeCapability: BridgeDevStatusResponse | null;
  onCommitted?: () => void;
};

type WriteTab = "status" | "move";

export function AppointmentWriteActionsPanel({
  appointment,
  bridgeBaseUrl,
  fetchImpl,
  writePilotEnabled,
  writeCapability,
  onCommitted,
}: AppointmentWriteActionsPanelProps) {
  const [tab, setTab] = useState<WriteTab>("status");

  if (!isSandboxWritePilotEnabled(writePilotEnabled)) {
    return null;
  }
  if (!writeCapability || !isSandboxWriteReady(writeCapability)) {
    return null;
  }

  const tabId = (suffix: string) => `appt-write-tab-${appointment.id}-${suffix}`;
  const panelId = `appt-write-panel-${appointment.id}-${tab}`;

  return (
    <details className="app-appt-write-actions" data-testid="appt-write-actions-panel">
      <summary className="app-appt-write-actions__summary">{APPOINTMENT_WRITE_ACTIONS_SUMMARY}</summary>
      <div className="app-appt-write-actions__body">
        <div className="app-appt-write-actions__tabs" role="tablist" aria-label="Sandbox write action">
          <Button
            type="button"
            variant={tab === "status" ? "secondary" : "ghost"}
            size="compact"
            className="ui-focusable app-appt-write-actions__tab"
            role="tab"
            id={tabId("status")}
            aria-selected={tab === "status"}
            aria-controls={panelId}
            onClick={() => setTab("status")}
          >
            {APPOINTMENT_WRITE_TAB_STATUS}
          </Button>
          <Button
            type="button"
            variant={tab === "move" ? "secondary" : "ghost"}
            size="compact"
            className="ui-focusable app-appt-write-actions__tab"
            role="tab"
            id={tabId("move")}
            aria-selected={tab === "move"}
            aria-controls={panelId}
            onClick={() => setTab("move")}
          >
            {APPOINTMENT_WRITE_TAB_MOVE}
          </Button>
        </div>
        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={tabId(tab)}
          className="app-appt-write-actions__panel"
        >
          {tab === "status" ? (
            <AppointmentStatusWriteAction
              appointment={appointment}
              bridgeBaseUrl={bridgeBaseUrl}
              fetchImpl={fetchImpl}
              writePilotEnabled={writePilotEnabled}
              writeCapability={writeCapability}
              embedded
              onCommitted={onCommitted}
            />
          ) : (
            <AppointmentTimeMoveWriteAction
              appointment={appointment}
              bridgeBaseUrl={bridgeBaseUrl}
              fetchImpl={fetchImpl}
              writePilotEnabled={writePilotEnabled}
              writeCapability={writeCapability}
              embedded
              onCommitted={onCommitted}
            />
          )}
        </div>
      </div>
    </details>
  );
}
