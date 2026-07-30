// The vortex field: a dense grid of monospace cells. Every frame each cell's
// position is rotated around the center by a twist that grows toward the middle
// (fast core, still rim — that gradient is the whirlpool), then the source text
// is sampled at the rotated coordinate. Where a cell lands inside the target
// word's stencil, its character is pulled toward the word so the name condenses
// out of the soup.
//
// Renamed and re-derived from a study of Midjourney Medical's ASCII intro; the
// twist falloff here is our own smoothstep core rather than a raw 1/dist.

import {
  WEIGHT_REGULAR,
  WEIGHT_BOLD,
  type GlyphAtlas,
} from "./glyph-atlas";
import { sampleTrail, type TrailField } from "./trail-field";

// ---- tuning ----
/** Base angular speed; the falloff below scales it up toward the core. */
export const TWIST_RATE = 0.1;
/** Floor on the radius so the very center doesn't spin to infinity. */
export const CORE_FLOOR = 0.1;
/** Seconds for the word to fully condense out of the field. Long enough that the
 *  crossfade entrance clearly reads, short enough not to drag on each keystroke. */
export const FORMATION_SEC = 1.8;
/** How wide the letter-body halo is when carving the stencil. */
export const STENCIL_HALO = 4;
/** Sampling stays in [-1,1] so columns map cleanly onto the grid width. */
export const FIELD_EXTENT = 1.0;

const SPACE = " ";

const easeOutQuad = (t: number) => t * (2 - t);
const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
// The twist a cell receives, given its distance from the center: strong at the
// core, fading toward the rim. Expressed as TWIST_RATE over the (floored)
// radius — the floor stops the center spinning to infinity.
const twistAt = (spin: number, dist: number) =>
  (spin * TWIST_RATE) / Math.max(CORE_FLOOR, dist);

/**
 * The target word laid out as 5+ rows of ASCII, plus a stencil marking which
 * cells belong to the letter bodies (so the morph knows what to carve).
 */
export interface Target {
  rows: string[];
  stencil: boolean[][];
}

/** Build the body stencil around a word's glyph cells (incl. interior counters). */
export function carveStencil(rows: string[]): boolean[][] {
  const w = Math.max(0, ...rows.map((l) => l.length));
  return rows.map((line) => {
    const isInk = (x: number) => x >= 0 && x < w && line[x] !== undefined && line[x] !== " ";
    return Array.from({ length: w }, (_u, x) => {
      if (isInk(x) || isInk(x - 1) || isInk(x + 1)) return true;
      // a cell sitting inside a letter counter (ink on both sides) still belongs
      let left = false;
      let right = false;
      for (let d = 1; d <= STENCIL_HALO; d++) {
        if (isInk(x - d)) left = true;
        if (isInk(x + d)) right = true;
      }
      return left && right;
    });
  });
}

export function makeTarget(rows: string[]): Target {
  const w = Math.max(0, ...rows.map((l) => l.length));
  const padded = rows.map((l) => l.padEnd(w, " "));
  return { rows: padded, stencil: carveStencil(padded) };
}

/** A reusable cell buffer the composer fills each frame. */
export interface FieldBuffers {
  bounds: Float32Array;
  glyphUvs: Float32Array;
  colors: Float32Array;
}

export function makeBuffers(maxCells: number): FieldBuffers {
  return {
    bounds: new Float32Array(maxCells * 4),
    glyphUvs: new Float32Array(maxCells * 4),
    colors: new Float32Array(maxCells * 4),
  };
}

export interface FieldGrid {
  cols: number;
  rows: number;
  inkSize: number;
  vOffset: number;
  targetX: number;
  targetY: number;
}

/** Per-cell ink color. Flat color, or a gradient sampled across the field. */
// ---- ink: a flowing multi-stop gradient sampled per cell ----
/**
 * How the stops are mapped onto the field:
 *  - "rows":  hue follows the SOURCE row each character was pulled from, so a
 *             letter carries its color as the vortex flings it around — the
 *             rainbow spirals with the swirl instead of sitting still.
 *  - "axis":  the legacy flat screen-space gradient (a fixed sheet the letters
 *             slide across). Kept for the simple look.
 */
export type InkMode = "rows" | "axis";

export interface InkPaint {
  /** Ordered color stops in 0..1 RGB. One stop = flat fill. */
  stops: [number, number, number][];
  /** Gradient axis direction in radians (0 = left→right). Used by "axis" mode. */
  angle: number;
  /** Phase the bands have drifted (animated by the caller). */
  flow: number;
  /** When false, every cell is stops[0]. */
  gradient: boolean;
  /** Which mapping to use (defaults to "rows" when gradient is on). */
  mode: InkMode;
}

