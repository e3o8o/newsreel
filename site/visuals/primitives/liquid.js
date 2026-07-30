// visuals/src/liquid/sdf.ts
function sdRoundBox(px, py, cx, cy, hw, hh, r) {
  const rr = Math.min(r, Math.min(hw, hh));
  const qx = Math.abs(px - cx) - hw + rr;
  const qy = Math.abs(py - cy) - hh + rr;
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  const outside = Math.hypot(ax, ay);
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - rr;
}
function sdCapsule(px, py, ax, ay, bx, by, r) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const denom = bax * bax + bay * bay || 1e-6;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / denom));
  const dx = pax - bax * h;
  const dy = pay - bay * h;
  return Math.hypot(dx, dy) - r;
}
function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k));
  return b * (1 - h) + a * h - k * h * (1 - h);
}
function shapeSD(s, px, py) {
  return s.kind === "box" ? sdRoundBox(px, py, s.cx, s.cy, s.hw, s.hh, s.r) : sdCapsule(px, py, s.ax, s.ay, s.bx, s.by, s.r);
}
var Field = class {
  shapes;
  k;
  constructor(shapes = [], k = 12) {
    this.shapes = shapes;
    this.k = k;
  }
  eval(x, y) {
    const { shapes, k } = this;
    if (shapes.length === 0) return Infinity;
    let d = shapeSD(shapes[0], x, y);
    for (let i = 1; i < shapes.length; i++) {
      d = smin(d, shapeSD(shapes[i], x, y), k);
    }
    return d;
  }
  /** Axis-aligned bounds of the whole group, padded so the fused skin (which bulges
   *  OUTSIDE each box by up to ~k at the fillets) is fully contained in the sample
   *  grid. Without the pad the marching-squares grid would clip the blend. */
  bounds(pad = 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const grow = pad + this.k;
    for (const s of this.shapes) {
      if (s.kind === "box") {
        minX = Math.min(minX, s.cx - s.hw - grow);
        minY = Math.min(minY, s.cy - s.hh - grow);
        maxX = Math.max(maxX, s.cx + s.hw + grow);
        maxY = Math.max(maxY, s.cy + s.hh + grow);
      } else {
        minX = Math.min(minX, Math.min(s.ax, s.bx) - s.r - grow);
        minY = Math.min(minY, Math.min(s.ay, s.by) - s.r - grow);
        maxX = Math.max(maxX, Math.max(s.ax, s.bx) + s.r + grow);
        maxY = Math.max(maxY, Math.max(s.ay, s.by) + s.r + grow);
      }
    }
    if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return { minX, minY, maxX, maxY };
  }
};

