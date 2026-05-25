import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell, resolveMirrorDiagnosticLabel, resolveShellClinicLabel } from "./AppShell.js";
import { assertNoForbiddenDomTokens, assertNoMainPageJargonInDom } from "./read-only-smoke-fixtures.js";
import { resolveShellStatusBanners } from "./shell-status-banners.js";

describe("resolveMirrorDiagnosticLabel", () => {
  it("returns null when diagnostics are disabled or bridge is not connected", () => {
    expect(resolveMirrorDiagnosticLabel(false, "connected", true)).toBeNull();
    expect(resolveMirrorDiagnosticLabel(true, "offline", true)).toBeNull();
    expect(resolveMirrorDiagnosticLabel(true, "connected", null)).toBeNull();
  });

  it("returns active vs DBF fallback labels", () => {
    expect(resolveMirrorDiagnosticLabel(true, "connected", true)).toBe("Mirror: active");
    expect(resolveMirrorDiagnosticLabel(true, "connected", false)).toBe("Mirror: DBF fallback");
  });
});

describe("resolveShellClinicLabel", () => {
  it("uses an explicit clinic label when provided", () => {
    expect(resolveShellClinicLabel("offline", "Demo clinic")).toBe("Demo clinic");
    expect(resolveShellClinicLabel("connected", "Demo clinic")).toBe("Demo clinic");
  });

  it("uses the connected copy when no clinic label and bridge is connected", () => {
    expect(resolveShellClinicLabel("connected", undefined)).toBe("Connected to copied clinic data");
  });

  it("uses read-only viewer label when no clinic label and bridge is not connected", () => {
    expect(resolveShellClinicLabel("offline", undefined)).toBe("Read-only viewer");
    expect(resolveShellClinicLabel("checking", undefined)).toBe("Read-only viewer");
  });

  it("treats blank clinic label as unset", () => {
    expect(resolveShellClinicLabel("connected", "  ")).toBe("Connected to copied clinic data");
  });
});

