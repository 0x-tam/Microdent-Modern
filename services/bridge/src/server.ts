import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { loadBridgeConfig } from "./config.js";
import { createBridgeApp } from "./app.js";

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

async function main(): Promise<void> {
  const bridgeConfig = loadBridgeConfig();
  const { host, port } = bridgeConfig.listen;
  const app = createBridgeApp(undefined, { bridgeConfig });
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.listen(port, host, () => resolve());
    server.on("error", reject);
  });
  const addr = server.address();
  const where = typeof addr === "object" && addr ? `${host}:${addr.port}` : `${host}:${port}`;
  console.error(`bridge listening on http://${where} (writeMode=${bridgeConfig.writeMode})`);
}

if (isMainModule()) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : "bridge startup failed";
    console.error(`ERROR: ${message}`);
    process.exitCode = 1;
  });
}
