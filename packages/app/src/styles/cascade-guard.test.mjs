import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stylesRoot = join(__dirname);
const shellLayoutPath = join(stylesRoot, "shell-layout.css");

const SHELL_LAYOUT_ONLY = /\.(app-shell|app-workspace-shell)\s*\{[^}]*\}/gs;
const FORBIDDEN_SHELL_LAYOUT = /flex-direction\s*:\s*column/;

function collectCssFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectCssFiles(full, acc);
      continue;
    }
    if (name.endsWith(".css")) acc.push(full);
  }
  return acc;
}

describe("CSS cascade guard — shell layout ownership", () => {
  it("does not set flex-direction column on .app-shell outside shell-layout.css", () => {
    const offenders = [];
    for (const file of collectCssFiles(stylesRoot)) {
      if (file === shellLayoutPath) continue;
      const rel = relative(stylesRoot, file);
      const text = readFileSync(file, "utf8");
      const blocks = text.match(SHELL_LAYOUT_ONLY) ?? [];
      for (const block of blocks) {
        if (FORBIDDEN_SHELL_LAYOUT.test(block)) {
          offenders.push(rel);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("shell-layout.css defines workspace shell grid", () => {
    const layout = readFileSync(shellLayoutPath, "utf8");
    expect(layout).toMatch(/\.app-workspace-shell/);
    expect(layout).toMatch(/display:\s*grid|display:\s*flex/);
  });
});
