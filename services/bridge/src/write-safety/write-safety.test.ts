import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALLOW_LEGACY_WRITES_ACK,
  FORBIDDEN_LEGACY_COPY_ROOT,
  FORBIDDEN_LEGACY_ROOT,
  WRITE_SANDBOX_MARKER,
  WriteSandboxError,
  validateWritableSandbox,
} from "./index.js";

function writeMarker(dir: string, payload: Record<string, unknown> = { disposable: true }): void {
  writeFileSync(join(dir, WRITE_SANDBOX_MARKER), `${JSON.stringify(payload)}\n`, "utf8");
}

function createTempSandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), "microdent-write-sandbox-"));
  writeMarker(dir);
  return dir;
}

describe("validateWritableSandbox", () => {
  it("rejects missing marker", () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-no-marker-"));
    expect(() =>
      validateWritableSandbox({
        dataRoot: dir,
        writeMode: "dry-run",
        allowLegacyWritesValue: undefined,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WriteSandboxError>>({
        code: "WRITE_SANDBOX_MARKER_MISSING",
      }),
    );
  });

  it("rejects original legacy path", () => {
    expect(() =>
      validateWritableSandbox({
        dataRoot: FORBIDDEN_LEGACY_ROOT,
        writeMode: "dry-run",
        allowLegacyWritesValue: undefined,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WriteSandboxError>>({
        code: "WRITE_TARGET_FORBIDDEN_LEGACY",
      }),
    );

    expect(() =>
      validateWritableSandbox({
        dataRoot: join(FORBIDDEN_LEGACY_ROOT, "DATA"),
        writeMode: "dry-run",
        allowLegacyWritesValue: undefined,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WriteSandboxError>>({
        code: "WRITE_TARGET_FORBIDDEN_LEGACY",
      }),
    );
  });

  it("rejects legacy copy path", () => {
    expect(() =>
      validateWritableSandbox({
        dataRoot: FORBIDDEN_LEGACY_COPY_ROOT,
        writeMode: "dry-run",
        allowLegacyWritesValue: undefined,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WriteSandboxError>>({
        code: "WRITE_TARGET_FORBIDDEN_LEGACY_COPY",
      }),
    );

    expect(() =>
      validateWritableSandbox({
        dataRoot: join(FORBIDDEN_LEGACY_COPY_ROOT, "DATA"),
        writeMode: "dry-run",
        allowLegacyWritesValue: undefined,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WriteSandboxError>>({
        code: "WRITE_TARGET_FORBIDDEN_LEGACY_COPY",
      }),
    );
  });

  it("accepts temp sandbox with marker in dry-run without allow flag", () => {
    const dir = createTempSandbox();
    const result = validateWritableSandbox({
      dataRoot: dir,
      writeMode: "dry-run",
      allowLegacyWritesValue: undefined,
    });
    expect(result.ok).toBe(true);
    expect(result.writeMode).toBe("dry-run");
    expect(result.dataRootReal).toBeTruthy();
  });

  it("accepts temp sandbox with marker when enabled and allow flag matches", () => {
    const dir = createTempSandbox();
    const result = validateWritableSandbox({
      dataRoot: dir,
      writeMode: "enabled",
      allowLegacyWritesValue: ALLOW_LEGACY_WRITES_ACK,
    });
    expect(result.ok).toBe(true);
    expect(result.writeMode).toBe("enabled");
  });

  it("rejects enabled mode without exact allow flag", () => {
    const dir = createTempSandbox();
    expect(() =>
      validateWritableSandbox({
        dataRoot: dir,
        writeMode: "enabled",
        allowLegacyWritesValue: undefined,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WriteSandboxError>>({
        code: "WRITE_NOT_ACKNOWLEDGED",
      }),
    );

    expect(() =>
      validateWritableSandbox({
        dataRoot: dir,
        writeMode: "enabled",
        allowLegacyWritesValue: "yes",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WriteSandboxError>>({
        code: "WRITE_NOT_ACKNOWLEDGED",
      }),
    );
  });

  it("rejects relative DATA_ROOT", () => {
    expect(() =>
      validateWritableSandbox({
        dataRoot: "relative/data",
        writeMode: "dry-run",
        allowLegacyWritesValue: undefined,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WriteSandboxError>>({
        code: "WRITE_DATA_ROOT_NOT_ABSOLUTE",
      }),
    );
  });

  it("rejects marker without disposable: true", () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-bad-marker-"));
    writeMarker(dir, { disposable: false });
    expect(() =>
      validateWritableSandbox({
        dataRoot: dir,
        writeMode: "dry-run",
        allowLegacyWritesValue: undefined,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WriteSandboxError>>({
        code: "WRITE_SANDBOX_MARKER_INVALID",
      }),
    );
  });
});
