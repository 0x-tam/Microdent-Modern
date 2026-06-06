export type PortProbeState = "responding" | "not-responding";

export type ClinicServicePortDiagnostics = {
  ok: boolean;
  configuredPort: number;
  activePort: number | null;
  configuredPortState: PortProbeState;
  activePortState: PortProbeState | null;
  message: string;
};

export type ClinicServicePortCleanupPolicy = {
  ok: boolean;
  title: string;
  canAutoClean: false;
  configuredPort: number;
  activePort: number | null;
  steps: string[];
  escalation: string;
  message: string;
};

export type PortDiagnosticsOptions = {
  configuredPort: number;
  activePort?: number | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type PortCleanupPolicyOptions = {
  configuredPort: number;
  activePort?: number | null;
};

async function probeHealthPort(
  port: number,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<PortProbeState> {
  try {
    const response = await fetchImpl(`http://127.0.0.1:${port}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok ? "responding" : "not-responding";
  } catch {
    return "not-responding";
  }
}

export async function diagnoseClinicServicePorts(
  options: PortDiagnosticsOptions,
): Promise<ClinicServicePortDiagnostics> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 1500;
  const activePort = options.activePort ?? null;
  const configuredPortState = await probeHealthPort(options.configuredPort, fetchImpl, timeoutMs);
  const activePortState =
    activePort !== null && activePort !== options.configuredPort
      ? await probeHealthPort(activePort, fetchImpl, timeoutMs)
      : activePort === options.configuredPort
        ? configuredPortState
        : null;

  if (activePort !== null && activePortState === "responding") {
    if (activePort !== options.configuredPort && configuredPortState === "responding") {
      return {
        ok: true,
        configuredPort: options.configuredPort,
        activePort,
        configuredPortState,
        activePortState,
        message: "Clinic service is running on a backup port because the configured port is occupied.",
      };
    }
    return {
      ok: true,
      configuredPort: options.configuredPort,
      activePort,
      configuredPortState,
      activePortState,
      message: "Clinic service port is healthy.",
    };
  }

  if (configuredPortState === "responding") {
    return {
      ok: true,
      configuredPort: options.configuredPort,
      activePort,
      configuredPortState,
      activePortState,
      message: "Configured clinic service port is responding.",
    };
  }

  return {
    ok: false,
    configuredPort: options.configuredPort,
    activePort,
    configuredPortState,
    activePortState,
    message: "Clinic service port is not responding. Restart the clinic service or reopen Microdent Modern.",
  };
}

export function resolveClinicServicePortCleanupPolicy(
  options: PortCleanupPolicyOptions,
): ClinicServicePortCleanupPolicy {
  const activePort = options.activePort ?? null;
  return {
    ok: true,
    title: "Safe clinic service port cleanup policy",
    canAutoClean: false,
    configuredPort: options.configuredPort,
    activePort,
    steps: [
      "Use Restart clinic service first; it only restarts Microdent Modern's own local service.",
      "If the configured port is still occupied, close and reopen Microdent Modern before changing any system process.",
      "Do not force-close unknown processes from Microdent Modern. Ask IT to identify the process using Windows tools.",
      "If IT confirms the process is stale and safe to close, IT should close it outside Microdent Modern, then reopen the app.",
    ],
    escalation:
      "Escalate to IT/support when another application owns the configured port, antivirus blocks the local service, or the service repeatedly moves to a backup port.",
    message:
      "Microdent Modern will not close unknown processes. This protects clinic workstations from accidental data loss.",
  };
}
