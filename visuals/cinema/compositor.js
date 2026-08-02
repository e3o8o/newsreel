var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// lib/camera/overlay.cjs
var require_overlay = __commonJS({
  "lib/camera/overlay.cjs"(exports, module) {
    "use strict";
    function cursorPx(scale, frameW, zoom) {
      return 28 * scale * Math.max(0.55, frameW / 1920) * Math.max(1, zoom);
    }
    var SQUASH_MS = 350;
    var SQUASH_FLOOR = 0.72;
    function squashScale(p, bounce, zoom = 1) {
      if (p < 0 || p > 1) return 1;
      const depth = 0.08 * bounce * Math.sqrt(Math.max(1, zoom));
      return Math.max(SQUASH_FLOOR, 1 - Math.sin(p * Math.PI) * depth);
    }
    function cursorSpring(smoothing) {
      const s = Math.max(0, Math.min(2, smoothing));
      if (s === 0) return null;
      return { response: 0.09 * (s / 0.67), zeta: 0.855 };
    }
    var EFFECT_DELAY_MS = SQUASH_MS / 2;
    function rippleShape(p, cursorH, scale, opacity) {
      const inv = 1 - p * p * p;
      return {
        radius: Math.max(0.5, inv * cursorH * 1.95 * scale),
        alpha: Math.max(0, Math.min(1, p * p * p * 0.6 * opacity)),
        strokeWidth: Math.max(1, 2 * p * p * p)
      };
    }
    function spotlightShape(p, cursorH, scale, opacity) {
      const base = Math.max(12, cursorH * 0.55 * scale);
      const glow = base + (1 - p) * cursorH * scale;
      const inner = Math.max(base * 0.72, glow * 0.76);
      const sw = Math.max(2, cursorH * 0.08);
      const alpha = p * opacity;
      return {
        glowR: glow,
        innerR: inner,
        outerAlpha: alpha * 0.28,
        outerWidth: Math.max(1.25, sw * 0.68),
        innerAlpha: alpha * 0.5,
        innerWidth: Math.max(1.5, sw * 0.75)
      };
    }
    var SNAP_S = 0.1;
    function sampleTrack(track, t) {
      if (!track.length) return null;
      if (t <= track[0][0]) return { x: track[0][1], y: track[0][2] };
      if (t >= track[track.length - 1][0]) {
        const last = track[track.length - 1];
        return { x: last[1], y: last[2] };
      }
      let lo = 0, hi = track.length - 1;
      while (hi - lo > 1) {
        const mid = lo + hi >> 1;
        if (track[mid][0] <= t) lo = mid;
        else hi = mid;
      }
      const a = track[lo], b = track[hi];
      const gap = b[0] - a[0];
      if (gap > SNAP_S) return { x: a[1], y: a[2] };
      const f = gap > 0 ? (t - a[0]) / gap : 1;
      return { x: a[1] + (b[1] - a[1]) * f, y: a[2] + (b[2] - a[2]) * f };
    }
    module.exports = {
      SQUASH_MS,
      SQUASH_FLOOR,
      EFFECT_DELAY_MS,
      SNAP_S,
      cursorPx,
      squashScale,
      cursorSpring,
      rippleShape,
      spotlightShape,
      sampleTrack
    };
  }
});

