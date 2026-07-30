// Scene registry: name -> loader for its bundled module. Bundles are built
// from visuals/src by visuals/build.mjs and committed, so the CLI needs no
// build step or runtime dependency to serve them.

export const REGISTRY = {
  swirl: () => import("../primitives/swirl.js"),
  chroma: () => import("../primitives/chroma.js"),
  fade: () => import("../primitives/fade.js"),
  kinetic: () => import("../primitives/kinetic.js"),
  typer: () => import("../primitives/typer.js"),
  dotcut: () => import("../primitives/dotcut.js"),
  "tile-field": () => import("../primitives/tile-field.js"),
  "blur-reveal": () => import("../primitives/blur-reveal.js"),
  "blur-glow": () => import("../primitives/blur-glow.js"),
  chrome: () => import("../primitives/chrome.js"),
  cursors: () => import("../primitives/cursors.js"),
  embroidery: () => import("../primitives/embroidery.js"),
  cta: () => import("../primitives/cta.js"),
};
