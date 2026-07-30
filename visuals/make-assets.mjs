// Generate the textures some drops expect but do not ship, so every visual can run without
// hunting down someone else's asset. Authoring-time only: the output is committed.
//   node visuals/make-assets.mjs
//
// Plaster  - a lit wall: low-frequency fbm blotches + fine grain, mid-grey centred.
// Grunge   - higher-frequency mottling for the overlay pass, also mid-grey centred.
// Masks    - the feathered ramps the ghost reveal slides across an element.

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "assets");
await mkdir(out, { recursive: true });

// Canvas work happens in a browser: no native image dependency, and the same noise the
// scenes themselves use at runtime.
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });

const shots = await page.evaluate(() => {
  // value noise + fbm, seeded and tileable by wrapping the lattice
  const hash = (x, y, s) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const noise = (x, y, period, s) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const w = (a, b) => hash(((a % period) + period) % period, ((b % period) + period) % period, s);
    return (
      w(xi, yi) * (1 - u) * (1 - v) + w(xi + 1, yi) * u * (1 - v) +
      w(xi, yi + 1) * (1 - u) * v + w(xi + 1, yi + 1) * u * v
    );
  };
  const fbm = (x, y, octaves, period, s) => {
    let v = 0, amp = 0.5, p = period;
    for (let i = 0; i < octaves; i++) {
      v += amp * noise((x * p) / 512, (y * p) / 512, p, s + i);
      p *= 2;
      amp *= 0.5;
    }
    return v;
  };

  const render = (fn) => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(512, 512);
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const v = Math.max(0, Math.min(255, Math.round(fn(x, y) * 255)));
        const i = (y * 512 + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  };

  // a wall: broad blotches, a slow sheen across it, fine tooth on top
  const plaster = render((x, y) => {
    const blotch = fbm(x, y, 4, 3, 11);
    const sheen = fbm(x, y, 1, 1, 3);
    const tooth = hash(x, y, 5) - 0.5;
    return 0.5 + (blotch - 0.5) * 0.42 + (sheen - 0.5) * 0.18 + tooth * 0.06;
  });
  // grunge: tighter, contrastier mottling for the overlay blend
  const grunge = render((x, y) => {
    const f = fbm(x, y, 5, 6, 29);
    const g = hash(x, y, 17) - 0.5;
    return 0.5 + (f - 0.5) * 0.8 + g * 0.1;
  });

  // feathered reveal masks: a long soft ramp, white to transparent
  const ramp = (vertical) => {
    const c = document.createElement("canvas");
    c.width = vertical ? 64 : 1024;
    c.height = vertical ? 1024 : 64;
    const ctx = c.getContext("2d");
    const g = vertical
      ? ctx.createLinearGradient(0, 0, 0, c.height)
      : ctx.createLinearGradient(0, 0, c.width, 0);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.42, "rgba(255,255,255,1)");
    g.addColorStop(0.58, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  };

  return {
    "emboss-plaster.png": plaster,
    "emboss-grunge.png": grunge,
    "mask-vertical.png": ramp(true),
    "mask-horizontal.png": ramp(false),
  };
});

for (const [name, dataUrl] of Object.entries(shots)) {
  const b64 = dataUrl.split(",")[1];
  await writeFile(path.join(out, name), Buffer.from(b64, "base64"));
  console.log(`wrote assets/${name}`);
}
await browser.close();
