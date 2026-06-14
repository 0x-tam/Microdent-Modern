#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";

const [, , sqlitePath, sql] = process.argv;

if (!sqlitePath || !sql) {
  console.error("usage: sqlite-query.mjs <sqlite-path> <sql>");
  process.exit(64);
}

let db;
try {
  db = new DatabaseSync(sqlitePath, { readOnly: true });
  const rows = db.prepare(sql).all();
  for (const row of rows) {
    const values = Object.values(row).map((value) => (value === null || value === undefined ? "" : String(value)));
    console.log(values.join("|"));
  }
} catch {
  process.exit(1);
} finally {
  db?.close();
}
