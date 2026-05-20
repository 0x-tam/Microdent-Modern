import { describe, expect, it } from "vitest";
import { formatStartupFailure, isPathRelatedStartupFailure } from "./startup-failure.js";

describe("formatStartupFailure", () => {
  it("maps setup closed to operator action", () => {
    expect(formatStartupFailure(new Error("Setup window closed before saving configuration"))).toMatch(
      /complete first-run setup/i,
    );
  });

  it("maps missing bridge dist", () => {
    expect(formatStartupFailure(new Error("ENOENT: services/bridge/dist/server.js"))).toMatch(
      /@microdent\/bridge run build/i,
    );
  });

  it("maps missing web dist", () => {
    expect(formatStartupFailure(new Error("ENOENT apps/web/dist/index.html"))).toMatch(/build:web/i);
  });

  it("maps port conflicts", () => {
    expect(formatStartupFailure(new Error("listen EADDRINUSE 127.0.0.1:17890"))).toMatch(/17890/);
  });

  it("maps health timeout without paths", () => {
    const message = formatStartupFailure(new Error("Bridge health check timed out"));
    expect(message).toMatch(/loopback/i);
    expect(message).not.toMatch(/\/Users\/|C:\\\\|DATA_ROOT=/);
  });

  it("maps sandbox guard failures", () => {
    expect(formatStartupFailure(new Error("DATA_ROOT failed write-sandbox guard"))).toMatch(
      /disposable sandbox/i,
    );
  });

  it("maps missing sqlite file distinctly from generic paths", () => {
    const message = formatStartupFailure(
      new Error("SQLITE_PATH expected a file (C:\\\\masked\\\\mirror.sqlite)"),
    );
    expect(message).toMatch(/Mirror SQLite file is missing/i);
    expect(message).not.toMatch(/C:\\\\|masked/);
  });

  it("maps backup required when writes enabled", () => {
    const message = formatStartupFailure(
      new Error("BACKUP_DIR is not set; sandbox commits require a backup folder when write mode is not disabled"),
    );
    expect(message).toMatch(/Backup folder is required before sandbox commits/i);
    expect(message).not.toMatch(/\/tmp|C:\\\\|DATA_ROOT/);
  });

  it("maps generic backup failures", () => {
    expect(formatStartupFailure(new Error("BACKUP_DIR missing"))).toMatch(/BACKUP_DIR/i);
  });

  it("uses generic recovery for unknown messages", () => {
    expect(formatStartupFailure(new Error("Custom operator-safe message"))).toMatch(
      /PILOT-START-HERE/i,
    );
  });

  it("detects path-related failures for setup retry", () => {
    expect(isPathRelatedStartupFailure("Desktop paths are invalid or missing. Re-open setup.")).toBe(
      true,
    );
    expect(isPathRelatedStartupFailure("Mirror SQLite file is missing. Re-open setup.")).toBe(true);
    expect(isPathRelatedStartupFailure("Bridge server not built.")).toBe(false);
  });
});
