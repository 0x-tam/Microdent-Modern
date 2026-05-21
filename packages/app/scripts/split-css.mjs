import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src");
const stylesDir = join(src, "styles");
const css = readFileSync(join(src, "app-shell.css"), "utf8");
const lines = css.split("\n");

function slice(start, end) {
  return lines.slice(start - 1, end).join("\n");
}

const sections = {
  "shell-layout.css": [
    [6, 50],
    [395, 751],
    [778, 915],
    [4315, lines.length],
  ],
  "shell-status.css": [[752, 777], [243, 278]],
  "shared/surface.css": [[51, 162], [163, 242], [279, 394], [1451, 1981]],
  "shared/toolbar.css": [[114, 130]],
  "shared/data-list.css": [],
  "pages/today.css": [[916, 1333], [3064, 3146]],
  "pages/schedule.css": [[1334, 1450]],
  "pages/patients.css": [[438, 628], [1982, 2032]],
  "pages/profile.css": [[2033, 3063]],
  "pages/settings.css": [[3147, 3479]],
  "pages/write.css": [],
};

mkdirSync(join(stylesDir, "shared"), { recursive: true });
mkdirSync(join(stylesDir, "pages"), { recursive: true });

for (const [file, ranges] of Object.entries(sections)) {
  const content = ranges.map(([s, e]) => slice(s, e)).filter(Boolean).join("\n\n");
  writeFileSync(join(stylesDir, file), content + (content ? "\n" : ""));
}

const hub = `/**
 * App shell — import hub for clinic workspace styles.
 * Import order in the host: @microdent/ui/tokens.css, @microdent/ui/components.css, then @microdent/app/app-shell.css.
 */

@import "./styles/shell-layout.css";
@import "./styles/shell-status.css";
@import "./styles/shared/surface.css";
@import "./styles/shared/toolbar.css";
@import "./styles/shared/data-list.css";
@import "./styles/pages/today.css";
@import "./styles/pages/patients.css";
@import "./styles/pages/profile.css";
@import "./styles/pages/schedule.css";
@import "./styles/pages/settings.css";
@import "./styles/pages/write.css";

/* ----- UX consistency pass (legacy overrides retained in hub) ----- */
${slice(3480, 4314)}
`;

writeFileSync(join(src, "app-shell.css"), hub);
console.log("CSS split complete");
