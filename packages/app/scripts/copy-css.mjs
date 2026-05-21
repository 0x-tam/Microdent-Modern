import { copyFileSync, cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
const dist = join(pkgRoot, "dist");
const src = join(pkgRoot, "src");

mkdirSync(dist, { recursive: true });
copyFileSync(join(src, "app-shell.css"), join(dist, "app-shell.css"));
cpSync(join(src, "styles"), join(dist, "styles"), { recursive: true });
