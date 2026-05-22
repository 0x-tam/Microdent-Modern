import { describe, expect, it } from "vitest";
import {
  omitShellBannersDetailedInSettings,
  resolveContextualStatusForModule,
  resolveShellCriticalStripBanners,
  resolveShellHeaderMirrorPill,
  resolveBackupNotConfiguredBanner,
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

describe("resolveBackupNotConfiguredBanner", () => {
  it("shows when writes are enabled without BACKUP_DIR", () => {
    expect(
      resolveBackupNotConfiguredBanner("connected", {
        writeMode: "enabled",
        writesPermitted: true,
        writableSandbox: true,
        dataRootConfigured: true,
        backupDirConfigured: false,
        sqlitePathConfigured: true,
      })?.key,
    ).toBe("backup-not-configured");
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

  it("includes mirror fallback, enabled writes, and non-sandbox danger when applicable", () => {
    const keys = resolveSettingsDangerBanners("connected", mirrorFallback, {
      writeMode: "enabled",
      writesPermitted: false,
      writableSandbox: false,
      dataRootConfigured: true,
      backupDirConfigured: false,
      sqlitePathConfigured: true,
    }).map((b) => b.key);
    expect(keys).toContain("mirror-fallback");
    expect(keys).toContain("write-mode-enabled");
    expect(keys).toContain("enabled-non-sandbox");
  });
});

describe("omitShellBannersDetailedInSettings", () => {
  it("removes shell banners that Settings danger callouts expand", () => {
    const shell = resolveShellStatusBanners("connected", mirrorFallback, capSandbox);
    const filtered = omitShellBannersDetailedInSettings(shell, "connected", mirrorFallback, capSandbox);
    const keys = filtered.map((b) => b.key);
    expect(keys).not.toContain("mirror-fallback");
    expect(keys).not.toContain("write-mode-enabled");
    expect(keys).not.toContain("sandbox-write-warning");
  });

  it("keeps informational shell banners when Settings duplicates warnings only", () => {
    const shell = resolveShellStatusBanners("connected", mirrorActive, capOff);
    const filtered = omitShellBannersDetailedInSettings(shell, "connected", mirrorActive, capOff);
    expect(filtered.map((b) => b.key)).toEqual(["mirror-active", "write-mode-disabled"]);
  });
});

describe("resolveShellHeaderMirrorPill", () => {
  it("uses clinic-friendly Local copy chip with detail labels", () => {
    expect(resolveShellHeaderMirrorPill("offline", mirrorActive).label).toBe("Local copy");
    expect(resolveShellHeaderMirrorPill("connected", mirrorStale).tone).toBe("warn");
    expect(resolveShellHeaderMirrorPill("connected", mirrorStale).detailLabel).toMatch(/outdated/i);
    expect(resolveShellHeaderMirrorPill("connected", mirrorFallback).detailLabel).toMatch(/copied clinic files/i);
    expect(resolveShellHeaderMirrorPill("connected", mirrorActive).tone).toBe("ok");
    expect(resolveShellHeaderMirrorPill("connected", mirrorActive).detailLabel).toMatch(/ready/i);
  });
});

describe("resolveContextualStatusForModule", () => {
  it("shows only danger banners on Today (mirror/write info lives in header pills)", () => {
    const today = resolveContextualStatusForModule("today", "connected", mirrorFallback, capSandbox);
    expect(today.every((b) => b.tone === "danger")).toBe(true);
    expect(today.map((b) => b.key)).not.toContain("mirror-fallback");
  });

  it("omits Settings-detail banners on Settings module", () => {
    const settings = resolveContextualStatusForModule("settings", "connected", mirrorFallback, capSandbox);
    const keys = settings.map((b) => b.key);
    expect(keys).not.toContain("mirror-fallback");
    expect(keys).not.toContain("sandbox-write-warning");
  });
});

describe("resolveShellCriticalStripBanners", () => {
  it("includes bridge offline on the critical strip when disconnected", () => {
    const critical = resolveShellCriticalStripBanners("today", "offline", null, null);
    expect(critical.map((b) => b.key)).toContain("bridge-offline");
    expect(critical.every((b) => b.tone === "danger")).toBe(true);
  });

  it("matches danger-only contextual banners when connected", () => {
    const critical = resolveShellCriticalStripBanners("today", "connected", mirrorFallback, capSandbox);
    const contextual = resolveContextualStatusForModule("today", "connected", mirrorFallback, capSandbox);
    expect(critical).toEqual(contextual);
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
