import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell, resolveMirrorDiagnosticLabel, resolveShellClinicLabel } from "./AppShell.js";
import { assertNoForbiddenDomTokens } from "./read-only-smoke-fixtures.js";
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
    expect(html).toContain("Offline");
    expect(html).toContain("app-workspace-shell");
    expect(html).toContain("app-rail");
  });

  it("renders dev-only Today aside panels only when import.meta.env.DEV", () => {
    const html = renderToStaticMarkup(<AppShell />);
    if (import.meta.env.DEV) {
      expect(html).toContain("Data connection test");
      expect(html).toContain("Legacy data catalog");
    } else {
      expect(html).not.toContain("Data connection test");
      expect(html).not.toContain("Legacy data catalog");
    }
  });

  it("shows offline when bridge URL is not configured", () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).toContain("Offline");
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
    expect(html).toMatch(/Payments and Reports are not available yet/i);
  });

  it("renders page title and module description from nav metadata", () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).toContain('id="app-main-heading"');
    expect(html).toMatch(/Schedule overview.*quick actions/);
    expect(html).toContain("Front desk dashboard");
  });

  it("does not show Back to Today on the default Today view", () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).not.toContain("app-main__back-today");
  });

  it("shows patient context in the rail when a patient would be selected (class present in shell markup)", () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).toContain("app-rail__patient");
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

  it("shows read-only viewer pill with privacy note in header", () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).toContain("app-workspace-header__readonly-pill");
    expect(html).toContain("payment amounts stay hidden");
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
