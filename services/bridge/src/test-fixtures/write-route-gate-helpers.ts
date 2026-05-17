import { createServer } from "node:http";
import { chmodSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { expect } from "vitest";
import type { BridgeConfigInput } from "../config.js";
import { createBridgeApp } from "../app.js";
import { parseBackupDirFromValue, parseDataRootFromValue, type DataRootSet } from "../config.js";
import { writeScheduleFixtures } from "./schedule-fixtures.js";
import { writeSandboxMarker } from "./write-sandbox.js";

/** Ephemeral HTTP server for in-process bridge route tests. */
export async function withHttpServer(
  app: ReturnType<typeof createBridgeApp>,
  fn: (port: number) => Promise<void>,
): Promise<void> {
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("expected port");
  try {
    await fn(addr.port);
  } finally {
    server.close();
    await once(server, "close");
  }
}

/** Asserts SafeWritePlan JSON never leaks PHI, row payloads, or synthetic fixture tokens. */
export function assertSafeWritePlanJson(text: string): void {
  expect(text).not.toMatch(/SYNTHETIC_/);
  expect(text).not.toMatch(/"before"\s*:/i);
  expect(text).not.toMatch(/"after"\s*:/i);
  expect(text).not.toMatch(/"rawRow"/i);
  expect(text).not.toMatch(/"PAT_NAME"/i);
  expect(text).not.toMatch(/"TELEPHONE"/i);
  expect(text).not.toMatch(/"COMMENT"/i);
  expect(text).not.toMatch(/"HOME_PHONE"/i);
  expect(text).not.toMatch(/"(amount|balance|fee|charge)"/i);
}

export type EnabledSandboxHandles = {
  tmp: string;
  backupRoot: string;
  dataRoot: DataRootSet;
  schedPath: string;
  patientPath: string;
  app: ReturnType<typeof createBridgeApp>;
};

export type EnabledSandboxOptions = {
  /** Prefix for mkdtemp (e.g. `bridge-time-gate-`). */
  prefix: string;
  /** When false, skips `.microdent-write-sandbox` marker (default true). */
  withMarker?: boolean;
  /** When set, chmod backup dir before the callback (e.g. 0o500 for backup failure). */
  backupDirMode?: number;
  /** Extra bridge config merged into the enabled sandbox app. */
  bridgeConfig?: Partial<BridgeConfigInput>;
};

/**
 * Disposable enabled sandbox: temp DATA_ROOT + BACKUP_DIR, schedule fixtures, optional marker.
 * Caller must `vi.stubEnv("ALLOW_LEGACY_WRITES", ...)` before invoking when ack matters.
 */
export async function withEnabledSandboxServer(
  opts: EnabledSandboxOptions,
  fn: (handles: EnabledSandboxHandles & { port: number }) => Promise<void>,
): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), opts.prefix));
  const backupRoot = mkdtempSync(join(tmpdir(), `${opts.prefix}backup-`));
  try {
    await writeScheduleFixtures(tmp);
    if (opts.withMarker !== false) {
      writeSandboxMarker(tmp);
    }
    const dataRoot = parseDataRootFromValue(tmp);
    if (!dataRoot.configured) throw new Error("data root");
    const schedPath = join(tmp, "SCHEDULE.DBF");
    const patientPath = join(tmp, "PATIENT.DBF");

    if (opts.backupDirMode !== undefined) {
      chmodSync(backupRoot, opts.backupDirMode);
    }

    const app = createBridgeApp("v-test", {
      bridgeConfig: {
        listen: { host: "127.0.0.1", port: 0 },
        dataRoot,
        backupDir: parseBackupDirFromValue(backupRoot),
        writeMode: "enabled",
        ...opts.bridgeConfig,
      },
    });

    await withHttpServer(app, async (port) => {
      await fn({ tmp, backupRoot, dataRoot, schedPath, patientPath, app, port });
    });
  } finally {
    if (opts.backupDirMode !== undefined) {
      try {
        chmodSync(backupRoot, 0o700);
      } catch {
        /* tmpdir may already be gone */
      }
    }
    rmSync(tmp, { recursive: true, force: true });
    rmSync(backupRoot, { recursive: true, force: true });
  }
}
