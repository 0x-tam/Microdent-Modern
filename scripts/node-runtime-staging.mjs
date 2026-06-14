#!/usr/bin/env node
/**
 * Validate a pre-downloaded Node runtime before it is bundled in a pilot package.
 * No network access, no downloads, no source paths in output manifests.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const MIN_NODE_RUNTIME_VERSION = "22.5.0";

function parseVersion(value) {
  const match = String(value).trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    raw: `v${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`,
  };
}

function compareVersion(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return Number.NaN;
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

function parseVersionFromRuntimePath(runtimeDir) {
  const candidates = [basename(runtimeDir), basename(dirname(runtimeDir))];
  for (const candidate of candidates) {
    const match = candidate.match(/node-v?(\d+\.\d+\.\d+)/i);
    if (match) {
      return parseVersion(match[1]);
    }
  }
  return null;
}

export function findNodeRuntimeBinary(runtimeDir, platform = process.platform) {
  const candidates =
    platform === "win32"
      ? [join(runtimeDir, "node.exe")]
      : [join(runtimeDir, "bin", "node"), join(runtimeDir, "node"), join(runtimeDir, "node.exe")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function validateNodeRuntimeDir(options) {
  const runtimeDir = options.runtimeDir;
  const platform = options.platform ?? process.platform;
  const hostPlatform = options.hostPlatform ?? process.platform;
  const minVersion = options.minVersion ?? MIN_NODE_RUNTIME_VERSION;
  const expectedSha256 = options.expectedSha256;
  const hasCustomSpawn = Boolean(options.spawnSyncImpl);
  const spawn = options.spawnSyncImpl ?? spawnSync;

  if (!runtimeDir?.trim()) {
    throw new Error("Node runtime directory is required.");
  }
  if (!existsSync(runtimeDir)) {
    throw new Error("Node runtime directory does not exist.");
  }

  const nodeBinary = findNodeRuntimeBinary(runtimeDir, platform);
  if (!nodeBinary) {
    throw new Error("Node runtime must contain node.exe, node, or bin/node.");
  }

  let version;
  const isCrossStagedWindowsRuntime =
    platform === "win32" &&
    hostPlatform !== "win32" &&
    !hasCustomSpawn &&
    basename(nodeBinary).toLowerCase() === "node.exe";
  if (isCrossStagedWindowsRuntime) {
    if (!expectedSha256) {
      throw new Error("Cross-staged Windows Node runtime requires expected node.exe SHA-256.");
    }
    const actualSha256 = createHash("sha256").update(readFileSync(nodeBinary)).digest("hex");
    if (actualSha256.toLowerCase() !== String(expectedSha256).toLowerCase()) {
      throw new Error("Cross-staged Windows Node runtime SHA-256 mismatch.");
    }
    version = parseVersionFromRuntimePath(runtimeDir);
    if (!version) {
      throw new Error("Cross-staged Windows Node runtime folder name must include node-v<version>.");
    }
  } else {
    const versionResult = spawn(nodeBinary, ["--version"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (versionResult.error || versionResult.status !== 0) {
      throw new Error("Node runtime version check failed.");
    }
    version = parseVersion(versionResult.stdout);
  }
  if (!version) {
    throw new Error("Node runtime returned an invalid version.");
  }
  if (compareVersion(version.raw, minVersion) < 0) {
    throw new Error(`Node runtime must be ${minVersion} or newer.`);
  }

  return {
    version: version.raw,
    minVersion,
    executableRelPath: relative(runtimeDir, nodeBinary).replace(/\\/g, "/"),
    runtimeKind: platform === "win32" ? "windows-x64" : "portable",
    ...(isCrossStagedWindowsRuntime
      ? { nodeBinarySha256: String(expectedSha256).toLowerCase() }
      : {}),
  };
}

export function writeNodeRuntimeManifest(destDir, validation) {
  const manifest = {
    name: "Microdent Modern bundled Node runtime",
    version: validation.version,
    minVersion: validation.minVersion,
    executableRelPath: validation.executableRelPath,
    runtimeKind: validation.runtimeKind,
    ...(validation.nodeBinarySha256 ? { nodeBinarySha256: validation.nodeBinarySha256 } : {}),
    purpose: "clinic-service and local-copy import runtime",
  };
  writeFileSync(join(destDir, "RUNTIME-MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

function fail(message) {
  console.error(`[node-runtime-staging] FAIL: ${message}`);
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  const runtimeDir =
    args[args.indexOf("--runtime-dir") + 1] && args.includes("--runtime-dir")
      ? args[args.indexOf("--runtime-dir") + 1]
      : process.env.MICRODENT_NODE_RUNTIME_DIR;
  const manifestDir =
    args[args.indexOf("--write-manifest") + 1] && args.includes("--write-manifest")
      ? args[args.indexOf("--write-manifest") + 1]
      : null;
  const json = args.includes("--json");
  const expectedSha256 =
    args[args.indexOf("--expected-sha256") + 1] && args.includes("--expected-sha256")
      ? args[args.indexOf("--expected-sha256") + 1]
      : process.env.MICRODENT_NODE_RUNTIME_SHA256;

  try {
    const validation = validateNodeRuntimeDir({ runtimeDir, expectedSha256 });
    if (manifestDir) {
      writeNodeRuntimeManifest(manifestDir, validation);
    }
    if (json) {
      process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
    } else {
      process.stdout.write(
        `[node-runtime-staging] OK: ${validation.version} (${validation.executableRelPath})\n`,
      );
    }
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}

if (process.argv[1] && basename(process.argv[1]) === basename(fileURLToPath(import.meta.url))) {
  if (dirname(process.argv[1]) === dirname(fileURLToPath(import.meta.url))) {
    main();
  }
}
