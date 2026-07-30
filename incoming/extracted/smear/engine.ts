// Fade motion — WebGL1.
//
// A word that trails downward into light. Nothing is blurred and no gradient is
// painted: the trail is pure ACCUMULATION. Coverage after k overlapping copies of
// the word at alpha a is
//
//     1 - (1-a)^k
//
// which is why the falloff is fast at first and then a long tail. That law is the
// effect, and it is unchanged from the Canvas 2D original.
//
// What changed is WHERE it is evaluated. The original stamped the word ~210 times
// per frame with drawImage, and the chromatic pass added ~190 more the instant the
// cursor moved — so moving the cursor, the one moment the card had to be
// responsive, was also the moment it got twice as expensive. Long frames then fed
// straight into the dt-scaled followers, so the word lurched instead of tracking.
// Now the accumulation runs per-pixel in a fragment shader: the fragment marches
// UP the trail and asks how many copies would have covered it. One draw call, cost
// independent of the copy count.
//
// On a dark preset it is LIGHT on a dark ground — the trail is the word's own glow
// smeared, so the stack ADDS. On a light preset the same accumulation runs
// SUBTRACTIVELY, as ink density on paper, because adding light to white blows out
// and leaves nothing to see. Either way it reads as one long exposure rather than
// a stack of shadows.
//
// The pointer FOLLOWS. The word turns to face the cursor and the trail reels in as
// you approach; it does not get shoved around, and a small move produces a small
// turn rather than a smear in the opposite direction.

import { FULL_VERT, TRAIL_FRAG } from "./shaders";
import { makeWordMask, measureWord, ANCHOR_Y } from "./text-mask";

export interface FadeParams {
  /** how many copies build the trail */
  echoes: number;
  /** distance between copies, px at a 620px-tall card */
  step: number;
  /** per-copy alpha; the trail builds from overlap, so this stays low */
  alpha: number;
  /** trail direction in radians. 90deg = straight down. */
  angle: number;
  /** how far the hue travels from the word to the end of the trail, degrees */
  hueShift: number;
  /** how much the tail wavers, px at a 620px-tall card. 0 = a rigid trail. */
  turbulence: number;
  /** how much each copy widens as it falls. 0 = a constant-width ribbon. */
  spread: number;
  /** brightness of the trail's true leading edge */
  edge: number;
  /** per-channel offset into the trail ramp — the dispersion at the tail */
  fringe: number;
}

export const DEFAULTS: FadeParams = {
  // Many copies at a near-1px step. Spacing them further apart makes each copy
  // land clear of the last, which reads as stacked ghosts rather than one
  // continuous ramp — the accumulation only works when they overlap heavily.
  echoes: 210,
  step: 1.0,
  alpha: 0.019,
  angle: Math.PI / 2, // straight down
  hueShift: 26,
  // Enough waver to make the tail feel like it is moving through air, well short
  // of the point where the trail stops reading as one continuous stroke.
  //
  // 16 puts about 50px of swing on the tail of a 1344px card, against a trail a
  // few hundred px wide — so the edge of the stroke visibly breathes while the
  // body of it stays coherent. The phase advances per copy (see the shader), so
  // this is the amplitude of a SNAKE along the trail, not a sideways slide of the
  // whole thing; at 9 the undulation was there but too fine to read at all.
  turbulence: 16,
  // A gentle opening. Past ~0.5 the copies overlap so loosely that the ramp
  // starts to look soft rather than dense.
  spread: 0.22,
  edge: 0.5,
  // Small on purpose: this is a fringe at the thin end of the ramp, not a
  // 3D-glasses split. Above ~0.1 it stops reading as dispersion and starts
  // reading as a mistake.
  fringe: 0.045,
};

/** Lowercase, in the site face. The source used shouty uppercase; lowercase sits
 *  far better with the rest of the page and the descenders give the trail
 *  something more interesting to start from. */
const WORD = "motion";

/**
 * A colour preset.
 *
 * `mode` is the load-bearing field, not a style detail. On a dark ground the
 * copies ADD and the trail is light the word emits. On a light ground adding
 * light to near-white paper blows straight out and the trail disappears entirely
 * — so a light preset has to treat the trail as PIGMENT and subtract instead.
 * Same accumulation maths, inverted output. Without that flag a "light mode" is
 * just a washed-out dark mode with an invisible trail.
 */
export interface Palette {
  name: string;
  mode: "add" | "subtract";
  /** page behind everything */
  bg: string;
  /** trail ramp: hue/sat/light at the word, and how each travels to the tail */
  trail: {
    hue: number;
    sat: number;
    light: number;
    dHue: number;
    dSat: number;
    dLight: number;
  };
  /** the three word layers: wide bleed, tight halo, hot core */
  bleed: string;
  halo: string;
  core: string;
  /** the atmosphere pool behind the word */
  pool: [string, string];
  /** vignette edge colour (centre is untouched — it multiplies) */
  vignette: string;
  /**
   * Scales the per-copy alpha for this preset.
   *
   * Subtractive presets need this well below 1. Additive accumulation saturates
   * toward white gracefully, but multiplicative accumulation COMPOUNDS: at the
   * shared 0.019 the paper is driven to 2% by the last copy, so the dense end
   * becomes a flat black slab and the whole accumulation curve — the actual
   * effect — is clipped away. About a third of that keeps the ramp intact.
   */
  alphaScale: number;
}

