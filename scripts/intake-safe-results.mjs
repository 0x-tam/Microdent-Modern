#!/usr/bin/env node
/**
 * Intake a PHI-safe Windows smoke-results zip returned by an operator.
 *
 * This command does not make roadmap completion ready. It copies the three
 * generated evidence JSON files into qa-runs/ and validates them with the
 * existing package, attachment, and field-evidence gates.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, normalize, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  loadAndValidateEvidenceAttachmentManifest,
} from "./evidence-attachment-manifest.mjs";
import {
  loadAndValidatePackageVerifyEvidence,
} from "./package-verify-evidence.mjs";
import {
  loadAndValidateFieldEvidenceReport,
} from "./windows-field-evidence.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const EXPECTED_PATTERNS = {
  attachment: /^\d{4}-\d{2}-\d{2}-evidence-attachment-manifest-[A-Z0-9._-]+\.json$/i,
  package: /^\d{4}-\d{2}-\d{2}-windows-package-verify-evidence-[A-Z0-9._-]+\.json$/i,
  field: /^\d{4}-\d{2}-\d{2}-windows-field-evidence-[A-Z0-9._-]+\.json$/i,
  report: /^WINDOWS-SMOKE-REPORT\.txt$/i,
};

const FORBIDDEN_EXTENSIONS = new Set([
  ".dbf",
  ".fpt",
  ".cdx",
  ".sqlite",
  ".sqlite3",
  ".env",
  ".log",
  ".zip",
  ".7z",
  ".rar",
]);

function parseArgs(argv) {
  const args = argv.slice(2).filter((arg) => arg !== "--");
  const parsed = {
    zipPath: undefined,
    repoRoot: REPO_ROOT,
    outDir: "qa-runs",
    help: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--repo-root") {
      parsed.repoRoot = args[index + 1] ?? parsed.repoRoot;
      index += 1;
      continue;
    }
    if (arg === "--out-dir") {
      parsed.outDir = args[index + 1] ?? parsed.outDir;
      index += 1;
      continue;
    }
    if (!parsed.zipPath) {
      parsed.zipPath = arg;
    }
  }
  return parsed;
}

function printUsage() {
  console.log(`Usage: node scripts/intake-safe-results.mjs <MicrodentModern-safe-results.zip> [--repo-root <path>] [--out-dir qa-runs]

Copies only the PHI-safe Windows smoke evidence JSON files from the returned
safe-results zip into qa-runs/ and validates package, attachment, and field
evidence. It rejects raw clinic files, unexpected JSON, logs, archives, and
path traversal.
`);
}

function extractZip(zipPath, destDir) {
  if (process.platform === "win32") {
    const result = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "Expand-Archive -LiteralPath $env:MICRODENT_SAFE_RESULTS_ZIP -DestinationPath $env:MICRODENT_SAFE_RESULTS_DEST -Force",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          MICRODENT_SAFE_RESULTS_ZIP: zipPath,
          MICRODENT_SAFE_RESULTS_DEST: destDir,
        },
      },
    );
    if (result.status !== 0) {
      throw new Error(`could not expand safe-results bundle: ${result.stderr || result.stdout || "Expand-Archive failed"}`);
    }
    return;
  }

  const result = spawnSync("unzip", ["-q", zipPath, "-d", destDir], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`could not unzip safe-results bundle: ${result.stderr || result.stdout || "unzip failed"}`);
  }
}

function safeDestination(root, relPath) {
  const normalized = normalize(relPath).replace(/\\/g, "/");
  if (normalized.startsWith("../") || normalized === ".." || isAbsolute(normalized)) {
    throw new Error(`unsafe output path: ${relPath}`);
  }
  return resolve(root, normalized);
}

function walkFiles(dir, relBase = "") {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(abs, rel));
    } else {
      files.push({ abs, rel: rel.replace(/\\/g, "/"), name: entry.name });
    }
  }
  return files;
}

function readText(path) {
  return readFileSync(path, "utf8");
}

function rejectUnsafeExtractedFiles(files) {
  const errors = [];
  for (const file of files) {
    const normalized = normalize(file.rel).replace(/\\/g, "/");
    if (normalized.startsWith("../") || normalized === ".." || normalized.includes("/../")) {
      errors.push(`unsafe path in zip: ${file.rel}`);
    }
    if (normalized.includes("/")) {
      errors.push(`unexpected nested file in safe-results zip: ${file.rel}`);
    }
    const extension = extname(file.name).toLowerCase();
    if (FORBIDDEN_EXTENSIONS.has(extension)) {
      errors.push(`forbidden file type in safe-results zip: ${file.name}`);
    }
    const allowed =
      EXPECTED_PATTERNS.report.test(file.name)
      || EXPECTED_PATTERNS.attachment.test(file.name)
      || EXPECTED_PATTERNS.package.test(file.name)
      || EXPECTED_PATTERNS.field.test(file.name);
    if (!allowed) {
      errors.push(`unexpected file in safe-results zip: ${file.name}`);
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

function findOne(files, key) {
  const matches = files.filter((file) => EXPECTED_PATTERNS[key].test(file.name));
  if (matches.length !== 1) {
    throw new Error(`expected exactly one ${key} file, found ${matches.length}`);
  }
  return matches[0];
}

function copyEvidenceFile(file, outDir) {
  const dest = safeDestination(outDir, file.name);
  writeFileSync(dest, readFileSync(file.abs));
  return dest;
}

function validateEvidenceSet(repoRoot, rel) {
  const attachmentResult = loadAndValidateEvidenceAttachmentManifest(rel.attachment, { repoRoot });
  const packageResult = loadAndValidatePackageVerifyEvidence(rel.package, { repoRoot });
  const fieldResult = loadAndValidateFieldEvidenceReport(rel.field, { repoRoot });
  return {
    ok: attachmentResult.ok && packageResult.ok && fieldResult.ok,
    status: attachmentResult.ok && packageResult.ok && fieldResult.ok ? fieldResult.status : "blocked",
    validators: {
      attachment: attachmentResult,
      package: packageResult,
      field: fieldResult,
    },
  };
}

function assertNoForbiddenReportTokens(reportFile) {
  const text = readText(reportFile.abs);
  const forbidden = [
    /\bPAT_NAME\b/i,
    /\bTELEPHONE\b/i,
    /\bCOMMENT\b\s*[:=]/i,
    /\b(patientName|patient_name|chartNumber|chart_number|phoneNumber|phone_number)\b/i,
    /Microdent-Legacy/i,
    /\/Users\/|\/home\/|[A-Z]:\\Users\\/i,
    /\.(dbf|fpt|cdx|sqlite|sqlite3|env|log)\b/i,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      throw new Error(`WINDOWS-SMOKE-REPORT.txt contains forbidden token: ${pattern}`);
    }
  }
}

export function intakeSafeResultsZip(zipPath, {
  repoRoot = REPO_ROOT,
  outDir = "qa-runs",
} = {}) {
  if (normalize(outDir).replace(/\\/g, "/") !== "qa-runs") {
    throw new Error("outDir must be qa-runs because returned evidence references qa-runs/ paths");
  }
  const absZip = isAbsolute(zipPath) ? zipPath : resolve(process.cwd(), zipPath);
  if (!existsSync(absZip) || !statSync(absZip).isFile()) {
    throw new Error(`safe-results zip not found: ${zipPath}`);
  }
  const absRepoRoot = resolve(repoRoot);
  const absOutDir = safeDestination(absRepoRoot, outDir);
  mkdirSync(absOutDir, { recursive: true });

  const tmp = mkdtempSync(join(tmpdir(), "microdent-safe-results-"));
  try {
    extractZip(absZip, tmp);
    const files = walkFiles(tmp);
    rejectUnsafeExtractedFiles(files);
    const report = findOne(files, "report");
    const attachment = findOne(files, "attachment");
    const packageEvidence = findOne(files, "package");
    const fieldEvidence = findOne(files, "field");
    assertNoForbiddenReportTokens(report);

    const rel = {
      attachment: `qa-runs/${attachment.name}`,
      package: `qa-runs/${packageEvidence.name}`,
      field: `qa-runs/${fieldEvidence.name}`,
    };

    const validationRoot = join(tmp, "validation-root");
    const validationQaRuns = join(validationRoot, "qa-runs");
    mkdirSync(validationQaRuns, { recursive: true });
    copyEvidenceFile(attachment, validationQaRuns);
    copyEvidenceFile(packageEvidence, validationQaRuns);
    copyEvidenceFile(fieldEvidence, validationQaRuns);

    const validation = validateEvidenceSet(validationRoot, rel);
    if (!validation.ok) {
      return {
        ok: false,
        status: "blocked",
        copied: {},
        validators: validation.validators,
      };
    }

    copyEvidenceFile(attachment, absOutDir);
    copyEvidenceFile(packageEvidence, absOutDir);
    copyEvidenceFile(fieldEvidence, absOutDir);

    return {
      ok: true,
      status: validation.status,
      copied: rel,
      validators: validation.validators,
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function printResult(result) {
  console.log(result.ok ? "SAFE RESULTS INTAKE: READY" : "SAFE RESULTS INTAKE: BLOCKED");
  console.log(`field_status=${result.validators.field.status}`);
  console.log(`copied_attachment=${result.copied.attachment ?? "not-copied"}`);
  console.log(`copied_package=${result.copied.package ?? "not-copied"}`);
  console.log(`copied_field=${result.copied.field ?? "not-copied"}`);
  for (const [name, validator] of Object.entries(result.validators)) {
    for (const warning of validator.warnings ?? []) {
      console.warn(`[safe-results-intake] WARN ${name}: ${warning}`);
    }
    for (const error of validator.errors ?? []) {
      console.error(`[safe-results-intake] FAIL ${name}: ${error}`);
    }
  }
}

function main(argv) {
  const parsed = parseArgs(argv);
  if (parsed.help || !parsed.zipPath) {
    printUsage();
    return parsed.help ? 0 : 2;
  }
  try {
    const result = intakeSafeResultsZip(parsed.zipPath, {
      repoRoot: parsed.repoRoot,
      outDir: parsed.outDir,
    });
    printResult(result);
    return result.ok ? 0 : 1;
  } catch (err) {
    console.error("SAFE RESULTS INTAKE: BLOCKED");
    console.error(`[safe-results-intake] FAIL: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
