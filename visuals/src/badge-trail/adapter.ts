// Scene: tiny mono badges drop behind the cursor and fade, never overlapping.
// props: words[], dark.
//
// Vanilla port of the React card. The rules that make it read are kept exactly: a badge only
// drops after the pointer has TRAVELLED a minimum distance (so a still cursor cannot stack
// them), and a candidate is skipped entirely if its box would touch a live one — density
// self-limits near clusters instead of piling up.

import { ghostPointer } from "../shared/ghost";

const WORDS = [
  "kerning", "baseline", "leading", "tracking", "x-height", "ligature", "serif", "grotesk",
  "bezier", "raster", "vector", "stroke", "gamut", "bleed", "weight", "grid", "hue",
  "counter", "ascender", "hinting", "widow", "orphan", "gutter", "opacity",
];

const FONT_PX = 15;
const CHAR_W = 9;
const PAD_X = 6;
const PAD_Y = 3;
const GAP = 4;
const DROP_MS = 60;
const MIN_TRAVEL = 20;
const APPEAR_MS = 120;
const HOLD_MS = 620;
const FADE_MS = 260;
const LIFE_MS = APPEAR_MS + HOLD_MS + FADE_MS;
const MAX_LIVE = 26;

interface Badge {
  el: HTMLElement;
  x: number; y: number; w: number; h: number;
  born: number;
  dx: number; dy: number;
  rot: number;
}

// A saturated hue walk, so neighbouring badges never land on the same colour.
function hue(i: number): string {
  const h = (i * 47) % 360;
  return `hsl(${h} 85% 62%)`;
}

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    const words = Array.isArray(props.words) && props.words.length ? (props.words as string[]) : WORDS;
    host.style.background = String(props.bg ?? "#ffffff");
    host.style.overflow = "hidden";

    const live: Badge[] = [];
    let bag: number[] = [];
    let n = 0;
    let lastX = 0, lastY = 0, haveLast = false, lastDrop = 0;
    let px = -1, py = -1;

    const onMove = (e: PointerEvent) => {
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
      return words[bag.pop()!];
    };

    // ⚠️ AABB against every live badge, inflated by GAP: skipping a drop is what keeps the
    //    trail from turning into a pile where the cursor slows down.
    const collides = (x: number, y: number, w: number, h: number) =>
      live.some((b) => x < b.x + b.w + GAP && x + w + GAP > b.x && y < b.y + b.h + GAP && y + h + GAP > b.y);

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
              position: "absolute", left: `${x}px`, top: `${y}px`,
              font: `500 ${FONT_PX}px ui-monospace, SFMono-Regular, Menlo, monospace`,
              lineHeight: "1", whiteSpace: "nowrap", textTransform: "uppercase",
              padding: `${PAD_Y}px ${PAD_X}px`, borderRadius: "4px",
              background: hue(n), color: "#000",
              boxShadow: "0 1px 2px -1px rgba(20,20,30,0.35)",
              pointerEvents: "none", willChange: "opacity, transform",
            });
            host.appendChild(el);
            live.push({ el, x, y, w, h, born: now, dx: dx / m, dy: dy / m, rot: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 5) });
            n++;
            lastDrop = now;
            lastX = px; lastY = py; haveLast = true;
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };

    return {
      start: () => { raf = requestAnimationFrame(frame); },
      destroy: () => {
        cancelAnimationFrame(raf);
        ghost.stop();
        host.removeEventListener("pointermove", onMove);
        live.forEach((b) => b.el.remove());
      },
    };
  },
};
