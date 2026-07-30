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

## Primitive catalog, Set 2

| # | Drop | Primitive(s) | Pipeline surface |
| --- | --- | --- | --- |
| 9 | The typer | Character reveal: each glyph ripples through pill/highlight/border states before settling; per-line stagger via TyperGroup | Headline entrances on cards and generated scenes; framework-free, in()/out() driven |
| 10 | Realistic emboss | WebGL plaster press: word or SVG embossed with bevel/light/surface controls, 9 presets | Logo stingers, tactile title cards, brand marks |
| 11 | Chromatic glow | GPU bloom + chromatic split of a word; dark and light modes; built-in disperse-and-reform cycle transition | Neon titles; the disperse transition is a scene-swap language of its own |
| 12 | Ransom note | Real torn-paper letter sprites composed per character, seeded jitter, slam-in entrance | Playful titles/quotes; needs the sprite pack (external asset, R2-hosted in source) |
| 13 | Apple's corners | Squircle path generator + a full glossy-material component family (button, tabs, toggle, input, stepper, dropdown) | Styled UI props inside ads/demos; the path generator is a general shape utility |
| 14 | Kinetic typography | Canvas 2D tile-warp: letter cut into a grid, tiles ripple on interference waves, duotone + chroma + grain | Motion backgrounds, title treatments; cheap (no WebGL) |
| 15 | Liquid UI | SDF smooth-union + marching squares: cards fuse with concave fillets or gooey necks, one knob | Animated UI compositions for product-story scenes; morphs between layouts |
| 16 | Fade motion | Single-pass WebGL trail accumulation: a word long-exposed into light or ink, 7 palettes, hero self-drive | Atmospheric titles/closers; palettes crossfade continuously |

## Set 2 notes

- Text-effect family is now deep: typer (9), emboss (10), chroma (11), ransom
  (12), kinetic (14), fade (16), plus set 1's swirl. The eventual config should
  expose ONE "title" scene kind with a style parameter, not seven scene kinds.
- Entrance/exit vocabulary worth lifting engine-agnostically: typer's in/out,
  chroma's disperse-and-reform, ransom's slam-and-settle and lift-blur-out,
  kinetic's constant ripple, fade's palette wash. These are transition grammars
  a recipe can name.
- Hero self-drive appears twice (chroma's cycle mode, fade's ghost cursor +
  palette timer): components animate themselves without a pointer, which is
  exactly the capture-friendly property we need. Prefer these modes in scene
  harness defaults.
- Deterministic replay: ransom uses a seeded PRNG (mulberry32 + hashSeed) —
  the strongest determinism story so far, and a pattern to demand of future
  primitives. Chroma/fade/kinetic run on wall-clock (fine for capture).
- Shared control-kit dependency: sets 1-2 playgrounds all import
  ../swirl/controls and ../section-label — the playground chrome is NOT needed
  for video use; only engines/components get harnessed. Also referenced but not
  supplied: lib/haptics, lib/sound, lib/view-transition, ../../lib/video-sources
  (already have from set 1), font vars (--font-neue-corp, --font-mondwest,
  --font-woodland). Harness stubs cover all of these.
