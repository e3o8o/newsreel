// visuals/src/chroma/shaders.ts
var FULL_VERT = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;
var BLUR_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;   // per-tap step (texel * radius) along one axis

void main() {
  // 9-tap Gaussian weights (sigma ~ 2), normalized.
  float w0 = 0.2270270270;
  float w1 = 0.1945945946;
  float w2 = 0.1216216216;
  float w3 = 0.0540540541;
  float w4 = 0.0162162162;
  vec4 c = texture2D(uTex, vUv) * w0;
  c += texture2D(uTex, vUv + uDir * 1.0) * w1;
  c += texture2D(uTex, vUv - uDir * 1.0) * w1;
  c += texture2D(uTex, vUv + uDir * 2.0) * w2;
  c += texture2D(uTex, vUv - uDir * 2.0) * w2;
  c += texture2D(uTex, vUv + uDir * 3.0) * w3;
  c += texture2D(uTex, vUv - uDir * 3.0) * w3;
  c += texture2D(uTex, vUv + uDir * 4.0) * w4;
  c += texture2D(uTex, vUv - uDir * 4.0) * w4;
  gl_FragColor = c;
}
`;
var COMPOSITE_FRAG = `
precision highp float;
varying vec2 vUv;

uniform sampler2D uMask;    // crisp white silhouette (the core)
uniform sampler2D uB0;      // bloom level 0 (tightest)
uniform sampler2D uB1;
uniform sampler2D uB2;
uniform sampler2D uB3;      // bloom level 3 (widest halo)
uniform vec2  uSplit;       // chromatic aberration offset (uv units), cursor/auto driven
uniform float uBloom;       // overall bloom gain
uniform vec3  uWarm;        // warm/yellow tint  (yellow/blue preset)
uniform vec3  uCool;        // cool/blue tint
uniform vec3  uRed;         // red/cyan fringe tint
uniform float uCore;        // brightness of the crisp white core
uniform vec3  uBg;          // background tint (dark wall, or light wall if inverted)
uniform float uInvert;      // 0 = dark wall + glowing word, 1 = light wall + dark press
uniform float uNoise;       // grain amount 0..1
uniform float uTime;        // for animated grain
uniform float uAspect;      // w/h, to keep the split + vignette round
uniform vec2  uResolution;
uniform float uSpectral;    // 0..1 how much true prism rainbow rides over the base split
uniform vec2  uCursor;      // pointer position in uv (0..1)
uniform float uCursorOn;    // 0..1 eased cursor presence over the card
uniform float uDisperse;    // 0..1 cycle transition: blooms the word out into a soft haze

// cheap hash noise for the lo-fi grain
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

// smooth value noise (bilinear-interpolated hash) \u2014 soft blotches, not per-pixel dither.
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // smoothstep the cell
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// a minimal but richer wall texture, centred around 0. Kept very subtle \u2014 just enough that
// the dark background reads as a soft, lit surface with depth instead of flat grain:
//   - 3-octave fbm gives gentle cloudy mottling (large soft blotches + a little fine break-up)
//   - a slow, large-scale diagonal drift so the surface feels hand-finished, not tiled
// The amplitude is low; the caller scales it down further. No hard edges, no obvious pattern.
float wallTex(vec2 uv, vec2 res) {
  vec2 p = uv * vec2(res.x / res.y, 1.0);        // square the domain so blotches aren't stretched
  float fbm =
      vnoise(p * 2.4) * 0.55 +
      vnoise(p * 5.1 + 11.0) * 0.30 +
      vnoise(p * 11.7 + 3.0) * 0.15;
  // a broad, slowly-varying sheen across the panel (one very low-freq octave), so one side
  // of the wall sits a touch lighter \u2014 a soft raking light rather than uniform fill.
  float sheen = vnoise(p * 0.9 + 5.0);
  return (fbm - 0.5) * 0.8 + (sheen - 0.5) * 0.5;
}

// the summed multi-radius bloom sampled at an offset (one "channel"). CONCENTRATED:
// the tight core levels carry most of the weight; the wide halo is only a faint skirt,
// so the glow hugs the letters instead of washing the whole card out.
float bloomAt(vec2 uv) {
  float b = 0.0;
  b += texture2D(uB0, uv).r * 0.85;  // tightest -> most of the glow
  b += texture2D(uB1, uv).r * 0.55;
  b += texture2D(uB2, uv).r * 0.22;
  b += texture2D(uB3, uv).r * 0.10;  // widest halo -> just a faint skirt
  return b;
}

// A palette-anchored spectral ramp: 0 = warm end, 1 = cool end, with the fringe tint
// as the midpoint. Instead of 3 hard tints this gives a smooth colour walk across the
// halo, so the split reads as a soft rainbow edge rather than a flat colour cast.
vec3 spectralTint(float u) {
  u = clamp(u, 0.0, 1.0);
  if (u < 0.5) return mix(uWarm, uRed, u * 2.0);
  return mix(uRed, uCool, (u - 0.5) * 2.0);
}

