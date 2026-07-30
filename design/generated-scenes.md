# Newsreel evolution: generated scenes

Design for turning the 36 visual drops (33 unique, `incoming/visual-prompts.md`)
into newsreel capability, so an agent running the loop can produce not just
weekly reports but ads, launch videos, and demos with real visual craft. This
resolves the questions `incoming/analysis.md` deferred until all sets arrived.

## The one-sentence architecture

Newsreel already drives Playwright for two scene sources, captured app footage
and static cards; generated scenes become the third: the CLI serves a local
harness page, mounts a primitive with props from the config, waits for a ready
signal, records it like any clip, and the assembler treats the result exactly
like captured footage.

Nothing about the existing pipeline changes. A config with no generated shots
behaves as today.

## The harness

One static page + one esbuild bundle, living in the CLI (never copied into
projects, same rule as everything else).

```
visuals/
  harness/
    index.html          loads the bundle, reads ?scene=&props= (base64 json)
    harness.ts          registry lookup, mount, ready signal, action bus
    stubs.ts            lib/sound, lib/haptics, lib/view-transition, mediaUrl,
                        font vars mapped to bundled fonts
  primitives/<name>/    engine code adapted from the drops, one adapter each
  registry.ts           name -> loader + props schema + capture notes
  assets/               textures/sprites the primitives need (small, committed)
```

Every primitive gets a thin adapter conforming to one protocol:

```ts
interface ScenePrimitive {
  mount(host: HTMLElement, props: Record<string, unknown>): Promise<SceneHandle>;
}
interface SceneHandle {
  start(): void;                                   // begin self-driving
  action?(name: string, args?: unknown): Promise<void>;  // scripted beats
  destroy(): void;
}
```

The set-3 drops already have this shape (mount/start/stop/destroy); sets 1-2
need thin wrappers. Harness rules, all learned from the drops themselves:

- Force no-preference reduced motion; the capture browser must never take the
  static fallback.
- Stub IntersectionObserver visibility gates (the swirl and others gate on
  being near viewport middle).
- Warm fonts before signalling ready; several drops bake glyph metrics into
  textures at mount and stay wrong if the webfont lands late.
- Where a pointer matters, drive the drop's own autonomous-cursor pattern (the
  LEGO wander, the badge-trail ghost); Playwright's real mouse only for
  scripted precise beats.
- Ready = fonts loaded + first painted frame (most engines expose this as the
  opacity-0-until-painted trick; the adapter hooks it).

## The config contract

Shots get a `type` (default `capture`, so existing configs are untouched):

```json
{
  "id": "opener",
  "type": "generated",
  "scene": "title",
  "props": { "style": "swirl", "word": "FINANCECREW", "palette": "brand" },
  "duration": 6,
  "timeline": [ { "at": 4.2, "action": "settle" } ],
  "narration": "Week five. ..."
}
```

`capture` records it via the harness instead of the app URL; `assemble` treats
the clip identically (styled frame optional per shot, since many generated
scenes are already full-bleed compositions and double-framing looks wrong; a
`frame: false` flag per shot covers that).

## Scene kinds, not 33 scene names

The config exposes a handful of kinds; primitives are styles within them. This
is the main consolidation decision: seventeen of the drops are word/title
effects, and seventeen scene kinds would be unusable.

- `title` with `style`: swirl, typer, emboss, chroma, ransom, kinetic, fade,
  chrome, glow (blur-glow), ascii, tiles (tile-field), scan (pixel-scan),
  dotcut, design-tiles, text-reveal, blur-reveal, frosted, stickers, badges.
  Common props: word/lines, palette, duration; style-specific props pass
  through untouched.
- `background`: dia-bars, dia-peaked, dia-dodge, galaxy (images prop).
  Usable standalone or as card backdrops.
- `showcase`: pedestal (gold-scar with any glTF), sphere (image cloud),
  galaxy-focus, pixel-cycle (image montage). Props: model/images.
- `story`: liquid-ui compositions (cards that fuse and morph between layouts),
  squircle component vignettes. For product-narrative beats in ads.
- `overlay` (v3): figma-frame callout, flying cursors, badge trail composited
  over footage.

Treatments are not scenes; they are a post pass over an already-captured clip
(`"treatment": {"kind": "symbols", ...}` on any shot). The harness plays the
input clip into the treatment engine's canvas and re-records. Symbols (set 1)
is the proving case since it accepts video natively.

## Video kinds are recipes, not new machinery

report, launch, ad, demo are starter shot-lists the skill knows, all compiling
to the same config format:

- report: today's flow, plus a generated title opener and closer.
- launch: title (swirl or chroma) -> feature beats (footage with callouts) ->
  story scene -> styled CTA card -> atmospheric closer (fade or chrome).
- ad: 15-30s; treated footage, bold titles, one CTA with the color-depth
  materials.
- demo: capture-heavy, figma-frame callouts, typer lower thirds.

`npx newsreel init --kind launch` scaffolds the shape; the agent fills shots.

## The agent-facing layer

A lookbook (`visuals/LOOKBOOK.md`) with one line and vibe tags per primitive,
so choosing is a lookup, not archaeology: playful (ransom, stickers, badges,
dotcut), premium (chrome, emboss, fade, glow), technical (ascii, scan, tiles,
kinetic), editorial (text-reveal, blur-reveal, frosted), craft (embroidery).
The newsreel skill gains a short "picking visuals" section pointing at it, and
the rule that a video uses at most two title styles so it reads as designed
rather than sampled.

## Phasing

v1, the foundation (target: next weekly video opens with a generated title):

- Harness + registry + stubs + esbuild bundling; `type: "generated"` through
  capture and assemble.
- Six primitives wired to cover the axes: swirl (brand opener), chroma (dark
  neon), fade (atmospheric closer), dia backgrounds, dotcut (interstitial),
  typer (lower-third energy on cards).

v2, breadth: symbols treatment over real footage; emboss, chrome, glow,
kinetic, ascii, tiles title styles; galaxy/sphere fed by report screenshots;
pedestal with a CC0 model; write the two missing modules (design-tiles
measure.ts, word-stickers gl-sticker stub).

v3, composition: overlay system over live captures, liquid-ui story scenes,
recipe presets in init, LEGO-style personal ident once photos exist.

## Asset and provenance ledger

- Provided: embroidery weave (download URL in the drop).
- Recipe included, needs Karo: LEGO portrait set (photo + three AI restyles).
- Missing but replaceable by generation: ghost-reveal masks, emboss
  plaster/grunge, ransom cutouts (or ask for the pack; Resource Boy is
  royalty-free).
- Missing, substitute: scar.glb + chest.mp3 (any CC0 glTF + sound).
- Never commit: Minecraft fire textures/sounds (Mojang IP). Fire-field stays
  private-only or gets re-drawn art.
- Open with Karo before any public release: where the drops came from and what
  attribution they carry (BetterShot precedent: credit + licence line in the
  README).

New dependencies: three (+ examples/jsm), esbuild. gsap only serves
pixel-field; I would reimplement its simple timeline and skip the dep.

## What I need from Karo

1. A read on this design, mainly the scene-kind consolidation and the v1 six.
2. The provenance answer for the drops.
3. The LEGO photo set, whenever, for v3.
4. Go-ahead to build v1.
