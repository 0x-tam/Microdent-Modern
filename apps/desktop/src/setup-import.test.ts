import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  runImportInChildProcess,
  runSetupImport,
  type RunMirrorImport,
  type SetupImportProgress,
} from "./setup-import.js";

describe("runSetupImport", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
  });

  function makePaths() {
    const root = mkdtempSync(join(tmpdir(), "microdent-setup-import-"));
    cleanup.push(root);
    const dataRoot = join(root, "DATA");
    mkdirSync(dataRoot);
    return {
      root,
      dataRoot,
      sqlitePath: join(root, "mirror", "clinic.sqlite"),
    };
  }

  const successImport: RunMirrorImport = async ({ sqlitePath }) => {
    writeFileSync(sqlitePath, "new local copy");
    return {
      overall: "success",
      steps: [
        { table: "doctors", status: "success", rowCount: 2, errorCount: 0 },
        { table: "patients", status: "success", rowCount: 10, errorCount: 0 },
        { table: "appointments", status: "success", rowCount: 5, errorCount: 0 },
        { table: "treatments", status: "success", rowCount: 4, errorCount: 0 },
      ],
    };
  };

  it("imports to a temp file and promotes it to the final local copy", async () => {
    const { root, dataRoot, sqlitePath } = makePaths();
    const progress: SetupImportProgress[] = [];

    const summary = await runSetupImport({
      installRoot: root,
      dataRoot,
      sqlitePath,
      runImport: successImport,
      onProgress: (item) => progress.push(item),
    });

    expect(summary.overall).toBe("success");
    expect(summary.coreReady).toBe(true);
    expect(summary.steps.map((step) => step.label)).toContain("Loading patients");
    expect(readFileSync(sqlitePath, "utf8")).toBe("new local copy");
    expect(progress.at(0)?.phase).toBe("validating");
    expect(progress.at(-1)?.phase).toBe("finishing");
  });

  it("keeps the previous local copy when core import is not ready", async () => {
    const { root, dataRoot, sqlitePath } = makePaths();
    mkdirSync(join(root, "mirror"), { recursive: true });
    writeFileSync(sqlitePath, "previous local copy");

    const summary = await runSetupImport({
      installRoot: root,
      dataRoot,
      sqlitePath,
      runImport: async ({ sqlitePath: tempPath }) => {
        writeFileSync(tempPath, "bad local copy");
        return {
          overall: "failed",
          steps: [
            { table: "doctors", status: "success", rowCount: 2, errorCount: 0 },
            { table: "patients", status: "failed", rowCount: 0, errorCount: 1 },
            { table: "appointments", status: "success", rowCount: 5, errorCount: 0 },
          ],
        };
      },
    });

    expect(summary.overall).toBe("failed");
    expect(summary.coreReady).toBe(false);
    expect(readFileSync(sqlitePath, "utf8")).toBe("previous local copy");
    expect(existsSync(`${sqlitePath}.previous`)).toBe(false);
  });

  it("promotes partial imports when core tables are usable", async () => {
    const { root, dataRoot, sqlitePath } = makePaths();
    const summary = await runSetupImport({
      installRoot: root,
      dataRoot,
      sqlitePath,
      runImport: async ({ sqlitePath: tempPath }) => {
        writeFileSync(tempPath, "partial local copy");
        return {
          overall: "partial",
          steps: [
            { table: "doctors", status: "success", rowCount: 2, errorCount: 0 },
            { table: "patients", status: "partial", rowCount: 10, errorCount: 1 },
            { table: "appointments", status: "success", rowCount: 5, errorCount: 0 },
            { table: "treatments", status: "failed", rowCount: 0, errorCount: 1 },
          ],
        };
      },
    });

    expect(summary.overall).toBe("partial");
    expect(summary.coreReady).toBe(true);
    expect(readFileSync(sqlitePath, "utf8")).toBe("partial local copy");
  });

  it("cleans up temp local copy when import throws", async () => {
    const { root, dataRoot, sqlitePath } = makePaths();
    await expect(
      runSetupImport({
        installRoot: root,
        dataRoot,
        sqlitePath,
        runImport: async ({ sqlitePath: tempPath }) => {
          writeFileSync(tempPath, "bad local copy");
          throw new Error("raw importer failure with hidden detail");
        },
      }),
    ).rejects.toThrow(/Local copy import failed/i);

    expect(existsSync(sqlitePath)).toBe(false);
    expect(existsSync(join(root, "mirror"))).toBe(true);
  });

  it("runs PHI-safe JSON import through a child process", async () => {
    const { root, dataRoot, sqlitePath } = makePaths();
    mkdirSync(join(root, "mirror"), { recursive: true });
    const cli = join(root, "services", "sqlite-mirror", "dist", "cli", "mirror-import-json.js");
    mkdirSync(join(root, "services", "sqlite-mirror", "dist", "cli"), { recursive: true });
    writeFileSync(
      cli,
      [
        "const { writeFileSync } = require('node:fs');",
        "const sqlitePath = process.argv[process.argv.indexOf('--sqlite-path') + 1];",
        "writeFileSync(sqlitePath, 'child local copy');",
        "process.stdout.write(JSON.stringify({ overall: 'success', steps: [",
        "{ table: 'doctors', status: 'success', rowCount: 1, errorCount: 0 },",
        "{ table: 'patients', status: 'success', rowCount: 2, errorCount: 0 },",
        "{ table: 'appointments', status: 'success', rowCount: 3, errorCount: 0 }",
        "] }) + '\\n');",
      ].join("\n"),
    );

    const result = await runImportInChildProcess({
      installRoot: root,
      dataRoot,
      sqlitePath,
      nodeBinary: process.execPath,
    });

    expect(result.overall).toBe("success");
    expect(result.steps).toHaveLength(3);
    expect(readFileSync(sqlitePath, "utf8")).toBe("child local copy");
  });

  it("does not expose raw child stderr when child import fails", async () => {
    const { root, dataRoot, sqlitePath } = makePaths();
    const cli = join(root, "services", "sqlite-mirror", "dist", "cli", "mirror-import-json.js");
    mkdirSync(join(root, "services", "sqlite-mirror", "dist", "cli"), { recursive: true });
    writeFileSync(
      cli,
      "console.error('SECRET_PATH /Users/operator/clinic'); process.exit(1);\n",
    );

    await expect(
      runImportInChildProcess({
        installRoot: root,
        dataRoot,
        sqlitePath,
        nodeBinary: process.execPath,
      }),
    ).rejects.toThrow("Local copy import process failed.");
  });
});
