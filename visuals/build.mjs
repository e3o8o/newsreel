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
  .filter((d) => d.isDirectory() && d.name !== "shared" && d.name !== "cinema")
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

// The cinema compositor is not a scene: it builds to visuals/cinema/ next to its html page,
// same authoring rule as the primitives (esbuild here, committed output, zero runtime deps).
execFileSync(
  "npx",
  ["--yes", "esbuild", path.join(srcDir, "cinema", "compositor.ts"),
    "--bundle", "--format=esm", "--target=chrome110",
    `--outfile=${path.join(here, "cinema", "compositor.js")}`, "--log-level=warning"],
  { stdio: "inherit" },
);
console.log("built cinema compositor");
