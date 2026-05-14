import { createBridgeClient } from "@microdent/bridge-client";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader } from "@microdent/ui";
import { probeSyntheticFixtureConnection, SYNTHETIC_FIXTURE_TABLE_ID } from "./fixture-connection-probe.js";
import { AppErrorBoundary } from "./AppErrorBoundary.js";

type PanelPhase = "idle" | "loading" | "ready";

export type FixtureConnectionPanelProps = {
  bridgeBaseUrl?: string;
  /** Mirrors top-bar bridge health: only auto-runs the fixture probe when `connected`. */
  bridgePhase: "checking" | "connected" | "offline";
};

export function FixtureConnectionPanel({ bridgeBaseUrl, bridgePhase }: FixtureConnectionPanelProps) {
  const [panelPhase, setPanelPhase] = useState<PanelPhase>("idle");
  const [result, setResult] = useState<Awaited<ReturnType<typeof probeSyntheticFixtureConnection>> | null>(null);

  const base = bridgeBaseUrl?.trim() ?? "";

  const runProbe = useCallback(async () => {
    if (!base) {
      setResult(null);
      setPanelPhase("idle");
      return;
    }
    setPanelPhase("loading");
    const client = createBridgeClient({ baseUrl: base });
    const next = await probeSyntheticFixtureConnection(client);
    setResult(next);
    setPanelPhase("ready");
  }, [base]);

  useEffect(() => {
    if (!base) {
      return;
    }
    if (bridgePhase === "offline") {
      setResult(null);
      setPanelPhase("idle");
    }
  }, [bridgePhase, base]);

  useEffect(() => {
    if (!base) {
      setResult(null);
      setPanelPhase("idle");
      return;
    }
    if (bridgePhase !== "connected") {
      return;
    }
    void runProbe();
  }, [base, bridgePhase, runProbe]);

  const showWaitingForBridge = Boolean(base) && bridgePhase !== "connected" && result === null;

  return (
    <AppErrorBoundary>
      <Card className="app-fixture-panel">
        <CardHeader>
          <p className="ui-card__title app-card-title-lg">Data connection test</p>
          <p className="app-fixture-panel__subtitle">
            Synthetic fixture only (<code className="app-fixture-panel__code">{SYNTHETIC_FIXTURE_TABLE_ID}</code>) — not
            clinic or patient data.
          </p>
        </CardHeader>
        <CardBody>
          {!base ? (
            <p className="app-fixture-panel__muted">
              No bridge URL is configured for this preview, so this check is skipped.
            </p>
          ) : showWaitingForBridge ? (
            <p className="app-fixture-panel__muted">
              {bridgePhase === "checking"
                ? "Waiting for the bridge health check…"
                : "Bridge appears offline (see the status in the top bar). Start the bridge to run this test, or use Refresh below to retry."}
            </p>
          ) : null}

          {base ? (
            <div className="app-fixture-panel__actions">
              <Button
                type="button"
                variant="secondary"
                size="compact"
                className="ui-focusable"
                disabled={panelPhase === "loading"}
                onClick={() => void runProbe()}
              >
                {panelPhase === "loading" ? "Checking…" : "Refresh test"}
              </Button>
            </div>
          ) : null}

          {panelPhase === "loading" && !showWaitingForBridge ? (
            <p className="app-fixture-panel__muted" role="status">
              Calling fixture table routes on the bridge…
            </p>
          ) : null}

          {panelPhase === "ready" && result ? (
            <div className="app-fixture-panel__result" role="region" aria-label="Synthetic fixture test result">
              {result.ok ? (
                <>
                  <div className="app-fixture-panel__row">
                    <span className="app-fixture-panel__label">Fixture in catalog</span>
                    <Badge variant="success" semanticLabel="Fixture table is listed">
                      Available
                    </Badge>
                  </div>
                  <div className="app-fixture-panel__row">
                    <span className="app-fixture-panel__label">Fields</span>
                    <span className="app-fixture-panel__value">{result.fieldCount}</span>
                  </div>
                  <div className="app-fixture-panel__row">
                    <span className="app-fixture-panel__label">Rows in file</span>
                    <span className="app-fixture-panel__value">{result.totalRecords}</span>
                  </div>
                  <div className="app-fixture-panel__row">
                    <span className="app-fixture-panel__label">Preview rows loaded</span>
                    <span className="app-fixture-panel__value">{result.previewRowCount}</span>
                  </div>
                  {result.previewRows.length > 0 ? (
                    <div className="app-fixture-panel__preview">
                      <p className="app-fixture-panel__preview-title">Sample cells (fake data)</p>
                      <div className="app-fixture-panel__table-wrap">
                        <table className="app-fixture-panel__table">
                          <thead>
                            <tr>
                              {Object.keys(result.previewRows[0] ?? {}).map((key) => (
                                <th key={key} scope="col">
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {result.previewRows.map((row, idx) => (
                              <tr key={idx}>
                                {Object.keys(result.previewRows[0] ?? {}).map((key) => (
                                  <td key={key}>{formatCell(row[key])}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="app-fixture-panel__row">
                    <span className="app-fixture-panel__label">Fixture in catalog</span>
                    <Badge variant="warning" semanticLabel="Fixture test did not succeed">
                      Unavailable
                    </Badge>
                  </div>
                  <p className="app-fixture-panel__error">{humanizeFailure(result)}</p>
                  {result.httpStatus !== undefined ? (
                    <p className="app-fixture-panel__meta">HTTP {result.httpStatus}</p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </CardBody>
      </Card>
    </AppErrorBoundary>
  );
}

function humanizeFailure(
  result: Extract<Awaited<ReturnType<typeof probeSyntheticFixtureConnection>>, { ok: false }>,
): string {
  switch (result.code) {
    case "BRIDGE_UNREACHABLE":
      return result.message;
    case "DATA_ROOT_NOT_CONFIGURED":
      return result.message;
    case "FIXTURE_NOT_AVAILABLE":
      return result.message;
    case "INVALID_RESPONSE":
      return result.message;
    case "HTTP_ERROR":
      return result.message;
    default:
      return result.message;
  }
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}