// TRUE prism dispersion, kept MINIMAL: the aberration grows with distance from the word
// centre (real glass fans outward), and we take a few taps across the spectrum along the
// split direction. Small radius + few taps => a refined rainbow rim, not a busy smear.
vec3 spectralFringe(vec2 uv, vec2 split) {
  // radial gain: ~1 near centre, a touch more toward the edges (clamped so it stays soft)
  vec2 fromC = (uv - 0.5) * vec2(uAspect, 1.0);
  float disp = 0.6 + 0.9 * clamp(length(fromC), 0.0, 1.0);
  vec2 step = split * disp;
  vec3 acc = vec3(0.0);
  // 5 evenly-spaced taps from -1 (warm) to +1 (cool); the fringe colour sits in the middle
  const int N = 5;
  for (int i = 0; i < N; i++) {
    float f = float(i) / float(N - 1);        // 0..1
    float off = (f - 0.5) * 2.0;              // -1..1
    float b = bloomAt(uv + step * off);
    acc += spectralTint(f) * b;
  }
  return acc / float(N);
}

void main() {
  // LIQUID-CHROME SHIMMER: a whisper-amplitude uv warp driven by slow noise, so the word
  // and its glow gently wobble like molten metal instead of a dead silhouette. The warp
  // is domain-distorted (noise of noise) for an organic, non-directional ripple and kept
  // extremely small (~0.15% of the frame) so it never smears the letters.
  vec2 uv = vUv;
  float wx = vnoise(uv * 4.0 + vec2(uTime * 0.13, uTime * 0.05));
  float wy = vnoise(uv * 4.0 + vec2(7.0 - uTime * 0.06, 3.0 + uTime * 0.11));
  uv += (vec2(wx, wy) - 0.5) * 0.0016;

  // ---- CYCLE DISPERSE & RE-FORM: the transition is made entirely of the effect's OWN
  // language \u2014 bloom + split \u2014 not a glitch. uDisperse (0 at rest, 1 at mid-swap) spreads
  // the chromatic split WIDE so the warm/cool copies pull far apart, melts the crisp core,
  // and lifts the bloom, so the old word blooms out into a soft coloured haze; at the peak
  // the word swaps under the cloud; then uDisperse falls and the new word condenses back
  // out of the light as the split collapses to rest. Smooth, glowy, in-style. ----
  vec2 s = uSplit;
  float disp = uDisperse;                         // 0..1 dispersion strength this frame
  // spread the split RADIALLY outward from centre (a prism blooming apart), plus a slow
  // swirl so the haze has a little organic drift rather than a pure zoom.
  vec2 fromMid = (uv - 0.5) * vec2(uAspect, 1.0);
  float rr = length(fromMid) + 0.0001;
  vec2 radial = fromMid / rr;
  float ang = uTime * 0.6;
  vec2 swirl = vec2(radial.x * cos(ang) - radial.y * sin(ang),
                    radial.x * sin(ang) + radial.y * cos(ang));
  // during dispersion the split grows (copies drift apart) and gains the radial/swirl
  // direction, so the word softens into a gentle rainbow haze instead of tearing. Kept
  // WEAK \u2014 the word stays put and just breathes, it never flies far out.
  s += mix(radial, swirl, 0.5) * disp * 0.022;
  s *= 1.0 + disp * 0.9;
  // no per-channel tear anymore \u2014 the split alone carries the whole transition.
  vec2 tearW = vec2(0.0), tearC = vec2(0.0), tearR = vec2(0.0);

  // CURSOR POOL: a soft aspect-correct falloff around the pointer. It does NOT move the
  // word \u2014 it just brightens the bloom + widens the rainbow locally, so the light lifts
  // where you hover and settles back when you leave. Gentle radius, eased by presence.
  vec2 cAsp = vec2(uAspect, 1.0);
  vec2 toCur = uv * cAsp - uCursor * cAsp;
  float cd = length(toCur);
  float pool = smoothstep(0.34, 0.0, cd) * uCursorOn;   // 1 at cursor -> 0 by ~0.34

  // HOVER LIFE: near the pointer the light behaves like a disturbed liquid, not just a
  // brighter spot. Two small touches, both fading out with the pool:
  //  1. a soft concentric RIPPLE pushes the sampled uv in/out radially around the cursor,
  //     so the glow ripples as if the pointer pressed into it.
  //  2. the split gains a component that leans ALONG the cursor->centre direction, so the
  //     rainbow tilts toward where you are (felt, but it never drags the whole word).
  if (pool > 0.001) {
    vec2 rdir = toCur / max(cd, 0.0001);
    float ripple = sin(cd * 46.0 - uTime * 5.0) * pool * 0.0022;
    uv += (rdir / cAsp) * ripple;
    s += (rdir / cAsp) * pool * 0.010;                  // split leans toward the cursor
  }

  // Chromatic aberration: sample the bloom three times, each pushed a different way, so
  // the tinted copies pull apart at the edges:
  //   warm  ->  +split
  //   cool  ->  -split
  //   fringe -> perpendicular split (a second, weaker fringe)
  // These are SCALAR intensities per channel, tinted then blended below.
  float bw = bloomAt(uv + s + tearW);
  float bc = bloomAt(uv - s + tearC);
  float br = bloomAt(uv + vec2(-s.y, s.x) * 0.6 + tearR);

  // Coloured glow, tone-mapped with a soft rolloff so the letter bodies don't clip to
  // flat white. 1 - exp(-x) saturates gently toward the tint's own colour. A small
  // amount of the TRUE spectral fringe (radial prism, multi-tap) is mixed into the raw
  // energy so the halo edge gains a soft rainbow without changing the overall colour.
  vec3 baseRaw = (uWarm * bw + uCool * bc + uRed * br);
  // near the cursor, widen the rainbow (more spectral) and lift the glow (more energy).
  // during dispersion gently widen the spectral rainbow + lift the bloom a touch, so the
  // word softly breathes rather than blowing into a big cloud. Kept weak.
  float specAmt = clamp(uSpectral + pool * 0.4 + disp * 0.25, 0.0, 1.0);
  vec3 raw = mix(baseRaw, spectralFringe(uv, s), specAmt * 0.55) * uBloom * (1.0 + pool * 0.9 + disp * 0.45);
  vec3 glow = vec3(1.0) - exp(-raw);
  // the crisp white core softens as the word disperses (loses its hard edge into the bloom)
  // but never fully vanishes, so it stays readable while it re-forms.
  float core = texture2D(uMask, uv).r * (1.0 - disp * 0.75);

  // shared: vignette + a minimal plaster grain so the wall reads as a real surface
  vec2 vc = (uv - 0.5) * vec2(uAspect, 1.0);
  float vig = smoothstep(1.05, 0.35, length(vc));
  float tex = wallTex(uv, uResolution);
  float g = hash(uv * uResolution * 0.5 + uTime);

  // LIVING WALL: a very slow caustic drift so the dark background breathes instead of
  // sitting dead. Two counter-scrolling low-freq noise fields beat against each other;
  // the result is tiny (a few % of the wall value) and tinted by the palette below.
  float ca = vnoise(uv * vec2(uAspect, 1.0) * 2.3 + vec2(uTime * 0.012, uTime * 0.008));
  float cb = vnoise(uv * vec2(uAspect, 1.0) * 3.7 - vec2(uTime * 0.009, uTime * 0.014));
  float caustic = (ca * cb - 0.25);   // centred-ish, mostly small

  // ---- DARK mode: dark wall + glowing word (additive) ----
  vec3 rimC = vec3(uCore) * smoothstep(0.35, 0.55, core) * (1.0 - smoothstep(0.6, 0.9, core));
  vec3 glowD = glow;
  glowD += rimC;
  glowD += (g - 0.5) * uNoise * (0.4 + 0.6 * length(glowD));
  glowD *= mix(0.82, 1.0, vig);
  // base wall + a soft mottle/sheen: multiply for the darker blotches, plus a gentle additive
  // lift on the bright side of the sheen so the surface has light on it (not only shadow).
  vec3 wallD = uBg * mix(0.82, 1.08, vig) * (1.0 + tex * 0.35) + uBg * max(tex, 0.0) * 0.25;
  // palette-tinted caustic light on the wall (stronger toward the darker outer field, so it
  // never fights the glow): the wall clearly shimmers in the word's own colours instead of
  // sitting as a flat near-black panel.
  vec3 causticTint = normalize(uWarm + uCool + 0.0001);
  wallD += causticTint * caustic * 0.09 * (1.0 - vig * 0.4);
  vec3 outD = wallD + glowD;

  // ---- LIGHT mode: dark word with the SAME soft bloom, as a dark tinted haze ----
  // This is dark mode's look inverted: the same soft multi-radius bloom (bw/bc/br) drives
  // everything, so the word carries the same blurry glow \u2014 but here it DARKENS the light
  // wall toward each split colour instead of adding light. Because we use the soft bloom
  // (not the crisp mask), the edges are soft + glowy, and the warm/cool offsets give the
  // coloured chromatic haze. A crisp dark core sits under it so the letters stay legible.
  vec3 wallL = uBg * mix(1.0, 0.94, 1.0 - vig);       // light wall, faintly darker at edges
  wallL += tex * 0.018;                               // faint mottle/sheen (subtle on paper)

  // the soft bloom, tinted + split, as a "darken amount" per channel (same tone-map as
  // dark mode). glowL is bright/coloured near the word, ~0 out on the wall.
  vec3 rawL = mix(baseRaw, spectralFringe(uv, s), specAmt * 0.55) * uBloom * (1.0 + pool * 0.9);
  vec3 glowL = vec3(1.0) - exp(-rawL);
  // darken the wall toward the COMPLEMENT of the glow colour, weighted by how strong the
  // glow is here -> a soft warm haze on one side, cool on the other, fading into the wall.
  vec3 pressed = wallL * (vec3(1.0) - glowL * 0.9);

  // a crisp dark core so the letters read solid (the soft bloom alone is too faint to be
  // legible as text). Uses the plain mask, pressed to near-black.
  float ink = smoothstep(0.4, 0.62, core);
  pressed *= mix(1.0, 0.1, ink);
  pressed += (g - 0.5) * uNoise * 0.4;                // grain
  vec3 outL = pressed;

  vec3 outc = mix(outD, outL, uInvert);
  gl_FragColor = vec4(outc, 1.0);
}
`;

// visuals/src/chroma/text-mask.ts
async function makeWordMask(word, w, h, fontFamily) {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  const text = (word || "").trim();
  if (!text) return out;
  const cx = W / 2;
  const cy = H * 0.5;
  const maxW = W * 0.78;
  let size = H * 0.42;
  ctx.font = `800 ${size}px ${fontFamily}`;
  const measured = ctx.measureText(text).width;
  if (measured > maxW) {
    size *= maxW / measured;
    ctx.font = `800 ${size}px ${fontFamily}`;
  }
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const ls = size * 0.02;
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + ls * (chars.length - 1);
  let x = cx - total / 2;
  ctx.textAlign = "left";
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x, cy);
    x += widths[i] + ls;
  }
  return out;
}

// visuals/src/chroma/engine.ts
var CHROMA_DEFAULTS = {
  word: "chrome",
  bloom: 1.62,
  // gain into the tone-map (1 - exp(-x)); high enough to read, can't clip
  split: 9,
  core: 1.06,
  // thin rim brightness only (not a full white fill anymore)
  noise: 0.15,
  spectral: 0.6,
  // a soft real-rainbow rim rides over the warm/cool split
  warm: [1, 0.66, 0.5],
  // soft peach
  cool: [0.42, 0.6, 0.95],
  // steel blue
  red: [1, 0.42, 0.6],
  // rose fringe
  bg: [0.11, 0.13, 0.2],
  // deep dusk-blue wall (a lifted indigo, clearly a colour)
  invert: false
};
var LEVELS = [
  { scale: 0.5, radius: 1.5 },
  { scale: 0.25, radius: 2 },
  { scale: 0.125, radius: 2.5 },
  { scale: 0.0625, radius: 3 }
];
var ChromaGlow = class {
  host;
  canvas;
  gl = null;
  blurProg = null;
  compProg = null;
  quad = null;
  blurLoc = {};
  compLoc = {};
  mask = null;
  maskW = 1;
  maskH = 1;
  // per level: the bloom target + a scratch target for the separable blur
  levels = [];
  raf = 0;
  running = false;
  awake = false;
  startT = 0;
  w = 0;
  h = 0;
  dpr = 1;
  fontFamily = "var(--font-neue-corp), sans-serif";
  params;
  // rebuild guards (mask is the only expensive CPU step)
  builtW = 0;
  builtH = 0;
  builtWord = "";
  builtFont = "";
  buildScheduled = 0;
  destroyed = false;
  painted = false;
  // motion: eased split target (cursor) + autonomous flick + hover intensity
  px = 0;
  // pointer x in -1..1 from center
  py = 0;
  tpx = 0;
  tpy = 0;
  active = 0;
  // eased 0..1, 1 while cursor over the card
  tActive = 0;
  // autonomous motion: a smoothly-followed position that wanders the word fast on a few
  // layered sines (the LEGO virtual-cursor style), non-circular + non-linear. fx/fy.
  fx = 0;
  fy = 0;
  // ---- cycle mode: the hero card walks a list of funny words + colour worlds, joined by
  // a chromatic glitch-slide. Off by default (the playground never cycles). ----
  cycle = false;
  cycleWords = [];
  cyclePalettes = [];
  cycleIdx = 0;
  cyclePhase = "hold";
  cyclePhaseT = 0;
  // seconds into the current phase
  holdDur = 1.15;
  // seconds a word rests before the next transition
  outDur = 0.24;
  // bloom out into haze
  inDur = 0.32;
  // condense back into the new word
  disperse = 0;
  // 0..1 transition dispersion (bloom-out), driven by phase
  nextPending = false;
  // set at the out->in swap point
  lastNow = 0;
  // for real-dt cycle stepping
  // palette tween: we lerp the colour uniforms from `palFrom` to `palTo` across a swap so
  // the world changes smoothly under the glitch instead of popping.
  palFrom = null;
  palTo = null;
  palMix = 1;
  // 0..1, eased across the transition
  ok = false;
  constructor(host, params) {
    this.host = host;
    this.params = { ...CHROMA_DEFAULTS, ...params };
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      // Hidden until the first real frame so the dark host shows (and gets captured by
      // the view-transition) instead of an undrawn black canvas flashing.
      opacity: "0"
    });
    host.appendChild(this.canvas);
    const gl = this.canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false
    });
    if (!gl) return;
    this.gl = gl;
    try {
      this.blurProg = this.build(FULL_VERT, BLUR_FRAG);
      this.compProg = this.build(FULL_VERT, COMPOSITE_FRAG);
    } catch {
      this.gl = null;
      return;
    }
    for (const u of ["uTex", "uDir"]) {
      this.blurLoc[u] = gl.getUniformLocation(this.blurProg, u);
    }
    for (const u of [
      "uMask",
      "uB0",
      "uB1",
      "uB2",
      "uB3",
      "uSplit",
      "uBloom",
      "uWarm",
      "uCool",
      "uRed",
      "uCore",
      "uBg",
      "uInvert",
      "uNoise",
      "uTime",
      "uAspect",
      "uResolution",
      "uSpectral",
      "uCursor",
      "uCursorOn",
      "uDisperse"
    ]) {
      this.compLoc[u] = gl.getUniformLocation(this.compProg, u);
    }
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.clearColor(this.params.bg[0], this.params.bg[1], this.params.bg[2], 1);
    this.resize();
    void this.buildMaskNow();
    this.canvas.addEventListener("pointermove", this.onMove);
    this.canvas.addEventListener("pointerenter", this.onEnter);
    this.canvas.addEventListener("pointerleave", this.onLeave);
    this.ok = true;
  }
  build(vs, fs) {
    const gl = this.gl;
    const c = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) || "compile failed");
      }
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, c(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, c(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || "link failed");
    }
    return prog;
  }
  makeTarget(w, h) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, w, h };
  }
  allocLevels() {
    const gl = this.gl;
    if (!gl) return;
    this.freeLevels();
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    this.levels = LEVELS.map((l) => {
      const w = Math.max(2, Math.round(cw * l.scale));
      const h = Math.max(2, Math.round(ch * l.scale));
      return { out: this.makeTarget(w, h), tmp: this.makeTarget(w, h) };
    });
  }
  freeLevels() {
    const gl = this.gl;
    if (!gl) return;
    for (const lv of this.levels) {
      gl.deleteFramebuffer(lv.out.fb);
      gl.deleteTexture(lv.out.tex);
      gl.deleteFramebuffer(lv.tmp.fb);
      gl.deleteTexture(lv.tmp.tex);
    }
    this.levels = [];
  }
  setFont(family) {
    if (family === this.fontFamily) return;
    this.fontFamily = family;
    this.scheduleBuild();
  }
  setParams(p) {
    const wordChanged = p.word !== void 0 && p.word !== this.params.word;
    this.params = { ...this.params, ...p };
    if (wordChanged) this.scheduleBuild();
    else if (!this.running) this.renderOnce();
  }
  /**
   * Turn on hero cycle mode: walk `words` paired with `palettes` (a colour world each),
   * swapping every few seconds with a chromatic glitch-slide. The first pair is applied
   * immediately. The playground never calls this, so it stays a single static word.
   */
  enableCycle(words, palettes) {
    if (!words.length) return;
    this.cycle = true;
    this.cycleWords = words;
    this.cyclePalettes = palettes;
    this.cycleIdx = 0;
    this.cyclePhase = "hold";
    this.cyclePhaseT = 0;
    this.palMix = 1;
    this.palFrom = palettes[0] ?? null;
    this.palTo = palettes[0] ?? null;
    this.params = { ...this.params, word: words[0], ...palettes[0] ?? {} };
    this.scheduleBuild();
  }
  // lerp helpers for the palette tween
  lerp(a, b, t) {
    return a + (b - a) * t;
  }
  lerp3(a, b, t) {
    return [this.lerp(a[0], b[0], t), this.lerp(a[1], b[1], t), this.lerp(a[2], b[2], t)];
  }
  // Resolve the currently-displayed palette by easing palFrom -> palTo by palMix. Falls
  // back to the live params for any field a palette omits.
  tweenedPalette() {
    const base = this.params;
    if (!this.palFrom || !this.palTo || this.palMix >= 1) {
      const to = this.palTo ?? {};
      return { ...base, ...to };
    }
    const f = { ...base, ...this.palFrom };
    const g = { ...base, ...this.palTo };
    const t = this.palMix;
    return {
      ...base,
      warm: this.lerp3(f.warm, g.warm, t),
      cool: this.lerp3(f.cool, g.cool, t),
      red: this.lerp3(f.red, g.red, t),
      bg: this.lerp3(f.bg, g.bg, t),
      split: this.lerp(f.split, g.split, t),
      bloom: this.lerp(f.bloom, g.bloom, t),
      core: this.lerp(f.core, g.core, t),
      noise: this.lerp(f.noise, g.noise, t),
      spectral: this.lerp(f.spectral, g.spectral, t),
      // invert can't tween; switch it at the midpoint (when the glitch hides the pop)
      invert: t < 0.5 ? f.invert : g.invert
    };
  }
  onMove = (e) => {
    const r = this.canvas.getBoundingClientRect();
    this.tpx = (e.clientX - r.left) / r.width * 2 - 1;
    this.tpy = -((e.clientY - r.top) / r.height * 2 - 1);
    this.tActive = 1;
    this.wake();
  };
  onEnter = () => {
    this.tActive = 1;
    this.wake();
  };
  onLeave = () => {
    this.tActive = 0;
    this.tpx = 0;
    this.tpy = 0;
    this.wake();
  };
  wake() {
    if (this.awake && !this.running) this.start();
  }
  resize() {
    const r = this.host.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width;
    this.h = r.height;
    const cw = Math.max(1, Math.round(this.w * this.dpr));
    const ch = Math.max(1, Math.round(this.h * this.dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
      this.gl?.viewport(0, 0, cw, ch);
      this.allocLevels();
      this.scheduleBuild();
    } else if (this.levels.length === 0) {
      this.allocLevels();
    }
  }
  // cap the mask resolution so the (CPU) rasterize stays cheap; the bloom smooths it.
  maskSize() {
    const MAX_W = 1400;
    const mw = Math.max(2, Math.min(MAX_W, Math.round(this.w * this.dpr)));
    const mh = Math.max(2, Math.round(mw * (this.h / Math.max(1, this.w))));
    return [mw, mh];
  }
  scheduleBuild() {
    if (!this.gl || this.destroyed) return;
    const [mw, mh] = this.maskSize();
    if (mw === this.builtW && mh === this.builtH && this.params.word === this.builtWord && this.fontFamily === this.builtFont) return;
    if (this.buildScheduled) return;
    const run = () => {
      this.buildScheduled = 0;
      void this.buildMaskNow();
    };
    const ric = window.requestIdleCallback;
    this.buildScheduled = ric ? ric(run, { timeout: 200 }) : window.setTimeout(run, 0);
  }
  async buildMaskNow() {
    const gl = this.gl;
    if (!gl || this.destroyed) return;
    if (this.buildScheduled) {
      const cic = window.cancelIdleCallback;
      if (cic) cic(this.buildScheduled);
      else window.clearTimeout(this.buildScheduled);
      this.buildScheduled = 0;
    }
    const [mw, mh] = this.maskSize();
    this.builtW = mw;
    this.builtH = mh;
    this.builtWord = this.params.word;
    this.builtFont = this.fontFamily;
    const art = await makeWordMask(this.params.word, mw, mh, this.fontFamily);
    if (!this.gl || this.destroyed) return;
    if (!this.mask) this.mask = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.mask);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    this.maskW = art.width;
    this.maskH = art.height;
    if (!this.running) this.renderOnce();
  }
  start() {
    if (!this.ok) return;
    this.awake = true;
    if (this.running) return;
    this.running = true;
    this.resize();
    if (!this.startT) this.startT = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      this.frame(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  /** Stop and forbid waking (offscreen / hidden). */
  stop() {
    this.awake = false;
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  renderOnce() {
    if (this.raf) return;
    this.raf = requestAnimationFrame((t) => {
      this.raf = 0;
      this.render(t);
    });
  }
  frame(now) {
    const k = 0.08;
    this.px += (this.tpx - this.px) * k;
    this.py += (this.tpy - this.py) * k;
    this.active += (this.tActive - this.active) * 0.06;
    const t = (now - (this.startT || now)) / 1e3;
    const T = t * 3.2;
    const ax = 0.16 * Math.sin(T * 1.15) + 0.09 * Math.sin(T * 2.6 + 1) + 0.05 * Math.cos(T * 4.1 + 0.4);
    const ay = 0.13 * Math.cos(T * 0.95 + 2.1) + 0.07 * Math.sin(T * 2.2 + 0.5) + 0.04 * Math.cos(T * 3.7 + 1.7);
    this.fx += (ax - this.fx) * 0.2;
    this.fy += (ay - this.fy) * 0.2;
    if (this.cycle) {
      const dt = this.lastNow ? Math.min(0.05, (now - this.lastNow) / 1e3) : 1 / 60;
      this.stepCycle(dt);
    }
    this.lastNow = now;
    this.render(now);
  }
  // Advance the hero cycle clock with a real dt so it runs at steady wall-clock speed.
  // The transition is a DISPERSE & RE-FORM built from the effect's own bloom+split:
  //   HOLD  — the word rests (disperse = 0)
  //   OUT   — disperse rises: the split spreads wide, the core melts, the word blooms out
  //           into a soft coloured haze; palette crossfades halfway
  //   IN    — disperse falls: the new word condenses back out of the light as the split
  //           collapses; palette finishes. The word + invert swap at the OUT->IN peak,
  //           when it's a formless cloud, so the change is invisible.
  stepCycle(dt) {
    this.cyclePhaseT += dt;
    const easeIn = (x) => x * x;
    const easeOut = (x) => 1 - (1 - x) * (1 - x);
    if (this.cyclePhase === "hold") {
      this.disperse += (0 - this.disperse) * Math.min(1, dt * 12);
      if (this.cyclePhaseT >= this.holdDur) {
        this.palFrom = this.cyclePalettes[this.cycleIdx] ?? null;
        const nextIdx = (this.cycleIdx + 1) % this.cycleWords.length;
        this.palTo = this.cyclePalettes[nextIdx] ?? this.palFrom;
        this.palMix = 0;
        this.nextPending = true;
        this.cyclePhase = "out";
        this.cyclePhaseT = 0;
      }
    } else if (this.cyclePhase === "out") {
      const k = Math.min(1, this.cyclePhaseT / this.outDur);
      this.disperse = easeIn(k);
      this.palMix = 0.5 * k;
      if (k >= 1) {
        if (this.nextPending) {
          this.nextPending = false;
          this.cycleIdx = (this.cycleIdx + 1) % this.cycleWords.length;
          this.params = { ...this.params, word: this.cycleWords[this.cycleIdx] };
          void this.buildMaskNow();
        }
        this.cyclePhase = "in";
        this.cyclePhaseT = 0;
      }
    } else {
      const k = Math.min(1, this.cyclePhaseT / this.inDur);
      this.disperse = 1 - easeOut(k);
      this.palMix = 0.5 + 0.5 * k;
      if (k >= 1) {
        this.disperse = 0;
        this.palMix = 1;
        this.cyclePhase = "hold";
        this.cyclePhaseT = 0;
      }
    }
  }
  render(now) {
    const gl = this.gl;
    if (!gl || !this.compProg || !this.blurProg) return;
    if (!this.mask || this.levels.length === 0) return;
    const t = (now - this.startT) / 1e3;
    gl.useProgram(this.blurProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const aPos = gl.getAttribLocation(this.blurProg, "aPosition");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    for (let i = 0; i < this.levels.length; i++) {
      const lv = this.levels[i];
      const src = i === 0 ? this.mask : this.levels[i - 1].out.tex;
      const r = LEVELS[i].radius;
      gl.bindFramebuffer(gl.FRAMEBUFFER, lv.tmp.fb);
      gl.viewport(0, 0, lv.tmp.w, lv.tmp.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src);
      gl.uniform1i(this.blurLoc.uTex, 0);
      gl.uniform2f(this.blurLoc.uDir, r / lv.tmp.w, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, lv.out.fb);
      gl.viewport(0, 0, lv.out.w, lv.out.h);
      gl.bindTexture(gl.TEXTURE_2D, lv.tmp.tex);
      gl.uniform2f(this.blurLoc.uDir, 0, r / lv.out.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.compProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const aPos2 = gl.getAttribLocation(this.compProg, "aPosition");
    gl.enableVertexAttribArray(aPos2);
    gl.vertexAttribPointer(aPos2, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.mask);
    gl.uniform1i(this.compLoc.uMask, 0);
    for (let i = 0; i < 4; i++) {
      gl.activeTexture(gl.TEXTURE1 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.levels[i]?.out.tex ?? this.mask);
      gl.uniform1i(this.compLoc[`uB${i}`], 1 + i);
    }
    const p = this.cycle ? this.tweenedPalette() : this.params;
    const splitUv = p.split / 620;
    const sx = this.fx * 2.4 * splitUv;
    const sy = this.fy * 2.4 * splitUv;
    gl.uniform2f(this.compLoc.uSplit, sx, sy);
    gl.uniform2f(this.compLoc.uCursor, this.px * 0.5 + 0.5, this.py * 0.5 + 0.5);
    gl.uniform1f(this.compLoc.uCursorOn, this.active);
    gl.uniform1f(this.compLoc.uDisperse, this.disperse);
    const bloomPulse = p.bloom * (0.94 + 0.06 * Math.sin(t * 0.7));
    gl.uniform1f(this.compLoc.uBloom, bloomPulse);
    gl.uniform3f(this.compLoc.uWarm, p.warm[0], p.warm[1], p.warm[2]);
    gl.uniform3f(this.compLoc.uCool, p.cool[0], p.cool[1], p.cool[2]);
    gl.uniform3f(this.compLoc.uRed, p.red[0], p.red[1], p.red[2]);
    gl.uniform1f(this.compLoc.uCore, p.core);
    gl.uniform1f(this.compLoc.uSpectral, p.spectral);
    gl.uniform3f(this.compLoc.uBg, p.bg[0], p.bg[1], p.bg[2]);
    gl.uniform1f(this.compLoc.uInvert, p.invert ? 1 : 0);
    gl.uniform1f(this.compLoc.uNoise, p.noise);
    gl.uniform1f(this.compLoc.uTime, t);
    gl.uniform1f(this.compLoc.uAspect, this.w / Math.max(1, this.h));
    gl.uniform2f(this.compLoc.uResolution, this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!this.painted) {
      this.painted = true;
      this.canvas.style.opacity = "1";
    }
  }
  /** One static frame for reduced-motion. */
  renderStill() {
    this.resize();
    void this.buildMaskNow();
    this.startT = performance.now();
    this.render(performance.now());
  }
  destroy() {
    this.destroyed = true;
    if (this.buildScheduled) {
      const cic = window.cancelIdleCallback;
      if (cic) cic(this.buildScheduled);
      else window.clearTimeout(this.buildScheduled);
      this.buildScheduled = 0;
    }
    this.stop();
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerenter", this.onEnter);
    this.canvas.removeEventListener("pointerleave", this.onLeave);
    const gl = this.gl;
    if (gl) {
      this.freeLevels();
      if (this.mask) gl.deleteTexture(this.mask);
      if (this.quad) gl.deleteBuffer(this.quad);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.canvas.remove();
  }
};

// visuals/src/chroma/params.ts
var CHROMA_PRESETS = [
  {
    id: "peachsteel",
    name: "Peach / Steel",
    // soft PEACH vs. cool STEEL-BLUE, with a rose fringe, on a deep dusk-blue wall (a lifted
    // indigo, clearly a colour and not black). Editorial, unexpected — the default.
    params: { warm: [1, 0.66, 0.5], cool: [0.42, 0.6, 0.95], red: [1, 0.42, 0.6], split: 9, bloom: 1.62, core: 1.06, noise: 0.15, spectral: 0.6, bg: [0.11, 0.13, 0.2] }
  },
  {
    id: "chartviolet",
    name: "Chartreuse / Violet",
    // acid CHARTREUSE vs. deep VIOLET with an electric-blue fringe, on a rich PLUM wall
    // (clearly purple, not black) — a high-tension art-book combo, wide rainbow rim.
    params: { warm: [0.78, 0.95, 0.2], cool: [0.55, 0.3, 1], red: [0.3, 0.7, 1], split: 10.5, bloom: 1.52, core: 1.04, noise: 0.17, spectral: 0.85, bg: [0.15, 0.08, 0.19] }
  },
  {
    id: "pinkamber",
    name: "Hot Pink / Amber",
    // HOT PINK vs. warm AMBER (two warms held in tension by the split), gold fringe, on a
    // deep AUBERGINE wall (a lifted wine, reads as colour) — a neon-sign look that works.
    params: { warm: [1, 0.22, 0.62], cool: [1, 0.72, 0.24], red: [1, 0.5, 0.85], split: 8, bloom: 1.55, core: 1.05, noise: 0.16, spectral: 0.5, bg: [0.19, 0.08, 0.15] }
  },
  {
    id: "rustmint",
    name: "Rust / Mint",
    // burnt RUST vs. cool MINT with a teal fringe, on a deep PINE-GREEN wall (clearly green,
    // not black) — a muted, grown-up pairing (terracotta against seafoam), tight fringe.
    params: { warm: [0.92, 0.42, 0.22], cool: [0.5, 0.95, 0.78], red: [0.3, 0.85, 0.7], split: 7.5, bloom: 1.5, core: 1.02, noise: 0.13, spectral: 0.45, bg: [0.07, 0.16, 0.13] }
  },
  {
    id: "sandcobalt",
    name: "Sand / Cobalt",
    // LIGHT mode: warm SAND wall, dark word, a deep COBALT + rose split haze — a paper-and-
    // ink editorial feel with a cold shadow.
    params: { warm: [1, 0.55, 0.42], cool: [0.24, 0.36, 0.95], red: [0.95, 0.34, 0.5], split: 9, bloom: 1.5, core: 1, noise: 0.09, spectral: 0.6, bg: [0.95, 0.9, 0.8], invert: true }
  },
  {
    id: "blushsky",
    name: "Blush / Sky",
    // LIGHT mode: pale BLUSH wall, dark word, a SKY-BLUE + coral split haze — soft, airy,
    // a little vaporwave.
    params: { warm: [1, 0.44, 0.5], cool: [0.34, 0.72, 1], red: [0.6, 0.5, 1], split: 9.5, bloom: 1.52, core: 1, noise: 0.09, spectral: 0.7, bg: [0.97, 0.9, 0.92], invert: true }
  }
];
function defaultChromaParams() {
  return { ...CHROMA_DEFAULTS, ...CHROMA_PRESETS[0].params };
}
var HERO_CYCLE = [
  { word: "boom", params: CHROMA_PRESETS[0].params },
  // peach / steel
  { word: "poof", params: CHROMA_PRESETS[3].params },
  // rust / mint
  { word: "zap", params: CHROMA_PRESETS[1].params },
  // chartreuse / violet
  { word: "pow", params: CHROMA_PRESETS[2].params },
  // hot pink / amber
  { word: "yeet", params: CHROMA_PRESETS[5].params },
  // blush / sky (light)
  { word: "oof", params: CHROMA_PRESETS[4].params }
  // sand / cobalt (light)
];

// visuals/src/chroma/adapter.ts
var adapter_default = {
  async mount(host, props) {
    const params = {
      ...defaultChromaParams(),
      word: String(props.word ?? "financecrew"),
      ...typeof props.split === "number" && { split: props.split },
      ...typeof props.spectral === "number" && { spectral: props.spectral }
    };
    const engine = new ChromaGlow(host, params);
    if (!engine.ok) throw new Error("chroma: WebGL unavailable");
    engine.setFont("-apple-system, 'Helvetica Neue', Arial, sans-serif");
    const words = Array.isArray(props.words) ? props.words : null;
    if (words && words.length) {
      const darks = CHROMA_PRESETS.filter((p) => !p.params.invert);
      engine.enableCycle(words, words.map((_, i) => darks[i % darks.length].params));
    }
    return {
      start: () => engine.start(),
      destroy: () => engine.destroy()
    };
  }
};
export {
  adapter_default as default
};
