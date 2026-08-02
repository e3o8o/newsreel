// visuals/src/swirl/glyph-atlas.ts
var WEIGHT_REGULAR = 0;
var WEIGHT_BOLD = 1;
var WEIGHT_COUNT = 2;
function buildAtlas(gl, tex, scratch, glyphs, inkSize) {
  const { max, ceil, sqrt, floor } = Math;
  const ctx = scratch.getContext("2d");
  const baseFont = `${inkSize}px monospace`;
  ctx.font = baseFont;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const advance = ctx.measureText("M").width;
  let asc = 0;
  let desc = 0;
  for (let w = 0; w < WEIGHT_COUNT; w++) {
    ctx.font = w === WEIGHT_BOLD ? `bold ${baseFont}` : baseFont;
    for (const g of glyphs) {
      const m = ctx.measureText(g);
      asc = max(asc, m.actualBoundingBoxAscent || inkSize * 0.8);
      desc = max(desc, m.actualBoundingBoxDescent || inkSize * 0.25);
    }
  }
  const pad = max(2, ceil(inkSize * 0.18));
  const cellW = max(1, ceil(advance + pad * 2));
  const cellH = max(1, ceil(asc + desc + pad * 2));
  const baseline = pad + ceil(asc);
  const count = glyphs.length * WEIGHT_COUNT;
  const cols = ceil(sqrt(count));
  const rows = ceil(count / cols);
  scratch.width = cols * cellW;
  scratch.height = rows * cellH;
  ctx.clearRect(0, 0, scratch.width, scratch.height);
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const uvs = new Array(count);
  for (let w = 0; w < WEIGHT_COUNT; w++) {
    ctx.font = w === WEIGHT_BOLD ? `bold ${baseFont}` : baseFont;
    for (let i = 0; i < glyphs.length; i++) {
      const idx = w * glyphs.length + i;
      const cx = idx % cols * cellW;
      const cy = floor(idx / cols) * cellH;
      ctx.fillText(glyphs[i], cx + pad, cy + baseline);
      uvs[idx] = [
        cx / scratch.width,
        cy / scratch.height,
        (cx + cellW) / scratch.width,
        (cy + cellH) / scratch.height
      ];
    }
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scratch);
  return { inkSize, advance, cellW, cellH, baseline, pad, uvs, canvas: scratch };
}

