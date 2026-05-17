import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => true),
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

  it("passes WRITE_MODE disabled and omits DATA_ROOT/SQLITE_PATH when config has no paths", async () => {
    const supervisor = new BridgeSupervisor({
      repoRoot: "/tmp/microdent-repo",
      config: defaultDesktopConfig(),
      nodeBinary: "/usr/bin/node",
    });

    await supervisor.start();

    expect(spawnMock).toHaveBeenCalledOnce();
    const [, args, options] = spawnMock.mock.calls[0] as [
      string,
      string[],
      { env: NodeJS.ProcessEnv },
    ];
    expect(args[0]).toMatch(/server\.js$/);
    const { env } = options;
    expect(env.WRITE_MODE).toBe("disabled");
    expect(env.BRIDGE_HOST).toBe("127.0.0.1");
    expect(env.BRIDGE_PORT).toBe("17890");
    expect(env.NODE_ENV).toBe("production");
    expect(env.DATA_ROOT).toBeUndefined();
    expect(env.SQLITE_PATH).toBeUndefined();
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
});