// lib/camera/spring.cjs
var require_spring = __commonJS({
  "lib/camera/spring.cjs"(exports, module) {
    "use strict";
    var ZETA = 0.9;
    var RESPONSE_POS = 0.35;
    var RESPONSE_ZOOM = 0.55;
    var RESP_FILL_POS = 0.4;
    var RESP_FILL_ZOOM = 0.45;
    var RESP_MIN = 0.15;
    var HOLD_DAMP = 0.3;
    var PUSH_CAP = 0.03;
    var PUSH_STIFF = 12;
    var HOLD_EPS = 1e-3;
    function springStep(x, v, target, dt, response = RESPONSE_POS, zeta = ZETA) {
      const omega = 2 * Math.PI / Math.max(1e-6, response);
      const d = x - target;
      const zo = zeta * omega;
      const decay = Math.exp(-zo * dt);
      if (zeta >= 1) {
        const B2 = v + zo * d;
        const x12 = target + (d + B2 * dt) * decay;
        const v12 = (B2 - zo * (d + B2 * dt)) * decay;
        return { x: x12, v: v12 };
      }
      const wd = omega * Math.sqrt(1 - zeta * zeta);
      const B = (v + zo * d) / wd;
      const cos = Math.cos(wd * dt), sin = Math.sin(wd * dt);
      const x1 = target + decay * (d * cos + B * sin);
      const v1 = decay * (-zo * (d * cos + B * sin) + (-d * wd * sin + B * wd * cos));
      return { x: x1, v: v1 };
    }
    function clampCenter(c, zoom) {
      const half = 0.5 / Math.max(1, zoom);
      return Math.min(1 - half, Math.max(half, c));
    }
    function softPushback(x, v, zoom, dt) {
      const half = 0.5 / Math.max(1, zoom);
      const lo = half, hi = 1 - half;
      let ovf = 0;
      if (x < lo) ovf = x - lo;
      else if (x > hi) ovf = x - hi;
      if (ovf !== 0) {
        v *= Math.max(0, 1 - Math.min(1, Math.abs(ovf) / PUSH_CAP) * 0.5 * dt * PUSH_STIFF);
        v -= ovf * PUSH_STIFF * 0.3 * dt;
        x = Math.min(hi + PUSH_CAP, Math.max(lo - PUSH_CAP, x));
      }
      return { x, v };
    }
    var isHold = (seg) => Math.abs(seg.to.zoom - seg.from.zoom) < HOLD_EPS && Math.abs(seg.to.cx - seg.from.cx) < HOLD_EPS && Math.abs(seg.to.cy - seg.from.cy) < HOLD_EPS;
    function bake(plan, opts = {}) {
      const fps = Number(plan.clip.fps || 30);
      const durOut = Number(plan.clip.durOut);
      const maxZoom = Number(plan.config && plan.config.maxZoom || opts.maxZoom || 4);
      const basePos = Number(opts.response || plan.config && plan.config.response || RESPONSE_POS);
      const baseZoom = Number(opts.zoomResponse || plan.config && plan.config.zoomResponse || RESPONSE_ZOOM);
      const dt = 1 / fps;
      const frames = Math.max(1, Math.round(durOut * fps));
      const segs = plan.segments;
      let cx = segs[0].from.cx, cy = segs[0].from.cy, zoom = segs[0].from.zoom;
      let vx = 0, vy = 0, vz = 0;
      let segIdx = -1;
      let posResp = basePos, zoomResp = baseZoom;
      const out = [];
      for (let f = 0; f < frames; f++) {
        const t = f * dt;
        let idx = segs.length - 1;
        for (let i = 0; i < segs.length; i++) {
          if (t < segs[i].t1 || i === segs.length - 1) {
            idx = i;
            break;
          }
        }
        const seg = segs[idx];
        if (idx !== segIdx) {
          segIdx = idx;
          const segDur = Math.max(0.05, seg.t1 - seg.t0);
          posResp = Math.max(RESP_MIN, Math.max(basePos, segDur * RESP_FILL_POS));
          zoomResp = Math.max(RESP_MIN, Math.max(baseZoom, segDur * RESP_FILL_ZOOM));
          if (isHold(seg)) {
            vx *= HOLD_DAMP;
            vy *= HOLD_DAMP;
            vz *= HOLD_DAMP;
          }
        }
        const sx = springStep(cx, vx, seg.to.cx, dt, posResp);
        const sy = springStep(cy, vy, seg.to.cy, dt, posResp);
        const sz = springStep(zoom, vz, seg.to.zoom, dt, zoomResp);
        cx = sx.x;
        vx = sx.v;
        cy = sy.x;
        vy = sy.v;
        zoom = sz.x;
        vz = sz.v;
        if (zoom < 1) {
          zoom = 1;
          if (vz < 0) vz = 0;
        }
        if (zoom > maxZoom) {
          zoom = maxZoom;
          if (vz > 0) vz = 0;
        }
        const px = softPushback(cx, vx, zoom, dt);
        cx = px.x;
        vx = px.v;
        const py = softPushback(cy, vy, zoom, dt);
        cy = py.x;
        vy = py.v;
        out.push({ t, zoom, cx, cy, vx, vy, vz });
      }
      return out;
    }
    module.exports = {
      ZETA,
      RESPONSE_POS,
      RESPONSE_ZOOM,
      PUSH_CAP,
      springStep,
      clampCenter,
      softPushback,
      bake,
      isHold
    };
  }
});

