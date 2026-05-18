import { beforeEach } from "vitest";

/** Prevent leaked QA shell env from affecting bridge config tests (e.g. WRITE_MODE). */
beforeEach(() => {
  delete process.env.WRITE_MODE;
  delete process.env.ALLOW_LEGACY_WRITES;
  delete process.env.BACKUP_DIR;
  delete process.env.DATA_ROOT;
  delete process.env.SQLITE_PATH;
});