export const PALETTES: Palette[] = [
  {
    // Dark first — this is the card's resting identity.
    name: "Afterglow",
    mode: "add",
    bg: "#0b0e0c",
    trail: { hue: 132, sat: 46, light: 52, dHue: 26, dSat: -14, dLight: -26 },
    bleed: "hsl(150 45% 40%)",
    halo: "hsl(146 60% 62%)",
    core: "hsl(140 34% 93%)",
    pool: ["rgba(94,214,138,0.16)", "rgba(58,150,110,0.06)"],
    vignette: "#6b7a70",
    alphaScale: 1,
  },
  {
    name: "Graphite",
    mode: "subtract",
    bg: "#ffffff",
    // Denser and longer-travelling than the dark presets: on paper the ink has to
    // do all the work the glow does on black, so it starts darker and lifts further.
    trail: { hue: 250, sat: 14, light: 26, dHue: 8, dSat: -8, dLight: 54 },
    bleed: "hsl(250 16% 58%)",
    halo: "hsl(252 24% 34%)",
    // Not black — a deep indigo reads as chosen where pure black reads default.
    core: "hsl(254 46% 13%)",
    pool: ["rgba(120,120,170,0.07)", "rgba(120,120,170,0.02)"],
    // Barely tinted. A grey vignette multiplies white paper into a dirty wash and
    // the trail's tail vanishes into it — on light presets this has to stay within
    // a couple of percent of the page.
    vignette: "#f6f5fa",
    alphaScale: 0.42,
  },
  {
    name: "Amber",
    mode: "add",
    bg: "#0d0906",
    trail: { hue: 32, sat: 78, light: 52, dHue: -14, dSat: -18, dLight: -28 },
    bleed: "hsl(28 70% 42%)",
    halo: "hsl(36 88% 62%)",
    core: "hsl(44 60% 94%)",
    pool: ["rgba(255,168,66,0.16)", "rgba(168,96,28,0.06)"],
    vignette: "#7a6a56",
    alphaScale: 1,
  },
  {
    name: "Cyanotype",
    mode: "subtract",
    bg: "#fdfeff",
    trail: { hue: 205, sat: 58, light: 30, dHue: -12, dSat: -18, dLight: 52 },
    bleed: "hsl(205 46% 56%)",
    halo: "hsl(206 64% 32%)",
    core: "hsl(210 82% 15%)",
    pool: ["rgba(64,132,196,0.08)", "rgba(64,132,196,0.025)"],
    vignette: "#f2f7fb",
    alphaScale: 0.42,
  },
  {
    name: "Ultramarine",
    mode: "add",
    bg: "#07090f",
    trail: { hue: 224, sat: 64, light: 54, dHue: 26, dSat: -16, dLight: -30 },
    bleed: "hsl(228 58% 44%)",
    halo: "hsl(220 78% 66%)",
    core: "hsl(210 46% 94%)",
    pool: ["rgba(96,150,255,0.16)", "rgba(48,80,180,0.06)"],
    vignette: "#606a86",
    alphaScale: 1,
  },
  {
    name: "Rust",
    mode: "subtract",
    bg: "#fffdfa",
    trail: { hue: 16, sat: 52, light: 32, dHue: 16, dSat: -20, dLight: 52 },
    bleed: "hsl(20 42% 58%)",
    halo: "hsl(16 56% 34%)",
    core: "hsl(10 66% 17%)",
    pool: ["rgba(198,110,70,0.08)", "rgba(198,110,70,0.025)"],
    vignette: "#fbf3ec",
    alphaScale: 0.42,
  },
  {
    name: "Split",
    mode: "add",
    bg: "#0a070c",
    // hue travels a long way, so the head and tail land on opposite sides of the
    // wheel and the trail reads as two colours bleeding through each other
    trail: { hue: 318, sat: 62, light: 54, dHue: -132, dSat: -8, dLight: -26 },
    bleed: "hsl(320 56% 44%)",
    halo: "hsl(318 76% 66%)",
    core: "hsl(300 34% 94%)",
    pool: ["rgba(232,96,208,0.15)", "rgba(72,120,190,0.07)"],
    vignette: "#786080",
    alphaScale: 1,
  },
];

/** How long a palette crossfade takes.
 *
 *  0.34s against the 2s hero cycle: the change is over quickly and the card then
 *  sits on a clean preset for ~83% of each period. Earlier passes at 1.1s and
 *  0.75s were mid-wash for half the time or more, which is what made the cycling
 *  feel sluggish and indecisive — you never saw a colour world, you only ever saw
 *  it turning into the next one. Fast and complete beats slow and permanent. */
const FADE_SECONDS = 0.34;

/** Focal length for the perspective divide, in units of canvas height. Lower is a
 *  wider lens and a stronger taper. Around 1.6 reads like a real lens: enough
 *  convergence to feel dimensional, not so much that it fisheyes. */
const FOCAL = 1.6;

/** Caps on the eased lean, set by setPointer. */
const LEAN_X_MAX = 0.21;
const LEAN_Y_MAX = 0.12;

/** How far the atmosphere pool tracks the pointer, as a fraction of the canvas.
 *  Kept close to the word's own travel: much further and the light source and the
 *  lit object visibly parallax apart. */
const HALO_TRACK_X = 0.07;
const HALO_TRACK_Y = 0.08;

