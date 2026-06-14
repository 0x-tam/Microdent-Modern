import { describe, expect, it, vi, afterEach } from "vitest";
import {
  crashDumpsDir,
  logsDir,
  operatorConfigFilePath,
  pathLooksInsideInstallDir,
  recommendedOperatorLogDir,
  resolveOperatorDataLocations,
  WINDOWS_SANDBOX_EXAMPLES,
} from "./operator-data-locations.js";

const homedirMock = vi.hoisted(() => vi.fn(() => "/home/operator"));
const platformMock = vi.hoisted(() => vi.fn(() => "linux"));

function portablePath(value: string): string {
  return value.replace(/\\/g, "/");
}

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    homedir: homedirMock,
    platform: platformMock,
  };
});

const FORBIDDEN_PATH_TOKENS = ["PAT_NAME", "TELEPHONE", "schedule.dbf", "SCHEDULE.DBF"];

describe("resolveOperatorDataLocations", () => {
  it("lists install, AppData, and clinic layers", () => {
    const specs = resolveOperatorDataLocations();
    const layers = new Set(specs.map((spec) => spec.layer));
    expect(layers).toEqual(new Set(["install", "appData", "clinic"]));
    expect(specs.find((spec) => spec.id === "dataRoot")).toMatchObject({
      mustStayOutsideInstall: true,
      containsClinicData: true,
    });
    expect(specs.find((spec) => spec.id === "sqlitePath")).toMatchObject({
      mustStayOutsideInstall: true,
    });
    expect(specs.find((spec) => spec.id === "backupDir")).toMatchObject({
      mustStayOutsideInstall: true,
    });
    expect(specs.find((spec) => spec.id === "crashDumps")).toMatchObject({
      mustStayOutsideInstall: true,
      containsClinicData: false,
    });
  });

  it("never ships clinic data in the install package", () => {
    const install = resolveOperatorDataLocations().find((spec) => spec.id === "install");
    expect(install?.shippedInPackage).toBe(true);
    expect(install?.containsClinicData).toBe(false);
    for (const spec of resolveOperatorDataLocations()) {
      if (spec.layer === "clinic") {
        expect(spec.shippedInPackage).toBe(false);
      }
    }
  });

  it("uses synthetic sandbox examples only", () => {
    expect(WINDOWS_SANDBOX_EXAMPLES.dataRoot).toContain("Microdent");
    expect(WINDOWS_SANDBOX_EXAMPLES.dataRoot).toContain("DATA");
    const pathHints = [
      ...Object.values(WINDOWS_SANDBOX_EXAMPLES),
      ...resolveOperatorDataLocations().map((spec) => spec.windowsPathHint),
    ].join("\n");
    for (const token of FORBIDDEN_PATH_TOKENS) {
      expect(pathHints.toLowerCase()).not.toContain(token.toLowerCase());
    }
  });
});

describe("recommendedOperatorLogDir", () => {
  afterEach(() => {
    platformMock.mockReset();
    homedirMock.mockReset();
    homedirMock.mockReturnValue("/home/operator");
  });

  it("resolves under AppData on Windows", () => {
    platformMock.mockReturnValue("win32");
    expect(portablePath(recommendedOperatorLogDir())).toBe("/home/operator/AppData/Microdent/logs");
    expect(logsDir()).toBe(recommendedOperatorLogDir());
    expect(portablePath(crashDumpsDir())).toBe("/home/operator/AppData/Microdent/crash-dumps");
    expect(portablePath(operatorConfigFilePath())).toBe("/home/operator/AppData/Microdent/config.json");
  });
});

describe("pathLooksInsideInstallDir", () => {
  it("detects paths under the install root", () => {
    expect(
      pathLooksInsideInstallDir(
        "C:\\Microdent\\MicrodentModern\\mirror\\clinic.sqlite",
        "C:\\Microdent\\MicrodentModern",
      ),
    ).toBe(true);
    expect(
      pathLooksInsideInstallDir(
        "C:\\Users\\Public\\MicrodentModern\\mirror\\clinic.sqlite",
        "C:\\Microdent\\MicrodentModern",
      ),
    ).toBe(false);
  });

  it("marks qaReports as dev-only documented-only", () => {
    const qa = resolveOperatorDataLocations().find((spec) => spec.id === "qaReports");
    expect(qa?.implementationStatus).toBe("documented-only");
    expect(qa?.windowsPathHint).toMatch(/qa-runs/);
    expect(qa?.shippedInPackage).toBe(false);
  });

  it("marks logs as implemented PHI-safe desktop output", () => {
    const logs = resolveOperatorDataLocations().find((spec) => spec.id === "logs");
    expect(logs?.implementationStatus).toBe("implemented");
    expect(logs?.windowsPathHint).toContain("%AppData%");
    expect(logs?.notes).toMatch(/PHI-safe/i);
  });

  it("marks crash dumps as implemented local-only desktop output", () => {
    const crashes = resolveOperatorDataLocations().find((spec) => spec.id === "crashDumps");
    expect(crashes?.implementationStatus).toBe("implemented");
    expect(crashes?.windowsPathHint).toContain("%AppData%");
    expect(crashes?.notes).toMatch(/upload disabled/i);
  });

  it("marks clinic path categories as implemented", () => {
    for (const id of ["dataRoot", "sqlitePath", "backupDir", "desktopConfig"]) {
      expect(resolveOperatorDataLocations().find((spec) => spec.id === id)?.implementationStatus).toBe(
        "implemented",
      );
    }
  });
});