// ---- depth layers stacked on top of the base hue ----
/** Max ± hue offset a single cell can drift, in stop-space (so neighbours
 *  shimmer between adjacent colors instead of matching exactly). */
const HUE_DRIFT = 0.12;
/** How fast each cell's drift cycles. */
const HUE_DRIFT_SPEED = 0.6;
/** Brightness floor for the slowest (rim) cells; the fast core reaches 1. */
const SPEED_DIM = 0.55;

// sample the stop ramp as a closed loop at position t (any real; wrapped to 0..1)
function rampAt(stops: [number, number, number][], t: number): [number, number, number] {
  t = t - Math.floor(t); // 0..1 wrapped
  const seg = t * stops.length;
  const i = Math.floor(seg) % stops.length;
  const j = (i + 1) % stops.length;
  const f = seg - Math.floor(seg);
  const a = stops[i];
  const b = stops[j];
  return [mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f)];
}

/** A click shockwave: an expanding ring that displaces the cells it crosses. */
export interface Shock {
  /** Origin in normalized field units (-1..1). */
  x: number;
  y: number;
  /** Seconds since the click (the caller ages this). */
  age: number;
}

// cursor-trail tuning. The trail is a persistent heat+flow field (see
// trail-field.ts); here we turn a cell's local heat into two layers:
//   1. a directional WAKE — push the cell along the remembered flow direction
//   2. a local SWIRL-UP — add to the cell's twist so hot regions spin faster
// Both scale per cell by heat, so a faint lingering trail keeps nudging and
// churning the soup long after the cursor has gone.
const WAKE_PUSH = 0.34; // max wake displacement at full heat (half-field units)
const SWIRL_GAIN = 4.5; // extra spin multiplier per unit heat (strong churn)
const TRAIL_NOISE = 0.9; // per-cell variation so the wake isn't a uniform slab
const FLARE_GAIN = 2.4; // how hard heat drives the color flare (clamped to 1)
// shockwave tuning
const SHOCK_SPEED = 1.4; // ring radius growth per second (field units)
const SHOCK_WIDTH = 0.13; // ring thickness
const SHOCK_PUSH = 0.12; // radial shove at the ring crest (gentle)
const SHOCK_FADE = 1.9; // exp decay per second

