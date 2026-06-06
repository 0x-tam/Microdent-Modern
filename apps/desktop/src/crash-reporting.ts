import { mkdirSync } from "node:fs";
import type { DesktopLogger } from "./desktop-logger.js";

export type ElectronCrashReporterLike = {
  start(options: {
    companyName: string;
    productName: string;
    submitURL: string;
    uploadToServer: boolean;
    compress: boolean;
  }): void;
};

export type ElectronAppPathLike = {
  setPath(name: "crashDumps", path: string): void;
};

export type ConfigureCrashReportingOptions = {
  app: ElectronAppPathLike;
  crashReporter: ElectronCrashReporterLike;
  crashDumpsDir: string;
  logger?: DesktopLogger | null;
};

export function configureLocalCrashReporting(options: ConfigureCrashReportingOptions): void {
  mkdirSync(options.crashDumpsDir, { recursive: true });
  options.app.setPath("crashDumps", options.crashDumpsDir);
  options.crashReporter.start({
    companyName: "Microdent",
    productName: "Microdent Modern",
    submitURL: "",
    uploadToServer: false,
    compress: true,
  });
  options.logger?.info("desktop_crash_reporting_configured", {
    mode: "local-only",
    crashDumpsDir: options.crashDumpsDir,
  });
}
