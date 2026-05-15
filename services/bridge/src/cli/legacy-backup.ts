import {
  formatSupportedWorkflows,
  loadBackupEnvFromProcess,
} from "../backup/backup-env.js";
import { printLegacyBackupReport, runLegacyBackup } from "../backup/run-legacy-backup.js";

function printEnvHelp(missing: ("DATA_ROOT" | "BACKUP_DIR" | "WORKFLOW")[]): void {
  const vars = missing.join(", ");
  console.error(`ERROR: ${vars} must be set.`);
  console.error("");
  console.error("Example:");
  console.error('  export DATA_ROOT="/absolute/path/to/disposable/DATA"');
  console.error('  export BACKUP_DIR="/absolute/path/to/backups"');
  console.error('  export WORKFLOW="appointment.statusUpdate"');
  console.error("  pnpm legacy:backup");
  console.error("");
  console.error(`Supported workflows: ${formatSupportedWorkflows()}`);
}

async function main(): Promise<void> {
  let loaded;
  try {
    loaded = loadBackupEnvFromProcess();
  } catch (e) {
    const message = e instanceof Error ? e.message : "invalid environment";
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }

  if (!loaded.ok) {
    printEnvHelp(loaded.missing);
    process.exit(1);
  }

  try {
    const result = await runLegacyBackup(loaded.env);
    printLegacyBackupReport(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "backup failed";
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }
}

main().catch(() => {
  console.error("ERROR: legacy backup failed");
  process.exit(1);
});
