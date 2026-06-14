import { describe, expect, it } from "vitest";
import type { MirrorStatusResponse } from "@microdent/contracts";
import {
  isMirrorImportStale,
  MIRROR_IMPORT_STALE_MS,
  newestMirrorImportFinishedAtMs,
  resolveMirrorStaleBanner,
} from "./mirror-stale.js";

const freshStatus: MirrorStatusResponse = {
  sqliteConfigured: true,
  sqliteUsable: true,
  importedTables: ["patients"],
  latestImportRuns: [
    {
      tableName: "patients",
      status: "success",
      rowCount: 10,
      errorCount: 0,
      finishedAt: new Date("2026-05-17T12:00:00.000Z").toISOString(),
    },
  ],
};

describe("mirror stale helpers", () => {
  it("detects stale imports from finishedAt metadata", () => {
    const now = Date.parse("2026-05-19T13:00:00.000Z");
    expect(isMirrorImportStale(freshStatus, now, MIRROR_IMPORT_STALE_MS)).toBe(true);
    expect(newestMirrorImportFinishedAtMs(freshStatus.latestImportRuns)).toBe(
      Date.parse("2026-05-17T12:00:00.000Z"),
    );
  });

  it("does not flag fresh imports or DBF fallback", () => {
    const now = Date.parse("2026-05-17T14:00:00.000Z");
    expect(isMirrorImportStale(freshStatus, now, MIRROR_IMPORT_STALE_MS)).toBe(false);

    const fallback: MirrorStatusResponse = {
      sqliteConfigured: true,
      sqliteUsable: false,
      importedTables: [],
      latestImportRuns: freshStatus.latestImportRuns,
    };
    expect(isMirrorImportStale(fallback, now, MIRROR_IMPORT_STALE_MS)).toBe(false);
  });

  it("flags copied file changes even when import timestamps are fresh", () => {
    const now = Date.parse("2026-05-17T14:00:00.000Z");
    expect(
      isMirrorImportStale(
        {
          ...freshStatus,
          sourceChangedSinceImport: true,
        },
        now,
        MIRROR_IMPORT_STALE_MS,
      ),
    ).toBe(true);
  });

  it("returns banner copy only when connected and stale", () => {
    const copy = { label: "Stale", body: "Refresh mirror." };
    const now = Date.parse("2026-05-19T13:00:00.000Z");
    expect(resolveMirrorStaleBanner("connected", freshStatus, copy, now)).toEqual(copy);
    expect(resolveMirrorStaleBanner("offline", freshStatus, copy, now)).toBeNull();
    expect(resolveMirrorStaleBanner("connected", null, copy, now)).toBeNull();
  });
});
