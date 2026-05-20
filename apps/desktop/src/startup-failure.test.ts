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

  it("maps health timeout", () => {
    expect(formatStartupFailure(new Error("Bridge health check timed out"))).toMatch(/loopback/i);
  });

  it("passes through unknown messages", () => {
    expect(formatStartupFailure(new Error("Custom operator-safe message"))).toBe(
      "Custom operator-safe message",
    );
  });

  it("detects path-related failures for setup retry", () => {
    expect(isPathRelatedStartupFailure("Desktop paths are invalid or missing. Re-open setup.")).toBe(
      true,
    );
    expect(isPathRelatedStartupFailure("Bridge server not built.")).toBe(false);
  });
});
