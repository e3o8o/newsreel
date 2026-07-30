// src/dotcut/scenes.ts
function cellMotion(kind, t, dir, rand) {
  const u = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
  switch (kind) {
    case "wipe":
      return { scale: 1, dx: u * 0.16 * -dir, dy: 0, spin: 0 };
    case "ripple":
      return { scale: 1 - u * 0.1, dx: 0, dy: u * -0.13, spin: 0 };
    case "scatter":
      return {
        scale: 1,
        dx: u * 0.18 * Math.cos(rand * Math.PI * 2),
        dy: u * 0.18 * Math.sin(rand * Math.PI * 2),
        spin: 0
      };
    case "collapse":
      return { scale: 1 - u * 0.18, dx: 0, dy: 0, spin: 0 };
    case "columns":
      return { scale: 1, dx: 0, dy: u * 0.22, spin: 0 };
  }
}
function smooth01(v, e0, e1) {
  const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
var SCENES = [
  { kind: "text", value: "A", transition: "wipe", palette: 0, style: "drift" },
  { kind: "rings", transition: "ripple", palette: 1, style: "grain" },
  { kind: "columns", transition: "columns", palette: 2, style: "streak" },
  { kind: "checker", transition: "scatter", palette: 3, style: "swell" },
  { kind: "boxes", transition: "collapse", palette: 4, style: "grain" },
  { kind: "bars", transition: "wipe", palette: 5, style: "drift" }
];
function styleField(scene, cols, rows, t, out, prev) {
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const maxR = Math.hypot(cols, rows) / 2;
  const FLIP = 0.32;
  const stateOf = (style, x, y) => {
    switch (style) {
      case "drift": {
        const a = Math.sin(x * 0.41 + y * 0.23);
        const b = Math.sin(x * 0.17 - y * 0.53 + 2.1);
        return smooth01((a + b) * 0.5, -0.15, 0.75);
      }
      case "grain": {
        const n = hash2(x, y) * 0.55 + hash2(x + 1, y) * 0.15 + hash2(x, y + 1) * 0.15 + hash2(x + 1, y + 1) * 0.15;
        return smooth01(n, 0.34, 0.86);
      }
      case "swell": {
        const d = Math.hypot(x - cx, y - cy) / maxR;
        const warp = Math.sin(Math.atan2(y - cy, x - cx) * 3) * 0.14;
        return smooth01(1 - (d + warp), 0.28, 0.92);
      }
      case "streak": {
        const s = Math.sin(x * 0.28 + y * 0.62);
        const cut = Math.sin(x * 0.09 - y * 0.11 + 1.3) * 0.5 + 0.5;
        return smooth01(s * cut, -0.05, 0.7);
      }
      default:
        return 0;
    }
  };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let order = 0;
      switch (scene.style) {
        case "drift":
          order = x / cols * 0.75 + Math.sin(y * 0.5) * 0.12 + 0.12;
          break;
        case "grain":
          order = x / cols * 0.55 + y / rows * 0.25 + hash2(x, y) * 0.2;
          break;
        case "swell":
          order = Math.hypot(x - cx, y - cy) / maxR;
          break;
        case "streak":
          order = x / cols * 0.8 + y / rows * 0.2;
          break;
      }
      const from = stateOf(prev?.style ?? scene.style, x, y);
      const to = stateOf(scene.style, x, y);
      const u = Math.min(1, Math.max(0, (t - order * (1 - FLIP)) / FLIP));
      const eased = u * u * (3 - 2 * u);
      out[y * cols + x] = from + (to - from) * eased;
    }
  }
}
var PALETTES = [
  ["#8aa9ff", "#1f45f5"],
  ["#ffd166", "#e5484d"],
  ["#b8f2c9", "#0f8a5f"],
  ["#ffc2e2", "#c81d77"],
  ["#c7d2fe", "#4338ca"],
  ["#fde68a", "#b45309"]
];
function rasterize(scene, cols, rows, fontFamily) {
  const out = new Uint8Array(new ArrayBuffer(cols * rows)).fill(1);
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  if (scene.kind === "checker") {
    const b = Math.max(2, Math.round(cols / 14));
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if ((Math.floor(x / b) + Math.floor(y / b)) % 2 === 0) out[y * cols + x] = 0;
      }
    }
    return out;
  }
  if (scene.kind === "bars") {
    const period = 3;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (Math.floor((x + y) / period) % 2 === 0) out[y * cols + x] = 0;
      }
    }
    return out;
  }
  if (scene.kind === "columns") {
    const bw = 4;
    const bh = 3;
    for (let y = 0; y < rows; y++) {
      const band = Math.floor(y / bh);
      const shift = band % 2 === 0 ? 0 : bw / 2;
      for (let x = 0; x < cols; x++) {
        if (Math.floor((x + shift) / bw) % 2 === 0) out[y * cols + x] = 0;
      }
    }
    return out;
  }
  if (scene.kind === "boxes") {
    const period = 2.5;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const d = Math.max(Math.abs(x - cx), Math.abs(y - cy));
        if (Math.floor(d / period) % 2 === 0) out[y * cols + x] = 0;
      }
    }
    return out;
  }
  if (scene.kind === "rings") {
    const maxR = Math.hypot(cols, rows) / 2;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const d = Math.hypot(x - cx, y - cy) / maxR;
        if (Math.floor(d * 6) % 2 === 0) out[y * cols + x] = 0;
      }
    }
    return out;
  }
  const cv = document.createElement("canvas");
  cv.width = cols;
  cv.height = rows;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return out;
  const text = (scene.value || "").trim();
  if (!text) return out;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cols, rows);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = rows * 0.8;
  ctx.font = `600 ${size}px ${fontFamily}`;
  const maxW = cols * 0.36;
  const m = ctx.measureText(text);
  if (m.width > maxW) {
    size *= maxW / m.width;
    ctx.font = `600 ${size}px ${fontFamily}`;
  }
  const maxH = rows * 0.58;
  const mm = ctx.measureText(text);
  const gh = mm.actualBoundingBoxAscent + mm.actualBoundingBoxDescent;
  if (gh > maxH) {
    size *= maxH / gh;
    ctx.font = `600 ${size}px ${fontFamily}`;
  }
  ctx.fillText(text, cols / 2, rows / 2 + rows * 0.02);
  const data = ctx.getImageData(0, 0, cols, rows).data;
  for (let i = 0; i < cols * rows; i++) {
    if (data[i * 4] > 110) out[i] = 0;
  }
  return out;
}
function cellDelay(kind, x, y, cols, rows, rand) {
  const fx = cols > 1 ? x / (cols - 1) : 0;
  const fy = rows > 1 ? y / (rows - 1) : 0;
  switch (kind) {
    case "wipe":
      return Math.min(1, Math.max(0, (fx * 0.75 + fy * 0.25) * 0.85 + rand * 0.15));
    case "ripple": {
      const d = Math.hypot(fx - 0.5, fy - 0.5) / 0.707;
      return Math.min(1, d * 0.9 + rand * 0.1);
    }
    case "scatter":
      return rand;
    case "collapse": {
      const d = Math.hypot(fx - 0.5, fy - 0.5) / 0.707;
      return Math.min(1, (1 - d) * 0.85 + rand * 0.15);
    }
    case "columns":
      return Math.min(1, fx * 0.9 + rand * 0.1);
  }
}

