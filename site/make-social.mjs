// Render the social card: a newsreel scene as the background, the mark and the pitch over it.
//   node site/make-social.mjs [scene]
//
// The background is not a gradient someone picked in Figma. It is one of the 35 bundled scenes,
// mounted in the same harness `capture` records from and shot at 1200x630. The card the tool
// makes for itself is made by the tool.
//
// 1200x630 because that is what X, LinkedIn, Slack and Discord all crop to (1.91:1). The ad's
// poster is 1440x900, which is 1.6:1, so it gets letterboxed or centre-cropped depending on the
// consumer, and the headline loses its edges.

import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const require = createRequire(import.meta.url);
const { startVisualsServer, sceneUrl } = require(path.join(root, "lib", "visuals.cjs"));

const W = 1200, H = 630;
const ARG = process.argv[2] || "aurora";
const SCENE = ARG.startsWith("aurora-") ? "aurora" : ARG;
// scene props chosen so the background stays a background: movement and colour, no wordmark of
// its own competing with the one being drawn on top
const PROPS = {
    aurora: { treatment: "bars", speed: 0.5 },
    "aurora-peaked": { treatment: "peaked" },
    "aurora-dodge": { treatment: "dodge" },
    fire: { cols: 130 },
    galaxy: { text: "", count: 90 },
    "tile-field": {},
    "design-tiles": { text: "narrated videos from one config file every scene ships in the box" },
    liquid: {},
    swirl: { word: "newsreel" },
};

const MARK = `<svg viewBox="0 0 256 256" width="46" height="46" fill="#fff" aria-hidden="true">
  <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40v72a8,8,0,0,0,16,0V40h88V88a8,8,0,0,0,8,8h48V216h-8a8,8,0,0,0,0,16h8a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM155.88,145a8,8,0,0,0-8.12.22l-19.95,12.46A16,16,0,0,0,112,144H48a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h64a16,16,0,0,0,15.81-13.68l19.95,12.46A8,8,0,0,0,160,216V152A8,8,0,0,0,155.88,145ZM112,208H48V160h64v48Zm32-6.43-16-10V176.43l16-10Z"/>
</svg>`;

const SANS = `'Helvetica Neue', Helvetica, Arial, sans-serif`;
const MONO = `'SF Mono', ui-monospace, Menlo, Consolas, monospace`;

const OVERLAY = `
<div id="og">
  <div class="scrim"></div>
  <div class="content">
    <div class="brand">${MARK}<span>newsreel</span></div>
    <h1>Videos your repo<br>knows how to build.</h1>
    <p class="sub">Narrated videos from one config file. Reports, demos, ads, launch films.</p>
    <div class="foot">
      <code>npx newsreel init</code>
      <span class="dot"></span>
      <span class="note">35 scenes in the box</span>
    </div>
  </div>
</div>
<style>
  #og { position: fixed; inset: 0; z-index: 9999; pointer-events: none; }
  /* the scrim is what makes the type readable over ANY scene, so the card does not depend on
     which background got picked */
  .scrim { position: absolute; inset: 0;
    background:
      linear-gradient(100deg, rgba(6,7,12,.80) 0%, rgba(6,7,12,.46) 38%, rgba(6,7,12,.06) 64%, rgba(6,7,12,0) 100%); }
  .content { position: absolute; inset: 0; padding: 62px 68px;
    display: flex; flex-direction: column; justify-content: center; gap: 22px;
    font-family: ${SANS}; color: #fff; }
  .brand { display: flex; align-items: center; gap: 13px;
    font: 600 27px/1 ${SANS}; letter-spacing: -.02em; }
  h1 { font: 600 65px/1.04 ${SANS}; letter-spacing: -.036em; margin: 0; max-width: 17ch; }
  .sub { font: 400 23px/1.42 ${SANS}; color: rgba(255,255,255,.76); margin: 0; max-width: 30ch; }
  .foot { display: flex; align-items: center; gap: 15px; margin-top: 8px; }
  code { font: 500 20px/1 ${MONO}; color: #fff;
    padding: 13px 17px; border-radius: 11px;
    background: rgba(255,255,255,.13);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.24); }
  .dot { width: 4px; height: 4px; border-radius: 999px; background: rgba(255,255,255,.4); }
  .note { font: 500 19px/1 ${MONO}; color: rgba(255,255,255,.62); }
</style>`;

const srv = await startVisualsServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });

await page.goto(sceneUrl(srv.url, { scene: SCENE, props: PROPS[ARG] || PROPS[SCENE] || {} }), { waitUntil: "load" });
await page.waitForFunction(() => window.__NEWSREEL_READY__ === true || window.__NEWSREEL_ERROR__, null, { timeout: 20000 });
const err = await page.evaluate(() => window.__NEWSREEL_ERROR__ || null);
if (err) throw new Error(`scene "${SCENE}": ${err}`);

// let the scene run a few seconds: most of them open on an empty frame and are only worth
// looking at once they have built up
await page.waitForTimeout(4200);
await page.evaluate((html) => document.body.insertAdjacentHTML("beforeend", html), OVERLAY);
await page.waitForTimeout(350);

const out = path.join(here, process.env.OG_OUT || "og.jpg");
await page.screenshot({ path: out, type: "jpeg", quality: 90 });
console.log(`social card: ${ARG} -> ${path.relative(process.cwd(), out)} (${W}x${H}@2x)`);

await browser.close();
await srv.close();
