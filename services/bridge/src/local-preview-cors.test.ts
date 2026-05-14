import { describe, expect, it } from "vitest";
import { isAllowedLocalPreviewOrigin } from "./local-preview-cors.js";

describe("isAllowedLocalPreviewOrigin", () => {
  it.each([
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
    "http://127.0.0.1:5174",
    "http://localhost:5173",
    "http://localhost:4173",
    "http://localhost:5174",
    "http://[::1]:5173",
    "http://[::1]:4173",
    "http://[::1]:5999",
    "http://127.0.0.1:3000",
    "http://localhost:3456",
  ])("allows %s", (origin) => {
    expect(isAllowedLocalPreviewOrigin(origin)).toBe(true);
  });

  it.each([
    ["https://evil.example", "https external"],
    ["http://evil.example", "http external"],
    ["http://192.168.1.5:5173", "LAN IP"],
    ["http://10.0.0.1:5173", "private IP"],
    ["http://0.0.0.0:5173", "unspecified listen address"],
    ["http://127.0.0.1:2999", "port below range"],
    ["http://127.0.0.1:6000", "port above range"],
    ["http://localhost:80", "default http port"],
    ["http://localhost:808", "port below range (typo)"],
    ["http://127.0.0.1:8080", "port above 5999 (8080)"],
  ])("blocks %s (%s)", (origin, _label) => {
    expect(isAllowedLocalPreviewOrigin(origin)).toBe(false);
  });

  it("blocks localhost when port is outside dev range", () => {
    expect(isAllowedLocalPreviewOrigin("http://localhost:6000")).toBe(false);
    expect(isAllowedLocalPreviewOrigin("http://localhost:2999")).toBe(false);
  });

  it("blocks null / opaque origin string and empty", () => {
    expect(isAllowedLocalPreviewOrigin("null")).toBe(false);
    expect(isAllowedLocalPreviewOrigin("")).toBe(false);
    expect(isAllowedLocalPreviewOrigin("   ")).toBe(false);
    expect(isAllowedLocalPreviewOrigin(undefined)).toBe(false);
    expect(isAllowedLocalPreviewOrigin(null)).toBe(false);
  });

  it("blocks https to loopback", () => {
    expect(isAllowedLocalPreviewOrigin("https://127.0.0.1:5173")).toBe(false);
    expect(isAllowedLocalPreviewOrigin("https://localhost:5173")).toBe(false);
  });

  it("blocks userinfo in URL", () => {
    expect(isAllowedLocalPreviewOrigin("http://user:pass@127.0.0.1:5173")).toBe(false);
  });

  it("blocks non-http schemes", () => {
    expect(isAllowedLocalPreviewOrigin("file:///tmp/x")).toBe(false);
    expect(isAllowedLocalPreviewOrigin("ftp://127.0.0.1:5173")).toBe(false);
  });
});
