// src/blur-reveal/panels.ts
var PANELS = [
  { line: "make it obvious", bg: "#0b3d3a", fg: "#f7c948" },
  { line: "then make it fast", bg: "#ff4d4d", fg: "#fff0e6" },
  { line: "sweat the details", bg: "#1b1440", fg: "#a78bfa" },
  { line: "ship it anyway", bg: "#f2e9d8", fg: "#c2410c" },
  { line: "keep it honest", bg: "#0891b2", fg: "#fef9c3" },
  { line: "cut what is dull", bg: "#18181b", fg: "#f472b6" }
];

// src/blur-reveal/reveal-shader.ts
var REVEAL_VERT = `
  attribute vec2 aPosition;
  attribute vec2 aUV;
  varying vec2 vUV;
  void main(){
    vUV = aUV;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;
var REVEAL_FRAG = `
  precision highp float;
  uniform sampler2D uTex;
  uniform vec2  uTexel;
  uniform float uProgress;
  uniform float uMaxBlur;
  uniform vec3  uEdge;
  uniform float uTime;
  uniform float uAspect;
  uniform float uSeed;
  varying vec2 vUV;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    float a = hash(i), b = hash(i+vec2(1,0)), c = hash(i+vec2(0,1)), d = hash(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }

  vec4 blurTex(vec2 uv, float radius){
    if (radius < 0.35) return texture2D(uTex, uv);
    vec2 r1 = uTexel * radius;
    vec2 r2 = uTexel * radius * 2.0;
    vec4 sum = texture2D(uTex, uv) * 1.0;
    float wsum = 1.0;

    for (int i = 0; i < 8; i++){
      float a = float(i) * 0.785398;
      vec2 dir = vec2(cos(a), sin(a));
      sum += texture2D(uTex, uv + dir * r1) * 0.75; wsum += 0.75;
      sum += texture2D(uTex, uv + dir * r2) * 0.5;  wsum += 0.5;
    }
    return sum / wsum;
  }

  float fbm(vec2 p){
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 4; i++){
      v += amp * noise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return v;
  }

  void main(){

    if (uProgress >= 0.999) { gl_FragColor = texture2D(uTex, vUV); return; }

    float p = uProgress * 1.3;

    vec2 sd = vec2(uSeed * 1.7, uSeed * -1.3);
    vec2 rc = (vUV - 0.5) * vec2(uAspect, 1.0);
    rc += vec2(sin(uSeed * 2.3), cos(uSeed * 1.9)) * 0.12;
    float radial = length(rc) * 0.9;
    vec2 warp = vec2(fbm(vUV * 3.2 + sd + uTime * 0.05 + 11.0),
                     fbm(vUV * 3.2 - sd - uTime * 0.04 - 7.0)) - 0.5;
    float turb = fbm(vUV * 5.5 + warp * 1.7 + sd + uTime * 0.06);
    float mask = mix(radial, turb, 0.7);

    float reveal = smoothstep(p + 0.34, p - 0.34, mask);
    if (reveal <= 0.0) discard;

    float blurAmt = smoothstep(p - 0.5, p + 0.34, mask);

    vec2 drift = (-rc * 0.010 + vec2(0.0, 0.006)) * blurAmt;
    float grow = 1.0 + 0.03 * blurAmt;
    vec2 suv = (vUV - 0.5) / grow + 0.5 + drift;

    float radius = blurAmt * uMaxBlur;
    vec4 tex = blurTex(suv, radius);

    float fw = 0.30;
    float flare = smoothstep(p - fw, p, mask) * smoothstep(p + fw, p, mask);
    flare *= 1.0 - smoothstep(0.8, 1.0, uProgress);

    vec4 wide = blurTex(suv, uMaxBlur * 1.3);
    float halo = wide.a;

    vec3 rgb = tex.rgb;

    vec3 glow = mix(uEdge, vec3(1.0), 0.3);
    rgb += glow * flare * (tex.a * 0.6 + halo * 0.5);
    float alpha = max(tex.a * reveal, halo * flare * 0.5);

    gl_FragColor = vec4(rgb, alpha);
  }
