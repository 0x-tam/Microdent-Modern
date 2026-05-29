import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import type { DesktopConfig } from "./config.js";
import { resolveBridgeEntry, resolveWebDistIndex } from "./runtime-install-root.js";
import {
  validateBridgeDistExists,
  validateDesktopStartupConfig,
} from "./startup-validation.js";

/** Thrown when the bridge process fails to become healthy. */
export class BridgeStartError extends Error {
  override name = "BridgeStartError";
  constructor(message: string) {
    super(message);
  }
}

/** Public-facing bridge health status for IPC queries. */
export type BridgeHealthStatus = {
  /** "running" | "starting" | "stopped" | "error" */
  status: "running" | "starting" | "stopped" | "error";
  port: number | null;
  lastError: string | null;
};

export type BridgeSupervisorOptions = {
  /** Install root — repo checkout or staged MicrodentModern/ package. */
  repoRoot: string;
  config: DesktopConfig;
  nodeBinary?: string;
  /** Called when the bridge becomes unhealthy during runtime monitoring. */
  onHealthDegraded?: (error: string) => void;
  /** Called when the bridge recovers after a crash. */
  onRecovered?: () => void;
  /** Called when the bridge process exits unexpectedly. */
  onCrash?: () => void;
};

export class BridgeSupervisor {
  private child: ChildProcess | null = null;
  private readonly bridgeEntry: string;
  private readonly webDistIndex: string;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private crashCount = 0;
  private _currentPort: number;
  /** Internal health tracking for IPC status queries. */
  private _healthStatus: BridgeHealthStatus = {
    status: "starting",
    port: null,
    lastError: null,
  };

  constructor(private readonly options: BridgeSupervisorOptions) {
    this.bridgeEntry = resolveBridgeEntry(options.repoRoot);
    this.webDistIndex = resolveWebDistIndex(options.repoRoot);
    this._currentPort = options.config.bridgePort ?? 17890;
    this._healthStatus.port = this._currentPort;
  }

  get uiUrl(): string {
    const port = this._currentPort;
    if (existsSync(this.webDistIndex)) {
      return `file://${this.webDistIndex}`;
    }
    return `http://127.0.0.1:${port}/`;
  }

  /** Return a snapshot of the bridge health status for IPC queries. */
  get healthStatus(): BridgeHealthStatus {
    return { ...this._healthStatus };
  }

  /**
   * Check whether a port is already in use by attempting a TCP connection.
   * Returns true if the port appears to be occupied.
   */
  private async isPortInUse(port: number): Promise<boolean> {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(1500),
      });
      // If we get any response (even non-200), something is listening
      return true;
    } catch {
      // Connection refused / timeout — port is free
      return false;
    }
  }

  /**
   * Find an available port starting from the configured port.
   * Tries up to 3 consecutive ports before giving up.
   */
  private async findAvailablePort(startPort: number): Promise<number> {
    const maxAttempts = 3;
    for (let offset = 0; offset < maxAttempts; offset++) {
      const candidate = startPort + offset;
      const inUse = await this.isPortInUse(candidate);
      if (!inUse) return candidate;
    }
    throw new BridgeStartError(
      "Clinic service could not start — the port is already in use. Please restart the app or contact support.",
    );
  }

  async start(): Promise<void> {
    validateDesktopStartupConfig(this.options.config);
    validateBridgeDistExists(this.bridgeEntry);

    // Port conflict detection: find an available port before spawning
    const requestedPort = this.options.config.bridgePort ?? 17890;
    this._currentPort = await this.findAvailablePort(requestedPort);
    this._healthStatus.port = this._currentPort;
    if (this._currentPort !== requestedPort) {
      console.warn(
        `Port ${requestedPort} was in use. Bridge will use port ${this._currentPort} instead.`,
      );
    }

    const { ALLOW_LEGACY_WRITES: _omitLegacyAck, ...safeProcessEnv } = process.env;
    const env: NodeJS.ProcessEnv = {
      ...safeProcessEnv,
      NODE_ENV: "production",
      BRIDGE_HOST: "127.0.0.1",
      BRIDGE_PORT: String(this._currentPort),
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

    // Listen for unexpected crashes for recovery
    this.child.on("exit", (code, signal) => {
      if (this.child !== null) {
        this.child = null;
        this.crashCount++;
        this._healthStatus.status = "stopped";
        this._healthStatus.lastError = `Bridge exited unexpectedly: code=${code ?? "null"}, signal=${signal ?? "null"}`;
        console.warn(`Bridge exited unexpectedly: code=${code ?? "null"}, signal=${signal ?? "null"}`);
        this.options.onCrash?.();
      }
    });

    await this.waitForHealth();

    this._healthStatus.status = "running";
    this._healthStatus.lastError = null;

    // Start periodic health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Kill the current bridge process and start a fresh one.
   * Called by the main process after receiving a crash event.
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
    this.crashCount = 0;
    this.options.onRecovered?.();
  }

  /**
   * Start polling bridge health every 30 seconds.
   * If the bridge goes down, the crash handler deals with recovery.
   */
  private startHealthMonitoring(): void {
    this.stopHealthMonitoring();
    this.healthTimer = setInterval(async () => {
      if (!this.child) return;
      try {
        const url = `http://127.0.0.1:${this._currentPort}/health`;
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) {
          // Health endpoint returned non-200 — bridge may be degraded
          console.warn(`Bridge health check returned ${res.status}`);
        }
      } catch {
        // fetch failed — bridge process may have died without an exit event
        console.warn("Bridge health check failed — process may have become unresponsive.");
        this._healthStatus.status = "error";
        this._healthStatus.lastError = "Clinic service health check failed.";
        this.options.onHealthDegraded?.("Clinic service health check failed.");
        // Attempt recovery via the same crash handler
        this.crashCount++;
        const pid = this.child.pid;
        if (pid) {
          try { process.kill(pid, "SIGTERM"); } catch { /* already dead */ }
        }
      }
    }, 30_000);
    // Allow the timer to be unref'd so it doesn't prevent process exit
    this.healthTimer.unref?.();
  }

  private stopHealthMonitoring(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  async stop(): Promise<void> {
    // Stop health monitoring first
    this.stopHealthMonitoring();

    // Prevent crash handler from firing during intentional shutdown
    const childToStop = this.child;
    this.child = null;

    if (!childToStop) {
      this.markStopped();
      return;
    }
    this.markStopped();
    childToStop.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      childToStop.once("exit", () => resolve());
      setTimeout(() => {
        childToStop.kill("SIGKILL");
        resolve();
      }, 5000);
    });
  }

  private async waitForHealth(): Promise<void> {
    const url = `http://127.0.0.1:${this._currentPort}/health`;
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
    throw new BridgeStartError(
      "Clinic service could not start. Please restart the app or contact support.",
    );
  }

  /** Called during intentional shutdown — reset status. */
  private markStopped(): void {
    this._healthStatus.status = "stopped";
  }
}
