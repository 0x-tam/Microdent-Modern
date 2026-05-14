import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { createBridgeApp, loadListenOptions } from "./app.js";

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

async function main(): Promise<void> {
  const { host, port } = loadListenOptions();
  const app = createBridgeApp();
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.listen(port, host, () => resolve());
    server.on("error", reject);
  });
  const addr = server.address();
  const where = typeof addr === "object" && addr ? `${host}:${addr.port}` : `${host}:${port}`;
  console.error(`bridge listening on http://${where}`);
}

if (isMainModule()) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
