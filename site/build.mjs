// Make site/ self-contained so it can be dropped on any static host: copy the scene
// bundles, their assets, and the catalog in from visuals/. Run before deploying.
//   node site/build.mjs
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const require = createRequire(import.meta.url);

await rm(path.join(here, "visuals"), { recursive: true, force: true });
await mkdir(path.join(here, "visuals"), { recursive: true });
await cp(path.join(root, "visuals", "primitives"), path.join(here, "visuals", "primitives"), { recursive: true });
// mediaUrl() resolves textures at /assets/..., so they sit at the site root
await cp(path.join(root, "visuals", "assets"), path.join(here, "assets"), { recursive: true });
await cp(path.join(root, "visuals", "catalog.json"), path.join(here, "catalog.json"));

// The kinds section is rendered from the CLI's own recipes, so the palettes on the page are
// the palettes a video actually rolls from. Hand-writing them here would drift on the first edit.
const { KINDS } = require(path.join(root, "lib", "kinds.cjs"));
const { findPreset, backgroundCss } = require(path.join(root, "lib", "style.cjs"));
const { tracks } = require(path.join(root, "lib", "music", "default.cjs"));
const about = Object.fromEntries(tracks().map((t) => [t.id, t.about]));

const kinds = Object.entries(KINDS).map(([id, k]) => ({
    id,
    about: k.about,
    accent: k.accent,
    track: k.track,
    trackAbout: about[k.track] || "",
    maxSpeed: k.maxSpeed,
    scenes: k.scenes,
    backgrounds: k.backgrounds.map((b) => {
        // backgroundCss takes a style, not a preset: hand it a preset and every swatch
        // silently comes back as the default navy
        return { id: b, name: findPreset(b).name, css: backgroundCss({ background: { preset: b } }) };
    }),
}));
await writeFile(path.join(here, "kinds.json"), JSON.stringify(kinds, null, 2) + "\n");
console.log(`site: visuals, assets and catalog copied; ${kinds.length} kinds written`);
