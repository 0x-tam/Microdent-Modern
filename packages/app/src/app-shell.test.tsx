import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell, resolveMirrorDiagnosticLabel, resolveShellClinicLabel } from "./AppShell.js";
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
    expect(html).not.toContain("Dental Chart");
    expect(html).toMatch(/Chart, Treatments, and Ledger preview are under Patients/i);
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
    expect(html).not.toContain("PAT_NAME");
    expect(html).not.toContain("TELEPHONE");
    expect(html).not.toContain("COMMENT");
    expect(html).not.toMatch(/\braw row\b/i);
  });

  it("shows the global privacy note under the read-only banner", () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).toContain("stay hidden in this read-only viewer");
  });

  it("resolveShellStatusBanners includes write mode when connected", () => {
    const banners = resolveShellStatusBanners("connected", null, {
      writeMode: "dry-run",
      writesPermitted: false,
      writableSandbox: true,
    });
    expect(banners.some((b) => b.key === "write-mode-dry-run")).toBe(true);
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
});
