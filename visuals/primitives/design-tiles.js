// src/design-tiles/palette.ts
var WORDS = ["design", "is", "how", "it", "works"];
var SWATCHES = [
  { bg: "#0a0a0a", fg: "#ffffff" },
  { bg: "#ff2e20", fg: "#0a0a0a" },
  { bg: "#f0c2f7", fg: "#0a0a0a" },
  { bg: "#22e58b", fg: "#0a0a0a" },
  { bg: "#7c4dff", fg: "#ffffff" },
  { bg: "#ffe14d", fg: "#0a0a0a" },
  { bg: "#18b6ff", fg: "#0a0a0a" },
  { bg: "#ff7a1a", fg: "#0a0a0a" },
  { bg: "#ff4fa3", fg: "#0a0a0a" }
];
function randomSwatchAvoiding(used) {
  const free = SWATCHES.filter((s) => !used.includes(s));
  const pool = free.length > 0 ? free : SWATCHES;
  return pool[Math.random() * pool.length | 0];
}
var INITIAL = [
  SWATCHES[0],
  SWATCHES[1],
  SWATCHES[2],
  SWATCHES[3],
  SWATCHES[4]
];

// src/design-tiles/measure.ts
var REF_FS = 100;
var BASELINE_Y = 100;
var ctx = null;
function context() {
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  return ctx;
}
function setFont(c, fontFamily, weight) {
  const candidates = [
    `${weight} ${REF_FS}px ${fontFamily}`,
    // just the first family, quoted if it needs it
    `${weight} ${REF_FS}px ${(fontFamily.split(",")[0] || "").trim()}, sans-serif`,
    `${weight} ${REF_FS}px sans-serif`
  ];
  for (const font of candidates) {
    c.font = font;
    if (c.font.includes(`${REF_FS}px`)) return;
  }
}
function measureWord(word, fontFamily, weight = "500") {
  const c = context();
  if (!c || !word) return null;
  setFont(c, fontFamily, weight);
  const glyphs = [];
  let pen = 0;
  for (const ch of word) {
    const m = c.measureText(ch);
    const asc = m.actualBoundingBoxAscent || REF_FS * 0.72;
    const desc = m.actualBoundingBoxDescent || 0;
    glyphs.push({
      ch,
      x: pen,
      w: m.width,
      top: BASELINE_Y - asc,
      bottom: BASELINE_Y + desc
    });
    pen += m.width;
  }
  return { width: pen, glyphs };
}

