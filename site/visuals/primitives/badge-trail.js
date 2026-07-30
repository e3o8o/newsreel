// src/shared/ghost.ts
function ghostPointer(host, opts = {}) {
  const target = opts.target ?? host;
  const speed = opts.speed ?? 1;
  const bx = opts.boxX ?? 0.32;
  const by = opts.boxY ?? 0.28;
  let raf = 0;
  const t0 = performance.now();
  const tick = (now) => {
    const t = (now - t0) / 1e3 * speed;
    const r = host.getBoundingClientRect();
    const gx = 0.55 * Math.sin(t * 1.15) + 0.3 * Math.sin(t * 2.6 + 1) + 0.15 * Math.cos(t * 4.1 + 0.4);
    const gy = 0.55 * Math.cos(t * 0.95 + 2.1) + 0.3 * Math.sin(t * 2.2 + 0.5) + 0.15 * Math.cos(t * 3.7 + 1.7);
    const clientX = r.left + r.width * (0.5 + gx * bx);
    const clientY = r.top + r.height * (0.5 + gy * by);
    const ev = () => new PointerEvent("pointermove", { clientX, clientY, bubbles: true, pointerType: "mouse" });
    if (target === "hit") {
      const el = document.elementFromPoint(clientX, clientY);
      (el || host).dispatchEvent(ev());
    } else {
      target.dispatchEvent(ev());
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop: () => cancelAnimationFrame(raf) };
}

// src/badge-trail/adapter.ts
var WORDS = [
  "kerning",
  "baseline",
  "leading",
  "tracking",
  "x-height",
  "ligature",
  "serif",
  "grotesk",
  "bezier",
  "raster",
  "vector",
  "stroke",
  "gamut",
  "bleed",
  "weight",
  "grid",
  "hue",
  "counter",
  "ascender",
  "hinting",
  "widow",
  "orphan",
  "gutter",
  "opacity"
];
var FONT_PX = 15;
var CHAR_W = 9;
var PAD_X = 6;
var PAD_Y = 3;
var GAP = 4;
var DROP_MS = 60;
var MIN_TRAVEL = 20;
var APPEAR_MS = 120;
var HOLD_MS = 620;
var FADE_MS = 260;
var LIFE_MS = APPEAR_MS + HOLD_MS + FADE_MS;
var MAX_LIVE = 26;
function hue(i) {
  const h = i * 47 % 360;
  return `hsl(${h} 85% 62%)`;
}
var adapter_default = {
  async mount(host, props) {
    const words = Array.isArray(props.words) && props.words.length ? props.words : WORDS;
    host.style.background = String(props.bg ?? "#ffffff");
    host.style.overflow = "hidden";
    const live = [];
    let bag = [];
    let n = 0;
    let lastX = 0, lastY = 0, haveLast = false, lastDrop = 0;
    let px = -1, py = -1;
    const onMove = (e) => {
      const r = host.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
    };
    host.addEventListener("pointermove", onMove);
    const ghost = ghostPointer(host, { speed: 0.85, boxX: 0.38, boxY: 0.34 });
    const nextWord = () => {
      if (!bag.length) {
        bag = words.map((_, i) => i).sort(() => Math.random() - 0.5);
      }
      return words[bag.pop()];
    };
    const collides = (x, y, w, h) => live.some((b) => x < b.x + b.w + GAP && x + w + GAP > b.x && y < b.y + b.h + GAP && y + h + GAP > b.y);
    let raf = 0;
    const frame = () => {
      const now = performance.now();
      for (let i = live.length - 1; i >= 0; i--) {
        const b = live[i];
        const age = now - b.born;
        if (age >= LIFE_MS) {
          b.el.remove();
          live.splice(i, 1);
          continue;
        }
        let opacity = 1, scale = 1, rot = 0, ox = 0, oy = 0;
        if (age < APPEAR_MS) {
          const t = age / APPEAR_MS;
          const spring = 1 - Math.pow(1 - t, 3);
          opacity = Math.min(1, t * 1.4);
          scale = 0.9 + 0.13 * spring;
          const back = (1 - spring) * 6;
          ox = -b.dx * back;
          oy = -b.dy * back;
        } else if (age > APPEAR_MS + HOLD_MS) {
          const t = (age - APPEAR_MS - HOLD_MS) / FADE_MS;
          opacity = 1 - t;
          scale = 1 - 0.2 * t * t;
          rot = b.rot * t * t;
        }
        b.el.style.opacity = String(opacity);
        b.el.style.transform = `translate(${ox.toFixed(1)}px, ${oy.toFixed(1)}px) scale(${scale.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`;
      }
      if (px >= 0 && live.length < MAX_LIVE) {
        const travelled = haveLast ? Math.hypot(px - lastX, py - lastY) : Infinity;
        if (now - lastDrop >= DROP_MS && travelled >= MIN_TRAVEL) {
          const text = nextWord();
          const w = text.length * CHAR_W + PAD_X * 2;
          const h = FONT_PX + PAD_Y * 2;
          const x = Math.max(0, Math.min(host.clientWidth - w, px - w / 2));
          const y = Math.max(0, Math.min(host.clientHeight - h, py - h / 2));
          if (!collides(x, y, w, h)) {
            const dx = haveLast ? px - lastX : 0;
            const dy = haveLast ? py - lastY : -1;
            const m = Math.hypot(dx, dy) || 1;
            const el = document.createElement("span");
            el.textContent = text;
            Object.assign(el.style, {
              position: "absolute",
              left: `${x}px`,
              top: `${y}px`,
              font: `500 ${FONT_PX}px ui-monospace, SFMono-Regular, Menlo, monospace`,
              lineHeight: "1",
              whiteSpace: "nowrap",
              textTransform: "uppercase",
              padding: `${PAD_Y}px ${PAD_X}px`,
              borderRadius: "4px",
              background: hue(n),
              color: "#000",
              boxShadow: "0 1px 2px -1px rgba(20,20,30,0.35)",
              pointerEvents: "none",
              willChange: "opacity, transform"
            });
            host.appendChild(el);
            live.push({ el, x, y, w, h, born: now, dx: dx / m, dy: dy / m, rot: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 5) });
            n++;
            lastDrop = now;
            lastX = px;
            lastY = py;
            haveLast = true;
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    return {
      start: () => {
        raf = requestAnimationFrame(frame);
      },
      destroy: () => {
        cancelAnimationFrame(raf);
        ghost.stop();
        host.removeEventListener("pointermove", onMove);
        live.forEach((b) => b.el.remove());
      }
    };
  }
};
export {
  adapter_default as default
};