`;

// src/blur-reveal/gl.ts
var RevealGL = class {
  canvas;
  gl;
  prog;
  quad;
  loc = {};
  aPos = 0;
  aUV = 0;
  tex = null;
  texW = 1;
  texH = 1;
  ok = false;
  constructor() {
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block"
    });
    const gl = this.canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
    if (!gl) {
      this.gl = null;
      this.prog = null;
      this.quad = null;
      return;
    }
    this.gl = gl;
    this.prog = this.build(REVEAL_VERT, REVEAL_FRAG);
    this.aPos = gl.getAttribLocation(this.prog, "aPosition");
    this.aUV = gl.getAttribLocation(this.prog, "aUV");
    for (const u of ["uTex", "uTexel", "uProgress", "uMaxBlur", "uEdge", "uTime", "uAspect", "uSeed"]) {
      this.loc[u] = gl.getUniformLocation(this.prog, u);
    }
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
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.ok = true;
  }
  get available() {
    return this.ok;
  }
  build(vs, fs) {
    const gl = this.gl;
    const c = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) || "shader compile failed");
      }
      return sh;
    };
    const p = gl.createProgram();
    gl.attachShader(p, c(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, c(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p) || "program link failed");
    }
    return p;
  }
  setTexture(art) {
    if (!this.ok) return;
    const gl = this.gl;
    if (this.tex) gl.deleteTexture(this.tex);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art);
    this.tex = tex;
    this.texW = art.width;
    this.texH = art.height;
  }
  resize(w, h, dpr) {
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    if (this.ok) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  draw(progress, maxBlur, edge, time, aspect, seed) {
    if (!this.ok || !this.tex) return;
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(this.aUV);
    gl.vertexAttribPointer(this.aUV, 2, gl.FLOAT, false, 16, 8);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.loc.uTex, 0);
    gl.uniform2f(this.loc.uTexel, 1 / this.texW, 1 / this.texH);
    gl.uniform1f(this.loc.uProgress, progress);
    gl.uniform1f(this.loc.uMaxBlur, maxBlur);
    gl.uniform3f(this.loc.uEdge, edge[0], edge[1], edge[2]);
    gl.uniform1f(this.loc.uTime, time);
    gl.uniform1f(this.loc.uAspect, aspect);
    gl.uniform1f(this.loc.uSeed, seed);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  destroy() {
    if (!this.ok) return;
    const gl = this.gl;
    if (this.tex) gl.deleteTexture(this.tex);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
};

// src/blur-reveal/text-texture.ts
function renderText(o) {
  const dpr = o.dpr ?? Math.min(window.devicePixelRatio || 1, 2);
  const cssW = Math.max(1, Math.round(o.cardW));
  const cssH = Math.max(1, Math.round(o.cardH));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.fillStyle = o.fill;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxW = cssW * 0.86;
  let fontSize = Math.min(58, cssW * 0.1);
  for (let i = 0; i < 24; i++) {
    ctx.font = `500 ${fontSize}px ${o.font}`;
    if (ctx.measureText(o.line).width <= maxW || fontSize <= 16) break;
    fontSize -= 2;
  }
  ctx.fillText(o.line, cssW / 2, cssH / 2);
  return { canvas, cssW, cssH };
}

// src/blur-reveal/engine.ts
var HOLD_MS = 900;
var OUT_HOLD_MS = 40;
var BG_MS = 320;
var MAX_BLUR = 18;
var K_IN = 42;
var K_OUT = 60;
var DAMP = 1;
var REVEALED_AT = 0.992;
var GONE_AT = 0.02;
function resolveFamily(cssFamily) {
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden";
  probe.style.fontFamily = cssFamily;
  probe.textContent = "Ag";
  document.body.appendChild(probe);
  const fam = getComputedStyle(probe).fontFamily || "serif";
  document.body.removeChild(probe);
  return fam;
}
function springStep(pos, vel, target, k, damp, dt) {
  const c = 2 * Math.sqrt(k) * damp;
  const accel = -k * (pos - target) - c * vel;
  const v = vel + accel * dt;
  const x = pos + v * dt;
  return [x, v];
}
function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
var BlurReveal = class {
  host;
  stage;
  gl = null;
  useGL = false;
  fallback = null;
  fontFamily = "serif";
  index = 0;
  W = 1;
  H = 1;
  dpr = 1;
  raf = 0;
  running = false;
  disposed = false;
  now = 0;
  last = 0;
  clock = 0;
  phase = "in";
  phaseStart = 0;
  progress = 0;
  vel = 0;
  target = 1;
  edge = [1, 1, 1];
  seed = Math.random() * 100;
  ro;
  constructor(host) {
    this.host = host;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.measure();
    const stage = document.createElement("div");
    Object.assign(stage.style, {
      position: "absolute",
      inset: "0",
      background: PANELS[0].bg,
      transition: `background-color ${BG_MS}ms ease`,
      overflow: "hidden",
      fontFamily: "var(--font-neue-corp), system-ui, sans-serif"
    });
    host.appendChild(stage);
    this.stage = stage;
    this.fontFamily = resolveFamily("var(--font-neue-corp), system-ui, sans-serif");
    const gl = new RevealGL();
    if (gl.available) {
      this.gl = gl;
      this.useGL = true;
      gl.resize(this.W, this.H, this.dpr);
      stage.appendChild(gl.canvas);
    }
    this.ro = new ResizeObserver(() => this.onResize());
    this.ro.observe(host);
  }
  measure() {
    this.W = this.host.clientWidth || 1;
    this.H = this.host.clientHeight || 1;
  }
  onResize() {
    this.measure();
    if (this.W < 2 || this.H < 2) return;
    this.gl?.resize(this.W, this.H, this.dpr);
    this.mountPanel(this.index);
  }
  refreshFont() {
    this.fontFamily = resolveFamily("var(--font-neue-corp), system-ui, sans-serif");
    this.mountPanel(this.index);
  }
  mountPanel(i) {
    const p = PANELS[i];
    this.stage.style.background = p.bg;
    this.edge = hexToRgb(p.fg);
    if (this.useGL && this.gl) {
      const t = renderText({
        line: p.line,
        font: this.fontFamily,
        fill: p.fg,
        cardW: this.W,
        cardH: this.H,
        dpr: this.dpr
      });
      this.gl.setTexture(t.canvas);
    } else {
      this.mountFallback(p.line, p.fg);
    }
  }
  mountFallback(line, fg) {
    if (!this.fallback) {
      const el = document.createElement("div");
      Object.assign(el.style, {
        position: "absolute",
        inset: "0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8% 10%",
        fontStyle: "italic",
        fontWeight: "500",
        fontSize: "clamp(1.9rem, 7vw, 4rem)",
        textAlign: "center",
        transition: "opacity 300ms ease, filter 300ms ease"
      });
      this.stage.appendChild(el);
      this.fallback = el;
    }
    this.fallback.textContent = line;
    this.fallback.style.color = fg;
  }
  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.mountPanel(this.index);
    this.phase = "in";
    this.phaseStart = performance.now();
    this.last = this.phaseStart;
    this.progress = 0;
    this.vel = 0;
    this.target = 1;
    this.raf = requestAnimationFrame(this.loop);
  }
  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  loop = () => {
    if (!this.running) return;
    this.now = performance.now();
    const dt = Math.min(0.05, Math.max(1e-3, (this.now - this.last) / 1e3));
    this.last = this.now;
    this.clock += dt;
    const k = this.target > 0.5 ? K_IN : K_OUT;
    [this.progress, this.vel] = springStep(this.progress, this.vel, this.target, k, DAMP, dt);
    if (this.phase === "in") {
      if (this.progress >= REVEALED_AT) {
        this.phase = "hold";
        this.phaseStart = this.now;
      }
    } else if (this.phase === "hold") {
      if (this.now - this.phaseStart >= HOLD_MS) {
        this.phase = "out";
        this.phaseStart = this.now;
        this.target = 0;
      }
    } else {
      if (this.progress <= GONE_AT && this.now - this.phaseStart >= OUT_HOLD_MS) {
        this.index = (this.index + 1) % PANELS.length;
        this.seed = Math.random() * 100;
        this.mountPanel(this.index);
        this.phase = "in";
        this.phaseStart = this.now;
        this.progress = 0;
        this.vel = 0;
        this.target = 1;
      }
    }
    const clampP = Math.max(0, Math.min(1, this.progress));
    if (this.useGL && this.gl) {
      this.gl.draw(clampP, MAX_BLUR, this.edge, this.clock, this.W / Math.max(1, this.H), this.seed);
    } else if (this.fallback) {
      this.fallback.style.opacity = String(clampP);
      this.fallback.style.filter = `blur(${(1 - clampP) * 10}px)`;
    }
    this.raf = requestAnimationFrame(this.loop);
  };
  renderStill() {
    this.measure();
    this.gl?.resize(this.W, this.H, this.dpr);
    this.mountPanel(this.index);
    this.progress = 1;
    if (this.useGL && this.gl) this.gl.draw(1, 0, this.edge, 0, this.W / Math.max(1, this.H), this.seed);
    else if (this.fallback) {
      this.fallback.style.opacity = "1";
      this.fallback.style.filter = "none";
    }
  }
  destroy() {
    this.disposed = true;
    this.stop();
    this.ro?.disconnect();
    this.gl?.destroy();
    this.stage.parentNode?.removeChild(this.stage);
  }
};

// src/blur-reveal/adapter.ts
var adapter_default = {
  async mount(host, props) {
    if (Array.isArray(props.panels) && props.panels.length) {
      PANELS.splice(
        0,
        PANELS.length,
        ...props.panels
      );
    }
    const engine = new BlurReveal(host);
    return {
      start: () => engine.start(),
      destroy: () => engine.destroy()
    };
  }
};
export {
  adapter_default as default
};
