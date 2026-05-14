import type { ZodError, ZodIssue } from "zod";

function shouldLogResponseSchemaDiagnostics(): boolean {
  const env =
    typeof globalThis !== "undefined" && "process" in globalThis
      ? (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV
      : undefined;
  return env === "development" || env === "test";
}

function safeIssueSummary(issue: ZodIssue): { path: string; code: string; expected?: string; received?: string } {
  const path = issue.path.length ? issue.path.join(".") : "(root)";
  if (issue.code === "invalid_type") {
    return {
      path,
      code: issue.code,
      expected: issue.expected,
      received: issue.received,
    };
  }
  return { path, code: issue.code };
}

/**
 * Dev/test only: logs schema paths and type expectations — never logs response values or patient fields.
 */
export function logResponseSchemaMismatch(endpointPath: string, json: unknown, error: ZodError): void {
  if (!shouldLogResponseSchemaDiagnostics()) return;
  const q = endpointPath.indexOf("?");
  const endpoint = q === -1 ? endpointPath : endpointPath.slice(0, q);
  const topLevelKeys =
    json !== null && typeof json === "object" && !Array.isArray(json) ? Object.keys(json as Record<string, unknown>) : [];
  let resultCount: number | undefined;
  if (json !== null && typeof json === "object" && "results" in (json as object)) {
    const r = (json as { results?: unknown }).results;
    if (Array.isArray(r)) resultCount = r.length;
  }
  console.warn("[@microdent/bridge-client] response schema mismatch", {
    endpoint,
    topLevelKeys,
    resultCount,
    issueCount: error.issues.length,
    issues: error.issues.map(safeIssueSummary),
  });
}