// visuals/src/swirl/crt-pass.ts
var BARREL_GAIN = 0.1;
var BARREL_PINCH = 0.085;
var BARREL_EDGE = 0.05;
var ABERRATION_UV = 28e-4;
var VIGNETTE = 0.7;
var TONEMAP_EXPOSURE = 2.2;
var CURVE_RAMP_SEC = 3;
var CRT_FRAG = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uTime;
uniform vec2 uRes;
uniform float uScanline;
uniform float uAberration;
uniform float uCurvature;
uniform vec3 uBg;
float easeOutQuad(float t){ return t*(2.0-t); }
void main(){
  float prog = min(uTime / ${CRT_NUM(CURVE_RAMP_SEC)}, 1.0);
  float curve = easeOutQuad(prog) * uCurvature;
  vec2 c = vUv * 2.0 - 1.0;
  c *= 1.0 + ${CRT_NUM(BARREL_GAIN)} * curve;
  c *= 1.0 - ${CRT_NUM(BARREL_PINCH)} * curve + ${CRT_NUM(BARREL_EDGE)} * curve * pow(abs(c.yx), vec2(2.0));
  c = c * 0.5 + 0.5;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0){ gl_FragColor = vec4(uBg, 1.0); return; }
  float d = uAberration * ${CRT_NUM(ABERRATION_UV)};
  float r = texture2D(uTex, vec2(c.x + d, c.y)).r;
  float g = texture2D(uTex, c).g;
  float b = texture2D(uTex, vec2(c.x - d, c.y)).b;
  vec3 col = vec3(r, g, b);

  // How light the background is (0 = black, 1 = white). The CRT darkening tricks
  // (vignette toward black, filmic tonemap) are tuned for a dark tube and leave
  // a grey halo on a light field, so we fade them out as the bg gets lighter.
  float bgLum = dot(uBg, vec3(0.299, 0.587, 0.114));
  float darkMode = 1.0 - smoothstep(0.4, 0.8, bgLum);

  float scan = max(0.0, sin((c.y + uTime * 0.0005) * uRes.y)) * 0.5;
  col = mix(col, col - vec3(scan), uScanline);

  // Vignette fades the edges toward the ACTUAL background (not black), so on a
  // white field the corners stay white instead of going grey.
  float vig = length(c - 0.5) * ${CRT_NUM(VIGNETTE)};
  col = mix(col, uBg, clamp(vig, 0.0, 1.0) * darkMode);

  // Filmic glow/tonemap only on dark backgrounds; on light it would dull white.
  vec3 toned = 1.0 - exp(-col * ${CRT_NUM(TONEMAP_EXPOSURE)});
  col = mix(col, toned, darkMode);

  gl_FragColor = vec4(col, 1.0);
}`;
var CRT_VERT = `attribute vec4 aPos; attribute vec2 aUv; varying vec2 vUv;
void main(){ gl_Position = aPos; vUv = aUv; }`;
var TEXT_VERT = `attribute vec2 aCorner; attribute vec4 aBounds; attribute vec4 aGlyphUv; attribute vec4 aColor;
uniform vec2 uTarget; varying vec2 vGlyphUv; varying vec4 vColor;
void main(){
  vec2 px = mix(aBounds.xy, aBounds.zw, aCorner);
  vec2 clip = vec2((px.x / uTarget.x) * 2.0 - 1.0, 1.0 - (px.y / uTarget.y) * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  vGlyphUv = mix(aGlyphUv.xy, aGlyphUv.zw, aCorner);
  vColor = aColor;
}`;
var TEXT_FRAG = `precision mediump float; varying vec2 vGlyphUv; varying vec4 vColor; uniform sampler2D uAtlas;
void main(){ float a = texture2D(uAtlas, vGlyphUv).a; if(a <= 0.001) discard; gl_FragColor = vec4(vColor.rgb, vColor.a * a); }`;
function CRT_NUM(n) {
  const s = String(n);
  return s.includes(".") ? s : s + ".0";
}

// visuals/src/swirl/renderer.ts
function createRenderer(canvas) {
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, depth: false });
  if (!gl) return null;
  gl.disable(gl.DEPTH_TEST);
  const scratch = document.createElement("canvas");
  if (!scratch.getContext("2d")) return null;
  let ok = true;
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("swirl shader compile failed:", gl.getShaderInfoLog(s));
      ok = false;
    }
    return s;
  };
  const link = (vs, fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error("swirl program link failed:", gl.getProgramInfoLog(p));
      ok = false;
    }
    return p;
  };
  const crtProg = link(compile(gl.VERTEX_SHADER, CRT_VERT), compile(gl.FRAGMENT_SHADER, CRT_FRAG));
  const textProg = link(compile(gl.VERTEX_SHADER, TEXT_VERT), compile(gl.FRAGMENT_SHADER, TEXT_FRAG));
  if (!ok) return null;
  const C = {
    aPos: gl.getAttribLocation(crtProg, "aPos"),
    aUv: gl.getAttribLocation(crtProg, "aUv"),
    uTex: gl.getUniformLocation(crtProg, "uTex"),
    uTime: gl.getUniformLocation(crtProg, "uTime"),
    uRes: gl.getUniformLocation(crtProg, "uRes"),
    uScanline: gl.getUniformLocation(crtProg, "uScanline"),
    uAberration: gl.getUniformLocation(crtProg, "uAberration"),
    uCurvature: gl.getUniformLocation(crtProg, "uCurvature"),
    uBg: gl.getUniformLocation(crtProg, "uBg")
  };
  const T = {
    aCorner: gl.getAttribLocation(textProg, "aCorner"),
    aBounds: gl.getAttribLocation(textProg, "aBounds"),
    aGlyphUv: gl.getAttribLocation(textProg, "aGlyphUv"),
    aColor: gl.getAttribLocation(textProg, "aColor"),
    uTarget: gl.getUniformLocation(textProg, "uTarget"),
    uAtlas: gl.getUniformLocation(textProg, "uAtlas")
  };
  const posBuf = gl.createBuffer();
  const uvBuf = gl.createBuffer();
  const cornerBuf = gl.createBuffer();
  const boundsBuf = gl.createBuffer();
  const glyphUvBuf = gl.createBuffer();
  const colorBuf = gl.createBuffer();
  const glyphTex = gl.createTexture();
  const textTex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const configureTex = (tex) => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  };
  configureTex(glyphTex);
  configureTex(textTex);
  const allocStream = (buffer, data) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  };
  const streamAttr = (buffer, data, loc) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribDivisor(loc, 1);
  };
  return {
    gl,
    glyphTex,
    scratch,
    resizeTargets(cw, ch) {
      canvas.width = cw;
      canvas.height = ch;
      gl.bindTexture(gl.TEXTURE_2D, textTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cw, ch, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    allocCells(buffers) {
      allocStream(boundsBuf, buffers.bounds);
      allocStream(glyphUvBuf, buffers.glyphUvs);
      allocStream(colorBuf, buffers.colors);
    },
    drawField(count, grid, buffers, bg) {
      void grid;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.DEPTH_TEST);
      gl.clearColor(bg[0], bg[1], bg[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(textProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, glyphTex);
      gl.uniform1i(T.uAtlas, 0);
      gl.uniform2f(T.uTarget, canvas.width, canvas.height);
      gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
      gl.vertexAttribPointer(T.aCorner, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(T.aCorner);
      gl.vertexAttribDivisor(T.aCorner, 0);
      streamAttr(boundsBuf, buffers.bounds.subarray(0, count * 4), T.aBounds);
      streamAttr(glyphUvBuf, buffers.glyphUvs.subarray(0, count * 4), T.aGlyphUv);
      streamAttr(colorBuf, buffers.colors.subarray(0, count * 4), T.aColor);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      gl.vertexAttribDivisor(T.aBounds, 0);
      gl.vertexAttribDivisor(T.aGlyphUv, 0);
      gl.vertexAttribDivisor(T.aColor, 0);
    },
    drawCrt(elapsedSec, cw, ch, u) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, cw, ch);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(crtProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textTex);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.vertexAttribPointer(C.aPos, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(C.aPos);
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
      gl.vertexAttribPointer(C.aUv, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(C.aUv);
      gl.uniform1i(C.uTex, 0);
      gl.uniform1f(C.uTime, elapsedSec);
      gl.uniform2f(C.uRes, cw, ch);
      gl.uniform1f(C.uScanline, u.scanline);
      gl.uniform1f(C.uAberration, u.aberration);
      gl.uniform1f(C.uCurvature, u.curvature);
      gl.uniform3f(C.uBg, u.bg[0], u.bg[1], u.bg[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
    }
  };
}

// visuals/src/swirl/color.ts
function hexToRgb01(hex) {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

// visuals/src/swirl/trail-field.ts
var TRAIL_W = 72;
var TRAIL_H = 40;
var DEPOSIT_RADIUS = 0.15;
var DEPOSIT_BASE = 0.05;
var DEPOSIT_SPEED = 0.8;
var HEAT_MAX = 0.7;
var DECAY_PER_SEC = 0.025;
var DIFFUSE = 0.12;
var FLOW_BLEND = 0.25;
function makeTrailField() {
  const n = TRAIL_W * TRAIL_H;
  return {
    heat: new Float32Array(n),
    flowX: new Float32Array(n),
    flowY: new Float32Array(n),
    tmp: new Float32Array(n)
  };
}
var toGX = (nx) => (nx + 1) / 2 * (TRAIL_W - 1);
var toGY = (ny) => (ny + 1) / 2 * (TRAIL_H - 1);
function depositTrail(t, nx, ny, vx, vy, dt) {
  const speed = Math.min(3, Math.hypot(vx, vy));
  const amount = (DEPOSIT_BASE + DEPOSIT_SPEED * speed) * dt;
  const dirLen = Math.hypot(vx, vy) || 1;
  const dirX = vx / dirLen;
  const dirY = vy / dirLen;
  const gx = toGX(nx);
  const gy = toGY(ny);
  const rx = DEPOSIT_RADIUS * (TRAIL_W / 2);
  const ry = DEPOSIT_RADIUS * (TRAIL_H / 2);
  const x0 = Math.max(0, Math.floor(gx - rx * 2));
  const x1 = Math.min(TRAIL_W - 1, Math.ceil(gx + rx * 2));
  const y0 = Math.max(0, Math.floor(gy - ry * 2));
  const y1 = Math.min(TRAIL_H - 1, Math.ceil(gy + ry * 2));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const ddx = (x - gx) / rx;
      const ddy = (y - gy) / ry;
      const fall = Math.exp(-(ddx * ddx + ddy * ddy));
      if (fall < 0.01) continue;
      const i = y * TRAIL_W + x;
      t.heat[i] = Math.min(HEAT_MAX, t.heat[i] + amount * fall);
      const w = FLOW_BLEND * fall;
      t.flowX[i] += (dirX - t.flowX[i]) * w;
      t.flowY[i] += (dirY - t.flowY[i]) * w;
    }
  }
}
function stepTrail(t, dt) {
  const keep = Math.exp(-DECAY_PER_SEC * dt);
  const { heat, tmp } = t;
  for (let y = 0; y < TRAIL_H; y++) {
    for (let x = 0; x < TRAIL_W; x++) {
      const i = y * TRAIL_W + x;
      const l = x > 0 ? heat[i - 1] : heat[i];
      const rr = x < TRAIL_W - 1 ? heat[i + 1] : heat[i];
      const u = y > 0 ? heat[i - TRAIL_W] : heat[i];
      const d = y < TRAIL_H - 1 ? heat[i + TRAIL_W] : heat[i];
      tmp[i] = (l + rr + u + d) * 0.25;
    }
  }
  for (let i = 0; i < heat.length; i++) {
    heat[i] = (heat[i] + (tmp[i] - heat[i]) * DIFFUSE) * keep;
  }
}
function sampleTrail(t, nx, ny, out) {
  const gx = toGX(nx);
  const gy = toGY(ny);
  const x0 = Math.max(0, Math.min(TRAIL_W - 1, Math.floor(gx)));
  const y0 = Math.max(0, Math.min(TRAIL_H - 1, Math.floor(gy)));
  const x1 = Math.min(TRAIL_W - 1, x0 + 1);
  const y1 = Math.min(TRAIL_H - 1, y0 + 1);
  const tx = gx - x0;
  const ty = gy - y0;
  const i00 = y0 * TRAIL_W + x0;
  const i10 = y0 * TRAIL_W + x1;
  const i01 = y1 * TRAIL_W + x0;
  const i11 = y1 * TRAIL_W + x1;
  const lerp = (a, b, f) => a + (b - a) * f;
  const bi = (arr) => lerp(lerp(arr[i00], arr[i10], tx), lerp(arr[i01], arr[i11], tx), ty);
  out.heat = bi(t.heat);
  out.fx = bi(t.flowX);
  out.fy = bi(t.flowY);
}

// visuals/src/swirl/vortex-field.ts
var TWIST_RATE = 0.1;
var CORE_FLOOR = 0.1;
var FORMATION_SEC = 1.8;
var STENCIL_HALO = 4;
var FIELD_EXTENT = 1;
var SPACE = " ";
var easeOutQuad = (t) => t * (2 - t);
var mix = (a, b, t) => a * (1 - t) + b * t;
var clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
var twistAt = (spin, dist) => spin * TWIST_RATE / Math.max(CORE_FLOOR, dist);
function carveStencil(rows) {
  const w = Math.max(0, ...rows.map((l) => l.length));
  return rows.map((line) => {
    const isInk = (x) => x >= 0 && x < w && line[x] !== void 0 && line[x] !== " ";
    return Array.from({ length: w }, (_u, x) => {
      if (isInk(x) || isInk(x - 1) || isInk(x + 1)) return true;
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
function makeTarget(rows) {
  const w = Math.max(0, ...rows.map((l) => l.length));
  const padded = rows.map((l) => l.padEnd(w, " "));
  return { rows: padded, stencil: carveStencil(padded) };
}
function makeBuffers(maxCells) {
  return {
    bounds: new Float32Array(maxCells * 4),
    glyphUvs: new Float32Array(maxCells * 4),
    colors: new Float32Array(maxCells * 4)
  };
}
var HUE_DRIFT = 0.12;
var HUE_DRIFT_SPEED = 0.6;
var SPEED_DIM = 0.55;
function rampAt(stops, t) {
  t = t - Math.floor(t);
  const seg = t * stops.length;
  const i = Math.floor(seg) % stops.length;
  const j = (i + 1) % stops.length;
  const f = seg - Math.floor(seg);
  const a = stops[i];
  const b = stops[j];
  return [mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f)];
}
var WAKE_PUSH = 0.34;
var SWIRL_GAIN = 4.5;
var TRAIL_NOISE = 0.9;
var FLARE_GAIN = 2.4;
var SHOCK_SPEED = 1.4;
var SHOCK_WIDTH = 0.13;
var SHOCK_PUSH = 0.12;
var SHOCK_FADE = 1.9;
var cellHash = (col, row) => {
  const n = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
function paintAt(paint, s) {
  const stops = paint.stops;
  if (!paint.gradient || stops.length < 2) return stops[0];
  let t;
  if (paint.mode === "axis") {
    const ca = Math.cos(paint.angle);
    const sa = Math.sin(paint.angle);
    t = (s.fx * ca + s.fy * sa) * 0.5 + 0.5 + paint.flow;
  } else {
    t = s.srcRow + paint.flow;
  }
  t += Math.sin(s.time * HUE_DRIFT_SPEED + s.jitter * Math.PI * 2) * HUE_DRIFT * s.jitter;
  const rgb = rampAt(stops, t);
  const bright = mix(SPEED_DIM, 1, s.speed);
  return [rgb[0] * bright, rgb[1] * bright, rgb[2] * bright];
}
function pushCell(buf, atlas, glyphSlot, x, baseline, rgb, alpha, state) {
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
var WAVE_AMP = 0.16;
var WAVE_FREQ = 2.4;
var WAVE_SPEED = 0.9;
var WAVE_DIR = Math.PI * 0.15;
var vnoise = (x, y) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const h = (a2, b2) => {
    const n = Math.sin(a2 * 127.1 + b2 * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
};
function composeField(args) {
  const { grid, atlas, buffers, source, target, elapsed, paint, logo, slotOf, trail, shocks, turbulence } = args;
  const wavePattern = args.wavePattern ?? "wavefront";
  const trailStrength = args.trailStrength ?? 1;
  const flare = args.trailFlare;
  const { sin, cos, sqrt, floor, round, exp, max, PI } = Math;
  const spin = elapsed * 1e-3;
  const turbOn = !!turbulence && turbulence > 1e-3;
  const tWave = elapsed * 1e-3 * WAVE_SPEED;
  const waveDirX = cos(WAVE_DIR);
  const waveDirY = sin(WAVE_DIR);
  const formation = easeOutQuad(clamp01(elapsed * 1e-3 / FORMATION_SEC));
  const lum = 0.299 * logo[0] + 0.587 * logo[1] + 0.114 * logo[2];
  const hi = lum < 0.5 ? [mix(logo[0], 1, 0.5), mix(logo[1], 1, 0.5), mix(logo[2], 1, 0.5)] : [mix(logo[0], 0, 0.35), mix(logo[1], 0, 0.35), mix(logo[2], 0, 0.35)];
  const lines = source;
  const tw = target.rows;
  const tWidth = tw[0]?.length ?? 0;
  const state = { count: 0 };
  const trailOn = !!trail;
  const ts = { heat: 0, fx: 0, fy: 0 };
  const shockOn = !!shocks && shocks.length > 0;
  const halfW = grid.cols * atlas.advance / 2;
  const halfH = grid.rows * grid.inkSize / 2;
  for (let row = 0; row < grid.rows; row++) {
    const y = (1 - row * 2 / grid.rows) * FIELD_EXTENT;
    const baseline = grid.vOffset + row * grid.inkSize;
    const sny = (row + 0.5) / grid.rows * 2 - 1;
    for (let col = 0; col < grid.cols; col++) {
      const x = (col * 2 / grid.cols - 1) * FIELD_EXTENT;
      const snx = (col + 0.5) / grid.cols * 2 - 1;
      const dist = sqrt(x * x + y * y);
      let heat = 0;
      if (trailOn) {
        sampleTrail(trail, snx, sny, ts);
        heat = ts.heat;
      }
      const twist = twistAt(spin, dist) * (1 + SWIRL_GAIN * heat * trailStrength);
      const s = sin(twist);
      const cse = cos(twist);
      const rx = x * cse + y * s;
      const ry = x * s - y * cse;
      const sampleCol = floor((rx + 1) / 2 * grid.cols);
      const sampleRow = floor((ry + 1) / 2 * grid.rows);
      const srcLine = lines[(sampleRow % lines.length + lines.length) % lines.length] ?? "";
      let ch = sampleCol >= 0 && sampleCol < srcLine.length ? srcLine[sampleCol] ?? SPACE : SPACE;
      let resolved = SPACE;
      const tx = col - grid.targetX;
      const ty = row - grid.targetY;
      const inTarget = tx >= 0 && tx < tWidth && ty >= 0 && ty < tw.length;
      const inLogo = inTarget && !!target.stencil[ty]?.[tx];
      if (inLogo) {
        const wordChar = tw[ty][tx];
        if (wordChar && wordChar !== " ") {
          ch = String.fromCharCode(
            round(mix(ch.charCodeAt(0), wordChar.charCodeAt(0), formation))
          );
          resolved = ch;
        } else if (formation > 0.5) {
          ch = SPACE;
        }
      }
      if (ch === SPACE && resolved === SPACE) continue;
      let dx = 0;
      let dy = 0;
      if (trailOn && !inLogo && heat > 1e-3) {
        const noise = 1 + (cellHash(col, row) - 0.5) * TRAIL_NOISE;
        const push = WAKE_PUSH * heat * trailStrength * noise;
        dx += ts.fx * push;
        dy += ts.fy * push;
        dx += -ts.fy * push * 0.5;
        dy += ts.fx * push * 0.5;
      }
      if (shockOn && !inLogo) {
        for (let k = 0; k < shocks.length; k++) {
          const sh = shocks[k];
          const ox = snx - sh.x;
          const oy = sny - sh.y;
          const r = sqrt(ox * ox + oy * oy);
          const ringR = sh.age * SHOCK_SPEED;
          const d = (r - ringR) / SHOCK_WIDTH;
          const crest = exp(-d * d) * exp(-sh.age * SHOCK_FADE);
          if (crest > 2e-3) {
            const inv = 1 / max(1e-4, r);
            const push = SHOCK_PUSH * crest;
            dx += ox * inv * push;
            dy += oy * inv * push;
          }
        }
      }
      if (turbOn && !inLogo) {
        const a = WAVE_AMP * turbulence;
        if (wavePattern === "wavefront") {
          const phase = (snx * waveDirX + sny * waveDirY) * WAVE_FREQ * PI - tWave * PI;
          const w = sin(phase);
          dx += a * w * waveDirX;
          dy += a * w * waveDirY;
        } else if (wavePattern === "ripples") {
          const r = sqrt(snx * snx + sny * sny);
          const w = sin(r * WAVE_FREQ * PI * 1.6 - tWave * PI);
          const inv = 1 / max(0.08, r);
          dx += a * w * snx * inv;
          dy += a * w * sny * inv;
        } else if (wavePattern === "flow") {
          const nx = vnoise(snx * 1.6 + tWave * 0.4, sny * 1.6);
          const ny = vnoise(sny * 1.6 - tWave * 0.4 + 7.3, snx * 1.6 + 3.1);
          dx += a * 1.4 * nx;
          dy += a * 1.4 * ny;
        } else {
          dx += a * 1.3 * sin(sny * WAVE_FREQ * PI * 0.9 + tWave * PI * 1.2);
          dy += a * 0.35 * sin(snx * WAVE_FREQ * PI + tWave * PI);
        }
      }
      const px = col * atlas.advance + dx * halfW;
      const by = baseline + dy * halfH;
      const fx = col * 2 / grid.cols - 1;
      const fy = 1 - row * 2 / grid.rows;
      const srcRow = floor((ry + 1) / 2 * grid.rows);
      const rgb = paintAt(paint, {
        fx,
        fy,
        srcRow: (srcRow % grid.rows + grid.rows) % grid.rows / grid.rows,
        jitter: cellHash(col, row),
        speed: clamp01(1 - dist),
        time: spin
      });
      let cellRgb = rgb;
      if (flare && heat > 1e-3 && !inLogo) {
        const t = clamp01(heat * FLARE_GAIN * trailStrength);
        cellRgb = [mix(rgb[0], flare[0], t), mix(rgb[1], flare[1], t), mix(rgb[2], flare[2], t)];
      }
      if (ch !== SPACE) {
        pushCell(buffers, atlas, slotOf(ch, WEIGHT_REGULAR), px, by, cellRgb, 1, state);
      }
      if (resolved !== SPACE) {
        pushCell(buffers, atlas, slotOf(resolved, WEIGHT_BOLD), px, by, logo, formation, state);
        pushCell(buffers, atlas, slotOf(resolved, WEIGHT_BOLD), px, by, hi, formation * 0.5, state);
      }
    }
  }
  return state.count;
}

// visuals/src/swirl/figlet-fonts.ts
var FIGLET_FONTS = {
  slant: {
    "0": ["   ____ ", "  / __ \\", " / / / /", "/ /_/ / ", "\\____/  "],
    "1": ["   ___", "  <  /", "  / / ", " / /  ", "/_/   "],
    "2": ["   ___ ", "  |__ \\", "  __/ /", " / __/ ", "/____/ "],
    "3": ["   _____", "  |__  /", "   /_ < ", " ___/ / ", "/____/  "],
    "4": ["   __ __", "  / // /", " / // /_", "/__  __/", "  /_/   "],
    "5": ["    ______", "   / ____/", "  /___ \\  ", " ____/ /  ", "/_____/   "],
    "6": ["   _____", "  / ___/", " / __ \\ ", "/ /_/ / ", "\\____/  "],
    "7": [" _____", "/__  /", "  / / ", " / /  ", "/_/   "],
    "8": ["   ____ ", "  ( __ )", " / __  |", "/ /_/ / ", "\\____/  "],
    "9": ["   ____ ", "  / __ \\", " / /_/ /", " \\__, / ", "/____/  "],
    "A": ["    ___ ", "   /   |", "  / /| |", " / ___ |", "/_/  |_|"],
    "B": ["    ____ ", "   / __ )", "  / __  |", " / /_/ / ", "/_____/  "],
    "C": ["   ______", "  / ____/", " / /     ", "/ /___   ", "\\____/   "],
    "D": ["    ____ ", "   / __ \\", "  / / / /", " / /_/ / ", "/_____/  "],
    "E": ["    ______", "   / ____/", "  / __/   ", " / /___   ", "/_____/   "],
    "F": ["    ______", "   / ____/", "  / /_    ", " / __/    ", "/_/       "],
    "G": ["   ______", "  / ____/", " / / __  ", "/ /_/ /  ", "\\____/   "],
    "H": ["    __  __", "   / / / /", "  / /_/ / ", " / __  /  ", "/_/ /_/   "],
    "I": ["    ____", "   /  _/", "   / /  ", " _/ /   ", "/___/   "],
    "J": ["       __", "      / /", " __  / / ", "/ /_/ /  ", "\\____/   "],
    "K": ["    __ __", "   / //_/", "  / ,<   ", " / /| |  ", "/_/ |_|  "],
    "L": ["    __ ", "   / / ", "  / /  ", " / /___", "/_____/"],
    "M": ["    __  ___", "   /  |/  /", "  / /|_/ / ", " / /  / /  ", "/_/  /_/   "],
    "N": ["    _   __", "   / | / /", "  /  |/ / ", " / /|  /  ", "/_/ |_/   "],
    "O": ["   ____ ", "  / __ \\", " / / / /", "/ /_/ / ", "\\____/  "],
    "P": ["    ____ ", "   / __ \\", "  / /_/ /", " / ____/ ", "/_/      "],
    "Q": ["   ____ ", "  / __ \\", " / / / /", "/ /_/ / ", "\\___\\_\\ "],
    "R": ["    ____ ", "   / __ \\", "  / /_/ /", " / _, _/ ", "/_/ |_|  "],
    "S": ["   _____", "  / ___/", "  \\__ \\ ", " ___/ / ", "/____/  "],
    "T": ["  ______", " /_  __/", "  / /   ", " / /    ", "/_/     "],
    "U": ["   __  __", "  / / / /", " / / / / ", "/ /_/ /  ", "\\____/   "],
    "V": [" _    __", "| |  / /", "| | / / ", "| |/ /  ", "|___/   "],
    "W": [" _       __", "| |     / /", "| | /| / / ", "| |/ |/ /  ", "|__/|__/   "],
    "X": ["   _  __", "  | |/ /", "  |   / ", " /   |  ", "/_/|_|  "],
    "Y": ["__  __", "\\ \\/ /", " \\  / ", " / /  ", "/_/   "],
    "Z": [" _____", "/__  /", "  / / ", " / /__", "/____/"],
    " ": ["         ", "         ", "         ", "         ", "         "],
    "!": ["    __", "   / /", "  / / ", " /_/  ", "(_)   "],
    "?": ["  ___ ", " /__ \\", "  / _/", " /_/  ", "(_)   "],
    ".": ["   ", "   ", "   ", " _ ", "(_)"],
    "-": ["       ", "       ", " ______", "/_____/", "       "]
  },
  standard: {
    "0": ["   ___  ", "  / _ \\ ", " | | | |", " | |_| |", "  \\___/ "],
    "1": ["  _ ", " / |", " | |", " | |", " |_|"],
    "2": ["  ____  ", " |___ \\ ", "   __) |", "  / __/ ", " |_____|"],
    "3": ["  _____ ", " |___ / ", "   |_ \\ ", "  ___) |", " |____/ "],
    "4": ["  _  _   ", " | || |  ", " | || |_ ", " |__   _|", "    |_|  "],
    "5": ["  ____  ", " | ___| ", " |___ \\ ", "  ___) |", " |____/ "],
    "6": ["   __   ", "  / /_  ", " | '_ \\ ", " | (_) |", "  \\___/ "],
    "7": ["  _____ ", " |___  |", "    / / ", "   / /  ", "  /_/   "],
    "8": ["   ___  ", "  ( _ ) ", "  / _ \\ ", " | (_) |", "  \\___/ "],
    "9": ["   ___  ", "  / _ \\ ", " | (_) |", "  \\__, |", "    /_/ "],
    "A": ["     _    ", "    / \\   ", "   / _ \\  ", "  / ___ \\ ", " /_/   \\_\\"],
    "B": ["  ____  ", " | __ ) ", " |  _ \\ ", " | |_) |", " |____/ "],
    "C": ["   ____ ", "  / ___|", " | |    ", " | |___ ", "  \\____|"],
    "D": ["  ____  ", " |  _ \\ ", " | | | |", " | |_| |", " |____/ "],
    "E": ["  _____ ", " | ____|", " |  _|  ", " | |___ ", " |_____|"],
    "F": ["  _____ ", " |  ___|", " | |_   ", " |  _|  ", " |_|    "],
    "G": ["   ____ ", "  / ___|", " | |  _ ", " | |_| |", "  \\____|"],
    "H": ["  _   _ ", " | | | |", " | |_| |", " |  _  |", " |_| |_|"],
    "I": ["  ___ ", " |_ _|", "  | | ", "  | | ", " |___|"],
    "J": ["      _ ", "     | |", "  _  | |", " | |_| |", "  \\___/ "],
    "K": ["  _  __", " | |/ /", " | ' / ", " | . \\ ", " |_|\\_\\"],
    "L": ["  _     ", " | |    ", " | |    ", " | |___ ", " |_____|"],
    "M": ["  __  __ ", " |  \\/  |", " | |\\/| |", " | |  | |", " |_|  |_|"],
    "N": ["  _   _ ", " | \\ | |", " |  \\| |", " | |\\  |", " |_| \\_|"],
    "O": ["   ___  ", "  / _ \\ ", " | | | |", " | |_| |", "  \\___/ "],
    "P": ["  ____  ", " |  _ \\ ", " | |_) |", " |  __/ ", " |_|    "],
    "Q": ["   ___  ", "  / _ \\ ", " | | | |", " | |_| |", "  \\__\\_\\"],
    "R": ["  ____  ", " |  _ \\ ", " | |_) |", " |  _ < ", " |_| \\_\\"],
    "S": ["  ____  ", " / ___| ", " \\___ \\ ", "  ___) |", " |____/ "],
    "T": ["  _____ ", " |_   _|", "   | |  ", "   | |  ", "   |_|  "],
    "U": ["  _   _ ", " | | | |", " | | | |", " | |_| |", "  \\___/ "],
    "V": [" __     __", " \\ \\   / /", "  \\ \\ / / ", "   \\ V /  ", "    \\_/   "],
    "W": [" __        __", " \\ \\      / /", "  \\ \\ /\\ / / ", "   \\ V  V /  ", "    \\_/\\_/   "],
    "X": [" __  __", " \\ \\/ /", "  \\  / ", "  /  \\ ", " /_/\\_\\"],
    "Y": [" __   __", " \\ \\ / /", "  \\ V / ", "   | |  ", "   |_|  "],
    "Z": ["  _____", " |__  /", "   / / ", "  / /_ ", " /____|"],
    " ": ["   ", "   ", "   ", "   ", "   "],
    "!": ["  _ ", " | |", " | |", " |_|", " (_)"],
    "?": ["  ___ ", " |__ \\", "   / /", "  |_| ", "  (_) "],
    ".": ["    ", "    ", "    ", "  _ ", " (_)"],
    "-": ["        ", "        ", "  _____ ", " |_____|", "        "]
  },
  ogre: {
    "0": ["  ___  ", " / _ \\ ", "| | | |", "| |_| |", " \\___/ "],
    "1": [" _ ", "/ |", "| |", "| |", "|_|"],
    "2": [" ____  ", "|___ \\ ", "  __) |", " / __/ ", "|_____|"],
    "3": [" _____ ", "|___ / ", "  |_ \\ ", " ___) |", "|____/ "],
    "4": [" _  _   ", "| || |  ", "| || |_ ", "|__   _|", "   |_|  "],
    "5": [" ____  ", "| ___| ", "|___ \\ ", " ___) |", "|____/ "],
    "6": ["  __   ", " / /_  ", "| '_ \\ ", "| (_) |", " \\___/ "],
    "7": [" _____ ", "|___  |", "   / / ", "  / /  ", " /_/   "],
    "8": ["  ___  ", " ( _ ) ", " / _ \\ ", "| (_) |", " \\___/ "],
    "9": ["  ___  ", " / _ \\ ", "| (_) |", " \\__, |", "   /_/ "],
    "A": ["   _   ", "  /_\\  ", " //_\\\\ ", "/  _  \\", "\\_/ \\_/"],
    "B": ["   ___ ", "  / __\\", " /__\\//", "/ \\/  \\", "\\_____/"],
    "C": ["   ___ ", "  / __\\", " / /   ", "/ /___ ", "\\____/ "],
    "D": ["    ___ ", "   /   \\", "  / /\\ /", " / /_// ", "/___,'  "],
    "E": ["   __ ", "  /__\\", " /_\\  ", "//__  ", "\\__/  "],
    "F": ["   ___ ", "  / __\\", " / _\\  ", "/ /    ", "\\/     "],
    "G": ["   ___ ", "  / _ \\", " / /_\\/", "/ /_\\\\ ", "\\____/ "],
    "H": ["        ", "  /\\  /\\", " / /_/ /", "/ __  / ", "\\/ /_/  "],
    "I": ["  _____ ", "  \\_   \\", "   / /\\/", "/\\/ /_  ", "\\____/  "],
    "J": ["   __  ", "   \\ \\ ", "    \\ \\", " /\\_/ /", " \\___/ "],
    "K": ["       ", "  /\\ /\\", " / //_/", "/ __ \\ ", "\\/  \\/ "],
    "L": ["   __  ", "  / /  ", " / /   ", "/ /___ ", "\\____/ "],
    "M": ["        ", "  /\\/\\  ", " /    \\ ", "/ /\\/\\ \\", "\\/    \\/"],
    "N": ["     __ ", "  /\\ \\ \\", " /  \\/ /", "/ /\\  / ", "\\_\\ \\/  "],
    "O": ["   ___ ", "  /___\\", " //  //", "/ \\_// ", "\\___/  "],
    "P": ["   ___ ", "  / _ \\", " / /_)/", "/ ___/ ", "\\/     "],
    "Q": ["   ____ ", "  /___ \\", " //  / /", "/ \\_/ / ", "\\___,_\\ "],
    "R": ["   __  ", "  /__\\ ", " / \\// ", "/ _  \\ ", "\\/ \\_/ "],
    "S": [" __    ", "/ _\\   ", "\\ \\    ", "_\\ \\   ", "\\__/   "],
    "T": [" _____ ", "/__   \\", "  / /\\/", " / /   ", " \\/    "],
    "U": ["       ", " /\\ /\\ ", "/ / \\ \\", "\\ \\_/ /", " \\___/ "],
    "V": ["         ", " /\\   /\\ ", " \\ \\ / / ", "  \\ V /  ", "   \\_/   "],
    "W": [" __    __ ", "/ / /\\ \\ \\", "\\ \\/  \\/ /", " \\  /\\  / ", "  \\/  \\/  "],
    "X": ["__  __", "\\ \\/ /", " \\  / ", " /  \\ ", "/_/\\_\\"],
    "Y": ["     ", "/\\_/\\", "\\_ _/", " / \\ ", " \\_/ "],
    "Z": [" _____", "/ _  /", "\\// / ", " / //\\", "/____/"],
    " ": ["  ", "  ", "  ", "  ", "  "],
    "!": ["   _ ", "  / \\", " /  /", "/\\_/ ", "\\/   "],
    "?": [" ___ ", "/ _ \\", "\\// /", "  \\/ ", "  () "],
    ".": ["   ", "   ", "   ", " _ ", "(_)"],
    "-": ["       ", "       ", " _____ ", "|_____|", "       "]
  },
  doom: {
    "0": [" _____ ", "|  _  |", "| |/' |", "|  /| |", "\\ |_/ /", " \\___/ "],
    "1": [" __  ", "/  | ", "`| | ", " | | ", "_| |_", "\\___/"],
    "2": [" _____ ", "/ __  \\", "`' / /'", "  / /  ", "./ /___", "\\_____/"],
    "3": [" _____ ", "|____ |", "    / /", "    \\ \\", ".___/ /", "\\____/ "],
    "4": ["   ___ ", "  /   |", " / /| |", "/ /_| |", "\\___  |", "    |_/"],
    "5": [" _____ ", "|  ___|", "|___ \\ ", "    \\ \\", "/\\__/ /", "\\____/ "],
    "6": ["  ____ ", " / ___|", "/ /___ ", "| ___ \\", "| \\_/ |", "\\_____/"],
    "7": [" ______", "|___  /", "   / / ", "  / /  ", "./ /   ", "\\_/    "],
    "8": [" _____ ", "|  _  |", " \\ V / ", " / _ \\ ", "| |_| |", "\\_____/"],
    "9": [" _____ ", "|  _  |", "| |_| |", "\\____ |", ".___/ /", "\\____/ "],
    "A": ["  ___  ", " / _ \\ ", "/ /_\\ \\", "|  _  |", "| | | |", "\\_| |_/"],
    "B": ["______ ", "| ___ \\", "| |_/ /", "| ___ \\", "| |_/ /", "\\____/ "],
    "C": [" _____ ", "/  __ \\", "| /  \\/", "| |    ", "| \\__/\\", " \\____/"],
    "D": ["______ ", "|  _  \\", "| | | |", "| | | |", "| |/ / ", "|___/  "],
    "E": [" _____ ", "|  ___|", "| |__  ", "|  __| ", "| |___ ", "\\____/ "],
    "F": ["______ ", "|  ___|", "| |_   ", "|  _|  ", "| |    ", "\\_|    "],
    "G": [" _____ ", "|  __ \\", "| |  \\/", "| | __ ", "| |_\\ \\", " \\____/"],
    "H": [" _   _ ", "| | | |", "| |_| |", "|  _  |", "| | | |", "\\_| |_/"],
    "I": [" _____ ", "|_   _|", "  | |  ", "  | |  ", " _| |_ ", " \\___/ "],
    "J": ["   ___ ", "  |_  |", "    | |", "    | |", "/\\__/ /", "\\____/ "],
    "K": [" _   __", "| | / /", "| |/ / ", "|    \\ ", "| |\\  \\", "\\_| \\_/"],
    "L": [" _     ", "| |    ", "| |    ", "| |    ", "| |____", "\\_____/"],
    "M": ["___  ___", "|  \\/  |", "| .  . |", "| |\\/| |", "| |  | |", "\\_|  |_/"],
    "N": [" _   _ ", "| \\ | |", "|  \\| |", "| . ` |", "| |\\  |", "\\_| \\_/"],
    "O": [" _____ ", "|  _  |", "| | | |", "| | | |", "\\ \\_/ /", " \\___/ "],
    "P": ["______ ", "| ___ \\", "| |_/ /", "|  __/ ", "| |    ", "\\_|    "],
    "Q": [" _____ ", "|  _  |", "| | | |", "| | | |", "\\ \\/' /", " \\_/\\_\\"],
    "R": ["______ ", "| ___ \\", "| |_/ /", "|    / ", "| |\\ \\ ", "\\_| \\_|"],
    "S": [" _____ ", "/  ___|", "\\ `--. ", " `--. \\", "/\\__/ /", "\\____/ "],
    "T": [" _____ ", "|_   _|", "  | |  ", "  | |  ", "  | |  ", "  \\_/  "],
    "U": [" _   _ ", "| | | |", "| | | |", "| | | |", "| |_| |", " \\___/ "],
    "V": [" _   _ ", "| | | |", "| | | |", "| | | |", "\\ \\_/ /", " \\___/ "],
    "W": [" _    _ ", "| |  | |", "| |  | |", "| |/\\| |", "\\  /\\  /", " \\/  \\/ "],
    "X": ["__   __", "\\ \\ / /", " \\ V / ", " /   \\ ", "/ /^\\ \\", "\\/   \\/"],
    "Y": ["__   __", "\\ \\ / /", " \\ V / ", "  \\ /  ", "  | |  ", "  \\_/  "],
    "Z": [" ______", "|___  /", "   / / ", "  / /  ", "./ /___", "\\_____/"],
    " ": ["  ", "  ", "  ", "  ", "  ", "  "],
    "!": [" _ ", "| |", "| |", "| |", "|_|", "(_)"],
    "?": [" ___  ", "|__ \\ ", "   ) |", "  / / ", " |_|  ", " (_)  "],
    ".": ["   ", "   ", "   ", "   ", " _ ", "(_)"],
    "-": ["        ", "        ", " ______ ", "|______|", "        ", "        "]
  },
  big: {
    "0": ["   ___  ", "  / _ \\ ", " | | | |", " | | | |", " | |_| |", "  \\___/ "],
    "1": ["  __ ", " /_ |", "  | |", "  | |", "  | |", "  |_|"],
    "2": ["  ___  ", " |__ \\ ", "    ) |", "   / / ", "  / /_ ", " |____|"],
    "3": ["  ____  ", " |___ \\ ", "   __) |", "  |__ < ", "  ___) |", " |____/ "],
    "4": ["  _  _   ", " | || |  ", " | || |_ ", " |__   _|", "    | |  ", "    |_|  "],
    "5": ["  _____ ", " | ____|", " | |__  ", " |___ \\ ", "  ___) |", " |____/ "],
    "6": ["    __  ", "   / /  ", "  / /_  ", " | '_ \\ ", " | (_) |", "  \\___/ "],
    "7": ["  ______ ", " |____  |", "     / / ", "    / /  ", "   / /   ", "  /_/    "],
    "8": ["   ___  ", "  / _ \\ ", " | (_) |", "  > _ < ", " | (_) |", "  \\___/ "],
    "9": ["   ___  ", "  / _ \\ ", " | (_) |", "  \\__, |", "    / / ", "   /_/  "],
    "A": ["           ", "     /\\    ", "    /  \\   ", "   / /\\ \\  ", "  / ____ \\ ", " /_/    \\_\\"],
    "B": ["  ____  ", " |  _ \\ ", " | |_) |", " |  _ < ", " | |_) |", " |____/ "],
    "C": ["   _____ ", "  / ____|", " | |     ", " | |     ", " | |____ ", "  \\_____|"],
    "D": ["  _____  ", " |  __ \\ ", " | |  | |", " | |  | |", " | |__| |", " |_____/ "],
    "E": ["  ______ ", " |  ____|", " | |__   ", " |  __|  ", " | |____ ", " |______|"],
    "F": ["  ______ ", " |  ____|", " | |__   ", " |  __|  ", " | |     ", " |_|     "],
    "G": ["   _____ ", "  / ____|", " | |  __ ", " | | |_ |", " | |__| |", "  \\_____|"],
    "H": ["  _    _ ", " | |  | |", " | |__| |", " |  __  |", " | |  | |", " |_|  |_|"],
    "I": ["  _____ ", " |_   _|", "   | |  ", "   | |  ", "  _| |_ ", " |_____|"],
    "J": ["       _ ", "      | |", "      | |", "  _   | |", " | |__| |", "  \\____/ "],
    "K": ["  _  __", " | |/ /", " | ' / ", " |  <  ", " | . \\ ", " |_|\\_\\"],
    "L": ["  _      ", " | |     ", " | |     ", " | |     ", " | |____ ", " |______|"],
    "M": ["  __  __ ", " |  \\/  |", " | \\  / |", " | |\\/| |", " | |  | |", " |_|  |_|"],
    "N": ["  _   _ ", " | \\ | |", " |  \\| |", " | . ` |", " | |\\  |", " |_| \\_|"],
    "O": ["   ____  ", "  / __ \\ ", " | |  | |", " | |  | |", " | |__| |", "  \\____/ "],
    "P": ["  _____  ", " |  __ \\ ", " | |__) |", " |  ___/ ", " | |     ", " |_|     "],
    "Q": ["   ____  ", "  / __ \\ ", " | |  | |", " | |  | |", " | |__| |", "  \\___\\_\\"],
    "R": ["  _____  ", " |  __ \\ ", " | |__) |", " |  _  / ", " | | \\ \\ ", " |_|  \\_\\"],
    "S": ["   _____ ", "  / ____|", " | (___  ", "  \\___ \\ ", "  ____) |", " |_____/ "],
    "T": ["  _______ ", " |__   __|", "    | |   ", "    | |   ", "    | |   ", "    |_|   "],
    "U": ["  _    _ ", " | |  | |", " | |  | |", " | |  | |", " | |__| |", "  \\____/ "],
    "V": [" __      __", " \\ \\    / /", "  \\ \\  / / ", "   \\ \\/ /  ", "    \\  /   ", "     \\/    "],
    "W": [" __          __", " \\ \\        / /", "  \\ \\  /\\  / / ", "   \\ \\/  \\/ /  ", "    \\  /\\  /   ", "     \\/  \\/    "],
    "X": [" __   __", " \\ \\ / /", "  \\ V / ", "   > <  ", "  / . \\ ", " /_/ \\_\\"],
    "Y": [" __     __", " \\ \\   / /", "  \\ \\_/ / ", "   \\   /  ", "    | |   ", "    |_|   "],
    "Z": ["  ______", " |___  /", "    / / ", "   / /  ", "  / /__ ", " /_____|"],
    " ": ["   ", "   ", "   ", "   ", "   ", "   "],
    "!": ["  _ ", " | |", " | |", " | |", " |_|", " (_)"],
    "?": ["  ___  ", " |__ \\ ", "    ) |", "   / / ", "  |_|  ", "  (_)  "],
    ".": ["    ", "    ", "    ", "    ", "  _ ", " (_)"],
    "-": ["         ", "         ", "  ______ ", " |______|", "         ", "         "]
  },
  speed: {
    "0": ["_______ ", "__  __ \\", "_  / / /", "/ /_/ / ", "\\____/  "],
    "1": ["______", "__<  /", "__  / ", "_  /  ", "/_/   "],
    "2": ["______ ", "__|__ \\", "____/ /", "_  __/ ", "/____/ "],
    "3": ["________", "__|__  /", "___/_ < ", "____/ / ", "/____/  "],
    "4": ["_____ __", "__  // /", "_  // /_", "/__  __/", "  /_/   "],
    "5": ["__________", "___  ____/", "______ \\  ", " ____/ /  ", "/_____/   "],
    "6": ["________", "__  ___/", "_  __ \\ ", "/ /_/ / ", "\\____/  "],
    "7": ["______", "/__  /", "__  / ", "_  /  ", "/_/   "],
    "8": ["_______ ", "__( __ )", "_  __  |", "/ /_/ / ", "\\____/  "],
    "9": ["_______ ", "__  __ \\", "_  /_/ /", "_\\__, / ", "/____/  "],
    "A": ["_______ ", "___    |", "__  /| |", "_  ___ |", "/_/  |_|"],
    "B": ["________ ", "___  __ )", "__  __  |", "_  /_/ / ", "/_____/  "],
    "C": ["_________", "__  ____/", "_  /     ", "/ /___   ", "\\____/   "],
    "D": ["________ ", "___  __ \\", "__  / / /", "_  /_/ / ", "/_____/  "],
    "E": ["__________", "___  ____/", "__  __/   ", "_  /___   ", "/_____/   "],
    "F": ["__________", "___  ____/", "__  /_    ", "_  __/    ", "/_/       "],
    "G": ["_________", "__  ____/", "_  / __  ", "/ /_/ /  ", "\\____/   "],
    "H": ["______  __", "___  / / /", "__  /_/ / ", "_  __  /  ", "/_/ /_/   "],
    "I": ["________", "____  _/", " __  /  ", "__/ /   ", "/___/   "],
    "J": ["_________", "______  /", "___ _  / ", "/ /_/ /  ", "\\____/   "],
    "K": ["______ __", "___  //_/", "__  ,<   ", "_  /| |  ", "/_/ |_|  "],
    "L": ["______ ", "___  / ", "__  /  ", "_  /___", "/_____/"],
    "M": ["______  ___", "___   |/  /", "__  /|_/ / ", "_  /  / /  ", "/_/  /_/   "],
    "N": ["_____   __", "___  | / /", "__   |/ / ", "_  /|  /  ", "/_/ |_/   "],
    "O": ["_______ ", "__  __ \\", "_  / / /", "/ /_/ / ", "\\____/  "],
    "P": ["________ ", "___  __ \\", "__  /_/ /", "_  ____/ ", "/_/      "],
    "Q": ["_______ ", "__  __ \\", "_  / / /", "/ /_/ / ", "\\___\\_\\ "],
    "R": ["________ ", "___  __ \\", "__  /_/ /", "_  _, _/ ", "/_/ |_|  "],
    "S": ["________", "__  ___/", "_____ \\ ", "____/ / ", "/____/  "],
    "T": ["________", "___  __/", "__  /   ", "_  /    ", "/_/     "],
    "U": ["_____  __", "__  / / /", "_  / / / ", "/ /_/ /  ", "\\____/   "],
    "V": ["___    __", "__ |  / /", "__ | / / ", "__ |/ /  ", "_____/   "],
    "W": ["___       __", "__ |     / /", "__ | /| / / ", "__ |/ |/ /  ", "____/|__/   "],
    "X": ["____  __", "__  |/ /", "__    / ", "_    |  ", "/_/|_|  "],
    "Y": ["__  __", "_ \\/ /", "__  / ", "_  /  ", "/_/   "],
    "Z": ["______", "___  /", "__  / ", "_  /__", "/____/"],
    " ": ["         ", "         ", "         ", "         ", "         "],
    "!": ["______", "___  /", "__  / ", " /_/  ", "(_)   "],
    "?": ["_____ ", "_ __ \\", "__/ _/", "_/_/  ", "(_)   "],
    ".": ["    ", "    ", "    ", "___ ", "_(_)"],
    "-": ["        ", "        ", "________", "_/_____/", "        "]
  },
  stop: {
    "0": ["  ______ ", " / __   |", "| | //| |", "| |// | |", "|  /__| |", " \\_____/ "],
    "1": ["  __ ", " /  |", "/_/ |", "  | |", "  | |", "  |_|"],
    "2": [" ______  ", "(_____ \\ ", "  ____) )", " /_____/ ", " _______ ", "(_______)"],
    "3": [" ________", "(_______/", "   ____  ", "  (___ \\ ", " _____) )", "(______/ "],
    "4": ["   __    ", "  / /    ", " / /____ ", "|___   _)", "    | |  ", "    |_|  "],
    "5": [" _______ ", "(_______)", " ______  ", "(_____ \\ ", " _____) )", "(______/ "],
    "6": ["    __  ", "   / /  ", "  / /_  ", " / __ \\ ", "( (__) )", " \\____/ "],
    "7": [" _______ ", "(_______)", "      _  ", "     / ) ", "    / /  ", "   (_/   "],
    "8": ["  _____  ", " / ___ \\ ", "( (   ) )", " > > < < ", "( (___) )", " \\_____/ "],
    "9": ["  ____  ", " / __ \\ ", "( (__) )", " \\__  / ", "   / /  ", "  /_/   "],
    "A": ["        ", "   /\\   ", "  /  \\  ", " / /\\ \\ ", "| |__| |", "|______|"],
    "B": [" ______  ", "(____  \\ ", " ____)  )", "|  __  ( ", "| |__)  )", "|______/ "],
    "C": ["  ______ ", " / _____)", "| /      ", "| |      ", "| \\_____ ", " \\______)"],
    "D": [" _____   ", "(____ \\  ", " _   \\ \\ ", "| |   | |", "| |__/ / ", "|_____/  "],
    "E": [" _______ ", "(_______)", " _____   ", "|  ___)  ", "| |_____ ", "|_______)"],
    "F": [" _______ ", "(_______)", " _____   ", "|  ___)  ", "| |      ", "|_|      "],
    "G": ["  ______ ", " / _____)", "| /  ___ ", "| | (___)", "| \\____/|", " \\_____/ "],
    "H": [" _     _ ", "| |   | |", "| |__ | |", "|  __)| |", "| |   | |", "|_|   |_|"],
    "I": [" _____ ", "(_____)", "   _   ", "  | |  ", " _| |_ ", "(_____)"],
    "J": ["   _____ ", "  (_____)", "     _   ", "    | |  ", " ___| |  ", "(____/   "],
    "K": [" _    _ ", "| |  / )", "| | / / ", "| |< <  ", "| | \\ \\ ", "|_|  \\_)"],
    "L": [" _       ", "| |      ", "| |      ", "| |      ", "| |_____ ", "|_______)"],
    "M": [" ______  ", "|  ___ \\ ", "| | _ | |", "| || || |", "| || || |", "|_||_||_|"],
    "N": [" ______  ", "|  ___ \\ ", "| |   | |", "| |   | |", "| |   | |", "|_|   |_|"],
    "O": ["  _____  ", " / ___ \\ ", "| |   | |", "| |   | |", "| |___| |", " \\_____/ "],
    "P": [" ______  ", "(_____ \\ ", " _____) )", "|  ____/ ", "| |      ", "|_|      "],
    "Q": ["  _____  ", " / ___ \\ ", "| |   | |", "| |   |_|", " \\ \\____ ", "  \\_____)"],
    "R": [" ______  ", "(_____ \\ ", " _____) )", "(_____ ( ", "      | |", "      |_|"],
    "S": ["    _    ", "   | |   ", "    \\ \\  ", "     \\ \\ ", " _____) )", "(______/ "],
    "T": [" _______ ", "(_______)", " _       ", "| |      ", "| |_____ ", " \\______)"],
    "U": [" _     _ ", "| |   | |", "| |   | |", "| |   | |", "| |___| |", " \\______|"],
    "V": [" _    _ ", "| |  | |", "| |  | |", " \\ \\/ / ", "  \\  /  ", "   \\/   "],
    "W": [" _  _  _ ", "| || || |", "| || || |", "| ||_|| |", "| |___| |", " \\______|"],
    "X": [" _    _ ", "\\ \\  / /", " \\ \\/ / ", "  )  (  ", " / /\\ \\ ", "/_/  \\_\\"],
    "Y": [" _     _ ", "| |   | |", "| |___| |", " \\_____/ ", "   ___   ", "  (___)  "],
    "Z": [" _______ ", "(_______)", "   __    ", "  / /    ", " / /____ ", "(_______)"],
    " ": ["    ", "    ", "    ", "    ", "    ", "    "],
    "!": [" _ ", "| |", "| |", "|_|", " _ ", "|_|"],
    "?": [" ____  ", "(___ \\ ", "    ) )", "   /_/ ", "   _   ", "  (_)  "],
    ".": ["   ", "   ", "   ", "   ", " _ ", "(_)"],
    "-": ["     ", "     ", " ___ ", "(___)", "     ", "     "]
  },
  subzero: {
    "0": ["", "", "", "", ""],
    "1": ["", "", "", "", ""],
    "2": ["", "", "", "", ""],
    "3": ["", "", "", "", ""],
    "4": ["", "", "", "", ""],
    "5": ["", "", "", "", ""],
    "6": ["", "", "", "", ""],
    "7": ["", "", "", "", ""],
    "8": ["", "", "", "", ""],
    "9": ["", "", "", "", ""],
    "A": [" ______    ", "/\\  __ \\   ", "\\ \\  __ \\  ", " \\ \\_\\ \\_\\ ", "  \\/_/\\/_/ "],
    "B": [" ______    ", "/\\  == \\   ", "\\ \\  __<   ", " \\ \\_____\\ ", "  \\/_____/ "],
    "C": [" ______    ", "/\\  ___\\   ", "\\ \\ \\____  ", " \\ \\_____\\ ", "  \\/_____/ "],
    "D": [" _____    ", "/\\  __-.  ", "\\ \\ \\/\\ \\ ", " \\ \\____- ", "  \\/____/ "],
    "E": [" ______    ", "/\\  ___\\   ", "\\ \\  __\\   ", " \\ \\_____\\ ", "  \\/_____/ "],
    "F": [" ______  ", "/\\  ___\\ ", "\\ \\  __\\ ", " \\ \\_\\   ", "  \\/_/   "],
    "G": [" ______    ", "/\\  ___\\   ", "\\ \\ \\__ \\  ", " \\ \\_____\\ ", "  \\/_____/ "],
    "H": [" __  __    ", "/\\ \\_\\ \\   ", "\\ \\  __ \\  ", " \\ \\_\\ \\_\\ ", "  \\/_/\\/_/ "],
    "I": [" __    ", "/\\ \\   ", "\\ \\ \\  ", " \\ \\_\\ ", "  \\/_/ "],
    "J": ["   __    ", "  /\\ \\   ", " _\\_\\ \\  ", "/\\_____\\ ", "\\/_____/ "],
    "K": [" __  __    ", "/\\ \\/ /    ", '\\ \\  _"-.  ', " \\ \\_\\ \\_\\ ", "  \\/_/\\/_/ "],
    "L": [" __        ", "/\\ \\       ", "\\ \\ \\____  ", " \\ \\_____\\ ", "  \\/_____/ "],
    "M": [" __    __    ", '/\\ "-./  \\   ', "\\ \\ \\-./\\ \\  ", " \\ \\_\\ \\ \\_\\ ", "  \\/_/  \\/_/ "],
    "N": [" __   __    ", '/\\ "-.\\ \\   ', "\\ \\ \\-.  \\  ", ' \\ \\_\\\\"\\_\\ ', "  \\/_/ \\/_/ "],
    "O": [" ______    ", "/\\  __ \\   ", "\\ \\ \\/\\ \\  ", " \\ \\_____\\ ", "  \\/_____/ "],
    "P": [" ______  ", "/\\  == \\ ", "\\ \\  _-/ ", " \\ \\_\\   ", "  \\/_/   "],
    "Q": [" ______    ", "/\\  __ \\   ", "\\ \\ \\/\\_\\  ", " \\ \\___\\_\\ ", "  \\/___/_/ "],
    "R": [" ______    ", "/\\  == \\   ", "\\ \\  __<   ", " \\ \\_\\ \\_\\ ", "  \\/_/ /_/ "],
    "S": [" ______    ", "/\\  ___\\   ", "\\ \\___  \\  ", " \\/\\_____\\ ", "  \\/_____/ "],
    "T": [" ______  ", "/\\__  _\\ ", "\\/_/\\ \\/ ", "   \\ \\_\\ ", "    \\/_/ "],
    "U": [" __  __    ", "/\\ \\/\\ \\   ", "\\ \\ \\_\\ \\  ", " \\ \\_____\\ ", "  \\/_____/ "],
    "V": [" __   __  ", "/\\ \\ / /  ", "\\ \\ \\'/   ", " \\ \\__|   ", "  \\/_/    "],
    "W": [" __     __    ", "/\\ \\  _ \\ \\   ", '\\ \\ \\/ ".\\ \\  ', ' \\ \\__/".~\\_\\ ', "  \\/_/   \\/_/ "],
    "X": [" __  __    ", "/\\_\\_\\_\\   ", "\\/_/\\_\\/_  ", "  /\\_\\/\\_\\ ", "  \\/_/\\/_/ "],
    "Y": [" __  __    ", "/\\ \\_\\ \\   ", "\\ \\____ \\  ", " \\/\\_____\\ ", "  \\/_____/ "],
    "Z": [" ______    ", "/\\___  \\   ", "\\/_/  /__  ", "  /\\_____\\ ", "  \\/_____/ "],
    " ": ["      ", "      ", "      ", "      ", "      "],
    "!": ["", "", "", "", ""],
    "?": ["", "", "", "", ""],
    ".": ["", "", "", "", ""],
    "-": ["", "", "", "", ""]
  }
};

