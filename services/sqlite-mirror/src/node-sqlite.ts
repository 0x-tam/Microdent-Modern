import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function openDatabaseSync(path: string, options?: { readOnly?: boolean }) {
  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  return new DatabaseSync(path, { open: true, readOnly: options?.readOnly ?? false });
}

export type SqliteDatabase = ReturnType<typeof openDatabaseSync>;
