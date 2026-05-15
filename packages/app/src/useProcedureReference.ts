import { createBridgeClient } from "@microdent/bridge-client";
import { useEffect, useState } from "react";
import type { BridgeHealthPhase } from "./bridge-health.js";
import {
  buildProcedureReferenceMaps,
  EMPTY_PROCEDURE_REFERENCE_MAPS,
  type ProcedureReferenceMaps,
} from "./procedure-reference.js";

export type UseProcedureReferenceOptions = {
  bridgePhase: BridgeHealthPhase;
  bridgeBaseUrl?: string;
  fetchImpl?: typeof fetch;
  /** When false, skips fetch and clears maps. Defaults to true. */
  enabled?: boolean;
};

export type UseProcedureReferenceResult = {
  maps: ProcedureReferenceMaps;
};

/**
 * Loads GET /v1/reference/procedures when the bridge is connected.
 * Failures yield empty maps so schedule/profile UI can still render proc-class fallbacks.
 */
export function useProcedureReference({
  bridgePhase,
  bridgeBaseUrl,
  fetchImpl,
  enabled = true,
}: UseProcedureReferenceOptions): UseProcedureReferenceResult {
  const [maps, setMaps] = useState<ProcedureReferenceMaps>(() => EMPTY_PROCEDURE_REFERENCE_MAPS);

  const base = bridgeBaseUrl?.trim() ?? "";
  const canLoad = enabled && Boolean(base) && bridgePhase === "connected";

  useEffect(() => {
    if (!canLoad) {
      setMaps(EMPTY_PROCEDURE_REFERENCE_MAPS);
      return;
    }

    let cancelled = false;
    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });

    void (async () => {
      try {
        const res = await client.getReferenceProcedures();
        if (!cancelled) {
          setMaps(buildProcedureReferenceMaps(res.procedures));
        }
      } catch {
        if (!cancelled) {
          setMaps(EMPTY_PROCEDURE_REFERENCE_MAPS);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canLoad, base, fetchImpl, bridgePhase]);

  return { maps };
}
