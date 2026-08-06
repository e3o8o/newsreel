// visuals/src/lifeline/intro-timing.ts
var LIFELINE_SLOW_YEARS = 5;
var LIFELINE_SLOW_TIME_RATIO = 0.38;
var LIFELINE_SLOW_MARKER_FADE_MS = 720;
var LIFELINE_FAST_MARKER_FADE_MS = 280;
var LIFELINE_EASE_POWER = 0;
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function snapToDevicePixel(value) {
  const dpr = window.devicePixelRatio || 1;
  return Math.round(value * dpr) / dpr;
}
function smoothstep(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}
function getSlowTrackWidth(widths) {
  return widths.slice(0, LIFELINE_SLOW_YEARS).reduce((sum, width) => sum + width, 0);
}
function getSlowTrackPortion(widths) {
  const total = widths.reduce((sum, width) => sum + width, 0);
  if (total <= 0) return 0;
  return getSlowTrackWidth(widths) / total;
}
function getEasePower(widths) {
  if (LIFELINE_EASE_POWER > 0) return LIFELINE_EASE_POWER;
  const slowPortion = getSlowTrackPortion(widths);
  const softenedPivot = smoothstep(LIFELINE_SLOW_TIME_RATIO);
  if (slowPortion <= 0 || softenedPivot <= 0 || softenedPivot >= 1) {
    return 2.6;
  }
  return Math.log(slowPortion) / Math.log(softenedPivot);
}
function softenedTime(elapsedMs, railMs) {
  return smoothstep(elapsedMs / railMs);
}
function trackProgressAtTime(elapsedMs, widths, railMs) {
  if (railMs <= 0) return 0;
  const t = softenedTime(elapsedMs, railMs);
  const power = getEasePower(widths);
  return clamp(Math.pow(t, power), 0, 1);
}
function timeAtTrackProgress(progress, widths, railMs) {
  const clamped = clamp(progress, 0, 1);
  if (clamped <= 0) return 0;
  if (clamped >= 1) return railMs;
  const power = getEasePower(widths);
  const softened = Math.pow(clamped, 1 / power);
  return invertSmoothstep(softened) * railMs;
}
function invertSmoothstep(value) {
  const target = clamp(value, 0, 1);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (smoothstep(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
function getTransitionMarkerFadeDuration(index) {
  if (index < LIFELINE_SLOW_YEARS) return LIFELINE_SLOW_MARKER_FADE_MS;
  const rampYears = 3;
  const rampIndex = index - LIFELINE_SLOW_YEARS;
  if (rampIndex >= rampYears) return LIFELINE_FAST_MARKER_FADE_MS;
  const t = (rampIndex + 1) / rampYears;
  const blend = smoothstep(t);
  return Math.round(
    LIFELINE_SLOW_MARKER_FADE_MS + (LIFELINE_FAST_MARKER_FADE_MS - LIFELINE_SLOW_MARKER_FADE_MS) * blend
  );
}
var LIFELINE_LABELS_MS = 600;
var LIFELINE_RAIL_MS = 3200;
var LIFELINE_REFERENCE_TRACK = 9e3;
var LIFELINE_RAIL_MAX_MS = 7200;
var LIFELINE_RAIL_SCALE_POWER = 0.45;
var LIFELINE_FADE_SCALE_MAX = 1.5;
function getRailDuration(totalMarkersWidth) {
  if (totalMarkersWidth <= LIFELINE_REFERENCE_TRACK) return LIFELINE_RAIL_MS;
  const scale = Math.pow(
    totalMarkersWidth / LIFELINE_REFERENCE_TRACK,
    LIFELINE_RAIL_SCALE_POWER
  );
  return Math.min(LIFELINE_RAIL_MAX_MS, Math.round(LIFELINE_RAIL_MS * scale));
}
function getFadeScale(railDuration) {
  return Math.min(LIFELINE_FADE_SCALE_MAX, railDuration / LIFELINE_RAIL_MS);
}

// visuals/src/lifeline/lifeline.ts
var TRACK_INSET = 96;
var TRACK_TAIL = 96;
function hasMarkerContent(marker) {
  return marker.lines.length > 0;
}
function getMarkerWidth(marker, next) {
  const hasContent = hasMarkerContent(marker);
  if (!next) return hasContent ? 360 : 80;
  if (!hasContent) return 80;
  return Math.min(420, Math.max(290, 1 * 36));
}
function buildColumn(marker, width, accent) {
  const col = document.createElement("div");
  col.className = "lifeline-col";
  col.style.width = `${width}px`;
  const hasContent = hasMarkerContent(marker);
  if (!hasContent) col.setAttribute("data-empty", "");
  const inner = document.createElement("div");
  inner.style.position = "relative";
  const tick = document.createElement("span");
  tick.className = "lifeline-tick";
  inner.appendChild(tick);
  const tag = document.createElement("p");
  tag.className = "lifeline-tag";
  tag.textContent = marker.tag ?? "";
  inner.appendChild(tag);
  const date = document.createElement("p");
  date.className = "lifeline-date";
  date.textContent = marker.label;
  inner.appendChild(date);
  if (hasContent) {
    const tint = marker.color ?? accent;
    col.setAttribute("data-color", "");
    col.style.setProperty("--ll-entry-color", tint);
    const lines = document.createElement("div");
    lines.className = "lifeline-lines";
    for (const line of marker.lines) {
      const title = document.createElement("p");
      title.className = "lifeline-line";
      title.textContent = line.text;
      lines.appendChild(title);
      if (line.detail) {
        const detail = document.createElement("p");
        detail.className = "lifeline-detail";
        detail.textContent = line.detail;
        lines.appendChild(detail);
      }
    }
    inner.appendChild(lines);
  }
  col.appendChild(inner);
  return { col, inner };
}
var LifelineScene = class {
  root;
  track;
  rail;
  head = null;
  columns = [];
  widths = [];
  railMs;
  maxTranslate = 0;
  rafId = 0;
  startTime = 0;
  started = false;
  holdStart = 0;
  constructor(host, markers, opts) {
    this.root = document.createElement("div");
    this.root.className = "lifeline-root";
    this.root.setAttribute("data-theme", opts.theme);
    if (opts.title) {
      this.head = document.createElement("p");
      this.head.className = "lifeline-head";
      this.head.textContent = opts.title;
      this.root.appendChild(this.head);
    }
    this.track = document.createElement("div");
    this.track.className = "lifeline-track";
    this.rail = document.createElement("div");
    this.rail.className = "lifeline-rail";
    const line = document.createElement("div");
    line.className = "lifeline-rail-line lifeline-rail-intro";
    this.rail.appendChild(line);
    this.track.appendChild(this.rail);
    this.widths = markers.map(
      (marker, index) => getMarkerWidth(marker, markers[index + 1])
    );
    const totalWidth = this.widths.reduce((sum, width) => sum + width, 0);
    this.track.style.width = `${totalWidth}px`;
    this.railMs = opts.sweepMs ?? getRailDuration(totalWidth);
    const fadeScale = getFadeScale(this.railMs);
    markers.forEach((marker, index) => {
      const { col, inner } = buildColumn(marker, this.widths[index], opts.accent);
      const offset = this.widths.slice(0, index).reduce((sum, width) => sum + width, 0);
      const delay = totalWidth > 0 ? timeAtTrackProgress(offset / totalWidth, this.widths, this.railMs) : 0;
      const fade = Math.round(getTransitionMarkerFadeDuration(index) * fadeScale);
      this.columns.push({ inner, delay, fade });
      this.track.appendChild(col);
    });
    this.root.appendChild(this.track);
    host.appendChild(this.root);
    const stageWidth = host.clientWidth || 1440;
    this.maxTranslate = Math.max(
      0,
      TRACK_INSET + totalWidth - (stageWidth - TRACK_TAIL)
    );
  }
  start() {
    if (this.rafId) return;
    const step = (now) => {
      if (!this.started) {
        this.started = true;
        this.startTime = now;
        this.root.style.setProperty("--lifeline-intro-progress", "0");
        this.applyTranslate(0);
        this.root.style.setProperty("--lifeline-labels-ms", `${LIFELINE_LABELS_MS}ms`);
        if (this.head) this.head.classList.add("lifeline-labels-intro");
        for (const { inner, delay, fade } of this.columns) {
          inner.style.animationDelay = `${delay}ms`;
          inner.style.setProperty("--lifeline-marker-fade-ms", `${fade}ms`);
          inner.classList.add("lifeline-marker-intro");
        }
      }
      if (this.holdStart) {
        this.rafId = requestAnimationFrame(step);
        return;
      }
      const elapsed = now - this.startTime;
      const progress = clamp(
        trackProgressAtTime(elapsed, this.widths, this.railMs),
        0,
        1
      );
      this.root.style.setProperty("--lifeline-intro-progress", String(progress));
      this.applyTranslate(progress * this.maxTranslate);
      if (progress < 1) {
        this.rafId = requestAnimationFrame(step);
        return;
      }
      this.root.style.setProperty("--lifeline-intro-progress", "1");
      this.applyTranslate(this.maxTranslate);
      this.rafId = 0;
    };
    this.rafId = requestAnimationFrame(step);
  }
  // Pause the sweep mid-travel (a `timeline` beat holding on an entry
  // while the narration names it), and pick it back up. The hold class
  // freezes the CSS fade clocks too, so delay-phase markers stay pending.
  hold() {
    if (this.holdStart) return;
    this.holdStart = performance.now();
    this.root.classList.add("lifeline-hold");
  }
  resume() {
    if (!this.holdStart) return;
    this.startTime += performance.now() - this.holdStart;
    this.holdStart = 0;
    this.root.classList.remove("lifeline-hold");
  }
  destroy() {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.root.remove();
  }
  applyTranslate(px) {
    this.track.style.transform = `translate3d(${-snapToDevicePixel(px)}px, 0, 0)`;
  }
};

// visuals/src/lifeline/lifeline.css
var lifeline_default = "/* Lifeline \u2014 a milestone timeline swept in left to right on a dashed rail.\n   The keyframes block below is lifted verbatim from evilrabbit/lifeline\n   (app/globals.css, MIT, (c) 2026 Evil Rabbit \u2014 see LICENSE); everything\n   after it reimplements the marker column and track styling as plain CSS,\n   mirroring the component's Tailwind utilities and zinc palette. */\n\n/* Lifeline \u2014 intro animation plumbing */\n@keyframes lifeline-rail-draw {\n  from {\n    transform: scaleX(0);\n  }\n  to {\n    transform: scaleX(1);\n  }\n}\n\n@keyframes lifeline-marker-in {\n  from {\n    opacity: 0;\n    transform: translate3d(0, 6px, 0);\n  }\n  to {\n    opacity: 1;\n    transform: translate3d(0, 0, 0);\n  }\n}\n\n@keyframes lifeline-labels-in {\n  from {\n    opacity: 0;\n  }\n  to {\n    opacity: 1;\n  }\n}\n\n.lifeline-rail-intro {\n  transform: scaleX(var(--lifeline-intro-progress, 0));\n  transform-origin: left center;\n}\n\n.lifeline-rail-intro-vertical {\n  transform: scaleY(var(--lifeline-intro-progress, 0));\n  transform-origin: top center;\n}\n\n.lifeline-marker-intro {\n  opacity: 0;\n  animation: lifeline-marker-in var(--lifeline-marker-fade-ms, 420ms)\n    cubic-bezier(0.22, 1, 0.36, 1) forwards;\n}\n\n.lifeline-labels-intro {\n  opacity: 0;\n  animation: lifeline-labels-in var(--lifeline-labels-ms, 600ms)\n    cubic-bezier(0.22, 1, 0.36, 1) forwards;\n}\n\n/* \u2500\u2500 scene styling (newsreel, plain CSS) \u2500\u2500\n   Themed from custom properties on the root; the zinc values mirror\n   lifeline's light/dark palette, with event text lifted a step brighter\n   than the component's resting state since nothing hovers in a video. */\n\n.lifeline-root {\n  position: absolute;\n  inset: 0;\n  overflow: hidden;\n  font-family: var(--font-neue-montreal);\n  background: var(--ll-bg);\n  /* rail sits this far below the top of the track content: tag row\n     (16px + 20px gap) + date row (20px + 24px gap), lifeline's 5rem. */\n  --ll-rail: 80px;\n  /* where the rail crosses the 900px stage, and the track top with it. */\n  --ll-rail-y: 378px;\n}\n\n.lifeline-root[data-theme=\"light\"] {\n  --ll-bg: #ffffff;\n  --ll-rail-color: #d4d4d8; /* zinc-300 */\n  --ll-tick: #a1a1aa; /* zinc-400 */\n  --ll-tag: #71717a; /* zinc-500 */\n  --ll-date: #71717a; /* zinc-500 */\n  --ll-title: #27272a; /* zinc-800 */\n  --ll-detail: #71717a; /* zinc-500 */\n  --ll-head: #71717a; /* zinc-500 */\n}\n\n.lifeline-root[data-theme=\"dark\"] {\n  --ll-bg: #000000;\n  --ll-rail-color: #27272a; /* zinc-800 */\n  --ll-tick: #3f3f46; /* zinc-700 */\n  --ll-tag: #52525b; /* zinc-600 */\n  --ll-date: #a1a1aa; /* zinc-400 */\n  --ll-title: #e4e4e7; /* zinc-200 */\n  --ll-detail: #71717a; /* zinc-500 */\n  --ll-head: #52525b; /* zinc-600 */\n}\n\n/* The moving strip. Width is the sum of marker widths; the sweep\n   translates it left so the newest entry glides into frame. */\n.lifeline-track {\n  position: absolute;\n  top: calc(var(--ll-rail-y) - var(--ll-rail));\n  left: var(--ll-track-inset, 96px);\n  display: flex;\n  align-items: flex-start;\n  will-change: transform;\n}\n\n.lifeline-rail {\n  position: absolute;\n  left: 0;\n  right: 0;\n  top: var(--ll-rail);\n  height: 1px;\n  overflow: hidden;\n  pointer-events: none;\n}\n\n.lifeline-rail-line {\n  height: 1px;\n  width: 100%;\n  border-top: 1px dashed var(--ll-rail-color);\n}\n\n/* One marker column: tick on the rail, tag row above the date, event\n   lines beneath. Same vertical rhythm as lifeline-marker.tsx. */\n.lifeline-col {\n  position: relative;\n  flex-shrink: 0;\n  padding-right: 32px;\n}\n\n.lifeline-tick {\n  position: absolute;\n  left: 0;\n  top: var(--ll-rail);\n  width: 1px;\n  height: 10px;\n  transform: translateY(-50%);\n  background: var(--ll-tick);\n}\n\n.lifeline-col[data-color] .lifeline-tick {\n  background: var(--ll-entry-color);\n}\n\n.lifeline-tag {\n  height: 16px;\n  margin-bottom: 20px;\n  font-size: 11px;\n  font-weight: 500;\n  line-height: 16px;\n  font-variant-numeric: tabular-nums;\n  color: var(--ll-tag);\n}\n\n.lifeline-col[data-color] .lifeline-tag {\n  color: var(--ll-entry-color);\n}\n\n.lifeline-date {\n  height: 20px;\n  margin-bottom: 24px;\n  font-size: 15px;\n  font-weight: 500;\n  line-height: 20px;\n  white-space: nowrap;\n  font-variant-numeric: tabular-nums;\n  color: var(--ll-date);\n}\n\n.lifeline-col[data-empty] .lifeline-date {\n  color: var(--ll-tag);\n}\n\n.lifeline-lines {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding-top: 24px;\n  padding-bottom: 40px;\n  max-width: 288px; /* lifeline's 18rem text measure */\n}\n\n.lifeline-line {\n  font-size: 14px;\n  line-height: 1.55;\n  letter-spacing: -0.01em;\n  color: var(--ll-title);\n}\n\n.lifeline-detail {\n  font-size: 14px;\n  line-height: 1.55;\n  letter-spacing: -0.01em;\n  color: var(--ll-detail);\n}\n\n/* A `hold` beat freezes the fade clocks with the sweep, so markers still\n   in their delay phase stay pending until `resume`. */\n.lifeline-hold .lifeline-marker-intro,\n.lifeline-hold .lifeline-labels-intro {\n  animation-play-state: paused;\n}\n\n/* The standing header: scene title top-left \u2014 lifeline's Age/Years shield\n   column simplified to a static block, since nothing is user-scrolled. */\n.lifeline-head {\n  position: absolute;\n  left: 64px;\n  top: 72px;\n  font-size: 13px;\n  font-weight: 500;\n  letter-spacing: 0.02em;\n  color: var(--ll-head);\n}\n";

// visuals/src/lifeline/adapter.ts
var DAY_MS = 864e5;
function parseDate(value) {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function monthShort(utc) {
  return new Date(utc).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}
function fullLabel(utc) {
  return `${monthShort(utc)} ${new Date(utc).getUTCDate()}`;
}
function shortLabel(utc, prevUtc) {
  const day = new Date(utc).getUTCDate();
  const turned = prevUtc === null || new Date(prevUtc).getUTCMonth() !== new Date(utc).getUTCMonth();
  return turned ? `${monthShort(utc)} ${day}` : `${day}`;
}
function readEntries(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item;
    const utc = parseDate(entry.date);
    if (utc === null || typeof entry.title !== "string") continue;
    out.push({ entry, utc });
  }
  out.sort((a, b) => a.utc - b.utc);
  return out;
}
function buildMarkers(props) {
  const entries = readEntries(props.entries);
  if (entries.length === 0) return [];
  const unit = props.unit === "day" ? "day" : "week";
  const unitMs = unit === "day" ? DAY_MS : 7 * DAY_MS;
  const startUtc = parseDate(props.start) ?? entries[0].utc;
  const endUtc = Math.max(
    parseDate(props.end) ?? entries[entries.length - 1].utc,
    entries[entries.length - 1].utc
  );
  const unitOf = (utc) => Math.max(1, Math.floor((utc - startUtc) / unitMs) + 1);
  const lastUnit = unitOf(endUtc);
  const byUnit = /* @__PURE__ */ new Map();
  for (const item of entries) {
    const idx = unitOf(item.utc);
    const list = byUnit.get(idx) ?? [];
    list.push(item);
    byUnit.set(idx, list);
  }
  const markers = [];
  let prevRep = null;
  for (let idx = 1; idx <= lastUnit; idx++) {
    const rep = startUtc + (idx - 1) * unitMs;
    const group = byUnit.get(idx);
    if (group) {
      const first = group[0];
      markers.push({
        id: `unit-${idx}`,
        label: fullLabel(first.utc),
        tag: first.entry.tag ?? (unit === "week" ? `W${idx}` : `D${idx}`),
        lines: group.map(({ entry }) => ({
          text: entry.title,
          ...entry.detail !== void 0 && { detail: entry.detail }
        })),
        ...first.entry.color !== void 0 && { color: first.entry.color }
      });
    } else {
      markers.push({ id: `unit-${idx}`, label: shortLabel(rep, prevRep), lines: [] });
    }
    prevRep = rep;
  }
  return markers;
}
var adapter_default = {
  async mount(host, props) {
    const style = document.createElement("style");
    style.textContent = lifeline_default;
    host.appendChild(style);
    const scene = new LifelineScene(host, buildMarkers(props), {
      ...typeof props.title === "string" && { title: props.title },
      theme: props.theme === "light" ? "light" : "dark",
      accent: String(props.accent ?? "#34d399"),
      ...Number(props.sweepSeconds) > 0 && {
        sweepMs: Number(props.sweepSeconds) * 1e3
      }
    });
    return {
      start: () => scene.start(),
      action: async (name) => {
        if (name === "hold") scene.hold();
        if (name === "resume") scene.resume();
      },
      destroy: () => scene.destroy()
    };
  }
};
export {
  adapter_default as default
};
