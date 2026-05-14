import "@microdent/ui/tokens.css";
import "@microdent/ui/components.css";
import "@microdent/app/app-shell.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "@microdent/app";

const el = document.getElementById("root");
if (!el) {
  throw new Error("Missing #root");
}

const bridgeBaseUrl = import.meta.env.VITE_BRIDGE_BASE_URL?.trim() || "http://127.0.0.1:17890";

createRoot(el).render(
  <StrictMode>
    <AppShell
      clinicLabel="Local preview (sample data only)"
      bridgeBaseUrl={bridgeBaseUrl}
      bridgeHealthLogDiagnostics={import.meta.env.DEV}
      bridgeConnectionDiagnostics={import.meta.env.DEV}
    />
  </StrictMode>,
);
