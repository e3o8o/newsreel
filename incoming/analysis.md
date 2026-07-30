# Distillation: visual drops → newsreel primitives

First pass over Set 1 (see `visual-prompts.md`). The full integration design
waits until every set has arrived; this catalogs what each drop gives us and
where it plugs into the pipeline, so the final design composes instead of
bolting on.

## The integration thesis

Newsreel already renders its cards through Playwright (HTML → PNG) and captures
app footage through Playwright (page → webm). Every drop in Set 1 is a
self-contained web visual. So the natural architecture is a third scene source
next to "captured footage" and "static cards": a GENERATED SCENE — the CLI
mounts one of these components on a local harness page with scene-specific
props, drives it deterministically (replay triggers, prop timelines), and
captures it like any other clip. Generated scenes then flow through the same
assembler (styled frame optional, narration, music, trims), so ads and launch
videos are recipes that mix generated scenes, treated footage, and cards.

Two capture requirements these components already meet, worth preserving as a
rule for future drops: a deterministic entrance that can be re-armed (replay(),
play/reveal props, mount-time rise), and reduced-motion guards we must DISABLE
in the capture harness (the capture browser must never take the reduced path).

## Primitive catalog, Set 1

| # | Drop | Primitive(s) | Pipeline surface |
| --- | --- | --- | --- |
| 1 | Midjourney ASCII swirl | Title sequence: vortex text condenses into a word/logo; 9 figlet faces, gradients, waves, trails, CRT post | Opening/closing scenes, section breaks |
| 2 | Amo hover button | Hover-reveal interaction pattern; springy playback-rate ramp; magnetism + click-pop | Interaction demo close-ups; the speed-spring is a reusable motion curve for any clip |
| 3 | Figma vector editor | Selection chrome: animated bounding box, corner handles, W×H badge; bezier rig overlay | Callout overlay on screenshots/footage ("design-tool" annotation style for demos) |
| 4 | Dia gradient | Aurora backgrounds: blurred bars, peaked bezier mountain, color-dodge dome; all with a rise-from-floor reveal | Scene backgrounds, closing-card backdrops, lower-third glow beds |
| 5 | Symbols effect | Footage treatment: GPU halftone that rebuilds any image/video from glyph stamps in 4 brightness bands | Stylized b-roll from captured clips; teaser/ad treatments of product footage |
| 6 | Ghosty reveal | Feathered mask wipe (mask-position slide) for images/elements, 4 directions, controlled or scroll-triggered | Scene transitions; screenshot entrances inside generated scenes |
| 7/8 | Color depth (pasted twice, identical) | Ten CSS material recipes (glossy/glow/metal/foil/glass/neon/inset/duotone/satin/layered) + the layering method as a written skill | Card and mockup styling: hero buttons in ads, styled UI props; the SKILL.md inside it is directly liftable |

## Per-drop notes

1. Swirl: the heaviest and highest-value. WebGL2; the engine takes a config
   object (word or pre-baked rows, ink/logo/bg colors, gradient stops, zoom,
   turbulence, wave pattern, CRT knobs) and exposes replay(). For newsreel it
   is the branded title generator: "FINANCECREW" condensing out of a vortex
   beats a static title card. Needs a headless-friendly harness (it gates on
   IntersectionObserver visibility around the viewport middle; the harness
   must position it there or stub the observer).

2. Amo button: two separable ideas. The component itself (a pill that reveals
   an alpha video) is demo-material; the deeper reusable piece is the motion
   language: entrance spring on playbackRate + eased tail slowdown, and the
   rewind-from-current-position trick (seek the reversed clip to D - t). That
   playback-rate curve could be applied to OUR captured clips in the
   assembler as an alternative to flat speed factors.

3. Figma frame: the chrome (border draw-open, staggered handles, size badge)
   wraps ANY element and tracks size. As a capture-harness overlay it gives
   demo videos the "we are inspecting this UI" grammar without faking
   screenshots in an editor. The vector editor half is playground material,
   lower priority for video.

4. Dia gradients: three independent components (bars, peaked, dodge), all
   cheap SVG/CSS, all with a mount rise and a replayKey. Immediate use: richer
   backgrounds for the title/closing cards than the current static presets;
   the palette is a prop, so brand colors drop in.

5. Symbols effect: three.js; SymbolsEffect class takes canvas + params (cell
   size, 4 band colors, 5 stops, glyph indices, zoom, bg) and accepts
   setImage/setVideo. Feeding it a captured clip and re-recording the canvas
   gives a halftone-glyph version of real product footage: a strong ad look.
   This is the one that most wants a dedicated "treatment" stage in the CLI
   (input clip → treated clip) rather than a scene harness.

6. Ghost reveal: pure CSS mask; needs the feathered mask PNGs (vertical +
   horizontal ramp) which are NOT in the drop — we generate our own (a canvas
   gradient render at build time keeps it asset-free). `play` prop makes it
   fully deterministic for capture; onHidden gives exact swap timing.

7. Color depth: no runtime work needed; it is CSS + tiny JS. Two uses: styling
   inside generated scenes (hero CTAs in ads), and the embedded SKILL.md is a
   ready-made authoring guide worth carrying into the newsreel skill set
   almost verbatim (licence/credit line pending provenance).

## Cross-cutting observations

- Stack split: 1-3 are React/Next components, 5 is three.js, 4/6/7 are
  near-vanilla. The harness should not adopt Next; a single static page with
  esbuild-bundled components (React where needed) keeps the CLI dependency
  surface small. Decide after all sets arrive.
- Determinism: capture must control time. Components animating on wall-clock
  (swirl's elapsed, foil's ambient drift) are fine for capture-as-video; only
  interactions need scripted pointer drivers, which Playwright supplies.
- Reduced motion: every drop honors prefers-reduced-motion; the harness must
  force no-preference so captures never get the fallback.
- Sound: drops 1 and 2 reference lib/sound + lib/haptics modules that are NOT
  included in the paste. Visual paths do not need them; harness stubs suffice.
  Same for section-label and figlet-fonts being partial (figlet-fonts IS
  included; sound/haptics are not).
- Provenance: the drops describe themselves as re-authored studies of public
  sites (Midjourney, amo, Figma, Dia) with "grab it and drop it in" language.
  Before anything ships in a public repo release, confirm with Karo where
  these came from and what attribution the source expects (the BetterShot
  precedent: credit + license line in the README).

## Open until all sets arrive

- The config contract for video "kinds" (report / ad / launch / demo) and how
  a recipe names generated scenes, treatments, and footage in one timeline.
- Whether treatments (symbols effect, future shader looks) run live during
  capture or as a post pass over already-captured clips (post pass likely:
  simpler, reusable over any footage).
- The harness architecture (single bundled page vs per-primitive pages).
- Which primitives earn config-level names in v1 versus staying raw material.
