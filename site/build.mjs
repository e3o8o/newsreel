// Make site/ self-contained so it can be dropped on any static host: copy the scene
// bundles, their assets, and the catalog in from visuals/. Run before deploying.
//   node site/build.mjs
import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

await rm(path.join(here, "visuals"), { recursive: true, force: true });
await mkdir(path.join(here, "visuals"), { recursive: true });
await cp(path.join(root, "visuals", "primitives"), path.join(here, "visuals", "primitives"), { recursive: true });
// mediaUrl() resolves textures at /assets/..., so they sit at the site root
await cp(path.join(root, "visuals", "assets"), path.join(here, "assets"), { recursive: true });
await cp(path.join(root, "visuals", "catalog.json"), path.join(here, "catalog.json"));
console.log("site: visuals, assets and catalog copied");
