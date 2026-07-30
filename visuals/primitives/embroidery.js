// visuals/src/embroidery/shaders.ts
var EMB_VERT = `
attribute vec2 aPosition;
attribute vec2 aUV;
varying vec2 vUV;
void main() {
  vUV = aUV;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;
var EMB_FRAG = `

precision highp float;

varying vec2 vUV;

uniform sampler2D uArt;
uniform sampler2D uField;
uniform sampler2D uWeave;
uniform vec2  uTexel;
uniform vec2  uLight;
uniform float uLightZ;
uniform vec2  uWash;
uniform float uHover;
uniform float uPress;
uniform vec2  uPressPos;
uniform float uAspect;
uniform vec3  uFabric;
uniform float uDepth;
uniform float uWeaveScale;

float hash(vec2 p){
  p = mod(p, 137.0);
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p){

  p = mod(p, 137.0);
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
  vec2 u = f*f*(3.-2.*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

float weaveAt(vec2 uv){ return texture2D(uWeave, fract(uv * vec2(uAspect,1.0) * uWeaveScale)).r; }

void main() {
  vec2 uv = vUV;
  vec2 texel = uTexel;

  vec4 fld = texture2D(uField, uv);
  float cover = fld.r;
  float inkM  = fld.g;
  float ringM = fld.b;
  float stitchAng = fld.a * 3.14159;

  vec2 dp = uv * vec2(uAspect, 1.0);
  float bw = weaveAt(uv + vec2(0.37, 0.11));
  float blotch = noise(dp * 3.0) * 0.1 + noise(dp * 7.0) * 0.05;
  vec3 fabric = uFabric * (0.72 + bw * 0.6 + (blotch - 0.075));
  fabric += (noise(dp * 240.0) - 0.5) * 0.025;
  vec3 col = fabric;

  float pdist = distance(uv * vec2(uAspect, 1.0), uPressPos * vec2(uAspect, 1.0));
  float pressLocal = uPress * (1.0 - smoothstep(0.0, 0.5, pdist));

  float lift = 1.0 - pressLocal * 0.85;
  vec2 shOff = vec2(6.0, -6.0) * texel * lift;
  float shc = texture2D(uField, uv - shOff).r;
  col = mix(col, col * mix(0.42, 0.62, pressLocal), smoothstep(0.2, 0.8, shc) * 0.8);

  if (cover < 0.004) { gl_FragColor = vec4(col, 1.0); return; }

  float w0 = weaveAt(uv);
  float wL = weaveAt(uv - vec2(1.,0.)*texel), wR = weaveAt(uv + vec2(1.,0.)*texel);
  float wD = weaveAt(uv - vec2(0.,1.)*texel), wU = weaveAt(uv + vec2(0.,1.)*texel);
  vec2 wslope = vec2(wR - wL, wU - wD) * 22.0;
  vec3 Nw = normalize(vec3(-wslope.x, -wslope.y, 1.0));

  float cL = texture2D(uField, uv - vec2(1.,0.)*texel).r, cR = texture2D(uField, uv + vec2(1.,0.)*texel).r;
  float cD = texture2D(uField, uv - vec2(0.,1.)*texel).r, cU = texture2D(uField, uv + vec2(0.,1.)*texel).r;
  vec2 pslope = vec2(cR - cL, cU - cD) * uDepth * 16.0;
  vec3 Np = vec3(-pslope.x, -pslope.y, 1.0);
  float bevel = clamp(length(pslope), 0.0, 1.0);
  vec3 N = normalize(Np + Nw * 2.0);

  vec3 L = normalize(vec3(uLight, uLightZ));
  float diff = dot(N, L);
  float hi = pow(max(diff, 0.0), 1.25);
  float sh = pow(max(-diff, 0.0), 1.1);

  vec3 art = texture2D(uArt, uv).rgb;
  vec3 c = art * (0.72 + w0 * 0.6);

  float sc = cos(stitchAng), ss = sin(stitchAng);

  float across = (dp.x * ss - dp.y * sc);
  float rows = across * 260.0;

  float TWO_PI = 6.2831853;
  float satin = sin(mod(rows, TWO_PI));

  float ridge = 0.5 + 0.5 * satin;
  ridge = pow(ridge, 1.4);
  float jit = noise(vec2(floor(rows), (dp.x*sc+dp.y*ss)*90.0)) * 0.25;
  float satinShade = mix(0.82, 1.14, clamp(ridge + jit*ridge, 0.0, 1.0));

  float clothFace = cover * (1.0 - inkM);
  c *= mix(1.0, satinShade, clothFace * 0.9 + ringM * 0.6);

  c *= 1.0 - inkM * 0.05;

  c += hi * 0.46 * (0.5 + bevel * 0.5);
  c -= sh * 0.36;

  float edge = 1.0 - smoothstep(0.0, 0.32, cover);
  c *= 1.0 - edge * 0.28 * cover;

  c += (noise(dp * 380.0) - 0.5) * 0.045;

  if (uHover > 0.001) {
    float d = distance(dp, uWash * vec2(uAspect, 1.0));
    float halo = 1.0 - smoothstep(0.0, 0.42, d);
    float crown = smoothstep(0.72, 1.0, ridge);
    float glint = halo * halo * (0.35 + crown * 0.9) * uHover;
    c += glint * 0.16 * cover;
  }

  c *= 1.0 - pressLocal * 0.16 * cover;

  c = clamp(c, 0.0, 1.0);

  float aa = smoothstep(0.06, 0.2, cover);
  gl_FragColor = vec4(mix(col, c, aa), 1.0);
}
`;

// visuals/src/embroidery/patches.ts
var WORDS = [
  {
    word: "made",
    cx: 0.44,
    cy: 0.29,
    scale: 0.32,
    rotDeg: -4,
    fill: [0.42, 0.62, 0.92],
    ink: [0.09, 0.09, 0.1],
    border: [0.97, 0.97, 0.98],
    stitchDeg: 70
  },
  {
    word: "with",
    cx: 0.6,
    cy: 0.51,
    scale: 0.28,
    rotDeg: 3,
    fill: [0.96, 0.82, 0.36],
    ink: [0.09, 0.09, 0.1],
    border: [0.98, 0.98, 0.96],
    stitchDeg: 20
  },
  {
    word: "love",
    cx: 0.48,
    cy: 0.72,
    scale: 0.34,
    rotDeg: -2,
    fill: [0.9, 0.62, 0.82],
    ink: [0.09, 0.09, 0.1],
    border: [0.98, 0.97, 0.98],
    stitchDeg: 100
  }
];
var FABRIC = [0.16, 0.13, 0.2];

// visuals/src/embroidery/scene.ts
async function makeScene(w, h, fontFamily) {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  };
  const borderPx = Math.max(3, H * 0.018);
  const bevelPx = Math.max(1.5, H * 7e-3);
  const cover = mk();
  const coverX = cover.getContext("2d");
  const ink = mk();
  const inkX = ink.getContext("2d");
  const ring = mk();
  const ringX = ring.getContext("2d");
  const dir = mk();
  const dirX = dir.getContext("2d");
  const art = mk();
  const artX = art.getContext("2d");
  artX.fillStyle = rgb(FABRIC);
  artX.fillRect(0, 0, W, H);
  coverX.globalCompositeOperation = "lighten";
  inkX.globalCompositeOperation = "lighten";
  ringX.globalCompositeOperation = "lighten";
  for (const wp of WORDS) {
    const glyph = mk();
    const gx = glyph.getContext("2d");
    drawWord(gx, wp, W, H, fontFamily);
    const sil = mk();
    const sx = sil.getContext("2d");
    dilate(sx, glyph, borderPx * 2.1);
    const inner = mk();
    const ix = inner.getContext("2d");
    dilate(ix, glyph, borderPx * 1.05);
    const bandC = mk();
    const bx = bandC.getContext("2d");
    bx.drawImage(sil, 0, 0);
    bx.globalCompositeOperation = "destination-out";
    bx.drawImage(inner, 0, 0);
    bx.globalCompositeOperation = "source-over";
    const layer = mk();
    const lx = layer.getContext("2d");
    lx.drawImage(sil, 0, 0);
    lx.globalCompositeOperation = "source-in";
    lx.fillStyle = rgb(wp.fill);
    lx.fillRect(0, 0, W, H);
    lx.globalCompositeOperation = "source-over";
    paintMasked(lx, bandC, wp.border);
    paintMasked(lx, glyph, wp.ink);
    artX.drawImage(layer, 0, 0);
    coverX.drawImage(sil, 0, 0);
    punchThenAdd(inkX, sil, glyph);
    punchThenAdd(ringX, sil, bandC);
    dirX.drawImage(glyph, 0, 0);
  }
  const puff = mk();
  const px = puff.getContext("2d");
  px.filter = `blur(${bevelPx.toFixed(2)}px)`;
  px.drawImage(cover, 0, 0);
  px.filter = "none";
  const gsrc = mk();
  const gx2 = gsrc.getContext("2d");
  gx2.filter = `blur(${Math.max(2, H * 0.02).toFixed(2)}px)`;
  gx2.drawImage(dir, 0, 0);
  gx2.filter = "none";
  const rsrc = mk();
  const rx2 = rsrc.getContext("2d");
  rx2.filter = `blur(${Math.max(2, H * 0.016).toFixed(2)}px)`;
  rx2.drawImage(cover, 0, 0);
  rx2.filter = "none";
  const cData = px.getImageData(0, 0, W, H).data;
  const iData = inkX.getImageData(0, 0, W, H).data;
  const rData = ringX.getImageData(0, 0, W, H).data;
  const gData = gx2.getImageData(0, 0, W, H).data;
  const rimData = rx2.getImageData(0, 0, W, H).data;
  const p = new Uint8Array(W * H * 4);
  const grad = (a, x, y) => {
    const at = (xx, yy) => {
      xx = xx < 0 ? 0 : xx >= W ? W - 1 : xx;
      yy = yy < 0 ? 0 : yy >= H ? H - 1 : yy;
      return a[(yy * W + xx) * 4 + 3];
    };
    return [at(x + 1, y) - at(x - 1, y), at(x, y + 1) - at(x, y - 1)];
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const isBorder = rData[i + 3] > 40 && iData[i + 3] < 40;
      const [dx, dy] = isBorder ? grad(rimData, x, y) : grad(gData, x, y);
      let ang = Math.atan2(dy, dx) + Math.PI / 2;
      ang = (ang % Math.PI + Math.PI) % Math.PI;
      p[i] = cData[i + 3];
      p[i + 1] = iData[i + 3];
      p[i + 2] = rData[i + 3];
      p[i + 3] = Math.round(ang / Math.PI * 255);
    }
  }
  return { art, field: { data: p, width: W, height: H } };
}
function rgb(c) {
  const to = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${to(c[0])},${to(c[1])},${to(c[2])})`;
}
function paintMasked(ctx, mask, color) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const t = document.createElement("canvas");
  t.width = W;
  t.height = H;
  const tx = t.getContext("2d");
  tx.drawImage(mask, 0, 0);
  tx.globalCompositeOperation = "source-in";
  tx.fillStyle = rgb(color);
  tx.fillRect(0, 0, W, H);
  ctx.drawImage(t, 0, 0);
}
function dilate(ctx, src, r) {
  const steps = 28;
  for (let s = 1; s >= 0.5; s -= 0.5) {
    for (let i = 0; i < steps; i++) {
      const a = i / steps * Math.PI * 2;
      ctx.drawImage(src, Math.cos(a) * r * s, Math.sin(a) * r * s);
    }
  }
  ctx.drawImage(src, 0, 0);
}
function punchThenAdd(acc, sil, add) {
  acc.globalCompositeOperation = "destination-out";
  acc.drawImage(sil, 0, 0);
  acc.globalCompositeOperation = "lighten";
  acc.drawImage(add, 0, 0);
}
function drawWord(ctx, wp, W, H, fontFamily) {
  const size = wp.scale * H;
  ctx.save();
  ctx.translate(wp.cx * W, wp.cy * H);
  ctx.rotate(wp.rotDeg * Math.PI / 180);
  ctx.font = `800 ${size}px ${fontFamily}`;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(wp.word, 0, 0);
  ctx.restore();
}

