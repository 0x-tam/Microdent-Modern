import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  resolveBridgeEntry,
  resolveInstallRoot,
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