// src/dotcut/engine.ts
var COLS = 42;
var HOLD_MS = 600;
var MORPH_MS = 520;
var easeOut = (t) => 1 - Math.pow(1 - t, 3);
var easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
var DEFAULTS = {
  cols: COLS,
  squareness: 0,
  hold: HOLD_MS,
  morph: MORPH_MS,
  brush: 1.6,
  fill: 1
};
var DotCut = class {
  host;
  canvas;
  ctx = null;
  params = { ...DEFAULTS };
  cols = COLS;
  rows = 12;
  pitch = 10;
  ox = 0;
  oy = 0;
  target = new Uint8Array(0);
  live = new Float32Array(0);
  from = new Float32Array(0);
  delay = new Float32Array(0);
  rnd = new Float32Array(0);
  prog = new Float32Array(0);
  dir = new Float32Array(0);
  bore = new Float32Array(0);
  styleT = 0;
  sceneIdx = 0;
  phase = "hold";
  phaseT = 0;
  clock = 0;
  paletteMix = 1;
  prevPalette = 0;
  prevScene = 0;
  pointer = null;
  raf = 0;
  last = 0;
  running = false;
  dpr = 1;
  ro = null;
  disposed = false;
  fontFamily = "sans-serif";
  constructor(host, fontFamily) {
    this.host = host;
    if (fontFamily) this.fontFamily = fontFamily;
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "display:block;width:100%;height:100%";
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) return;
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
  }
  get ok() {
    return !!this.ctx;
  }
  applyScene(scene, instant) {
    const next = rasterize(scene, this.cols, this.rows, this.fontFamily);
    this.from.set(this.live);
    this.target = next;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const i = y * this.cols + x;
        this.delay[i] = cellDelay(
          scene.transition,
          x,
          y,
          this.cols,
          this.rows,
          this.rnd[i]
        );
      }
    }
    if (instant) {
      for (let i = 0; i < next.length; i++) this.live[i] = next[i];
      this.from.set(this.live);
    }
  }
  resize() {
    const ctx = this.ctx;
    if (!ctx || this.disposed) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    const margin = 0.75;
    this.cols = Math.max(6, Math.round(this.params.cols));
    this.pitch = w / (this.cols + 2 * margin);
    this.rows = Math.max(3, Math.floor((h - 2 * margin * this.pitch) / this.pitch));
    this.ox = (w - this.cols * this.pitch) / 2;
    this.oy = (h - this.rows * this.pitch) / 2;
    const n = this.cols * this.rows;
    this.target = new Uint8Array(n);
    this.live = new Float32Array(n);
    this.from = new Float32Array(n);
    this.delay = new Float32Array(n);
    this.rnd = new Float32Array(n);
    this.prog = new Float32Array(n);
    this.dir = new Float32Array(n);
    this.bore = new Float32Array(n);
    for (let i = 0; i < n; i++) this.rnd[i] = hash(i * 1.37 + 0.5);
    this.applyScene(SCENES[this.sceneIdx], true);
    if (!this.running) this.draw(0);
  }
  setParams(p) {
    const needsGrid = p.cols !== void 0 && p.cols !== this.params.cols;
    Object.assign(this.params, p);
    if (needsGrid) this.resize();
  }
  setPointer(p) {
    this.pointer = p;
  }
  advance() {
    this.prevScene = this.sceneIdx;
    this.sceneIdx = (this.sceneIdx + 1) % SCENES.length;
    this.prevPalette = SCENES[(this.sceneIdx - 1 + SCENES.length) % SCENES.length].palette;
    this.paletteMix = 0;
    this.phase = "morph";
    this.phaseT = 0;
    this.styleT = 0;
    this.applyScene(SCENES[this.sceneIdx], false);
  }
  step(dt) {
    this.clock += dt;
    this.phaseT += dt * 1e3;
    if (this.phase === "hold" && this.phaseT >= this.params.hold) {
      this.advance();
    } else if (this.phase === "morph" && this.phaseT >= this.params.morph) {
      this.phase = "hold";
      this.phaseT = 0;
    }
    const p = this.phase === "morph" ? Math.min(1, this.phaseT / this.params.morph) : 1;
    const n = this.cols * this.rows;
    for (let i = 0; i < n; i++) {
      const d = this.delay[i];
      const local = Math.min(1, Math.max(0, (p - d * 0.72) / 0.28));
      const e = easeOut(local);
      this.live[i] = this.from[i] + (this.target[i] - this.from[i]) * e;
      const changing = this.from[i] !== this.target[i] && this.phase === "morph";
      this.prog[i] = changing ? local : 0;
      this.dir[i] = this.target[i] > this.from[i] ? 1 : -1;
    }
    this.paletteMix = Math.min(1, this.paletteMix + dt * 2.2);
    this.styleT = this.phase === "morph" ? Math.min(1, this.styleT + dt / (this.params.morph / 1e3)) : 1;
    styleField(
      SCENES[this.sceneIdx],
      this.cols,
      this.rows,
      this.styleT,
      this.bore,
      SCENES[this.prevScene]
    );
  }
  draw(dt) {
    const ctx = this.ctx;
    if (!ctx) return;
    this.step(dt);
    const W = this.canvas.width;
    const H = this.canvas.height;
    const s = this.dpr;
    const scene = SCENES[this.sceneIdx];
    const [cA, bA] = PALETTES[this.prevPalette % PALETTES.length];
    const [cB, bB] = PALETTES[scene.palette % PALETTES.length];
    const m = easeInOut(this.paletteMix);
    const circle = mixHex(cA, cB, m);
    const back = mixHex(bA, bB, m);
    ctx.fillStyle = back;
    ctx.fillRect(0, 0, W, H);
    const pitch = this.pitch * s;
    const r = pitch / 2;
    const sq = Math.max(0, Math.min(1, this.params.squareness));
    ctx.fillStyle = circle;
    const solidPath = new Path2D();
    const stroke = Math.max(1.1 * s, r * 0.3);
    const brush = this.params.brush;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const i = y * this.cols + x;
        let v = this.live[i];
        if (v <= 4e-3) continue;
        if (this.pointer && brush > 0) {
          const d = Math.hypot(x + 0.5 - this.pointer.x, y + 0.5 - this.pointer.y);
          if (d < brush) v *= Math.min(1, (d / brush) ** 2);
        }
        if (v <= 4e-3) continue;
        const mo = cellMotion(scene.transition, this.prog[i], this.dir[i], this.rnd[i]);
        const cx = this.ox * s + (x + 0.5) * pitch + mo.dx * pitch;
        const cy = this.oy * s + (y + 0.5) * pitch + mo.dy * pitch;
        const pop = 1;
        const rr = r * v * pop * mo.scale * this.params.fill;
        if (rr <= 0.3) continue;
        const canRing = rr > 3.2 * s;
        const bore = canRing ? (rr - stroke) * this.bore[i] : 0;
        solidPath.moveTo(cx + rr, cy);
        if (sq < 0.02) {
          solidPath.arc(cx, cy, rr, 0, Math.PI * 2);
        } else {
          roundedSquare(solidPath, cx, cy, rr, sq);
        }
        if (bore > 0.4) {
          solidPath.moveTo(cx + bore, cy);
          solidPath.arc(cx, cy, bore, 0, Math.PI * 2, true);
        }
      }
    }
    ctx.fill(solidPath, "evenodd");
  }
  renderStill() {
    this.phase = "hold";
    this.phaseT = 0;
    this.paletteMix = 1;
    this.applyScene(SCENES[this.sceneIdx], true);
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
    this.ctx = null;
    this.canvas.remove();
  }
  toCell(px, py) {
    return { x: (px - this.ox) / this.pitch, y: (py - this.oy) / this.pitch };
  }
};
function roundedSquare(ctx, cx, cy, r, sq) {
  const n = 2 + sq * 8;
  const steps = 22;
  ctx.moveTo(cx + r, cy);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * r;
    const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * r;
    ctx.lineTo(cx + x, cy + y);
  }
  ctx.closePath();
}
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round((pa >> 16 & 255) * (1 - t) + (pb >> 16 & 255) * t);
  const g = Math.round((pa >> 8 & 255) * (1 - t) + (pb >> 8 & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r},${g},${bl})`;
}

// src/dotcut/adapter.ts
var adapter_default = {
  async mount(host, props) {
    if (typeof props.letter === "string" && props.letter) {
      SCENES[0].value = props.letter.slice(0, 1).toUpperCase();
    }
    const stage = document.createElement("div");
    Object.assign(stage.style, { position: "absolute", inset: "0" });
    host.appendChild(stage);
    const engine = new DotCut(stage, "-apple-system, 'Helvetica Neue', Arial, sans-serif");
    if (!engine.ok) throw new Error("dotcut: canvas unavailable");
    engine.setParams({
      ...typeof props.cols === "number" && { cols: props.cols },
      ...typeof props.hold === "number" && { hold: props.hold },
      ...typeof props.morph === "number" && { morph: props.morph }
    });
    return {
      start: () => engine.start(),
      action: async (name) => {
        if (name === "advance") engine.advance();
      },
      destroy: () => engine.destroy()
    };
  }
};
export {
  adapter_default as default
};
