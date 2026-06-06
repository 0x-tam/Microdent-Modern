import "@microdent/ui/tokens.css";
import "@microdent/ui/components.css";
import "@microdent/app/app-shell.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "@microdent/app";

declare global {
  interface Window {
    microdentDesktop?: {
      restartClinicService?: () => Promise<{ ok: boolean; message?: string }>;
      refreshLocalCopy?: () => Promise<{
        ok: boolean;
        message?: string;
        overall?: "success" | "partial" | "failed";
        coreReady?: boolean;
      }>;
      exportSupportLog?: () => Promise<{
        ok: boolean;
        message?: string;
        fileName?: string;
        lineCount?: number;
      }>;
      getSupportDiagnostics?: () => Promise<{
        ok: boolean;
        logFileCount: number;
        supportExportCount: number;
        crashDumpCount: number;
        crashDumpFiles: Array<{
          fileName: string;
          kind: "dump" | "metadata" | "other";
          sizeBytes: number;
          updatedAt: string;
        }>;
        latestLogUpdatedAt: string | null;
        latestCrashDumpUpdatedAt: string | null;
        latestSupportExportFileName: string | null;
        message: string;
      }>;
      previewSupportLog?: () => Promise<{
        ok: boolean;
        fileName: string | null;
        lineCount: number;
        lines: Array<{ index: number; level: string; event: string; summary: string }>;
        message: string;
      }>;
      diagnoseClinicServicePort?: () => Promise<{
        ok: boolean;
        configuredPort: number;
        activePort: number | null;
        configuredPortState: "responding" | "not-responding";
        activePortState: "responding" | "not-responding" | null;
        message: string;
      }>;
      getPortCleanupPolicy?: () => Promise<{
        ok: boolean;
        title: string;
        canAutoClean: false;
        configuredPort: number;
        activePort: number | null;
        steps: string[];
        escalation: string;
        message: string;
      }>;
      onLocalCopyRefreshProgress?: (
        listener: (progress: { label: string; percent: number }) => void,
      ) => () => void;
    };
  }
}

const el = document.getElementById("root");
if (!el) {
  throw new Error("Missing #root");
}

const bridgeBaseUrl = import.meta.env.VITE_BRIDGE_BASE_URL?.trim() || "http://127.0.0.1:17890";

const sandboxWritePilot =
  import.meta.env.VITE_SANDBOX_WRITE_PILOT === "true" ||
  import.meta.env.VITE_APPOINTMENT_STATUS_WRITE_PILOT === "true";

const desktopActions = window.microdentDesktop
  ? {
      restartClinicService: window.microdentDesktop.restartClinicService,
      refreshLocalCopy: window.microdentDesktop.refreshLocalCopy,
      exportSupportLog: window.microdentDesktop.exportSupportLog,
      getSupportDiagnostics: window.microdentDesktop.getSupportDiagnostics,
      previewSupportLog: window.microdentDesktop.previewSupportLog,
      diagnoseClinicServicePort: window.microdentDesktop.diagnoseClinicServicePort,
      getPortCleanupPolicy: window.microdentDesktop.getPortCleanupPolicy,
      onLocalCopyRefreshProgress: window.microdentDesktop.onLocalCopyRefreshProgress,
    }
  : undefined;

createRoot(el).render(
  <StrictMode>
    <AppShell
      bridgeBaseUrl={bridgeBaseUrl}
      bridgeHealthLogDiagnostics={import.meta.env.DEV}
      bridgeConnectionDiagnostics={import.meta.env.DEV}
      mirrorConnectionDiagnostics={import.meta.env.DEV}
      writeDiagnosticsActions={import.meta.env.DEV}
      sandboxWritePilot={sandboxWritePilot}
      desktopActions={desktopActions}
    />
  </StrictMode>,
);