// visuals/src/liquid/marching-squares.ts
var fmt = (v) => v.toFixed(2);
var EDGES = [
  [],
  // 0000
  [[3, 2]],
  // 0001 BL
  [[2, 1]],
  // 0010 BR
  [[3, 1]],
  // 0011 BL+BR
  [[0, 1]],
  // 0100 TR
  [[3, 2], [0, 1]],
  // 0101 saddle TL?/TR/BL
  [[0, 2]],
  // 0110 TR+BR
  [[3, 0]],
  // 0111 TR+BR+BL
  [[3, 0]],
  // 1000 TL
  [[0, 2]],
  // 1001 TL+BL
  [[3, 0], [2, 1]],
  // 1010 saddle
  [[0, 1]],
  // 1011 TL+BL+BR
  [[3, 1]],
  // 1100 TL+TR
  [[2, 1]],
  // 1101 TL+TR+BL
  [[3, 2]],
  // 1110 TL+TR+BR
  []
  // 1111
];
function lerpEdge(x0, y0, v0, x1, y1, v1) {
  const denom = v0 - v1;
  const t = Math.abs(denom) < 1e-6 ? 0.5 : v0 / denom;
  const tc = Math.max(0, Math.min(1, t));
  return { x: x0 + (x1 - x0) * tc, y: y0 + (y1 - y0) * tc };
}
function contour(field, opts = {}) {
  const cell = Math.max(2, opts.cell ?? 6);
  const b = field.bounds();
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  if (w <= 0 || h <= 0) return [];
  const cols = Math.ceil(w / cell) + 1;
  const rows = Math.ceil(h / cell) + 1;
  if (cols * rows > 4e5) return [];
  const val = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    const y = b.minY + j * cell;
    for (let i = 0; i < cols; i++) {
      val[j * cols + i] = field.eval(b.minX + i * cell, y);
    }
  }
  const at = (i, j) => val[j * cols + i];
  const segs = [];
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const x0 = b.minX + i * cell;
      const y0 = b.minY + j * cell;
      const x1 = x0 + cell;
      const y1 = y0 + cell;
      const vTL = at(i, j);
      const vTR = at(i + 1, j);
      const vBR = at(i + 1, j + 1);
      const vBL = at(i, j + 1);
      let mask = 0;
      if (vTL < 0) mask |= 8;
      if (vTR < 0) mask |= 4;
      if (vBR < 0) mask |= 2;
      if (vBL < 0) mask |= 1;
      if (mask === 0 || mask === 15) continue;
      const edgePt = (edge) => {
        switch (edge) {
          case 0:
            return lerpEdge(x0, y0, vTL, x1, y0, vTR);
          // top
          case 1:
            return lerpEdge(x1, y0, vTR, x1, y1, vBR);
          // right
          case 2:
            return lerpEdge(x0, y1, vBL, x1, y1, vBR);
          // bottom
          default:
            return lerpEdge(x0, y0, vTL, x0, y1, vBL);
        }
      };
      let cases = EDGES[mask];
      if (mask === 5 || mask === 10) {
        const center = field.eval((x0 + x1) / 2, (y0 + y1) / 2);
        if (mask === 5) cases = center < 0 ? [[3, 0], [2, 1]] : [[3, 2], [0, 1]];
        else cases = center < 0 ? [[3, 2], [0, 1]] : [[3, 0], [2, 1]];
      }
      for (const [ea, eb] of cases) segs.push([edgePt(ea), edgePt(eb)]);
    }
  }
  return stitch(segs, cell);
}
function stitch(segs, cell) {
  const eps = cell * 0.5;
  const key = (p) => `${Math.round(p.x / eps)},${Math.round(p.y / eps)}`;
  const map = /* @__PURE__ */ new Map();
  segs.forEach((s, idx) => {
    for (const end of [0, 1]) {
      const k = key(s[end]);
      const arr = map.get(k);
      if (arr) arr.push({ seg: idx, end });
      else map.set(k, [{ seg: idx, end }]);
    }
  });
  const used = new Array(segs.length).fill(false);
  const loops = [];
  for (let start = 0; start < segs.length; start++) {
    if (used[start]) continue;
    const loop = [];
    let cur = start;
    let end = 0;
    let guard = 0;
    while (!used[cur] && guard++ < segs.length + 2) {
      used[cur] = true;
      const a = segs[cur][end];
      const bEnd = end === 0 ? 1 : 0;
      const bPt = segs[cur][bEnd];
      loop.push(a);
      const cands = map.get(key(bPt)) ?? [];
      let next = -1;
      let nextEnd = 0;
      for (const c of cands) {
        if (!used[c.seg]) {
          next = c.seg;
          nextEnd = c.end;
          break;
        }
      }
      if (next === -1) break;
      cur = next;
      end = nextEnd;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}
function chaikin(pts, passes) {
  let out = pts;
  for (let p = 0; p < passes; p++) {
    const next = [];
    const n = out.length;
    for (let i = 0; i < n; i++) {
      const a = out[i];
      const b = out[(i + 1) % n];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    out = next;
  }
  return out;
}
function fieldToPath(field, opts = {}) {
  const b = field.bounds();
  const loops = contour(field, opts);
  const smooth = opts.smooth ?? 2;
  const parts = [];
  for (const loop of loops) {
    const s = smooth > 0 ? chaikin(loop, smooth) : loop;
    if (s.length < 3) continue;
    parts.push(
      `M ${fmt(s[0].x)} ${fmt(s[0].y)} ` + s.slice(1).map((p) => `L ${fmt(p.x)} ${fmt(p.y)}`).join(" ") + " Z"
    );
  }
  return {
    d: parts.join(" "),
    minX: b.minX,
    minY: b.minY,
    width: b.maxX - b.minX,
    height: b.maxY - b.minY
  };
}

// visuals/src/liquid/engine.ts
var DEFAULT_PARAMS = { k: 26, cell: 6, smooth: 2 };
var LiquidEngine = class {
  boxes = [];
  bridges = [];
  params = { ...DEFAULT_PARAMS };
  cachedPath = null;
  sig = "";
  // signature of the last inputs, to skip redundant recompute
  setBoxes(boxes) {
    this.boxes = boxes;
  }
  setBridges(bridges) {
    this.bridges = bridges;
  }
  setParams(p) {
    this.params = { ...this.params, ...p };
  }
  signature() {
    const b = this.boxes.map((x) => `${x.cx.toFixed(1)},${x.cy.toFixed(1)},${x.hw},${x.hh},${x.r}`).join("|");
    const br = this.bridges.map((x) => `${x.ax.toFixed(1)},${x.ay.toFixed(1)},${x.bx.toFixed(1)},${x.by.toFixed(1)},${x.r}`).join("|");
    const p = this.params;
    return `${b}#${br}#${p.k},${p.cell},${p.smooth}`;
  }
  /** Compute the fused path. Returns the cached result if nothing changed. */
  compute() {
    const sig = this.signature();
    if (sig === this.sig && this.cachedPath) return this.cachedPath;
    this.sig = sig;
    const shapes = [
      ...this.boxes.map((b) => ({
        kind: "box",
        cx: b.cx,
        cy: b.cy,
        hw: b.hw,
        hh: b.hh,
        r: b.r
      })),
      ...this.bridges
    ];
    const field = new Field(shapes, this.params.k);
    const opts = { cell: this.params.cell, smooth: this.params.smooth };
    this.cachedPath = fieldToPath(field, opts);
    return this.cachedPath;
  }
  /** Whether the inputs changed since the last compute() (drives the rAF morph). */
  isDirty() {
    return this.signature() !== this.sig;
  }
};

// visuals/src/liquid/adapter.ts
var VW = 720;
var VH = 380;
var bar = (w, h) => {
  const d = document.createElement("div");
  Object.assign(d.style, { width: w, height: h, borderRadius: "999px", background: "rgba(20,22,30,0.14)" });
  return d;
};
function bubbleBody() {
  const wrap = document.createElement("div");
  Object.assign(wrap.style, { display: "flex", height: "100%", alignItems: "center", gap: "14px", padding: "0 22px" });
  const av = document.createElement("div");
  Object.assign(av.style, { width: "44px", height: "44px", flex: "none", borderRadius: "50%", background: "rgba(20,22,30,0.14)" });
  const lines = document.createElement("div");
  Object.assign(lines.style, { display: "flex", flexDirection: "column", gap: "9px", flex: "1" });
  lines.append(bar("78%", "10px"), bar("52%", "10px"));
  wrap.append(av, lines);
  return wrap;
}
var adapter_default = {
  async mount(host, props) {
    host.style.background = String(props.bg ?? "#eef0f5");
    const space = document.createElement("div");
    Object.assign(space.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      width: `${VW}px`,
      height: `${VH}px`,
      transformOrigin: "center"
    });
    host.appendChild(space);
    const fit = () => {
      const s = Math.min(host.clientWidth / VW, host.clientHeight / VH) * 0.92;
      space.style.transform = `translate(-50%,-50%) scale(${s})`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("aria-hidden", "true");
    Object.assign(svg.style, { position: "absolute", overflow: "visible", pointerEvents: "none" });
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("fill", String(props.fill ?? "#ffffff"));
    path.setAttribute("filter", "drop-shadow(0 10px 24px rgba(20,22,40,0.10))");
    svg.appendChild(path);
    space.appendChild(svg);
    const pieces = [
      { id: "bubble", cx: 300, cy: 178, hw: 150, hh: 56, r: 40, ax: 16, ay: 8, fx: 0.21, fy: 0.33, phase: 0, content: bubbleBody() },
      { id: "tail", cx: 476, cy: 250, hw: 27, hh: 27, r: 14, ax: 30, ay: 22, fx: 0.29, fy: 0.19, phase: 1.7 }
    ];
    for (const p of pieces) {
      if (!p.content) continue;
      Object.assign(p.content.style, { position: "absolute", zIndex: "1" });
      space.appendChild(p.content);
    }
    const engine = new LiquidEngine();
    const goo = props.goo === true;
    const k = Number(props.k ?? (goo ? 64 : 24));
    engine.setParams({ k, cell: Number(props.cell ?? 6), smooth: 2 });
    let raf = 0;
    const t0 = performance.now();
    const frame = (now) => {
      const t = (now - t0) / 1e3;
      const boxes = pieces.map((p) => {
        const cx = p.cx + Math.sin(t * p.fx * 2 + p.phase) * p.ax;
        const cy = p.cy + Math.cos(t * p.fy * 2 + p.phase) * p.ay;
        if (p.content) {
          Object.assign(p.content.style, {
            left: `${cx - p.hw}px`,
            top: `${cy - p.hh}px`,
            width: `${p.hw * 2}px`,
            height: `${p.hh * 2}px`
          });
        }
        return { id: p.id, cx, cy, hw: p.hw, hh: p.hh, r: p.r };
      });
      engine.setBoxes(boxes);
      const out = engine.compute();
      path.setAttribute("d", out.d);
      svg.setAttribute("viewBox", `${out.minX} ${out.minY} ${out.width} ${out.height}`);
      Object.assign(svg.style, {
        left: `${out.minX}px`,
        top: `${out.minY}px`,
        width: `${out.width}px`,
        height: `${out.height}px`
      });
      raf = requestAnimationFrame(frame);
    };
    return {
      start: () => {
        raf = requestAnimationFrame(frame);
      },
      destroy: () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        space.remove();
      }
    };
  }
};
export {
  adapter_default as default
};
