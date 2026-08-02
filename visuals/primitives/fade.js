// visuals/src/fade/shaders.ts
var FULL_VERT = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;
var TRAIL_FRAG = `
precision highp float;

varying vec2 vUv;

uniform sampler2D uMask;      // the word, white on transparent
uniform vec2  uResolution;    // drawing buffer size, px
uniform float uAspect;        // w/h

// trail
uniform float uEchoes;        // how many copies to accumulate
uniform float uStep;          // spacing between copies, px @ 620h
uniform float uAlpha;         // per-copy alpha
uniform vec2  uFall;          // trail direction (unit-ish)
uniform float uZStep;         // recession per copy

// magnetism: the trail bends toward the cursor as it falls, hard near the word
// and relaxing back to a straight fall further out.
uniform vec2  uMagnet;        // cursor in uv; only meaningful when uMagnetOn > 0
uniform float uMagnetOn;      // eased 0..1 presence
uniform float uSwing;         // how much the cursor twists the near copies (depth coupling)

// The five layers built on top of the raw accumulation. All of them are pure
// arithmetic inside the sampling loop that was already running \u2014 none adds a
// texture fetch, which is the only thing that costs real money in a fill-rate
// bound shader like this one.
uniform float uTurb;          // how much the tail wavers (px @ 620h)
uniform float uSpread;        // how much each copy widens as it falls
uniform float uEdge;          // brightness of the true leading edge
uniform float uFringe;        // per-channel ramp offset -> dispersion at the tail

// camera
uniform vec2  uAnchor;        // word centre in uv
uniform float uYaw;
uniform float uPitch;
uniform float uFocal;

// colour
uniform vec3  uTrailHead;     // hsl-ish resolved rgb at the word
uniform vec3  uTrailTail;     // resolved rgb at the tail
uniform vec3  uBleed;
uniform vec3  uHalo;
uniform vec3  uCore;
uniform vec3  uBg;
uniform vec3  uPoolA;
uniform vec3  uPoolB;
uniform float uPoolAlphaA;
uniform float uPoolAlphaB;
uniform vec3  uVignette;
uniform float uSubtract;      // 1.0 = ink on paper, 0.0 = light on dark
uniform float uSoft;          // strength of the two soft word layers
uniform float uNoise;
uniform float uTime;
uniform vec2  uHaloShift;
uniform vec2  uWordShift;     // the bleed/halo offset that sells directional light

// Sample the word mask at a point on the plane, z units back, with the glyph
// scaled up by grow (1.0 = its own size).
// Forward projection is  p' = anchor + rot(p) * focal/(focal+z)
// so to find which mask texel lands on THIS fragment we undo it.
float maskAt(vec2 uv, float z, float grow) {
  vec2 p = uv - uAnchor;
  p.x *= uAspect;                       // work in square space so the turn is even

  float s = (uFocal + z) / uFocal;      // inverse of the perspective divide
  p *= s;

  // Making the SAMPLED glyph bigger means shrinking the lookup toward the anchor.
  p /= max(0.001, grow);

  // undo the in-plane rotation (yaw about y, pitch about x). The forward pass
  // scales x by cos(yaw) and y by cos(pitch), so invert that.
  float cy = max(0.001, cos(uYaw));
  float cp = max(0.001, cos(uPitch));
  p.x /= cy;
  p.y /= cp;

  p.x /= uAspect;
  vec2 t = p + uAnchor;
  if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) return 0.0;
  return texture2D(uMask, t).a;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;

  // \u2500\u2500 the trail \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // March backward along the fall direction. Each step is one "copy": if the
  // word covers us at that offset, it contributes one more overlapping stamp.
  //
  // Rather than loop uEchoes times (a dynamic bound, illegal in GLSL ES 1.0,
  // and wasteful), we take a FIXED number of samples spread across the trail and
  // weight each by how many copies it stands in for. The accumulation law is
  // smooth in k, so sampling it coarsely and scaling the exponent is
  // indistinguishable from stamping every copy \u2014 and it is a constant cost.
  const int SAMPLES = 48;

  // One authored pixel, in uv. The params are written against a 620px-tall card,
  // so a step of 1.0 means one 620th of the height regardless of the real size \u2014
  // that is what keeps the copies overlapping (and the ramp smooth) at every
  // card size instead of combing apart on a tall one.
  float px = 1.0 / 620.0;
  vec2 fall = uFall * uStep * px;
  float perSample = uEchoes / float(SAMPLES); // copies each sample represents

  // Recession per copy, in the SAME uv units the perspective divide works in.
  // This is the one that has to be normalised: uZStep is authored per-copy in
  // card pixels, and feeding raw pixel counts into focal/(focal+z) drove z to
  // ~115 against a focal of 1.6, a ~70x divide that threw every sample far
  // outside the mask \u2014 so nothing was found and the trail vanished entirely.
  float zPer = uZStep * px;

  float dens = 0.0;   // accumulated coverage 0..1
  float ramp = 0.0;   // density-weighted position along the trail, for the hue
  float wsum = 0.0;
  // (A) The lowest copy index that covered this pixel. This is the real leading
  // edge of the exposure \u2014 the front face of the whole stack \u2014 and it is exact
  // rather than assumed, so it follows the trail wherever the bend and the
  // turbulence put it. The Canvas 2D version could only fake this by brightening
  // the first three copies, which pinned a rim to the word instead of to the
  // actual front of the trail.
  float firstHit = 1e9;

  for (int i = 1; i <= SAMPLES; i++) {
    float fi = float(i) * perSample;           // which copy index this is
    float t  = fi / max(1.0, uEchoes);         // 0 at the word, 1 at the tail

    vec2 off = fall * fi;

    // \u2500\u2500 magnetism \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // The trail bends toward the cursor instead of falling dead straight. The
    // pull grows along the trail (t*t), so the copies nearest the word stay put
    // and the far end swings \u2014 which is what makes it read as the trail being
    // ATTRACTED rather than the whole word being dragged. Squared so the bend is
    // a curve, not a kink.
    //
    // Free: the sample offset is already a vector, so this is one multiply-add
    // inside a loop that was going to run anyway. No extra texture fetches, which
    // is the only thing that actually costs anything in here.
    vec2 toCur = uMagnet - uAnchor;
    toCur.x *= uAspect;
    // Attraction falls off with distance, so a cursor parked in the far corner
    // relaxes the trail back to vertical instead of hauling it sideways forever.
    float grip = uMagnetOn / (1.0 + dot(toCur, toCur) * 5.0);
    off += toCur * (t * t * grip * 0.55);

    // \u2500\u2500 cursor-coupled depth \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // The recession already exists per copy; coupling it to the cursor makes the
    // near copies swing further than the far ones, so the stack shears in depth
    // and you get a genuine parallax read out of geometry that was already here.
    // (1-t) weights it toward the word end \u2014 the near copies are the ones a real
    // parallax would move most.
    float z = zPer * fi * (1.0 + uSwing * (1.0 - t));

    // \u2500\u2500 (C) turbulence \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // The tail wavers, the head stays crisp. Two sines at incommensurate rates
    // beating against each other, so it never reads as a clean oscillation.
    //
    // The important part is that the phase advances with fi: the displacement
    // differs from copy to copy, so the trail SNAKES along its length instead of
    // sliding sideways as a rigid shape. Weighted t*t so it is nothing at the
    // word and strongest at the far end, which is how smoke and hot air actually
    // behave \u2014 the disturbance has had further to travel.
    float wob = sin(fi * 0.105 + uTime * 1.25)
              * sin(fi * 0.037 - uTime * 0.71 + 2.1);
    off += vec2(wob, wob * 0.35) * (t * t * uTurb * px);

    // \u2500\u2500 (E) dissipation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // Each copy is sampled slightly larger than the last, so the trail opens up
    // as it falls rather than staying a constant-width ribbon. A long exposure of
    // something emitting light does spread, and it also softens the hard edges of
    // the tail without any blur \u2014 the widening copies overlap less exactly, which
    // is its own kind of falloff.
    float grow = 1.0 + t * uSpread;

    float m = maskAt(uv - off, z, grow);
    if (m > 0.0) {
      // coverage contributed by perSample overlapping copies at uAlpha
      float k = 1.0 - pow(1.0 - uAlpha * m, perSample);
      // composite this band OVER what we already have (same as stacking stamps)
      dens += k * (1.0 - dens);
      ramp += t * k;   // t is this copy's position along the trail
      wsum += k;
      firstHit = min(firstHit, fi);   // (A)
    }
  }
  float q = wsum > 0.0 ? ramp / wsum : 0.0;    // mean position along the ramp

  // (A) The leading edge, from the real first-hit index. Decays fast, so it is a
  // thin bright rim on the front of the exposure rather than a general lift of
  // the head \u2014 which is what gives the trail a defined front instead of just
  // fading in from nothing.
  float edge = firstHit < 1.0e8 ? exp(-firstHit * 0.085) * uEdge : 0.0;

  // \u2500\u2500 the word itself, three layers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Sampled at z = 0, on the plane. The two soft layers are nudged AWAY from the
  // pointer so the light reads as directional; the core never moves. Now that
  // maskAt takes a scale, the wide layers ask for a genuinely larger glyph rather
  // than faking size with a second offset sample.
  float bleed = maskAt(uv - uWordShift, 0.0, 1.055);
  float halo  = maskAt(uv - uWordShift * 0.45, 0.0, 1.018);
  float core  = maskAt(uv, 0.0, 1.0);

  // \u2500\u2500 the atmosphere pool \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  vec2 pc = uv - uAnchor - uHaloShift;
  pc.x *= uAspect;
  float pd = length(pc) / 0.52;
  float pool = 1.0 - clamp(pd, 0.0, 1.0);
  pool *= pool;

  // \u2500\u2500 compose \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // (B) Chromatic fringe. Each channel reads the ramp at a slightly different
  // position, as if the three wavelengths had been exposed for slightly different
  // lengths of trail. Red trails a touch behind and blue runs a touch ahead, so
  // the tail separates into colour exactly where the density is thinnest and the
  // separation is visible \u2014 and the dense head stays neutral, because there the
  // ramp is flat and all three land in the same place.
  //
  // Three mixes on values already in registers. The Canvas 2D version bought the
  // same idea with a second ~190-blit pass over the whole trail.
  float qr = clamp(q + uFringe, 0.0, 1.0);
  float qb = clamp(q - uFringe, 0.0, 1.0);
  vec3 trailCol = vec3(
    mix(uTrailHead.r, uTrailTail.r, qr),
    mix(uTrailHead.g, uTrailTail.g, q),
    mix(uTrailHead.b, uTrailTail.b, qb)
  );
  // \u2500\u2500 both composites, then blended \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // uSubtract is CONTINUOUS, not a boolean, and that is the whole point.
  //
  // The presets alternate dark and light, so nearly every crossfade crosses from
  // additive to subtractive. Branching on uSubtract > 0.5 meant the compositing
  // mode SNAPPED at the midpoint of every transition \u2014 and the midpoint is the
  // worst possible moment for it, because the background is then a mid-grey where
  // neither mode looks right. That snap, plus the washed-out middle it sat in, is
  // what made the colour change read as broken rather than as a wash.
  //
  // Evaluating both and mixing costs a handful of ALU ops on values already in
  // registers (no extra texture fetches), and in exchange every frame of the
  // transition is a valid image. uSoft and the trail alpha can now ride the same
  // continuous mix instead of jumping with the mode.
  vec3 add = uBg;
  add += uPoolA * pool * uPoolAlphaA;
  add += uPoolB * pool * uPoolAlphaB;
  add += trailCol * dens;
  // (A) the leading edge, lifted toward the core colour so the front of the
  // exposure reads as the hottest part of the light.
  add += mix(trailCol, uCore, 0.5) * edge * dens;
  add += uBleed * bleed * 0.16 * uSoft;
  add += uHalo  * halo  * 0.32 * uSoft;
  add += uCore  * core  * 0.95;

  // INK ON PAPER. Adding light to near-white blows straight out and the trail
  // vanishes, so the same accumulation has to subtract instead \u2014 density of
  // pigment, not emission. Multiply is what keeps the ramp readable.
  vec3 sub = uBg;
  sub = mix(sub, sub * uPoolA, pool * uPoolAlphaA);
  sub = mix(sub, sub * uPoolB, pool * uPoolAlphaB);
  sub *= mix(vec3(1.0), trailCol, dens);
  // (A) on paper the leading edge is the DENSEST ink, not the brightest light \u2014
  // the front of the stroke where the pigment pooled.
  sub *= mix(vec3(1.0), trailCol, edge * dens * 0.5);
  sub *= mix(vec3(1.0), uBleed, bleed * 0.16 * uSoft);
  sub *= mix(vec3(1.0), uHalo,  halo  * 0.32 * uSoft);
  sub *= mix(vec3(1.0), uCore,  core  * 0.95);

  vec3 col = mix(add, sub, uSubtract);

  // \u2500\u2500 vignette \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  vec2 vc = uv - vec2(0.5, 0.45);
  vc.x *= uAspect;
  float vd = clamp((length(vc) - 0.16) / 0.56, 0.0, 1.0);
  col *= mix(vec3(1.0), uVignette, vd);

  // \u2500\u2500 (D) grain \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Wide soft gradients band badly in 8-bit, so some dither is non-negotiable.
  // But a FLAT layer of it reads as a dirty screen sitting in front of the image.
  // Real film grain lives in the emulsion: it is strongest where the exposure
  // actually happened and nearly absent in untouched shadow. Weighting it by the
  // trail's own density is what turns the dither into part of the photograph \u2014
  // the trail comes out looking exposed rather than drawn.
  //
  // A floor keeps just enough everywhere to kill banding in the pool + vignette.
  // The sign rides uSubtract continuously (grain LIFTS out of shadow on a dark
  // ground, DARKENS on paper) so it passes through zero mid-transition instead of
  // inverting in one frame.
  float n = hash(gl_FragCoord.xy + vec2(uTime * 60.0)) - 0.5;
  float grainAmt = uNoise * (0.35 + 1.5 * max(dens, core));
  col += n * grainAmt * mix(1.0, -1.0, uSubtract);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

// visuals/src/fade/text-mask.ts
var ANCHOR_Y = 0.42;
function makeWordMask(word, w, h, fontFamily) {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  const text = (word || "").trim();
  if (!text) return out;
  let size = H * 0.34;
  ctx.font = `400 ${size}px ${fontFamily}`;
  const maxW = W * 0.72;
  const measured = ctx.measureText(text).width;
  if (measured > maxW) {
    size *= maxW / measured;
    ctx.font = `400 ${size}px ${fontFamily}`;
  }
  const m = ctx.measureText(text);
  const asc = m.actualBoundingBoxAscent || size * 0.75;
  const desc = m.actualBoundingBoxDescent || size * 0.25;
  const inkMid = (asc - desc) / 2;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, W / 2, H * ANCHOR_Y + inkMid);
  return out;
}
function measureWord(word, fontFamily) {
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return 0;
  probe.font = `400 100px ${fontFamily}`;
  return Math.round(probe.measureText(word).width);
}

// visuals/src/fade/engine.ts
var DEFAULTS = {
  // Many copies at a near-1px step. Spacing them further apart makes each copy
  // land clear of the last, which reads as stacked ghosts rather than one
  // continuous ramp — the accumulation only works when they overlap heavily.
  echoes: 210,
  step: 1,
  alpha: 0.019,
  angle: Math.PI / 2,
  // straight down
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
  fringe: 0.045
};
var WORD = "motion";
function setFadeWord(w) {
  WORD = w;
}
var PALETTES = [
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
    alphaScale: 1
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
    alphaScale: 0.42
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
    alphaScale: 1
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
    alphaScale: 0.42
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
    alphaScale: 1
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
    alphaScale: 0.42
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
    alphaScale: 1
  }
];
var FADE_SECONDS = 0.34;
var FOCAL = 1.6;
var LEAN_X_MAX = 0.21;
var LEAN_Y_MAX = 0.12;
var HALO_TRACK_X = 0.07;
var HALO_TRACK_Y = 0.08;
var PIXEL_FONT = "var(--font-mondwest)";
function resolveFamily(cssFamily) {
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden";
  probe.style.fontFamily = cssFamily;
  document.body.appendChild(probe);
  const fam = getComputedStyle(probe).fontFamily || "sans-serif";
  probe.remove();
  return fam;
}
function pixelFontSpec() {
  return `400 100px ${resolveFamily(PIXEL_FONT)}`;
}
function hslToRgb(h, s, l) {
  h = (h % 360 + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}
function parseColor(c) {
  const s = c.trim();
  if (s.startsWith("#")) {
    let h = s.slice(1);
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    return {
      rgb: [
        parseInt(h.slice(0, 2), 16) / 255,
        parseInt(h.slice(2, 4), 16) / 255,
        parseInt(h.slice(4, 6), 16) / 255
      ],
      a: 1
    };
  }
  const hsl = s.match(/^hsl\(\s*([-\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/);
  if (hsl) {
    return { rgb: hslToRgb(+hsl[1], +hsl[2], +hsl[3]), a: 1 };
  }
  const rgba = s.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/
  );
  if (rgba) {
    return {
      rgb: [+rgba[1] / 255, +rgba[2] / 255, +rgba[3] / 255],
      a: rgba[4] !== void 0 ? +rgba[4] : 1
    };
  }
  return { rgb: [1, 1, 1], a: 1 };
}
var resolvedCache = /* @__PURE__ */ new Map();
function resolve(pal, hueTravel) {
  const key = `${pal.name}|${hueTravel.toFixed(2)}`;
  const hit = resolvedCache.get(key);
  if (hit) return hit;
  const T = pal.trail;
  const pa = parseColor(pal.pool[0]);
  const pb = parseColor(pal.pool[1]);
  const out = {
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
    alphaScale: pal.alphaScale
  };
  resolvedCache.set(key, out);
  return out;
}
var lerp = (a, b, t) => a + (b - a) * t;
var lerp3 = (a, b, t) => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t)
];
function blend(a, b, t) {
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
    vignette: lerp3(a.vignette, b.vignette, t)
  };
}
var UNIFORMS = [
  "uMask",
  "uResolution",
  "uAspect",
  "uEchoes",
  "uStep",
  "uAlpha",
  "uFall",
  "uZStep",
  "uMagnet",
  "uMagnetOn",
  "uSwing",
  "uTurb",
  "uSpread",
  "uEdge",
  "uFringe",
  "uAnchor",
  "uYaw",
  "uPitch",
  "uFocal",
  "uTrailHead",
  "uTrailTail",
  "uBleed",
  "uHalo",
  "uCore",
  "uBg",
  "uPoolA",
  "uPoolB",
  "uPoolAlphaA",
  "uPoolAlphaB",
  "uVignette",
  "uSubtract",
  "uSoft",
  "uNoise",
  "uTime",
  "uHaloShift",
  "uWordShift"
];
var FadeMotion = class {
  host;
  canvas;
  gl = null;
  prog = null;
  quad = null;
  loc = {};
  mask = null;
  params = { ...DEFAULTS };
  /** which preset is showing; remix advances it */
  paletteIdx = 0;
  /** The preset being crossfaded FROM, and how far through (1 = settled). */
  fadeFrom = 0;
  fadeMix = 1;
  // ── hero mode ───────────────────────────────────────────────────────────
  // Off by default. The playground stays a single static preset driven by a real
  // cursor; only the hero card runs itself.
  hero = false;
  /** seconds until the next palette change */
  cycleT = 0;
  /** The fake cursor. Hero mode drives `ptr` from this, so every reaction the
   *  real pointer triggers — the turn, the reach, the magnetism, the depth swing
   *  — comes along for free rather than being re-implemented. */
  ghostX = 0.5;
  ghostY = ANCHOR_Y;
  /** True only for a REAL pointer. The ghost writes `ptr` so it reuses the whole
   *  reaction chain, which means `ptr` alone can no longer answer "is someone
   *  actually hovering" — and without this distinction the ghost would latch
   *  `ptr` on forever and the release-to-drift behaviour would never fire again. */
  realPtr = false;
  /** eased pointer lean */
  leanX = 0;
  leanY = 0;
  leanTargetX = 0;
  leanTargetY = 0;
  /** `near` is 1 at the word and 0 at the far corner. Drives trail LENGTH. */
  near = 0;
  nearTarget = 0;
  /** Live pointer position in 0..1, or null. Held so the per-frame step can
   *  recompute targets without needing a fresh event — a hand held still fires no
   *  pointermove at all, and the old code only ever updated on an event. */
  ptr = null;
  /** Eased cursor position the magnetism pulls toward, and its eased presence.
   *  Followed rather than used raw: the bend arriving a beat after your hand is
   *  what makes the trail feel like it has mass being pulled, instead of a shape
   *  welded to the cursor. Presence fades so leaving relaxes the curve out rather
   *  than dropping it. */
  magX = 0.5;
  magY = ANCHOR_Y;
  magOn = 0;
  /** 0 = fully pointer-driven, 1 = fully autonomous. Eased, never switched. */
  idleMix = 1;
  /** measured width of WORD at 100px, to detect a real font swap */
  lastFontWidth = 0;
  /** Drift clock, in seconds. Only advances while the drift is being mixed in, so
   *  the word cannot crawl away from a held-still cursor. */
  t = 0;
  /** Wall clock, in seconds. ALWAYS advances. Anything that should keep living
   *  while you hover — the grain, the trail's turbulence — has to run off this,
   *  not off the drift clock: `t` is frozen under a hover by design, and driving
   *  the grain from it meant the film stopped moving the instant you touched the
   *  card. Two clocks because they answer two different questions. */
  tReal = 0;
  raf = 0;
  last = 0;
  running = false;
  dpr = 1;
  ro = null;
  disposed = false;
  fontFamily = "sans-serif";
  // mask rebuild guards
  builtW = 0;
  builtH = 0;
  builtFont = "";
  constructor(host, fontFamily) {
    this.host = host;
    this.fontFamily = fontFamily ?? resolveFamily(PIXEL_FONT);
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "display:block;width:100%;height:100%";
    host.appendChild(this.canvas);
    const gl = this.canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false
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
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
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
  /** Rasterize the word and upload it. The only CPU work in the effect, and it
   *  runs once per size/font rather than per frame. */
  buildMask() {
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
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }
  resize() {
    const gl = this.gl;
    if (!gl || this.disposed) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
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
  setParams(p) {
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
    this.builtFont = "";
    this.buildMask();
    if (!this.running) this.draw(0);
  }
  /** Pointer in 0..1 relative to the host; null releases it to the idle drift. */
  setPointer(p) {
    if (!p) {
      this.ptr = null;
      this.realPtr = false;
      return;
    }
    this.ptr = { x: p.x, y: p.y };
    this.realPtr = true;
    this.applyPointerTargets();
  }
  /** Derive the lean + reach targets from the live pointer position. */
  applyPointerTargets() {
    const p = this.ptr;
    if (!p) return;
    this.leanTargetX = (p.x - 0.5) * 0.42;
    this.leanTargetY = (p.y - 0.5) * 0.24;
    const dx = p.x - 0.5;
    const dy = p.y - ANCHOR_Y;
    this.nearTarget = 1 - Math.min(1, Math.hypot(dx, dy) / 0.62);
  }
  /** Remix: crossfade to the next colour preset. */
  next() {
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
  cyclePeriod = 2;
  get palette() {
    return PALETTES[this.paletteIdx % PALETTES.length];
  }
  /** The background currently on screen, as a CSS rgb() string, blend included.
   *  Lets the host element track the canvas so the card's frame and its art change
   *  together — otherwise the box stays one fixed grey while the picture inside it
   *  recolours, and the two visibly disagree during every transition. */
  get bgCss() {
    const c = this.lastBg;
    return `rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)})`;
  }
  lastBg = [0, 0, 0];
  /** Called with the live background each frame; the card subscribes to restyle. */
  onBg = null;
  step(dt) {
    if (this.hero && !this.realPtr) {
      const g = this.tReal;
      const gx = 0.55 * Math.sin(g * 2.3) + 0.3 * Math.sin(g * 3.7 + 1.1) + 0.15 * Math.sin(g * 6.1 + 0.4);
      const gy = 0.55 * Math.cos(g * 1.9 + 2.1) + 0.3 * Math.sin(g * 4.3 + 0.5) + 0.15 * Math.cos(g * 7.3 + 1.7);
      this.ghostX = 0.5 + gx * 0.2;
      this.ghostY = ANCHOR_Y + gy * 0.13;
      this.ptr = { x: this.ghostX, y: this.ghostY };
      this.applyPointerTargets();
    }
    const hasPointer = !!this.ptr;
    const mixTarget = hasPointer ? 0 : 1;
    const mixRate = hasPointer ? 26 : 0.7;
    this.idleMix += (mixTarget - this.idleMix) * Math.min(1, dt * mixRate);
    if (hasPointer && this.idleMix < 2e-3) this.idleMix = 0;
    this.t += dt * this.idleMix;
    this.tReal += dt;
    this.applyPointerTargets();
    const m = this.idleMix;
    const driftX = Math.sin(this.t * 0.23) * 0.13;
    const driftY = Math.sin(this.t * 0.31 + 1.7) * 0.07;
    const driftN = 0.22 + Math.sin(this.t * 0.17) * 0.1;
    const tx = this.leanTargetX * (1 - m) + driftX * m;
    const ty = this.leanTargetY * (1 - m) + driftY * m;
    const tn = this.nearTarget * (1 - m) + driftN * m;
    const ease = (rate) => 1 - Math.exp(-rate * dt);
    const k = ease(hasPointer ? 16 : 2.2);
    this.leanX += (tx - this.leanX) * k;
    this.leanY += (ty - this.leanY) * k;
    this.near += (tn - this.near) * ease(hasPointer ? 12 : 1.8);
    this.leanX = Math.max(-LEAN_X_MAX, Math.min(LEAN_X_MAX, this.leanX));
    this.leanY = Math.max(-LEAN_Y_MAX, Math.min(LEAN_Y_MAX, this.leanY));
    const mk = ease(7);
    if (this.ptr) {
      this.magX += (this.ptr.x - this.magX) * mk;
      this.magY += (this.ptr.y - this.magY) * mk;
    }
    this.magOn += ((this.ptr ? 1 : 0) - this.magOn) * ease(this.ptr ? 9 : 2.4);
    if (this.fadeMix < 1) {
      this.fadeMix = Math.min(1, this.fadeMix + dt / FADE_SECONDS);
    }
    if (this.hero && this.fadeMix >= 1) {
      this.cycleT -= dt;
      if (this.cycleT <= 0) {
        this.cycleT = this.cyclePeriod;
        this.next();
      }
    }
  }
  draw(dt) {
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
    const hueOf = (p) => p.trail.dHue * (P.hueShift / 26);
    const to = PALETTES[this.paletteIdx % PALETTES.length];
    const pal = this.fadeMix >= 1 ? resolve(to, hueOf(to)) : (() => {
      const from = PALETTES[this.fadeFrom % PALETTES.length];
      const m = this.fadeMix;
      const eased = m * m * (3 - 2 * m);
      return blend(
        resolve(from, hueOf(from)),
        resolve(to, hueOf(to)),
        eased
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
    gl.uniform1f(this.loc.uYaw, -this.leanX * 0.2);
    gl.uniform1f(this.loc.uPitch, -this.leanY * 0.12);
    gl.uniform1f(this.loc.uFocal, FOCAL);
    gl.uniform2f(
      this.loc.uAnchor,
      0.5 + this.leanX * 0.05,
      // uv is bottom-up in the shader; the mask was uploaded flipped to match.
      1 - (ANCHOR_Y + this.leanY * 0.05)
    );
    gl.uniform2f(
      this.loc.uFall,
      Math.cos(P.angle),
      -Math.sin(P.angle)
    );
    gl.uniform1f(this.loc.uStep, P.step);
    gl.uniform1f(this.loc.uZStep, 0.55 * P.step);
    gl.uniform1f(this.loc.uAlpha, P.alpha * pal.alphaScale);
    gl.uniform2f(this.loc.uMagnet, this.magX, 1 - this.magY);
    gl.uniform1f(this.loc.uMagnetOn, this.magOn);
    gl.uniform1f(this.loc.uSwing, this.leanX * 2.2);
    gl.uniform1f(this.loc.uTurb, P.turbulence * (1 + this.magOn * 0.35));
    gl.uniform1f(this.loc.uSpread, P.spread);
    gl.uniform1f(this.loc.uEdge, P.edge);
    gl.uniform1f(this.loc.uFringe, P.fringe);
    const reach = 1.15 - this.near * 0.6;
    gl.uniform1f(this.loc.uEchoes, Math.max(1, P.echoes * reach));
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
    if (pal.bg[0] !== this.lastBg[0] || pal.bg[1] !== this.lastBg[1] || pal.bg[2] !== this.lastBg[2]) {
      this.lastBg = [pal.bg[0], pal.bg[1], pal.bg[2]];
      this.onBg?.(this.bgCss);
    }
    gl.uniform1f(this.loc.uSubtract, pal.subtract);
    gl.uniform1f(this.loc.uSoft, lerp(1, 0.35, pal.subtract));
    gl.uniform1f(this.loc.uNoise, lerp(0.02, 0.012, pal.subtract));
    gl.uniform1f(this.loc.uTime, this.tReal);
    gl.uniform1f(this.loc.uAspect, aspect);
    gl.uniform2f(this.loc.uResolution, W, H);
    gl.uniform2f(
      this.loc.uHaloShift,
      this.leanX * HALO_TRACK_X,
      -this.leanY * HALO_TRACK_Y
    );
    gl.uniform2f(
      this.loc.uWordShift,
      -this.leanX * 6e-3,
      this.leanY * 6e-3
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
    const tick = (now) => {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1e3, 1 / 30);
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
};

// visuals/src/fade/adapter.ts
var adapter_default = {
  async mount(host, props) {
    setFadeWord(String(props.word ?? "financecrew"));
    const engine = new FadeMotion(host);
    if (!engine.ok) throw new Error("fade: WebGL unavailable");
    engine.enableHero(Number(props.cyclePeriod ?? 2.4));
    engine.onBg = (css) => {
      host.style.backgroundColor = css;
    };
    if (document.fonts?.load) {
      try {
        await document.fonts.load(pixelFontSpec());
      } catch {
      }
      engine.refreshFonts();
    }
    return {
      start: () => engine.start(),
      action: async (name) => {
        if (name === "next") engine.next();
      },
      destroy: () => engine.destroy()
    };
  }
};
export {
  adapter_default as default
};
