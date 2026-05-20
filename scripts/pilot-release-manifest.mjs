/**
 * Generate RELEASE-MANIFEST.json for staged MicrodentModern package.
 * Content hashes only — no absolute paths, env values, or PHI.
 */
import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { FORBIDDEN_MANIFEST_STRINGS } from "./pilot-release-artifact-rules.mjs";

const MANIFEST_NAME = "RELEASE-MANIFEST.json";
const PILOT_BUILD_JSON = "web/pilot-build.json";
const SCHEMA_VERSION = 1;
const PACKAGE_NAME = "MicrodentModern";
const RELEASE_CHANNEL = "pilot";

/** Static scope lock — mirrored in handoff docs; no clinic PHI. */
export const UNSUPPORTED_FEATURES = [
  "payments",
  "ledger writes",
  "chart writes",
  "in-app mirror import",
  "installer",
];

export function resolvePackageVersion(buildTimestampUtc) {
  const d = new Date(buildTimestampUtc ?? Date.now());
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `pilot-${yyyy}-${mm}-${dd}`;
}

export function buildPilotBuildMetadata(manifest) {
  const commit = manifest.gitCommit ?? "unknown";
  return {
    appVersion: manifest.appVersion,
    packageVersion: manifest.packageVersion,
    gitCommit: commit.length > 7 ? commit.slice(0, 7) : commit,
    buildTimestampUtc: manifest.buildTimestampUtc,
    releaseChannel: manifest.releaseChannel,
  };
}

export function writePilotBuildJson(stageRoot, manifest) {
  const subset = buildPilotBuildMetadata(manifest);
  const json = `${JSON.stringify(subset, null, 2)}\n`;
  assertManifestJsonSafe(json);
  const dest = join(stageRoot, PILOT_BUILD_JSON);
  writeFileSync(dest, json, "utf8");
  return dest;
}

export function resolveGitCommit(repoRoot) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status === 0 && result.stdout?.trim()) {
    return result.stdout.trim();
  }
  return "unknown";
}

export function readAppVersion(repoRoot) {
  const pkgPath = join(repoRoot, "apps", "desktop", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  return pkg.version ?? "0.0.0";
}

function sha256File(absPath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(absPath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function collectFiles(stageRoot) {
  const files = [];
  async function walk(dir, relBase = "") {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs, rel);
        continue;
      }
      if (entry.name === MANIFEST_NAME) {
        continue;
      }
      const stat = statSync(abs);
      const sha256 = await sha256File(abs);
      files.push({
        path: rel.replace(/\\/g, "/"),
        sizeBytes: stat.size,
        sha256,
      });
    }
  }
  await walk(stageRoot);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

export function assertManifestJsonSafe(manifestText) {
  for (const token of FORBIDDEN_MANIFEST_STRINGS) {
    if (manifestText.includes(token)) {
      throw new Error(`manifest contains forbidden token: ${token}`);
    }
  }
}

/**
 * @param {string} stageRoot - absolute path to MicrodentModern/
 * @param {{ repoRoot: string, buildTimestampUtc?: string }} options
 */
export async function generateReleaseManifest(stageRoot, { repoRoot, buildTimestampUtc }) {
  const buildTs = buildTimestampUtc ?? new Date().toISOString();
  const manifestCore = {
    schemaVersion: SCHEMA_VERSION,
    packageName: PACKAGE_NAME,
    appVersion: readAppVersion(repoRoot),
    packageVersion: resolvePackageVersion(buildTs),
    releaseChannel: RELEASE_CHANNEL,
    unsupportedFeatures: [...UNSUPPORTED_FEATURES],
    buildTimestampUtc: buildTs,
    gitCommit: resolveGitCommit(repoRoot),
    safetyNotes: [
      "Hashes cover file bytes only; buildTimestampUtc is not part of hash verification.",
      "Package must not contain clinic DATA, sqlite mirrors, backups, logs, or .env secrets.",
      "Operator paths are configured outside this install tree.",
    ],
  };
  writePilotBuildJson(stageRoot, manifestCore);
  const files = await collectFiles(stageRoot);
  const manifest = {
    ...manifestCore,
    fileCount: files.length,
    files,
  };
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  assertManifestJsonSafe(json);
  const manifestPath = join(stageRoot, MANIFEST_NAME);
  writeFileSync(manifestPath, json, "utf8");
  return { manifestPath, manifest };
}

export async function verifyManifestHashes(stageRoot) {
  const manifestPath = join(stageRoot, MANIFEST_NAME);
  if (!existsSync(manifestPath)) {
    throw new Error("RELEASE-MANIFEST.json missing");
  }
  const raw = readFileSync(manifestPath, "utf8");
  assertManifestJsonSafe(raw);
  const manifest = JSON.parse(raw);
  if (manifest.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`unsupported manifest schemaVersion: ${manifest.schemaVersion}`);
  }
  if (manifest.packageName !== PACKAGE_NAME) {
    throw new Error(`unexpected packageName: ${manifest.packageName}`);
  }
  if (manifest.releaseChannel !== RELEASE_CHANNEL) {
    throw new Error(`unexpected releaseChannel: ${manifest.releaseChannel}`);
  }
  if (!Array.isArray(manifest.unsupportedFeatures) || manifest.unsupportedFeatures.length === 0) {
    throw new Error("manifest unsupportedFeatures missing or empty");
  }
  const files = await collectFiles(stageRoot);
  const liveByPath = new Map(files.map((f) => [f.path, f]));
  if (manifest.fileCount !== manifest.files?.length) {
    throw new Error("manifest fileCount does not match files array length");
  }
  for (const entry of manifest.files) {
    const live = liveByPath.get(entry.path);
    if (!live) {
      throw new Error(`manifest entry missing on disk: ${entry.path}`);
    }
    if (live.sizeBytes !== entry.sizeBytes) {
      throw new Error(`size mismatch for ${entry.path}`);
    }
    if (live.sha256 !== entry.sha256) {
      throw new Error(`hash mismatch for ${entry.path}`);
    }
    liveByPath.delete(entry.path);
  }
  if (liveByPath.size > 0) {
    const extra = [...liveByPath.keys()][0];
    throw new Error(`unmanifested staged file: ${extra}`);
  }
  return manifest;
}

export { MANIFEST_NAME };
