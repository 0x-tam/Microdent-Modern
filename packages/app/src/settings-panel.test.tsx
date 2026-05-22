// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsPanel } from "./SettingsPanel.js";
import type { BridgeDevStatusResponse, MirrorStatusResponse } from "@microdent/contracts";
import { assertNoForbiddenDomTokens } from "./read-only-smoke-fixtures.js";
import { MIRROR_IMPORT_STALE_MS } from "./mirror-stale.js";

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

  it("renders pilot build card section", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={writeCapBase}
        mirrorStatus={mirrorEmpty}
        onMirrorStatusChange={() => {}}
      />,
    );
    expect(html).toContain("Pilot build");
    expect(html).toContain("Loading build metadata");
    assertNoForbiddenDomTokens(html);
  });

  it("renders grouped diagnostic sections and absorbed pilot notes", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={{
          ...writeCapBase,
          writeMode: "disabled",
        }}
        mirrorStatus={mirrorWithRuns}
        onMirrorStatusChange={() => {}}
      />,
    );
    expect(html).toContain("Diagnostics");
    expect(html).toContain("Local copy &amp; import");
    expect(html).toContain("Editing &amp; sandbox");
    expect(html).toContain("Backup &amp; recovery");
    expect(html).toContain("Package &amp; build");
    expect(html).toContain("Field test &amp; pilot notes");
    expect(html).toContain("Operator notes");
    expect(html).toContain("Pilot readiness checklist, local copy import");
    expect(html).toContain("Reminders are not in this pilot");
    expect(html).toContain("Local copy ready — search and schedule");
    expect(html).toContain("clinic-settings-readiness-grid");
    assertNoForbiddenDomTokens(html);
  });

  it("shows backup not required note while writes are off", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={{
          ...writeCapBase,
          writeMode: "disabled",
          backupDirConfigured: false,
        }}
        mirrorStatus={mirrorWithRuns}
        onMirrorStatusChange={() => {}}
      />,
    );
    expect(html).toContain("Backup is not required while writes are off");
    assertNoForbiddenDomTokens(html);
  });

  it("shows Windows execution deferred and field test doc in pilot readiness strip", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={{
          ...writeCapBase,
          writeMode: "disabled",
        }}
        mirrorStatus={mirrorWithRuns}
        onMirrorStatusChange={() => {}}
      />,
    );
    expect(html).toContain("Windows execution: Deferred");
    expect(html).toContain("FIELD-TEST-START-HERE.md");
    assertNoForbiddenDomTokens(html);
  });

  it("renders danger banners for enabled writes outside sandbox", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={{
          ...writeCapBase,
          writeMode: "enabled",
          writesPermitted: false,
          writableSandbox: false,
          backupDirConfigured: false,
        }}
        mirrorStatus={mirrorEmpty}
        onMirrorStatusChange={() => {}}
      />,
    );
    expect(html).toContain("app-settings__danger-banners");
    expect(html).toContain("Writes enabled outside sandbox");
    expect(html).toContain("Backup required for commits");
    expect(html).toContain("app-settings__card--warn");
    assertNoForbiddenDomTokens(html);
  });

  it("renders eight-item pilot checklist when connected", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={writeCapBase}
        mirrorStatus={mirrorWithRuns}
        onMirrorStatusChange={() => {}}
      />,
    );
    expect(html).toContain("Pilot checklist");
    expect(html.match(/class="app-settings__checklist-item app-settings__checklist-item--/g)?.length).toBe(8);
    expect(html).toContain("DATA_ROOT safe (not production legacy)");
    expect(html).toContain("Latest mirror import healthy");
    assertNoForbiddenDomTokens(html);
  });

  it("shows mirror stale callout when import metadata is older than 48 hours", () => {
    const staleFinishedAt = new Date(Date.now() - MIRROR_IMPORT_STALE_MS - 60_000).toISOString();
    const staleMirror: MirrorStatusResponse = {
      sqliteConfigured: true,
      sqliteUsable: true,
      importedTables: ["patients"],
      latestImportRuns: [
        {
          tableName: "patients",
          status: "success",
          rowCount: 10,
          errorCount: 0,
          finishedAt: staleFinishedAt,
        },
      ],
    };
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={writeCapBase}
        mirrorStatus={staleMirror}
        onMirrorStatusChange={() => {}}
      />,
    );
    expect(html).toContain("Mirror metadata is older than 48 hours");
    expect(html).toContain("app-settings__card--warn");
    assertNoForbiddenDomTokens(html);
  });

  it("shows pilot build metadata when fetch succeeds", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          packageVersion: "0.9.0-pilot",
          appVersion: "0.9.0",
          gitCommit: "abc1234567890",
          buildTimestampUtc: "2026-05-01T12:00:00.000Z",
          releaseChannel: "pilot",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SettingsPanel
          bridgePhase="connected"
          writeCapability={writeCapBase}
          mirrorStatus={mirrorEmpty}
          onMirrorStatusChange={() => {}}
          fetchImpl={fetchImpl as typeof fetch}
        />,
      );
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("0.9.0-pilot");
    });

    expect(container.textContent).toContain("abc1234");
    expect(container.textContent).toContain("pilot");
    assertNoForbiddenDomTokens(container.textContent ?? "");
    root.unmount();
  });

  it("shows unavailable copy when pilot build fetch fails", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));

    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SettingsPanel
          bridgePhase="connected"
          writeCapability={writeCapBase}
          mirrorStatus={mirrorEmpty}
          onMirrorStatusChange={() => {}}
          fetchImpl={fetchImpl as typeof fetch}
        />,
      );
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Build metadata unavailable");
    });

    assertNoForbiddenDomTokens(container.textContent ?? "");
    root.unmount();
  });
});
