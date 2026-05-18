import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsPanel } from "./SettingsPanel.js";
import type { MirrorStatusResponse } from "@microdent/contracts";

const mirrorWithRuns: MirrorStatusResponse = {
  sqliteConfigured: true,
  sqliteUsable: true,
  importedTables: ["doctors", "patients"],
  latestImportRuns: [
    {
      tableName: "doctors",
      status: "success",
      rowCount: 3,
      errorCount: 0,
      finishedAt: new Date().toISOString(),
    },
    {
      tableName: "patients",
      status: "partial",
      rowCount: 10,
      errorCount: 1,
      finishedAt: new Date().toISOString(),
    },
  ],
};

const mirrorEmpty: MirrorStatusResponse = {
  sqliteConfigured: true,
  sqliteUsable: false,
  importedTables: [],
  latestImportRuns: [],
};

describe("SettingsPanel", () => {
  it("shows bridge offline when not connected", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="offline"
        writeCapability={null}
        mirrorStatus={null}
        onMirrorStatusChange={() => {}}
      />,
    );
    expect(html).toContain("Offline");
    expect(html).toContain("Connect the clinic service");
  });

  it("shows write mode chip and sandbox labels when connected", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={{
          writeMode: "disabled",
          writesPermitted: false,
          writableSandbox: false,
        }}
        mirrorStatus={mirrorEmpty}
        onMirrorStatusChange={() => {}}
        sandboxWritePilot
      />,
    );
    expect(html).toContain("Writes off");
    expect(html).toContain("Sandbox write pilot enabled");
    expect(html).toContain("Using DBF fallback");
  });

  it("lists latest import runs with safe fields only", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={{
          writeMode: "dry-run",
          writesPermitted: false,
          writableSandbox: true,
        }}
        mirrorStatus={mirrorWithRuns}
        onMirrorStatusChange={() => {}}
      />,
    );
    expect(html).toContain("doctors");
    expect(html).toContain("partial");
    expect(html).toContain("Imported tables: 2");
    expect(html).not.toContain("import_errors");
  });

  it("shows placeholder when no import runs recorded", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={{
          writeMode: "enabled",
          writesPermitted: true,
          writableSandbox: true,
        }}
        mirrorStatus={mirrorEmpty}
        onMirrorStatusChange={() => {}}
      />,
    );
    expect(html).toContain("No import runs recorded");
    expect(html).toContain("phase-4-mirror-import-operator.md");
  });

  it("does not render full DATA_ROOT paths in production markup", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        bridgeBaseUrl="http://127.0.0.1:17890"
        writeCapability={{
          writeMode: "enabled",
          writesPermitted: false,
          writableSandbox: false,
        }}
        mirrorStatus={mirrorWithRuns}
        onMirrorStatusChange={() => {}}
        showConnectionDiagnostics={false}
      />,
    );
    expect(html).not.toContain("C:\\Microdent");
    expect(html).not.toContain("/Users/");
    expect(html).toContain("Backup not configured");
  });

  it("includes refresh status control when connected", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        bridgeBaseUrl="http://127.0.0.1:17890"
        writeCapability={{
          writeMode: "disabled",
          writesPermitted: false,
          writableSandbox: false,
        }}
        mirrorStatus={mirrorEmpty}
        onMirrorStatusChange={() => {}}
      />,
    );
    expect(html).toContain("Refresh status");
    expect(html).not.toContain("import-safe");
  });
});
