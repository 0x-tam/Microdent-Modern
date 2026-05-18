import { describe, expect, it } from "vitest";
import {
  resolveMirrorConnectionBanner,
  resolveSandboxWriteWarningBanner,
  resolveShellStatusBanners,
  resolveWriteModeBanner,
  resolveWriteModeChip,
} from "./shell-status-banners.js";

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
    expect(
      resolveWriteModeBanner("offline", {
        writeMode: "disabled",
        writesPermitted: false,
        writableSandbox: false,
      }),
    ).toBeNull();
  });

  it("maps disabled, dry-run, and enabled", () => {
    expect(
      resolveWriteModeBanner("connected", {
        writeMode: "disabled",
        writesPermitted: false,
        writableSandbox: false,
      })?.key,
    ).toBe("write-mode-disabled");
    expect(
      resolveWriteModeBanner("connected", {
        writeMode: "dry-run",
        writesPermitted: false,
        writableSandbox: true,
      })?.tone,
    ).toBe("warning");
    expect(
      resolveWriteModeBanner("connected", {
        writeMode: "enabled",
        writesPermitted: true,
        writableSandbox: true,
      })?.tone,
    ).toBe("danger");
  });
});

describe("resolveSandboxWriteWarningBanner", () => {
  it("shows only for enabled writable sandbox", () => {
    expect(
      resolveSandboxWriteWarningBanner("connected", {
        writeMode: "enabled",
        writesPermitted: true,
        writableSandbox: true,
      })?.key,
    ).toBe("sandbox-write-warning");
    expect(
      resolveSandboxWriteWarningBanner("connected", {
        writeMode: "dry-run",
        writesPermitted: false,
        writableSandbox: true,
      }),
    ).toBeNull();
  });
});

describe("resolveShellStatusBanners", () => {
  it("orders mirror, write mode, then sandbox warning", () => {
    const keys = resolveShellStatusBanners(
      "connected",
      mirrorActive,
      { writeMode: "enabled", writesPermitted: true, writableSandbox: true },
    ).map((b) => b.key);
    expect(keys).toEqual(["mirror-active", "write-mode-enabled", "sandbox-write-warning"]);
  });
});

describe("resolveWriteModeChip", () => {
  it("returns null when capability is unknown", () => {
    expect(resolveWriteModeChip(null)).toBeNull();
  });

  it("labels each write mode", () => {
    expect(resolveWriteModeChip({ writeMode: "disabled", writesPermitted: false, writableSandbox: false })?.label).toBe(
      "Writes off",
    );
    expect(resolveWriteModeChip({ writeMode: "dry-run", writesPermitted: false, writableSandbox: true })?.variant).toBe(
      "warning",
    );
    expect(resolveWriteModeChip({ writeMode: "enabled", writesPermitted: true, writableSandbox: true })?.variant).toBe(
      "danger",
    );
  });
});