// deterministic per-cell hash → 0..1 (so a cell's noise is stable frame to frame)
const cellHash = (col: number, row: number) => {
  const n = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

// Where this cell sits on the color ramp BEFORE the depth layers. "rows" keys
// off the source row (color travels with the letter); "axis" is the old
// screen-space projection.
interface PaintSample {
  /** Final screen position (-1..1), for the legacy axis mode. */
  fx: number;
  fy: number;
  /** Source row this character came from, normalized 0..1 (for "rows"). */
  srcRow: number;
  /** Stable per-cell hash 0..1, for the per-letter hue drift. */
  jitter: number;
  /** Swirl speed at this cell 0..1 (1 = fast core), for speed brightness. */
  speed: number;
  /** Animation phase in seconds, for the drift cycle. */
  time: number;
}

function paintAt(paint: InkPaint, s: PaintSample): [number, number, number] {
  const stops = paint.stops;
  if (!paint.gradient || stops.length < 2) return stops[0];

  // ── base hue position on the ramp ──
  let t: number;
  if (paint.mode === "axis") {
    const ca = Math.cos(paint.angle);
    const sa = Math.sin(paint.angle);
    t = (s.fx * ca + s.fy * sa) * 0.5 + 0.5 + paint.flow;
  } else {
    // rows: each source line maps to a point on the loop, drifting by flow
    t = s.srcRow + paint.flow;
  }

  // ── layer 1: per-letter hue drift — a slow ± wobble unique to each cell, so
  //    neighbours shimmer between adjacent colors instead of matching exactly ──
  t += Math.sin(s.time * HUE_DRIFT_SPEED + s.jitter * Math.PI * 2) * HUE_DRIFT * s.jitter;

  const rgb = rampAt(stops, t);

  // ── layer 2: speed brightness — the fast-spinning core renders full, the slow
  //    rim dims toward SPEED_DIM, so the swirl's energy reads in the color ──
  const bright = mix(SPEED_DIM, 1, s.speed);
  return [rgb[0] * bright, rgb[1] * bright, rgb[2] * bright];
}

function pushCell(
  buf: FieldBuffers,
  atlas: GlyphAtlas,
  glyphSlot: number,
  x: number,
  baseline: number,
  rgb: [number, number, number],
  alpha: number,
  state: { count: number },
) {
  if (alpha <= 0) return;
  const o = state.count * 4;
  const uv = atlas.uvs[glyphSlot];
  buf.bounds[o] = x - atlas.pad;
  buf.bounds[o + 1] = baseline - atlas.baseline;
  buf.bounds[o + 2] = x - atlas.pad + atlas.cellW;
  buf.bounds[o + 3] = baseline - atlas.baseline + atlas.cellH;
  buf.glyphUvs[o] = uv[0];
  buf.glyphUvs[o + 1] = uv[1];
  buf.glyphUvs[o + 2] = uv[2];
  buf.glyphUvs[o + 3] = uv[3];
  buf.colors[o] = rgb[0];
  buf.colors[o + 1] = rgb[1];
  buf.colors[o + 2] = rgb[2];
  buf.colors[o + 3] = alpha;
  state.count++;
}

export interface ComposeArgs {
  grid: FieldGrid;
  atlas: GlyphAtlas;
  buffers: FieldBuffers;
  source: string[];
  target: Target;
  /** ms since the formation (re)started. */
  elapsed: number;
  paint: InkPaint;
  /** Color of the resolved logo word in 0..1 RGB (independent of the swirl ink). */
  logo: [number, number, number];
  /** Glyph index lookup (resolves a character to its atlas slot, per weight). */
  slotOf: (ch: string, weight: number) => number;
  /** Persistent cursor trail: drives the directional wake + local swirl-up. */
  trail?: TrailField;
  /** Overall trail intensity multiplier (1 = default). */
  trailStrength?: number;
  /** Color hot trail cells flare toward (0..1 RGB); omit for no color flare. */
  trailFlare?: [number, number, number];
  /** Active click shockwaves (optional). */
  shocks?: Shock[];
  /** Sustained ambient wave distortion, 0..1 (a permanent rippling). */
  turbulence?: number;
  /** Which ambient wave shape to use (defaults to "wavefront"). */
  wavePattern?: WavePattern;
}

/**
 * Fill the buffers for this frame and return how many cells were written. The
 * caller uploads `buffers` and issues one instanced draw of `count` quads.
 *
 * The swirl sampling is unchanged from the faithful rebuild; the cursor bend and
 * click shockwaves are applied AFTER, as a positional displacement on each
 * cell's screen position — so the letters physically shove around the pointer
 * and ripple out from a click, rather than the whole field shifting.
 */
// ── ambient wave: a sustained displacement pattern over the whole field. The
// strength is `turbulence` (0..1); the shape is `wavePattern`. ──
export type WavePattern = "wavefront" | "ripples" | "flow" | "cloth";

const WAVE_AMP = 0.16; // max displacement at turbulence = 1
const WAVE_FREQ = 2.4; // spatial frequency
const WAVE_SPEED = 0.9; // travel speed
const WAVE_DIR = Math.PI * 0.15; // wavefront travel direction (radians)

// cheap value noise (hash-lerp) for the "flow" pattern — smooth, scrolling,
// non-repeating. Not Perlin, but plenty for a soft drift.
const vnoise = (x: number, y: number): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const h = (a: number, b: number) => {
    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1; // -1..1
};

export function composeField(args: ComposeArgs): number {
  const { grid, atlas, buffers, source, target, elapsed, paint, logo, slotOf, trail, shocks, turbulence } = args;
  const wavePattern = args.wavePattern ?? "wavefront";
  const trailStrength = args.trailStrength ?? 1;
  const flare = args.trailFlare;
  const { sin, cos, sqrt, floor, round, exp, max, PI } = Math;
  const spin = elapsed * 0.001;
  const turbOn = !!turbulence && turbulence > 0.001;
  const tWave = elapsed * 0.001 * WAVE_SPEED;
  const waveDirX = cos(WAVE_DIR);
  const waveDirY = sin(WAVE_DIR);
  const formation = easeOutQuad(clamp01((elapsed * 0.001) / FORMATION_SEC));
  // Highlight tracks the logo color instead of being hardcoded white: nudge it
  // toward whichever end is "further" so a dark logo gets a soft sheen and a
  // light logo a faint lift — never a white wash that breaks on light bgs.
  const lum = 0.299 * logo[0] + 0.587 * logo[1] + 0.114 * logo[2];
  const hi: [number, number, number] = lum < 0.5
    ? [mix(logo[0], 1, 0.5), mix(logo[1], 1, 0.5), mix(logo[2], 1, 0.5)] // lighten dark logo
    : [mix(logo[0], 0, 0.35), mix(logo[1], 0, 0.35), mix(logo[2], 0, 0.35)]; // darken light logo
  const lines = source;
  const tw = target.rows;
  const tWidth = tw[0]?.length ?? 0;
  const state = { count: 0 };

  const trailOn = !!trail;
  const ts = { heat: 0, fx: 0, fy: 0 }; // reused per-cell trail sample
  const shockOn = !!shocks && shocks.length > 0;
  // px per normalized HALF-unit, per axis (the canvas is not square, so x and y
  // get their own scale or the push would skew on one axis).
  const halfW = (grid.cols * atlas.advance) / 2;
  const halfH = (grid.rows * grid.inkSize) / 2;

  for (let row = 0; row < grid.rows; row++) {
    const y = (1 - (row * 2) / grid.rows) * FIELD_EXTENT;
    const baseline = grid.vOffset + row * grid.inkSize;
    // screen-normalized y (-1..1, y-down) for displacement math
    const sny = (row + 0.5) / grid.rows * 2 - 1;
    for (let col = 0; col < grid.cols; col++) {
      const x = ((col * 2) / grid.cols - 1) * FIELD_EXTENT;
      const snx = (col + 0.5) / grid.cols * 2 - 1; // screen-normalized x (y-down)
      const dist = sqrt(x * x + y * y);

      // Sample the persistent cursor trail once (heat + remembered flow). The
      // heat locally spins the whirlpool up so a touched region keeps churning.
      let heat = 0;
      if (trailOn) {
        sampleTrail(trail!, snx, sny, ts);
        heat = ts.heat;
      }
      const twist = twistAt(spin, dist) * (1 + SWIRL_GAIN * heat * trailStrength);
      const s = sin(twist);
      const cse = cos(twist);
      const rx = x * cse + y * s;
      const ry = x * s - y * cse;

      // Sample the source: rows cycle through the prompt lines; the column
      // indexes DIRECTLY into the line so where a line runs out the cell is
      // blank — that ragged edge is what keeps the field open and airy.
      const sampleCol = floor(((rx + 1) / 2) * grid.cols);
      const sampleRow = floor(((ry + 1) / 2) * grid.rows);
      const srcLine = lines[((sampleRow % lines.length) + lines.length) % lines.length] ?? "";
      let ch = sampleCol >= 0 && sampleCol < srcLine.length ? srcLine[sampleCol] ?? SPACE : SPACE;

      // The name reads by NEGATIVE space: inside the logo footprint (the
      // stencil) the soup is cleared so letters never show through the word, and
      // the figlet's own glyph cells morph from the soup char toward the target
      // char as the formation ramps in (the entrance).
      let resolved = SPACE;
      const tx = col - grid.targetX;
      const ty = row - grid.targetY;
      const inTarget = tx >= 0 && tx < tWidth && ty >= 0 && ty < tw.length;
      // The whole logo footprint (every stencil cell, not just glyph cells) is
      // held rigid: no displacement reaches it, so the name never warps while the
      // soup around it bends, shocks and churns.
      const inLogo = inTarget && !!target.stencil[ty]?.[tx];
      if (inLogo) {
        const wordChar = tw[ty][tx];
        if (wordChar && wordChar !== " ") {
          ch = String.fromCharCode(
            round(mix(ch.charCodeAt(0), wordChar.charCodeAt(0), formation)),
          );
          resolved = ch;
        } else if (formation > 0.5) {
          ch = SPACE; // counter / halo cell clears once the word has formed
        }
      }
      if (ch === SPACE && resolved === SPACE) continue;

      // ── positional displacement: cursor wake + click shockwaves ──
      // Worked entirely in SCREEN-normalized space (-1..1, y-down) so the trail /
      // click coordinates line up exactly with where the letters are.
      let dx = 0;
      let dy = 0;
      // Directional WAKE: push the cell along the trail's remembered flow,
      // scaled by heat, with per-cell noise so it isn't a uniform slab. Because
      // the trail lingers, this keeps nudging long after the cursor has left.
      if (trailOn && !inLogo && heat > 0.001) {
        const noise = 1 + (cellHash(col, row) - 0.5) * TRAIL_NOISE;
        const push = WAKE_PUSH * heat * trailStrength * noise;
        dx += ts.fx * push;
        dy += ts.fy * push;
        // a swirl curl: also nudge perpendicular to the flow so the wake twists
        // into the vortex instead of just streaking straight — more alive
        dx += -ts.fy * push * 0.5;
        dy += ts.fx * push * 0.5;
      }
      if (shockOn && !inLogo) {
        for (let k = 0; k < shocks!.length; k++) {
          const sh = shocks![k];
          const ox = snx - sh.x;
          const oy = sny - sh.y;
          const r = sqrt(ox * ox + oy * oy);
          const ringR = sh.age * SHOCK_SPEED;
          const d = (r - ringR) / SHOCK_WIDTH;
          const crest = exp(-d * d) * exp(-sh.age * SHOCK_FADE);
          if (crest > 0.002) {
            const inv = 1 / max(0.0001, r);
            const push = SHOCK_PUSH * crest;
            dx += ox * inv * push;
            dy += oy * inv * push;
          }
        }
      }
      if (turbOn && !inLogo) {
        const a = WAVE_AMP * turbulence!;
        if (wavePattern === "wavefront") {
          // a directional crest sweeps across the field; cells lift along the
          // travel direction as the front passes (water / flag)
          const phase = (snx * waveDirX + sny * waveDirY) * WAVE_FREQ * PI - tWave * PI;
          const w = sin(phase);
          dx += a * w * waveDirX;
          dy += a * w * waveDirY;
        } else if (wavePattern === "ripples") {
          // endless concentric rings radiating from the center (pond breathing)
          const r = sqrt(snx * snx + sny * sny);
          const w = sin(r * WAVE_FREQ * PI * 1.6 - tWave * PI);
          const inv = 1 / max(0.08, r);
          dx += a * w * snx * inv;
          dy += a * w * sny * inv;
        } else if (wavePattern === "flow") {
          // drift each cell along a scrolling noise field (ink / smoke)
          const nx = vnoise(snx * 1.6 + tWave * 0.4, sny * 1.6);
          const ny = vnoise(sny * 1.6 - tWave * 0.4 + 7.3, snx * 1.6 + 3.1);
          dx += a * 1.4 * nx;
          dy += a * 1.4 * ny;
        } else {
          // cloth: columns sway side-to-side, phase increasing down the rows, so
          // the field ripples like a banner in a breeze
          dx += a * 1.3 * sin(sny * WAVE_FREQ * PI * 0.9 + tWave * PI * 1.2);
          dy += a * 0.35 * sin(snx * WAVE_FREQ * PI + tWave * PI);
        }
      }

      const px = col * atlas.advance + dx * halfW;
      const by = baseline + dy * halfH;
      const fx = (col * 2) / grid.cols - 1;
      const fy = 1 - (row * 2) / grid.rows;
      // color by the SOURCE row (so it travels with the letter), shimmered by a
      // per-cell drift and brightened by how fast this cell is spinning.
      const srcRow = floor(((ry + 1) / 2) * grid.rows);
      const rgb = paintAt(paint, {
        fx,
        fy,
        srcRow: (((srcRow % grid.rows) + grid.rows) % grid.rows) / grid.rows,
        jitter: cellHash(col, row),
        speed: clamp01(1 - dist),
        time: spin,
      });
      // COLOR FLARE: hot trail cells glow toward the flare color, so dragging
      // lights up a visible, lingering path (the trail reads as light + heat).
      let cellRgb = rgb;
      if (flare && heat > 0.001 && !inLogo) {
        const t = clamp01(heat * FLARE_GAIN * trailStrength);
        cellRgb = [mix(rgb[0], flare[0], t), mix(rgb[1], flare[1], t), mix(rgb[2], flare[2], t)];
      }
      if (ch !== SPACE) {
        pushCell(buffers, atlas, slotOf(ch, WEIGHT_REGULAR), px, by, cellRgb, 1, state);
      }
      if (resolved !== SPACE) {
        // the forming letter fades in over the morphing char, in the LOGO color
        // plus a sheen derived from it (not pure white, so light themes read)
        pushCell(buffers, atlas, slotOf(resolved, WEIGHT_BOLD), px, by, logo, formation, state);
        pushCell(buffers, atlas, slotOf(resolved, WEIGHT_BOLD), px, by, hi, formation * 0.5, state);
      }
    }
  }
  return state.count;
}

