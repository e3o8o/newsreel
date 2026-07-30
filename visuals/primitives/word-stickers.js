// visuals/src/word-stickers/stickers.ts
var FONT = "var(--font-mondwest)";
var STICKERS = [
  { word: "wow", font: FONT, weight: 400, outline: "#ff2e6e", fill: "#2b0b4f", x: 0.17, y: 0.28, rot: 0 },
  { word: "design", font: FONT, weight: 400, outline: "#7c4dff", fill: "#eaff5a", x: 0.66, y: 0.24, rot: 0 },
  { word: "vault", font: FONT, weight: 400, outline: "#00b3a4", fill: "#ff3d6e", x: 0.82, y: 0.7, rot: 0 },
  { word: "yes!", font: FONT, weight: 400, outline: "#ff7a1a", fill: "#0a2f6b", x: 0.3, y: 0.74, rot: 0 },
  { word: "arlan", font: FONT, weight: 400, outline: "#ffd21e", fill: "#c81e5b", x: 0.52, y: 0.55, rot: 0 },
  { word: "ship it", font: FONT, weight: 400, outline: "#1668ff", fill: "#7dffb0", x: 0.2, y: 0.55, rot: 0 }
];

// visuals/src/word-stickers/sticker-render.ts
function renderSticker(opts) {
  const dpr = opts.dpr ?? Math.min(window.devicePixelRatio || 1, 2);
  const size = opts.fontSizePx;
  const border = opts.border ?? Math.max(6, Math.round(size * 0.16));
  const fontStr = `${opts.weight} ${size}px ${opts.font}`;
  const meas = document.createElement("canvas").getContext("2d");
  meas.font = fontStr;
  const m = meas.measureText(opts.word);
  const ascent = m.actualBoundingBoxAscent || size * 0.8;
  const descent = m.actualBoundingBoxDescent || size * 0.2;
  const textW = m.width;
  const textH = ascent + descent;
  const pad = border + 4;
  const cssW = Math.ceil(textW + pad * 2);
  const cssH = Math.ceil(textH + pad * 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(cssW * dpr);
  canvas.height = Math.ceil(cssH * dpr);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.textBaseline = "alphabetic";
  ctx.font = fontStr;
  const bx = pad;
  const by = pad + ascent;
  const base = document.createElement("canvas");
  base.width = canvas.width;
  base.height = canvas.height;
  const bctx = base.getContext("2d");
  bctx.scale(dpr, dpr);
  bctx.font = fontStr;
  bctx.textBaseline = "alphabetic";
  bctx.fillStyle = opts.outline;
  for (let r = border; r > 0.5; r -= 1) {
    const stamps = Math.max(16, Math.ceil(r * 3));
    for (let a = 0; a < stamps; a++) {
      const ang = a / stamps * Math.PI * 2;
      bctx.fillText(opts.word, bx + Math.cos(ang) * r, by + Math.sin(ang) * r);
    }
  }
  bctx.fillText(opts.word, bx, by);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(base, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = opts.fill;
  ctx.font = fontStr;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(opts.word, bx, by);
  return { canvas, width: cssW, height: cssH };
}

// visuals/src/word-stickers/gl-sticker.ts
var StickerGL = class {
  canvas = document.createElement("canvas");
  available = false;
  resize(_w, _h, _dpr) {
  }
  makeTexture(_c, _w, _h) {
    return { tex: null };
  }
  beginFrame() {
  }
  drawSticker(_o) {
  }
  destroy() {
  }
};

// visuals/src/word-stickers/engine.ts
function resolveFamily(cssFamily) {
  const probe = document.createElement("span");
  probe.style.fontFamily = cssFamily;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.textContent = "Ag";
  document.body.appendChild(probe);
  const fam = getComputedStyle(probe).fontFamily || "sans-serif";
  document.body.removeChild(probe);
  return fam;
}
var FRICTION = 0.92;
var BOUNCE = 0.55;
var MIN_VEL = 0.05;
var THROW_SCALE = 0.7;
var GRAB_SCALE = 1.12;
var SCALE_EASE = 0.12;
var DRAG_EASE = 0.1;
var PEEL_EASE = 0.1;
var APPEAR_EASE = 0.09;
var APPEAR_STAGGER_MS = 140;
var PEEL_ELEVATION = 0.4;
var PEEL_PULLBACK = 0.16;
var WordStickers = class {
  host;
  items = [];
  W = 1;
  H = 1;
  dpr = 1;
  gl = null;
  useGL = false;
  raf = 0;
  running = false;
  disposed = false;
  laidOut = false;
  entranceStarted = false;
  now = 0;
  drag = null;
  ro;
  cleanup = [];
  constructor(host) {
    this.host = host;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.measure();
    const gl = new StickerGL();
    if (gl.available) {
      this.gl = gl;
      this.useGL = true;
      gl.resize(this.W, this.H, this.dpr);
      host.appendChild(gl.canvas);
    }
    for (const def of STICKERS) {
      const fontSizePx = this.stickerFontPx();
      const r = renderSticker({
        word: def.word,
        font: resolveFamily(def.font),
        weight: def.weight,
        fill: def.fill,
        outline: def.outline,
        fontSizePx
      });
      const art = r.canvas;
      let tex = null;
      if (this.useGL && this.gl) {
        tex = this.gl.makeTexture(art, r.width, r.height).tex;
      } else {
        Object.assign(art.style, {
          position: "absolute",
          width: `${r.width}px`,
          height: `${r.height}px`,
          left: "0",
          top: "0",
          pointerEvents: "none"
        });
        art.setAttribute("aria-hidden", "true");
        host.appendChild(art);
      }
      const hit = document.createElement("div");
      Object.assign(hit.style, {
        position: "absolute",
        left: "0",
        top: "0",
        width: `${r.width}px`,
        height: `${r.height}px`,
        cursor: "grab",
        touchAction: "none"
      });
      hit.setAttribute("aria-hidden", "true");
      host.appendChild(hit);
      const item = {
        def,
        art,
        hit,
        tex,
        w: r.width,
        h: r.height,
        x: def.x * this.W - r.width / 2,
        y: def.y * this.H - r.height / 2,
        tx: 0,
        ty: 0,
        vx: 0,
        vy: 0,
        scale: 1,
        dragging: false,
        peel: 0,
        grabU: 0.5,
        grabV: 0.5,
        anchorU: 0.5,
        anchorV: 0.5,
        offX: 0,
        offY: 0,
        appear: 0,
        appearAt: 0
      };
      item.tx = item.x;
      item.ty = item.y;
      this.clampInside(item);
      this.placeItem(item);
      this.items.push(item);
      this.bindDrag(item);
    }
    this.ro = new ResizeObserver(() => this.onResize());
    this.ro.observe(host);
  }
  measure() {
    this.W = this.host.clientWidth || 1;
    this.H = this.host.clientHeight || 1;
  }
  stickerFontPx() {
    const w = this.W > 40 ? this.W : 640;
    return Math.max(32, Math.min(66, w * 0.088));
  }
  onResize() {
    const prevW = this.W;
    const prevH = this.H;
    this.measure();
    if (this.W < 2 || this.H < 2) return;
    this.gl?.resize(this.W, this.H, this.dpr);
    const sx = this.W / (prevW || 1);
    const sy = this.H / (prevH || 1);
    for (const it of this.items) {
      it.x *= sx;
      it.y *= sy;
      it.tx = it.x;
      it.ty = it.y;
    }
    this.rerenderAll();
  }
  effScale(it) {
    const a = it.appearAt > 0 ? it.appear : 1;
    return it.scale * a;
  }
  placeItem(it) {
    const s = this.effScale(it);
    const t = `translate(${it.x}px, ${it.y}px)${s !== 1 ? ` scale(${s})` : ""}`;
    it.hit.style.transform = t;
    if (!this.useGL) it.art.style.transform = t;
  }
  clampInside(it) {
    it.x = Math.max(0, Math.min(this.W - it.w, it.x));
    it.y = Math.max(0, Math.min(this.H - it.h, it.y));
  }
  bindDrag(it) {
    const onDown = (e) => {
      e.preventDefault();
      this.host.appendChild(it.hit);
      it.dragging = true;
      it.vx = it.vy = 0;
      it.hit.style.cursor = "grabbing";
      it.hit.style.zIndex = "10";
      const r = this.rect();
      const gx = (e.clientX - r.left - it.x) / it.w;
      const gy = (e.clientY - r.top - it.y) / it.h;
      it.grabU = Math.min(1, Math.max(0, gx));
      it.grabV = Math.min(1, Math.max(0, gy));
      it.anchorU = 1 - it.grabU;
      it.anchorV = 1 - it.grabV;
      this.drag = {
        item: it,
        dx: e.clientX - r.left - it.x,
        dy: e.clientY - r.top - it.y,
        lastX: e.clientX,
        lastY: e.clientY,
        moved: 0,
        pointerId: e.pointerId
      };
      it.hit.setPointerCapture?.(e.pointerId);
    };
    it.hit.addEventListener("pointerdown", onDown);
    this.cleanup.push(() => it.hit.removeEventListener("pointerdown", onDown));
    const onMove = (e) => {
      if (!this.drag || this.drag.item !== it) return;
      const r = this.rect();
      it.tx = e.clientX - r.left - this.drag.dx;
      it.ty = e.clientY - r.top - this.drag.dy;
      this.drag.moved += Math.hypot(e.clientX - this.drag.lastX, e.clientY - this.drag.lastY);
      this.drag.lastX = e.clientX;
      this.drag.lastY = e.clientY;
    };
    it.hit.addEventListener("pointermove", onMove);
    this.cleanup.push(() => it.hit.removeEventListener("pointermove", onMove));
    const onUp = (e) => {
      if (!this.drag || this.drag.item !== it) return;
      it.dragging = false;
      it.hit.style.cursor = "grab";
      it.hit.style.zIndex = "";
      it.vx *= THROW_SCALE;
      it.vy *= THROW_SCALE;
      it.hit.releasePointerCapture?.(e.pointerId);
      this.drag = null;
    };
    it.hit.addEventListener("pointerup", onUp);
    it.hit.addEventListener("pointercancel", onUp);
    this.cleanup.push(() => {
      it.hit.removeEventListener("pointerup", onUp);
      it.hit.removeEventListener("pointercancel", onUp);
    });
  }
  rect() {
    return this.host.getBoundingClientRect();
  }
  start() {
    if (this.running || this.disposed) return;
    const prevW = this.W;
    this.measure();
    if (!this.laidOut || Math.abs(this.W - prevW) > 2) {
      this.layout();
      this.laidOut = true;
    }
    if (!this.entranceStarted) {
      this.entranceStarted = true;
      const order = [...this.items].sort((a, b) => a.def.x - b.def.x);
      const t0 = performance.now() + 150;
      order.forEach((it, i) => it.appearAt = t0 + i * APPEAR_STAGGER_MS);
    }
    this.running = true;
    this.raf = requestAnimationFrame(this.loop);
  }
  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  layout() {
    if (this.W < 2 || this.H < 2) return;
    this.gl?.resize(this.W, this.H, this.dpr);
    this.rerenderAll();
    for (const it of this.items) {
      it.x = it.def.x * this.W - it.w / 2;
      it.y = it.def.y * this.H - it.h / 2;
      it.tx = it.x;
      it.ty = it.y;
      it.vx = it.vy = 0;
      it.scale = 1;
      this.clampInside(it);
      this.placeItem(it);
    }
    this.drawGL();
  }
  loop = () => {
    if (!this.running) return;
    this.now = performance.now();
    for (const it of this.items) {
      if (it.appearAt > 0 && this.now >= it.appearAt && it.appear < 1) {
        it.appear += (1 - it.appear) * APPEAR_EASE;
        if (it.appear > 0.999) it.appear = 1;
      }
      const targetScale = it.dragging ? GRAB_SCALE : 1;
      if (Math.abs(targetScale - it.scale) > 1e-3) it.scale += (targetScale - it.scale) * SCALE_EASE;
      const peelTarget = it.dragging ? 1 : 0;
      if (Math.abs(peelTarget - it.peel) > 1e-3) it.peel += (peelTarget - it.peel) * PEEL_EASE;
      if (it.dragging) {
        const nx = it.x + (it.tx - it.x) * DRAG_EASE;
        const ny = it.y + (it.ty - it.y) * DRAG_EASE;
        it.vx = nx - it.x;
        it.vy = ny - it.y;
        it.x = nx;
        it.y = ny;
        this.placeItem(it);
        continue;
      }
      const appearing = it.appearAt > 0 && it.appear < 1;
      const moving = Math.abs(it.vx) >= MIN_VEL || Math.abs(it.vy) >= MIN_VEL;
      if (!moving && it.peel < 1e-3 && Math.abs(it.scale - 1) < 1e-3 && !appearing) continue;
      it.x += it.vx;
      it.y += it.vy;
      if (it.x < 0) {
        it.x = 0;
        it.vx = -it.vx * BOUNCE;
      } else if (it.x > this.W - it.w) {
        it.x = this.W - it.w;
        it.vx = -it.vx * BOUNCE;
      }
      if (it.y < 0) {
        it.y = 0;
        it.vy = -it.vy * BOUNCE;
      } else if (it.y > this.H - it.h) {
        it.y = this.H - it.h;
        it.vy = -it.vy * BOUNCE;
      }
      it.vx *= FRICTION;
      it.vy *= FRICTION;
      this.placeItem(it);
    }
    this.drawGL();
    this.raf = requestAnimationFrame(this.loop);
  };
  drawGL() {
    if (!this.useGL || !this.gl) return;
    this.gl.beginFrame();
    for (const it of this.items) {
      if (!it.tex) continue;
      this.gl.drawSticker({
        x: it.x,
        y: it.y,
        w: it.w,
        h: it.h,
        scale: this.effScale(it),
        grabU: it.grabU,
        grabV: it.grabV,
        anchorU: it.anchorU,
        anchorV: it.anchorV,
        fraction: it.peel,
        elevation: PEEL_ELEVATION,
        pullback: PEEL_PULLBACK,
        dragOffX: 0,
        dragOffY: 0,
        tex: it.tex
      });
    }
  }
  renderStill() {
    for (const it of this.items) {
      it.vx = it.vy = 0;
      it.scale = 1;
      it.peel = 0;
      it.appear = 1;
      this.placeItem(it);
    }
    this.entranceStarted = true;
    this.drawGL();
  }
  refreshFonts() {
    this.measure();
    this.gl?.resize(this.W, this.H, this.dpr);
    this.rerenderAll();
    this.drawGL();
  }
  rerenderAll() {
    const fontSizePx = this.stickerFontPx();
    for (const it of this.items) {
      const r = renderSticker({
        word: it.def.word,
        font: resolveFamily(it.def.font),
        weight: it.def.weight,
        fill: it.def.fill,
        outline: it.def.outline,
        fontSizePx
      });
      it.w = r.width;
      it.h = r.height;
      it.hit.style.width = `${r.width}px`;
      it.hit.style.height = `${r.height}px`;
      if (this.useGL && this.gl) {
        it.tex = this.gl.makeTexture(r.canvas, r.width, r.height).tex;
      } else {
        const ctx = it.art.getContext("2d");
        it.art.width = r.canvas.width;
        it.art.height = r.canvas.height;
        it.art.style.width = `${r.width}px`;
        it.art.style.height = `${r.height}px`;
        ctx.clearRect(0, 0, it.art.width, it.art.height);
        ctx.drawImage(r.canvas, 0, 0);
      }
      this.clampInside(it);
      this.placeItem(it);
    }
  }
  destroy() {
    this.disposed = true;
    this.stop();
    this.cleanup.forEach((fn) => fn());
    this.ro?.disconnect();
    for (const it of this.items) {
      it.hit.parentNode?.removeChild(it.hit);
      if (!this.useGL) it.art.parentNode?.removeChild(it.art);
    }
    this.gl?.canvas.parentNode?.removeChild(this.gl.canvas);
    this.gl?.destroy();
  }
};

// visuals/src/word-stickers/adapter.ts
var adapter_default = {
  async mount(host, props) {
    if (Array.isArray(props.words) && props.words.length) {
      props.words.slice(0, STICKERS.length).forEach((w, i) => {
        STICKERS[i].word = w;
      });
    }
    host.style.background = String(props.bg ?? "#f3f3f6");
    const engine = new WordStickers(host);
    let raf = 0;
    const t0 = performance.now();
    const fling = () => {
      const t = (now) => {
        const el = host.querySelector("div[style*='cursor: grab']");
        if (el) {
          const r = host.getBoundingClientRect();
          const k = (now - t0) / 1e3 * 0.6;
          const x = r.left + r.width * (0.5 + Math.sin(k) * 0.3);
          const y = r.top + r.height * (0.5 + Math.cos(k * 1.3) * 0.24);
          el.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y, bubbles: true, pointerType: "mouse" }));
        }
        raf = requestAnimationFrame(t);
      };
      raf = requestAnimationFrame(t);
    };
    return {
      start: () => {
        engine.start();
        fling();
      },
      destroy: () => {
        cancelAnimationFrame(raf);
        engine.destroy();
      }
    };
  }
};
export {
  adapter_default as default
};
