// Build the scene bundles: one esbuild bundle per primitive, entry = its
// adapter, output committed to visuals/primitives/. Run with:
//   npx esbuild@0.21 --version   # any recent esbuild
//   node visuals/build.mjs
// esbuild is an authoring-time tool only; the CLI serves the committed output
// and keeps its zero-runtime-dependency rule.

import { execFileSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(here, "src");

const entries = readdirSync(srcDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "shared")
  .map((d) => path.join(srcDir, d.name, "adapter.ts"))
  .filter((p) => existsSync(p));

for (const entry of entries) {
  const name = path.basename(path.dirname(entry));
  execFileSync(
    "npx",
    [
      "--yes",
      "esbuild",
      entry,
      "--bundle",
      "--format=esm",
      "--loader:.css=text",
      "--target=chrome110",
      `--outfile=${path.join(here, "primitives", `${name}.js`)}`,
      "--log-level=warning",
    ],
    { stdio: "inherit" },
  );
  console.log(`built ${name}`);
}
