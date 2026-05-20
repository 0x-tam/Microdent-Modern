export type PilotBuildMetadata = {
  appVersion: string;
  packageVersion: string;
  gitCommit: string;
  buildTimestampUtc: string;
  releaseChannel: string;
};

const PILOT_BUILD_JSON_PATH = "/pilot-build.json";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Parse staged or dev pilot-build.json payload (no paths). */
export function parsePilotBuildMetadata(raw: unknown): PilotBuildMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (!isNonEmptyString(data.packageVersion) || !isNonEmptyString(data.releaseChannel)) {
    return null;
  }
  const commit = isNonEmptyString(data.gitCommit) ? data.gitCommit : "unknown";
  return {
    appVersion: isNonEmptyString(data.appVersion) ? data.appVersion : "unknown",
    packageVersion: data.packageVersion,
    gitCommit: commit.length > 7 ? commit.slice(0, 7) : commit,
    buildTimestampUtc: isNonEmptyString(data.buildTimestampUtc) ? data.buildTimestampUtc : "",
    releaseChannel: data.releaseChannel,
  };
}

/** Fetch /pilot-build.json — dev public copy or staged web/pilot-build.json. */
export async function resolvePilotBuildMetadata(
  fetchImpl: typeof fetch = fetch,
): Promise<PilotBuildMetadata | null> {
  try {
    const response = await fetchImpl(PILOT_BUILD_JSON_PATH, { cache: "no-store" });
    if (!response.ok) return null;
    const json: unknown = await response.json();
    return parsePilotBuildMetadata(json);
  } catch {
    return null;
  }
}
