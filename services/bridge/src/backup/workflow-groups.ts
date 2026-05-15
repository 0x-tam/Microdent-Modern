/** Table sidecars copied per workflow (basename, include when present on disk). */
export type BackupMember = {
  readonly fileName: string;
  readonly required: boolean;
};

export const BACKUP_WORKFLOW_GROUPS: Record<string, readonly BackupMember[]> = {
  "appointment.statusUpdate": [
    { fileName: "SCHEDULE.DBF", required: true },
    { fileName: "SCHEDULE.FPT", required: false },
    { fileName: "SCHEDULE.CDX", required: false },
  ],
};

export function listSupportedBackupWorkflows(): string[] {
  return Object.keys(BACKUP_WORKFLOW_GROUPS);
}

export function resolveBackupMembers(workflow: string): readonly BackupMember[] {
  const members = BACKUP_WORKFLOW_GROUPS[workflow];
  if (!members) {
    throw new Error(`unsupported WORKFLOW: ${JSON.stringify(workflow)}`);
  }
  return members;
}
