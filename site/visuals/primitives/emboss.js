// visuals/src/emboss/pg-shader.ts
var PG_VERT = `
attribute vec2 aPosition;
attribute vec2 aUV;
varying vec2 vUV;
void main(){ vUV = aUV; gl_Position = vec4(aPosition, 0.0, 1.0); }
`;
var PG_FRAG = `
precision highp float;
varying vec2 vUV;

uniform sampler2D uField;   // R crisp, G blurred height
uniform sampler2D uPlaster;
uniform sampler2D uGrunge;
uniform float uGrungeAmt;
uniform vec2  uTexel;
uniform vec2  uLight;       // from angle + altitude
uniform float uLightZ;
uniform float uDepth;
uniform float uHi;
uniform float uSh;
uniform float uContrast;
uniform float uBright;
uniform vec3  uTint;
uniform vec2  uTexOff;
uniform float uTexScale;
uniform float uReveal;
uniform float uAspect;

void main(){
  vec2 uv = vUV;

  float gs = 1.0;
  float hL = texture2D(uField, uv - vec2(gs,0.0)*uTexel).g;
  float hR = texture2D(uField, uv + vec2(gs,0.0)*uTexel).g;
  float hD = texture2D(uField, uv - vec2(0.0,gs)*uTexel).g;
  float hU = texture2D(uField, uv + vec2(0.0,gs)*uTexel).g;
  float crisp = texture2D(uField, uv).r;
  vec2 slope = vec2(hR-hL, hU-hD) * uDepth * 16.0 * uReveal;
  vec3 N = normalize(vec3(-slope.x, -slope.y, 1.0));
  float bevel = clamp(length(slope), 0.0, 1.0);

  vec3 L = normalize(vec3(uLight, uLightZ));
  float diff = dot(N, L);
  float hi = pow(max(diff,0.0), 1.2) * bevel;
  float sh = pow(max(-diff,0.0), 1.0) * bevel;

  // clamped sub-window of the plaster (zoom + pan, no fract wrap) so there is no
  // seam and the texture never tiles across the panel.
  float zoom = max(1.0, uTexScale);
  vec2 span = vec2(1.0 / zoom);
  vec2 origin = clamp(uTexOff, 0.0, 1.0) * (1.0 - span);
  vec2 puv = origin + uv * span;
  float p = texture2D(uPlaster, puv).r;
  p = clamp((p-0.5)*uContrast + 0.5, 0.0, 1.0);
  vec3 base = uTint * p * uBright;

  float face = smoothstep(0.4, 0.62, crisp);
  base *= mix(1.0, 0.86, face * uReveal);

  vec3 c = base;
  c += hi * uHi * uReveal;
  c -= sh * uSh * uReveal;

  float gr = texture2D(uGrunge, uv).r;
  vec3 ov = mix(2.0*c*gr, 1.0-2.0*(1.0-c)*(1.0-gr), step(0.5, c));
  c = mix(c, ov, uGrungeAmt);

  gl_FragColor = vec4(clamp(c,0.0,1.0), 1.0);
}
`;

