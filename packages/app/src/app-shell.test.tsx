import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell } from "./AppShell.js";

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
});
