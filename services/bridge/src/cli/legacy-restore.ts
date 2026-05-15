import { loadRestoreEnvFromProcess } from "../backup/restore-env.js";
import { printLegacyRestoreReport, runLegacyRestore } from "../backup/run-legacy-restore.js";
import { WriteSandboxError } from "../write-safety/index.js";

function printEnvHelp(missing: ("BACKUP_MANIFEST" | "DATA_ROOT")[]): void {
  const vars = missing.join(", ");
  console.error(`ERROR: ${vars} must be set.`);
  console.error("");
  console.error("Example:");
  console.error('  export BACKUP_MANIFEST="/absolute/path/to/backup/folder"');
  console.error('  export DATA_ROOT="/absolute/path/to/disposable/DATA"');
  console.error("  pnpm legacy:restore");
  console.error("");
  console.error("DATA_ROOT must be a disposable write sandbox (.microdent-write-sandbox.json).");
  console.error("Never point DATA_ROOT at Microdent-Legacy or Microdent-Legacy-Copy.");
}

function formatError(e: unknown): string {
  if (e instanceof WriteSandboxError) {
    return e.message;
  }
  return e instanceof Error ? e.message : "restore failed";
}

async function main(): Promise<void> {
  let loaded;
  try {
    loaded = loadRestoreEnvFromProcess();
  } catch (e) {
    console.error(`ERROR: ${formatError(e)}`);
    process.exit(1);
  }

  if (!loaded.ok) {
    printEnvHelp(loaded.missing);
    process.exit(1);
  }

  try {
    const result = await runLegacyRestore(loaded.env);
    printLegacyRestoreReport(result);
  } catch (e) {
    console.error(`ERROR: ${formatError(e)}`);
    process.exit(1);
  }
}

main().catch(() => {
  console.error("ERROR: legacy restore failed");
  process.exit(1);
});
