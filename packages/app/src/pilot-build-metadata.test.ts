import { describe, expect, it, vi } from "vitest";
import { parsePilotBuildMetadata, resolvePilotBuildMetadata } from "./pilot-build-metadata.js";

describe("parsePilotBuildMetadata", () => {
  it("parses safe metadata fields only", () => {
    expect(
      parsePilotBuildMetadata({
        appVersion: "0.0.1",
        packageVersion: "pilot-2026-05-21",
        gitCommit: "d3a8565376a58ff6ea5dcaee09f9110648906f37",
        buildTimestampUtc: "2026-05-21T00:00:00.000Z",
        releaseChannel: "pilot",
      }),
    ).toEqual({
      appVersion: "0.0.1",
      packageVersion: "pilot-2026-05-21",
      gitCommit: "d3a8565",
      buildTimestampUtc: "2026-05-21T00:00:00.000Z",
      releaseChannel: "pilot",
    });
  });

  it("rejects payloads missing packageVersion or channel", () => {
    expect(parsePilotBuildMetadata({ appVersion: "0.0.1" })).toBeNull();
    expect(parsePilotBuildMetadata(null)).toBeNull();
  });

  it("never exposes forbidden path tokens in parsed output", () => {
    const parsed = parsePilotBuildMetadata({
      appVersion: "0.0.1",
      packageVersion: "pilot-2026-05-21",
      gitCommit: "abc1234",
      buildTimestampUtc: "2026-05-21T00:00:00.000Z",
      releaseChannel: "pilot",
      leakedPath: "C:\\Microdent\\DATA",
    });
    expect(parsed).not.toBeNull();
    const text = JSON.stringify(parsed);
    expect(text).not.toMatch(/DATA_ROOT|C:\\\\|\/Users\//);
  });
});

describe("resolvePilotBuildMetadata", () => {
  it("fetches /pilot-build.json", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        appVersion: "0.0.1",
        packageVersion: "dev-local",
        gitCommit: "dev0001",
        buildTimestampUtc: "2026-05-21T12:00:00.000Z",
        releaseChannel: "pilot",
      }),
    });
    const metadata = await resolvePilotBuildMetadata(fetchMock as typeof fetch);
    expect(fetchMock).toHaveBeenCalledWith("/pilot-build.json", { cache: "no-store" });
    expect(metadata?.packageVersion).toBe("dev-local");
    expect(metadata?.gitCommit).toBe("dev0001");
  });

  it("returns null when fetch fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    expect(await resolvePilotBuildMetadata(fetchMock as typeof fetch)).toBeNull();
  });
});