describe("AppShell", () => {
  it("renders landmark structure: banner, navigation, main", () => {
    const html = renderToStaticMarkup(<AppShell clinicLabel="Demo clinic" />);
    expect(html).toContain('role="banner"');
    expect(html).toContain('role="main"');
    expect(html).toContain("<nav");
    expect(html).toContain("Read-only");
    expect(html).toContain("Clinic service offline");
    expect(html).toContain("app-workspace-shell");
    expect(html).toContain("clinic-sidebar");
    expect(html).toContain("Modern clinic workspace");
  });

  it("renders dev-only Today aside panels only when import.meta.env.DEV and diagnostics props", () => {
    // Diagnostic panels are no longer auto-rendered in the aside; they require explicit props.
    // Without bridgeConnectionDiagnostics/mirrorConnectionDiagnostics props, diagnostics stay hidden.
    const htmlNoDiag = renderToStaticMarkup(<AppShell />);
    expect(htmlNoDiag).not.toContain("Data connection test");
    expect(htmlNoDiag).not.toContain("Legacy data catalog");
    expect(htmlNoDiag).not.toContain("Dev connection details");

    // When diagnostics props are passed (dev only), connection details appear in the header
    const htmlWithDiag = renderToStaticMarkup(
      <AppShell bridgeBaseUrl="http://127.0.0.1:17890" bridgeConnectionDiagnostics />,
    );
    if (import.meta.env.DEV) {
      expect(htmlWithDiag).toContain("Dev connection details");
    } else {
      expect(htmlWithDiag).not.toContain("Dev connection details");
    }
  });

  it("shows offline when bridge URL is not configured", () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).toContain("Clinic service offline");
    expect(html).not.toContain("Refresh");
  });

  it("shows checking on first paint when bridge URL is configured", () => {
    const html = renderToStaticMarkup(<AppShell bridgeBaseUrl="http://127.0.0.1:17890" />);
    expect(html).toContain("Checking");
    expect(html).toContain("Refresh");
  });

  it("exposes a labelled navigation list for live modules only", () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).toContain('id="sidebar-nav-label"');
    expect(html).toContain("Main navigation");
    expect(html).toContain("Today");
    expect(html).toContain("Patients");
    expect(html).toContain("Schedule");
    expect(html).toContain("Settings");
    expect(html).not.toMatch(/app-sidebar__btn-label">Dental Chart/);
    expect(html).toContain("app-sidebar__btn-sublabel");
    expect(html).toMatch(/Payments and Reports are not available in this read-only viewer yet/i);
  });

  it("renders page title and workflow-first hero copy on Today", () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).toContain('id="app-main-heading"');
    // CommandCenter hero shows greeting and date
    expect(html).toMatch(/Good (morning|afternoon|evening)/);
    // CommandCenter section renders with actions even when offline
    expect(html).toContain("ui-command");
    expect(html).toContain("Search patient");
  });

  it("does not show Back to Today on the default Today view", () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).not.toContain("app-main__back-today");
  });

  it("shows patient context in the rail when a patient would be selected (class present in shell markup)", () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).toContain("clinic-sidebar__patient");
    expect(html).not.toContain("app-patient-context-bar");
  });

  it("marks the default section with aria-current on the active module control", () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("Today");
  });

  it("shows dynamic read-only viewer label when no clinic name is passed", () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).toContain("Read-only viewer");
    expect(html).not.toMatch(/sample data only/i);
  });

  it("does not surface forbidden sample or PHI field labels in static markup", () => {
    const html = renderToStaticMarkup(<AppShell bridgeBaseUrl="http://127.0.0.1:17890" />);
    expect(html).not.toMatch(/Sample patient/i);
    expect(html).not.toMatch(/sample data only/i);
    assertNoForbiddenDomTokens(html);
  });

  it("shows compact clinic-friendly header pills and capped search width class", () => {
    const html = renderToStaticMarkup(<AppShell />);
    // Header pills removed; connection status shown as subtle dot in sidebar footer
    expect(html).toContain("clinic-sidebar__connection-dot");
    expect(html).toContain("app-rail__connection-pill");
    expect(html).toContain("Clinic service offline");
    expect(html).toContain("clinic-header-search");
    expect(html).toContain('role="status"');
    assertNoMainPageJargonInDom(html);
  });

  it("resolveShellStatusBanners includes write mode when connected", () => {
    const banners = resolveShellStatusBanners("connected", null, {
      writeMode: "dry-run",
      writesPermitted: false,
      writableSandbox: true,
      dataRootConfigured: true,
      backupDirConfigured: false,
      sqlitePathConfigured: false,
    });
    expect(banners.some((b) => b.key === "write-mode-dry-run")).toBe(true);
  });

  it("static markup does not persist recent patients to disk (session UI is client-only)", () => {
    const html = renderToStaticMarkup(<AppShell bridgeBaseUrl="http://127.0.0.1:17890" />);
    expect(html).not.toContain("localStorage");
    expect(html).not.toContain("sessionStorage");
    assertNoForbiddenDomTokens(html);
  });

  it("does not show mirror diagnostic in static markup (dev fetch runs client-side only)", () => {
    const html = renderToStaticMarkup(
      <AppShell
        bridgeBaseUrl="http://127.0.0.1:17890"
        bridgeConnectionDiagnostics
        mirrorConnectionDiagnostics
      />,
    );
    expect(html).not.toContain("Mirror: active");
    expect(html).not.toContain("Mirror: DBF fallback");
  });

  it("retains AppShell navigation wiring for recents and schedule handoff (regression guard)", async () => {
    const fs = await import("node:fs/promises");
    const path = new URL("./AppShell.tsx", import.meta.url);
    const src = await fs.readFile(path, "utf8");
    expect(src).toContain("scheduleInitialDate");
    expect(src).toContain("handleOpenScheduleAtDate");
    expect(src).toContain("handleScheduleInitialDateApplied");
    expect(src).toContain("handleRecentPatientSelect");
    expect(src).toContain("recentPatients={recentPatients}");
    expect(src).toContain("onRecentPatientSelect={handleRecentPatientSelect}");
    expect(src).toContain("onOpenScheduleAtDate={handleOpenScheduleAtDate}");
    expect(src).toContain("initialDate={scheduleInitialDate}");
    expect(src).toContain("onInitialDateApplied={handleScheduleInitialDateApplied}");
    expect(src).toContain("onOpenPatient={handleOpenPatient}");
    expect(src).toMatch(/mirrorStatus=\{mirrorStatus\}/);
  });
});
