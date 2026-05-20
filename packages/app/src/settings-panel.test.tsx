import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsPanel } from "./SettingsPanel.js";
import type { BridgeDevStatusResponse, MirrorStatusResponse } from "@microdent/contracts";
import { assertNoForbiddenDomTokens } from "./read-only-smoke-fixtures.js";

const writeCapBase: BridgeDevStatusResponse = {
  writeMode: "disabled",
  writesPermitted: false,
  writableSandbox: false,
  dataRootConfigured: true,
  backupDirConfigured: false,
  sqlitePathConfigured: true,
};

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
    expect(html).toContain("Clinic service offline");
    expect(html).toContain("Connect the clinic service");
  });

  it("shows write mode chip and sandbox labels when connected", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={{
          ...writeCapBase,
          writeMode: "disabled",
        }}
        mirrorStatus={mirrorEmpty}
        onMirrorStatusChange={() => {}}
        sandboxWritePilot
      />,
    );
    expect(html).toContain("Writes off");
    expect(html).toContain("Sandbox write pilot enabled");
    expect(html).toContain("Using DBF fallback");
    expect(html).toContain("DATA_ROOT configured");
    expect(html).toContain("DBF files are the source of truth");
  });

  it("lists latest import runs with status badges and safe fields only", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={{
          ...writeCapBase,
          writeMode: "dry-run",
          writableSandbox: true,
        }}
        mirrorStatus={mirrorWithRuns}
        onMirrorStatusChange={() => {}}
      />,
    );
    expect(html).toContain("doctors");
    expect(html).toContain("Partial");
    expect(html).toContain("Imported tables: 2");
    expect(html).not.toContain("import_errors");
    expect(html).not.toContain("<th scope=\"col\">Errors</th>");
  });

  it("shows placeholder when no import runs recorded", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={{
          ...writeCapBase,
          writeMode: "enabled",
          writesPermitted: true,
          writableSandbox: true,
          backupDirConfigured: true,
        }}
        mirrorStatus={mirrorEmpty}
        onMirrorStatusChange={() => {}}
      />,
    );
    expect(html).toContain("No import runs recorded");
    expect(html).toContain("phase-4-mirror-import-operator.md");
    expect(html).toContain("Run safe import from the command line");
  });

  it("does not render full DATA_ROOT paths in production markup", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        bridgeBaseUrl="http://127.0.0.1:17890"
        writeCapability={{
          ...writeCapBase,
          writeMode: "enabled",
          writableSandbox: false,
          backupDirConfigured: false,
        }}
        mirrorStatus={mirrorWithRuns}
        onMirrorStatusChange={() => {}}
        showConnectionDiagnostics={false}
      />,
    );
    expect(html).not.toContain("C:\\Microdent");
    expect(html).not.toContain("/Users/");
    expect(html).not.toContain("Write-Sandbox");
    expect(html).toContain("Backup not configured");
    expect(html).toContain("DATA_ROOT configured");
    assertNoForbiddenDomTokens(html);
  });

  it("shows masked path hints when connection diagnostics are enabled", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={writeCapBase}
        mirrorStatus={mirrorWithRuns}
        onMirrorStatusChange={() => {}}
        showConnectionDiagnostics
      />,
    );
    expect(html).toContain("Write-Sandbox");
    expect(html).not.toContain("C:\\Microdent\\Write-Sandbox");
  });

  it("includes refresh status control when connected", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        bridgeBaseUrl="http://127.0.0.1:17890"
        writeCapability={writeCapBase}
        mirrorStatus={mirrorEmpty}
        onMirrorStatusChange={() => {}}
      />,
    );
    expect(html).toContain("Refresh status");
    expect(html).toContain("SQLite mirror");
    expect(html).toMatch(/app-settings__cli-hint/);
  });

  it("renders desktop mode card copy", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={writeCapBase}
        mirrorStatus={mirrorEmpty}
        onMirrorStatusChange={() => {}}
      />,
    );
    expect(html).toContain("Desktop app");
    expect(html).toMatch(/browser|desktop/i);
  });
});