// visuals/src/emboss/content-mask.ts
async function makeContentField(content, blurPx, w, h, fontFamily) {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const crisp = document.createElement("canvas");
  crisp.width = W;
  crisp.height = H;
  const cx = crisp.getContext("2d");
  cx.clearRect(0, 0, W, H);
  if (content.svg && content.svg.trim()) {
    await drawSvg(cx, content.svg, W, H, 0.5, 0.5, 0.52);
  } else if (content.word.trim()) {
    drawWord(cx, content, W, H, fontFamily, 0.5, 0.36);
  }
  const soft = document.createElement("canvas");
  soft.width = W;
  soft.height = H;
  const sx = soft.getContext("2d");
  sx.filter = `blur(${Math.max(0.5, blurPx).toFixed(2)}px)`;
  sx.drawImage(crisp, 0, 0);
  sx.filter = "none";
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ox = out.getContext("2d");
  const c = cx.getImageData(0, 0, W, H).data;
  const s = sx.getImageData(0, 0, W, H).data;
  const packed = ox.createImageData(W, H);
  const p = packed.data;
  for (let i = 0; i < p.length; i += 4) {
    p[i] = c[i + 3];
    p[i + 1] = s[i + 3];
    p[i + 2] = 0;
    p[i + 3] = 255;
  }
  ox.putImageData(packed, 0, 0);
  return out;
}
function drawWord(ctx, content, W, H, fontFamily, cyFrac, capFrac) {
  const text = content.word;
  if (!text) return;
  const cx = W / 2;
  const cy = H * cyFrac;
  const maxW = W * 0.82;
  let size = H * capFrac;
  ctx.font = `800 ${size}px ${fontFamily}`;
  const wWidth = ctx.measureText(text).width;
  if (wWidth > maxW) {
    size *= maxW / wWidth;
    ctx.font = `800 ${size}px ${fontFamily}`;
  }
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy);
}
async function drawSvg(ctx, svg, W, H, cxFrac, cyFrac, sizeFrac) {
  const forced = svg.replace(
    /<svg([^>]*)>/i,
    `<svg$1><style>*{fill:#fff!important;stroke:#fff!important}</style>`
  );
  const blob = new Blob([forced], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const target = H * sizeFrac;
    const ar = img.width / Math.max(1, img.height);
    let dh = target;
    let dw = target * ar;
    const maxW = W * 0.82;
    if (dw > maxW) {
      dw = maxW;
      dh = dw / ar;
    }
    ctx.drawImage(img, W * cxFrac - dw / 2, H * cyFrac - dh / 2, dw, dh);
  } catch {
  } finally {
    URL.revokeObjectURL(url);
  }
}
function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

// visuals/lib/video-sources.ts
var mediaUrl = (p) => `/assets/${p.replace(/^\/+/, "").replace(/^vault\//, "")}`;

