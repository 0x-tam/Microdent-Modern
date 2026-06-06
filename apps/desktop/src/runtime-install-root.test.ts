import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  resolveBridgeEntry,
  resolveInstallRoot,
  resolveImportNodeBinary,
  resolvePackagedNodeBinary,
  resolveSqliteMirrorJsonCli,
  resolveSqliteMirrorIndex,
  resolveWebDistIndex,
} from "./runtime-install-root.js";

describe("resolveInstallRoot", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
  });

  it("returns packaged root when bridge/server.js exists two levels up", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-pack-"));
    cleanup.push(root);
    const distDir = join(root, "app", "dist");
    mkdirSync(distDir, { recursive: true });
    mkdirSync(join(root, "bridge"), { recursive: true });
    writeFileSync(join(root, "bridge", "server.js"), "// stub\n");
    expect(resolveInstallRoot(distDir)).toBe(root);
  });

  it("returns repo root for dev checkout layout", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-dev-"));
    cleanup.push(root);
    const distDir = join(root, "apps", "desktop", "dist");
    mkdirSync(distDir, { recursive: true });
    expect(resolveInstallRoot(distDir)).toBe(root);
  });
});

describe("resolveBridgeEntry", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
  });

  it("prefers packaged bridge/server.js when present", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-bridge-pack-"));
    cleanup.push(root);
    const bridgeFile = join(root, "bridge", "server.js");
    mkdirSync(join(root, "bridge"), { recursive: true });
    writeFileSync(bridgeFile, "// stub\n");
    expect(resolveBridgeEntry(root)).toBe(bridgeFile);
  });

  it("falls back to dev services path", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-bridge-dev-"));
    cleanup.push(root);
    expect(resolveBridgeEntry(root)).toBe(join(root, "services", "bridge", "dist", "server.js"));
  });
});

describe("resolveWebDistIndex", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
  });

  it("prefers packaged web/index.html when present", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-web-pack-"));
    cleanup.push(root);
    const webFile = join(root, "web", "index.html");
    mkdirSync(join(root, "web"), { recursive: true });
    writeFileSync(webFile, "<html></html>\n");
    expect(resolveWebDistIndex(root)).toBe(webFile);
  });

  it("falls back to dev apps/web path", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-web-dev-"));
    cleanup.push(root);
    expect(resolveWebDistIndex(root)).toBe(join(root, "apps", "web", "dist", "index.html"));
  });
});

describe("resolveSqliteMirrorIndex", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
  });

  it("prefers packaged sqlite-mirror index when present", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-packaged-mirror-"));
    cleanup.push(root);
    const index = join(root, "sqlite-mirror", "index.js");
    mkdirSync(dirname(index), { recursive: true });
    writeFileSync(index, "");
    expect(resolveSqliteMirrorIndex(root)).toBe(index);
  });

  it("falls back to dev sqlite-mirror dist index", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-dev-mirror-"));
    cleanup.push(root);
    expect(resolveSqliteMirrorIndex(root)).toBe(
      join(root, "services", "sqlite-mirror", "dist", "index.js"),
    );
  });
});

describe("resolveSqliteMirrorJsonCli", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
  });

  it("prefers packaged sqlite-mirror JSON CLI when present", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-packaged-mirror-cli-"));
    cleanup.push(root);
    const cli = join(root, "sqlite-mirror", "cli", "mirror-import-json.js");
    mkdirSync(dirname(cli), { recursive: true });
    writeFileSync(cli, "");
    expect(resolveSqliteMirrorJsonCli(root)).toBe(cli);
  });

  it("falls back to dev sqlite-mirror JSON CLI dist path", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-dev-mirror-cli-"));
    cleanup.push(root);
    expect(resolveSqliteMirrorJsonCli(root)).toBe(
      join(root, "services", "sqlite-mirror", "dist", "cli", "mirror-import-json.js"),
    );
  });
});

describe("resolvePackagedNodeBinary", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
  });

  it("finds packaged Windows node.exe", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-node-win-"));
    cleanup.push(root);
    const node = join(root, "node", "node.exe");
    mkdirSync(dirname(node), { recursive: true });
    writeFileSync(node, "");
    expect(resolvePackagedNodeBinary(root, "win32")).toBe(node);
  });

  it("finds packaged POSIX node binary", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-node-posix-"));
    cleanup.push(root);
    const node = join(root, "node", "bin", "node");
    mkdirSync(dirname(node), { recursive: true });
    writeFileSync(node, "");
    expect(resolvePackagedNodeBinary(root, "darwin")).toBe(node);
  });

  it("returns null when no packaged runtime exists", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-node-missing-"));
    cleanup.push(root);
    expect(resolvePackagedNodeBinary(root, "win32")).toBeNull();
  });
});

describe("resolveImportNodeBinary", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
  });

  it("prefers explicit node binary over env and packaged runtime", () => {
    expect(
      resolveImportNodeBinary({
        installRoot: "/missing",
        explicitNodeBinary: "/explicit/node",
        envNodeBinary: "/env/node",
        fallbackNodeBinary: "/fallback/node",
      }),
    ).toBe("/explicit/node");
  });

  it("prefers env node binary over packaged runtime", () => {
    expect(
      resolveImportNodeBinary({
        installRoot: "/missing",
        envNodeBinary: "/env/node",
        fallbackNodeBinary: "/fallback/node",
      }),
    ).toBe("/env/node");
  });

  it("uses packaged node before dev fallback", () => {
    const root = mkdtempSync(join(tmpdir(), "microdent-import-node-"));
    cleanup.push(root);
    const node = join(root, "node", "node.exe");
    mkdirSync(dirname(node), { recursive: true });
    writeFileSync(node, "");
    expect(
      resolveImportNodeBinary({
        installRoot: root,
        fallbackNodeBinary: "/fallback/node",
        platform: "win32",
      }),
    ).toBe(node);
  });
});
