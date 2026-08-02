var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// visuals/src/cinema/compositor.ts
var require_compositor = __commonJS({
  "visuals/src/cinema/compositor.ts"() {
    var state = { spec: null, canvas: null, ctx: null, cache: /* @__PURE__ */ new Map() };
    var frameUrl = (i) => `${state.spec.framesBase}f${String(i + 1).padStart(5, "0")}.jpg`;
    async function loadFrame(i) {
      const hit = state.cache.get(i);
      if (hit) return hit;
      const img = new Image();
      img.src = frameUrl(i);
      await img.decode();
      state.cache.set(i, img);
      for (const k of state.cache.keys()) {
        if (state.cache.size <= 4) break;
        if (k < i - 1) state.cache.delete(k);
      }
      return img;
    }
    function drawWithTransform(ctx, img, t, W, H, alpha = 1) {
      const zoom = Math.max(1, t.zoom);
      const sw = W / zoom, sh = H / zoom;
      const sx = Math.min(W - sw, Math.max(0, t.cx * W - sw / 2));
      const sy = Math.min(H - sh, Math.max(0, t.cy * H - sh / 2));
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    }
    var lerpT = (a, b, f) => ({
      zoom: a.zoom + (b.zoom - a.zoom) * f,
      cx: a.cx + (b.cx - a.cx) * f,
      cy: a.cy + (b.cy - a.cy) * f
    });
    async function renderFrame(i) {
      const spec = state.spec;
      const { width: W, height: H } = spec;
      const ctx = state.ctx;
      const idx = Math.min(spec.frameCount - 1, Math.max(0, i));
      const t = spec.transforms[Math.min(idx, spec.transforms.length - 1)];
      const prev = spec.transforms[Math.max(0, Math.min(idx, spec.transforms.length - 1) - 1)];
      const img = await loadFrame(idx);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      const b = spec.blur;
      const panV = Math.hypot(t.vx, t.vy);
      const zoomV = Math.abs(t.vz);
      let radius = 0;
      if (b.amount > 0) {
        if (panV > b.panThreshold) radius = Math.max(radius, (panV - b.panThreshold) * b.panScale);
        if (zoomV > b.zoomThreshold) radius = Math.max(radius, (zoomV - b.zoomThreshold) * b.zoomScale);
        radius = Math.min(b.maxRadius, radius) * (b.amount / 0.35);
      }
      if (radius >= 2 && idx > 0) {
        const K = Math.min(8, Math.ceil(radius / 2));
        const weights = [];
        for (let j = 0; j <= K; j++) {
          const trail = j / K;
          weights.push(0.25 + 0.75 * (1 + Math.cos(trail * Math.PI)) / 2);
        }
        let cum = 0;
        for (let j = K; j >= 0; j--) {
          const w = weights[j];
          cum += w;
          const alpha = w / cum;
          const f = 1 - j / (K + 1);
          drawWithTransform(ctx, img, lerpT(prev, t, f), W, H, alpha);
        }
      } else {
        drawWithTransform(ctx, img, t, W, H, 1);
      }
      ctx.globalAlpha = 1;
      if (idx + 1 < spec.frameCount) void loadFrame(idx + 1).catch(() => void 0);
      return state.canvas.toDataURL("image/jpeg", spec.jpegQuality ?? 0.9);
    }
    async function init(spec) {
      state.spec = spec;
      state.cache.clear();
      const c = document.createElement("canvas");
      c.width = spec.width;
      c.height = spec.height;
      c.style.width = `${spec.width}px`;
      c.style.height = `${spec.height}px`;
      document.body.textContent = "";
      document.body.appendChild(c);
      state.canvas = c;
      state.ctx = c.getContext("2d", { willReadFrequently: false });
      await loadFrame(0);
    }
    window.__CINEMA__ = { init, renderFrame };
    window.__CINEMA_READY__ = true;
  }
});
export default require_compositor();