// visuals/src/emboss/pg-engine.ts
var PLASTER_URL = mediaUrl("/vault/emboss-plaster.png");
var GRUNGE_URL = mediaUrl("/vault/emboss-grunge.png");
var GRUNGE_AMT = 0.38;
var EmbossPlayground = class {
  host;
  canvas;
  gl = null;
  prog = null;
  loc = {};
  field = null;
  plaster = null;
  grunge = null;
  fieldW = 1;
  fieldH = 1;
  w = 0;
  h = 0;
  dpr = 1;
  fontFamily = "var(--font-neue-corp), sans-serif";
  params;
  content;
  lastSize = -1;
  fieldSeq = 0;
  // guards against out-of-order async field builds
  raf = 0;
  running = false;
  fieldReady = false;
  // the height field has been built at least once
  painted = false;
  // canvas revealed after its first real frame
  ok = false;
  constructor(host, params, content) {
    this.host = host;
    this.params = params;
    this.content = content;
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      // Hidden until the first real frame, so the white host shows instead of a black
      // undrawn canvas (matches the emboss card; avoids a black flash on mount).
      opacity: "0"
    });
    host.appendChild(this.canvas);
    const gl = this.canvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false });
    if (!gl) return;
    this.gl = gl;
    gl.clearColor(1, 1, 1, 1);
    try {
      this.prog = this.build(PG_VERT, PG_FRAG);
    } catch {
      this.gl = null;
      return;
    }
    for (const u of [
      "uField",
      "uPlaster",
      "uGrunge",
      "uGrungeAmt",
      "uTexel",
      "uLight",
      "uLightZ",
      "uDepth",
      "uHi",
      "uSh",
      "uContrast",
      "uBright",
      "uTint",
      "uTexOff",
      "uTexScale",
      "uReveal",
      "uAspect"
    ]) this.loc[u] = gl.getUniformLocation(this.prog, u);
    const aPos = gl.getAttribLocation(this.prog, "aPosition");
    const aUV = gl.getAttribLocation(this.prog, "aUV");
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
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
    ]), gl.STATIC_DRAW);
    gl.useProgram(this.prog);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);
    this.field = gl.createTexture();
    this.plaster = this.placeholder([128, 128, 128, 255]);
    this.grunge = this.placeholder([128, 128, 128, 255]);
    this.loadTex(PLASTER_URL, () => this.plaster, false);
    this.loadTex(GRUNGE_URL, () => this.grunge, false);
    this.resize();
    void this.rebuildField();
    this.ok = true;
  }
  build(vs, fs) {
    const gl = this.gl;
    const c = (t, s) => {
      const sh = gl.createShader(t);
      gl.shaderSource(sh, s);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || "compile");
      return sh;
    };
    const p = gl.createProgram();
    gl.attachShader(p, c(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, c(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link");
    return p;
  }
  placeholder(rgba) {
    const gl = this.gl;
    if (!gl) return null;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
    return t;
  }
  loadTex(url, target, repeat) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const g = this.gl, tex = target();
      if (!g || !tex) return;
      g.bindTexture(g.TEXTURE_2D, tex);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img);
      const w = repeat ? g.REPEAT : g.CLAMP_TO_EDGE;
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, w);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, w);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
      this.renderOnce();
    };
    img.src = url;
  }
  setFont(f) {
    this.fontFamily = f;
    void this.rebuildField();
  }
  setParams(p) {
    const sizeChanged = p.size !== this.params.size || p.soften !== this.params.soften;
    this.params = p;
    if (sizeChanged) void this.rebuildField();
    else this.renderOnce();
  }
  setContent(c) {
    this.content = c;
    void this.rebuildField();
  }
  async rebuildField() {
    const gl = this.gl;
    if (!gl) return;
    const MAX_W = 1500;
    const mw = Math.max(2, Math.min(MAX_W, Math.round(this.w * this.dpr)));
    const mh = Math.max(2, Math.round(mw * (this.h / Math.max(1, this.w))));
    const blur = Math.max(1, (this.params.size + this.params.soften) * this.dpr * 1.2);
    this.lastSize = this.params.size;
    const seq = ++this.fieldSeq;
    const art = await makeContentField(this.content, blur, mw, mh, this.fontFamily);
    if (seq !== this.fieldSeq || !this.gl) return;
    gl.bindTexture(gl.TEXTURE_2D, this.field);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art);
    this.fieldW = art.width;
    this.fieldH = art.height;
    this.fieldReady = true;
    this.renderOnce();
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
      void this.rebuildField();
    }
  }
  renderOnce() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.render();
    });
  }
  render() {
    const gl = this.gl, p = this.params;
    if (!gl || !this.prog) return;
    if (!this.fieldReady) return;
    const a = p.angle * Math.PI / 180;
    const lx = Math.cos(a);
    const ly = Math.sin(a);
    const lz = Math.max(0.25, Math.sin(p.altitude * Math.PI / 180) + 0.3);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.field);
    gl.uniform1i(this.loc.uField, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.plaster);
    gl.uniform1i(this.loc.uPlaster, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.grunge);
    gl.uniform1i(this.loc.uGrunge, 2);
    gl.uniform1f(this.loc.uGrungeAmt, GRUNGE_AMT);
    gl.uniform2f(this.loc.uTexel, 1 / this.fieldW, 1 / this.fieldH);
    gl.uniform2f(this.loc.uLight, lx, ly);
    gl.uniform1f(this.loc.uLightZ, lz);
    gl.uniform1f(this.loc.uDepth, p.depth);
    gl.uniform1f(this.loc.uHi, p.highlight);
    gl.uniform1f(this.loc.uSh, p.shadow);
    gl.uniform1f(this.loc.uContrast, p.contrast);
    gl.uniform1f(this.loc.uBright, p.bright);
    gl.uniform3f(this.loc.uTint, p.tint[0], p.tint[1], p.tint[2]);
    gl.uniform2f(this.loc.uTexOff, p.texOffset[0], p.texOffset[1]);
    gl.uniform1f(this.loc.uTexScale, p.texScale);
    gl.uniform1f(this.loc.uReveal, 1);
    gl.uniform1f(this.loc.uAspect, this.w / Math.max(1, this.h));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!this.painted) {
      this.painted = true;
      this.canvas.style.opacity = "1";
    }
  }
  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    const gl = this.gl;
    if (gl) {
      [this.field, this.plaster, this.grunge].forEach((t) => t && gl.deleteTexture(t));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.canvas.remove();
  }
};

