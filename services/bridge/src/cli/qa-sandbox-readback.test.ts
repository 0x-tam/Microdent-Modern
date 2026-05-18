import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeScheduleFixtures } from "../test-fixtures/schedule-fixtures.js";

const bridgeRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const cliEntry = join(bridgeRoot, "dist", "cli", "qa-sandbox-readback.js");

function runReadback(
  dataRoot: string,
  command: string,
  id: string,
): { stdout: string; status: number } {
  try {
    const stdout = execFileSync(process.execPath, [cliEntry, command, id], {
      env: { ...process.env, DATA_ROOT: dataRoot },
      encoding: "utf8",
      cwd: bridgeRoot,
    });
    return { stdout: stdout.trim(), status: 0 };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { stdout: (e.stdout ?? "").trim(), status: e.status ?? 1 };
  }
}

describe("qa-sandbox-readback CLI", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("schedule-status returns STATUS from SCHEDULE.DBF", async () => {
    dir = mkdtempSync(join(tmpdir(), "qa-readback-"));
    await writeScheduleFixtures(dir);
    const { stdout, status } = runReadback(dir, "schedule-status", "1001");
    expect(status).toBe(0);
    expect(stdout).toBe("1");
  });

  it("schedule-exists reports ok for known appointment id", async () => {
    dir = mkdtempSync(join(tmpdir(), "qa-readback-"));
    await writeScheduleFixtures(dir);
    const { stdout, status } = runReadback(dir, "schedule-exists", "1001");
    expect(status).toBe(0);
    expect(stdout).toBe("ok");
  });

  it("patient-chart returns CASENB only", async () => {
    dir = mkdtempSync(join(tmpdir(), "qa-readback-"));
    await writeScheduleFixtures(dir);
    const { stdout, status } = runReadback(dir, "patient-chart", "50001");
    expect(status).toBe(0);
    expect(stdout).toBe("SCH-ALPHA");
  });
});