// visuals/src/cinema/cursor.ts
function initCursor(cfg, track, styles, clicks) {
  state.cfg = cfg;
  state.track = track;
  state.styles = styles;
  state.clicks = clicks;
  state.sx = null;
  state.sy = null;
}
function activeStyle(t) {
  const cfg = state.cfg;
  if (cfg.style !== "auto") return cfg.style;
  for (let i = state.styles.length - 1; i >= 0; i--) {
    const s = state.styles[i];
    if (t >= s.t0 && t <= s.t1) return s.style;
  }
  return "arrow";
}
function outlined(ctx, p, fill) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1.5;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.stroke(p);
  ctx.shadowColor = "transparent";
  ctx.fillStyle = fill;
  ctx.fill(p);
  ctx.restore();
}
function drawArrow(ctx, h) {
  const k = h / 25;
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(-1.5, -1);
  const p = new Path2D("M1.5 1 L1.5 18.5 L5.5 14.5 L9.5 22.5 L12 21.5 L8 13.5 L13.5 13.5 Z");
  outlined(ctx, p, "#101014");
  ctx.restore();
}
function drawPointer(ctx, h) {
  const k = h / 24;
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(-7, -1);
  const p = new Path2D(
    // index finger up, three folded knuckles, thumb tucked left
    "M5.6 1.8 a1.9 1.9 0 0 1 3.8 0 V10 h1.6 a1.6 1.6 0 0 1 3.2 0.3 h0.3 a1.55 1.55 0 0 1 3.1 0.4 V16.5 a6 6 0 0 1 -6 6 H9.2 a5.6 5.6 0 0 1 -4.6 -2.4 L2.2 16.6 a1.8 1.8 0 0 1 2.9 -2.1 l0.5 0.6 V1.8 Z"
  );
  outlined(ctx, p, "#101014");
  ctx.restore();
}
function drawText(ctx, h) {
  const k = h / 22;
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(-6, -11);
  const p = new Path2D(
    "M2 1 h3 a2 2 0 0 1 1 0.7 a2 2 0 0 1 1 -0.7 h3 v2 h-2 a1 1 0 0 0 -1 1 v14 a1 1 0 0 0 1 1 h2 v2 h-3 a2 2 0 0 1 -1 -0.7 a2 2 0 0 1 -1 0.7 H2 v-2 h2 a1 1 0 0 0 1 -1 V4 a1 1 0 0 0 -1 -1 H2 Z"
  );
  outlined(ctx, p, "#101014");
  ctx.restore();
}
function drawDot(ctx, h, tint) {
  const r = h * 0.24;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = tint;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = Math.max(1.5, r * 0.28);
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.stroke();
  ctx.restore();
}
function contentToScreen(t, x, y, W, H) {
  const zoom = Math.max(1, t.zoom);
  const sw = W / zoom, sh = H / zoom;
  const sx = Math.min(W - sw, Math.max(0, t.cx * W - sw / 2));
  const sy = Math.min(H - sh, Math.max(0, t.cy * H - sh / 2));
  return { x: (x * W - sx) * zoom, y: (y * H - sy) * zoom };
}
function drawCursor(ctx, tOut, dt, cam, W, H) {
  const cfg = state.cfg;
  if (!cfg || !cfg.show || cfg.style === "none") return null;
  const raw = import_overlay.default.sampleTrack(state.track, tOut);
  if (!raw) return null;
  let x = raw.x, y = raw.y;
  const sp = import_overlay.default.cursorSpring(cfg.smoothing);
  if (sp) {
    const rx = raw.x - cam.cx, ry = raw.y - cam.cy;
    if (!state.sx) {
      state.sx = { x: rx, v: 0 };
      state.sy = { x: ry, v: 0 };
    }
    const dx = Math.hypot(state.sx.x - rx, state.sy.x - ry);
    if (dx > 0.25) {
      state.sx = { x: rx, v: 0 };
      state.sy = { x: ry, v: 0 };
    }
    state.sx = import_spring.default.springStep(state.sx.x, state.sx.v, rx, dt, sp.response, sp.zeta);
    state.sy = import_spring.default.springStep(state.sy.x, state.sy.v, ry, dt, sp.response, sp.zeta);
    x = state.sx.x + cam.cx;
    y = state.sy.x + cam.cy;
  }
  const pt = contentToScreen(cam, x, y, W, H);
  const h = import_overlay.default.cursorPx(cfg.scale, W, cam.zoom);
  let squash = 1;
  for (let i = state.clicks.length - 1; i >= 0; i--) {
    const c = state.clicks[i];
    const p = (tOut - c.t) / (import_overlay.default.SQUASH_MS / 1e3);
    if (p >= 0 && p <= 1) {
      squash = import_overlay.default.squashScale(p, cfg.clickBounce, cam.zoom);
      break;
    }
    if (c.t < tOut - import_overlay.default.SQUASH_MS / 1e3) break;
  }
  ctx.save();
  ctx.translate(pt.x, pt.y);
  ctx.scale(squash, squash);
  const style = activeStyle(tOut);
  if (style === "dot") drawDot(ctx, h, cfg.color || cfg.accent);
  else if (style === "pointer") drawPointer(ctx, h);
  else if (style === "text") drawText(ctx, h);
  else drawArrow(ctx, h);
  ctx.restore();
  return { x, y, screen: pt, h };
}
var import_overlay, import_spring, state;
var init_cursor = __esm({
  "visuals/src/cinema/cursor.ts"() {
    import_overlay = __toESM(require_overlay());
    import_spring = __toESM(require_spring());
    state = { cfg: null, track: [], styles: [], clicks: [], sx: null, sy: null };
  }
});

