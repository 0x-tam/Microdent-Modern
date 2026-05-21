import type { BridgeDevStatusResponse, ScheduleAppointmentItem } from "@microdent/contracts";
import { useState, type KeyboardEvent } from "react";
import { Button } from "@microdent/ui";
import { AppointmentStatusWriteAction } from "./AppointmentStatusWriteAction.js";
import { AppointmentTimeMoveWriteAction } from "./AppointmentTimeMoveWriteAction.js";
import {
  APPOINTMENT_WRITE_ACTIONS_SUMMARY,
  APPOINTMENT_WRITE_TAB_MOVE,
  APPOINTMENT_WRITE_TAB_STATUS,
} from "./read-only-ui-copy.js";
import { isSandboxWritePilotEnabled, resolveSandboxWriteBlockReason } from "./sandbox-write-pilot.js";
import { SandboxWriteBlockedNotice } from "./safe-write-plan-display.js";

import type { RoomLabelMap } from "./patient-appointments-display.js";

export type AppointmentWriteActionsPanelProps = {
  appointment: ScheduleAppointmentItem;
  bridgeBaseUrl: string;
  fetchImpl?: typeof fetch;
  writePilotEnabled: boolean;
  writeCapability: BridgeDevStatusResponse | null;
  roomOptions?: readonly number[];
  roomMap?: RoomLabelMap;
  onCommitted?: () => void;
};

type WriteTab = "status" | "move";

export function AppointmentWriteActionsPanel({
  appointment,
  bridgeBaseUrl,
  fetchImpl,
  writePilotEnabled,
  writeCapability,
  roomOptions = [],
  roomMap = new Map(),
  onCommitted,
}: AppointmentWriteActionsPanelProps) {
  const [tab, setTab] = useState<WriteTab>("status");

  if (!isSandboxWritePilotEnabled(writePilotEnabled)) {
    return null;
  }

  const blockReason = resolveSandboxWriteBlockReason(writePilotEnabled, writeCapability);
  if (blockReason) {
    return (
      <SandboxWriteBlockedNotice
        reason={blockReason}
        className="app-appt-write-actions app-appt-write-actions--blocked"
        testId="appt-write-actions-blocked"
      />
    );
  }

  const tabId = (suffix: string) => `appt-write-tab-${appointment.id}-${suffix}`;
  const panelId = `appt-write-panel-${appointment.id}-${tab}`;

  const handleWriteTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const tabs: WriteTab[] = ["status", "move"];
    const idx = tabs.indexOf(tab);
    const next = e.key === "ArrowRight" ? tabs[(idx + 1) % tabs.length]! : tabs[(idx - 1 + tabs.length) % tabs.length]!;
    setTab(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    <details className="app-appt-write-actions app-sandbox-write-zone" data-testid="appt-write-actions-panel">
      <summary className="app-appt-write-actions__summary">{APPOINTMENT_WRITE_ACTIONS_SUMMARY}</summary>
      <div className="app-appt-write-actions__body">
        <div
          className="app-appt-write-actions__tabs"
          role="tablist"
          aria-label="Sandbox write action"
          onKeyDown={handleWriteTabKeyDown}
        >
          <Button
            type="button"
            variant={tab === "status" ? "secondary" : "ghost"}
            size="compact"
            className="ui-focusable app-appt-write-actions__tab"
            role="tab"
            id={tabId("status")}
            aria-selected={tab === "status"}
            aria-controls={panelId}
            tabIndex={tab === "status" ? 0 : -1}
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
            tabIndex={tab === "move" ? 0 : -1}
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
              roomOptions={roomOptions}
              roomMap={roomMap}
              onCommitted={onCommitted}
            />
          )}
        </div>
      </div>
    </details>
  );
}
