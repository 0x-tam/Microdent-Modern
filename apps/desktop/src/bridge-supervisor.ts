import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import type { DesktopConfig } from "./config.js";
import { resolveBridgeEntry, resolveWebDistIndex } from "./runtime-install-root.js";
import {
  validateBridgeDistExists,
  validateDesktopStartupConfig,
} from "./startup-validation.js";

export type BridgeSupervisorOptions = {
  /** Install root — repo checkout or staged MicrodentModern/ package. */
  repoRoot: string;
  config: DesktopConfig;
  nodeBinary?: string;
};

export class BridgeSupervisor {
  private child: ChildProcess | null = null;
  private readonly bridgeEntry: string;
  private readonly webDistIndex: string;

  constructor(private readonly options: BridgeSupervisorOptions) {
    this.bridgeEntry = resolveBridgeEntry(options.repoRoot);
    this.webDistIndex = resolveWebDistIndex(options.repoRoot);
  }

  get uiUrl(): string {
    const port = this.options.config.bridgePort ?? 17890;
    if (existsSync(this.webDistIndex)) {
      return `file://${this.webDistIndex}`;
    }
    return `http://127.0.0.1:${port}/`;
  }

  async start(): Promise<void> {
    validateDesktopStartupConfig(this.options.config);
    validateBridgeDistExists(this.bridgeEntry);

    const { ALLOW_LEGACY_WRITES: _omitLegacyAck, ...safeProcessEnv } = process.env;
    const env: NodeJS.ProcessEnv = {
      ...safeProcessEnv,
      NODE_ENV: "production",
      BRIDGE_HOST: "127.0.0.1",
      BRIDGE_PORT: String(this.options.config.bridgePort ?? 17890),
      WRITE_MODE: this.options.config.writeMode ?? "disabled",
    };
    if (this.options.config.dataRoot) {
      env.DATA_ROOT = this.options.config.dataRoot;
    }
    if (this.options.config.sqlitePath) {
      env.SQLITE_PATH = this.options.config.sqlitePath;
    }
    if (this.options.config.backupDir) {
      env.BACKUP_DIR = this.options.config.backupDir;
    }
    delete env.ALLOW_LEGACY_WRITES;

    const nodeBin = this.options.nodeBinary ?? process.execPath;
    this.child = spawn(nodeBin, [this.bridgeEntry], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    await this.waitForHealth();
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    this.child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      if (!this.child) {
        resolve();
        return;
      }
      this.child.once("exit", () => resolve());
      setTimeout(() => {
        this.child?.kill("SIGKILL");
        resolve();
      }, 5000);
    });
    this.child = null;
  }

  private async waitForHealth(): Promise<void> {
    const port = this.options.config.bridgePort ?? 17890;
    const url = `http://127.0.0.1:${port}/health`;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(url);
        if (res.ok) return;
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    throw new Error("bridge health check timed out");
  }
}