// visuals/src/cinema/effects.ts
function initEffects(cfg, clicks) {
  state2.cfg = cfg;
  state2.clicks = clicks;
}
function drawEffects(ctx, tOut, cam, W, H) {
  const cfg = state2.cfg;
  if (!cfg || cfg.effect === "none") return;
  const durS = cfg.durationMs / 1e3;
  const delayS = import_overlay2.default.EFFECT_DELAY_MS / 1e3;
  const cursorH = import_overlay2.default.cursorPx(cfg.cursorScale, W, cam.zoom);
  for (const c of state2.clicks) {
    const started = c.t + delayS;
    const p = 1 - (tOut - started) / durS;
    if (p <= 0 || p > 1) continue;
    const pt = contentToScreen(cam, c.x, c.y, W, H);
    ctx.save();
    if (cfg.effect === "ripple") {
      const r = import_overlay2.default.rippleShape(p, cursorH, cfg.scale, cfg.opacity);
      ctx.globalAlpha = r.alpha;
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = r.strokeWidth;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const s = import_overlay2.default.spotlightShape(p, cursorH, cfg.scale, cfg.opacity);
      ctx.strokeStyle = cfg.color;
      ctx.globalAlpha = s.outerAlpha;
      ctx.lineWidth = s.outerWidth;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, s.glowR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = s.innerAlpha;
      ctx.lineWidth = s.innerWidth;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, s.innerR, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
var import_overlay2, state2;
var init_effects = __esm({
  "visuals/src/cinema/effects.ts"() {
    import_overlay2 = __toESM(require_overlay());
    init_cursor();
    state2 = { cfg: null, clicks: [] };
  }
});

// visuals/src/cinema/compositor.ts
var require_compositor = __commonJS({
  "visuals/src/cinema/compositor.ts"() {
    init_cursor();
    init_effects();
    var state3 = { spec: null, canvas: null, ctx: null, cache: /* @__PURE__ */ new Map() };
    var frameUrl = (i) => `${state3.spec.framesBase}f${String(i + 1).padStart(5, "0")}.jpg`;
    async function loadFrame(i) {
      const hit = state3.cache.get(i);
      if (hit) return hit;
      const img = new Image();
      img.src = frameUrl(i);
      await img.decode();
      state3.cache.set(i, img);
      for (const k of state3.cache.keys()) {
        if (state3.cache.size <= 4) break;
        if (k < i - 1) state3.cache.delete(k);
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
      const spec = state3.spec;
      const { width: W, height: H } = spec;
      const ctx = state3.ctx;
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
      const tOut = idx / spec.fps;
      if (spec.clicks) drawEffects(ctx, tOut, t, W, H);
      if (spec.cursor) drawCursor(ctx, tOut, 1 / spec.fps, t, W, H);
      ctx.globalAlpha = 1;
      if (idx + 1 < spec.frameCount) void loadFrame(idx + 1).catch(() => void 0);
      return state3.canvas.toDataURL("image/jpeg", spec.jpegQuality ?? 0.9);
    }
    async function init(spec) {
      state3.spec = spec;
      state3.cache.clear();
      const c = document.createElement("canvas");
      c.width = spec.width;
      c.height = spec.height;
      c.style.width = `${spec.width}px`;
      c.style.height = `${spec.height}px`;
      document.body.textContent = "";
      document.body.appendChild(c);
      state3.canvas = c;
      state3.ctx = c.getContext("2d", { willReadFrequently: false });
      if (spec.cursor) initCursor(spec.cursor.cfg, spec.cursor.track, spec.cursor.styles, spec.cursor.clicks);
      if (spec.clicks) initEffects(spec.clicks.cfg, spec.clicks.clicks);
      await loadFrame(0);
    }
    window.__CINEMA__ = { init, renderFrame };
    window.__CINEMA_READY__ = true;
  }
});
export default require_compositor();
