// Make site/ self-contained so it can be dropped on any static host: copy the scene
// bundles, their assets, and the catalog in from visuals/. Run before deploying.
//   node site/build.mjs
import { cp, mkdir, rm, writeFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
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

// ── the deployable subset ───────────────────────────────────────────────────────────────
// site/ is also a working directory: the ad was cut in place, so site/ad/.work holds ~150MB
// of clips, wavs and segment mp4s, and there are screenshots in .shots. Deploying the folder
// wholesale would publish all of it.
//
// So the deploy is an explicit ALLOWLIST, not an ignore list. An ignore list fails open: the
// day someone drops a new working file in here it ships. This fails closed.
const PUBLISH = [
    "index.html", "style.css", "site.js",
    "catalog.json", "kinds.json",
    "assets", "visuals", "media",
    "ad/newsreel-ad.mp4", "ad/thumbnail.jpg",
];

const dist = path.join(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const rel of PUBLISH) {
    const from = path.join(here, rel);
    if (!existsSync(from)) throw new Error(`site/build.mjs: ${rel} is in PUBLISH but missing at ${from}`);
    const to = path.join(dist, rel);
    await mkdir(path.dirname(to), { recursive: true });
    await cp(from, to, { recursive: true });
}

// Immutable hashed assets these are not, so cache the shell briefly and the heavy media hard.
await writeFile(path.join(dist, "_headers"), [
    "/*",
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    "",
    "/assets/*",
    "  Cache-Control: public, max-age=604800",
    "",
    "/visuals/*",
    "  Cache-Control: public, max-age=604800",
    "",
    "/media/*",
    "  Cache-Control: public, max-age=604800",
    "",
    "/ad/*",
    "  Cache-Control: public, max-age=604800",
    "",
].join("\n"));

const bytes = await dirSize(dist);
console.log(`dist: ${(bytes / 1e6).toFixed(1)}MB ready to deploy -> ${path.relative(process.cwd(), dist)}`);

async function dirSize(dir) {
    let total = 0;
    for (const e of await readdir(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        total += e.isDirectory() ? await dirSize(p) : (await stat(p)).size;
    }
    return total;
}
