import type { MirrorStatusResponse } from "@microdent/contracts";

export type LocalCopyIssueTone = "warn" | "error";

export type LocalCopyIssue = {
  tone: LocalCopyIssueTone;
  title: string;
  body: string;
};

const CORE_LOCAL_COPY_TABLES = ["patients", "appointments"] as const;

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function resolveLocalCopyIssue(status: MirrorStatusResponse): LocalCopyIssue | null {
  if (!status.sqliteConfigured) {
    return {
      tone: "warn",
      title: "Local copy not configured",
      body: "Complete setup so Microdent Modern can create the fast local copy outside the install folder.",
    };
  }

  if (!status.sqliteUsable) {
    return {
      tone: "error",
      title: "Local copy unavailable",
      body: "The local copy is missing or unreadable. Refresh the local copy from Settings; if it repeats, export a support log.",
    };
  }

  const failedRuns = status.latestImportRuns.filter((run) => run.status === "failed");
  if (failedRuns.length > 0) {
    return {
      tone: "error",
      title: "Local copy refresh failed",
      body: `${failedRuns.length} ${pluralize(
        failedRuns.length,
        "table",
      )} did not finish. Refresh the local copy; if it repeats, export a support log and ask IT to check copied clinic files.`,
    };
  }

  const partialRuns = status.latestImportRuns.filter((run) => run.status === "partial" || run.errorCount > 0);
  if (partialRuns.length > 0) {
    return {
      tone: "warn",
      title: "Local copy partially refreshed",
      body: `${partialRuns.length} ${pluralize(
        partialRuns.length,
        "table",
      )} refreshed with skipped rows. Search or schedule may omit those rows until the copied clinic files are refreshed.`,
    };
  }

  if (status.sourceChangedSinceImport) {
    return {
      tone: "warn",
      title: "Copied files changed since refresh",
      body: "The copied clinic files changed after the last local copy refresh. Refresh the local copy before relying on search or schedule.",
    };
  }

  const imported = new Set(status.importedTables);
  const missingCoreTables = CORE_LOCAL_COPY_TABLES.filter((table) => !imported.has(table));
  if (missingCoreTables.length > 0 && status.latestImportRuns.length > 0) {
    return {
      tone: "warn",
      title: "Core local copy incomplete",
      body: `Missing ${missingCoreTables.join(", ")} in the local copy. Refresh the local copy before relying on search or schedule.`,
    };
  }

  return null;
}
