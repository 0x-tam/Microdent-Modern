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
    expect(html).toContain("Read-only");
    expect(html).toContain("Sandbox write pilot enabled");
    expect(html).toContain("Using copied clinic files");
    expect(html).toContain("Clinic data folder configured");
    expect(html).toContain("Copied clinic files remain the source of truth");
  });

  it("shows desktop restart quick fix only when desktop action is available", () => {
    const withoutAction = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={writeCapBase}
        mirrorStatus={mirrorEmpty}
        onMirrorStatusChange={() => {}}
      />,
    );
    expect(withoutAction).not.toContain("Restart clinic service");

    const withAction = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={writeCapBase}
        mirrorStatus={mirrorEmpty}
        onMirrorStatusChange={() => {}}
        desktopActions={{ restartClinicService: async () => ({ ok: true }) }}
      />,
    );
    expect(withAction).toContain("Restart clinic service");
  });

  it("runs desktop restart quick fix and shows success copy", async () => {
    const restartClinicService = vi.fn(async () => ({ ok: true }));
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
          desktopActions={{ restartClinicService }}
        />,
      );
    });

    const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Restart clinic service"),
    ) as HTMLButtonElement | undefined;
    expect(button).toBeTruthy();

    await act(async () => {
      button?.click();
    });

    expect(restartClinicService).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Clinic service restarted");
    await act(async () => {
      root.unmount();
    });
  });

  it("runs desktop local copy refresh and shows progress/success copy", async () => {
    const refreshLocalCopy = vi.fn(async () => ({ ok: true }));
    let progressListener: ((progress: { label: string; percent: number }) => void) | null = null;
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
          desktopActions={{
            refreshLocalCopy,
            onLocalCopyRefreshProgress: (listener) => {
              progressListener = listener;
              return () => {
                progressListener = null;
              };
            },
          }}
        />,
      );
    });

    const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Refresh local copy"),
    ) as HTMLButtonElement | undefined;
    expect(button).toBeTruthy();

    await act(async () => {
      button?.click();
      progressListener?.({ label: "Loading patients", percent: 58 });
    });

    expect(refreshLocalCopy).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Local copy refreshed");
    await act(async () => {
      root.unmount();
    });
  });

  it("runs desktop support log export without showing a raw path", async () => {
    const exportSupportLog = vi.fn(async () => ({
      ok: true,
      fileName: "microdent-support-log-2026-06-06T01-02-03-000Z.jsonl",
      lineCount: 3,
    }));
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
          desktopActions={{ exportSupportLog }}
        />,
      );
    });

    const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Export support log"),
    ) as HTMLButtonElement | undefined;
    expect(button).toBeTruthy();

    await act(async () => {
      button?.click();
    });

    expect(exportSupportLog).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Support log exported");
    expect(container.textContent).toContain("microdent-support-log-2026-06-06T01-02-03-000Z.jsonl");
    expect(container.textContent).not.toContain("/Users/");
    expect(container.textContent).not.toContain("C:\\");
    await act(async () => {
      root.unmount();
    });
  });

  it("runs desktop service port diagnostic and shows safe result copy", async () => {
    const diagnoseClinicServicePort = vi.fn(async () => ({
      ok: true,
      configuredPort: 17890,
      activePort: 17891,
      configuredPortState: "responding" as const,
      activePortState: "responding" as const,
      message: "Clinic service is running on a backup port because the configured port is occupied.",
    }));
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
          desktopActions={{ diagnoseClinicServicePort }}
        />,
      );
    });

    const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Check service port"),
    ) as HTMLButtonElement | undefined;
    expect(button).toBeTruthy();

    await act(async () => {
      button?.click();
    });

    expect(diagnoseClinicServicePort).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("backup port");
    expect(container.textContent).not.toContain("PID");
    expect(container.textContent).not.toContain("kill");
    await act(async () => {
      root.unmount();
    });
  });

  it("shows safe port cleanup policy without destructive process controls", async () => {
    const getPortCleanupPolicy = vi.fn(async () => ({
      ok: true,
      title: "Safe clinic service port cleanup policy",
      canAutoClean: false as const,
      configuredPort: 17890,
      activePort: 17891,
      message: "Microdent Modern will not close unknown processes. This protects clinic workstations.",
      steps: [
        "Use Restart clinic service first; it only restarts Microdent Modern's own local service.",
        "Ask IT to identify the process using Windows tools.",
      ],
      escalation: "Escalate to IT/support when another application owns the configured port.",
    }));
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
          desktopActions={{ getPortCleanupPolicy }}
        />,
      );
    });

    const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("View port cleanup policy"),
    ) as HTMLButtonElement | undefined;
    expect(button).toBeTruthy();

    await act(async () => {
      button?.click();
    });

    expect(getPortCleanupPolicy).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Automatic cleanup: off");
    expect(container.textContent).toContain("Restart clinic service first");
    expect(container.textContent).toContain("Ask IT");
    expect(container.textContent).not.toMatch(/\bPID\b/i);
    expect(container.textContent).not.toMatch(/\bkill\b/i);
    expect(container.textContent).not.toMatch(/\btaskkill\b/i);
    await act(async () => {
      root.unmount();
    });
  });

  it("loads desktop support diagnostics summary without showing raw paths", async () => {
    const getSupportDiagnostics = vi.fn(async () => ({
      ok: true,
      message: "Diagnostics summary loaded.",
      logFileCount: 2,
      supportExportCount: 1,
      crashDumpCount: 2,
      crashDumpFiles: [
        {
          fileName: "crash-2026-06-06.dmp",
          kind: "dump" as const,
          sizeBytes: 2048,
          updatedAt: "2026-06-06T01:02:04.000Z",
        },
        {
          fileName: "crash-details.extra",
          kind: "metadata" as const,
          sizeBytes: 512,
          updatedAt: "2026-06-06T01:02:05.000Z",
        },
      ],
      latestLogUpdatedAt: "2026-06-06T01:02:03.000Z",
      latestCrashDumpUpdatedAt: "2026-06-06T01:02:05.000Z",
      latestSupportExportFileName: "microdent-support-log-2026-06-06T01-02-03-000Z.jsonl",
    }));
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
          desktopActions={{ getSupportDiagnostics }}
        />,
      );
    });

    const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("View diagnostics summary"),
    ) as HTMLButtonElement | undefined;
    expect(button).toBeTruthy();

    await act(async () => {
      button?.click();
    });

    expect(getSupportDiagnostics).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Log files: 2");
    expect(container.textContent).toContain("Crash dumps: 2");
    expect(container.textContent).toContain("Recent crash files");
    expect(container.textContent).toContain("crash-2026-06-06.dmp");
    expect(container.textContent).toContain("2 KB");
    expect(container.textContent).toContain("crash-details.extra");
    expect(container.textContent).toContain("microdent-support-log-2026-06-06T01-02-03-000Z.jsonl");
    expect(container.textContent).not.toContain("/Users/");
    expect(container.textContent).not.toContain("C:\\");
    await act(async () => {
      root.unmount();
    });
  });

  it("previews sanitized support log events without showing raw paths", async () => {
    const previewSupportLog = vi.fn(async () => ({
      ok: true,
      message: "Support log preview loaded.",
      fileName: "microdent-support-log-2026-06-06T01-02-03-000Z.jsonl",
      lineCount: 2,
      lines: [
        { index: 1, level: "info", event: "desktop_start", summary: "writeMode=disabled, dataRoot=<path>" },
        { index: 2, level: "warn", event: "clinic_service_port_shift", summary: "requestedPort=17890" },
      ],
    }));
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
          desktopActions={{ previewSupportLog }}
        />,
      );
    });

    const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Preview support log"),
    ) as HTMLButtonElement | undefined;
    expect(button).toBeTruthy();

    await act(async () => {
      button?.click();
    });

    expect(previewSupportLog).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Previewing 2 sanitized support events");
    expect(container.textContent).toContain("desktop_start");
    expect(container.textContent).toContain("dataRoot=<path>");
    expect(container.textContent).not.toContain("/Users/");
    expect(container.textContent).not.toContain("C:\\");
    await act(async () => {
      root.unmount();
    });
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
    expect(html).toContain("Local copy partially refreshed");
    expect(html).toContain("Imported tables: 2");
    expect(html).not.toContain("import_errors");
    expect(html).not.toContain("<th scope=\"col\">Errors</th>");
  });

  it("shows operator-safe failed local copy guidance", () => {
    const failedMirror: MirrorStatusResponse = {
      sqliteConfigured: true,
      sqliteUsable: true,
      importedTables: ["doctors"],
      latestImportRuns: [
        {
          tableName: "patients",
          status: "failed",
          rowCount: 0,
          errorCount: 4,
          finishedAt: new Date().toISOString(),
        },
      ],
    };
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={writeCapBase}
        mirrorStatus={failedMirror}
        onMirrorStatusChange={() => {}}
      />,
    );

    expect(html).toContain("Local copy refresh failed");
    expect(html).toContain("export a support log");
    expect(html).not.toContain("DATA_ROOT");
    expect(html).not.toContain("SQLITE_PATH");
    expect(html).not.toContain("/Users/");
    expect(html).not.toContain("C:\\");
  });

  it("shows operator-safe incomplete local copy guidance", () => {
    const incompleteMirror: MirrorStatusResponse = {
      sqliteConfigured: true,
      sqliteUsable: true,
      importedTables: ["doctors"],
      latestImportRuns: [
        {
          tableName: "doctors",
          status: "success",
          rowCount: 2,
          errorCount: 0,
          finishedAt: new Date().toISOString(),
        },
      ],
    };
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        writeCapability={writeCapBase}
        mirrorStatus={incompleteMirror}
        onMirrorStatusChange={() => {}}
      />,
    );

    expect(html).toContain("Core local copy incomplete");
    expect(html).toContain("patients, appointments");
    expect(html).toContain("Refresh the local copy");
    assertNoForbiddenDomTokens(html);
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
    expect(html).toContain("PILOT-HANDOFF-PACK.md");
    expect(html).toContain("Refresh the local copy");
  });

  it("does not render full clinic data paths in production markup", () => {
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
    expect(html).toContain("Clinic data folder configured");
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
    expect(html).toContain("Fast local copy");
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

  it("keeps primary Settings copy free of bridge and mirror internals", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        bridgePhase="connected"
        bridgeBaseUrl="http://127.0.0.1:17890"
        writeCapability={{
          ...writeCapBase,
          writeMode: "disabled",
        }}
        mirrorStatus={mirrorWithRuns}
        onMirrorStatusChange={() => {}}
        showConnectionDiagnostics={false}
      />,
    );

    expect(html).toContain("Clinic service");
    expect(html).toContain("Local copy");
    expect(html).not.toMatch(/\bBridge URL\b/);
    expect(html).not.toMatch(/\bSQLite mirror\b/);
    expect(html).not.toMatch(/\bDATA_ROOT\b/);
    expect(html).not.toMatch(/\bDBF fallback\b/);
    expect(html).not.toMatch(/\bMirror (active|stale|unavailable|status|metadata|import)\b/);
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
    expect(html).toContain("Clinic data folder safe (not production legacy)");
    expect(html).toContain("Latest local copy refresh healthy");
    assertNoForbiddenDomTokens(html);
  });

  it("shows local copy stale callout when import metadata is older than 48 hours", () => {
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
    expect(html).toContain("Local copy metadata is older than 48 hours");
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
