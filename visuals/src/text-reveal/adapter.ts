// Scene: two corner text blocks materializing through a cloudy fbm front, then clearing the
// same way and rotating to the next pair. props: pairs[] of {top[],bottom[]}, ink, paper.
//
// Vanilla port of the React card: RevealGL and renderCornerText are already framework-free,
// so this owns the phase machine (reveal -> hold -> clear -> swap) and the spring.

import { RevealGL, renderCornerText } from "./reveal-gl";

const HOLD_MS = 1500;
const OUT_HOLD_MS = 120;
const MAX_BLUR = 16;
const K_IN = 16;
const K_OUT = 22;
const DAMP = 1.12;
const REVEALED_AT = 0.95;
const GONE_AT = 0.02;

const DEFAULT_PAIRS = [
  { top: ["A week of work,", "in one place."], bottom: ["Written once,", "shown twice."] },
  { top: ["Capture what shipped.", "Say what it means."], bottom: ["The rest is", "just assembly."] },
];

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function springStep(pos: number, vel: number, target: number, k: number, damp: number, dt: number): [number, number] {
  const c = 2 * Math.sqrt(k) * damp;
  const v = vel + (-k * (pos - target) - c * vel) * dt;
  return [pos + v * dt, v];
}

export default {
  async mount(host: HTMLElement, props: Record<string, unknown>) {
    const paper = String(props.paper ?? "#fdfdfb");
    const ink = String(props.ink ?? "#242320");
    host.style.background = paper;

    const gl = new RevealGL();
    if (!gl.available) throw new Error("text-reveal: WebGL unavailable");
    host.appendChild(gl.canvas);

    const pairs = Array.isArray(props.pairs) && props.pairs.length
      ? (props.pairs as { top: string[]; bottom: string[] }[])
      : DEFAULT_PAIRS;
    const edge = hexToRgb(String(props.edge ?? "#f2f1ec"));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const font = "Georgia, 'Times New Roman', serif";

    let index = 0;
    let seed = 1.7;
    let W = host.clientWidth || 1;
    let H = host.clientHeight || 1;

    const mount = () => {
      W = host.clientWidth || 1;
      H = host.clientHeight || 1;
      gl.resize(W, H, dpr);
      const p = pairs[index % pairs.length];
      gl.setTexture(renderCornerText({ top: p.top, bottom: p.bottom, font, fill: ink, cardW: W, cardH: H, dpr }));
    };
    mount();
    const ro = new ResizeObserver(() => mount());
    ro.observe(host);

    let phase: "in" | "hold" | "out" = "in";
    let phaseStart = 0;
    let progress = 0;
    let vel = 0;
    let target = 1;
    let clock = 0;
    let last = 0;
    let raf = 0;

    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      clock += dt;
      [progress, vel] = springStep(progress, vel, target, target > 0.5 ? K_IN : K_OUT, DAMP, dt);

      if (phase === "in") {
        if (progress >= REVEALED_AT) { phase = "hold"; phaseStart = now; }
      } else if (phase === "hold") {
        if (now - phaseStart >= HOLD_MS) { phase = "out"; phaseStart = now; target = 0; }
      } else if (progress <= GONE_AT && now - phaseStart >= OUT_HOLD_MS) {
        index = (index + 1) % pairs.length;
        seed = ((seed * 1.618) % 7) + 0.3;
        mount();
        phase = "in"; phaseStart = now; progress = 0; vel = 0; target = 1;
      }

      const p = Math.max(0, Math.min(1, progress));
      gl.draw(p, MAX_BLUR, edge, clock, W / Math.max(1, H), seed, [0, 0], [0, 0], [-1, -1], 0, phase === "out" ? 1 : 0);
      raf = requestAnimationFrame(loop);
    };

    return {
      start: () => { last = performance.now(); raf = requestAnimationFrame(loop); },
      destroy: () => { cancelAnimationFrame(raf); ro.disconnect(); gl.destroy(); },
    };
  },
};
