import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell, resolveShellClinicLabel } from "./AppShell.js";

describe("resolveShellClinicLabel", () => {
  it("uses an explicit clinic label when provided", () => {
    expect(resolveShellClinicLabel("offline", "Demo clinic")).toBe("Demo clinic");
    expect(resolveShellClinicLabel("connected", "Demo clinic")).toBe("Demo clinic");
  });

  it("uses the connected copy when no clinic label and bridge is connected", () => {
    expect(resolveShellClinicLabel("connected", undefined)).toBe("Connected to copied clinic data");
  });

  it("uses read-only preview when no clinic label and bridge is not connected", () => {
    expect(resolveShellClinicLabel("offline", undefined)).toBe("Read-only preview");
    expect(resolveShellClinicLabel("checking", undefined)).toBe("Read-only preview");
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

  it("includes the synthetic fixture data connection test on Today", () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).toContain("Data connection test");
    expect(html).toContain("Synthetic fixture only");
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

  it("exposes a labelled navigation list for modules", () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).toContain('id="sidebar-nav-label"');
    expect(html).toContain("Main navigation");
    expect(html).toContain("Today");
    expect(html).toContain("Dental Chart");
    expect(html).toContain("Treatments");
    expect(html).toContain("Settings");
  });

  it("marks the default section with aria-current on the active module control", () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("Today");
  });

  it("shows dynamic read-only preview label when no clinic name is passed", () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).toContain("Read-only preview");
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
    expect(html).toContain("Names, notes, and phone numbers are hidden in this preview.");
  });
});