/** The bitmap face. Its hard pixel edges are the reason it suits this: every copy
 *  in the trail keeps a crisp stair-stepped silhouette, so the accumulation stays
 *  legible instead of blurring into a smudge. */
const PIXEL_FONT = "var(--font-mondwest)";

/** Canvas 2D `ctx.font` cannot parse a CSS var() — resolve it to a real family
 *  name once. */
function resolveFamily(cssFamily: string): string {
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden";
  probe.style.fontFamily = cssFamily;
  document.body.appendChild(probe);
  const fam = getComputedStyle(probe).fontFamily || "sans-serif";
  probe.remove();
  return fam;
}

/** A `document.fonts.load` spec for the face this card draws in, so callers can
 *  warm it before the first mask build. */
export function pixelFontSpec(): string {
  return `400 100px ${resolveFamily(PIXEL_FONT)}`;
}

// ── colour helpers ──────────────────────────────────────────────────────────
type RGB = [number, number, number];

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/** Parse the hex / hsl() / rgba() forms the palettes are authored in. Returns
 *  linear-ish 0..1 rgb plus the alpha the source carried (1 when it had none). */
function parseColor(c: string): { rgb: RGB; a: number } {
  const s = c.trim();
  if (s.startsWith("#")) {
    let h = s.slice(1);
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    return {
      rgb: [
        parseInt(h.slice(0, 2), 16) / 255,
        parseInt(h.slice(2, 4), 16) / 255,
        parseInt(h.slice(4, 6), 16) / 255,
      ],
      a: 1,
    };
  }
  const hsl = s.match(/^hsl\(\s*([-\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/);
  if (hsl) {
    return { rgb: hslToRgb(+hsl[1], +hsl[2], +hsl[3]), a: 1 };
  }
  const rgba = s.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/,
  );
  if (rgba) {
    return {
      rgb: [+rgba[1] / 255, +rgba[2] / 255, +rgba[3] / 255],
      a: rgba[4] !== undefined ? +rgba[4] : 1,
    };
  }
  return { rgb: [1, 1, 1], a: 1 };
}

/**
 * A palette with every colour already parsed to numbers.
 *
 * The palettes are authored as CSS strings because that is how a person reads
 * them, but re-parsing ten strings on every frame to crossfade between two of
 * them would be pure waste. Each preset is resolved once, cached, and then the
 * blend is plain arithmetic on floats.
 */
interface ResolvedPalette {
  /** 0 = fully additive (light on dark), 1 = fully subtractive (ink on paper).
   *  A NUMBER, not an enum, so a crossfade between a dark and a light preset can
   *  pass continuously through the middle — the shader evaluates both composites
   *  and mixes by this. */
  subtract: number;
  bg: RGB;
  head: RGB;
  tail: RGB;
  bleed: RGB;
  halo: RGB;
  core: RGB;
  poolA: RGB;
  poolB: RGB;
  poolAlphaA: number;
  poolAlphaB: number;
  vignette: RGB;
  alphaScale: number;
}

const resolvedCache = new Map<string, ResolvedPalette>();

/** Resolve one palette, including its trail ramp endpoints at a given hue travel. */
function resolve(pal: Palette, hueTravel: number): ResolvedPalette {
  const key = `${pal.name}|${hueTravel.toFixed(2)}`;
  const hit = resolvedCache.get(key);
  if (hit) return hit;
  const T = pal.trail;
  const pa = parseColor(pal.pool[0]);
  const pb = parseColor(pal.pool[1]);
  const out: ResolvedPalette = {
    subtract: pal.mode === "subtract" ? 1 : 0,
    bg: parseColor(pal.bg).rgb,
    head: hslToRgb(T.hue, T.sat, T.light),
    tail: hslToRgb(T.hue + hueTravel, T.sat + T.dSat, T.light + T.dLight),
    bleed: parseColor(pal.bleed).rgb,
    halo: parseColor(pal.halo).rgb,
    core: parseColor(pal.core).rgb,
    poolA: pa.rgb,
    poolB: pb.rgb,
    poolAlphaA: pa.a,
    poolAlphaB: pb.a,
    vignette: parseColor(pal.vignette).rgb,
    alphaScale: pal.alphaScale,
  };
  resolvedCache.set(key, out);
  return out;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

/**
 * Blend two resolved palettes. EVERY field interpolates — nothing snaps.
 *
 * This used to switch `mode` and `alphaScale` at the midpoint, on the theory that
 * a hard flip would hide there. It does not. The presets alternate dark and light,
 * so nearly every transition crossed a mode boundary, and the midpoint is the
 * worst place to flip: the background is a mid-grey where neither compositing mode
 * looks right, so the change read as a pop inside a washed-out middle. The shader
 * now evaluates both composites and mixes by `subtract`, which lets this be a
 * plain lerp like everything else.
 */
function blend(a: ResolvedPalette, b: ResolvedPalette, t: number): ResolvedPalette {
  return {
    subtract: lerp(a.subtract, b.subtract, t),
    alphaScale: lerp(a.alphaScale, b.alphaScale, t),
    bg: lerp3(a.bg, b.bg, t),
    head: lerp3(a.head, b.head, t),
    tail: lerp3(a.tail, b.tail, t),
    bleed: lerp3(a.bleed, b.bleed, t),
    halo: lerp3(a.halo, b.halo, t),
    core: lerp3(a.core, b.core, t),
    poolA: lerp3(a.poolA, b.poolA, t),
    poolB: lerp3(a.poolB, b.poolB, t),
    poolAlphaA: lerp(a.poolAlphaA, b.poolAlphaA, t),
    poolAlphaB: lerp(a.poolAlphaB, b.poolAlphaB, t),
    vignette: lerp3(a.vignette, b.vignette, t),
  };
}

const UNIFORMS = [
  "uMask", "uResolution", "uAspect",
  "uEchoes", "uStep", "uAlpha", "uFall", "uZStep",
  "uMagnet", "uMagnetOn", "uSwing",
  "uTurb", "uSpread", "uEdge", "uFringe",
  "uAnchor", "uYaw", "uPitch", "uFocal",
  "uTrailHead", "uTrailTail", "uBleed", "uHalo", "uCore", "uBg",
  "uPoolA", "uPoolB", "uPoolAlphaA", "uPoolAlphaB",
  "uVignette", "uSubtract", "uSoft", "uNoise", "uTime",
  "uHaloShift", "uWordShift",
] as const;

export class FadeMotion {
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private quad: WebGLBuffer | null = null;
  private loc: Record<string, WebGLUniformLocation | null> = {};

  private mask: WebGLTexture | null = null;

  readonly params: FadeParams = { ...DEFAULTS };

  /** which preset is showing; remix advances it */
  private paletteIdx = 0;
  /** The preset being crossfaded FROM, and how far through (1 = settled). */
  private fadeFrom = 0;
  private fadeMix = 1;

  // ── hero mode ───────────────────────────────────────────────────────────
  // Off by default. The playground stays a single static preset driven by a real
  // cursor; only the hero card runs itself.
  private hero = false;
  /** seconds until the next palette change */
  private cycleT = 0;
  /** The fake cursor. Hero mode drives `ptr` from this, so every reaction the
   *  real pointer triggers — the turn, the reach, the magnetism, the depth swing
   *  — comes along for free rather than being re-implemented. */
  private ghostX = 0.5;
  private ghostY = ANCHOR_Y;
  /** True only for a REAL pointer. The ghost writes `ptr` so it reuses the whole
   *  reaction chain, which means `ptr` alone can no longer answer "is someone
   *  actually hovering" — and without this distinction the ghost would latch
   *  `ptr` on forever and the release-to-drift behaviour would never fire again. */
  private realPtr = false;

  /** eased pointer lean */
  private leanX = 0;
  private leanY = 0;
  private leanTargetX = 0;
  private leanTargetY = 0;

  /** `near` is 1 at the word and 0 at the far corner. Drives trail LENGTH. */
  private near = 0;
  private nearTarget = 0;

  /** Live pointer position in 0..1, or null. Held so the per-frame step can
   *  recompute targets without needing a fresh event — a hand held still fires no
   *  pointermove at all, and the old code only ever updated on an event. */
  private ptr: { x: number; y: number } | null = null;

  /** Eased cursor position the magnetism pulls toward, and its eased presence.
   *  Followed rather than used raw: the bend arriving a beat after your hand is
   *  what makes the trail feel like it has mass being pulled, instead of a shape
   *  welded to the cursor. Presence fades so leaving relaxes the curve out rather
   *  than dropping it. */
  private magX = 0.5;
  private magY = ANCHOR_Y;
  private magOn = 0;

  /** 0 = fully pointer-driven, 1 = fully autonomous. Eased, never switched. */
  private idleMix = 1;
  /** measured width of WORD at 100px, to detect a real font swap */
  private lastFontWidth = 0;
  /** Drift clock, in seconds. Only advances while the drift is being mixed in, so
   *  the word cannot crawl away from a held-still cursor. */
  private t = 0;
  /** Wall clock, in seconds. ALWAYS advances. Anything that should keep living
   *  while you hover — the grain, the trail's turbulence — has to run off this,
   *  not off the drift clock: `t` is frozen under a hover by design, and driving
   *  the grain from it meant the film stopped moving the instant you touched the
   *  card. Two clocks because they answer two different questions. */
  private tReal = 0;

  private raf = 0;
  private last = 0;
  private running = false;
  private dpr = 1;
  private ro: ResizeObserver | null = null;
  private disposed = false;
  private fontFamily = "sans-serif";

  // mask rebuild guards
  private builtW = 0;
  private builtH = 0;
  private builtFont = "";

  constructor(host: HTMLElement, fontFamily?: string) {
    this.host = host;
    this.fontFamily = fontFamily ?? resolveFamily(PIXEL_FONT);
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "display:block;width:100%;height:100%";
    host.appendChild(this.canvas);

    const gl = this.canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;
    this.gl = gl;

    try {
      this.prog = this.build(FULL_VERT, TRAIL_FRAG);
    } catch {
      this.gl = null;
      return;
    }
    for (const u of UNIFORMS) {
      this.loc[u] = gl.getUniformLocation(this.prog, u);
    }

    // full-screen triangle
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );

    const bg = parseColor(this.palette.bg).rgb;
    gl.clearColor(bg[0], bg[1], bg[2], 1);

    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
  }

  get ok() {
    return !!this.gl && !!this.prog;
  }

  private build(vs: string, fs: string): WebGLProgram {
    const gl = this.gl!;
    const c = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) || "compile failed");
      }
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, c(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, c(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || "link failed");
    }
    return prog;
  }

  /** Rasterize the word and upload it. The only CPU work in the effect, and it
   *  runs once per size/font rather than per frame. */
  private buildMask() {
    const gl = this.gl;
    if (!gl || this.disposed) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (!W || !H) return;
    if (W === this.builtW && H === this.builtH && this.fontFamily === this.builtFont) {
      return;
    }
    this.builtW = W;
    this.builtH = H;
    this.builtFont = this.fontFamily;

    const art = makeWordMask(WORD, W, H, this.fontFamily);
    if (!this.mask) this.mask = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.mask);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // The shader's uv origin is bottom-left; the 2D canvas draws top-down.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  private resize() {
    const gl = this.gl;
    if (!gl || this.disposed) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    // Capped at 1.5: the shader is fill-rate bound (48 texture fetches a
    // fragment), so pixel count is the one thing that actually costs here.
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const cw = Math.round(w * this.dpr);
    const ch = Math.round(h * this.dpr);
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
      gl.viewport(0, 0, cw, ch);
      this.buildMask();
    }
    if (!this.running) this.draw(0);
  }

  setParams(p: Partial<FadeParams>) {
    Object.assign(this.params, p);
    if (!this.running) this.draw(0);
  }

  /** Re-rasterize once the real face has loaded.
   *
   *  The mask is laid out from whatever `measureText` reports at build time, so
   *  if the bitmap face has not arrived yet the word is sized to the fallback's
   *  metrics and stays wrong forever. That only bites on a cold reload, when the
   *  font is not yet in cache, which is exactly when it showed up.
   *
   *  Callers fire this from both `fonts.load()` and `fonts.ready`, so it lands
   *  twice on a cold load. The guard compares MEASURED WIDTH, not the family
   *  name: a CSS var resolves to the same name whether or not the webfont file
   *  has arrived, so a name check would look identical before and after load and
   *  skip the one rebuild that matters. */
  refreshFonts() {
    if (this.disposed || !this.gl) return;
    this.fontFamily = resolveFamily(PIXEL_FONT);
    const w = measureWord(WORD, this.fontFamily);
    if (this.mask && w === this.lastFontWidth) return;
    this.lastFontWidth = w;
    // force a rebuild even though the canvas size has not changed
    this.builtFont = "";
    this.buildMask();
    if (!this.running) this.draw(0);
  }

  /** Pointer in 0..1 relative to the host; null releases it to the idle drift. */
  setPointer(p: { x: number; y: number } | null) {
    if (!p) {
      // Only drop the pointer. The lean targets are deliberately LEFT where the
      // cursor put them: step() cross-fades from them to the drift, so they are
      // the "from" side of the blend. Zeroing them here would reintroduce the
      // jump the fade exists to remove.
      this.ptr = null;
      this.realPtr = false;
      return;
    }
    this.ptr = { x: p.x, y: p.y };
    this.realPtr = true;
    // Targets are recomputed here AND every frame from `ptr` (see step), because
    // a hand held perfectly still fires no pointermove — event-only updates were
    // why the word drifted off a stationary cursor.
    this.applyPointerTargets();
  }

  /** Derive the lean + reach targets from the live pointer position. */
  private applyPointerTargets() {
    const p = this.ptr;
    if (!p) return;
    // A small turn only. With a real perspective divide a little rotation buys a
    // lot of read — the taper does the work, so the angle does not have to.
    this.leanTargetX = (p.x - 0.5) * 0.42;
    this.leanTargetY = (p.y - 0.5) * 0.24;
    // Distance from the word's anchor, normalised so the far corner is ~1. Drives
    // trail LENGTH: close in the trail pulls tight, out at the edge it streams.
    const dx = p.x - 0.5;
    const dy = p.y - ANCHOR_Y;
    this.nearTarget = 1 - Math.min(1, Math.hypot(dx, dy) / 0.62);
  }

  /** Remix: crossfade to the next colour preset. */
  next() {
    // Start the new fade from whatever is CURRENTLY on screen. If a fade is still
    // running, its midpoint blend is the honest starting point — snapping back to
    // the previous preset's endpoint would pop, which is exactly what a spammed
    // remix used to do.
    this.fadeFrom = this.paletteIdx;
    this.fadeMix = this.fadeMix >= 1 ? 0 : this.fadeMix;
    this.paletteIdx = (this.paletteIdx + 1) % PALETTES.length;
    if (!this.running) this.draw(0);
  }

  /**
   * Hero mode: the card runs itself.
   *
   * A ghost cursor moves over it and the palette changes on a timer. Used for the
   * Vault card and the detail hero, where there may be no pointer at all — a
   * static card would show none of what makes this thing worth looking at.
   *
   * A real pointer still wins: `setPointer` overrides the ghost while it is
   * present, so hovering the hero takes control rather than fighting it.
   */
  enableHero(cyclePeriod = 2) {
    this.hero = true;
    this.cyclePeriod = cyclePeriod;
    this.cycleT = cyclePeriod;
  }
  private cyclePeriod = 2;

  get palette(): Palette {
    return PALETTES[this.paletteIdx % PALETTES.length];
  }

  /** The background currently on screen, as a CSS rgb() string, blend included.
   *  Lets the host element track the canvas so the card's frame and its art change
   *  together — otherwise the box stays one fixed grey while the picture inside it
   *  recolours, and the two visibly disagree during every transition. */
  get bgCss(): string {
    const c = this.lastBg;
    return `rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)})`;
  }
  private lastBg: RGB = [0, 0, 0];
  /** Called with the live background each frame; the card subscribes to restyle. */
  onBg: ((css: string) => void) | null = null;

  private step(dt: number) {
    // ── hero mode: the ghost cursor ───────────────────────────────────────
    // Imitating someone flicking the card around quickly but lightly. The brief
    // is FAST and WEAK, which are opposite ends of the same knob, so it is built
    // from high frequencies at small amplitudes rather than from one slow sweep
    // scaled down.
    //
    // Three incommensurate sines per axis. Their periods share no common factor,
    // so the path never closes into a loop the eye can learn — the giveaway that
    // something is automated is repetition, not speed. The amplitudes fall as the
    // frequencies rise, which is how real hand jitter is distributed: big
    // movements are slow, small ones are quick.
    //
    // It stays inside a tight box around the word (about a fifth of the card)
    // because a ghost that roams the full frame reads as a demo playing itself,
    // while one that fidgets near the word reads as someone actually toying with
    // it. Only advances while unattended, so a real pointer taking over does not
    // fight a ghost that kept moving underneath.
    if (this.hero && !this.realPtr) {
      const g = this.tReal;
      const gx =
        0.55 * Math.sin(g * 2.30) +
        0.30 * Math.sin(g * 3.70 + 1.1) +
        0.15 * Math.sin(g * 6.10 + 0.4);
      const gy =
        0.55 * Math.cos(g * 1.90 + 2.1) +
        0.30 * Math.sin(g * 4.30 + 0.5) +
        0.15 * Math.cos(g * 7.30 + 1.7);
      // 0.20 / 0.13 of the card, centred on the word's own anchor.
      this.ghostX = 0.5 + gx * 0.20;
      this.ghostY = ANCHOR_Y + gy * 0.13;
      this.ptr = { x: this.ghostX, y: this.ghostY };
      this.applyPointerTargets();
    }

    const hasPointer = !!this.ptr;

    // The cross-fade between pointer control and the autonomous drift.
    //
    // ASYMMETRIC, and this is the important part. Taking over is fast (~0.07s);
    // handing back is slow (~1.4s). A slow takeover meant that for the first
    // half-second of a hover the blend was still mostly DRIFT, so the card kept
    // wandering while the cursor was already on it and clearly not being
    // followed. The pointer has to win essentially at once; only letting go
    // should be gradual, because that is the direction where a fast change would
    // look like a snap.
    const mixTarget = hasPointer ? 0 : 1;
    const mixRate = hasPointer ? 26 : 0.7;
    this.idleMix += (mixTarget - this.idleMix) * Math.min(1, dt * mixRate);
    // Land it exactly, so a residual 0.001 of drift can't keep nudging a word
    // that is supposed to be locked to a stationary cursor.
    if (hasPointer && this.idleMix < 0.002) this.idleMix = 0;

    // The drift clock only advances while the drift is actually being mixed in.
    // Freezing it under a hover is what stops the word crawling away from a
    // held-still cursor, and because it resumes from where it stopped the
    // handover stays continuous — the drift never jumps, it just pauses.
    this.t += dt * this.idleMix;
    this.tReal += dt;

    // Re-derive from the live pointer every frame. pointermove does not fire for
    // a stationary hand, so anything that only updated on events went stale.
    this.applyPointerTargets();

    const m = this.idleMix;
    const driftX = Math.sin(this.t * 0.23) * 0.13;
    const driftY = Math.sin(this.t * 0.31 + 1.7) * 0.07;
    const driftN = 0.22 + Math.sin(this.t * 0.17) * 0.1;
    const tx = this.leanTargetX * (1 - m) + driftX * m;
    const ty = this.leanTargetY * (1 - m) + driftY * m;
    const tn = this.nearTarget * (1 - m) + driftN * m;

    // Frame-rate independent easing. The old form, `v += (target-v) * dt * rate`,
    // is only an approximation of exponential decay and its effective time
    // constant changes with frame length — so a long frame overshot and a short
    // one crawled, which is what made the motion feel like it was lurching
    // rather than tracking. 1-exp(-rate*dt) is the exact solution and behaves
    // identically at any frame rate.
    const ease = (rate: number) => 1 - Math.exp(-rate * dt);

    // Tight while the pointer is on the card, slack once it leaves so the return
    // to drift is a settle rather than a retreat.
    const k = ease(hasPointer ? 16 : 2.2);
    this.leanX += (tx - this.leanX) * k;
    this.leanY += (ty - this.leanY) * k;
    this.near += (tn - this.near) * ease(hasPointer ? 12 : 1.8);

    // Clamp to the documented caps so the halo padding derived from them holds.
    this.leanX = Math.max(-LEAN_X_MAX, Math.min(LEAN_X_MAX, this.leanX));
    this.leanY = Math.max(-LEAN_Y_MAX, Math.min(LEAN_Y_MAX, this.leanY));

    // The magnet target. Slower than the lean (7 vs 16) on purpose: the word
    // turning to face you should feel immediate, but the trail bending after it
    // should feel like something with weight catching up. Same movement, two
    // speeds, which is most of why it reads as physical.
    const mk = ease(7);
    if (this.ptr) {
      this.magX += (this.ptr.x - this.magX) * mk;
      this.magY += (this.ptr.y - this.magY) * mk;
    }
    // Presence eases both ways so the curve relaxes out on leave. Slower to fade
    // than to arrive, matching the lean's asymmetry.
    this.magOn += ((this.ptr ? 1 : 0) - this.magOn) * ease(this.ptr ? 9 : 2.4);

    // ── palette crossfade ─────────────────────────────────────────────────
    // Advanced linearly here (the cycle timer below reads it as raw progress), and
    // SMOOTHSTEPPED where it is consumed. A linear colour mix begins and ends with
    // a visible corner — the change starts and stops abruptly at both ends. Easing
    // it means the wash accelerates in and settles out, which is what makes a fast
    // transition still read as smooth rather than as a cut.
    if (this.fadeMix < 1) {
      this.fadeMix = Math.min(1, this.fadeMix + dt / FADE_SECONDS);
    }

    // Hero mode advances the preset on a timer. Counted down from real elapsed
    // time rather than a frame count, so it changes every two seconds whatever
    // the frame rate — and the countdown only runs once the previous fade has
    // settled, so a slow fade can never be cut off by the next one starting.
    if (this.hero && this.fadeMix >= 1) {
      this.cycleT -= dt;
      if (this.cycleT <= 0) {
        this.cycleT = this.cyclePeriod;
        this.next();
      }
    }
  }

  private draw(dt: number) {
    const gl = this.gl;
    const prog = this.prog;
    if (!gl || !prog) return;
    this.step(dt);
    if (!this.mask) this.buildMask();
    if (!this.mask) return;

    const W = this.canvas.width;
    const H = this.canvas.height;
    const P = this.params;
    const aspect = W / Math.max(1, H);

    // The palette actually on screen. `hueShift` scales each preset's own hue
    // travel rather than replacing it, so the slider still does something on every
    // preset — which means the ramp endpoints depend on it and it has to be
    // resolved here rather than baked into the preset table.
    const hueOf = (p: Palette) => p.trail.dHue * (P.hueShift / 26);
    const to = PALETTES[this.paletteIdx % PALETTES.length];
    const pal =
      this.fadeMix >= 1
        ? resolve(to, hueOf(to))
        : (() => {
            const from = PALETTES[this.fadeFrom % PALETTES.length];
            const m = this.fadeMix;
            // smoothstep: eases in and out, so the wash has no corner at either end
            const eased = m * m * (3 - 2 * m);
            return blend(
              resolve(from, hueOf(from)),
              resolve(to, hueOf(to)),
              eased,
            );
          })();

    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const aPos = gl.getAttribLocation(prog, "aPosition");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.mask);
    gl.uniform1i(this.loc.uMask, 0);

    // ── the camera ────────────────────────────────────────────────────────
    // The word is a flat plane standing in space and the trail is its light
    // extruded BACKWARD along the depth axis. The cursor turns that plane.
    //
    // Rotate a real plane away from you and the far edge gets NARROWER than the
    // near one, and that foreshortening is the entire cue that tells an eye it is
    // looking at depth. A shear cannot produce it at any strength, which is why
    // an earlier shear-based version only ever looked more wrong the harder it
    // was pushed.
    //
    // NEGATIVE, so the plane turns to FACE the cursor: a real card pivoting
    // toward you brings its near edge closer and lets the far edge recede.
    gl.uniform1f(this.loc.uYaw, -this.leanX * 0.2);
    gl.uniform1f(this.loc.uPitch, -this.leanY * 0.12);
    gl.uniform1f(this.loc.uFocal, FOCAL);

    // The anchor travels a little too. The plane rotating alone reads as a card
    // on a pin; letting the whole thing shift makes it feel like an object
    // floating in front of the page. Small on purpose, and it moves WITH the
    // pointer while the plane turns to face it, so the two cues reinforce.
    gl.uniform2f(
      this.loc.uAnchor,
      0.5 + this.leanX * 0.05,
      // uv is bottom-up in the shader; the mask was uploaded flipped to match.
      1 - (ANCHOR_Y + this.leanY * 0.05),
    );

    // ── the trail ─────────────────────────────────────────────────────────
    // Falls DOWN the card by default (angle is 90deg) — that downward fall IS
    // the effect, and the cursor only tips it. Pushing the copies purely backward
    // in Z instead is geometrically fine but reads as the word shrinking into the
    // distance rather than trailing, so there is nothing to see.
    //
    // Nothing drags the trail against the pointer's travel any more. A long
    // exposure genuinely does smear backward along the path, but driving that off
    // measured cursor velocity meant a SMALL move produced a real backward shove
    // — the trail moved opposite to the hand, which reads as the card fighting
    // you rather than following. The turn plus the reach carry the response.
    //
    // uv is bottom-up, so a "downward" fall is -y here.
    gl.uniform2f(
      this.loc.uFall,
      Math.cos(P.angle),
      -Math.sin(P.angle),
    );
    gl.uniform1f(this.loc.uStep, P.step);
    gl.uniform1f(this.loc.uZStep, 0.55 * P.step);
    gl.uniform1f(this.loc.uAlpha, P.alpha * pal.alphaScale);

    // Magnetism. uv is bottom-up, so the y target is flipped to match the anchor.
    gl.uniform2f(this.loc.uMagnet, this.magX, 1 - this.magY);
    gl.uniform1f(this.loc.uMagnetOn, this.magOn);
    // Depth swing. Driven off the horizontal lean, so turning the plane and
    // shearing the stack in depth are the same gesture rather than two unrelated
    // reactions — that coherence is what makes it read as one object in space.
    gl.uniform1f(this.loc.uSwing, this.leanX * 2.2);

    // The five layers. Turbulence gets a little push from the pointer's presence
    // so the trail stirs when you are on the card and settles when you leave —
    // the air around it reacting to you, not just the word.
    gl.uniform1f(this.loc.uTurb, P.turbulence * (1 + this.magOn * 0.35));
    gl.uniform1f(this.loc.uSpread, P.spread);
    gl.uniform1f(this.loc.uEdge, P.edge);
    gl.uniform1f(this.loc.uFringe, P.fringe);

    // `near` modulates the length live: the closer the cursor is to the word, the
    // shorter the trail, so approaching it reels the exposure in. Kept to a
    // 0.55–1.15 band — collapse it further and the effect stops being itself,
    // push it higher and the far copies leave the frame.
    const reach = 1.15 - this.near * 0.6;
    gl.uniform1f(this.loc.uEchoes, Math.max(1, P.echoes * reach));

    // ── colour ────────────────────────────────────────────────────────────
    // All already resolved to floats (and blended, mid-crossfade), so this is a
    // straight upload with no per-frame string parsing.
    gl.uniform3fv(this.loc.uTrailHead, pal.head);
    gl.uniform3fv(this.loc.uTrailTail, pal.tail);

    gl.uniform3fv(this.loc.uBleed, pal.bleed);
    gl.uniform3fv(this.loc.uHalo, pal.halo);
    gl.uniform3fv(this.loc.uCore, pal.core);
    gl.uniform3fv(this.loc.uBg, pal.bg);

    gl.uniform3fv(this.loc.uPoolA, pal.poolA);
    gl.uniform3fv(this.loc.uPoolB, pal.poolB);
    gl.uniform1f(this.loc.uPoolAlphaA, pal.poolAlphaA);
    gl.uniform1f(this.loc.uPoolAlphaB, pal.poolAlphaB);
    gl.uniform3fv(this.loc.uVignette, pal.vignette);

    // Publish the live background so the host box can match it. Only fires when it
    // actually changes — during a fade that is every frame, but at rest it is
    // nothing, so this is not a per-frame style write.
    if (
      pal.bg[0] !== this.lastBg[0] ||
      pal.bg[1] !== this.lastBg[1] ||
      pal.bg[2] !== this.lastBg[2]
    ) {
      this.lastBg = [pal.bg[0], pal.bg[1], pal.bg[2]];
      this.onBg?.(this.bgCss);
    }

    // Continuous 0..1, so a dark→light crossfade passes through the middle instead
    // of flipping compositing mode in one frame.
    gl.uniform1f(this.loc.uSubtract, pal.subtract);
    // The soft layers are ADDITIVE ideas: on black they spill light past the
    // glyph. Subtractively they instead darken the paper around it, so at the
    // additive strengths they smear the letterforms into a soft grey blob. Pulled
    // right back on subtract presets — just enough to seat the word on the page.
    // Interpolated by the same factor, so it can no longer jump mid-transition.
    gl.uniform1f(this.loc.uSoft, lerp(1, 0.35, pal.subtract));
    gl.uniform1f(this.loc.uNoise, lerp(0.02, 0.012, pal.subtract));
    // The WALL clock, not the drift clock. The drift clock freezes under a hover
    // by design, and driving the grain and the turbulence from it meant both
    // stopped dead the instant the cursor arrived — the film stopped moving at
    // exactly the moment the card was supposed to feel most alive.
    gl.uniform1f(this.loc.uTime, this.tReal);
    gl.uniform1f(this.loc.uAspect, aspect);
    gl.uniform2f(this.loc.uResolution, W, H);

    // The pool tracks the pointer so it reads as the light SOURCE moving, which
    // is what makes the word look lit from where the cursor is.
    gl.uniform2f(
      this.loc.uHaloShift,
      this.leanX * HALO_TRACK_X,
      -this.leanY * HALO_TRACK_Y,
    );
    // The two soft word layers shift slightly AWAY from the pointer while the
    // core stays put; with the pool tracking the cursor, that offset is what
    // sells directional light — the bleed spills off the far side of the glyph.
    gl.uniform2f(
      this.loc.uWordShift,
      -this.leanX * 0.006,
      this.leanY * 0.006,
    );

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  renderStill() {
    this.draw(0);
  }

  start() {
    if (this.running || !this.ok || this.disposed) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      // Clamped so a stalled tab cannot fling the eased values across in one
      // step. The easing is exponential (see step), so it is correct at any
      // frame length — this only guards against a multi-second hitch.
      const dt = Math.min((now - this.last) / 1000, 1 / 30);
      this.last = now;
      this.draw(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy() {
    this.disposed = true;
    this.stop();
    this.ro?.disconnect();
    this.ro = null;
    const gl = this.gl;
    if (gl) {
      if (this.mask) gl.deleteTexture(this.mask);
      if (this.quad) gl.deleteBuffer(this.quad);
      if (this.prog) gl.deleteProgram(this.prog);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.gl = null;
    this.canvas.remove();
  }
}