// visuals/src/emboss/params.ts
function fromSpec(a) {
  return {
    depth: 0.55 + Math.min(a.depth, 1e3) / 1e3 * 1.2,
    // cap at 6px: past that the bevel goes soft/blobby in this model, so the wide
    // specs (size 15-20) are clamped to a crisp edge.
    size: Math.min(6, Math.max(1, a.size / 4.17 * 2.2)),
    soften: Math.min(2, a.soften / 4.17),
    angle: a.angle,
    altitude: a.alt,
    highlight: a.hi / 100,
    shadow: a.sh / 100
  };
}
var SURFACE = { contrast: 0.32, bright: 2 };
var PRESETS = [
  {
    id: "sharp",
    name: "Sharp",
    params: { ...fromSpec({ depth: 188, size: 1, soften: 1, angle: 73, alt: 21, hi: 15, sh: 10 }), ...SURFACE, tint: [1, 0.42, 0.42], texOffset: [0, 0], texScale: 1.35 }
  },
  // red
  {
    id: "press",
    name: "Press",
    params: { ...fromSpec({ depth: 188, size: 5, soften: 3, angle: 73, alt: 21, hi: 20, sh: 20 }), ...SURFACE, tint: [1, 0.62, 0.24], texOffset: [0.4, 0.15], texScale: 1 }
  },
  // orange
  {
    id: "brutal",
    name: "Brutal",
    params: { ...fromSpec({ depth: 1e3, size: 20, soften: 10, angle: 73, alt: 21, hi: 25, sh: 20 }), ...SURFACE, tint: [0.98, 0.85, 0.2], texOffset: [0.6, 0.55], texScale: 1.9 }
  },
  // yellow
  {
    id: "soft",
    name: "Soft",
    params: { ...fromSpec({ depth: 188, size: 15, soften: 7, angle: 73, alt: 21, hi: 12, sh: 8 }), ...SURFACE, tint: [0.42, 0.9, 0.42], texOffset: [0.2, 0.7], texScale: 0.7 }
  },
  // green
  {
    id: "wide",
    name: "Wide",
    params: { ...fromSpec({ depth: 469, size: 20, soften: 5, angle: 90, alt: 30, hi: 10, sh: 10 }), ...SURFACE, tint: [0.2, 0.85, 0.75], texOffset: [0.75, 0.1], texScale: 1.5 }
  },
  // teal
  {
    id: "deep",
    name: "Deep",
    params: { ...fromSpec({ depth: 1e3, size: 12, soften: 12, angle: 90, alt: 30, hi: 10, sh: 6 }), ...SURFACE, tint: [0.34, 0.62, 1], texOffset: [0.1, 0.4], texScale: 2.2 }
  },
  // blue
  {
    id: "crisp",
    name: "Crisp",
    params: { ...fromSpec({ depth: 1e3, size: 2, soften: 3, angle: 90, alt: 30, hi: 20, sh: 10 }), ...SURFACE, tint: [0.55, 0.45, 1], texOffset: [0.55, 0.8], texScale: 1.15 }
  },
  // indigo
  {
    id: "highkey",
    name: "High key",
    params: { ...fromSpec({ depth: 646, size: 4, soften: 4, angle: 90, alt: 30, hi: 25, sh: 25 }), ...SURFACE, tint: [0.82, 0.42, 1], texOffset: [0.3, 0.25], texScale: 0.85 }
  },
  // violet
  {
    id: "pillow",
    name: "Pillow",
    params: { ...fromSpec({ depth: 1e3, size: 5, soften: 16, angle: 73, alt: 21, hi: 10, sh: 10 }), ...SURFACE, tint: [1, 0.42, 0.78], texOffset: [0.85, 0.6], texScale: 0.6 }
  }
  // magenta
];

// visuals/src/emboss/adapter.ts
var adapter_default = {
  async mount(host, props) {
    let i = 0;
    const params = { ...PRESETS[1].params };
    const engine = new EmbossPlayground(host, params, {
      word: String(props.word ?? "press"),
      svg: null
    });
    if (!engine.ok) throw new Error("emboss: WebGL unavailable");
    engine.setFont("-apple-system, 'Helvetica Neue', Arial, sans-serif");
    const every = Number(props.cycleSeconds ?? 3) * 1e3;
    let timer = 0;
    return {
      start: () => {
        timer = window.setInterval(() => {
          i = (i + 1) % PRESETS.length;
          engine.setParams({ ...PRESETS[i].params });
        }, every);
      },
      action: async (name) => {
        if (name === "next") {
          i = (i + 1) % PRESETS.length;
          engine.setParams({ ...PRESETS[i].params });
        }
      },
      destroy: () => {
        if (timer) window.clearInterval(timer);
        engine.destroy();
      }
    };
  }
};
export {
  adapter_default as default
};
