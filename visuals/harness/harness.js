// The scene harness. Reads ?scene=<name>&props=<base64 json>, mounts the
// primitive on #stage, starts it, and signals readiness on window so the
// capture step knows when to start counting the shot's duration.
//
// Contract with capture:
//   window.__NEWSREEL_READY__  -> true once the scene is mounted and running
//   window.__NEWSREEL_ERROR__  -> a message when mounting failed
//   window.__NEWSREEL_ACTION__ -> (name, args) => Promise, for timeline beats

import { REGISTRY } from "./registry.js";

const qs = new URLSearchParams(location.search);
const sceneName = qs.get("scene") || "";
let props = {};
try {
  const raw = qs.get("props");
  if (raw) {
    // atob yields a Latin-1 string; decode the underlying bytes as UTF-8 so
    // multi-byte characters (a euro sign in a headline) survive the trip.
    const bin = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    props = JSON.parse(new TextDecoder().decode(bytes));
  }
} catch (e) {
  console.warn("harness: unparseable props, using {}", e);
}

async function main() {
  const stage = document.getElementById("stage");
  const load = REGISTRY[sceneName];
  if (!load) {
    window.__NEWSREEL_ERROR__ = `unknown scene "${sceneName}" (have: ${Object.keys(REGISTRY).join(", ")})`;
    return;
  }
  try {
    // Warm the mapped fonts before any engine rasterizes glyph metrics.
    if (document.fonts && document.fonts.ready) {
      await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
    }
    const mod = await load();
    const scene = mod.default;
    const handle = await scene.mount(stage, props);
    handle.start();
    window.__NEWSREEL_ACTION__ = (name, args) =>
      Promise.resolve(handle.action ? handle.action(name, args) : undefined);
    // one frame so the first paint is on screen before capture starts the clock
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    window.__NEWSREEL_READY__ = true;
  } catch (e) {
    console.error(e);
    window.__NEWSREEL_ERROR__ = String((e && e.message) || e);
  }
}

main();
