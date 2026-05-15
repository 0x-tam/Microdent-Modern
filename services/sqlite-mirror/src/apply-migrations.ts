import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabaseSync, type SqliteDatabase } from "./node-sqlite.js";

const MIN_NODE_MAJOR = 22;
const MIN_NODE_MINOR = 5;

export type ApplyMigrationsResult = {
  sqlitePath: string;
  appliedVersions: string[];
  skippedVersions: string[];
};

function assertNodeSqliteAvailable(): void {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor < MIN_NODE_MINOR)) {
    throw new Error(
      `@microdent/sqlite-mirror requires Node ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}.0 or newer ` +
        `(built-in node:sqlite). Current: ${process.versions.node}. ` +
        `See docs/phase-2-sqlite-schema.md for the driver decision.`,
    );
  }
}

function migrationsDirectory(): string {
  return join(fileURLToPath(new URL("../sql/migrations", import.meta.url)));
}

function listMigrationFiles(): string[] {
  return readdirSync(migrationsDirectory())
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

function migrationVersion(filename: string): string {
  return filename.replace(/\.sql$/u, "");
}

function ensureSchemaMigrationsTable(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT NOT NULL PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

function appliedVersions(db: SqliteDatabase): Set<string> {
  ensureSchemaMigrationsTable(db);
  const rows = db.prepare("SELECT version FROM schema_migrations").all() as Array<{
    version: string;
  }>;
  return new Set(rows.map((row) => row.version));
}

function recordMigration(db: SqliteDatabase, version: string): void {
  db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
    version,
    new Date().toISOString(),
  );
}

/**
 * Applies versioned SQL migrations to the SQLite file at `sqlitePath`.
 * Creates parent directories when missing. Idempotent: already-applied versions are skipped.
 */
export function applyMigrations(sqlitePath: string): ApplyMigrationsResult {
  assertNodeSqliteAvailable();

  mkdirSync(dirname(sqlitePath), { recursive: true });

  const db = openDatabaseSync(sqlitePath);
  try {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");

    const done = appliedVersions(db);
    const applied: string[] = [];
    const skipped: string[] = [];

    for (const filename of listMigrationFiles()) {
      const version = migrationVersion(filename);
      if (done.has(version)) {
        skipped.push(version);
        continue;
      }

      const sql = readFileSync(join(migrationsDirectory(), filename), "utf8");
      db.exec("BEGIN IMMEDIATE;");
      try {
        db.exec(sql);
        recordMigration(db, version);
        db.exec("COMMIT;");
        done.add(version);
        applied.push(version);
      } catch (error) {
        db.exec("ROLLBACK;");
        throw error;
      }
    }

    return { sqlitePath, appliedVersions: applied, skippedVersions: skipped };
  } finally {
    db.close();
  }
}
