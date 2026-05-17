import { createBridgeClient } from "@microdent/bridge-client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Badge, Button, Card, CardBody, CardHeader } from "@microdent/ui";
import { AppErrorBoundary } from "./AppErrorBoundary.js";

type PanelPhase = "idle" | "loading" | "ready";

export type LegacyCatalogPanelProps = {
  bridgeBaseUrl?: string;
  bridgePhase: "checking" | "connected" | "offline";
};

export function LegacyCatalogPanel(props: LegacyCatalogPanelProps) {
  if (!import.meta.env.DEV) {
    return null;
  }
  return <LegacyCatalogPanelDev {...props} />;
}

function LegacyCatalogPanelDev({ bridgeBaseUrl, bridgePhase }: LegacyCatalogPanelProps) {
  const [phase, setPhase] = useState<PanelPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tables, setTables] = useState<
    { tableId: string; displayName: string; fileName: string; present: boolean; recordCount: number | null; fieldCount: number | null }[] | null
  >(null);

  const base = bridgeBaseUrl?.trim() ?? "";

  const load = useCallback(async () => {
    if (!base) {
      setTables(null);
      setErrorMessage(null);
      setPhase("idle");
      return;
    }
    setPhase("loading");
    setErrorMessage(null);
    const client = createBridgeClient({ baseUrl: base });
    try {
      const res = await client.getLegacyCatalog();
      setTables(res.tables);
      setPhase("ready");
    } catch (e: unknown) {
      setTables(null);
      setPhase("ready");
      setErrorMessage(safeCatalogError(e));
    }
  }, [base]);

  useEffect(() => {
    if (!base || bridgePhase === "offline") {
      setTables(null);
      setErrorMessage(null);
      setPhase("idle");
    }
  }, [base, bridgePhase]);

  useEffect(() => {
    if (!base || bridgePhase !== "connected") {
      return;
    }
    void load();
  }, [base, bridgePhase, load]);

  const waiting = Boolean(base) && bridgePhase !== "connected" && tables === null && errorMessage === null;

  return (
    <AppErrorBoundary>
      <Card className="app-legacy-catalog-panel">
        <CardHeader>
          <p className="ui-card__title app-card-title-lg">Legacy data catalog</p>
          <p className="app-legacy-catalog-panel__subtitle">
            Developer / diagnostic — read-only catalog from copied legacy <code className="app-legacy-catalog-panel__code">DATA</code>{" "}
            folder. Table inventory and header counts only — not a clinical view; no patient rows or field values.
          </p>
        </CardHeader>
        <CardBody>
          {!base ? (
            <p className="app-legacy-catalog-panel__muted">No bridge URL configured; catalog is skipped.</p>
          ) : waiting ? (
            <p className="app-legacy-catalog-panel__muted">
              {bridgePhase === "checking"
                ? "Waiting for the bridge…"
                : "Bridge offline — start the bridge to load the catalog."}
            </p>
          ) : null}

          {base ? (
            <div className="app-legacy-catalog-panel__actions">
              <Button
                type="button"
                variant="secondary"
                size="compact"
                className="ui-focusable"
                disabled={phase === "loading" || bridgePhase !== "connected"}
                onClick={() => void load()}
              >
                {phase === "loading" ? "Loading…" : "Refresh catalog"}
              </Button>
            </div>
          ) : null}

          {phase === "loading" && !waiting ? (
            <p className="app-legacy-catalog-panel__muted" role="status">
              Loading legacy table metadata…
            </p>
          ) : null}

          {errorMessage ? <p className="app-legacy-catalog-panel__error">{errorMessage}</p> : null}

          {tables !== null && tables.length > 0 ? (
            <div className="app-legacy-catalog-panel__table-wrap">
              <table className="app-legacy-catalog-panel__table">
                <thead>
                  <tr>
                    <th scope="col">Table</th>
                    <th scope="col">File</th>
                    <th scope="col">Present</th>
                    <th scope="col">Records</th>
                    <th scope="col">Fields</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.map((t) => (
                    <tr key={t.tableId}>
                      <td>
                        <span className="app-legacy-catalog-panel__name">{t.displayName}</span>
                        <span className="app-legacy-catalog-panel__id">{t.tableId}</span>
                      </td>
                      <td>
                        <code className="app-legacy-catalog-panel__file">{t.fileName}</code>
                      </td>
                      <td>
                        {t.present ? (
                          <Badge variant="success" semanticLabel={`${t.fileName} present`}>
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="warning" semanticLabel={`${t.fileName} missing`}>
                            No
                          </Badge>
                        )}
                      </td>
                      <td>{formatCount(t.recordCount)}</td>
                      <td>{formatCount(t.fieldCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </AppErrorBoundary>
  );
}

function formatCount(n: number | null): ReactNode {
  if (n === null) {
    return "—";
  }
  return <span className="app-legacy-catalog-panel__num">{n.toLocaleString()}</span>;
}

function safeCatalogError(e: unknown): string {
  if (e !== null && typeof e === "object" && "kind" in e) {
    const k = (e as { kind?: string }).kind;
    if (k === "network") {
      return "Could not reach the bridge.";
    }
    if (k === "http") {
      const code = "apiCode" in e ? String((e as { apiCode?: string }).apiCode ?? "") : "";
      if (code === "DATA_ROOT_NOT_CONFIGURED") {
        return "DATA_ROOT is not set on the bridge. Point it at your copied legacy DATA folder.";
      }
      return "The bridge returned an error for the catalog request.";
    }
    if (k === "invalid_body") {
      return "The bridge response could not be read.";
    }
  }
  return "Catalog could not be loaded.";
}