- External assets: ransom needs the Resource Boy sprite pack + manifest.json
  (royalty-free, but the actual files aren't in the drop); emboss needs
  plaster/grunge textures from the same R2 bucket. Ask Karo for the asset bundle
  or substitute our own.
- Squircle drop is the odd one out: less a video effect, more a design-system
  utility + material study. Value for video is the styled component props; value
  for the wider toolbox is the path generator and the embedded material method.

## Primitive catalog, Set 3 (final)

Twenty drops, one duplicate (5 and 6 are the identical ascii-wordmark). Framing
changed: these are "Build this" engines with mount/start/stop/renderStill/destroy
lifecycles, mostly framework-free. That is a better harness fit than the
playground trees of sets 1-2, and most of them self-drive (auto-cycle, ghost
cursors, idle drift), which is exactly the capture-friendly property.

| # | Drop | Primitive(s) | Pipeline surface |
| --- | --- | --- | --- |
| 1 | Tile field | Wordmark as touching square tiles; oklch colour wave + cursor light blob; Canvas 2D | Brand idents, section beds |
| 2 | Fire field | Minecraft fire flipbook with a live editable pixel buffer | Toy; blocked on Mojang assets (see provenance) |
| 3 | Pixel scan | three.js shader: diagonal band assembles a word from coloured blocks, then rests solid | Techy title reveals |
| 4 | Pixel field | Image cycler: pixelize in sharp, out chunky, 3D-ish swap; gsap-driven | Screenshot/photo montages in ads |
| 5/6 | ASCII wordmark (pasted twice) | GPGPU flow-field particles rendered as ASCII glyphs; three.js + GPUComputationRenderer | Living technical wordmark |
| 7 | Image galaxy | DOM perspective field of drifting images, infinite wrap, depth parallax | Screenshot b-roll beds, montage backgrounds |
| 8 | Frosted word + cursors | CSS frosted-glass text stack; Figma-style labelled cursors orbiting + scattering | Collaboration-story scenes, team credits |
| 9 | Gold scar | glTF on a pedestal: silhouette outline + shader loot beam + glow; three.js | Product hero shots (swap in any model) |
| 10 | Image sphere | Billboarded image cloud on a sphere, drag/spin, click-to-focus | Gallery/recap scenes |
| 11 | Design tiles | Per-word solid-colour tile bar, clip-path fly-in, idle colour shuffle | Statement lines, section titles |
| 12 | Word stickers | Die-cut vinyl stickers (canvas dilate) + fling physics | Playful idents; gl-sticker module missing (stub works, non-GL path exists) |
| 13 | Blur reveal | WebGL fbm dissolve + localized un-blur, cycling colour panels | Quote/value cards that cycle |
| 14 | LEGO reveal | Style-cycling portrait (LEGO/Minecraft/Roblox) melting to the real photo along a trail buffer | Personal intros/outros; photo recipe included |
| 15 | Text reveal | Corner text blocks materializing through a cloudy fbm front | Editorial openers, chapter cards |
| 16 | Blur glow | Multi-pass bloom + 5-stop gradient map + variable focus; 6 palettes | Soft luxurious titles on paper |
| 17 | Badge trail | Cursor drops compact mono badges; ghost cursor when idle | Playful overlay energy, credits |
| 18 | Folder embroidery | Satin-stitch embroidered word patches; weave bump shader | Craft/tactile brand moments; weave texture URL provided |
| 19 | Liquid chrome | Height-field + env-map chrome with 8 colour ramps | Premium metal titles |
| 20 | Dotcut | Negative-space glyph in a circle lattice; 6 scenes, per-cell transitions | Pattern interstitials, single-letter idents |

## Set 3 notes

- Missing modules inside the drops: design-tiles imports ./measure
  (measureWord/REF_FS/BASELINE_Y — small, reconstructable from usage),
  word-stickers imports ./gl-sticker (StickerGL — a stub whose available=false
  activates the included non-GL fallback), and lib/sound surfaces again
  (isMuted, glitchScan, glitchTick — harness stubs).
- New npm deps implied: three (+ examples/jsm) and gsap (pixel-field only;
  its timeline is simple enough to reimplement and drop the dep).
- Asset ledger for set 3: embroidery weave has a download URL (the only one);
  lego needs four photos with the restyle recipe included in the drop;
  gold-scar needs scar.glb + chest.mp3 (substitute any CC0 model); fire needs
  Minecraft textures + sounds, which are Mojang IP — never commit those to a
  public repo, treat that primitive as private-only or re-draw the art.
- Self-drive is now the norm: dotcut, blur-reveal, design-tiles, text-reveal,
  blur-glow, tile-field, image-galaxy, cursors, badge-trail (ghost), lego
  (virtual cursor) all animate without a pointer. Where a cursor matters,
  three drops ship their own autonomous cursor pattern (the LEGO wander,
  badge-trail ghost, chroma's from set 2) — that pattern becomes the harness's
  standard fake-pointer driver.

All sets received (36 drops, 33 unique). The deferred design questions are
resolved in `design/generated-scenes.md`.
