import { verifyLegacyBackup, printLegacyBackupVerifyReport } from "../backup/verify-legacy-backup.js";
import { parseDataRootFromValue } from "../config.js";

function printHelp(): void {
  console.error("Usage:");
  console.error("  BACKUP_MANIFEST=/path/to/backup-folder pnpm legacy:backup-verify");
  console.error("  BACKUP_MANIFEST=/path/to/backup-folder DATA_ROOT=/path/to/DATA pnpm legacy:backup-verify");
  console.error("");
  console.error("Read-only: checks manifest.json hashes against files/ (and optionally live DATA_ROOT).");
}

async function main(): Promise<void> {
  const backupFolder = process.env.BACKUP_MANIFEST?.trim();
  if (!backupFolder) {
    console.error("ERROR: BACKUP_MANIFEST must be set to the backup folder path.");
    printHelp();
    process.exit(1);
  }

  let dataRoot: string | undefined;
  const dataRootEnv = process.env.DATA_ROOT?.trim();
  if (dataRootEnv) {
    const parsed = parseDataRootFromValue(dataRootEnv);
    if (!parsed.configured) {
      console.error("ERROR: DATA_ROOT must be a non-empty absolute path.");
      process.exit(1);
    }
    dataRoot = parsed.path;
  }

  try {
    const result = await verifyLegacyBackup({ backupFolder, dataRoot });
    printLegacyBackupVerifyReport(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "verify failed";
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }
}

main().catch(() => {
  console.error("ERROR: legacy backup verify failed");
  process.exit(1);
});
