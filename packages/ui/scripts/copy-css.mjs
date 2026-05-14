import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
const dist = join(pkgRoot, "dist");
const src = join(pkgRoot, "src");

mkdirSync(dist, { recursive: true });
for (const name of ["tokens.css", "components.css"]) {
  copyFileSync(join(src, name), join(dist, name));
}