// visuals/src/swirl/block-font.ts
var BANNER_BITS = {
  A: ["01110", "10001", "11111", "10001", "10001"],
  B: ["11110", "10001", "11110", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "11110", "10000", "11111"],
  F: ["11111", "10000", "11110", "10000", "10000"],
  G: ["01111", "10000", "10011", "10001", "01111"],
  H: ["10001", "10001", "11111", "10001", "10001"],
  I: ["111", "010", "010", "010", "111"],
  J: ["00111", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "11100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001"],
  O: ["01110", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "11110", "10000", "10000"],
  Q: ["01110", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "11110", "10010", "10001"],
  S: ["01111", "10000", "01110", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10101", "11011", "10001"],
  X: ["10001", "01010", "00100", "01010", "10001"],
  Y: ["10001", "01010", "00100", "00100", "00100"],
  Z: ["11111", "00010", "00100", "01000", "11111"],
  "0": ["01110", "10011", "10101", "11001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "01110"],
  "2": ["11110", "00001", "01110", "10000", "11111"],
  "3": ["11110", "00001", "01110", "00001", "11110"],
  "4": ["10010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "11110"],
  "6": ["01111", "10000", "11110", "10001", "01110"],
  "7": ["11111", "00010", "00100", "01000", "01000"],
  "8": ["01110", "10001", "01110", "10001", "01110"],
  "9": ["01110", "10001", "01111", "00001", "11110"],
  "!": ["1", "1", "1", "0", "1"],
  "?": ["11110", "00001", "00110", "00000", "00100"],
  ".": ["0", "0", "0", "0", "1"],
  "-": ["000", "000", "111", "000", "000"],
  " ": ["00", "00", "00", "00", "00"]
};
function bitsToOutline(bits) {
  const h = bits.length;
  const w = Math.max(0, ...bits.map((r) => r.length));
  const on = (r, c) => r >= 0 && r < h && c >= 0 && c < w && bits[r]?.[c] === "1";
  return bits.map((row, r) => {
    let line = "";
    for (let c = 0; c < w; c++) {
      if (!on(r, c)) {
        line += " ";
        continue;
      }
      const edge = !on(r - 1, c) || !on(r + 1, c) || !on(r, c - 1) || !on(r, c + 1);
      line += edge ? "\u2588" : " ";
    }
    return line;
  });
}
var BANNER = Object.fromEntries(
  Object.entries(BANNER_BITS).map(([k, v]) => [k, bitsToOutline(v)])
);
var TABLES = {
  slant: FIGLET_FONTS.slant,
  standard: FIGLET_FONTS.standard,
  ogre: FIGLET_FONTS.ogre,
  doom: FIGLET_FONTS.doom,
  big: FIGLET_FONTS.big,
  speed: FIGLET_FONTS.speed,
  stop: FIGLET_FONTS.stop,
  subzero: FIGLET_FONTS.subzero,
  banner: BANNER
};
var GAP_COLS = { banner: 1 };
function squareGlyph(rows) {
  const w = Math.max(0, ...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(w, " "));
}
function overlapAllowed(canvas, glyph, leftEdge, minGap) {
  const gw = Math.max(0, ...glyph.map((r) => r.length));
  let shift = 0;
  for (let s = 1; s <= gw; s++) {
    let collides = false;
    for (let r = 0; r < canvas.length && !collides; r++) {
      const crow = canvas[r];
      const grow = glyph[r] ?? "";
      for (let gx = 0; gx < gw; gx++) {
        const gc = grow[gx] ?? " ";
        if (gc === " ") continue;
        const cx = leftEdge - s + gx;
        if (cx < 0) continue;
        for (let g = 0; g <= minGap; g++) {
          if ((crow[cx + g] ?? " ") !== " ") {
            collides = true;
            break;
          }
        }
        if (collides) break;
      }
    }
    if (collides) break;
    shift = s;
  }
  return shift;
}
function renderWord(word, style) {
  const table = TABLES[style];
  const minGap = GAP_COLS[style] ?? 0;
  const rowCount = table[" "].length;
  const glyphs = word.toUpperCase().split("").map((c) => squareGlyph(table[c] ?? table[" "]));
  if (glyphs.length === 0) return Array.from({ length: rowCount }, () => "");
  let canvas = Array.from({ length: rowCount }, () => "");
  for (const glyph of glyphs) {
    const gw = Math.max(0, ...glyph.map((r) => r.length));
    const cw = Math.max(0, ...canvas.map((r) => r.length));
    const shift = cw > 0 ? overlapAllowed(canvas, glyph, cw, minGap) : 0;
    const at = cw - shift;
    const next = [];
    for (let r = 0; r < rowCount; r++) {
      const crow = (canvas[r] ?? "").padEnd(at, " ");
      const grow = (glyph[r] ?? "").padEnd(gw, " ");
      let merged = crow.slice(0, at);
      for (let gx = 0; gx < gw; gx++) {
        const cx = at + gx;
        const existing = (canvas[r] ?? "")[cx] ?? " ";
        const gc = grow[gx];
        merged += gc !== " " ? gc : existing;
      }
      next.push(merged);
    }
    canvas = next;
  }
  const w = Math.max(...canvas.map((r) => r.length));
  return canvas.map((r) => r.padEnd(w, " "));
}

// visuals/src/swirl/stage.ts
var BASE_ROWS = 22;
var VEL_SMOOTH = 5;
var SHOCK_LIFE = 2.4;
function resolveTarget(c) {
  if (c.rows && c.rows.length) return makeTarget(c.rows);
  return makeTarget(renderWord(c.word ?? " ", c.style ?? "slant"));
}
function targetKey(c) {
  return c.rows ? "rows:" + c.rows.join("|") : `word:${c.word}:${c.style}`;
}
var SwirlStage = class {
  canvas;
  cfg;
  r = null;
  raf = 0;
  destroyed = false;
  glyphs = [];
  lookup = /* @__PURE__ */ Object.create(null);
  spaceSlot = 0;
  source = [];
  lastText = "";
  target;
  lastTargetKey = "";
  lastZoom = 1;
  atlas = null;
  grid = null;
  buffers = null;
  lastCw = -1;
  lastCh = -1;
  pointer = { x: 0, y: 0, active: false };
  trail = makeTrailField();
  velX = 0;
  velY = 0;
  prevPx = 0;
  prevPy = 0;
  havePrev = false;
  shocks = [];
  startTime = 0;
  prevTime = 0;
  ok = false;
  constructor(canvas, cfg) {
    this.canvas = canvas;
    this.cfg = cfg;
    const r = createRenderer(canvas);
    if (!r) return;
    this.r = r;
    for (let code = 32; code <= 126; code++) this.addGlyph(String.fromCharCode(code));
    for (const cc of "\u2588\u2593") this.addGlyph(cc);
    this.addGlyph(" ");
    this.spaceSlot = this.lookup[" "];
    this.source = cfg.text.split("\n").map((e) => e.replace(/\t/g, "    "));
    this.lastText = cfg.text;
    this.target = resolveTarget(cfg);
    this.lastTargetKey = targetKey(cfg);
    this.lastZoom = cfg.zoom;
    this.ok = true;
  }
  addGlyph(cc) {
    if (this.lookup[cc] !== void 0) return;
    this.lookup[cc] = this.glyphs.length;
    this.glyphs.push(cc);
  }
  slotOf = (cc, weight) => {
    const i = this.lookup[cc];
    return weight * this.glyphs.length + (i === void 0 ? this.spaceSlot : i);
  };
  setConfig(patch) {
    Object.assign(this.cfg, patch);
  }
  replay() {
    this.startTime = 0;
  }
  setPointer(p) {
    if (p) {
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.pointer.active = true;
    } else this.pointer.active = false;
  }
  burst(x, y) {
    this.shocks.push({ x, y, age: 0 });
    if (this.shocks.length > 4) this.shocks.shift();
  }
  rebuild(cw, ch) {
    const { round, max, floor } = Math;
    const c = this.cfg;
    const r = this.r;
    const rows = max(8, round(BASE_ROWS / max(0.3, c.zoom)));
    this.atlas = buildAtlas(r.gl, r.glyphTex, r.scratch, this.glyphs, max(8, round(ch / rows)));
    const gridRows = max(this.target.rows.length, Math.ceil(ch / this.atlas.inkSize) + 1);
    const contentH = gridRows * this.atlas.inkSize;
    const cols = floor(cw / this.atlas.advance);
    this.grid = {
      cols,
      rows: gridRows,
      inkSize: this.atlas.inkSize,
      vOffset: round((ch - contentH) / 2),
      targetX: max(0, round((cols - (this.target.rows[0]?.length ?? 0)) / 2)),
      targetY: max(0, round((gridRows - this.target.rows.length) / 2))
    };
    this.buffers = makeBuffers(gridRows * cols);
    r.allocCells(this.buffers);
    r.resizeTargets(cw, ch);
  }
  frame = (time) => {
    if (this.destroyed || !this.r) return;
    const { round } = Math;
    const c = this.cfg;
    if (c.text !== this.lastText) {
      this.lastText = c.text;
      this.source = c.text.split("\n").map((e) => e.replace(/\t/g, "    "));
      this.lastCw = -1;
    }
    const tk = targetKey(c);
    if (tk !== this.lastTargetKey) {
      this.lastTargetKey = tk;
      this.target = resolveTarget(c);
      this.lastCw = -1;
      this.startTime = 0;
    }
    if (c.zoom !== this.lastZoom) {
      this.lastZoom = c.zoom;
      this.lastCw = -1;
    }
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = round(rect.width * dpr);
    const ch = round(rect.height * dpr);
    if (cw > 0 && ch > 0 && (cw !== this.lastCw || ch !== this.lastCh)) {
      this.rebuild(cw, ch);
      this.lastCw = cw;
      this.lastCh = ch;
    }
    if (this.grid && this.atlas && this.buffers) {
      if (this.startTime === 0) this.startTime = time;
      if (this.prevTime === 0) this.prevTime = time;
      const elapsed = time - this.startTime;
      const dt = Math.min(0.05, Math.max(1e-3, (time - this.prevTime) / 1e3));
      this.prevTime = time;
      if (c.trail) {
        if (this.pointer.active) {
          const vSp = 1 - Math.exp(-VEL_SMOOTH * dt);
          if (this.havePrev) {
            this.velX += ((this.pointer.x - this.prevPx) / dt - this.velX) * vSp;
            this.velY += ((this.pointer.y - this.prevPy) / dt - this.velY) * vSp;
          }
          this.prevPx = this.pointer.x;
          this.prevPy = this.pointer.y;
          this.havePrev = true;
          depositTrail(this.trail, this.pointer.x, this.pointer.y, this.velX, this.velY, dt);
        } else {
          this.havePrev = false;
          this.velX *= Math.exp(-VEL_SMOOTH * dt);
          this.velY *= Math.exp(-VEL_SMOOTH * dt);
        }
        stepTrail(this.trail, dt);
      }
      if (this.shocks.length) {
        for (const s of this.shocks) s.age += dt;
        for (let i = this.shocks.length - 1; i >= 0; i--) {
          if (this.shocks[i].age > SHOCK_LIFE) this.shocks.splice(i, 1);
        }
      }
      const stops = (c.gradient ? c.inkStops : c.inkStops.slice(0, 1)).map(hexToRgb01);
      const paint = {
        stops: stops.length ? stops : [[1, 1, 1]],
        angle: c.gradientAngle,
        flow: c.gradient ? elapsed * 1e-3 * c.gradientFlow : 0,
        gradient: c.gradient && stops.length > 1,
        mode: c.gradientMode ?? "rows"
      };
      const bg = hexToRgb01(c.bg);
      const count = composeField({
        grid: this.grid,
        atlas: this.atlas,
        buffers: this.buffers,
        source: this.source.length ? this.source : [""],
        target: this.target,
        elapsed,
        paint,
        logo: hexToRgb01(c.logoColor),
        slotOf: this.slotOf,
        trail: c.trail ? this.trail : void 0,
        trailStrength: c.trailStrength,
        trailFlare: c.trailFlare ? hexToRgb01(c.trailFlare) : void 0,
        shocks: c.shock && this.shocks.length ? this.shocks : void 0,
        turbulence: c.turbulence,
        wavePattern: c.wavePattern
      });
      this.r.drawField(count, this.grid, this.buffers, bg);
      this.r.drawCrt(elapsed * 1e-3, cw, ch, {
        scanline: c.scanlines,
        aberration: c.aberration,
        curvature: c.curvature,
        bg
      });
    }
    this.raf = requestAnimationFrame(this.frame);
  };
  start() {
    if (this.raf || !this.ok) return;
    this.prevTime = 0;
    this.raf = requestAnimationFrame(this.frame);
  }
  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  destroy() {
    this.destroyed = true;
    this.stop();
    this.r?.dispose();
  }
};

// visuals/src/swirl/default-text.ts
var DEFAULT_TEXT = `design is deciding what to leave out, then defending that emptiness against every well meaning request to fill it back in
clarity beats cleverness
the best interfaces feel inevitable, as if no other arrangement of the same pixels could have been correct
ship small
constraints are where the good ideas hide, so a boring problem usually means you have not found the right constraint yet
make it work, then make it right, then make it fast
taste is patience
a product is a long sequence of small decisions made visible, and the work is to keep making them after everyone got tired
the demo is the spec everyone actually reads
delete more than you add
most complexity is a missing decision wearing a costume, a question pushed downstream until it hardened into architecture
read the code before you replace it
motion should explain something true, where a thing came from or where it went, otherwise it is just expensive confetti
small loops beat big plans
the edges are where the craft shows, the empty states and the errors and the quiet moment right after a click
write it down or it did not happen
build for the person in front of you, not the imaginary average user who wants whatever you already built
opinions are cheap, working software is not
the boring solution is usually the correct one, and the urge to make it interesting is your ego asking for a stage
finish something today`;

// visuals/src/swirl/adapter.ts
var adapter_default = {
  async mount(host, props) {
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    host.style.background = String(props.bg ?? "#0b0e14");
    host.appendChild(canvas);
    const cfg = {
      word: String(props.word ?? "financecrew"),
      style: props.style ?? "slant",
      inkStops: Array.isArray(props.ink) ? props.ink : ["#34d399", "#818cf8", "#f472b6"],
      logoColor: String(props.logoColor ?? "#f8fafc"),
      gradient: true,
      gradientAngle: 0.6,
      gradientFlow: Number(props.flow ?? 0.06),
      bg: String(props.bg ?? "#0b0e14"),
      text: String(props.text ?? DEFAULT_TEXT),
      scanlines: Number(props.scanlines ?? 0.45),
      aberration: 1,
      curvature: 1,
      zoom: Number(props.zoom ?? 1.05),
      trail: false,
      shock: false,
      turbulence: Number(props.turbulence ?? 0.3),
      wavePattern: props.wave ?? "wavefront"
    };
    const stage = new SwirlStage(canvas, cfg);
    if (!stage.ok) throw new Error("swirl: WebGL2 unavailable");
    return {
      start: () => stage.start(),
      action: async (name) => {
        if (name === "replay") stage.replay();
      },
      destroy: () => stage.destroy()
    };
  }
};
export {
  adapter_default as default
};
