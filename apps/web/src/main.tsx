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

createRoot(el).render(
  <StrictMode>
    <AppShell clinicLabel="Local preview (no data)" />
  </StrictMode>,
);
