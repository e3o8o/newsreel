// src/chrome/shaders.ts
var CHROME_VERT = `
attribute vec2 aPosition;
attribute vec2 aUV;
varying vec2 vUV;
void main() {
  vUV = aUV;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;
var CHROME_FRAG = `
precision highp float;

varying vec2 vUV;

uniform sampler2D uField;
uniform vec2  uTexel;
uniform vec2  uTilt;
uniform float uAspect;
uniform float uTime;

uniform vec3  uS0;
uniform vec3  uS1;
uniform vec3  uS2;
uniform vec3  uS3;
uniform vec3  uS4;
uniform vec3  uSpark;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
  vec2 u = f*f*(3.-2.*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

float heightAt(vec2 uv){
  vec4 f = texture2D(uField, uv);
  return f.g + f.b * 0.18;
}

vec3 ramp(float t){
  t = clamp(t, 0.0, 1.0);
  float x = t * 4.0;
  vec3 col = uS0;
  col = mix(col, uS1, smoothstep(0.0, 1.0, clamp(x - 0.0, 0.0, 1.0)));
  col = mix(col, uS2, smoothstep(0.0, 1.0, clamp(x - 1.0, 0.0, 1.0)));
  col = mix(col, uS3, smoothstep(0.0, 1.0, clamp(x - 2.0, 0.0, 1.0)));
  col = mix(col, uS4, smoothstep(0.0, 1.0, clamp(x - 3.0, 0.0, 1.0)));
  return col;
}

float envT(vec2 env){
  float t = clamp(0.5 - env.y * 0.9, 0.0, 1.0);
  t = t + (t - 0.5) * 0.35 * (1.0 - abs(env.x));
  return clamp(t, 0.0, 1.0);
}

vec3 toneMap(vec3 c){
  return c / (c + vec3(0.85)) * 1.85;
}

float fbm(vec2 p){
  return noise(p) * 0.6 + noise(p * 2.1 + 4.0) * 0.3 + noise(p * 4.3 + 9.0) * 0.1;
}

vec3 background(vec2 uv){
  vec2 p = uv * vec2(uAspect, 1.0);
  float t = uTime * 0.08;

  float f1 = fbm(p * 1.4 + vec2(t, -t * 0.7));
  float f2 = fbm(p * 1.9 + vec2(-t * 0.8, t) + f1);

  vec3 poolA = uS0   * 0.16;
  vec3 poolB = uS3   * 0.5;
  vec3 poolC = uSpark* 0.1;
  vec3 col = uS4 * 0.04 + vec3(0.015);
  col = mix(col, poolA, smoothstep(0.35, 0.75, f1));
  col = mix(col, poolB, smoothstep(0.4, 0.85, f2));
  col = mix(col, poolC, smoothstep(0.6, 0.95, f1 * f2 * 1.6));

  vec2 c = (uv - vec2(0.5, 0.44)) * vec2(uAspect, 1.0);
  float radial = 1.0 - smoothstep(0.0, 0.95, length(c));
  col += (uS0 * 0.08 + vec3(0.02)) * radial;

  vec3 studioTint = mix(uS0, uS1, 0.4);

  float horizon = 1.0 - smoothstep(0.0, 0.16, abs(uv.y - 0.30));
  col += studioTint * 0.09 * horizon * 0.6;

  float ray = uv.x * uAspect * 0.5 + uv.y - fract(uTime * 0.03) * 2.0;
  col += studioTint * 0.07 * (1.0 - smoothstep(0.0, 0.22, abs(ray - 0.4))) * 0.5 * radial;

  float temp = clamp((uv.x - uv.y) * 0.5 + 0.5, 0.0, 1.0);
  col += mix(uS0 * 0.03, uSpark * 0.03, temp) * radial;

  col *= mix(0.45, 1.0, radial);

  col += (noise(p * 320.0) - 0.5) * 0.012;
  return col;
}

void main() {
  vec2 uv = vUV;

  vec2 wuv = uv - uTilt * 0.012;

  float crisp = texture2D(uField, wuv).r;
  float height = heightAt(wuv);

  vec3 bg = background(uv);

  float shadow = 0.0;
  shadow += texture2D(uField, wuv - vec2(0.004, 0.03)).g * 0.5;
  shadow += texture2D(uField, wuv - vec2(0.006, 0.055)).g * 0.3;
  shadow += texture2D(uField, wuv - vec2(0.008, 0.085)).g * 0.2;
  bg *= 1.0 - clamp(shadow, 0.0, 1.0) * 0.6;

  if (height < 0.01) {
    gl_FragColor = vec4(bg, 1.0);
    return;
  }

  float g1 = 1.6, g2 = 3.4;

  float aL = heightAt(wuv - vec2(g1,0.)*uTexel), aR = heightAt(wuv + vec2(g1,0.)*uTexel);
  float aD = heightAt(wuv - vec2(0.,g1)*uTexel), aU = heightAt(wuv + vec2(0.,g1)*uTexel);

  float bL = heightAt(wuv - vec2(g2,0.)*uTexel), bR = heightAt(wuv + vec2(g2,0.)*uTexel);
  float bD = heightAt(wuv - vec2(0.,g2)*uTexel), bU = heightAt(wuv + vec2(0.,g2)*uTexel);
  vec2 slope = (vec2(aR - aL, aU - aD) * 0.6 + vec2(bR - bL, bU - bD) * 0.4) * 22.0;
  vec3 N = normalize(vec3(-slope.x, -slope.y, 1.0));

  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 R = reflect(-V, N);

  float tt = uTime;
  vec2 fp = uv * vec2(uAspect, 1.0) * 1.6;
  vec2 flow = vec2(
    fbm(fp + vec2(tt * 0.25, height * 3.0)) - 0.5,
    fbm(fp + vec2(-tt * 0.2 + 5.0, tt * 0.15)) - 0.5
  ) * 0.55;
  flow += vec2(sin(tt * 0.31) * 0.1, cos(tt * 0.24) * 0.08);
  vec2 env = R.xy + uTilt + flow;

  vec3 sharpRefl = ramp(envT(env));
  vec3 blurRefl = vec3(0.0);
  const int NB = 6;
  for (int i = 0; i < NB; i++) {
    float a = float(i) / float(NB) * 6.2831853;
    vec2 j = vec2(cos(a), sin(a)) * 0.14;
    blurRefl += ramp(envT(env + j));
  }
  blurRefl /= float(NB);

  float rough = 0.4 + 0.25 * clamp(length(slope), 0.0, 1.0);
  vec3 metal = mix(sharpRefl, blurRefl, rough);

  float tMid = envT(env);
  vec3 envColor = background(clamp(uv + env * 0.35, 0.0, 1.0));
  float envMix = (1.0 - abs(tMid - 0.5) * 2.0) * 0.3;
  metal = mix(metal, metal + envColor * 2.0, envMix);

  float streak = smoothstep(0.35, 0.5, abs(env.x + sin(env.y*3.0)*0.1));
  metal += (1.0 - streak) * 0.1 * uS1;

  float fres = pow(1.0 - N.z, 2.2);
  metal += fres * uS1 * 0.45;

  vec3 keyDir = normalize(vec3(cos(tt * 0.22) * 0.7, 0.5 + sin(tt * 0.18) * 0.3, 0.9));
  vec3 Hh = normalize(keyDir + V);

  vec3 Na = normalize(vec3(N.x * 0.6, N.y, N.z));
  float ndh = max(dot(Na, Hh), 0.0);
  float spec = pow(ndh, 120.0);
  metal += spec * uSpark * 1.3;

  metal += pow(max(dot(N, Hh), 0.0), 16.0) * uS1 * 0.25;

  float sweepPos = fract(uTime * 0.16);
  float diag = (uv.x * uAspect + (1.0 - uv.y)) * 0.42;
  float band = 1.0 - smoothstep(0.0, 0.06, abs(diag - sweepPos * 1.4 + 0.2));
  float facing = clamp(N.x * -0.6 + N.y * 0.6 + 0.4, 0.0, 1.0);
  metal += band * facing * uSpark * 0.5;

  float curv = length(slope);
  float bright = smoothstep(0.62, 1.0, tMid) * smoothstep(0.4, 1.2, curv);
  float tw = 0.5 + 0.5 * sin(uTime * 2.0 + height * 40.0 + uv.x * 30.0);
  metal += bright * tw * tw * uSpark * 1.1;

  float ao = smoothstep(0.15, 0.7, texture2D(uField, wuv).g);
  metal *= 0.7 + ao * 0.3;

  float face = smoothstep(0.3, 0.55, crisp);
  metal *= 0.86 + face * 0.14;

  metal += (noise(uv * vec2(uAspect,1.0) * 520.0) - 0.5) * 0.035;

  vec3 c = toneMap(metal);

  c += (hash(uv * 1024.0 + fract(uTime)) - 0.5) * (1.5 / 255.0);
  c = clamp(c, 0.0, 1.0);

  float aa = smoothstep(0.16, 0.4, height);
  gl_FragColor = vec4(mix(bg, c, aa), 1.0);
}
`;

// src/chrome/params.ts
var RAMPS = [
  {
    name: "Silver Teal",
    stops: [
      [0.62, 0.78, 0.85],
      [0.98, 1, 1],
      [0.03, 0.06, 0.08],
      [0.1, 0.34, 0.4],
      [0.5, 0.72, 0.78]
    ],
    spark: [0.85, 0.97, 1]
  },
  {
    name: "Gold",
    stops: [
      [0.95, 0.82, 0.4],
      [1, 0.98, 0.85],
      [0.14, 0.08, 0],
      [0.6, 0.4, 0.05],
      [0.9, 0.72, 0.3]
    ],
    spark: [1, 0.95, 0.7]
  },
  {
    name: "Iridescent",
    stops: [
      [0.55, 0.5, 0.95],
      [0.95, 0.85, 1],
      [0.04, 0.02, 0.1],
      [0.9, 0.3, 0.6],
      [0.3, 0.8, 0.85]
    ],
    spark: [1, 0.9, 1]
  },
  {
    name: "Rose Gold",
    stops: [
      [0.95, 0.72, 0.68],
      [1, 0.92, 0.9],
      [0.12, 0.04, 0.05],
      [0.72, 0.34, 0.32],
      [0.9, 0.6, 0.56]
    ],
    spark: [1, 0.9, 0.88]
  },
  {
    name: "Gunmetal",
    stops: [
      [0.52, 0.56, 0.62],
      [0.9, 0.93, 0.98],
      [0.02, 0.03, 0.04],
      [0.16, 0.2, 0.26],
      [0.42, 0.47, 0.53]
    ],
    spark: [0.85, 0.9, 1]
  },
  {
    name: "Toxic",
    stops: [
      [0.55, 0.9, 0.3],
      [0.95, 1, 0.85],
      [0.02, 0.08, 0.02],
      [0.2, 0.5, 0.08],
      [0.45, 0.82, 0.35]
    ],
    spark: [0.9, 1, 0.75]
  },
  {
    name: "Molten",
    stops: [
      [1, 0.55, 0.2],
      [1, 0.92, 0.6],
      [0.12, 0.01, 0],
      [0.55, 0.1, 0.04],
      [0.9, 0.42, 0.16]
    ],
    spark: [1, 0.85, 0.5]
  },
  {
    name: "Sapphire",
    stops: [
      [0.35, 0.55, 0.98],
      [0.85, 0.95, 1],
      [0.01, 0.02, 0.08],
      [0.08, 0.16, 0.55],
      [0.28, 0.45, 0.9]
    ],
    spark: [0.82, 0.92, 1]
  }
];
var DEFAULT_RAMP = 0;
var WORD = "metal";
var FONT_CSS = "var(--font-neue-montreal)";
var FONT_WEIGHT = 600;

// src/chrome/text-mask.ts
async function makeChromeField(word, blurPx, w, h, fontFamily) {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const crisp = document.createElement("canvas");
  crisp.width = W;
  crisp.height = H;
  const cx = crisp.getContext("2d");
  const text = (word || "").trim();
  if (text) {
    let size = H * 0.56;
    cx.font = `${FONT_WEIGHT} ${size}px ${fontFamily}`;
    const maxW = W * 0.82;
    const measured = cx.measureText(text).width;
    if (measured > maxW) {
      size *= maxW / measured;
      cx.font = `${FONT_WEIGHT} ${size}px ${fontFamily}`;
    }
    cx.fillStyle = "#fff";
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    const ls = size * -0.05;
    const chars = [...text];
    const widths = chars.map((c) => cx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + ls * (chars.length - 1);
    let x = W / 2 - total / 2;
    cx.textAlign = "left";
    for (let i = 0; i < chars.length; i++) {
      cx.fillText(chars[i], x, H * 0.5);
      x += widths[i] + ls;
    }
  }
  const wide = blurTo(crisp, W, H, Math.max(0.5, blurPx * 1.15));
  const tight = blurTo(crisp, W, H, Math.max(0.5, blurPx * 0.4));
  const cData = cx.getImageData(0, 0, W, H).data;
  const wData = wide.getContext("2d").getImageData(0, 0, W, H).data;
  const tData = tight.getContext("2d").getImageData(0, 0, W, H).data;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ox = out.getContext("2d");
  const packed = ox.createImageData(W, H);
  const p = packed.data;
  for (let i = 0; i < p.length; i += 4) {
    p[i] = cData[i + 3];
    p[i + 1] = wData[i + 3];
    p[i + 2] = tData[i + 3];
    p[i + 3] = 255;
  }
  ox.putImageData(packed, 0, 0);
  return out;
}
function blurTo(src, W, H, px) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  x.filter = `blur(${px.toFixed(2)}px)`;
  x.drawImage(src, 0, 0);
  x.filter = "none";
  return c;
}

// src/chrome/engine.ts
function rampToFloats(r) {
  const out = [];
  for (const s of r.stops) out.push(s[0], s[1], s[2]);
  out.push(r.spark[0], r.spark[1], r.spark[2]);
  return out;
}
var Chrome = class {
  host;
  canvas;
  gl = null;
  prog = null;
  loc = {};
  quad = null;
  tex = null;
  texW = 1;
  texH = 1;
  raf = 0;
  running = false;
  awake = false;
  w = 0;
  h = 0;
  dpr = 1;
  fontFamily = `${FONT_CSS}, sans-serif`;
  word = WORD;
  rampIdx = DEFAULT_RAMP;
  curRamp = rampToFloats(RAMPS[DEFAULT_RAMP]);
  targetRamp = rampToFloats(RAMPS[DEFAULT_RAMP]);
  builtW = 0;
  builtH = 0;
  builtFont = "";
  builtWord = "";
  buildScheduled = 0;
  destroyed = false;
  painted = false;
  t0 = performance.now();
  tx = 0;
  ty = 0;
  ttx = 0;
  tty = 0;
  ok = false;
  constructor(host, fontFamily) {
    this.host = host;
    if (fontFamily) this.fontFamily = fontFamily;
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
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
      this.prog = this.build(CHROME_VERT, CHROME_FRAG);
    } catch {
      this.gl = null;
      return;
    }
    const p = this.prog;
    for (const u of [
      "uField",
      "uTexel",
      "uTilt",
      "uAspect",
      "uTime",
      "uS0",
      "uS1",
      "uS2",
      "uS3",
      "uS4",
      "uSpark"
    ]) {
      this.loc[u] = gl.getUniformLocation(p, u);
    }
    const aPos = gl.getAttribLocation(p, "aPosition");
    const aUV = gl.getAttribLocation(p, "aUV");
    const data = new Float32Array([
      -1,
      -1,
      0,
      1,
      1,
      -1,
      1,
      1,
      -1,
      1,
      0,
      0,
      1,
      1,
      1,
      0
    ]);
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.useProgram(p);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);
    gl.clearColor(0.045, 0.048, 0.055, 1);
    this.resize();
    void this.buildFieldNow();
    this.canvas.addEventListener("pointermove", this.onMove);
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
  setFont(family) {
    if (family === this.fontFamily) return;
    this.fontFamily = family;
    this.scheduleBuild();
  }
  setWord(word) {
    if (word === this.word) return;
    this.word = word;
    this.scheduleBuild();
  }
  setRamp(i) {
    this.rampIdx = (i % RAMPS.length + RAMPS.length) % RAMPS.length;
    this.targetRamp = rampToFloats(RAMPS[this.rampIdx]);
    this.wake();
  }
  wake() {
    if (this.awake && !this.running) this.start();
    else if (!this.running) this.render();
  }
  onMove = (e) => {
    const r = this.canvas.getBoundingClientRect();
    this.ttx = ((e.clientX - r.left) / r.width - 0.5) * 0.9;
    this.tty = ((e.clientY - r.top) / r.height - 0.5) * 0.9;
    this.wake();
  };
  onLeave = () => {
    this.ttx = 0;
    this.tty = 0;
    this.wake();
  };
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
      this.scheduleBuild();
    }
  }
  maskSize() {
    const MAX_W = 1400;
    const mw = Math.max(2, Math.min(MAX_W, Math.round(this.w * this.dpr)));
    const mh = Math.max(2, Math.round(mw * (this.h / Math.max(1, this.w))));
    return [mw, mh];
  }
  scheduleBuild() {
    if (!this.gl || this.destroyed) return;
    const [mw, mh] = this.maskSize();
    if (mw === this.builtW && mh === this.builtH && this.fontFamily === this.builtFont && this.word === this.builtWord) {
      return;
    }
    if (this.buildScheduled) return;
    const run = () => {
      this.buildScheduled = 0;
      void this.buildFieldNow();
    };
    const ric = window.requestIdleCallback;
    this.buildScheduled = ric ? ric(run, { timeout: 200 }) : window.setTimeout(run, 0);
  }
  async buildFieldNow() {
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
    this.builtFont = this.fontFamily;
    this.builtWord = this.word;
    const blur = Math.max(1.5, mh * 0.012);
    const art = await makeChromeField(this.word, blur, mw, mh, this.fontFamily);
    if (!this.gl || this.destroyed) return;
    if (!this.tex) this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art);
    this.texW = art.width;
    this.texH = art.height;
    if (!this.running) this.render();
  }
  start() {
    if (!this.ok) return;
    this.awake = true;
    if (this.running) return;
    this.running = true;
    this.resize();
    const loop = () => {
      if (!this.running) return;
      this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() {
    this.awake = false;
    this.pause();
  }
  pause() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  frame() {
    const k = 0.1;
    this.tx += (this.ttx - this.tx) * k;
    this.ty += (this.tty - this.ty) * k;
    const ck = 0.08;
    for (let i = 0; i < this.curRamp.length; i++) {
      this.curRamp[i] += (this.targetRamp[i] - this.curRamp[i]) * ck;
    }
    this.render();
  }
  rampSettling() {
    for (let i = 0; i < this.curRamp.length; i++) {
      if (Math.abs(this.curRamp[i] - this.targetRamp[i]) > 2e-3) return true;
    }
    return false;
  }
  renderStill() {
    this.resize();
    void this.buildFieldNow();
    this.render();
  }
  render() {
    const gl = this.gl;
    if (!gl || !this.prog || !this.tex) return;
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.loc.uField, 0);
    gl.uniform2f(this.loc.uTexel, 1 / this.texW, 1 / this.texH);
    gl.uniform2f(this.loc.uTilt, this.tx, this.ty);
    gl.uniform1f(this.loc.uAspect, this.w / Math.max(1, this.h));
    gl.uniform1f(this.loc.uTime, (performance.now() - this.t0) / 1e3);
    const r = this.curRamp;
    gl.uniform3f(this.loc.uS0, r[0], r[1], r[2]);
    gl.uniform3f(this.loc.uS1, r[3], r[4], r[5]);
    gl.uniform3f(this.loc.uS2, r[6], r[7], r[8]);
    gl.uniform3f(this.loc.uS3, r[9], r[10], r[11]);
    gl.uniform3f(this.loc.uS4, r[12], r[13], r[14]);
    gl.uniform3f(this.loc.uSpark, r[15], r[16], r[17]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!this.painted) {
      this.painted = true;
      this.canvas.style.opacity = "1";
    }
    if (!this.awake && !this.rampSettling() && Math.abs(this.tx - this.ttx) < 1e-3 && Math.abs(this.ty - this.tty) < 1e-3) {
      this.pause();
    }
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
    this.canvas.removeEventListener("pointerleave", this.onLeave);
    const gl = this.gl;
    if (gl) {
      if (this.tex) gl.deleteTexture(this.tex);
      if (this.quad) gl.deleteBuffer(this.quad);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.canvas.remove();
  }
};

// src/shared/ghost.ts
function ghostPointer(host, opts = {}) {
  const target = opts.target ?? host;
  const speed = opts.speed ?? 1;
  const bx = opts.boxX ?? 0.32;
  const by = opts.boxY ?? 0.28;
  let raf = 0;
  const t0 = performance.now();
  const tick = (now) => {
    const t = (now - t0) / 1e3 * speed;
    const r = host.getBoundingClientRect();
    const gx = 0.55 * Math.sin(t * 1.15) + 0.3 * Math.sin(t * 2.6 + 1) + 0.15 * Math.cos(t * 4.1 + 0.4);
    const gy = 0.55 * Math.cos(t * 0.95 + 2.1) + 0.3 * Math.sin(t * 2.2 + 0.5) + 0.15 * Math.cos(t * 3.7 + 1.7);
    const clientX = r.left + r.width * (0.5 + gx * bx);
    const clientY = r.top + r.height * (0.5 + gy * by);
    const ev = () => new PointerEvent("pointermove", { clientX, clientY, bubbles: true, pointerType: "mouse" });
    if (target === "hit") {
      const el = document.elementFromPoint(clientX, clientY);
      (el || host).dispatchEvent(ev());
    } else {
      target.dispatchEvent(ev());
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop: () => cancelAnimationFrame(raf) };
}

// src/chrome/adapter.ts
var adapter_default = {
  async mount(host, props) {
    host.style.background = "#0b0c0e";
    const engine = new Chrome(host, "-apple-system, 'Helvetica Neue', Arial, sans-serif");
    if (!engine.ok) throw new Error("chrome: WebGL unavailable");
    if (typeof props.word === "string" && props.word) engine.setWord(props.word);
    let ramp = Number(props.ramp ?? 0);
    engine.setRamp(ramp);
    const canvas = host.querySelector("canvas");
    const ghost = canvas ? ghostPointer(host, { target: canvas, speed: 0.7 }) : null;
    let timer = 0;
    const cycle = Number(props.cycleRampsSeconds ?? 0);
    return {
      start: () => {
        engine.start();
        if (cycle > 0) {
          timer = window.setInterval(() => engine.setRamp(++ramp), cycle * 1e3);
        }
      },
      action: async (name) => {
        if (name === "ramp") engine.setRamp(++ramp);
      },
      destroy: () => {
        if (timer) window.clearInterval(timer);
        ghost?.stop();
        engine.destroy();
      }
    };
  }
};
export {
  adapter_default as default
};
