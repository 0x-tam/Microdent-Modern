import { join } from "node:path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

const existsSyncMock = vi.hoisted(() => vi.fn(() => true));
const statSyncMock = vi.hoisted(() =>
  vi.fn(() => ({
    isDirectory: () => true,
    isFile: () => true,
  })),
);

vi.mock("node:fs", () => ({
  existsSync: existsSyncMock,
  statSync: statSyncMock,
}));

import { BridgeSupervisor } from "./bridge-supervisor.js";
import { defaultDesktopConfig } from "./config.js";

const FORBIDDEN_ENV_PATTERNS = [
  /foxpro/i,
  /\.exe$/i,
  /legacy-copy/i,
  /microdent-legacy/i,
];

function envValues(env: NodeJS.ProcessEnv): string[] {
  return Object.entries(env)
    .filter(([, value]) => typeof value === "string")
    .map(([, value]) => value as string);
}

function assertNoForbiddenPaths(env: NodeJS.ProcessEnv): void {
  for (const value of envValues(env)) {
    for (const pattern of FORBIDDEN_ENV_PATTERNS) {
      expect(value).not.toMatch(pattern);
    }
  }
}

describe("BridgeSupervisor spawn env", () => {
  beforeEach(() => {
    spawnMock.mockReset();
    existsSyncMock.mockReset();
    statSyncMock.mockReset();
    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockImplementation(() => ({
      isDirectory: () => true,
      isFile: () => true,
    }));
    spawnMock.mockReturnValue({
      kill: vi.fn(),
      once: vi.fn(),
      on: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true } as Response),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects start when DATA_ROOT and SQLITE_PATH are missing from config", async () => {
    const supervisor = new BridgeSupervisor({
      repoRoot: "/tmp/microdent-repo",
      config: defaultDesktopConfig(),
      nodeBinary: "/usr/bin/node",
    });

    await expect(supervisor.start()).rejects.toThrow(/DATA_ROOT is required/i);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("defaults WRITE_MODE to disabled when writeMode is omitted from config", async () => {
    const supervisor = new BridgeSupervisor({
      repoRoot: "/tmp/microdent-repo",
      config: {
        version: 1,
        dataRoot: "/tmp/sandbox-data",
        sqlitePath: "/tmp/sandbox.sqlite",
      },
      nodeBinary: "/usr/bin/node",
    });

    await supervisor.start();

    const [, args, { env }] = spawnMock.mock.calls[0] as [
      string,
      string[],
      { env: NodeJS.ProcessEnv },
    ];
    expect(args).toEqual([join("/tmp/microdent-repo", "services", "bridge", "dist", "server.js")]);
    expect(env.WRITE_MODE).toBe("disabled");
    assertNoForbiddenPaths(env);
  });

  it("sets BACKUP_DIR when backupDir is configured", async () => {
    const supervisor = new BridgeSupervisor({
      repoRoot: "/tmp/microdent-repo",
      config: {
        version: 1,
        dataRoot: "/tmp/sandbox-data",
        sqlitePath: "/tmp/sandbox.sqlite",
        backupDir: "/tmp/sandbox-backups",
        writeMode: "disabled",
      },
      nodeBinary: "/usr/bin/node",
    });

    await supervisor.start();

    const { env } = spawnMock.mock.calls[0][2] as { env: NodeJS.ProcessEnv };
    expect(env.BACKUP_DIR).toBe("/tmp/sandbox-backups");
    assertNoForbiddenPaths(env);
  });

  it("sets DATA_ROOT and SQLITE_PATH only from operator config", async () => {
    const supervisor = new BridgeSupervisor({
      repoRoot: "/tmp/microdent-repo",
      config: {
        version: 1,
        dataRoot: "/tmp/sandbox-data",
        sqlitePath: "/tmp/sandbox.sqlite",
        writeMode: "dry-run",
        bridgePort: 19999,
      },
      nodeBinary: "/usr/bin/node",
    });

    await supervisor.start();

    const { env } = spawnMock.mock.calls[0][2] as { env: NodeJS.ProcessEnv };
    expect(env.DATA_ROOT).toBe("/tmp/sandbox-data");
    expect(env.SQLITE_PATH).toBe("/tmp/sandbox.sqlite");
    expect(env.WRITE_MODE).toBe("dry-run");
    expect(env.BRIDGE_PORT).toBe("19999");
    assertNoForbiddenPaths(env);
  });

  it("spawns node with bridge dist/server.js only (no shell, no FoxPro)", async () => {
    const supervisor = new BridgeSupervisor({
      repoRoot: "C:\\repos\\Microdent-Modern",
      config: {
        ...defaultDesktopConfig(),
        dataRoot: "C:\\Microdent\\Write-Sandbox\\DATA",
        sqlitePath: "C:\\Microdent\\mirror.sqlite",
      },
      nodeBinary: "C:\\Program Files\\nodejs\\node.exe",
    });

    await supervisor.start();

    const [nodeBin, args, options] = spawnMock.mock.calls[0] as [
      string,
      string[],
      { env: NodeJS.ProcessEnv; stdio: string[]; shell?: boolean },
    ];
    expect(nodeBin).toBe("C:\\Program Files\\nodejs\\node.exe");
    expect(args).toEqual([
      join("C:\\repos\\Microdent-Modern", "services", "bridge", "dist", "server.js"),
    ]);
    expect(options.shell).toBeFalsy();
    expect(options.stdio).toEqual(["ignore", "pipe", "pipe"]);
    for (const arg of args) {
      expect(arg).not.toMatch(/\.(bat|cmd)$/i);
      expect(arg.toLowerCase()).not.toMatch(/foxpro|legacy-copy|microdent-legacy/);
    }
    assertNoForbiddenPaths(options.env);
  });

  it("uiUrl prefers packaged file:// index when web dist exists", () => {
    existsSyncMock.mockImplementation((...args: unknown[]) => {
      const path = String(args[0]);
      return (
        path.endsWith("apps\\web\\dist\\index.html") || path.endsWith("apps/web/dist/index.html")
      );
    });

    const supervisor = new BridgeSupervisor({
      repoRoot: "/tmp/microdent-repo",
      config: defaultDesktopConfig(),
    });

    expect(supervisor.uiUrl).toMatch(/^file:\/\//);
    expect(supervisor.uiUrl).toMatch(/index\.html$/);
  });

  it("uiUrl falls back to bridge HTTP when web dist is missing", () => {
    existsSyncMock.mockReturnValue(false);

    const supervisor = new BridgeSupervisor({
      repoRoot: "/tmp/microdent-repo",
      config: { ...defaultDesktopConfig(), bridgePort: 18888 },
    });

    expect(supervisor.uiUrl).toBe("http://127.0.0.1:18888/");
  });
});
