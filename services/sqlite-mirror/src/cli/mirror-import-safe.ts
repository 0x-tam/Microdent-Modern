import { loadMirrorEnvFromProcess } from "../mirror-env.js";
import { printMirrorImportSafeReport, runMirrorImportSafe } from "../run-mirror-import-safe.js";

function printEnvHelp(missing: ("DATA_ROOT" | "SQLITE_PATH")[]): void {
  const vars = missing.join(" and ");
  console.error(`ERROR: ${vars} must be set to absolute paths.`);
  console.error("");
  console.error("Example:");
  console.error('  export DATA_ROOT="/absolute/path/to/read-only/DATA-copy"');
  console.error('  export SQLITE_PATH="/absolute/path/to/MICRODENT_MIRROR.sqlite"');
  console.error("  pnpm mirror:import-safe");
}

async function main(): Promise<void> {
  let loaded;
  try {
    loaded = loadMirrorEnvFromProcess();
  } catch (e) {
    const message = e instanceof Error ? e.message : "invalid environment";
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }

  if (!loaded.ok) {
    printEnvHelp(loaded.missing);
    process.exit(1);
  }

  const result = await runMirrorImportSafe(loaded.env);
  printMirrorImportSafeReport(result);

  if (result.overall === "failed") {
    process.exit(1);
  }
}

main().catch(() => {
  console.error("ERROR: mirror import failed");
  process.exit(1);
});
