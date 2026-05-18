import { describe, expect, it } from "vitest";
import {
  resolveBridgeOfflineBanner,
  resolveEnabledNonSandboxBanner,
  resolveMirrorConnectionBanner,
  resolveSandboxWriteWarningBanner,
  resolveSettingsDangerBanners,
  resolveShellStatusBanners,
  resolveWriteModeBanner,
  resolveWriteModeChip,
} from "./shell-status-banners.js";

const capOff = {
  writeMode: "disabled" as const,
  writesPermitted: false,
  writableSandbox: false,
  dataRootConfigured: false,
  backupDirConfigured: false,
  sqlitePathConfigured: false,
};

const capSandbox = {
  writeMode: "enabled" as const,
  writesPermitted: true,
  writableSandbox: true,
  dataRootConfigured: true,
  backupDirConfigured: true,
  sqlitePathConfigured: true,
};

const mirrorActive = {
  sqliteConfigured: true,
  sqliteUsable: true,
  importedTables: ["patients"],
  latestImportRuns: [
    {
      tableName: "patients",
      finishedAt: new Date().toISOString(),
      status: "success" as const,
      rowCount: 1,
      errorCount: 0,
    },
  ],
};

const mirrorFallback = {
  sqliteConfigured: true,
  sqliteUsable: false,
  importedTables: [],
  latestImportRuns: [],
};

const staleFinishedAt = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

const mirrorStale = {
  sqliteConfigured: true,
  sqliteUsable: true,
  importedTables: ["patients"],
  latestImportRuns: [
    {
      tableName: "patients",
      finishedAt: staleFinishedAt,
      status: "success" as const,
      rowCount: 1,
      errorCount: 0,
    },
  ],
};

describe("resolveMirrorConnectionBanner", () => {
  it("returns null when offline or status missing", () => {
    expect(resolveMirrorConnectionBanner("offline", mirrorActive)).toBeNull();
    expect(resolveMirrorConnectionBanner("connected", null)).toBeNull();
  });

  it("prefers stale over active/fallback", () => {
    const banner = resolveMirrorConnectionBanner("connected", mirrorStale);
    expect(banner?.key).toBe("mirror-stale");
    expect(banner?.tone).toBe("warning");
  });

  it("returns fallback when sqlite is not usable", () => {
    const banner = resolveMirrorConnectionBanner("connected", mirrorFallback);
    expect(banner?.key).toBe("mirror-fallback");
  });

  it("returns active when mirror is fresh and usable", () => {
    const banner = resolveMirrorConnectionBanner("connected", mirrorActive);
    expect(banner?.key).toBe("mirror-active");
    expect(banner?.tone).toBe("info");
  });
});

describe("resolveWriteModeBanner", () => {
  it("returns null when not connected", () => {
    expect(resolveWriteModeBanner("offline", capOff)).toBeNull();
  });

  it("maps disabled, dry-run, and enabled", () => {
    expect(resolveWriteModeBanner("connected", capOff)?.key).toBe("write-mode-disabled");
    expect(
      resolveWriteModeBanner("connected", { ...capOff, writeMode: "dry-run", writableSandbox: true })?.tone,
    ).toBe("warning");
    expect(resolveWriteModeBanner("connected", capSandbox)?.tone).toBe("danger");
  });
});

describe("resolveSandboxWriteWarningBanner", () => {
  it("shows only for enabled writable sandbox", () => {
    expect(resolveSandboxWriteWarningBanner("connected", capSandbox)?.key).toBe("sandbox-write-warning");
    expect(
      resolveSandboxWriteWarningBanner("connected", { ...capOff, writeMode: "dry-run", writableSandbox: true }),
    ).toBeNull();
  });
});

describe("resolveShellStatusBanners", () => {
  it("orders mirror, write mode, then sandbox warning", () => {
    const keys = resolveShellStatusBanners("connected", mirrorActive, capSandbox).map((b) => b.key);
    expect(keys).toEqual(["mirror-active", "write-mode-enabled", "sandbox-write-warning"]);
  });
});

describe("resolveEnabledNonSandboxBanner", () => {
  it("shows when writes are enabled without a valid sandbox", () => {
    expect(
      resolveEnabledNonSandboxBanner("connected", {
        writeMode: "enabled",
        writesPermitted: false,
        writableSandbox: false,
        dataRootConfigured: true,
        backupDirConfigured: false,
        sqlitePathConfigured: false,
      })?.key,
    ).toBe("enabled-non-sandbox");
  });
});

describe("resolveSettingsDangerBanners", () => {
  it("includes bridge offline when disconnected", () => {
    const keys = resolveSettingsDangerBanners("offline", null, null).map((b) => b.key);
    expect(keys).toContain("bridge-offline");
  });
});

describe("resolveBridgeOfflineBanner", () => {
  it("returns null when connected", () => {
    expect(resolveBridgeOfflineBanner("connected")).toBeNull();
  });
});

describe("resolveWriteModeChip", () => {
  it("returns null when capability is unknown", () => {
    expect(resolveWriteModeChip(null)).toBeNull();
  });

  it("labels each write mode", () => {
    expect(resolveWriteModeChip(capOff)?.label).toBe("Writes off");
    expect(resolveWriteModeChip({ ...capOff, writeMode: "dry-run", writableSandbox: true })?.variant).toBe("warning");
    expect(resolveWriteModeChip(capSandbox)?.variant).toBe("danger");
  });
});