// visuals/lib/video-sources.ts
var mediaUrl = (p) => `/assets/${p.replace(/^\/+/, "").replace(/^vault\//, "")}`;

// visuals/src/embroidery/engine.ts
var REST_ANGLE = 73 * Math.PI / 180;
var LIGHT_Z = 0.55;
var WEAVE_URL = mediaUrl("/vault/embroidery-weave.webp");
var WEAVE_SCALE = 15;
var Embroidery = class {
  host;
  canvas;
  gl = null;
  prog = null;
  loc = {};
  quad = null;
  artTex = null;
  fieldTex = null;
  weave = null;
  texW = 1;
  texH = 1;
  raf = 0;
  running = false;
  awake = false;
  w = 0;
  h = 0;
  dpr = 1;
  fontFamily = "var(--font-neue-corp), sans-serif";
  builtW = 0;
  builtH = 0;
  builtFont = "";
  buildScheduled = 0;
  destroyed = false;
  painted = false;
  hover = 0;
  hoverTarget = 0;
  wx = 0.5;
  wy = 0.55;
  twx = 0.5;
  twy = 0.55;
  press = 0;
  pressVel = 0;
  pressKick = 0;
  px = 0.5;
  py = 0.5;
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
      this.prog = this.build(EMB_VERT, EMB_FRAG);
    } catch {
      this.gl = null;
      return;
    }
    const p = this.prog;
    for (const u of [
      "uArt",
      "uField",
      "uWeave",
      "uTexel",
      "uLight",
      "uLightZ",
      "uWash",
      "uHover",
      "uPress",
      "uPressPos",
      "uAspect",
      "uFabric",
      "uDepth",
      "uWeaveScale"
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
    gl.clearColor(FABRIC[0] * 0.8, FABRIC[1] * 0.8, FABRIC[2] * 0.8, 1);
    this.resize();
    this.weave = this.newPlaceholder([150, 150, 150, 255]);
    this.loadWeave();
    void this.buildSceneNow();
    this.canvas.addEventListener("pointermove", this.onMove);
    this.ok = true;
  }
  newPlaceholder(rgba) {
    const gl = this.gl;
    if (!gl) return null;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
    return t;
  }
  loadWeave() {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const g = this.gl;
      if (!g || !this.weave || this.destroyed) return;
      g.bindTexture(g.TEXTURE_2D, this.weave);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.REPEAT);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.REPEAT);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
      if (!this.running) this.render();
    };
    img.src = WEAVE_URL;
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
  setPatch(_i) {
    void _i;
  }
  setHover(v) {
    this.hoverTarget = Math.max(0, Math.min(1, v));
    this.wake();
  }
  pressTap(x = 0.5, y = 0.5) {
    this.px = x;
    this.py = 1 - y;
    this.pressKick = 1;
    this.wake();
  }
  wake() {
    if (this.awake && !this.running) this.start();
    else if (!this.running) this.render();
  }
  onMove = (e) => {
    const r = this.canvas.getBoundingClientRect();
    this.twx = (e.clientX - r.left) / r.width;
    this.twy = 1 - (e.clientY - r.top) / r.height;
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
    if (mw === this.builtW && mh === this.builtH && this.fontFamily === this.builtFont) return;
    if (this.buildScheduled) return;
    const run = () => {
      this.buildScheduled = 0;
      void this.buildSceneNow();
    };
    const ric = window.requestIdleCallback;
    this.buildScheduled = ric ? ric(run, { timeout: 200 }) : window.setTimeout(run, 0);
  }
  uploadCanvas(tex, canvas) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }
  uploadPixels(tex, px) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, px.width, px.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, px.data);
  }
  async buildSceneNow() {
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
    const scene = await makeScene(mw, mh, this.fontFamily);
    if (!this.gl || this.destroyed) return;
    if (!this.artTex) this.artTex = gl.createTexture();
    if (!this.fieldTex) this.fieldTex = gl.createTexture();
    this.uploadCanvas(this.artTex, scene.art);
    this.uploadPixels(this.fieldTex, scene.field);
    this.texW = scene.field.width;
    this.texH = scene.field.height;
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
    const k = 0.12;
    this.hover += (this.hoverTarget - this.hover) * k;
    this.wx += (this.twx - this.wx) * k;
    this.wy += (this.twy - this.wy) * k;
    this.pressKick *= 0.8;
    if (this.pressKick < 2e-3) this.pressKick = 0;
    this.pressVel += (this.pressKick - this.press) * 0.28;
    this.pressVel *= 0.6;
    this.press += this.pressVel;
    this.render();
  }
  renderStill() {
    this.resize();
    void this.buildSceneNow();
    this.render();
  }
  render() {
    const gl = this.gl;
    if (!gl || !this.prog || !this.artTex || !this.fieldTex) return;
    const ang = REST_ANGLE + (this.wx - 0.5) * 1.4 * this.hover;
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.artTex);
    gl.uniform1i(this.loc.uArt, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.fieldTex);
    gl.uniform1i(this.loc.uField, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.weave);
    gl.uniform1i(this.loc.uWeave, 2);
    gl.uniform1f(this.loc.uWeaveScale, WEAVE_SCALE);
    gl.uniform2f(this.loc.uTexel, 1 / this.texW, 1 / this.texH);
    gl.uniform2f(this.loc.uLight, Math.cos(ang), Math.sin(ang));
    gl.uniform1f(this.loc.uLightZ, LIGHT_Z);
    gl.uniform2f(this.loc.uWash, this.wx, this.wy);
    gl.uniform1f(this.loc.uHover, this.hover);
    gl.uniform1f(this.loc.uPress, Math.max(0, Math.min(1, this.press)));
    gl.uniform2f(this.loc.uPressPos, this.px, this.py);
    gl.uniform1f(this.loc.uAspect, this.w / Math.max(1, this.h));
    gl.uniform3f(this.loc.uFabric, FABRIC[0], FABRIC[1], FABRIC[2]);
    gl.uniform1f(this.loc.uDepth, 1.15);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!this.painted) {
      this.painted = true;
      this.canvas.style.opacity = "1";
    }
    if (Math.abs(this.hover - this.hoverTarget) < 2e-3 && this.hoverTarget < 2e-3 && Math.abs(this.wx - this.twx) < 1e-3 && Math.abs(this.wy - this.twy) < 1e-3 && this.pressKick === 0 && Math.abs(this.press) < 2e-3 && Math.abs(this.pressVel) < 2e-3) {
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
    const gl = this.gl;
    if (gl) {
      if (this.artTex) gl.deleteTexture(this.artTex);
      if (this.fieldTex) gl.deleteTexture(this.fieldTex);
      if (this.weave) gl.deleteTexture(this.weave);
      if (this.quad) gl.deleteBuffer(this.quad);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.canvas.remove();
  }
};

// visuals/src/shared/ghost.ts
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
    target.dispatchEvent(
      new PointerEvent("pointermove", { clientX, clientY, bubbles: true, pointerType: "mouse" })
    );
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop: () => cancelAnimationFrame(raf) };
}

// visuals/src/embroidery/adapter.ts
var adapter_default = {
  async mount(host, props) {
    if (Array.isArray(props.words) && props.words.length === 3) {
      props.words.forEach((w, i) => {
        WORDS[i].word = w;
      });
    }
    const engine = new Embroidery(host, "-apple-system, 'Helvetica Neue', Arial, sans-serif");
    if (!engine.ok) throw new Error("embroidery: WebGL unavailable");
    engine.setHover(1);
    const canvas = host.querySelector("canvas");
    const ghost = canvas ? ghostPointer(host, { target: canvas, speed: 0.45 }) : null;
    return {
      start: () => engine.start(),
      destroy: () => {
        ghost?.stop();
        engine.destroy();
      }
    };
  }
};
export {
  adapter_default as default
};
