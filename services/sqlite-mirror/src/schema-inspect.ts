import { openDatabaseSync } from "./node-sqlite.js";

export function listMirrorTables(sqlitePath: string): string[] {
  return listSqliteMaster(sqlitePath, "table");
}

export function listMirrorIndexes(sqlitePath: string): string[] {
  return listSqliteMaster(sqlitePath, "index");
}

export function listAppliedMigrationVersions(sqlitePath: string): string[] {
  const db = openDatabaseSync(sqlitePath, { readOnly: true });
  try {
    const rows = db
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as Array<{ version: string }>;
    return rows.map((row) => row.version);
  } finally {
    db.close();
  }
}

function listSqliteMaster(sqlitePath: string, type: "table" | "index"): string[] {
  const db = openDatabaseSync(sqlitePath, { readOnly: true });
  try {
    const rows = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all(type) as Array<{ name: string }>;
    return rows.map((row) => row.name);
  } finally {
    db.close();
  }
}
