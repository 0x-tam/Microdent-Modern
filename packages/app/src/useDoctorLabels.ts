import { createBridgeClient } from "@microdent/bridge-client";
import { useEffect, useState } from "react";
import type { BridgeHealthPhase } from "./bridge-health.js";
import { buildDoctorLabelMap } from "./doctor-labels.js";

export type UseDoctorLabelsOptions = {
  bridgePhase: BridgeHealthPhase;
  bridgeBaseUrl?: string;
  fetchImpl?: typeof fetch;
  /** When false, skips fetch and clears the map. Defaults to true. */
  enabled?: boolean;
};

export type UseDoctorLabelsResult = {
  labels: ReadonlyMap<string, string>;
};

/**
 * Loads GET /v1/reference/doctors when the bridge is connected.
 * Failures yield an empty map so schedule/profile UI can still render with id fallbacks.
 */
export function useDoctorLabels({
  bridgePhase,
  bridgeBaseUrl,
  fetchImpl,
  enabled = true,
}: UseDoctorLabelsOptions): UseDoctorLabelsResult {
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(() => new Map());

  const base = bridgeBaseUrl?.trim() ?? "";
  const canLoad = enabled && Boolean(base) && bridgePhase === "connected";

  useEffect(() => {
    if (!canLoad) {
      setLabels(new Map());
      return;
    }

    let cancelled = false;
    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });

    void (async () => {
      try {
        const res = await client.getReferenceDoctors();
        if (!cancelled) {
          setLabels(buildDoctorLabelMap(res.doctors));
        }
      } catch {
        if (!cancelled) {
          setLabels(new Map());
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canLoad, base, fetchImpl, bridgePhase]);

  return { labels };
}
