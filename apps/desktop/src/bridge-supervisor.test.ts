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
  // Track fetch calls: first batch are port checks (should appear free),
  // then health checks (should succeed once bridge "starts").
  let portCheckPhase = true;
  let healthCalls = 0;
  const HEALTH_CHECK_THRESHOLD = 3; // port checks (3) then health checks succeed

  beforeEach(() => {
    spawnMock.mockReset();
    existsSyncMock.mockReset();
    statSyncMock.mockReset();
    portCheckPhase = true;
    healthCalls = 0;
    existsSyncMock.mockImplementation((path: unknown) => {
      const value = String(path);
      if (value.endsWith("bridge/server.js") || value.endsWith("bridge\\server.js")) {
        return false;
      }
      return true;
    });
    statSyncMock.mockImplementation(() => ({
      isDirectory: () => true,
      isFile: () => true,
    }));
    spawnMock.mockReturnValue({
      kill: vi.fn(),
      once: vi.fn(),
      on: vi.fn(),
    });
    // fetch mock: port checks appear free (reject), then health checks succeed
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        healthCalls++;
        if (healthCalls <= HEALTH_CHECK_THRESHOLD) {
          // Port conflict check — simulate connection refused (port is free)
          throw new Error("ECONNREFUSED");
        }
        // Health check after bridge started
        return { ok: true };
      }),
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
    vi.stubEnv("ALLOW_LEGACY_WRITES", "I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY");
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
    expect(env.ALLOW_LEGACY_WRITES).toBeUndefined();
    expect(Object.keys(env)).not.toContain("ALLOW_LEGACY_WRITES");
    assertNoForbiddenPaths(env);
    vi.unstubAllEnvs();
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

  it("uses packaged Node runtime when no explicit nodeBinary is provided", async () => {
    existsSyncMock.mockImplementation((path: unknown) => {
      const value = String(path);
      if (value.endsWith("bridge/server.js") || value.endsWith("bridge\\server.js")) {
        return true;
      }
      if (value.endsWith("node/node.exe") || value.endsWith("node\\node.exe")) {
        return true;
      }
      if (value.endsWith("Write-Sandbox\\DATA") || value.endsWith("Write-Sandbox/DATA")) {
        return true;
      }
      if (value.endsWith("mirror.sqlite")) {
        return true;
      }
      return false;
    });

    const supervisor = new BridgeSupervisor({
      repoRoot: "C:\\Program Files\\MicrodentModern",
      config: {
        ...defaultDesktopConfig(),
        dataRoot: "C:\\Microdent\\Write-Sandbox\\DATA",
        sqlitePath: "C:\\Microdent\\mirror.sqlite",
      },
      platform: "win32",
    });

    await supervisor.start();

    const [nodeBin, args] = spawnMock.mock.calls[0] as [string, string[]];
    expect(nodeBin).toBe(join("C:\\Program Files\\MicrodentModern", "node", "node.exe"));
    expect(args).toEqual([join("C:\\Program Files\\MicrodentModern", "bridge", "server.js")]);
  });

  it("lets explicit nodeBinary override packaged runtime", async () => {
    existsSyncMock.mockImplementation((path: unknown) => {
      const value = String(path);
      if (value.endsWith("bridge/server.js") || value.endsWith("bridge\\server.js")) {
        return true;
      }
      if (value.endsWith("node/node.exe") || value.endsWith("node\\node.exe")) {
        return true;
      }
      if (value.endsWith("Write-Sandbox\\DATA") || value.endsWith("Write-Sandbox/DATA")) {
        return true;
      }
      if (value.endsWith("mirror.sqlite")) {
        return true;
      }
      return false;
    });

    const supervisor = new BridgeSupervisor({
      repoRoot: "C:\\Program Files\\MicrodentModern",
      config: {
        ...defaultDesktopConfig(),
        dataRoot: "C:\\Microdent\\Write-Sandbox\\DATA",
        sqlitePath: "C:\\Microdent\\mirror.sqlite",
      },
      nodeBinary: "D:\\Support\\node.exe",
      platform: "win32",
    });

    await supervisor.start();

    const [nodeBin] = spawnMock.mock.calls[0] as [string, string[]];
    expect(nodeBin).toBe("D:\\Support\\node.exe");
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
