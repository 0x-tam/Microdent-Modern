import { loadSandboxEnvFromProcess } from "../sandbox/sandbox-env.js";
import {
  createWriteSandbox,
  printCreateWriteSandboxReport,
} from "../sandbox/create-write-sandbox.js";

function printEnvHelp(missing: ("SOURCE_DATA_ROOT" | "SANDBOX_ROOT")[]): void {
  const vars = missing.join(", ");
  console.error(`ERROR: ${vars} must be set.`);
  console.error("");
  console.error("Example:");
  console.error('  export SOURCE_DATA_ROOT="/absolute/path/to/read-only/DATA-copy"');
  console.error('  export SANDBOX_ROOT="/absolute/path/to/your-disposable-write-sandbox"');
  console.error("  pnpm legacy:create-sandbox");
  console.error("");
  console.error("Never point SOURCE_DATA_ROOT at the production legacy DATA tree.");
  console.error("Never place SANDBOX_ROOT inside production legacy or legacy-copy folders.");
}

async function main(): Promise<void> {
  let loaded;
  try {
    loaded = loadSandboxEnvFromProcess();
  } catch (e) {
    const message = e instanceof Error ? e.message : "invalid environment";
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }

  if (!loaded.ok) {
    printEnvHelp(loaded.missing);
    process.exit(1);
  }

  try {
    const result = await createWriteSandbox({
      sourceDataRoot: loaded.env.sourceDataRoot,
      sandboxRoot: loaded.env.sandboxRoot,
    });
    printCreateWriteSandboxReport(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "create sandbox failed";
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }
}

main().catch(() => {
  console.error("ERROR: legacy create-sandbox failed");
  process.exit(1);
});