// src/design-tiles/engine.ts
var SVGNS = "http://www.w3.org/2000/svg";
var FLY_STAGGER = 130;
var FLY_MS = 760;
var SHUFFLE_MIN = 1300;
var SHUFFLE_MAX = 3200;
var COLOR_MS = 520;
var PAD_Y = 6;
var PAD_X = 2;
var BAND_ASCENT = 82;
var BAND_DESCENT = 26;
var DesignTiles = class {
  host;
  root;
  bar;
  tiles = [];
  fontFamily = "sans-serif";
  raf = 0;
  running = false;
  disposed = false;
  revealed = false;
  now = 0;
  ro;
  cleanup = [];
  constructor(host) {
    this.host = host;
    const root = document.createElement("div");
    Object.assign(root.style, {
      position: "absolute",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-kyoto), var(--font-neue-montreal), system-ui, sans-serif",
      userSelect: "none"
    });
    root.setAttribute("aria-label", WORDS.join(" "));
    this.fontFamily = getComputedStyle(root).fontFamily || "var(--font-kyoto), sans-serif";
    const bar = document.createElement("div");
    Object.assign(bar.style, { display: "flex", alignItems: "center" });
    WORDS.forEach((word, i) => {
      const sw = INITIAL[i] ?? randomSwatchAvoiding([]);
      const outer = document.createElement("span");
      Object.assign(outer.style, {
        display: "grid",
        gridTemplateColumns: "0fr",
        transition: `grid-template-columns ${FLY_MS}ms cubic-bezier(.16,1,.3,1)`
      });
      const clip = document.createElement("span");
      clip.style.overflow = "hidden";
      const svg = document.createElementNS(SVGNS, "svg");
      Object.assign(svg.style, {
        display: "block",
        height: "clamp(1.6rem, 4vw, 2.9rem)",
        opacity: "0",
        transition: `opacity ${Math.round(FLY_MS * 0.8)}ms ease`
      });
      const gBg = document.createElementNS(SVGNS, "g");
      const textEl = document.createElementNS(SVGNS, "text");
      textEl.setAttribute("font-family", this.fontFamily);
      textEl.setAttribute("font-weight", "500");
      textEl.setAttribute("font-size", String(REF_FS));
      textEl.setAttribute("dominant-baseline", "alphabetic");
      textEl.style.fill = sw.fg;
      textEl.style.transition = `fill ${COLOR_MS}ms ease`;
      textEl.textContent = word;
      svg.appendChild(gBg);
      svg.appendChild(textEl);
      clip.appendChild(svg);
      outer.appendChild(clip);
      bar.appendChild(outer);
      this.tiles.push({
        outer,
        svg,
        rects: [],
        textEl,
        word,
        swatch: sw,
        nextShuffle: 0
      });
    });
    root.appendChild(bar);
    host.appendChild(root);
    this.root = root;
    this.bar = bar;
    this.layout();
    this.bindEvents();
  }
  layout() {
    for (const tile of this.tiles) {
      const m = measureWord(tile.word, this.fontFamily, "500");
      for (const r of tile.rects) r.el.remove();
      tile.rects = [];
      if (!m) {
        this.buildFallback(tile);
        continue;
      }
      this.buildRects(tile, m);
    }
  }
  buildRects(tile, m) {
    const gBg = tile.svg.firstChild;
    const bandTop = BASELINE_Y - BAND_ASCENT;
    const bandBottom = BASELINE_Y + BAND_DESCENT;
    for (let i = 0; i < m.glyphs.length; i++) {
      const g = m.glyphs[i];
      if (g.ch === " ") continue;
      const top = Math.max(bandTop, g.top - PAD_Y);
      const bottom = Math.min(bandBottom, g.bottom + PAD_Y);
      const next = m.glyphs[i + 1];
      const right = next ? next.x : g.x + g.w;
      const left = g.x - (i === 0 ? PAD_X : 0);
      const width = right - left + PAD_X;
      const rect = document.createElementNS(SVGNS, "rect");
      rect.setAttribute("x", String(left));
      rect.setAttribute("y", String(top));
      rect.setAttribute("width", String(width));
      rect.setAttribute("height", String(bottom - top));
      rect.style.fill = tile.swatch.bg;
      rect.style.transition = `fill ${COLOR_MS}ms ease, y 160ms ease, height 160ms ease`;
      gBg.appendChild(rect);
      tile.rects.push({
        el: rect,
        x0: left,
        x1: left + width,
        baseY: top,
        baseH: bottom - top,
        hovered: false
      });
    }
    tile.textEl.setAttribute("x", "0");
    tile.textEl.setAttribute("y", String(BASELINE_Y));
    const vbX = -PAD_X;
    const vbW = m.width + PAD_X * 2;
    const vbY = bandTop;
    const vbH = bandBottom - bandTop;
    tile.svg.setAttribute("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`);
    tile.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    tile.svg.removeAttribute("width");
    tile.svg.removeAttribute("height");
    tile.svg.style.width = "auto";
  }
  buildFallback(tile) {
    const gBg = tile.svg.firstChild;
    const rect = document.createElementNS(SVGNS, "rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", "100");
    rect.setAttribute("height", "100");
    rect.style.fill = tile.swatch.bg;
    gBg.appendChild(rect);
    tile.rects.push({ el: rect, x0: 0, x1: 100, baseY: 0, baseH: 100, hovered: false });
    tile.svg.setAttribute("viewBox", "0 0 100 100");
  }
  bindEvents() {
    this.tiles.forEach((tile) => {
      const onEnter = () => this.recolor(tile);
      tile.svg.addEventListener("pointerenter", onEnter);
      const onMove = (e) => this.hoverLetter(tile, e);
      const onLeave = () => this.clearHover(tile);
      tile.svg.addEventListener("pointermove", onMove);
      tile.svg.addEventListener("pointerleave", onLeave);
      this.cleanup.push(() => {
        tile.svg.removeEventListener("pointerenter", onEnter);
        tile.svg.removeEventListener("pointermove", onMove);
        tile.svg.removeEventListener("pointerleave", onLeave);
      });
    });
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.host);
  }
  hoverLetter(tile, e) {
    const rect = tile.svg.getBoundingClientRect();
    if (rect.width < 1) return;
    const vb = tile.svg.viewBox.baseVal;
    const scale = vb.width / rect.width;
    const grow = 2 * scale;
    const px = vb.x + (e.clientX - rect.left) / rect.width * vb.width;
    for (const r of tile.rects) {
      const isHit = px >= r.x0 && px < r.x1;
      if (isHit === r.hovered) continue;
      r.hovered = isHit;
      if (isHit) {
        r.el.style.y = `${r.baseY - grow / 2}px`;
        r.el.style.height = `${r.baseH + grow}px`;
      } else {
        r.el.style.y = `${r.baseY}px`;
        r.el.style.height = `${r.baseH}px`;
      }
    }
  }
  clearHover(tile) {
    for (const r of tile.rects) {
      if (!r.hovered) continue;
      r.hovered = false;
      r.el.style.y = `${r.baseY}px`;
      r.el.style.height = `${r.baseH}px`;
    }
  }
  recolor(tile) {
    const used = this.tiles.filter((t) => t !== tile).map((t) => t.swatch);
    const sw = randomSwatchAvoiding(used);
    tile.swatch = sw;
    for (const r of tile.rects) r.el.style.fill = sw.bg;
    tile.textEl.style.fill = sw.fg;
  }
  refreshFont() {
    this.fontFamily = getComputedStyle(this.root).fontFamily || this.fontFamily;
    for (const tile of this.tiles) tile.textEl.setAttribute("font-family", this.fontFamily);
    this.layout();
  }
  reveal() {
    if (this.revealed) return;
    this.revealed = true;
    this.tiles.forEach((tile, i) => {
      const delay = i * FLY_STAGGER;
      const t = window.setTimeout(() => {
        tile.outer.style.gridTemplateColumns = "1fr";
        tile.svg.style.opacity = "1";
      }, delay);
      this.cleanup.push(() => window.clearTimeout(t));
    });
    const assembledAt = this.tiles.length * FLY_STAGGER + FLY_MS;
    this.tiles.forEach((tile) => {
      tile.nextShuffle = performance.now() + assembledAt + SHUFFLE_MIN + Math.random() * (SHUFFLE_MAX - SHUFFLE_MIN);
    });
  }
  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.reveal();
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
    for (const tile of this.tiles) {
      if (tile.nextShuffle === 0) continue;
      if (this.now >= tile.nextShuffle) {
        this.recolor(tile);
        tile.nextShuffle = this.now + SHUFFLE_MIN + Math.random() * (SHUFFLE_MAX - SHUFFLE_MIN);
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  };
  renderStill() {
    this.revealed = true;
    this.tiles.forEach((tile) => {
      tile.outer.style.transition = "none";
      tile.outer.style.gridTemplateColumns = "1fr";
      tile.svg.style.transition = "none";
      tile.svg.style.opacity = "1";
    });
  }
  destroy() {
    this.disposed = true;
    this.stop();
    this.ro?.disconnect();
    this.cleanup.forEach((fn) => fn());
    this.root.parentNode?.removeChild(this.root);
    void this.bar;
  }
};

// src/design-tiles/adapter.ts
var adapter_default = {
  async mount(host, props) {
    if (Array.isArray(props.words) && props.words.length) {
      WORDS.splice(0, WORDS.length, ...props.words);
    }
    host.style.background = String(props.bg ?? "#fbfbfc");
    const engine = new DesignTiles(host);
    const scale = () => {
      const bar = host.firstElementChild;
      if (!bar) return;
      const w = bar.getBoundingClientRect().width || 1;
      const target = host.clientWidth * 0.82;
      bar.style.transformOrigin = "center";
      bar.style.transform = `scale(${Math.max(1, Math.min(6, target / w))})`;
    };
    return {
      start: () => {
        engine.start();
        setTimeout(scale, 400);
        setTimeout(scale, 1600);
      },
      destroy: () => engine.destroy()
    };
  }
};
export {
  adapter_default as default
};
