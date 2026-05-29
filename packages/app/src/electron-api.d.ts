/**
 * Type declarations for Electron IPC bridge exposed via main-app-preload.cjs.
 * Only present when the app runs inside the Electron desktop shell.
 */

interface ServiceStatusPayload {
  status: "running" | "stopped";
  port: number | null;
  lastError: string | null;
}

interface ElectronAPI {
  /** Query clinic service status via `app:service-status` IPC. */
  getServiceStatus: () => Promise<ServiceStatusPayload>;
  /** Query bridge health via `bridge:health` IPC. */
  getBridgeHealth: () => Promise<"connected" | "disconnected">;
  /** Trigger re-run of first-run setup. */
  reRunSetup: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
