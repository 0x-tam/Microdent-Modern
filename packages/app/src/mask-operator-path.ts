/**
 * Masks absolute operator paths for dev-only Settings hints.
 * Never use in production UI — gate behind `import.meta.env.DEV` or diagnostics flags.
 */

const UNC_PREFIX = /^\\\\/;

function splitPathSegments(path: string): string[] {
  const normalized = path.trim().replace(/\//g, "\\");
  if (!normalized) return [];
  if (UNC_PREFIX.test(normalized)) {
    const withoutPrefix = normalized.slice(2);
    return withoutPrefix.split("\\").filter(Boolean);
  }
  return normalized.split("\\").filter(Boolean);
}

/**
 * Returns a shortened path hint such as `C:\...\Write-Sandbox\DATA` or `…/mirror.sqlite`.
 * Home directories, full UNC hosts, and long middle segments are collapsed.
 */
export function maskOperatorPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "…";

  const normalized = trimmed.replace(/\//g, "\\");

  if (UNC_PREFIX.test(normalized)) {
    const segments = splitPathSegments(trimmed);
    const tail = segments.slice(-2);
    if (tail.length === 0) return "\\\\…";
    return `\\\\…\\${tail.join("\\")}`;
  }

  const segments = splitPathSegments(trimmed);
  if (segments.length === 0) return "…";

  const first = segments[0] ?? "";
  const driveMatch = /^[A-Za-z]:/.exec(first);
  if (driveMatch) {
    const drive = first.slice(0, 2).toUpperCase();
    const rest = first.length > 2 ? [first.slice(2), ...segments.slice(1)] : segments.slice(1);
    const tail = rest.filter(Boolean).slice(-2);
    if (tail.length === 0) return `${drive}\\…`;
    return `${drive}\\…\\${tail.join("\\")}`;
  }

  if (normalized.startsWith("~") || normalized.includes("/Users/") || normalized.includes("\\Users\\")) {
    const tail = segments.slice(-2);
    return tail.length ? `…\\${tail.join("\\")}` : "…";
  }

  const tail = segments.slice(-2);
  return tail.length ? `…\\${tail.join("\\")}` : "…";
}

/** Example hints for dev diagnostics when live paths are not exposed. */
export const MASKED_PATH_HINT_EXAMPLES = {
  dataRoot: "C:\\...\\Write-Sandbox\\DATA",
  sqlite: "C:\\...\\Microdent\\mirror.sqlite",
  backup: "C:\\...\\Microdent\\backups",
} as const;
