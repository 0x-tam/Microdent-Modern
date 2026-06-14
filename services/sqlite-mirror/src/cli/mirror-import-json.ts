import { runMirrorImportSafe } from "../run-mirror-import-safe.js";

type CliArgs = {
  dataRoot?: string;
  sqlitePath?: string;
  incremental?: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const parsed: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--data-root" && next) {
      parsed.dataRoot = next;
      i++;
    } else if (arg === "--sqlite-path" && next) {
      parsed.sqlitePath = next;
      i++;
    } else if (arg === "--incremental") {
      parsed.incremental = true;
    }
  }
  return parsed;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dataRoot || !args.sqlitePath) {
    console.error("ERROR: clinic data folder and fast local copy path are required.");
    process.exit(1);
  }

  const result = await runMirrorImportSafe({
    dataRoot: args.dataRoot,
    sqlitePath: args.sqlitePath,
    incremental: args.incremental === true,
  });

  process.stdout.write(`${JSON.stringify({
    overall: result.overall,
    steps: result.steps,
  })}\n`);
}

main().catch(() => {
  console.error("ERROR: local copy import failed.");
  process.exit(1);
});
